import { getAuth } from "@clerk/express";
import {
  and,
  count,
  desc,
  eq,
  inArray,
  isNull,
} from "drizzle-orm";
import { Router, type IRouter, type Request, type Response } from "express";
import {
  CreateCommentBody,
  CreateCommentParams,
  CreateCommentResponse,
  CreatePostBody,
  CreatePostResponse,
  GetCommentsParams,
  GetCommentsResponse,
  GetFeedQueryParams,
  GetFeedResponse,
  GetMyProfileResponse,
  GetProfileParams,
  GetProfileResponse,
  GetProfileSuggestionsResponse,
  ToggleFollowParams,
  ToggleFollowResponse,
  ToggleLikeParams,
  ToggleLikeResponse,
  UpdateMyProfileBody,
  UpdateMyProfileResponse,
} from "@workspace/api-zod";
import {
  commentsTable,
  db,
  followsTable,
  likesTable,
  mediaUploadsTable,
  postsTable,
  profilesTable,
} from "@workspace/db";
import { ObjectNotFoundError, ObjectStorageService } from "../lib/objectStorage";
import { ensureProfile } from "../lib/socialProfiles";

const router: IRouter = Router();
const storage = new ObjectStorageService();

type ProfileRow = typeof profilesTable.$inferSelect;
type PostRow = typeof postsTable.$inferSelect;

function requireUser(req: Request, res: Response): string | null {
  const userId = getAuth(req).userId;
  if (!userId) {
    res.status(401).json({ error: "Sign-in required" });
    return null;
  }
  return userId;
}

async function profileDto(
  row: ProfileRow,
  viewerId: string,
): Promise<{
  id: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  bio: string | null;
  postsCount: number;
  followersCount: number;
  followingCount: number;
  isFollowing: boolean;
}> {
  const [postCount, followerCount, followingCount, followState] =
    await Promise.all([
      db
        .select({ value: count() })
        .from(postsTable)
        .where(eq(postsTable.authorId, row.id)),
      db
        .select({ value: count() })
        .from(followsTable)
        .where(eq(followsTable.followedId, row.id)),
      db
        .select({ value: count() })
        .from(followsTable)
        .where(eq(followsTable.followerId, row.id)),
      viewerId === row.id
        ? Promise.resolve([])
        : db
            .select({ followerId: followsTable.followerId })
            .from(followsTable)
            .where(
              and(
                eq(followsTable.followerId, viewerId),
                eq(followsTable.followedId, row.id),
              ),
            )
            .limit(1),
    ]);

  return {
    id: row.id,
    username: row.username,
    displayName: row.displayName,
    avatarUrl: row.avatarUrl,
    bio: row.bio,
    postsCount: Number(postCount[0]?.value ?? 0),
    followersCount: Number(followerCount[0]?.value ?? 0),
    followingCount: Number(followingCount[0]?.value ?? 0),
    isFollowing: followState.length > 0,
  };
}

async function serializePosts(
  rows: PostRow[],
  viewerId: string,
): Promise<
  Array<{
    id: number;
    caption: string | null;
    mediaPath: string;
    mediaType: string;
    createdAt: string;
    author: {
      id: string;
      username: string;
      displayName: string;
      avatarUrl: string | null;
    };
    likesCount: number;
    commentsCount: number;
    likedByMe: boolean;
  }>
> {
  if (rows.length === 0) return [];
  const ids = rows.map((row) => row.id);
  const authorIds = [...new Set(rows.map((row) => row.authorId))];
  const [likes, comments, viewerLikes, authors] = await Promise.all([
    db
      .select({ postId: likesTable.postId, value: count() })
      .from(likesTable)
      .where(inArray(likesTable.postId, ids))
      .groupBy(likesTable.postId),
    db
      .select({ postId: commentsTable.postId, value: count() })
      .from(commentsTable)
      .where(inArray(commentsTable.postId, ids))
      .groupBy(commentsTable.postId),
    db
      .select({ postId: likesTable.postId })
      .from(likesTable)
      .where(
        and(
          eq(likesTable.userId, viewerId),
          inArray(likesTable.postId, ids),
        ),
      ),
    db
      .select()
      .from(profilesTable)
      .where(inArray(profilesTable.id, authorIds)),
  ]);
  const likesByPost = new Map(likes.map((row) => [row.postId, Number(row.value)]));
  const commentsByPost = new Map(
    comments.map((row) => [row.postId, Number(row.value)]),
  );
  const likedIds = new Set(viewerLikes.map((row) => row.postId));
  const authorById = new Map(authors.map((row) => [row.id, row]));

  return rows.flatMap((row) => {
    const author = authorById.get(row.authorId);
    if (!author) return [];
    return [
      {
        id: row.id,
        caption: row.caption,
        mediaPath: row.mediaPath,
        mediaType: row.mediaType,
        createdAt: row.createdAt.toISOString(),
        author: {
          id: author.id,
          username: author.username,
          displayName: author.displayName,
          avatarUrl: author.avatarUrl,
        },
        likesCount: likesByPost.get(row.id) ?? 0,
        commentsCount: commentsByPost.get(row.id) ?? 0,
        likedByMe: likedIds.has(row.id),
      },
    ];
  });
}

