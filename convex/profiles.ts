import { getAuthUserId } from '@convex-dev/auth/server';
import { ConvexError, v } from 'convex/values';
import type { Doc, Id } from './_generated/dataModel';
import { mutation, query, type MutationCtx, type QueryCtx } from './_generated/server';
import { nowIso, requireOwned, requireUserId } from './lib/auth';
import { firstFreeHandle, handleSeed, isValidHandle, normalizeHandle } from './lib/handles';
import { profileEditableFields } from './lib/validators';
import { addFriendRequestNotification, removeFriendRequestNotification } from './notifications';

/** Caps on the free text a profile carries. Enforced here because the server
 * is the only place that has to hold: a public profile is readable by people
 * who never ran our client. */
const LIMITS = {
  displayName: 60,
  bio: 280,
  location: 60,
  primarySport: 40,
  postBody: 1000,
} as const;

/** Posts returned for one profile page. Profiles are a page, not a feed, so
 * the whole page is one read rather than a cursor. */
const POST_LIMIT = 200;

function capped(value: string | undefined, max: number): string | undefined {
  const trimmed = (value ?? '').trim();
  return trimmed ? trimmed.slice(0, max) : undefined;
}

async function storageUrl(
  ctx: QueryCtx | MutationCtx,
  id: Id<'_storage'> | undefined,
): Promise<string | undefined> {
  if (!id) return undefined;
  return (await ctx.storage.getUrl(id)) ?? undefined;
}

async function postCountFor(ctx: QueryCtx | MutationCtx, userId: Id<'users'>) {
  return (
    await ctx.db
      .query('profilePosts')
      .withIndex('by_user_created', (q) => q.eq('userId', userId))
      .collect()
  ).length;
}

/** Followers of `subjectId` and who they follow. `isFollowing` is whether
 * the viewer follows them — always false for yourself or a signed-out caller. */
async function socialFor(
  ctx: QueryCtx | MutationCtx,
  subjectId: Id<'users'>,
  viewerId: Id<'users'> | null,
) {
  const [followers, following] = await Promise.all([
    ctx.db
      .query('profileFollows')
      .withIndex('by_followee', (q) => q.eq('followeeId', subjectId))
      .collect(),
    ctx.db
      .query('profileFollows')
      .withIndex('by_user', (q) => q.eq('userId', subjectId))
      .collect(),
  ]);
  let isFollowing = false;
  if (viewerId && viewerId !== subjectId) {
    const row = await ctx.db
      .query('profileFollows')
      .withIndex('by_user_followee', (q) => q.eq('userId', viewerId).eq('followeeId', subjectId))
      .first();
    isFollowing = row !== null;
  }
  return {
    followerCount: followers.length,
    followingCount: following.length,
    isFollowing,
  };
}

/** What the client gets for a profile. Never the row: it drops `userId` and
 * turns storage ids into URLs, so the same shape is safe to hand to a
 * stranger reading a public page. */
async function profileView(
  ctx: QueryCtx | MutationCtx,
  doc: Doc<'profiles'>,
  opts: { isOwner: boolean; viewerId?: Id<'users'> | null },
) {
  const [postCount, social] = await Promise.all([
    postCountFor(ctx, doc.userId),
    socialFor(ctx, doc.userId, opts.viewerId ?? null),
  ]);
  return {
    id: doc._id as string,
    handle: doc.handle,
    displayName: doc.displayName,
    bio: doc.bio,
    location: doc.location,
    primarySport: doc.primarySport,
    avatarUrl: await storageUrl(ctx, doc.avatarId),
    bannerUrl: await storageUrl(ctx, doc.bannerId),
    isPublic: doc.isPublic,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
    postCount,
    ...social,
    isOwner: opts.isOwner,
    /** False for the placeholder `me` hands back before anything is saved. */
    saved: true,
  };
}

