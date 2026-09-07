import { getAuthUserId } from '@convex-dev/auth/server';
import { ConvexError, v } from 'convex/values';
import type { Doc, Id } from './_generated/dataModel';
import { mutation, query, type MutationCtx, type QueryCtx } from './_generated/server';
import { friendshipState, identity, matchesSearch, profileFor } from './chats';
import { nowIso, requireOwned, requireUserId } from './lib/auth';
import { firstFreeHandle, handleSeed, isValidHandle, normalizeHandle } from './lib/handles';
import { homeGymFor } from './lib/gymMembership';
import { readableProfile } from './lib/profileAccess';
import { profileEditableFields } from './lib/validators';
import {
  addFriendAcceptedNotification,
  addFriendRequestNotification,
  removeFriendRequestNotification,
} from './notifications';

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
const POST_COMMENT_MAX = 280;
const POST_COMMENT_LIMIT = 80;
/** Every friends-feed request is capped here, not merely in the UI. */
export const FRIENDS_FEED_PAGE_SIZE = 10;
/** How many people one followers / following / friends list hands back. */
export const CONNECTIONS_LIMIT = 200;

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

/**
 * Followers of `subjectId` and who they follow.
 *
 * `isFollowing` is whether the viewer follows them and `isFollowedBy` whether
 * they follow the viewer back — both false for yourself or a signed-out
 * caller. Together they are the mutual follow that makes a friend, which is
 * what decides whether the page may offer to open a conversation. Both are
 * read off the two lists this already collected rather than costing another
 * index lookup.
 */
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
  const other = viewerId !== null && viewerId !== subjectId ? viewerId : null;
  return {
    followerCount: followers.length,
    followingCount: following.length,
    isFollowing: other !== null && followers.some((row) => row.userId === other),
    isFollowedBy: other !== null && following.some((row) => row.followeeId === other),
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
    homeGym: await homeGymFor(ctx, doc.homeGymId),
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

async function postEngagement(
  ctx: QueryCtx | MutationCtx,
  doc: Doc<'profilePosts'>,
  viewerId: Id<'users'> | null,
) {
  const mine = viewerId
    ? await ctx.db
        .query('profilePostLikes')
        .withIndex('by_user_post', (q) => q.eq('userId', viewerId).eq('postId', doc._id))
        .first()
    : null;
  return {
    likeCount: doc.likeCount ?? 0,
    likedByMe: mine !== null,
    commentCount: doc.commentCount ?? 0,
  };
}

async function postView(
  ctx: QueryCtx | MutationCtx,
  doc: Doc<'profilePosts'>,
  viewerId: Id<'users'> | null,
) {
  const engagement = await postEngagement(ctx, doc, viewerId);
  return {
    id: doc._id as string,
    body: doc.body,
    imageUrl: await storageUrl(ctx, doc.imageId),
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
    ...engagement,
  };
}

export async function rowForUser(ctx: QueryCtx | MutationCtx, userId: Id<'users'>) {
  return ctx.db
    .query('profiles')
    .withIndex('by_user', (q) => q.eq('userId', userId))
    .first();
}

async function postsForUser(
  ctx: QueryCtx | MutationCtx,
  userId: Id<'users'>,
  viewerId: Id<'users'> | null,
) {
  const rows = await ctx.db
    .query('profilePosts')
    .withIndex('by_user_created', (q) => q.eq('userId', userId))
    .order('desc')
    .take(POST_LIMIT);
  return Promise.all(rows.map((row) => postView(ctx, row, viewerId)));
}

async function visiblePost(
  ctx: QueryCtx | MutationCtx,
  id: Id<'profilePosts'>,
): Promise<{ doc: Doc<'profilePosts'>; viewerId: Id<'users'> | null } | null> {
  const doc = await ctx.db.get(id);
  if (!doc) return null;
  const viewerId = await getAuthUserId(ctx);
  if (viewerId === doc.userId) return { doc, viewerId };
  const profile = await rowForUser(ctx, doc.userId);
  if (profile?.isPublic) return { doc, viewerId };
  if ((await friendshipState(ctx, viewerId, doc.userId)) === 'friends') {
    return { doc, viewerId };
  }
  return null;
}

async function postCommentView(
  ctx: QueryCtx | MutationCtx,
  row: Doc<'profilePostComments'>,
  viewerId: Id<'users'> | null,
) {
  const [profile, user] = await Promise.all([rowForUser(ctx, row.userId), ctx.db.get(row.userId)]);
  return {
    id: row._id as string,
    body: row.body,
    createdAt: row.createdAt,
    authorName:
      profile?.displayName?.trim() ||
      user?.name?.trim() ||
      (profile?.handle ? `@${profile.handle}` : 'Macronaut member'),
    authorHandle: profile?.handle,
    isMine: viewerId === row.userId,
  };
}

async function postThreadView(
  ctx: QueryCtx | MutationCtx,
  doc: Doc<'profilePosts'>,
  viewerId: Id<'users'> | null,
) {
  const rows = await ctx.db
    .query('profilePostComments')
    .withIndex('by_post_created', (q) => q.eq('postId', doc._id))
    .order('asc')
    .take(POST_COMMENT_LIMIT);
  return {
    ...(await postEngagement(ctx, doc, viewerId)),
    comments: await Promise.all(rows.map((row) => postCommentView(ctx, row, viewerId))),
  };
}

async function deletePostGraph(ctx: MutationCtx, doc: Doc<'profilePosts'>) {
  const [likes, comments] = await Promise.all([
    ctx.db
      .query('profilePostLikes')
      .withIndex('by_post', (q) => q.eq('postId', doc._id))
      .collect(),
    ctx.db
      .query('profilePostComments')
      .withIndex('by_post_created', (q) => q.eq('postId', doc._id))
      .collect(),
  ]);
  for (const like of likes) await ctx.db.delete(like._id);
  for (const comment of comments) await ctx.db.delete(comment._id);
  if (doc.imageId) await ctx.storage.delete(doc.imageId);
  await ctx.db.delete(doc._id);
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
export async function loadOrCreate(
  ctx: MutationCtx,
  userId: Id<'users'>,
): Promise<Doc<'profiles'>> {
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

/**
 * Claim this account's profile row and handle if it has none yet.
 *
 * A row was only ever written the first time somebody edited their profile,
 * so an account that just signed up and started logging food did not exist in
 * the `profiles` table — which is the table people search. That made a real,
 * active account unfindable and therefore impossible to befriend. The app
 * calls this once per signed-in session, so opening Macronaut is enough.
 */
export const ensure = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await requireUserId(ctx);
    const row = await loadOrCreate(ctx, userId);
    return { handle: row.handle };
  },
});

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
      homeGym: undefined as { id: string; name: string; address: string } | undefined,
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
    return postsForUser(ctx, userId, userId);
  },
});

