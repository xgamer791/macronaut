import { ConvexError, v } from 'convex/values';
import type { Doc, Id } from './_generated/dataModel';
import { mutation, query, type MutationCtx, type QueryCtx } from './_generated/server';
import { nowIso, requireUserId } from './lib/auth';
import { firstFreeHandle, handleSeed } from './lib/handles';
import { readableProfile } from './lib/profileAccess';

const LIMITS = { name: 60, sport: 40, description: 280 } as const;

function capped(value: string | undefined, max: number): string | undefined {
  const trimmed = (value ?? '').trim();
  return trimmed ? trimmed.slice(0, max) : undefined;
}

async function memberCount(ctx: QueryCtx | MutationCtx, groupId: Id<'fitnessGroups'>) {
  return (
    await ctx.db
      .query('groupMembers')
      .withIndex('by_group', (q) => q.eq('groupId', groupId))
      .collect()
  ).length;
}

async function membership(
  ctx: QueryCtx | MutationCtx,
  userId: Id<'users'> | null,
  groupId: Id<'fitnessGroups'>,
) {
  if (!userId) return null;
  return ctx.db
    .query('groupMembers')
    .withIndex('by_user_group', (q) => q.eq('userId', userId).eq('groupId', groupId))
    .first();
}

async function groupView(
  ctx: QueryCtx | MutationCtx,
  doc: Doc<'fitnessGroups'>,
  viewerId: Id<'users'> | null,
) {
  const mine = await membership(ctx, viewerId, doc._id);
  return {
    id: doc._id as string,
    name: doc.name,
    handle: doc.handle,
    sport: doc.sport,
    description: doc.description,
    isPublic: doc.isPublic,
    memberCount: await memberCount(ctx, doc._id),
    isOwner: mine?.role === 'owner',
    isMember: mine !== null,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}

async function handleTaken(
  ctx: QueryCtx | MutationCtx,
  candidate: string,
  exceptId?: Id<'fitnessGroups'>,
) {
  const existing = await ctx.db
    .query('fitnessGroups')
    .withIndex('by_handle', (q) => q.eq('handleLower', candidate))
    .first();
  return existing !== null && existing._id !== exceptId;
}

async function groupsForMember(ctx: QueryCtx | MutationCtx, userId: Id<'users'>) {
  const seats = await ctx.db
    .query('groupMembers')
    .withIndex('by_user', (q) => q.eq('userId', userId))
    .collect();
  const groups: Doc<'fitnessGroups'>[] = [];
  for (const seat of seats) {
    const group = await ctx.db.get(seat.groupId);
    if (group) groups.push(group);
  }
  groups.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return groups;
}

export const mine = query({
  args: {},
  handler: async (ctx) => {
    const userId = await requireUserId(ctx);
    const groups = await groupsForMember(ctx, userId);
    return Promise.all(groups.map((group) => groupView(ctx, group, userId)));
  },
});

/** Groups on someone's profile. A stranger only sees public groups; the
 * owner sees every group they belong to. Private profiles return null. */
export const forHandle = query({
  args: { handle: v.string() },
  handler: async (ctx, { handle }) => {
    const found = await readableProfile(ctx, handle);
    if (!found) return null;
    const groups = await groupsForMember(ctx, found.row.userId);
    const visible = found.isOwner ? groups : groups.filter((group) => group.isPublic);
    return {
      isOwner: found.isOwner,
      groups: await Promise.all(visible.map((group) => groupView(ctx, group, found.viewerId))),
    };
  },
});

export const create = mutation({
  args: {
    name: v.string(),
    sport: v.optional(v.string()),
    description: v.optional(v.string()),
    isPublic: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const name = capped(args.name, LIMITS.name);
    if (!name) throw new ConvexError('A group needs a name');
    const handle = await firstFreeHandle(handleSeed(name), (candidate) => handleTaken(ctx, candidate));
    const ts = nowIso();
    const doc = {
      userId,
      name,
      handle,
      handleLower: handle,
      sport: capped(args.sport, LIMITS.sport),
      description: capped(args.description, LIMITS.description),
      isPublic: args.isPublic ?? true,
      createdAt: ts,
      updatedAt: ts,
    };
    const id = await ctx.db.insert('fitnessGroups', doc);
    await ctx.db.insert('groupMembers', { userId, groupId: id, role: 'owner', createdAt: ts });
    return groupView(ctx, { _id: id, _creationTime: Date.now(), ...doc }, userId);
  },
});

export const join = mutation({
  args: { id: v.id('fitnessGroups') },
  handler: async (ctx, { id }) => {
    const userId = await requireUserId(ctx);
    const group = await ctx.db.get(id);
    if (!group || !group.isPublic) throw new ConvexError('Group not available');
    const existing = await membership(ctx, userId, id);
    if (!existing) {
      await ctx.db.insert('groupMembers', {
        userId,
        groupId: id,
        role: 'member',
        createdAt: nowIso(),
      });
    }
    return groupView(ctx, group, userId);
  },
});

export const leave = mutation({
  args: { id: v.id('fitnessGroups') },
  handler: async (ctx, { id }) => {
    const userId = await requireUserId(ctx);
    const mine = await membership(ctx, userId, id);
    if (!mine) return null;
    if (mine.role === 'owner') {
      throw new ConvexError('The owner cannot leave — delete the group instead.');
    }
    await ctx.db.delete(mine._id);
    return null;
  },
});

export const remove = mutation({
  args: { id: v.id('fitnessGroups') },
  handler: async (ctx, { id }) => {
    const userId = await requireUserId(ctx);
    const group = await ctx.db.get(id);
    if (!group || group.userId !== userId) return null;
    const seats = await ctx.db
      .query('groupMembers')
      .withIndex('by_group', (q) => q.eq('groupId', id))
      .collect();
    for (const seat of seats) await ctx.db.delete(seat._id);
    await ctx.db.delete(id);
    return null;
  },
});
