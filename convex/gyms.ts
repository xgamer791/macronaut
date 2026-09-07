import { ConvexError, v } from 'convex/values';
import type { Doc } from './_generated/dataModel';
import { internalMutation, mutation, query, type QueryCtx, type MutationCtx } from './_generated/server';
import { groupView } from './groups';
import { nowIso, requireUserId } from './lib/auth';
import {
  activeRestriction,
  ensureGymGroup,
  groupForGym,
  gymSummary,
  refuseIfRestricted,
  seat,
  unseat,
} from './lib/gymMembership';
import { loadOrCreate, rowForUser } from './profiles';

/** A home gym and the one group everybody there shares.
 *
 * `gyms` is the catalogue convex/places.ts writes from Google results; a
 * profile's `homeGymId` points at one row. The gym's group is created by the
 * first claim and joined by every later one — nobody owns it, and whoever
 * happened to claim first holds the same seat as anyone else. */

async function countMembersOf(ctx: QueryCtx | MutationCtx, gym: Doc<'gyms'>) {
  const group = await groupForGym(ctx, gym._id);
  if (!group) return 0;
  return (
    await ctx.db
      .query('groupMembers')
      .withIndex('by_group', (q) => q.eq('groupId', group._id))
      .collect()
  ).length;
}

async function myGym(ctx: QueryCtx | MutationCtx, userId: Doc<'users'>['_id']) {
  const row = await rowForUser(ctx, userId);
  if (!row?.homeGymId) return null;
  const gym = await ctx.db.get(row.homeGymId);
  if (!gym) return null;
  const group = await groupForGym(ctx, gym._id);
  const restriction = group ? await activeRestriction(ctx, userId, group._id) : null;
  return {
    gym: gymSummary(gym),
    group: group ? await groupView(ctx, group, userId) : null,
    restriction: restriction ? { kind: restriction.kind, until: restriction.until } : null,
  };
}

/** Search results become rows here, keyed by the provider's place id, so two
 * people who picked the same result share one gym. Returns the ids in the
 * order given, with how many people already call each one home. */
export const upsertMany = internalMutation({
  args: {
    gyms: v.array(
      v.object({
        provider: v.literal('google'),
        placeId: v.string(),
        name: v.string(),
        address: v.string(),
        lat: v.number(),
        lng: v.number(),
      }),
    ),
  },
  handler: async (ctx, { gyms }) => {
    await requireUserId(ctx);
    const out: { id: string; memberCount: number }[] = [];
    for (const input of gyms) {
      const existing = await ctx.db
        .query('gyms')
        .withIndex('by_place', (q) => q.eq('provider', input.provider).eq('placeId', input.placeId))
        .first();
      const ts = nowIso();
      let gym: Doc<'gyms'>;
      if (existing) {
        const changed =
          existing.name !== input.name ||
          existing.address !== input.address ||
          existing.lat !== input.lat ||
          existing.lng !== input.lng;
        if (changed) await ctx.db.patch(existing._id, { ...input, updatedAt: ts });
        gym = { ...existing, ...input };
      } else {
        const id = await ctx.db.insert('gyms', { ...input, createdAt: ts, updatedAt: ts });
        gym = { _id: id, _creationTime: Date.now(), ...input, createdAt: ts, updatedAt: ts };
      }
      out.push({ id: gym._id as string, memberCount: await countMembersOf(ctx, gym) });
    }
    return out;
  },
});

/** The caller's home gym, its group, and any suspension or ban in force. */
export const mine = query({
  args: {},
  handler: async (ctx) => {
    const userId = await requireUserId(ctx);
    return myGym(ctx, userId);
  },
});

/** Make a gym home. Leaves the previous gym's group, and joins this one when
 * asked — creating the group if this is the first claim. A member the group
 * suspended or banned is refused with the date they may return. */
export const claim = mutation({
  args: { gymId: v.id('gyms'), joinGroup: v.boolean() },
  handler: async (ctx, { gymId, joinGroup }) => {
    const userId = await requireUserId(ctx);
    const gym = await ctx.db.get(gymId);
    if (!gym) throw new ConvexError('Gym not available');
    const profile = await loadOrCreate(ctx, userId);
    const existingGroup = await groupForGym(ctx, gymId);
    if (joinGroup && existingGroup) await refuseIfRestricted(ctx, userId, existingGroup._id);

    if (profile.homeGymId && profile.homeGymId !== gymId) {
      const old = await groupForGym(ctx, profile.homeGymId);
      if (old) await unseat(ctx, userId, old._id);
    }
    await ctx.db.patch(profile._id, { homeGymId: gymId, updatedAt: nowIso() });

    if (joinGroup) {
      const group = existingGroup ?? (await ensureGymGroup(ctx, gym, userId));
      await seat(ctx, userId, group._id);
    }
    const result = await myGym(ctx, userId);
    if (!result) throw new ConvexError('Gym not available');
    return result;
  },
});

/** Join (or rejoin, once a suspension has lapsed) the home gym's group. */
export const joinGroup = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await requireUserId(ctx);
    const profile = await rowForUser(ctx, userId);
    if (!profile?.homeGymId) throw new ConvexError('Set a home gym first');
    const gym = await ctx.db.get(profile.homeGymId);
    if (!gym) throw new ConvexError('Gym not available');
    const group = (await groupForGym(ctx, gym._id)) ?? (await ensureGymGroup(ctx, gym, userId));
    await refuseIfRestricted(ctx, userId, group._id);
    await seat(ctx, userId, group._id);
    return groupView(ctx, group, userId);
  },
});

/** Forget the home gym and leave its group. */
export const clear = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await requireUserId(ctx);
    const profile = await rowForUser(ctx, userId);
    if (!profile?.homeGymId) return null;
    const group = await groupForGym(ctx, profile.homeGymId);
    if (group) await unseat(ctx, userId, group._id);
    await ctx.db.patch(profile._id, { homeGymId: undefined, updatedAt: nowIso() });
    return null;
  },
});
