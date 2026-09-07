import { ConvexError, v } from 'convex/values';
import type { Doc, Id } from './_generated/dataModel';
import { mutation, query, type MutationCtx, type QueryCtx } from './_generated/server';
import { nowIso, requireUserId } from './lib/auth';
import { normalizeHandle } from './lib/handles';
import { addChatNotification, markChatNotificationsRead } from './notifications';

const MESSAGE_LIMIT = 200;
const CHAT_LIMIT = 100;
const PEOPLE_LIMIT = 40;
const MAX_MESSAGE_LENGTH = 2000;

const mediaKind = v.union(v.literal('image'), v.literal('video'));

/** What a chat row shows for a message that is only an attachment. */
function mediaPreview(kind: 'image' | 'video'): string {
  return kind === 'video' ? 'Video' : 'Photo';
}

/** The client shape of one message. `media.url` is a signed storage URL, so
 * it is resolved per read rather than stored. */
async function messageView(
  ctx: QueryCtx | MutationCtx,
  message: Doc<'chatMessages'>,
  viewerId: Id<'users'>,
) {
  const url = message.mediaId ? await ctx.storage.getUrl(message.mediaId) : null;
  return {
    id: message._id as string,
    body: message.body,
    createdAt: message.createdAt,
    isMine: message.senderId === viewerId,
    media:
      url && message.mediaKind
        ? {
            url,
            kind: message.mediaKind,
            width: message.mediaWidth,
            height: message.mediaHeight,
          }
        : undefined,
  };
}

function pairKey(a: Id<'users'>, b: Id<'users'>): string {
  return [a as string, b as string].sort().join(':');
}

function isParticipant(chat: Doc<'directChats'>, userId: Id<'users'>): boolean {
  return chat.userOneId === userId || chat.userTwoId === userId;
}

function peerId(chat: Doc<'directChats'>, userId: Id<'users'>): Id<'users'> {
  return chat.userOneId === userId ? chat.userTwoId : chat.userOneId;
}

function readAt(chat: Doc<'directChats'>, userId: Id<'users'>): string | undefined {
  return chat.userOneId === userId ? chat.userOneReadAt : chat.userTwoReadAt;
}

type FriendshipState = 'none' | 'outgoing' | 'incoming' | 'friends';

/**
 * A friend is a mutual follow. That gives both people an explicit action in
 * the existing social graph before either one can message the other.
 *
 * Exported because a profile's follower and following lists label every row
 * with the same standing, and there must be one answer to what a friend is.
 * A caller with no session — someone reading a public page signed out — has
 * no standing with anybody, so it is `none` rather than an error.
 */
export async function friendshipState(
  ctx: QueryCtx | MutationCtx,
  viewerId: Id<'users'> | null,
  otherId: Id<'users'>,
): Promise<FriendshipState> {
  if (!viewerId || viewerId === otherId) return 'none';
  const [outgoing, incoming] = await Promise.all([
    ctx.db
      .query('profileFollows')
      .withIndex('by_user_followee', (q) => q.eq('userId', viewerId).eq('followeeId', otherId))
      .first(),
    ctx.db
      .query('profileFollows')
      .withIndex('by_user_followee', (q) => q.eq('userId', otherId).eq('followeeId', viewerId))
      .first(),
  ]);
  if (outgoing && incoming) return 'friends';
  if (outgoing) return 'outgoing';
  if (incoming) return 'incoming';
  return 'none';
}

export async function profileFor(ctx: QueryCtx | MutationCtx, userId: Id<'users'>) {
  return ctx.db
    .query('profiles')
    .withIndex('by_user', (q) => q.eq('userId', userId))
    .first();
}

/**
 * Who somebody is, read from the account itself.
 *
 * The `users` table is the list of accounts; a `profiles` row is an extra the
 * account acquires the first time its owner edits their page. So the account
 * is the source of truth for whether a person exists and what they are
 * called, and the profile only adds the handle, a chosen display name and a
 * picture when there is one. Nobody is invisible for never having edited a
 * profile.
 */
