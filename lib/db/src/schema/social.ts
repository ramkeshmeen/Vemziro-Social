import {
  index,
  integer,
  pgTable,
  primaryKey,
  serial,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

export const profilesTable = pgTable(
  "profiles",
  {
    id: text("id").primaryKey(),
    username: text("username").notNull(),
    displayName: text("display_name").notNull(),
    avatarUrl: text("avatar_url"),
    bio: text("bio"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [uniqueIndex("profiles_username_unique").on(table.username)],
);

export const postsTable = pgTable(
  "posts",
  {
    id: serial("id").primaryKey(),
    authorId: text("author_id")
      .notNull()
      .references(() => profilesTable.id, { onDelete: "cascade" }),
    caption: text("caption"),
    mediaPath: text("media_path").notNull(),
    mediaType: text("media_type").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [index("posts_author_created_idx").on(table.authorId, table.createdAt)],
);

export const mediaUploadsTable = pgTable("media_uploads", {
  objectPath: text("object_path").primaryKey(),
  ownerId: text("owner_id")
    .notNull()
    .references(() => profilesTable.id, { onDelete: "cascade" }),
  contentType: text("content_type").notNull(),
  mediaType: text("media_type").notNull(),
  sizeBytes: integer("size_bytes").notNull(),
  postId: integer("post_id").references(() => postsTable.id, {
    onDelete: "set null",
  }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const likesTable = pgTable(
  "post_likes",
  {
    postId: integer("post_id")
      .notNull()
      .references(() => postsTable.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => profilesTable.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.postId, table.userId] }),
    index("post_likes_user_idx").on(table.userId),
  ],
);

export const commentsTable = pgTable(
  "post_comments",
  {
    id: serial("id").primaryKey(),
    postId: integer("post_id")
      .notNull()
      .references(() => postsTable.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => profilesTable.id, { onDelete: "cascade" }),
    text: text("text").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [index("post_comments_post_created_idx").on(table.postId, table.createdAt)],
);

export const followsTable = pgTable(
  "profile_follows",
  {
    followerId: text("follower_id")
      .notNull()
      .references(() => profilesTable.id, { onDelete: "cascade" }),
    followedId: text("followed_id")
      .notNull()
      .references(() => profilesTable.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.followerId, table.followedId] }),
    index("profile_follows_followed_idx").on(table.followedId),
  ],
);