/**
 * Newest profile posts from mutual follows. One-way follows are still friend
 * requests, so they never leak into this feed. The cursor is Convex-owned and
 * each response is capped at ten posts regardless of the client.
 */
export const friendsFeed = query({
  args: { cursor: v.union(v.string(), v.null()) },
  handler: async (ctx, { cursor }) => {
    const viewerId = await requireUserId(ctx);
    const [outgoing, incoming] = await Promise.all([
      ctx.db
        .query('profileFollows')
        .withIndex('by_user', (q) => q.eq('userId', viewerId))
        .collect(),
      ctx.db
        .query('profileFollows')
        .withIndex('by_followee', (q) => q.eq('followeeId', viewerId))
        .collect(),
    ]);
    const incomingIds = new Set(incoming.map((row) => row.userId as string));
    const friendIds = outgoing
      .map((row) => row.followeeId)
      .filter((friendId) => incomingIds.has(friendId as string));

    if (friendIds.length === 0) {
      return { page: [], isDone: true, continueCursor: '' };
    }

    const result = await ctx.db
      .query('profilePosts')
      .withIndex('by_created')
      .order('desc')
      .filter((q) => q.or(...friendIds.map((friendId) => q.eq(q.field('userId'), friendId))))
      .paginate({ cursor, numItems: FRIENDS_FEED_PAGE_SIZE });

    const page = await Promise.all(
      result.page.map(async (post) => {
        const [profile, account] = await Promise.all([
          rowForUser(ctx, post.userId),
          ctx.db.get(post.userId),
        ]);
        // addPost always creates a profile first. Keep the fallback defensive
        // for legacy rows rather than dropping a post mid-page.
        const handle = profile?.handle ?? handleSeed(account?.name, account?.email);
        return {
          ...(await postView(ctx, post, viewerId)),
          author: {
            id: post.userId as string,
            handle,
            displayName: profile?.displayName ?? account?.name,
            avatarUrl: (await storageUrl(ctx, profile?.avatarId)) ?? account?.image ?? undefined,
            canOpenProfile: profile?.isPublic ?? false,
          },
        };
      }),
    );

    return { ...result, page };
  },
});

