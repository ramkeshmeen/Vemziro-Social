import { Readable } from 'stream';
import {
  RequestUploadUrlBody,
  RequestUploadUrlResponse,
} from '@workspace/api-zod';
import { Router, type IRouter, type Request, type Response } from 'express';
import { getAuth } from '@clerk/express';
import { eq } from 'drizzle-orm';
import { db, mediaUploadsTable, postsTable } from '@workspace/db';
import { ensureProfile } from '../lib/socialProfiles';

import {
  ObjectNotFoundError,
  ObjectStorageService,
} from '../lib/objectStorage';

const router: IRouter = Router();
const objectStorageService = new ObjectStorageService();

const IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);
const VIDEO_TYPES = new Set(['video/mp4', 'video/webm', 'video/quicktime']);
const MAX_IMAGE_BYTES = 15 * 1024 * 1024;
const MAX_VIDEO_BYTES = 100 * 1024 * 1024;

/**
 * POST /storage/uploads/request-url
 *
 * Request a presigned URL for file upload.
 * The client sends JSON metadata (name, size, contentType) — NOT the file.
 * Then uploads the file directly to the returned presigned URL.
 * Requires auth middleware so public callers cannot mint write-capable URLs.
 */
router.post(
  '/storage/uploads/request-url',
  async (req: Request, res: Response): Promise<void> => {
    const userId = getAuth(req).userId;
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const parsed = RequestUploadUrlBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }

    const { name, size, contentType } = parsed.data;
    const mediaType = IMAGE_TYPES.has(contentType)
      ? 'image'
      : VIDEO_TYPES.has(contentType)
        ? 'video'
        : null;
    if (!mediaType) {
      res.status(400).json({ error: 'Choose a supported image or video format' });
      return;
    }
    const maxSize = mediaType === 'image' ? MAX_IMAGE_BYTES : MAX_VIDEO_BYTES;
    if (size > maxSize) {
      res.status(400).json({
        error:
          mediaType === 'image'
            ? 'Images must be 15 MB or smaller'
            : 'Videos must be 100 MB or smaller',
      });
      return;
    }

    try {
      await ensureProfile(userId);
      const uploadURL = await objectStorageService.getObjectEntityUploadURL();
      const objectPath =
        objectStorageService.normalizeObjectEntityPath(uploadURL);

      await db.insert(mediaUploadsTable).values({
        objectPath,
        ownerId: userId,
        contentType,
        mediaType,
        sizeBytes: size,
      });

      res.json(RequestUploadUrlResponse.parse({ uploadURL, objectPath }));
    } catch (error) {
      req.log.error({ err: error, name }, 'Error generating upload URL');
      res.status(500).json({ error: 'Failed to generate upload URL' });
    }
  },
);

/**
 * GET /storage/public-objects/*
 *
 * Serve public assets from PUBLIC_OBJECT_SEARCH_PATHS.
 * These are unconditionally public — no authentication or ACL checks.
 * IMPORTANT: Always provide this endpoint when object storage is set up.
 */
router.get(
  '/storage/public-objects/*filePath',
  async (req: Request, res: Response) => {
    try {
      const raw = req.params.filePath;
      const filePath = Array.isArray(raw) ? raw.join('/') : raw;
      const file = await objectStorageService.searchPublicObject(filePath);
      if (!file) {
        res.status(404).json({ error: 'File not found' });
        return;
      }

      const response = await objectStorageService.downloadObject(file);

      res.status(response.status);
      response.headers.forEach((value, key) => res.setHeader(key, value));

      if (response.body) {
        const nodeStream = Readable.fromWeb(
          response.body as ReadableStream<Uint8Array>,
        );
        nodeStream.pipe(res);
      } else {
        res.end();
      }
    } catch (error) {
      req.log.error({ err: error }, 'Error serving public object');
      res.status(500).json({ error: 'Failed to serve public object' });
    }
  },
);

/**
 * GET /storage/objects/*
 *
 * Serve object entities from PRIVATE_OBJECT_DIR.
 * These are served from a separate path from /public-objects and can optionally
 * be protected with authentication or ACL checks based on the use case.
 */
router.get('/storage/objects/*path', async (req: Request, res: Response) => {
  try {
    if (!getAuth(req).userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const raw = req.params.path;
    const wildcardPath = Array.isArray(raw) ? raw.join('/') : raw;
    const objectPath = `/objects/${wildcardPath}`;
    const [publishedPost] = await db
      .select({ id: postsTable.id })
      .from(postsTable)
      .where(eq(postsTable.mediaPath, objectPath))
      .limit(1);
    if (!publishedPost) {
      res.status(404).json({ error: 'Media not found' });
      return;
    }

    const objectFile =
      await objectStorageService.getObjectEntityFile(objectPath);
    const response = await objectStorageService.downloadObject(objectFile);

    res.status(response.status);
    response.headers.forEach((value, key) => res.setHeader(key, value));

    if (response.body) {
      const nodeStream = Readable.fromWeb(
        response.body as ReadableStream<Uint8Array>,
      );
      nodeStream.pipe(res);
    } else {
      res.end();
    }
  } catch (error) {
    if (error instanceof ObjectNotFoundError) {
      req.log.warn({ err: error }, 'Object not found');
      res.status(404).json({ error: 'Object not found' });
      return;
    }
    req.log.error({ err: error }, 'Error serving object');
    res.status(500).json({ error: 'Failed to serve object' });
  }
});

export default router;
