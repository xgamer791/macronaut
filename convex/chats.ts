import { ConvexError, v } from 'convex/values';
import type { Doc, Id } from './_generated/dataModel';
import { mutation, query, type MutationCtx, type QueryCtx } from './_generated/server';
import { nowIso, requireUserId } from './lib/auth';
import { addChatNotification, markChatNotificationsRead } from './notifications';

const MESSAGE_LIMIT = 200;
const CHAT_LIMIT = 100;
const PEOPLE_LIMIT = 40;
const MAX_MESSAGE_LENGTH = 2000;

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

/** A friend is a mutual follow. That gives both people an explicit action in
 * the existing social graph before either one can message the other. */
async function friendshipState(
  ctx: QueryCtx | MutationCtx,
  viewerId: Id<'users'>,
  otherId: Id<'users'>,
): Promise<FriendshipState> {
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

async function profileFor(ctx: QueryCtx | MutationCtx, userId: Id<'users'>) {
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
async function identity(
  ctx: QueryCtx | MutationCtx,
  viewerId: Id<'users'>,
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

async function personView(ctx: QueryCtx | MutationCtx, viewerId: Id<'users'>, userId: Id<'users'>) {
  const user = await ctx.db.get(userId);
  if (!user) return null;
  return identity(ctx, viewerId, user, await profileFor(ctx, userId));
}

/**
 * Whether a search term reaches an account: any part of the name it signed
 * up with, or of the handle or display name on its profile when it has one.
 * Never the email — that is a way to confirm addresses, not to find friends.
 */
function matchesSearch(
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
    lastMessage: last
      ? {
          id: last._id as string,
          body: last.body,
          createdAt: last.createdAt,
          isMine: last.senderId === userId,
        }
      : null,
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

export const open = mutation({
  args: { userId: v.id('users') },
  handler: async (ctx, { userId: otherId }) => {
    const userId = await requireUserId(ctx);
    const other = await ctx.db.get(otherId);
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
    const messages = newest.reverse().map((message) => ({
      id: message._id as string,
      body: message.body,
      createdAt: message.createdAt,
      isMine: message.senderId === userId,
    }));
    return {
      id: chat._id as string,
      peer,
      messages,
      unreadCount: await unreadCount(ctx, chat, userId),
      createdAt: chat.createdAt,
      updatedAt: chat.updatedAt,
    };
  },
});

export const send = mutation({
  args: { id: v.id('directChats'), body: v.string() },
  handler: async (ctx, { id, body }) => {
    const userId = await requireUserId(ctx);
    const chat = await ctx.db.get(id);
    if (!chat || !isParticipant(chat, userId)) throw new ConvexError('Chat not available');
    if ((await friendshipState(ctx, userId, peerId(chat, userId))) !== 'friends') {
      throw new ConvexError('You must be friends before sending a message');
    }
    const trimmed = body.trim().slice(0, MAX_MESSAGE_LENGTH);
    if (!trimmed) throw new ConvexError('Write a message first');
    const ts = nowIso();
    const messageId = await ctx.db.insert('chatMessages', {
      chatId: id,
      senderId: userId,
      body: trimmed,
      createdAt: ts,
    });
    await ctx.db.patch(id, {
      updatedAt: ts,
      ...(chat.userOneId === userId ? { userOneReadAt: ts } : { userTwoReadAt: ts }),
    });
    await addChatNotification(ctx, peerId(chat, userId), userId, id, trimmed, ts);
    return { id: messageId as string, body: trimmed, createdAt: ts, isMine: true };
  },
});

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