/**
 * A profile by handle, for anyone — including callers with no session.
 *
 * This public-page read resolves the handle, returns null unless the profile
 * is public or the caller owns it, and hands back `profileView` / `postView`
 * rather than rows. A private profile and a handle nobody has taken are the
 * same answer, so flipping the toggle off does not confirm the page exists.
 * Cross-account access for `friendsFeed` is separate and requires a mutual
 * follow before it returns a post.
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
    const posts = await postsForUser(ctx, row.userId, viewerId);
    const profile = await profileView(ctx, row, { isOwner, viewerId });
    return { profile, posts };
  },
});

const connectionTab = v.union(v.literal('followers'), v.literal('following'), v.literal('friends'));

/**
 * The people around one profile: who follows it, who it follows, and the
 * mutual follows that make a friend.
 *
 * Reachable for your own account with no handle, and for anybody else's page
 * on the same terms as the page itself — `readableProfile` answers null for a
 * private profile and for a handle nobody owns alike, so this cannot be used
 * to tell those apart either. Every row carries where the viewer stands with
 * that person, which is what lets the list offer the one action their
 * friendship permits, and `isYou` marks the viewer's own row so the list
 * never offers to befriend the person reading it.
 *
 * `search` is answered here rather than in the client because it has to look
 * at the whole list before the cap, not at the page that happened to arrive.
 * All three counts come back on every read, so the tabs can be labelled
 * without three round trips.
 */
export const connections = query({
  args: {
    /** Omitted for your own connections — the one case with no page to read. */
    handle: v.optional(v.string()),
    tab: connectionTab,
    search: v.optional(v.string()),
  },
  handler: async (ctx, { handle, tab, search }) => {
    const viewerId = await getAuthUserId(ctx);

    let subjectId: Id<'users'>;
    let subject: { handle: string; displayName: string };
    if (handle) {
      const readable = await readableProfile(ctx, handle);
      if (!readable) return null;
      subjectId = readable.row.userId;
      subject = {
        handle: readable.row.handle,
        displayName: readable.row.displayName?.trim() || `@${readable.row.handle}`,
      };
    } else {
      if (!viewerId) return null;
      subjectId = viewerId;
      const [row, account] = await Promise.all([rowForUser(ctx, viewerId), ctx.db.get(viewerId)]);
      const own = row?.handle ?? handleSeed(account?.name, account?.email);
      subject = {
        handle: own,
        displayName: row?.displayName?.trim() || account?.name?.trim() || `@${own}`,
      };
    }

    const [followerRows, followingRows] = await Promise.all([
      ctx.db
        .query('profileFollows')
        .withIndex('by_followee', (q) => q.eq('followeeId', subjectId))
        .collect(),
      ctx.db
        .query('profileFollows')
        .withIndex('by_user', (q) => q.eq('userId', subjectId))
        .collect(),
    ]);
    const followerIds = followerRows.map((row) => row.userId);
    const followingIds = followingRows.map((row) => row.followeeId);
    // A friend is a follow that goes both ways, the same rule chats enforce.
    const followsBack = new Set(followerIds.map((id) => id as string));
    const friendIds = followingIds.filter((id) => followsBack.has(id as string));

    const wantedIds =
      tab === 'followers' ? followerIds : tab === 'following' ? followingIds : friendIds;
    // People type the @ shown beside a handle; it is never part of the
    // stored handle, so strip it before matching.
    const wanted = (search?.trim().toLowerCase() ?? '').replace(/^@+/, '');

    const people = [];
    for (const id of wantedIds) {
      const user = await ctx.db.get(id);
      // An account deleted since the follow was written leaves a row behind.
      if (!user) continue;
      const profile = await profileFor(ctx, id);
      if (wanted && !matchesSearch(user, profile, wanted)) continue;
      people.push({
        ...(await identity(ctx, viewerId, user, profile)),
        isYou: viewerId !== null && user._id === viewerId,
      });
    }
    people.sort((a, b) => a.displayName.localeCompare(b.displayName));

    return {
      subject,
      counts: {
        followers: followerIds.length,
        following: followingIds.length,
        friends: friendIds.length,
      },
      people: people.slice(0, CONNECTIONS_LIMIT),
    };
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
    const doc = {
      userId,
      body: trimmed ?? '',
      imageId,
      likeCount: 0,
      commentCount: 0,
      createdAt: ts,
      updatedAt: ts,
    };
    const id = await ctx.db.insert('profilePosts', doc);
    return postView(ctx, { _id: id, _creationTime: Date.now(), ...doc }, userId);
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
    return postView(ctx, next, userId);
  },
});

