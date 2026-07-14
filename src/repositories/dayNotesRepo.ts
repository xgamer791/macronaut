import { Database } from '@/db/driver';
import { DayKey } from '@/utils/date';
import { nowIso } from './util';

export interface DayNote {
  date: DayKey;
  body: string;
  updatedAt: string;
}

export interface DayNotesRepo {
  get(date: DayKey): Promise<DayNote | null>;
  /** Upsert note body. Empty/whitespace clears the note for that day. */
  set(date: DayKey, body: string): Promise<DayNote | null>;
  datesWithNotes(from: DayKey, to: DayKey): Promise<DayKey[]>;
}

export function createDayNotesRepo(db: Database): DayNotesRepo {
  return {
    async get(date) {
      const row = await db.getFirstAsync<{ date: string; body: string; updated_at: string }>(
        'SELECT date, body, updated_at FROM day_notes WHERE date = ?',
        [date],
      );
      if (!row) return null;
      return { date: row.date, body: row.body, updatedAt: row.updated_at };
    },

    async set(date, body) {
      const trimmed = body.trim();
      if (!trimmed) {
        await db.runAsync('DELETE FROM day_notes WHERE date = ?', [date]);
        return null;
      }
      const updatedAt = nowIso();
      await db.runAsync(
        `INSERT INTO day_notes (date, body, updated_at) VALUES (?, ?, ?)
         ON CONFLICT(date) DO UPDATE SET body = excluded.body, updated_at = excluded.updated_at`,
        [date, trimmed, updatedAt],
      );
      return { date, body: trimmed, updatedAt };
    },

    async datesWithNotes(from, to) {
      const rows = await db.getAllAsync<{ date: string }>(
        'SELECT date FROM day_notes WHERE date >= ? AND date <= ? AND length(trim(body)) > 0 ORDER BY date',
        [from, to],
      );
      return rows.map((r) => r.date);
    },
  };
}
