import { Database } from '@/db/driver';
import { Nutrition } from '@/domain/types';
import { DayKey } from '@/utils/date';
import { DiaryEntry, SourceType } from './types';
import { newId, nowIso, safeParse } from './util';

interface Row {
  id: string;
  date: string;
  meal: string;
  time: string | null;
  name: string;
  brand: string | null;
  source_type: string;
  source_id: string | null;
  quantity: number;
  unit: string;
  serving_desc: string | null;
  nutrition: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

function rowToEntry(r: Row): DiaryEntry {
  return {
    id: r.id,
    date: r.date,
    meal: r.meal,
    time: r.time ?? undefined,
    name: r.name,
    brand: r.brand ?? undefined,
    sourceType: r.source_type as SourceType,
    sourceId: r.source_id ?? undefined,
    quantity: r.quantity,
    unit: r.unit,
    servingDesc: r.serving_desc ?? undefined,
    nutrition: safeParse<Nutrition>(r.nutrition, { calories: 0 }),
    notes: r.notes ?? undefined,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

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

export function createDiaryRepo(db: Database): DiaryRepo {
  const SELECT = `SELECT id, date, meal, time, name, brand, source_type, source_id,
    quantity, unit, serving_desc, nutrition, notes, created_at, updated_at FROM diary_entries`;

  async function getById(id: string): Promise<DiaryEntry> {
    const row = await db.getFirstAsync<Row>(`${SELECT} WHERE id = ?`, [id]);
    if (!row) throw new Error(`Diary entry not found: ${id}`);
    return rowToEntry(row);
  }

  async function insert(entry: NewDiaryEntry): Promise<DiaryEntry> {
    const now = nowIso();
    const full: DiaryEntry = { ...entry, id: newId(), createdAt: now, updatedAt: now };
    await db.runAsync(
      `INSERT INTO diary_entries (id, date, meal, time, name, brand, source_type, source_id,
        quantity, unit, serving_desc, nutrition, notes, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        full.id,
        full.date,
        full.meal,
        full.time ?? null,
        full.name,
        full.brand ?? null,
        full.sourceType,
        full.sourceId ?? null,
        full.quantity,
        full.unit,
        full.servingDesc ?? null,
        JSON.stringify(full.nutrition),
        full.notes ?? null,
        full.createdAt,
        full.updatedAt,
      ],
    );
    return full;
  }

  return {
    async entriesForDate(date) {
      const rows = await db.getAllAsync<Row>(`${SELECT} WHERE date = ? ORDER BY created_at`, [
        date,
      ]);
      return rows.map(rowToEntry);
    },

    async entriesForRange(from, to) {
      const rows = await db.getAllAsync<Row>(
        `${SELECT} WHERE date >= ? AND date <= ? ORDER BY date, created_at`,
        [from, to],
      );
      return rows.map(rowToEntry);
    },

    add: insert,

    async update(id, patch) {
      const existing = await getById(id);
      const merged: DiaryEntry = { ...existing, ...patch, id, updatedAt: nowIso() };
      await db.runAsync(
        `UPDATE diary_entries SET date=?, meal=?, time=?, name=?, brand=?, source_type=?,
          source_id=?, quantity=?, unit=?, serving_desc=?, nutrition=?, notes=?, updated_at=?
         WHERE id=?`,
        [
          merged.date,
          merged.meal,
          merged.time ?? null,
          merged.name,
          merged.brand ?? null,
          merged.sourceType,
          merged.sourceId ?? null,
          merged.quantity,
          merged.unit,
          merged.servingDesc ?? null,
          JSON.stringify(merged.nutrition),
          merged.notes ?? null,
          merged.updatedAt,
          id,
        ],
      );
      return merged;
    },

    async remove(id) {
      await db.runAsync('DELETE FROM diary_entries WHERE id = ?', [id]);
    },

    async removeMany(ids) {
      if (ids.length === 0) return;
      await db.withTransaction(async () => {
        for (const id of ids) await db.runAsync('DELETE FROM diary_entries WHERE id = ?', [id]);
      });
    },

    async duplicate(id) {
      const e = await getById(id);
      const { id: _id, createdAt: _c, updatedAt: _u, ...rest } = e;
      return insert(rest);
    },

    async move(id, meal, date) {
      const e = await getById(id);
      return this.update(id, { meal, date: date ?? e.date });
    },

    async moveMany(ids, meal, date) {
      await db.withTransaction(async () => {
        for (const id of ids) {
          const e = await getById(id);
          await db.runAsync('UPDATE diary_entries SET meal = ?, date = ?, updated_at = ? WHERE id = ?', [
            meal,
            date ?? e.date,
            nowIso(),
            id,
          ]);
        }
      });
    },

    async copyMeal(fromDate, meal, toDate) {
      const rows = await db.getAllAsync<Row>(`${SELECT} WHERE date = ? AND meal = ?`, [
        fromDate,
        meal,
      ]);
      await db.withTransaction(async () => {
        for (const r of rows) {
          const e = rowToEntry(r);
          const { id: _id, createdAt: _c, updatedAt: _u, ...rest } = e;
          await insert({ ...rest, date: toDate });
        }
      });
      return rows.length;
    },

    async copyDay(fromDate, toDate) {
      const rows = await db.getAllAsync<Row>(`${SELECT} WHERE date = ?`, [fromDate]);
      await db.withTransaction(async () => {
        for (const r of rows) {
          const e = rowToEntry(r);
          const { id: _id, createdAt: _c, updatedAt: _u, ...rest } = e;
          await insert({ ...rest, date: toDate });
        }
      });
      return rows.length;
    },

    async clearMeal(date, meal) {
      const res = await db.runAsync('DELETE FROM diary_entries WHERE date = ? AND meal = ?', [
        date,
        meal,
      ]);
      return res.changes;
    },
  };
}