export const postThread = query({
  args: { id: v.id('profilePosts') },
  handler: async (ctx, { id }) => {
    const found = await visiblePost(ctx, id);
    if (!found) return null;
    return postThreadView(ctx, found.doc, found.viewerId);
  },
});

export const setPostLike = mutation({
  args: { id: v.id('profilePosts'), liked: v.boolean() },
  handler: async (ctx, { id, liked }) => {
    const userId = await requireUserId(ctx);
    const found = await visiblePost(ctx, id);
    if (!found) throw new ConvexError('Post not available');
    const existing = await ctx.db
      .query('profilePostLikes')
      .withIndex('by_user_post', (q) => q.eq('userId', userId).eq('postId', id))
      .first();
    let likeCount = found.doc.likeCount ?? 0;
    if (liked && !existing) {
      await ctx.db.insert('profilePostLikes', { userId, postId: id, createdAt: nowIso() });
      likeCount += 1;
    }
    if (!liked && existing) {
      await ctx.db.delete(existing._id);
      likeCount = Math.max(0, likeCount - 1);
    }
    if (likeCount !== (found.doc.likeCount ?? 0)) await ctx.db.patch(id, { likeCount });
    return postView(ctx, { ...found.doc, likeCount }, userId);
  },
});

export const addPostComment = mutation({
  args: { id: v.id('profilePosts'), body: v.string() },
  handler: async (ctx, { id, body }) => {
    const userId = await requireUserId(ctx);
    const found = await visiblePost(ctx, id);
    if (!found) throw new ConvexError('Post not available');
    const text = body.trim().slice(0, POST_COMMENT_MAX);
    if (!text) throw new ConvexError('Write a comment first.');
    const createdAt = nowIso();
    const commentId = await ctx.db.insert('profilePostComments', {
      userId,
      postId: id,
      body: text,
      createdAt,
    });
    await ctx.db.patch(id, { commentCount: (found.doc.commentCount ?? 0) + 1 });
    return postCommentView(
      ctx,
      { _id: commentId, _creationTime: Date.now(), userId, postId: id, body: text, createdAt },
      userId,
    );
  },
});

export const removePostComment = mutation({
  args: { id: v.id('profilePostComments') },
  handler: async (ctx, { id }) => {
    const userId = await requireUserId(ctx);
    const comment = await ctx.db.get(id);
    if (!comment) return null;
    const post = await ctx.db.get(comment.postId);
    if (comment.userId === userId || post?.userId === userId) {
      await ctx.db.delete(id);
      if (post) {
        await ctx.db.patch(post._id, {
          commentCount: Math.max(0, (post.commentCount ?? 0) - 1),
        });
      }
    }
    return null;
  },
});

export const removePost = mutation({
  args: { id: v.id('profilePosts') },
  handler: async (ctx, { id }) => {
    const userId = await requireUserId(ctx);
    const doc = await ctx.db.get(id);
    if (doc && doc.userId === userId) {
      await deletePostGraph(ctx, doc);
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
 * Follow or unfollow a person — the friend request Macronaut is built on. The
 * follow row is owned by the caller (`userId` is them), so this is not a write
 * to someone else's data, it is a write about them.
 *
 * The target is an account, named by its id from a people search or by the
 * handle on its profile page. An account that has never edited its profile
 * has no row yet; it gets the same one it would claim for itself on launch,
 * so the request has a handle to point at. A private page is still a person
 * you can befriend, and what comes back is only the identity the request was
 * made against: the page contents stay private until its owner opens them.
 * Your own account refuses.
 */
export const setFollow = mutation({
  args: {
    handle: v.optional(v.string()),
    userId: v.optional(v.id('users')),
    follow: v.boolean(),
  },
  handler: async (ctx, { handle, userId: targetId, follow }) => {
    const userId = await requireUserId(ctx);
    let row: Doc<'profiles'> | null = null;
    if (targetId) {
      const target = await ctx.db.get(targetId);
      if (target) row = await loadOrCreate(ctx, target._id);
    } else if (handle) {
      const wanted = normalizeHandle(handle);
      row = wanted
        ? await ctx.db
            .query('profiles')
            .withIndex('by_handle', (q) => q.eq('handleLower', wanted))
            .first()
        : null;
    }
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
        // Clear that request instead of sending a misleading request back,
        // and tell them, or the friendship is only news to one of you.
        await removeFriendRequestNotification(ctx, userId, row.userId);
        await addFriendAcceptedNotification(ctx, row.userId, userId);
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
          homeGym: undefined,
          bannerUrl: undefined,
        };
  },
});