router.get("/me/profile", async (req, res): Promise<void> => {
  const userId = requireUser(req, res);
  if (!userId) return;
  const profile = await ensureProfile(userId);
  res.json(GetMyProfileResponse.parse(await profileDto(profile, userId)));
});

router.patch("/me/profile", async (req, res): Promise<void> => {
  const userId = requireUser(req, res);
  if (!userId) return;
  const parsed = UpdateMyProfileBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  try {
    await ensureProfile(userId);
    const [updated] = await db
      .update(profilesTable)
      .set({ ...parsed.data, updatedAt: new Date() })
      .where(eq(profilesTable.id, userId))
      .returning();
    if (!updated) {
      res.status(404).json({ error: "Profile not found" });
      return;
    }
    res.json(
      UpdateMyProfileResponse.parse(await profileDto(updated, userId)),
    );
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "23505"
    ) {
      res.status(409).json({ error: "That username is already taken" });
      return;
    }
    throw error;
  }
});

router.get("/feed", async (req, res): Promise<void> => {
  const userId = requireUser(req, res);
  if (!userId) return;
  const parsed = GetFeedQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  await ensureProfile(userId);

  let rows: PostRow[];
  if (parsed.data.scope === "following") {
    const followed = await db
      .select({ followedId: followsTable.followedId })
      .from(followsTable)
      .where(eq(followsTable.followerId, userId));
    const authorIds = [userId, ...followed.map((row) => row.followedId)];
    rows = await db
      .select()
      .from(postsTable)
      .where(inArray(postsTable.authorId, authorIds))
      .orderBy(desc(postsTable.createdAt))
      .limit(40);
  } else {
    rows = await db
      .select()
      .from(postsTable)
      .orderBy(desc(postsTable.createdAt))
      .limit(40);
  }
  res.json(GetFeedResponse.parse(await serializePosts(rows, userId)));
});

router.get("/profiles/suggestions", async (req, res): Promise<void> => {
  const userId = requireUser(req, res);
  if (!userId) return;
  await ensureProfile(userId);
  const followed = await db
    .select({ followedId: followsTable.followedId })
    .from(followsTable)
    .where(eq(followsTable.followerId, userId));
  const followedIds = new Set([
    userId,
    ...followed.map((row) => row.followedId),
  ]);
  const candidates = await db
    .select()
    .from(profilesTable)
    .orderBy(desc(profilesTable.createdAt))
    .limit(30);
  const suggestions = await Promise.all(
    candidates
      .filter((profile) => !followedIds.has(profile.id))
      .slice(0, 6)
      .map((profile) => profileDto(profile, userId)),
  );
  res.json(GetProfileSuggestionsResponse.parse(suggestions));
});

router.get("/profiles/:username", async (req, res): Promise<void> => {
  const userId = requireUser(req, res);
  if (!userId) return;
  const params = GetProfileParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  await ensureProfile(userId);
  const [profile] = await db
    .select()
    .from(profilesTable)
    .where(eq(profilesTable.username, params.data.username))
    .limit(1);
  if (!profile) {
    res.status(404).json({ error: "Profile not found" });
    return;
  }
  const posts = await db
    .select()
    .from(postsTable)
    .where(eq(postsTable.authorId, profile.id))
    .orderBy(desc(postsTable.createdAt))
    .limit(60);
  const result = {
    profile: await profileDto(profile, userId),
    posts: await serializePosts(posts, userId),
  };
  res.json(GetProfileResponse.parse(result));
});

router.put("/profiles/:username/follow", async (req, res): Promise<void> => {
  const userId = requireUser(req, res);
  if (!userId) return;
  const params = ToggleFollowParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  await ensureProfile(userId);
  const [target] = await db
    .select()
    .from(profilesTable)
    .where(eq(profilesTable.username, params.data.username))
    .limit(1);
  if (!target) {
    res.status(404).json({ error: "Profile not found" });
    return;
  }
  if (target.id === userId) {
    res.status(400).json({ error: "You cannot follow yourself" });
    return;
  }

  const [existing] = await db
    .select()
    .from(followsTable)
    .where(
      and(
        eq(followsTable.followerId, userId),
        eq(followsTable.followedId, target.id),
      ),
    )
    .limit(1);
  let following = false;
  if (existing) {
    await db
      .delete(followsTable)
      .where(
        and(
          eq(followsTable.followerId, userId),
          eq(followsTable.followedId, target.id),
        ),
      );
  } else {
    await db
      .insert(followsTable)
      .values({ followerId: userId, followedId: target.id })
      .onConflictDoNothing();
    following = true;
  }
  res.json(ToggleFollowResponse.parse({ following }));
});