async function postView(ctx: QueryCtx | MutationCtx, doc: Doc<'profilePosts'>) {
  return {
    id: doc._id as string,
    body: doc.body,
    imageUrl: await storageUrl(ctx, doc.imageId),
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}

async function rowForUser(ctx: QueryCtx | MutationCtx, userId: Id<'users'>) {
  return ctx.db
    .query('profiles')
    .withIndex('by_user', (q) => q.eq('userId', userId))
    .first();
}

async function postsForUser(ctx: QueryCtx | MutationCtx, userId: Id<'users'>) {
  const rows = await ctx.db
    .query('profilePosts')
    .withIndex('by_user_created', (q) => q.eq('userId', userId))
    .order('desc')
    .take(POST_LIMIT);
  return Promise.all(rows.map((row) => postView(ctx, row)));
}

async function handleTaken(
  ctx: QueryCtx | MutationCtx,
  candidate: string,
  exceptUserId: Id<'users'>,
): Promise<boolean> {
  const existing = await ctx.db
    .query('profiles')
    .withIndex('by_handle', (q) => q.eq('handleLower', candidate))
    .first();
  return existing !== null && existing.userId !== exceptUserId;
}

/** The row for this user, created on first write. Every mutation goes through
 * here so there is no separate "create your profile" step to get wrong. */
async function loadOrCreate(ctx: MutationCtx, userId: Id<'users'>): Promise<Doc<'profiles'>> {
  const existing = await rowForUser(ctx, userId);
  if (existing) return existing;
  const user = await ctx.db.get(userId);
  const handle = await firstFreeHandle(handleSeed(user?.name, user?.email), (candidate) =>
    handleTaken(ctx, candidate, userId),
  );
  const ts = nowIso();
  const doc = {
    userId,
    handle,
    handleLower: handle,
    displayName: capped(user?.name, LIMITS.displayName),
    isPublic: false,
    createdAt: ts,
    updatedAt: ts,
  };
  const id = await ctx.db.insert('profiles', doc);
  return { _id: id, _creationTime: Date.now(), ...doc };
}

/** The signed-in user's own profile. Returns an unsaved placeholder rather
 * than null when nothing has been written yet, so the page renders the same
 * way before and after the first edit. */
export const me = query({
  args: {},
  handler: async (ctx) => {
    const userId = await requireUserId(ctx);
    const row = await rowForUser(ctx, userId);
    if (row) return profileView(ctx, row, { isOwner: true, viewerId: userId });

    const user = await ctx.db.get(userId);
    const ts = nowIso();
    const [postCount, social] = await Promise.all([
      postCountFor(ctx, userId),
      socialFor(ctx, userId, userId),
    ]);
    return {
      id: null as string | null,
      handle: handleSeed(user?.name, user?.email),
      displayName: capped(user?.name, LIMITS.displayName),
      bio: undefined as string | undefined,
      location: undefined as string | undefined,
      primarySport: undefined as string | undefined,
      avatarUrl: user?.image ?? undefined,
      bannerUrl: undefined as string | undefined,
      isPublic: false,
      createdAt: ts,
      updatedAt: ts,
      postCount,
      ...social,
      isOwner: true,
      saved: false,
    };
  },
});

export const myPosts = query({
  args: {},
  handler: async (ctx) => {
    const userId = await requireUserId(ctx);
    return postsForUser(ctx, userId);
  },
});

/**
 * A profile by handle, for anyone — including callers with no session.
 *
 * This is the one read in the app that crosses accounts, so it is written to
 * be dull: it resolves the handle, returns null unless the profile is public
 * or the caller owns it, and hands back `profileView` / `postView` rather
 * than rows. A private profile and a handle nobody has taken are the same
 * answer, so flipping the toggle off does not confirm the page exists.
 */
export const byHandle = query({
  args: { handle: v.string() },
  handler: async (ctx, { handle }) => {
    const wanted = normalizeHandle(handle);
    if (!wanted) return null;
    const row = await ctx.db
      .query('profiles')
      .withIndex('by_handle', (q) => q.eq('handleLower', wanted))
      .first();
    if (!row) return null;
    const viewerId = await getAuthUserId(ctx);
    const isOwner = viewerId === row.userId;
    if (!row.isPublic && !isOwner) return null;
    const posts = await postsForUser(ctx, row.userId);
    const profile = await profileView(ctx, row, { isOwner, viewerId });
    return { profile, posts };
  },
});

export const update = mutation({
  args: {
    ...profileEditableFields,
    handle: v.optional(v.string()),
    isPublic: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const row = await loadOrCreate(ctx, userId);

    const patch: Partial<Doc<'profiles'>> = { updatedAt: nowIso() };
    if (args.displayName !== undefined)
      patch.displayName = capped(args.displayName, LIMITS.displayName);
    if (args.bio !== undefined) patch.bio = capped(args.bio, LIMITS.bio);
    if (args.location !== undefined) patch.location = capped(args.location, LIMITS.location);
    if (args.primarySport !== undefined) {
      patch.primarySport = capped(args.primarySport, LIMITS.primarySport);
    }
    if (args.isPublic !== undefined) patch.isPublic = args.isPublic;

    if (args.handle !== undefined) {
      const wanted = normalizeHandle(args.handle);
      if (!isValidHandle(wanted)) {
        throw new ConvexError('Handles are 3-24 characters: letters, numbers and underscores.');
      }
      if (wanted !== row.handleLower) {
        if (await handleTaken(ctx, wanted, userId)) throw new ConvexError('That handle is taken');
        patch.handle = wanted;
        patch.handleLower = wanted;
      }
    }

    // The display name is also the account name the rest of the app shows.
    if (patch.displayName !== undefined) {
      await ctx.db.patch(userId, { name: patch.displayName });
    }

    await ctx.db.patch(row._id, patch);
    const next = { ...row, ...patch };
    return profileView(ctx, next, { isOwner: true, viewerId: userId });
  },
});

/** Direct upload target for a picked image. The client PUTs the file here and
 * hands the returned storage id straight back to `setImage` or `addPost`, so
 * image bytes never travel through a mutation argument. */
export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    await requireUserId(ctx);
    return ctx.storage.generateUploadUrl();
  },
});

/** Replace (or with `storageId: null`, clear) the avatar or the banner. The
 * file that was there is deleted, so a user who keeps changing their picture
 * does not leave a pile of orphans behind. */
