import { ConvexError, v } from 'convex/values';
import type { Doc, Id } from './_generated/dataModel';
import { mutation, query, type MutationCtx, type QueryCtx } from './_generated/server';
import {
  CHAT_LIMIT,
  MAX_MESSAGE_LENGTH,
  MESSAGE_LIMIT,
  identity,
  mediaPreview,
  messageView,
  personView,
  positive,
  profileFor,
} from './chats';
import { groupView, membership } from './groups';
import { nowIso, requireUserId } from './lib/auth';
import { attachmentFields } from './lib/validators';
import { markGroupNotificationsRead, upsertGroupMessageNotification } from './notifications';

/**
 * A fitness group's one chat. The group is the thread — messages hang off
 * the group, read state lives on each member's seat, and nothing here has
 * an owner: whoever holds a seat may read and write, and a message is the
 * sender's to delete (plus the owner's, in a group that has one).
 *
 * Messages and sends are gated on the seat, never on the group being
 * public: a public group's chat is still for its members. A non-member of
 * a public group gets the group itself and no messages, so the screen can
 * offer to join; a private group looks exactly like a missing one.
 */

/** Past this many seats a send skips the bell rows and relies on unread counts. */
export const NOTIFY_MEMBER_CAP = 500;
/** Sends per account per minute — one send fans out to every member. */
export const SENDS_PER_MINUTE = 30;

type Identity = Awaited<ReturnType<typeof identity>>;

async function requireSeat(ctx: QueryCtx | MutationCtx, userId: Id<'users'>, id: Id<'fitnessGroups'>) {
  const group = await ctx.db.get(id);
  const seat = group ? await membership(ctx, userId, id) : null;
  if (!group || !seat) throw new ConvexError('Group not available');
  return { group, seat };
}

function canDelete(group: Doc<'fitnessGroups'>, message: Doc<'groupMessages'>, userId: Id<'users'>) {
  if (message.senderId === userId) return true;
  return group.kind !== 'gym' && group.userId === userId;
}

/** Each distinct sender's identity once, however many messages they wrote. */
async function identitiesFor(
  ctx: QueryCtx | MutationCtx,
  viewerId: Id<'users'>,
  senderIds: Iterable<Id<'users'>>,
) {
  const out = new Map<string, Identity>();
  for (const senderId of new Set(senderIds)) {
    const user = await ctx.db.get(senderId);
    if (!user) continue;
    out.set(senderId as string, await identity(ctx, viewerId, user, await profileFor(ctx, senderId)));
  }
  return out;
}

/** A name for a sender who has since deleted their account. */
const GONE: Identity = {
  id: '',
  handle: null,
  displayName: 'Former member',
  avatarUrl: undefined,
  friendship: 'none',
};

/** Messages since the seat last read — or since the seat existed, so joining
 * a busy group does not open on two hundred unread. Bounded by the window
 * the thread shows. */
async function unreadFor(
  ctx: QueryCtx | MutationCtx,
  groupId: Id<'fitnessGroups'>,
  userId: Id<'users'>,
  seat: Doc<'groupMembers'>,
): Promise<number> {
  const seen = seat.lastReadAt ?? seat.createdAt;
  const newer = await ctx.db
    .query('groupMessages')
    .withIndex('by_group_created', (q) => q.eq('groupId', groupId).gt('createdAt', seen))
    .take(MESSAGE_LIMIT);
  return newer.filter((message) => message.senderId !== userId).length;
}

async function newestMessage(ctx: QueryCtx | MutationCtx, groupId: Id<'fitnessGroups'>) {
  return ctx.db
    .query('groupMessages')
    .withIndex('by_group_created', (q) => q.eq('groupId', groupId))
    .order('desc')
    .first();
}

/** One more send against this minute's cap for the caller. */
async function recordSend(ctx: MutationCtx, userId: Id<'users'>) {
  const minute = new Date().toISOString().slice(0, 16);
  const row = await ctx.db
    .query('groupSendUsage')
    .withIndex('by_user_minute', (q) => q.eq('userId', userId).eq('minute', minute))
    .first();
  const count = (row?.count ?? 0) + 1;
  if (count > SENDS_PER_MINUTE) throw new ConvexError('Slow down — try again in a minute');
  if (row) await ctx.db.patch(row._id, { count });
  else await ctx.db.insert('groupSendUsage', { userId, minute, count });
}

/** The thread for a member. A non-member of a public group gets the group
 * and an empty thread (the screen offers to join); a private group, like a
 * missing one, is null. */
