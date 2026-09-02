import { api } from '../../convex/_generated/api';
import type { Id } from '../../convex/_generated/dataModel';
import { DayKey } from '@/utils/date';
import { ConvexCaller } from './convexCall';

export interface DayNote {
  id: string;
  date: DayKey;
  body: string;
  createdAt: string;
  updatedAt: string;
}

export interface DayNotesRepo {
  listForDate(date: DayKey): Promise<DayNote[]>;
  add(date: DayKey, body: string): Promise<DayNote>;
  update(id: string, body: string): Promise<DayNote>;
  remove(id: string): Promise<void>;
  datesWithNotes(from: DayKey, to: DayKey): Promise<DayKey[]>;
}

const noteId = (id: string) => id as Id<'dayNotes'>;

export function createDayNotesRepo(convex: ConvexCaller): DayNotesRepo {
  return {
    listForDate: (date) => convex.query(api.dayNotes.listForDate, { date }),
    add: (date, body) => convex.mutation(api.dayNotes.add, { date, body }),
    update: (id, body) => convex.mutation(api.dayNotes.update, { id: noteId(id), body }),
    async remove(id) {
      await convex.mutation(api.dayNotes.remove, { id: noteId(id) });
    },
    datesWithNotes: (from, to) => convex.query(api.dayNotes.datesWithNotes, { from, to }),
  };
}
