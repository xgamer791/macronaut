import { ConvexError, v } from 'convex/values';
import type { Doc, Id } from './_generated/dataModel';
import { mutation, query, type MutationCtx, type QueryCtx } from './_generated/server';
import { nowIso, requireUserId } from './lib/auth';
import { normalizeHandle } from './lib/handles';

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

async function avatarUrl(
  ctx: QueryCtx | MutationCtx,
  profile: Doc<'profiles'>,
): Promise<string | undefined> {
  if (!profile.avatarId) return undefined;
  return (await ctx.storage.getUrl(profile.avatarId)) ?? undefined;
}

async function personView(ctx: QueryCtx | MutationCtx, userId: Id<'users'>) {
  const profile = await ctx.db
    .query('profiles')
    .withIndex('by_user', (q) => q.eq('userId', userId))
    .first();
  if (!profile) return null;
  return {
    handle: profile.handle,
    displayName: profile.displayName?.trim() || `@${profile.handle}`,
    avatarUrl: await avatarUrl(ctx, profile),
  };
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
  const peer = await personView(ctx, peerId(chat, userId));
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

/** Contacts are followers, people the viewer follows, and existing chat peers.
 * Typing searches every public Macronaut profile instead. */
export const people = query({
  args: { search: v.optional(v.string()) },
  handler: async (ctx, { search }) => {
    const userId = await requireUserId(ctx);
    const wanted = search?.trim().toLowerCase() ?? '';
    let profiles: Doc<'profiles'>[];

    if (wanted) {
      profiles = (await ctx.db.query('profiles').collect()).filter(
        (profile) =>
          profile.userId !== userId &&
          profile.isPublic &&
          (profile.handleLower.includes(wanted) ||
            (profile.displayName ?? '').toLowerCase().includes(wanted)),
      );
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
      const rows = await Promise.all(
        [...ids].map((id) =>
          ctx.db
            .query('profiles')
            .withIndex('by_user', (q) => q.eq('userId', id))
            .first(),
        ),
      );
      profiles = rows.filter(
        (profile): profile is Doc<'profiles'> => profile !== null && profile.isPublic,
      );
    }

    profiles.sort((a, b) => (a.displayName ?? a.handle).localeCompare(b.displayName ?? b.handle));
    return Promise.all(
      profiles.slice(0, PEOPLE_LIMIT).map(async (profile) => ({
        handle: profile.handle,
        displayName: profile.displayName?.trim() || `@${profile.handle}`,
        avatarUrl: await avatarUrl(ctx, profile),
      })),
    );
  },
});

export const open = mutation({
  args: { handle: v.string() },
  handler: async (ctx, { handle }) => {
    const userId = await requireUserId(ctx);
    const wanted = normalizeHandle(handle);
    const profile = wanted
      ? await ctx.db
          .query('profiles')
          .withIndex('by_handle', (q) => q.eq('handleLower', wanted))
          .first()
      : null;
    if (!profile || !profile.isPublic || profile.userId === userId) {
      throw new ConvexError('Person not available');
    }
    const key = pairKey(userId, profile.userId);
    const existing = await ctx.db
      .query('directChats')
      .withIndex('by_pair', (q) => q.eq('pairKey', key))
      .first();
    if (existing) return (await summary(ctx, existing, userId))!;

    const ts = nowIso();
    const [userOneId, userTwoId] =
      (userId as string) < (profile.userId as string)
        ? [userId, profile.userId]
        : [profile.userId, userId];
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
    const peer = await personView(ctx, peerId(chat, userId));
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
    return null;
  },
});