router.post("/posts", async (req, res): Promise<void> => {
  const userId = requireUser(req, res);
  if (!userId) return;
  const parsed = CreatePostBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  await ensureProfile(userId);
  const [upload] = await db
    .select()
    .from(mediaUploadsTable)
    .where(
      and(
        eq(mediaUploadsTable.objectPath, parsed.data.mediaPath),
        eq(mediaUploadsTable.ownerId, userId),
        isNull(mediaUploadsTable.postId),
      ),
    )
    .limit(1);
  if (!upload || upload.mediaType !== parsed.data.mediaType) {
    res.status(400).json({ error: "Upload not found or already used" });
    return;
  }

  try {
    await storage.getObjectEntityFile(upload.objectPath);
  } catch (error) {
    if (error instanceof ObjectNotFoundError) {
      res.status(400).json({ error: "Upload is not available yet" });
      return;
    }
    throw error;
  }

  const post = await db.transaction(async (tx) => {
    const [created] = await tx
      .insert(postsTable)
      .values({
        authorId: userId,
        caption: parsed.data.caption,
        mediaPath: upload.objectPath,
        mediaType: upload.mediaType,
      })
      .returning();
    await tx
      .update(mediaUploadsTable)
      .set({ postId: created.id })
      .where(eq(mediaUploadsTable.objectPath, upload.objectPath));
    return created;
  });
  const [postDto] = await serializePosts([post], userId);
  res.status(201).json(CreatePostResponse.parse(postDto));
});

router.put("/posts/:postId/like", async (req, res): Promise<void> => {
  const userId = requireUser(req, res);
  if (!userId) return;
  const params = ToggleLikeParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  await ensureProfile(userId);
  const [post] = await db
    .select({ id: postsTable.id })
    .from(postsTable)
    .where(eq(postsTable.id, params.data.postId))
    .limit(1);
  if (!post) {
    res.status(404).json({ error: "Post not found" });
    return;
  }
  const [existing] = await db
    .select()
    .from(likesTable)
    .where(
      and(
        eq(likesTable.postId, post.id),
        eq(likesTable.userId, userId),
      ),
    )
    .limit(1);
  let liked = false;
  if (existing) {
    await db
      .delete(likesTable)
      .where(
        and(
          eq(likesTable.postId, post.id),
          eq(likesTable.userId, userId),
        ),
      );
  } else {
    await db
      .insert(likesTable)
      .values({ postId: post.id, userId })
      .onConflictDoNothing();
    liked = true;
  }
  const [likeCount] = await db
    .select({ value: count() })
    .from(likesTable)
    .where(eq(likesTable.postId, post.id));
  res.json(
    ToggleLikeResponse.parse({
      liked,
      likesCount: Number(likeCount?.value ?? 0),
    }),
  );
});

router.get(
  "/posts/:postId/comments",
  async (req, res): Promise<void> => {
    const userId = requireUser(req, res);
    if (!userId) return;
    const params = GetCommentsParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }
    const [post] = await db
      .select({ id: postsTable.id })
      .from(postsTable)
      .where(eq(postsTable.id, params.data.postId))
      .limit(1);
    if (!post) {
      res.status(404).json({ error: "Post not found" });
      return;
    }
    const rows = await db
      .select({
        id: commentsTable.id,
        text: commentsTable.text,
        createdAt: commentsTable.createdAt,
        author: {
          id: profilesTable.id,
          username: profilesTable.username,
          displayName: profilesTable.displayName,
          avatarUrl: profilesTable.avatarUrl,
        },
      })
      .from(commentsTable)
      .innerJoin(profilesTable, eq(commentsTable.userId, profilesTable.id))
      .where(eq(commentsTable.postId, post.id))
      .orderBy(commentsTable.createdAt)
      .limit(100);
    res.json(
      GetCommentsResponse.parse(
        rows.map((row) => ({
          ...row,
          createdAt: row.createdAt.toISOString(),
        })),
      ),
    );
  },
);

router.post(
  "/posts/:postId/comments",
  async (req, res): Promise<void> => {
    const userId = requireUser(req, res);
    if (!userId) return;
    const params = CreateCommentParams.safeParse(req.params);
    const parsed = CreateCommentBody.safeParse(req.body);
    if (!params.success || !parsed.success) {
      res.status(400).json({
        error: !params.success
          ? params.error.message
          : parsed.error.message,
      });
      return;
    }
    const text = parsed.data.text.trim();
    if (!text) {
      res.status(400).json({ error: "Comment cannot be empty" });
      return;
    }
    await ensureProfile(userId);
    const [post] = await db
      .select({ id: postsTable.id })
      .from(postsTable)
      .where(eq(postsTable.id, params.data.postId))
      .limit(1);
    if (!post) {
      res.status(404).json({ error: "Post not found" });
      return;
    }
    const [comment] = await db
      .insert(commentsTable)
      .values({ postId: post.id, userId, text })
      .returning();
    const [author] = await db
      .select()
      .from(profilesTable)
      .where(eq(profilesTable.id, userId))
      .limit(1);
    res
      .status(201)
      .json(
        CreateCommentResponse.parse({
          id: comment.id,
          text: comment.text,
          createdAt: comment.createdAt.toISOString(),
          author: {
            id: author.id,
            username: author.username,
            displayName: author.displayName,
            avatarUrl: author.avatarUrl,
          },
        }),
      );
  },
);

export default router;
