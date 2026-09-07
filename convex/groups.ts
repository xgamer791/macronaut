import { ConvexError, v } from 'convex/values';
import type { Doc, Id } from './_generated/dataModel';
import { mutation, query, type MutationCtx, type QueryCtx } from './_generated/server';
import { identity, profileFor } from './chats';
import { nowIso, requireUserId } from './lib/auth';
import { firstFreeHandle, handleSeed } from './lib/handles';
import { deleteVotesAgainst, restrictionFor, unseat } from './lib/gymMembership';
import {
  GYM_VOTE_RULES,
  distinctActiveVoters,
  isRestricted,
  isVoteActive,
  outcomeFor,
  untilIso,
} from './lib/gymVotes';
import { readableProfile } from './lib/profileAccess';

const LIMITS = { name: 60, sport: 40, location: 60, description: 280 } as const;
/** Rows a member list returns. Every seat is still counted. */
const MEMBERS_LIMIT = 100;

function capped(value: string | undefined, max: number): string | undefined {
  const trimmed = (value ?? '').trim();
  return trimmed ? trimmed.slice(0, max) : undefined;
}

export async function memberCount(ctx: QueryCtx | MutationCtx, groupId: Id<'fitnessGroups'>) {
  return (
    await ctx.db
      .query('groupMembers')
      .withIndex('by_group', (q) => q.eq('groupId', groupId))
      .collect()
  ).length;
}

