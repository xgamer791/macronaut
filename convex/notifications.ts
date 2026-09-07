import { v } from 'convex/values';
import type { Doc, Id } from './_generated/dataModel';
import { mutation, query, type MutationCtx, type QueryCtx } from './_generated/server';
import { nowIso, requireUserId } from './lib/auth';

const NOTIFICATION_LIMIT = 100;

function weekdayOf(date: string): number {
  return new Date(`${date}T12:00:00.000Z`).getUTCDay();
}

function goalDateLabel(date: string): string {
  const [year, month, day] = date.split('-').map(Number);
  if (!year || !month || !day) return date;
  return new Date(Date.UTC(year, month - 1, day)).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  });
}

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
      event.kind === 'calorie_goal'
        ? 'Calorie goal complete'
        : event.kind === 'friend_request'
          ? 'New friend request'
          : event.kind === 'friend_accepted'
            ? 'Friend request accepted'
            : `Message from ${displayName}`,
    body:
      event.kind === 'calorie_goal'
        ? `You closed your calorie ring${event.goalDate ? ` for ${goalDateLabel(event.goalDate)}` : ''}. Another awesome day!`
        : event.kind === 'friend_request'
          ? `${displayName} wants to connect with you.`
          : event.kind === 'friend_accepted'
            ? `${displayName} accepted your friend request. You can message each other now.`
            : (event.body ?? 'Sent you a message.'),
    chatId: event.chatId ? (event.chatId as string) : undefined,
    goalDate: event.goalDate,
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

/** Add the durable dashboard notification the first time a day's food total
 * closes its calorie ring. The unique index read makes concurrent food logs
 * settle on one event after Convex retries the transaction. */
export async function maybeAddCalorieGoalNotification(
  ctx: MutationCtx,
  userId: Id<'users'>,
  date: string,
) {
  const configs = await ctx.db
    .query('goalConfigs')
    .withIndex('by_user_effective', (q) => q.eq('userId', userId))
    .collect();
  if (configs.length === 0) return;

  let config = configs[0];
  for (const candidate of configs) {
    if (candidate.effectiveFrom <= date) config = candidate;
    else break;
  }

  const weekday = weekdayOf(date);
  let target = config.baseTarget;
  if (config.mode === 'per-weekday') {
    target = config.perWeekday?.[weekday] ?? config.baseTarget;
  } else if (config.mode === 'training-rest') {
    const mark = await ctx.db
      .query('dayTypeMarks')
      .withIndex('by_user_date', (q) => q.eq('userId', userId).eq('date', date))
      .first();
    const training = mark
      ? mark.dayType === 'training'
      : (config.trainingDays ?? []).includes(weekday);
    target = (training ? config.training : config.rest) ?? config.baseTarget;
  }
  if (target.calories <= 0) return;

  const entries = await ctx.db
    .query('diaryEntries')
    .withIndex('by_user_date', (q) => q.eq('userId', userId).eq('date', date))
    .collect();
  const consumed = entries.reduce((sum, entry) => sum + entry.nutrition.calories, 0);
  if (consumed < target.calories) return;

  const existing = await ctx.db
    .query('notifications')
    .withIndex('by_recipient_kind_date', (q) =>
      q.eq('recipientId', userId).eq('kind', 'calorie_goal').eq('goalDate', date),
    )
    .first();
  if (existing) return;

  await ctx.db.insert('notifications', {
    recipientId: userId,
    actorId: userId,
    kind: 'calorie_goal',
    goalDate: date,
    createdAt: nowIso(),
  });
}

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
