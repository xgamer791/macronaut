import { api } from '../../convex/_generated/api';
import type { Id } from '../../convex/_generated/dataModel';
import { DayKey } from '@/utils/date';
import { clean, ConvexCaller } from './convexCall';
import { ActivityEntry } from './types';

export type NewActivityEntry = Omit<ActivityEntry, 'id' | 'createdAt' | 'updatedAt'>;

export interface ActivityRepo {
  entriesForDate(date: DayKey): Promise<ActivityEntry[]>;
  entriesForRange(from: DayKey, to: DayKey): Promise<ActivityEntry[]>;
  get(id: string): Promise<ActivityEntry | null>;
  add(entry: NewActivityEntry): Promise<ActivityEntry>;
  update(id: string, patch: Partial<NewActivityEntry>): Promise<ActivityEntry>;
  remove(id: string): Promise<void>;
  /** Prior sessions of the same name (most recent first), for PR / improvement chips. */
  previousByName(name: string, beforeDate: DayKey, limit?: number): Promise<ActivityEntry[]>;
  totalBurnedForDate(date: DayKey): Promise<number>;
}

const activityId = (id: string) => id as Id<'activityEntries'>;

export function createActivityRepo(convex: ConvexCaller): ActivityRepo {
  return {
    entriesForDate: (date) => convex.query(api.activity.entriesForDate, { date }),
    entriesForRange: (from, to) => convex.query(api.activity.entriesForRange, { from, to }),
    get: (id) => convex.query(api.activity.get, { id: activityId(id) }),
    add: (entry) => convex.mutation(api.activity.add, clean(entry)),
    update: (id, patch) =>
      convex.mutation(api.activity.update, { id: activityId(id), patch: clean(patch) }),
    async remove(id) {
      await convex.mutation(api.activity.remove, { id: activityId(id) });
    },
    previousByName: (name, beforeDate, limit) =>
      convex.query(api.activity.previousByName, clean({ name, beforeDate, limit })),
    totalBurnedForDate: (date) => convex.query(api.activity.totalBurnedForDate, { date }),
  };
}
