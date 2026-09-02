import { api } from '../../convex/_generated/api';
import type { Id } from '../../convex/_generated/dataModel';
import { DayKey } from '@/utils/date';
import { clean, ConvexCaller } from './convexCall';
import { DiaryEntry } from './types';

export type NewDiaryEntry = Omit<DiaryEntry, 'id' | 'createdAt' | 'updatedAt'>;

export interface DiaryRepo {
  entriesForDate(date: DayKey): Promise<DiaryEntry[]>;
  entriesForRange(from: DayKey, to: DayKey): Promise<DiaryEntry[]>;
  add(entry: NewDiaryEntry): Promise<DiaryEntry>;
  update(id: string, patch: Partial<NewDiaryEntry>): Promise<DiaryEntry>;
  remove(id: string): Promise<void>;
  removeMany(ids: string[]): Promise<void>;
  duplicate(id: string): Promise<DiaryEntry>;
  /** Move an entry to another meal (and optionally another date). */
  move(id: string, meal: string, date?: DayKey): Promise<DiaryEntry>;
  moveMany(ids: string[], meal: string, date?: DayKey): Promise<void>;
  /** Copy all entries of a meal to another date (same meal). */
  copyMeal(fromDate: DayKey, meal: string, toDate: DayKey): Promise<number>;
  /** Copy an entire day's entries to another date. */
  copyDay(fromDate: DayKey, toDate: DayKey): Promise<number>;
  clearMeal(date: DayKey, meal: string): Promise<number>;
}

const entryId = (id: string) => id as Id<'diaryEntries'>;

export function createDiaryRepo(convex: ConvexCaller): DiaryRepo {
  return {
    entriesForDate: (date) => convex.query(api.diary.entriesForDate, { date }),
    entriesForRange: (from, to) => convex.query(api.diary.entriesForRange, { from, to }),
    add: (entry) => convex.mutation(api.diary.add, clean(entry)),
    update: (id, patch) =>
      convex.mutation(api.diary.update, { id: entryId(id), patch: clean(patch) }),
    async remove(id) {
      await convex.mutation(api.diary.remove, { id: entryId(id) });
    },
    async removeMany(ids) {
      if (ids.length === 0) return;
      await convex.mutation(api.diary.removeMany, { ids: ids.map(entryId) });
    },
    duplicate: (id) => convex.mutation(api.diary.duplicate, { id: entryId(id) }),
    move: (id, meal, date) =>
      convex.mutation(api.diary.move, clean({ id: entryId(id), meal, date })),
    async moveMany(ids, meal, date) {
      if (ids.length === 0) return;
      await convex.mutation(api.diary.moveMany, clean({ ids: ids.map(entryId), meal, date }));
    },
    copyMeal: (fromDate, meal, toDate) =>
      convex.mutation(api.diary.copyMeal, { fromDate, meal, toDate }),
    copyDay: (fromDate, toDate) => convex.mutation(api.diary.copyDay, { fromDate, toDate }),
    clearMeal: (date, meal) => convex.mutation(api.diary.clearMeal, { date, meal }),
  };
}
