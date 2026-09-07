import { getAuthUserId } from '@convex-dev/auth/server';
import { ConvexError, v } from 'convex/values';
import type { Doc, Id } from './_generated/dataModel';
import { mutation, query, type MutationCtx, type QueryCtx } from './_generated/server';
import { nowIso, requireOwned, requireUserId } from './lib/auth';
import { readableProfile } from './lib/profileAccess';

const CAPTION_MAX = 140;
const PHOTO_LIMIT = 200;
const COMMENT_MAX = 280;
const COMMENT_LIMIT = 80;
const LIKE_SCAN = 500;

function capped(value: string | undefined): string | undefined {
  const trimmed = (value ?? '').trim();
  return trimmed ? trimmed.slice(0, CAPTION_MAX) : undefined;
}

async function photoView(ctx: QueryCtx | MutationCtx, doc: Doc<'profilePhotos'>) {
  return {
    id: doc._id as string,
    imageUrl: (await ctx.storage.getUrl(doc.imageId)) ?? undefined,
    caption: doc.caption,
    isPublic: doc.isPublic,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}

async function photosFor(
  ctx: QueryCtx | MutationCtx,
  userId: Doc<'profiles'>['userId'],
  onlyPublic: boolean,
) {
  const rows = await ctx.db
    .query('profilePhotos')
    .withIndex('by_user_created', (q) => q.eq('userId', userId))
    .order('desc')
    .take(PHOTO_LIMIT);
  const visible = onlyPublic ? rows.filter((row) => row.isPublic) : rows;
  return Promise.all(visible.map((row) => photoView(ctx, row)));
}

/** The signed-in user's own wall — public and private together. */
export const mine = query({
  args: {},
  handler: async (ctx) => {
    const userId = await requireUserId(ctx);
    return photosFor(ctx, userId, false);
  },
});

/** Someone's photo wall. Private photos stay off a stranger's view; a
 * private profile and a missing handle both return null. */
export const forHandle = query({
  args: { handle: v.string() },
  handler: async (ctx, { handle }) => {
    const found = await readableProfile(ctx, handle);
    if (!found) return null;
    const photos = await photosFor(ctx, found.row.userId, !found.isOwner);
    return { isOwner: found.isOwner, photos };
  },
});

export const add = mutation({
  args: { imageId: v.id('_storage'), caption: v.optional(v.string()), isPublic: v.optional(v.boolean()) },
  handler: async (ctx, { imageId, caption, isPublic }) => {
    const userId = await requireUserId(ctx);
    const ts = nowIso();
    const doc = {
      userId,
      imageId,
      caption: capped(caption),
      isPublic: isPublic ?? true,
      createdAt: ts,
      updatedAt: ts,
    };
    const id = await ctx.db.insert('profilePhotos', doc);
    return photoView(ctx, { _id: id, _creationTime: Date.now(), ...doc });
  },
});

/** Insert a picker batch. `imageIds` is tap order; the first selected photo
 * is stamped newest so it leads the newest-first wall. */
export const addMany = mutation({
  args: { imageIds: v.array(v.id('_storage')), isPublic: v.optional(v.boolean()) },
  handler: async (ctx, { imageIds, isPublic }) => {
    const userId = await requireUserId(ctx);
    if (imageIds.length === 0) return [];

    const existing = await ctx.db
      .query('profilePhotos')
      .withIndex('by_user_created', (q) => q.eq('userId', userId))
      .order('desc')
      .take(PHOTO_LIMIT);
    const remaining = PHOTO_LIMIT - existing.length;
    if (remaining <= 0) throw new ConvexError('Your photo wall is full.');

    const ids = imageIds.slice(0, remaining);
    const latestMs = existing[0] ? Date.parse(existing[0].createdAt) : 0;
    const base = Math.max(Date.now(), Number.isFinite(latestMs) ? latestMs + 1 : 0);
    const visible = isPublic ?? true;

    const views = [];
    for (let i = 0; i < ids.length; i++) {
      const imageId = ids[i];
      if (!imageId) continue;
      const ts = new Date(base + (ids.length - 1 - i)).toISOString();
      const doc = {
        userId,
        imageId,
        isPublic: visible,
        createdAt: ts,
        updatedAt: ts,
      };
      const id = await ctx.db.insert('profilePhotos', doc);
      views.push(await photoView(ctx, { _id: id, _creationTime: Date.now(), ...doc }));
    }
    return views;
  },
});

export const setPublic = mutation({
  args: { id: v.id('profilePhotos'), isPublic: v.boolean() },
  handler: async (ctx, { id, isPublic }) => {
    const userId = await requireUserId(ctx);
    const existing = await requireOwned(ctx, 'profilePhotos', id, userId);
    const next = { ...existing, isPublic, updatedAt: nowIso() };
    await ctx.db.patch(id, { isPublic, updatedAt: next.updatedAt });
    return photoView(ctx, next);
  },
});

export const remove = mutation({
  args: { id: v.id('profilePhotos') },
  handler: async (ctx, { id }) => {
    const userId = await requireUserId(ctx);
    const doc = await ctx.db.get(id);
    if (doc && doc.userId === userId) {
      await deletePhotoGraph(ctx, doc);
    }
    return null;
  },
});

/** Public photo thread — likes, comments, and the author name. A private
 * photo, a private profile, and a missing id are the same `null`. */
export const thread = query({
  args: { id: v.id('profilePhotos') },
  handler: async (ctx, { id }) => {
    const found = await visiblePhoto(ctx, id);
    if (!found) return null;
    return photoThread(ctx, found.doc, found.viewerId);
  },
});

export const setLike = mutation({
  args: { id: v.id('profilePhotos'), liked: v.boolean() },
  handler: async (ctx, { id, liked }) => {
    const userId = await requireUserId(ctx);
    const found = await visiblePhoto(ctx, id);
    if (!found) throw new ConvexError('Photo not available');
    const existing = await ctx.db
      .query('photoLikes')
      .withIndex('by_user_photo', (q) => q.eq('userId', userId).eq('photoId', id))
      .first();
    if (liked && !existing) {
      await ctx.db.insert('photoLikes', { userId, photoId: id, createdAt: nowIso() });
    }
    if (!liked && existing) await ctx.db.delete(existing._id);
    return photoThread(ctx, found.doc, userId);
  },
});

export const addComment = mutation({
  args: { id: v.id('profilePhotos'), body: v.string() },
  handler: async (ctx, { id, body }) => {
    const userId = await requireUserId(ctx);
    const found = await visiblePhoto(ctx, id);
    if (!found) throw new ConvexError('Photo not available');
    const text = body.trim().slice(0, COMMENT_MAX);
    if (!text) throw new ConvexError('Write a comment first.');
    const createdAt = nowIso();
    const commentId = await ctx.db.insert('photoComments', {
      userId,
      photoId: id,
      body: text,
      createdAt,
    });
    const author = await profileForUser(ctx, userId);
    return {
      id: commentId as string,
      body: text,
      createdAt,
      authorName: authorName(author),
      authorHandle: author?.handle,
      isMine: true,
    };
  },
});

export const removeComment = mutation({
  args: { id: v.id('photoComments') },
  handler: async (ctx, { id }) => {
    const userId = await requireUserId(ctx);
    const comment = await ctx.db.get(id);
    if (!comment) return null;
    const photo = await ctx.db.get(comment.photoId);
    const canDelete = comment.userId === userId || photo?.userId === userId;
    if (canDelete) await ctx.db.delete(id);
    return null;
  },
});

async function visiblePhoto(
  ctx: QueryCtx | MutationCtx,
  id: Id<'profilePhotos'>,
): Promise<{ doc: Doc<'profilePhotos'>; viewerId: Id<'users'> | null; isOwner: boolean } | null> {
  const doc = await ctx.db.get(id);
  if (!doc) return null;
  const viewerId = await getAuthUserId(ctx);
  const isOwner = viewerId === doc.userId;
  if (isOwner) return { doc, viewerId, isOwner };
  if (!doc.isPublic) return null;
  const profile = await profileForUser(ctx, doc.userId);
  if (!profile?.isPublic) return null;
  return { doc, viewerId, isOwner: false };
}

async function deletePhotoGraph(ctx: MutationCtx, doc: Doc<'profilePhotos'>) {
  const likes = await ctx.db
    .query('photoLikes')
    .withIndex('by_photo', (q) => q.eq('photoId', doc._id))
    .collect();
  const comments = await ctx.db
    .query('photoComments')
    .withIndex('by_photo_created', (q) => q.eq('photoId', doc._id))
    .collect();
  for (const like of likes) await ctx.db.delete(like._id);
  for (const comment of comments) await ctx.db.delete(comment._id);
  await ctx.storage.delete(doc.imageId);
  await ctx.db.delete(doc._id);
}

async function photoThread(
  ctx: QueryCtx | MutationCtx,
  doc: Doc<'profilePhotos'>,
  viewerId: Id<'users'> | null,
) {
  const owner = await profileForUser(ctx, doc.userId);
  const likes = await ctx.db
    .query('photoLikes')
    .withIndex('by_photo', (q) => q.eq('photoId', doc._id))
    .take(LIKE_SCAN);
  const commentRows = await ctx.db
    .query('photoComments')
    .withIndex('by_photo_created', (q) => q.eq('photoId', doc._id))
    .order('asc')
    .take(COMMENT_LIMIT);
  const comments = [];
  for (const row of commentRows) {
    const author = await profileForUser(ctx, row.userId);
    comments.push({
      id: row._id as string,
      body: row.body,
      createdAt: row.createdAt,
      authorName: authorName(author),
      authorHandle: author?.handle,
      isMine: viewerId === row.userId,
    });
  }
  return {
    photo: await photoView(ctx, doc),
    ownerName: authorName(owner),
    ownerHandle: owner?.handle ?? '',
    likeCount: likes.length,
    likedByMe: viewerId ? likes.some((like) => like.userId === viewerId) : false,
    comments,
  };
}

async function profileForUser(ctx: QueryCtx | MutationCtx, userId: Id<'users'>) {
  return ctx.db
    .query('profiles')
    .withIndex('by_user', (q) => q.eq('userId', userId))
    .first();
}

function authorName(profile: Doc<'profiles'> | null): string {
  const named = profile?.displayName?.trim();
  if (named) return named;
  if (profile?.handle) return profile.handle;
  return 'Member';
}
