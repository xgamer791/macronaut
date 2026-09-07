import { ConvexError, v } from 'convex/values';
import type { Doc } from './_generated/dataModel';
import { mutation, query, type MutationCtx, type QueryCtx } from './_generated/server';
import { nowIso, requireOwned, requireUserId } from './lib/auth';
import { readableProfile } from './lib/profileAccess';

const CAPTION_MAX = 140;
const PHOTO_LIMIT = 200;

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
      await ctx.storage.delete(doc.imageId);
      await ctx.db.delete(id);
    }
    return null;
  },
});