export const thread = query({
  args: { id: v.id('fitnessGroups') },
  handler: async (ctx, { id }) => {
    const userId = await requireUserId(ctx);
    const group = await ctx.db.get(id);
    const seat = group ? await membership(ctx, userId, id) : null;
    if (!group || (!seat && !group.isPublic)) return null;
    if (!seat) {
      return {
        group: await groupView(ctx, group, userId),
        me: await personView(ctx, userId, userId),
        messages: [],
        unreadCount: 0,
        lastMessageAt: null,
      };
    }
    const newest = await ctx.db
      .query('groupMessages')
      .withIndex('by_group_created', (q) => q.eq('groupId', id))
      .order('desc')
      .take(MESSAGE_LIMIT);
    const rows = newest.reverse();
    const senders = await identitiesFor(
      ctx,
      userId,
      rows.map((message) => message.senderId),
    );
    const messages = await Promise.all(
      rows.map(async (message) => ({
        ...(await messageView(ctx, message, userId)),
        sender: senders.get(message.senderId as string) ?? GONE,
        canDelete: canDelete(group, message, userId),
      })),
    );
    return {
      group: await groupView(ctx, group, userId),
      me: await personView(ctx, userId, userId),
      messages,
      unreadCount: await unreadFor(ctx, id, userId, seat),
      lastMessageAt: group.lastMessageAt ?? null,
    };
  },
});

/** Every group chat the caller is in that has had a message, newest first. */
export const list = query({
  args: {},
  handler: async (ctx) => {
    const userId = await requireUserId(ctx);
    const seats = await ctx.db
      .query('groupMembers')
      .withIndex('by_user', (q) => q.eq('userId', userId))
      .collect();
    const rows = [];
    for (const seat of seats) {
      const group = await ctx.db.get(seat.groupId);
      if (!group?.lastMessageAt) continue;
      const last = await newestMessage(ctx, group._id);
      if (!last) continue;
      const sender = await ctx.db.get(last.senderId);
      const senderName = sender
        ? (await identity(ctx, userId, sender, await profileFor(ctx, last.senderId))).displayName
        : GONE.displayName;
      rows.push({
        group: await groupView(ctx, group, userId),
        lastMessage: {
          id: last._id as string,
          body: last.body,
          createdAt: last.createdAt,
          isMine: last.senderId === userId,
          senderName,
          mediaKind: last.mediaKind,
        },
        unreadCount: await unreadFor(ctx, group._id, userId, seat),
        lastMessageAt: group.lastMessageAt,
      });
    }
    rows.sort((a, b) => b.lastMessageAt.localeCompare(a.lastMessageAt));
    return rows.slice(0, CHAT_LIMIT);
  },
});

export const send = mutation({
  args: {
    id: v.id('fitnessGroups'),
    body: v.string(),
    ...attachmentFields,
  },
  handler: async (ctx, { id, body, mediaId, mediaKind: kind, mediaWidth, mediaHeight }) => {
    const userId = await requireUserId(ctx);
    const { seat } = await requireSeat(ctx, userId, id);
    await recordSend(ctx, userId);

    // An attachment carries the message on its own, so text is only required
    // when there is nothing else to send.
    const attached = mediaId && kind ? { mediaId, kind } : null;
    const trimmed = body.trim().slice(0, MAX_MESSAGE_LENGTH);
    if (!trimmed && !attached) throw new ConvexError('Write a message first');

    const ts = nowIso();
    const doc = {
      groupId: id,
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
    const messageId = await ctx.db.insert('groupMessages', doc);
    await ctx.db.patch(id, { lastMessageAt: ts });
    await ctx.db.patch(seat._id, { lastReadAt: ts });

    const seats = await ctx.db
      .query('groupMembers')
      .withIndex('by_group', (q) => q.eq('groupId', id))
      .collect();
    if (seats.length <= NOTIFY_MEMBER_CAP) {
      const preview = trimmed || mediaPreview(attached!.kind);
      for (const other of seats) {
        if (other.userId === userId) continue;
        await upsertGroupMessageNotification(ctx, other.userId, userId, id, preview, ts);
      }
    }

    const me = await personView(ctx, userId, userId);
    return {
      ...(await messageView(ctx, { _id: messageId, ...doc }, userId)),
      sender: me ?? GONE,
      canDelete: true,
    };
  },
});

export const markRead = mutation({
  args: { id: v.id('fitnessGroups') },
  handler: async (ctx, { id }) => {
    const userId = await requireUserId(ctx);
    const group = await ctx.db.get(id);
    const seat = group ? await membership(ctx, userId, id) : null;
    if (!group || !seat) return null;
    const ts = nowIso();
    await ctx.db.patch(seat._id, { lastReadAt: ts });
    await markGroupNotificationsRead(ctx, userId, id, ts);
    return null;
  },
});

/** Delete a message: the sender's own, or any message for the owner of a
 * group that has one. A gym group has no owner. */
export const remove = mutation({
  args: { messageId: v.id('groupMessages') },
  handler: async (ctx, { messageId }) => {
    const userId = await requireUserId(ctx);
    const message = await ctx.db.get(messageId);
    if (!message) return null;
    const { group } = await requireSeat(ctx, userId, message.groupId);
    if (!canDelete(group, message, userId)) {
      throw new ConvexError('Only the sender can delete this message');
    }
    if (message.mediaId) await ctx.storage.delete(message.mediaId);
    await ctx.db.delete(messageId);
    if (group.lastMessageAt === message.createdAt) {
      const newest = await newestMessage(ctx, group._id);
      await ctx.db.patch(group._id, { lastMessageAt: newest?.createdAt });
    }
    return null;
  },
});
