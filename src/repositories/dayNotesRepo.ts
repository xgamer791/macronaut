import { Database } from '@/db/driver';
import { DayKey } from '@/utils/date';
import { newId, nowIso } from './util';

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

function mapRow(r: {
  id: string;
  date: string;
  body: string;
  created_at: string;
  updated_at: string;
}): DayNote {
  return {
    id: r.id,
    date: r.date,
    body: r.body,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

export function createDayNotesRepo(db: Database): DayNotesRepo {
  return {
    async listForDate(date) {
      const rows = await db.getAllAsync<{
        id: string;
        date: string;
        body: string;
        created_at: string;
        updated_at: string;
      }>(
        `SELECT id, date, body, created_at, updated_at FROM day_notes
         WHERE date = ? ORDER BY created_at ASC`,
        [date],
      );
      return rows.map(mapRow);
    },

    async add(date, body) {
      const trimmed = body.trim();
      if (!trimmed) throw new Error('Note cannot be empty');
      const id = newId();
      const ts = nowIso();
      await db.runAsync(
        `INSERT INTO day_notes (id, date, body, created_at, updated_at) VALUES (?, ?, ?, ?, ?)`,
        [id, date, trimmed, ts, ts],
      );
      return { id, date, body: trimmed, createdAt: ts, updatedAt: ts };
    },

    async update(id, body) {
      const trimmed = body.trim();
      if (!trimmed) throw new Error('Note cannot be empty');
      const ts = nowIso();
      await db.runAsync(`UPDATE day_notes SET body = ?, updated_at = ? WHERE id = ?`, [
        trimmed,
        ts,
        id,
      ]);
      const row = await db.getFirstAsync<{
        id: string;
        date: string;
        body: string;
        created_at: string;
        updated_at: string;
      }>(`SELECT id, date, body, created_at, updated_at FROM day_notes WHERE id = ?`, [id]);
      if (!row) throw new Error('Note not found');
      return mapRow(row);
    },

    async remove(id) {
      await db.runAsync('DELETE FROM day_notes WHERE id = ?', [id]);
    },

    async datesWithNotes(from, to) {
      const rows = await db.getAllAsync<{ date: string }>(
        `SELECT DISTINCT date FROM day_notes
         WHERE date >= ? AND date <= ? AND length(trim(body)) > 0
         ORDER BY date`,
        [from, to],
      );
      return rows.map((r) => r.date);
    },
  };
}
