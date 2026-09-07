import { v } from 'convex/values';
import type { Doc, Id } from './_generated/dataModel';
import { mutation, query, type MutationCtx, type QueryCtx } from './_generated/server';
import { nowIso, requireUserId } from './lib/auth';

const NOTIFICATION_LIMIT = 100;

/** Where the viewer stands with the actor, so a request carries its own
 * Accept and never has to be answered from somewhere else. */
async function friendshipWith(
  ctx: QueryCtx,
  viewerId: Id<'users'>,
  otherId: Id<'users'>,
): Promise<'none' | 'outgoing' | 'incoming' | 'friends'> {
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

/** The person behind an event, read from their account: an actor who has
 * never edited their profile still has a name, and their request still
 * shows. The profile only adds the handle and a chosen picture. */
async function notificationView(ctx: QueryCtx, viewerId: Id<'users'>, event: Doc<'notifications'>) {
  const actor = await ctx.db.get(event.actorId);
  if (!actor) return null;
  const profile = await ctx.db
    .query('profiles')
    .withIndex('by_user', (q) => q.eq('userId', event.actorId))
    .first();
  const handle = profile?.handle ?? null;
  const displayName =
    profile?.displayName?.trim() || actor.name?.trim() || (handle ? `@${handle}` : 'Someone');
  const avatarUrl =
    (profile?.avatarId ? await ctx.storage.getUrl(profile.avatarId) : null) ??
    actor.image?.trim() ??
    undefined;
  return {
    id: event._id as string,
    kind: event.kind,
    actor: {
      id: actor._id as string,
      handle,
      displayName,
      avatarUrl: avatarUrl || undefined,
      friendship: await friendshipWith(ctx, viewerId, actor._id),
    },
    title:
      event.kind === 'friend_request'
        ? 'New friend request'
        : event.kind === 'friend_accepted'
          ? 'Friend request accepted'
          : `Message from ${displayName}`,
    body:
      event.kind === 'friend_request'
        ? `${displayName} wants to connect with you.`
        : event.kind === 'friend_accepted'
          ? `${displayName} accepted your friend request. You can message each other now.`
          : (event.body ?? 'Sent you a message.'),
    chatId: event.chatId ? (event.chatId as string) : undefined,
    read: event.readAt !== undefined,
    createdAt: event.createdAt,
  };
}

/** Latest bell events plus a durable unread count for the header badge. */
export const list = query({
  args: {},
  handler: async (ctx) => {
    const userId = await requireUserId(ctx);
    const events = await ctx.db
      .query('notifications')
      .withIndex('by_recipient_created', (q) => q.eq('recipientId', userId))
      .order('desc')
      .collect();
    const rows = await Promise.all(
      events.slice(0, NOTIFICATION_LIMIT).map((event) => notificationView(ctx, userId, event)),
    );
    return {
      items: rows.filter((row): row is NonNullable<typeof row> => row !== null),
      unreadCount: events.filter((event) => event.readAt === undefined).length,
    };
  },
});

export const markRead = mutation({
  args: { id: v.id('notifications') },
  handler: async (ctx, { id }) => {
    const userId = await requireUserId(ctx);
    const event = await ctx.db.get(id);
    if (!event || event.recipientId !== userId || event.readAt) return null;
    await ctx.db.patch(id, { readAt: nowIso() });
    return null;
  },
});

export const markAllRead = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await requireUserId(ctx);
    const events = await ctx.db
      .query('notifications')
      .withIndex('by_recipient_created', (q) => q.eq('recipientId', userId))
      .collect();
    const ts = nowIso();
    await Promise.all(
      events
        .filter((event) => !event.readAt)
        .map((event) => ctx.db.patch(event._id, { readAt: ts })),
    );
    return null;
  },
});

export async function addFriendRequestNotification(
  ctx: MutationCtx,
  recipientId: Id<'users'>,
  actorId: Id<'users'>,
) {
  const existing = await ctx.db
    .query('notifications')
    .withIndex('by_recipient_kind_actor', (q) =>
      q.eq('recipientId', recipientId).eq('kind', 'friend_request').eq('actorId', actorId),
    )
    .collect();
  for (const event of existing) await ctx.db.delete(event._id);
  await ctx.db.insert('notifications', {
    recipientId,
    actorId,
    kind: 'friend_request',
    createdAt: nowIso(),
  });
}

export async function removeFriendRequestNotification(
  ctx: MutationCtx,
  recipientId: Id<'users'>,
  actorId: Id<'users'>,
) {
  const events = await ctx.db
    .query('notifications')
    .withIndex('by_recipient_kind_actor', (q) =>
      q.eq('recipientId', recipientId).eq('kind', 'friend_request').eq('actorId', actorId),
    )
    .collect();
  for (const event of events) await ctx.db.delete(event._id);
}

/** Close the loop: whoever asked first is told their request went through,
 * because otherwise the friendship becomes real and only one of the two
 * people ever finds out. */
export async function addFriendAcceptedNotification(
  ctx: MutationCtx,
  recipientId: Id<'users'>,
  actorId: Id<'users'>,
) {
  const existing = await ctx.db
    .query('notifications')
    .withIndex('by_recipient_kind_actor', (q) =>
      q.eq('recipientId', recipientId).eq('kind', 'friend_accepted').eq('actorId', actorId),
    )
    .collect();
  for (const event of existing) await ctx.db.delete(event._id);
  await ctx.db.insert('notifications', {
    recipientId,
    actorId,
    kind: 'friend_accepted',
    createdAt: nowIso(),
  });
}

export async function addChatNotification(
  ctx: MutationCtx,
  recipientId: Id<'users'>,
  actorId: Id<'users'>,
  chatId: Id<'directChats'>,
  body: string,
  createdAt: string,
) {
  await ctx.db.insert('notifications', {
    recipientId,
    actorId,
    kind: 'chat_message',
    chatId,
    body,
    createdAt,
  });
}

/** Opening a conversation clears its bell events as well as its chat unread count. */
export async function markChatNotificationsRead(
  ctx: MutationCtx,
  recipientId: Id<'users'>,
  chatId: Id<'directChats'>,
  readAt: string,
) {
  const events = await ctx.db
    .query('notifications')
    .withIndex('by_recipient_chat', (q) => q.eq('recipientId', recipientId).eq('chatId', chatId))
    .collect();
  await Promise.all(
    events.filter((event) => !event.readAt).map((event) => ctx.db.patch(event._id, { readAt })),
  );
}