export const setImage = mutation({
  args: {
    kind: v.union(v.literal('avatar'), v.literal('banner')),
    storageId: v.union(v.id('_storage'), v.null()),
  },
  handler: async (ctx, { kind, storageId }) => {
    const userId = await requireUserId(ctx);
    const row = await loadOrCreate(ctx, userId);
    const field = kind === 'avatar' ? 'avatarId' : 'bannerId';
    const previous = row[field];

    const patch: Partial<Doc<'profiles'>> = {
      [field]: storageId ?? undefined,
      updatedAt: nowIso(),
    };
    await ctx.db.patch(row._id, patch);
    if (previous && previous !== storageId) await ctx.storage.delete(previous);

    // The header avatar reads `users.image`, so keep it pointing at whatever
    // the profile picture is now.
    if (kind === 'avatar') {
      await ctx.db.patch(userId, {
        image: (await storageUrl(ctx, storageId ?? undefined)) ?? undefined,
      });
    }

    const next = { ...row, ...patch };
    return profileView(ctx, next, { isOwner: true, viewerId: userId });
  },
});

export const addPost = mutation({
  args: { body: v.string(), imageId: v.optional(v.id('_storage')) },
  handler: async (ctx, { body, imageId }) => {
    const userId = await requireUserId(ctx);
    const trimmed = capped(body, LIMITS.postBody);
    if (!trimmed && !imageId) throw new ConvexError('A post needs some words or a photo');
    // Posting is the first thing many people do, so it creates the profile too.
    await loadOrCreate(ctx, userId);
    const ts = nowIso();
    const doc = { userId, body: trimmed ?? '', imageId, createdAt: ts, updatedAt: ts };
    const id = await ctx.db.insert('profilePosts', doc);
    return postView(ctx, { _id: id, _creationTime: Date.now(), ...doc });
  },
});

export const updatePost = mutation({
  args: { id: v.id('profilePosts'), body: v.string() },
  handler: async (ctx, { id, body }) => {
    const userId = await requireUserId(ctx);
    const existing = await requireOwned(ctx, 'profilePosts', id, userId);
    const trimmed = capped(body, LIMITS.postBody);
    if (!trimmed && !existing.imageId) throw new ConvexError('A post needs some words or a photo');
    const next = { ...existing, body: trimmed ?? '', updatedAt: nowIso() };
    await ctx.db.patch(id, { body: next.body, updatedAt: next.updatedAt });
    return postView(ctx, next);
  },
});

export const removePost = mutation({
  args: { id: v.id('profilePosts') },
  handler: async (ctx, { id }) => {
    const userId = await requireUserId(ctx);
    const doc = await ctx.db.get(id);
    if (doc && doc.userId === userId) {
      if (doc.imageId) await ctx.storage.delete(doc.imageId);
      await ctx.db.delete(id);
    }
    return null;
  },
});

async function followRow(
  ctx: QueryCtx | MutationCtx,
  followerId: Id<'users'>,
  followeeId: Id<'users'>,
) {
  return ctx.db
    .query('profileFollows')
    .withIndex('by_user_followee', (q) => q.eq('userId', followerId).eq('followeeId', followeeId))
    .first();
}

/**
 * Follow or unfollow a profile by handle — the friend request Macronaut is
 * built on. The follow row is owned by the caller (`userId` is them), so this
 * is not a write to someone else's data, it is a write about them.
 *
 * A private page is still a person you can befriend: naming their exact
 * handle is the request, and what comes back is only the identity the request
 * was made against. Their page contents stay private until they make the page
 * public, exactly as before. Your own page refuses.
 */
export const setFollow = mutation({
  args: { handle: v.string(), follow: v.boolean() },
  handler: async (ctx, { handle, follow }) => {
    const userId = await requireUserId(ctx);
    const wanted = normalizeHandle(handle);
    const row = wanted
      ? await ctx.db
          .query('profiles')
          .withIndex('by_handle', (q) => q.eq('handleLower', wanted))
          .first()
      : null;
    if (!row || row.userId === userId) {
      throw new ConvexError('Profile not available');
    }

    const existing = await followRow(ctx, userId, row.userId);
    if (follow && !existing) {
      const incoming = await followRow(ctx, row.userId, userId);
      await ctx.db.insert('profileFollows', {
        userId,
        followeeId: row.userId,
        createdAt: nowIso(),
      });
      if (incoming) {
        // Following someone who already follows you accepts their request.
        // Clear that request instead of sending a misleading request back.
        await removeFriendRequestNotification(ctx, userId, row.userId);
      } else {
        await addFriendRequestNotification(ctx, row.userId, userId);
      }
    } else if (!follow && existing) {
      await ctx.db.delete(existing._id);
      await removeFriendRequestNotification(ctx, row.userId, userId);
    }

    const view = await profileView(ctx, row, { isOwner: false, viewerId: userId });
    // Following a private page does not open it. The follower gets the counts
    // their own action changed and the identity card, never the contents.
    return row.isPublic
      ? view
      : {
          ...view,
          bio: undefined,
          location: undefined,
          primarySport: undefined,
          bannerUrl: undefined,
        };
  },
});