export async function identity(
  ctx: QueryCtx | MutationCtx,
  viewerId: Id<'users'> | null,
  user: Doc<'users'>,
  profile: Doc<'profiles'> | null,
) {
  const handle = profile?.handle ?? null;
  const displayName =
    profile?.displayName?.trim() ||
    user.name?.trim() ||
    (handle ? `@${handle}` : 'Macronaut member');
  const avatarUrl =
    (profile?.avatarId ? await ctx.storage.getUrl(profile.avatarId) : null) ??
    user.image?.trim() ??
    undefined;
  return {
    id: user._id as string,
    handle,
    displayName,
    avatarUrl: avatarUrl || undefined,
    friendship: await friendshipState(ctx, viewerId, user._id),
  };
}

/** The account behind a profile handle. A profile page knows the handle and
 * never the account id, so that is how it names who to open a chat with. */
async function userForHandle(ctx: QueryCtx | MutationCtx, handle: string | undefined) {
  const wanted = normalizeHandle(handle ?? '');
  if (!wanted) return null;
  const profile = await ctx.db
    .query('profiles')
    .withIndex('by_handle', (q) => q.eq('handleLower', wanted))
    .first();
  return profile ? ctx.db.get(profile.userId) : null;
}

async function personView(ctx: QueryCtx | MutationCtx, viewerId: Id<'users'>, userId: Id<'users'>) {
  const user = await ctx.db.get(userId);
  if (!user) return null;
  return identity(ctx, viewerId, user, await profileFor(ctx, userId));
}

/**
 * Whether a search term reaches an account: any part of the name it signed
 * up with, or of the handle or display name on its profile when it has one.
 * Never the email — that is a way to confirm addresses, not to find friends.
 *
 * Shared with the profile connections lists, so searching a follower list
 * matches a person on exactly the words people search for anywhere else.
 */
export function matchesSearch(
  user: Doc<'users'>,
  profile: Doc<'profiles'> | null,
  wanted: string,
): boolean {
  return (
    (user.name ?? '').toLowerCase().includes(wanted) ||
    (profile?.handleLower.includes(wanted) ?? false) ||
    (profile?.displayName ?? '').toLowerCase().includes(wanted)
  );
}

/** Two accounts with the same address are the same person: a second sign-up
 * with another provider, or a re-registration. You never search for yourself. */
function samePerson(a: Doc<'users'>, b: Doc<'users'>): boolean {
  if (a._id === b._id) return true;
  const email = (a.email ?? '').trim().toLowerCase();
  return email !== '' && email === (b.email ?? '').trim().toLowerCase();
}

async function unreadCount(
  ctx: QueryCtx | MutationCtx,
  chat: Doc<'directChats'>,
  userId: Id<'users'>,
): Promise<number> {
  const seen = readAt(chat, userId);
  const messages = await ctx.db
    .query('chatMessages')
    .withIndex('by_chat_created', (q) =>
      seen ? q.eq('chatId', chat._id).gt('createdAt', seen) : q.eq('chatId', chat._id),
    )
    .collect();
  return messages.filter((message) => message.senderId !== userId).length;
}

async function summary(ctx: QueryCtx | MutationCtx, chat: Doc<'directChats'>, userId: Id<'users'>) {
  const peer = await personView(ctx, userId, peerId(chat, userId));
  if (!peer) return null;
  const last = await ctx.db
    .query('chatMessages')
    .withIndex('by_chat_created', (q) => q.eq('chatId', chat._id))
    .order('desc')
    .first();
  return {
    id: chat._id as string,
    peer,
    lastMessage: last ? await messageView(ctx, last, userId) : null,
    unreadCount: await unreadCount(ctx, chat, userId),
    createdAt: chat.createdAt,
    updatedAt: chat.updatedAt,
  };
}

