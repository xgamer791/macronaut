import { ConvexError } from 'convex/values';
import type { Doc, Id } from '../_generated/dataModel';
import type { MutationCtx, QueryCtx } from '../_generated/server';
import { nowIso } from './auth';
import { HANDLE_MIN, firstFreeHandle, handleSeed, normalizeHandle } from './handles';
import { isRestricted, untilLabel } from './gymVotes';

/** The membership side of a home gym, shared by convex/gyms.ts and
 * convex/groups.ts so neither has to import the other. A gym's group is the
 * one `fitnessGroups` row with `kind: 'gym'` and its `gymId`; it has no
 * owner, so every seat here is a plain member. */

const GROUP_NAME_MAX = 60;
const GROUP_LOCATION_MAX = 60;

export function gymSummary(doc: Doc<'gyms'>) {
  return {
    id: doc._id as string,
    name: doc.name,
    address: doc.address,
    lat: doc.lat,
    lng: doc.lng,
  };
}

/** What a profile carries about its home gym. */
export async function homeGymFor(ctx: QueryCtx | MutationCtx, id: Id<'gyms'> | undefined) {
  if (!id) return undefined;
  const gym = await ctx.db.get(id);
  return gym ? { id: gym._id as string, name: gym.name, address: gym.address } : undefined;
}

export async function groupForGym(ctx: QueryCtx | MutationCtx, gymId: Id<'gyms'>) {
  return ctx.db
    .query('fitnessGroups')
    .withIndex('by_gym', (q) => q.eq('gymId', gymId))
    .first();
}

export async function seatFor(
  ctx: QueryCtx | MutationCtx,
  userId: Id<'users'>,
  groupId: Id<'fitnessGroups'>,
) {
  return ctx.db
    .query('groupMembers')
    .withIndex('by_user_group', (q) => q.eq('userId', userId).eq('groupId', groupId))
    .first();
}

/** The suspension or ban row for this member, whether or not it has lapsed. */
export async function restrictionFor(
  ctx: QueryCtx | MutationCtx,
  userId: Id<'users'>,
  groupId: Id<'fitnessGroups'>,
) {
  return ctx.db
    .query('groupBans')
    .withIndex('by_user_group', (q) => q.eq('userId', userId).eq('groupId', groupId))
    .first();
}

/** Only a restriction still in force. */
export async function activeRestriction(
  ctx: QueryCtx | MutationCtx,
  userId: Id<'users'>,
  groupId: Id<'fitnessGroups'>,
  nowMs = Date.now(),
) {
  const row = await restrictionFor(ctx, userId, groupId);
  return row && isRestricted(row, nowMs) ? row : null;
}

/** Refuses a suspended or banned member with the date they may return, and
 * quietly drops a row whose date has passed — which is how a suspension ends:
 * the next attempt to join simply succeeds. */
export async function refuseIfRestricted(
  ctx: MutationCtx,
  userId: Id<'users'>,
  groupId: Id<'fitnessGroups'>,
  nowMs = Date.now(),
) {
  const row = await restrictionFor(ctx, userId, groupId);
  if (!row) return;
  if (isRestricted(row, nowMs)) {
    throw new ConvexError(
      row.kind === 'ban'
        ? `You were removed from this gym group and can rejoin after ${untilLabel(row.until)}`
        : `You are suspended from this gym group until ${untilLabel(row.until)}`,
    );
  }
  await ctx.db.delete(row._id);
}

/** A member seat, once. Gym groups never seat an owner. */
export async function seat(ctx: MutationCtx, userId: Id<'users'>, groupId: Id<'fitnessGroups'>) {
  const existing = await seatFor(ctx, userId, groupId);
  if (existing) return existing;
  const id = await ctx.db.insert('groupMembers', {
    userId,
    groupId,
    role: 'member',
    createdAt: nowIso(),
  });
  const inserted = await ctx.db.get(id);
  if (!inserted) throw new ConvexError('Group not available');
  return inserted;
}

/** Drops the seat and every vote against this member here. Leaving clears
 * the votes; a suspension already written runs to its date regardless. */
export async function unseat(ctx: MutationCtx, userId: Id<'users'>, groupId: Id<'fitnessGroups'>) {
  const existing = await seatFor(ctx, userId, groupId);
  if (existing) await ctx.db.delete(existing._id);
  await deleteVotesAgainst(ctx, userId, groupId);
}

export async function deleteVotesAgainst(
  ctx: MutationCtx,
  targetUserId: Id<'users'>,
  groupId: Id<'fitnessGroups'>,
) {
  const votes = await ctx.db
    .query('groupVotes')
    .withIndex('by_group_target', (q) => q.eq('groupId', groupId).eq('targetUserId', targetUserId))
    .collect();
  for (const vote of votes) await ctx.db.delete(vote._id);
}

/** "Austin, TX" out of "1234 Main St, Austin, TX 78701, USA", or the address
 * itself when it does not split that way. */
export function cityLabel(address: string): string {
  const parts = address
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);
  if (parts.length >= 3) {
    const city = parts[parts.length - 3];
    const region = parts[parts.length - 2].replace(/\s*\d[\w\s-]*$/, '').trim();
    const label = region ? `${city}, ${region}` : city;
    return label.slice(0, GROUP_LOCATION_MAX);
  }
  return address.slice(0, GROUP_LOCATION_MAX);
}

/** Chains repeat, so the handle seed carries the city: `planet_fitness_austin`
 * rather than `planet_fitness_2`. */
export function gymHandleSeed(name: string, address: string): string {
  const parts = address
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);
  const city = parts.length >= 3 ? parts[parts.length - 3] : '';
  const fromName = normalizeHandle(name);
  const fromCity = normalizeHandle(city);
  // "Gold's Gym Venice" already says where it is; only bare chain names get
  // the city appended.
  const seeded =
    fromCity && !fromName.includes(fromCity) ? normalizeHandle(`${name} ${city}`) : fromName;
  return seeded.length >= HANDLE_MIN ? seeded : handleSeed(name);
}

async function groupHandleTaken(ctx: QueryCtx | MutationCtx, candidate: string) {
  const existing = await ctx.db
    .query('fitnessGroups')
    .withIndex('by_handle', (q) => q.eq('handleLower', candidate))
    .first();
  return existing !== null;
}

/** The gym's one group, created on the first claim. `userId` records only
 * which account's claim inserted the row — it carries no privilege and is
 * never shown. */
export async function ensureGymGroup(
  ctx: MutationCtx,
  gym: Doc<'gyms'>,
  creatorId: Id<'users'>,
): Promise<Doc<'fitnessGroups'>> {
  const existing = await groupForGym(ctx, gym._id);
  if (existing) return existing;
  const handle = await firstFreeHandle(gymHandleSeed(gym.name, gym.address), (candidate) =>
    groupHandleTaken(ctx, candidate),
  );
  const ts = nowIso();
  const name = gym.name.trim().slice(0, GROUP_NAME_MAX) || 'Gym';
  const doc = {
    userId: creatorId,
    name,
    handle,
    handleLower: handle,
    sport: 'Gym',
    location: cityLabel(gym.address),
    description: `Everyone on Macronaut whose home gym is ${name}.`,
    isPublic: true,
    kind: 'gym' as const,
    gymId: gym._id,
    createdAt: ts,
    updatedAt: ts,
  };
  const id = await ctx.db.insert('fitnessGroups', doc);
  return { _id: id, _creationTime: Date.now(), ...doc };
}
