import { getAuthUserId } from '@convex-dev/auth/server';
import { ConvexError, v } from 'convex/values';
import { internal } from './_generated/api';
import { action, internalMutation, query } from './_generated/server';
import { requireUserId } from './lib/auth';
import { GYM_SEARCH_RADIUS_M, isFiniteCoordinate } from './lib/geo';
import { geocodeAddress, searchGymsNearby } from './lib/googlePlaces';

/** The Google boundary for the home-gym search. The key is
 * `GOOGLE_PLACES_API_KEY` on the deployment and never reaches a client; the
 * only things that do are a gym's id, name, address, coordinates and
 * distance. Rows land in `gyms` through convex/gyms.ts, so a claim can only
 * ever name a gym this search wrote. */

const QUERY_MAX = 60;
const ADDRESS_MAX = 120;
/** Searches per account per day. The key bills per call and an account is
 * free to create, so a scripted client must not be able to drain it. */
export const DAILY_SEARCH_CAP = 50;

function configuredKey(): string {
  return (process.env.GOOGLE_PLACES_API_KEY ?? '').trim();
}

/** Whether gym search is set up on this deployment. Never returns the key. */
export const available = query({
  args: {},
  handler: async (ctx) => {
    await requireUserId(ctx);
    return { configured: configuredKey() !== '' };
  },
});

/** A rough address → one point to search around. */
export const geocode = action({
  args: { address: v.string() },
  handler: async (ctx, { address }): Promise<{ lat: number; lng: number; label: string }> => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new ConvexError('Not signed in');
    const wanted = address.trim().slice(0, ADDRESS_MAX);
    if (!wanted) throw new ConvexError('Enter an address or use your location');
    const key = configuredKey();
    if (!key) throw new ConvexError('Gym search is not configured');
    await ctx.runMutation(internal.places.recordSearch, {});
    try {
      return await geocodeAddress({ apiKey: key, address: wanted });
    } catch (e) {
      throw new ConvexError(e instanceof Error ? e.message : 'Could not find that address');
    }
  },
});

export interface GymCandidate {
  id: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
  distanceM: number;
  memberCount: number;
}

/** Every gym called `query` within seven miles of the point, closest first,
 * each already a `gyms` row so it can be claimed by id. */
export const searchGyms = action({
  args: { query: v.string(), lat: v.number(), lng: v.number() },
  handler: async (ctx, args): Promise<GymCandidate[]> => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new ConvexError('Not signed in');
    const wanted = args.query.trim().slice(0, QUERY_MAX);
    if (!wanted) throw new ConvexError("Type your gym's name");
    if (!isFiniteCoordinate(args.lat, args.lng)) {
      throw new ConvexError('Use your location or enter an address first');
    }
    const key = configuredKey();
    if (!key) throw new ConvexError('Gym search is not configured');
    await ctx.runMutation(internal.places.recordSearch, {});

    let found;
    try {
      found = await searchGymsNearby({
        apiKey: key,
        query: wanted,
        anchor: { lat: args.lat, lng: args.lng },
        radiusM: GYM_SEARCH_RADIUS_M,
      });
    } catch (e) {
      throw new ConvexError(e instanceof Error ? e.message : 'Gym search failed');
    }
    if (found.length === 0) return [];

    const rows = await ctx.runMutation(internal.gyms.upsertMany, {
      gyms: found.map((gym) => ({
        provider: 'google' as const,
        placeId: gym.placeId,
        name: gym.name,
        address: gym.address,
        lat: gym.lat,
        lng: gym.lng,
      })),
    });
    return found.map((gym, i) => ({
      id: rows[i].id,
      name: gym.name,
      address: gym.address,
      lat: gym.lat,
      lng: gym.lng,
      distanceM: Math.round(gym.distanceM),
      memberCount: rows[i].memberCount,
    }));
  },
});

/** One more search against today's cap for the caller. */
export const recordSearch = internalMutation({
  args: {},
  handler: async (ctx) => {
    const userId = await requireUserId(ctx);
    const day = new Date().toISOString().slice(0, 10);
    const row = await ctx.db
      .query('placesUsage')
      .withIndex('by_user_day', (q) => q.eq('userId', userId).eq('day', day))
      .first();
    const count = (row?.count ?? 0) + 1;
    if (count > DAILY_SEARCH_CAP) {
      throw new ConvexError('Too many gym searches today — try again tomorrow');
    }
    if (row) await ctx.db.patch(row._id, { count });
    else await ctx.db.insert('placesUsage', { userId, day, count });
    return { count };
  },
});