async function chatsForUser(ctx: QueryCtx | MutationCtx, userId: Id<'users'>) {
  const [asOne, asTwo] = await Promise.all([
    ctx.db
      .query('directChats')
      .withIndex('by_user_one_updated', (q) => q.eq('userOneId', userId))
      .collect(),
    ctx.db
      .query('directChats')
      .withIndex('by_user_two_updated', (q) => q.eq('userTwoId', userId))
      .collect(),
  ]);
  return [...asOne, ...asTwo].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export const list = query({
  args: {},
  handler: async (ctx) => {
    const userId = await requireUserId(ctx);
    const chats = (await chatsForUser(ctx, userId)).slice(0, CHAT_LIMIT);
    const rows = await Promise.all(chats.map((chat) => summary(ctx, chat, userId)));
    return rows.filter((row): row is NonNullable<typeof row> => row !== null);
  },
});

/**
 * Contacts are friend requests, friends, and existing chat peers. Typing
 * searches the accounts in the Macronaut database instead — every one of
 * them, whether or not it has a profile row, and whether or not that profile
 * page is public. `isPublic` governs who may read a page; it has no say in
 * who may be found, because you have to be able to find someone by name to
 * send them a friend request at all. What comes back is only the identity
 * card: name, handle when there is one, picture, and where you stand with
 * them. Messaging still waits on a mutual friendship.
 */
export const people = query({
  args: { search: v.optional(v.string()) },
  handler: async (ctx, { search }) => {
    const userId = await requireUserId(ctx);
    const viewer = await ctx.db.get(userId);
    if (!viewer) throw new ConvexError('Not signed in');
    // People type the @ shown beside a handle. It is decoration, never part
    // of the stored handle, so strip it before matching.
    const wanted = (search?.trim().toLowerCase() ?? '').replace(/^@+/, '');

    let users: Doc<'users'>[];
    if (wanted) {
      users = (await ctx.db.query('users').collect()).filter((user) => !samePerson(viewer, user));
    } else {
      const [following, followers, chats] = await Promise.all([
        ctx.db
          .query('profileFollows')
          .withIndex('by_user', (q) => q.eq('userId', userId))
          .collect(),
        ctx.db
          .query('profileFollows')
          .withIndex('by_followee', (q) => q.eq('followeeId', userId))
          .collect(),
        chatsForUser(ctx, userId),
      ]);
      const ids = new Set<Id<'users'>>([
        ...following.map((row) => row.followeeId),
        ...followers.map((row) => row.userId),
        ...chats.map((chat) => peerId(chat, userId)),
      ]);
      const rows = await Promise.all([...ids].map((id) => ctx.db.get(id)));
      users = rows.filter((user): user is Doc<'users'> => user !== null);
    }

    const people = [];
    for (const user of users) {
      const profile = await profileFor(ctx, user._id);
      if (wanted && !matchesSearch(user, profile, wanted)) continue;
      people.push(await identity(ctx, userId, user, profile));
    }
    people.sort((a, b) => a.displayName.localeCompare(b.displayName));
    return people.slice(0, PEOPLE_LIMIT);
  },
});

/**
 * The conversation with an account, created on first open.
 *
 * The target is named by its id from a people search, or by the handle on a
 * profile page — the same pair `profiles.setFollow` accepts, so a page that
 * can befriend somebody can message them without ever handling account ids.
 * Friends only, and that is decided here rather than in the client.
 */
export const open = mutation({
  args: {
    userId: v.optional(v.id('users')),
    handle: v.optional(v.string()),
  },
  handler: async (ctx, { userId: otherId, handle }) => {
    const userId = await requireUserId(ctx);
    const other = otherId ? await ctx.db.get(otherId) : await userForHandle(ctx, handle);
    if (!other || other._id === userId) {
      throw new ConvexError('Person not available');
    }
    if ((await friendshipState(ctx, userId, other._id)) !== 'friends') {
      throw new ConvexError('You must be friends before starting a chat');
    }
    const key = pairKey(userId, other._id);
    const existing = await ctx.db
      .query('directChats')
      .withIndex('by_pair', (q) => q.eq('pairKey', key))
      .first();
    if (existing) return (await summary(ctx, existing, userId))!;

    const ts = nowIso();
    const [userOneId, userTwoId] =
      (userId as string) < (other._id as string) ? [userId, other._id] : [other._id, userId];
    const doc = {
      userOneId,
      userTwoId,
      pairKey: key,
      userOneReadAt: userOneId === userId ? ts : undefined,
      userTwoReadAt: userTwoId === userId ? ts : undefined,
      createdAt: ts,
      updatedAt: ts,
    };
    const id = await ctx.db.insert('directChats', doc);
    return (await summary(ctx, { _id: id, _creationTime: Date.now(), ...doc }, userId))!;
  },
});

export const thread = query({
  args: { id: v.id('directChats') },
  handler: async (ctx, { id }) => {
    const userId = await requireUserId(ctx);
    const chat = await ctx.db.get(id);
    if (!chat || !isParticipant(chat, userId)) return null;
    const peer = await personView(ctx, userId, peerId(chat, userId));
    if (!peer) return null;
    const newest = await ctx.db
      .query('chatMessages')
      .withIndex('by_chat_created', (q) => q.eq('chatId', id))
      .order('desc')
      .take(MESSAGE_LIMIT);
    const messages = await Promise.all(
      newest.reverse().map((message) => messageView(ctx, message, userId)),
    );
    // The thread draws the viewer's own picture beside their messages, so it
    // ships their identity rather than making the screen fetch it again.
    const me = await personView(ctx, userId, userId);
    return {
      id: chat._id as string,
      peer,
      me,
      messages,
      unreadCount: await unreadCount(ctx, chat, userId),
      createdAt: chat.createdAt,
      updatedAt: chat.updatedAt,
    };
  },
});

/** Where a picked photo or clip is PUT before `send` references it. */
export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    await requireUserId(ctx);
    return ctx.storage.generateUploadUrl();
  },
});