export async function membership(
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

/** The wire shape of a group. A gym group (`kind: 'gym'`) has no owner, so
 * `isOwner` is false for everyone in it — including whoever's claim created
 * the row, which is never exposed. */
export async function groupView(
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
    location: doc.location,
    description: doc.description,
    isPublic: doc.isPublic,
    kind: doc.kind,
    gymId: doc.gymId as string | undefined,
    memberCount: await memberCount(ctx, doc._id),
    isOwner: doc.kind !== 'gym' && mine?.role === 'owner',
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

function normalized(value?: string) {
  return (value ?? '')
    .toLocaleLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function placeParts(value?: string) {
  return (value ?? '')
    .toLocaleLowerCase()
    .split(',')
    .map((part) => part.replace(/[^a-z0-9]+/g, ' ').trim())
    .filter(Boolean);
}

/** Lower is closer. A city match beats a wider region match; groups without
 * a place remain discoverable but never pretend to be local. */
function proximity(groupLocation?: string, viewerLocation?: string) {
  const group = placeParts(groupLocation);
  const viewer = placeParts(viewerLocation);
  if (!group.length || !viewer.length) return 2;
  if (normalized(groupLocation) === normalized(viewerLocation) || group[0] === viewer[0]) return 0;
  if (group.some((part) => viewer.includes(part))) return 1;
  return 2;
}

/** Public groups the viewer has not joined. The order is intentionally useful:
 * same-city groups first, then broader location matches, then matching sports,
 * active communities and recent arrivals. Gym groups are left out — they are
 * reached by setting a home gym, and there is one per gym in the world. */
export const discover = query({
  args: {},
  handler: async (ctx) => {
    const userId = await requireUserId(ctx);
    const [profile, user, seats, allGroups] = await Promise.all([
      ctx.db
        .query('profiles')
        .withIndex('by_user', (q) => q.eq('userId', userId))
        .first(),
      ctx.db.get(userId),
      ctx.db
        .query('groupMembers')
        .withIndex('by_user', (q) => q.eq('userId', userId))
        .collect(),
      ctx.db.query('fitnessGroups').collect(),
    ]);
    const memberOf = new Set(seats.map((seat) => seat.groupId as string));
    const viewerLocation = profile?.location || user?.country;
    const viewerSport = profile?.primarySport;
    const visible = allGroups.filter(
      (group) => group.isPublic && group.kind !== 'gym' && !memberOf.has(group._id as string),
    );
    const groups = await Promise.all(visible.map((group) => groupView(ctx, group, userId)));
    groups.sort((a, b) => {
      const proximityDelta =
        proximity(a.location, viewerLocation) - proximity(b.location, viewerLocation);
      if (proximityDelta) return proximityDelta;
      const sport = normalized(viewerSport);
      const aSport = sport && normalized(a.sport) === sport ? 1 : 0;
      const bSport = sport && normalized(b.sport) === sport ? 1 : 0;
      if (aSport !== bSport) return bSport - aSport;
      if (a.memberCount !== b.memberCount) return b.memberCount - a.memberCount;
      return b.createdAt.localeCompare(a.createdAt);
    });
    return { groups: groups.slice(0, 60), viewerLocation, viewerSport };
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
    location: v.optional(v.string()),
    description: v.optional(v.string()),
    isPublic: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const name = capped(args.name, LIMITS.name);
    if (!name) throw new ConvexError('A group needs a name');
    const handle = await firstFreeHandle(handleSeed(name), (candidate) =>
      handleTaken(ctx, candidate),
    );
    const ts = nowIso();
    const doc = {
      userId,
      name,
      handle,
      handleLower: handle,
      sport: capped(args.sport, LIMITS.sport),
      location: capped(args.location, LIMITS.location),
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

export const update = mutation({
  args: {
    id: v.id('fitnessGroups'),
    name: v.string(),
    sport: v.optional(v.string()),
    location: v.optional(v.string()),
    description: v.optional(v.string()),
    isPublic: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const group = await ctx.db.get(args.id);
    if (group?.kind === 'gym') {
      throw new ConvexError('Gym groups have no owner and cannot be edited');
    }
    if (!group || group.userId !== userId)
      throw new ConvexError('Only the owner can edit this group');
    const name = capped(args.name, LIMITS.name);
    if (!name) throw new ConvexError('A group needs a name');
    await ctx.db.patch(args.id, {
      name,
      sport: capped(args.sport, LIMITS.sport),
      location: capped(args.location, LIMITS.location),
      description: capped(args.description, LIMITS.description),
      isPublic: args.isPublic ?? group.isPublic,
      updatedAt: nowIso(),
    });
    const updated = await ctx.db.get(args.id);
    if (!updated) throw new ConvexError('Group not available');
    return groupView(ctx, updated, userId);
  },
});

export const join = mutation({
  args: { id: v.id('fitnessGroups') },
  handler: async (ctx, { id }) => {
    const userId = await requireUserId(ctx);
    const group = await ctx.db.get(id);
    if (!group || !group.isPublic) throw new ConvexError('Group not available');
    if (group.kind === 'gym') {
      throw new ConvexError('Set this gym as your home gym to join its group');
    }
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
    const group = await ctx.db.get(id);
    if (group?.kind === 'gym') {
      await unseat(ctx, userId, id);
      return null;
    }
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
    if (group?.kind === 'gym') throw new ConvexError('Gym groups cannot be deleted');
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

/**
 * Who is in a group, for its members. Only people whose profile is public are
 * listed; everyone is counted. In a gym group a suspended member stays listed
 * (marked) so the remaining votes can still reach the ban tier. Nothing here
 * says who voted, who joined first, or who created the row.
 */
export const members = query({
  args: { id: v.id('fitnessGroups') },
  handler: async (ctx, { id }) => {
    const userId = await requireUserId(ctx);
    const group = await ctx.db.get(id);
    if (!group || !(await membership(ctx, userId, id))) {
      throw new ConvexError('Group not available');
    }
    const now = Date.now();
    const isGym = group.kind === 'gym';
    const seats = await ctx.db
      .query('groupMembers')
      .withIndex('by_group', (q) => q.eq('groupId', id))
      .collect();
    const seated = new Set(seats.map((seat) => seat.userId as string));
    const suspended = isGym
      ? (
          await ctx.db
            .query('groupBans')
            .withIndex('by_group', (q) => q.eq('groupId', id))
            .collect()
        ).filter(
          (row) =>
            row.kind === 'suspension' && isRestricted(row, now) && !seated.has(row.userId as string),
        )
      : [];
    const votes = isGym
      ? await ctx.db
          .query('groupVotes')
          .withIndex('by_group_target', (q) => q.eq('groupId', id))
          .collect()
      : [];
    const votesFor = new Map<string, Doc<'groupVotes'>[]>();
    for (const vote of votes) {
      const key = vote.targetUserId as string;
      votesFor.set(key, [...(votesFor.get(key) ?? []), vote]);
    }

    const candidates = [
      ...seats.map((seat) => ({ userId: seat.userId, status: 'member' as const })),
      ...suspended.map((row) => ({ userId: row.userId, status: 'suspended' as const })),
    ];
    const rows = [];
    for (const candidate of candidates) {
      const isYou = candidate.userId === userId;
      const [user, profile] = await Promise.all([
        ctx.db.get(candidate.userId),
        profileFor(ctx, candidate.userId),
      ]);
      if (!user || !profile || !(profile.isPublic || isYou)) continue;
      const against = votesFor.get(candidate.userId as string) ?? [];
      const others = candidate.status === 'member' ? seats.length - 1 : seats.length;
      rows.push({
        ...(await identity(ctx, userId, user, profile)),
        primarySport: profile.primarySport,
        isYou,
        status: candidate.status,
        votes: distinctActiveVoters(against, now),
        myVote: against.some((vote) => vote.voterUserId === userId && isVoteActive(vote, now)),
        canVote: isGym && !isYou && others >= GYM_VOTE_RULES.MIN_OTHER_MEMBERS,
      });
    }
    rows.sort((a, b) => {
      if (a.isYou !== b.isYou) return a.isYou ? -1 : 1;
      return a.displayName.localeCompare(b.displayName);
    });
    return { total: seats.length, listed: rows.length, members: rows.slice(0, MEMBERS_LIMIT) };
  },
});

async function voteTarget(
  ctx: MutationCtx,
  userId: Id<'users'>,
  id: Id<'fitnessGroups'>,
  targetUserId: Id<'users'>,
) {
  const group = await ctx.db.get(id);
  if (!group || group.kind !== 'gym') throw new ConvexError('Only gym groups vote on members');
  if (!(await membership(ctx, userId, id))) throw new ConvexError('Group not available');
  if (targetUserId === userId) throw new ConvexError('You cannot vote against yourself');
  const now = Date.now();
  const seats = await ctx.db
    .query('groupMembers')
    .withIndex('by_group', (q) => q.eq('groupId', id))
    .collect();
  const targetSeat = seats.find((seat) => seat.userId === targetUserId) ?? null;
  const restriction = await restrictionFor(ctx, targetUserId, id);
  const currentlySuspended =
    restriction !== null && restriction.kind === 'suspension' && isRestricted(restriction, now);
  if (!targetSeat && !currentlySuspended) throw new ConvexError('That person is not in this group');
  return { group, now, seats, targetSeat, restriction, currentlySuspended };
}

async function activeVotesAgainst(
  ctx: MutationCtx,
  id: Id<'fitnessGroups'>,
  targetUserId: Id<'users'>,
  now: number,
) {
  const all = await ctx.db
    .query('groupVotes')
    .withIndex('by_group_target', (q) => q.eq('groupId', id).eq('targetUserId', targetUserId))
    .collect();
  // Votes expire lazily, on the next write against the same person.
  const active: Doc<'groupVotes'>[] = [];
  for (const vote of all) {
    if (isVoteActive(vote, now)) active.push(vote);
    else await ctx.db.delete(vote._id);
  }
  return active;
}

/**
 * Vote to remove a member of a gym group. One vote per member per target;
 * three within a week suspend, five ban (see lib/gymVotes.ts). Votes are
 * anonymous — the response carries a count and the caller's own state, never
 * who else voted.
 */
export const voteRemove = mutation({
  args: { id: v.id('fitnessGroups'), targetUserId: v.id('users') },
  handler: async (ctx, { id, targetUserId }) => {
    const userId = await requireUserId(ctx);
    const { group, now, seats, targetSeat, restriction, currentlySuspended } = await voteTarget(
      ctx,
      userId,
      id,
      targetUserId,
    );
    const others = seats.filter((seat) => seat.userId !== targetUserId).length;
    if (others < GYM_VOTE_RULES.MIN_OTHER_MEMBERS) {
      throw new ConvexError(
        `A gym group needs at least ${GYM_VOTE_RULES.MIN_OTHER_MEMBERS} other members before it can vote`,
      );
    }
    const active = await activeVotesAgainst(ctx, id, targetUserId, now);
    if (!active.some((vote) => vote.voterUserId === userId)) {
      const createdAt = nowIso();
      const voteId = await ctx.db.insert('groupVotes', {
        groupId: id,
        targetUserId,
        voterUserId: userId,
        createdAt,
      });
      active.push({
        _id: voteId,
        _creationTime: now,
        groupId: id,
        targetUserId,
        voterUserId: userId,
        createdAt,
      });
    }
    const distinct = distinctActiveVoters(active, now);
    const outcome = outcomeFor(distinct, currentlySuspended);

    if (outcome === 'suspend' || outcome === 'ban') {
      if (targetSeat) await ctx.db.delete(targetSeat._id);
      if (restriction) await ctx.db.delete(restriction._id);
      await ctx.db.insert('groupBans', {
        groupId: id,
        userId: targetUserId,
        kind: outcome === 'ban' ? 'ban' : 'suspension',
        until: untilIso(
          now,
          outcome === 'ban' ? GYM_VOTE_RULES.BAN_DAYS : GYM_VOTE_RULES.SUSPENSION_DAYS,
        ),
        createdAt: nowIso(),
      });
    }
    if (outcome === 'ban') {
      const profile = await profileFor(ctx, targetUserId);
      if (profile?.homeGymId && profile.homeGymId === group.gymId) {
        await ctx.db.patch(profile._id, { homeGymId: undefined, updatedAt: nowIso() });
      }
      await deleteVotesAgainst(ctx, targetUserId, id);
      return { votes: 0, status: 'banned' as const, myVote: false };
    }
    return {
      votes: distinct,
      status: outcome === 'suspend' || currentlySuspended ? ('suspended' as const) : ('member' as const),
      myVote: true,
    };
  },
});

/** Take a vote back. Lowers the count toward the ban tier; a suspension
 * already written runs to its date. */
export const retractVote = mutation({
  args: { id: v.id('fitnessGroups'), targetUserId: v.id('users') },
  handler: async (ctx, { id, targetUserId }) => {
    const userId = await requireUserId(ctx);
    const { now, currentlySuspended } = await voteTarget(ctx, userId, id, targetUserId);
    const active = await activeVotesAgainst(ctx, id, targetUserId, now);
    for (const vote of active) if (vote.voterUserId === userId) await ctx.db.delete(vote._id);
    const remaining = active.filter((vote) => vote.voterUserId !== userId);
    return {
      votes: distinctActiveVoters(remaining, now),
      status: currentlySuspended ? ('suspended' as const) : ('member' as const),
      myVote: false,
    };
  },
});
