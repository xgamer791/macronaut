import { api } from '../../convex/_generated/api';
import type { Id } from '../../convex/_generated/dataModel';
import type { ConvexCaller } from './convexCall';
import type { FitnessGroup } from './groupRepo';

/** A gym as the catalogue knows it: a row the places search wrote. */
export interface GymSummary {
  id: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
}

/** A search result: a gym within seven miles, and how many people already
 * call it home. */
export interface GymCandidate extends GymSummary {
  distanceM: number;
  memberCount: number;
}

export interface GymRestriction {
  kind: 'suspension' | 'ban';
  until: string;
}

export interface MyGym {
  gym: GymSummary;
  /** The gym's one group — null until somebody's claim has created it. */
  group: FitnessGroup | null;
  /** A suspension or ban from that group still in force. */
  restriction: GymRestriction | null;
}

export interface GeocodedPoint {
  lat: number;
  lng: number;
  label: string;
}

export interface GymRepo {
  /** Whether the deployment has a places key. */
  available(): Promise<boolean>;
  geocode(address: string, near?: { lat: number; lng: number }): Promise<GeocodedPoint>;
  searchGyms(input: { query: string; lat: number; lng: number }): Promise<GymCandidate[]>;
  mine(): Promise<MyGym | null>;
  claim(input: { gymId: string; joinGroup: boolean }): Promise<MyGym>;
  joinGroup(): Promise<FitnessGroup>;
  clear(): Promise<void>;
}

const gymId = (id: string) => id as Id<'gyms'>;

export function createGymRepo(convex: ConvexCaller): GymRepo {
  return {
    async available() {
      const row = await convex.query(api.places.available, {});
      return row.configured;
    },
    geocode: (address, near) => convex.action(api.places.geocode, { address, near }),
    searchGyms: (input) => convex.action(api.places.searchGyms, input),
    mine: () => convex.query(api.gyms.mine, {}),
    claim: ({ gymId: id, joinGroup }) =>
      convex.mutation(api.gyms.claim, { gymId: gymId(id), joinGroup }),
    joinGroup: () => convex.mutation(api.gyms.joinGroup, {}),
    async clear() {
      await convex.mutation(api.gyms.clear, {});
    },
  };
}