export const send = mutation({
  args: {
    id: v.id('directChats'),
    body: v.string(),
    mediaId: v.optional(v.id('_storage')),
    mediaKind: v.optional(mediaKind),
    mediaWidth: v.optional(v.number()),
    mediaHeight: v.optional(v.number()),
  },
  handler: async (ctx, { id, body, mediaId, mediaKind: kind, mediaWidth, mediaHeight }) => {
    const userId = await requireUserId(ctx);
    const chat = await ctx.db.get(id);
    if (!chat || !isParticipant(chat, userId)) throw new ConvexError('Chat not available');
    if ((await friendshipState(ctx, userId, peerId(chat, userId))) !== 'friends') {
      throw new ConvexError('You must be friends before sending a message');
    }
    // An attachment carries the message on its own, so text is only required
    // when there is nothing else to send.
    const attached = mediaId && kind ? { mediaId, kind } : null;
    const trimmed = body.trim().slice(0, MAX_MESSAGE_LENGTH);
    if (!trimmed && !attached) throw new ConvexError('Write a message first');
    const ts = nowIso();
    const doc = {
      chatId: id,
      senderId: userId,
      body: trimmed,
      createdAt: ts,
      ...(attached
        ? {
            mediaId: attached.mediaId,
            mediaKind: attached.kind,
            mediaWidth: positive(mediaWidth),
            mediaHeight: positive(mediaHeight),
          }
        : {}),
    };
    const messageId = await ctx.db.insert('chatMessages', doc);
    await ctx.db.patch(id, {
      updatedAt: ts,
      ...(chat.userOneId === userId ? { userOneReadAt: ts } : { userTwoReadAt: ts }),
    });
    await addChatNotification(
      ctx,
      peerId(chat, userId),
      userId,
      id,
      trimmed || mediaPreview(attached!.kind),
      ts,
    );
    return messageView(ctx, { _id: messageId, _creationTime: Date.now(), ...doc }, userId);
  },
});

/** A pixel dimension worth storing, or nothing. */
function positive(value: number | undefined): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) && value > 0
    ? Math.round(value)
    : undefined;
}

export const markRead = mutation({
  args: { id: v.id('directChats') },
  handler: async (ctx, { id }) => {
    const userId = await requireUserId(ctx);
    const chat = await ctx.db.get(id);
    if (!chat || !isParticipant(chat, userId)) return null;
    const ts = nowIso();
    await ctx.db.patch(
      id,
      chat.userOneId === userId ? { userOneReadAt: ts } : { userTwoReadAt: ts },
    );
    await markChatNotificationsRead(ctx, userId, id, ts);
    return null;
  },
});
