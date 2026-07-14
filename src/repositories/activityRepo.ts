import { Database } from '@/db/driver';
import { DayKey } from '@/utils/date';
import {
  ActivityEntry,
  ActivityIntensity,
  ActivitySourceType,
  ActivityType,
} from './types';
import { newId, nowIso } from './util';

interface Row {
  id: string;
  date: string;
  name: string;
  activity_type: string;
  duration_min: number | null;
  distance_km: number | null;
  calories_burned: number;
  intensity: string | null;
  notes: string | null;
  source_type: string;
  source_id: string | null;
  created_at: string;
  updated_at: string;
}

function rowToEntry(r: Row): ActivityEntry {
  return {
    id: r.id,
    date: r.date,
    name: r.name,
    activityType: r.activity_type as ActivityType,
    durationMin: r.duration_min ?? undefined,
    distanceKm: r.distance_km ?? undefined,
    caloriesBurned: r.calories_burned,
    intensity: (r.intensity as ActivityIntensity | null) ?? undefined,
    notes: r.notes ?? undefined,
    sourceType: r.source_type as ActivitySourceType,
    sourceId: r.source_id ?? undefined,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

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

export function createActivityRepo(db: Database): ActivityRepo {
  const SELECT = `SELECT id, date, name, activity_type, duration_min, distance_km,
    calories_burned, intensity, notes, source_type, source_id, created_at, updated_at
    FROM activity_entries`;

  async function getById(id: string): Promise<ActivityEntry> {
    const row = await db.getFirstAsync<Row>(`${SELECT} WHERE id = ?`, [id]);
    if (!row) throw new Error(`Activity entry not found: ${id}`);
    return rowToEntry(row);
  }

  async function insert(entry: NewActivityEntry): Promise<ActivityEntry> {
    const now = nowIso();
    const full: ActivityEntry = { ...entry, id: newId(), createdAt: now, updatedAt: now };
    await db.runAsync(
      `INSERT INTO activity_entries (id, date, name, activity_type, duration_min, distance_km,
        calories_burned, intensity, notes, source_type, source_id, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        full.id,
        full.date,
        full.name,
        full.activityType,
        full.durationMin ?? null,
        full.distanceKm ?? null,
        full.caloriesBurned,
        full.intensity ?? null,
        full.notes ?? null,
        full.sourceType,
        full.sourceId ?? null,
        full.createdAt,
        full.updatedAt,
      ],
    );
    return full;
  }

  return {
    async entriesForDate(date) {
      const rows = await db.getAllAsync<Row>(`${SELECT} WHERE date = ? ORDER BY created_at`, [date]);
      return rows.map(rowToEntry);
    },

    async entriesForRange(from, to) {
      const rows = await db.getAllAsync<Row>(
        `${SELECT} WHERE date >= ? AND date <= ? ORDER BY date, created_at`,
        [from, to],
      );
      return rows.map(rowToEntry);
    },

    async get(id) {
      const row = await db.getFirstAsync<Row>(`${SELECT} WHERE id = ?`, [id]);
      return row ? rowToEntry(row) : null;
    },

    add: insert,

    async update(id, patch) {
      const current = await getById(id);
      const next: ActivityEntry = {
        ...current,
        ...patch,
        id: current.id,
        createdAt: current.createdAt,
        updatedAt: nowIso(),
      };
      await db.runAsync(
        `UPDATE activity_entries SET date = ?, name = ?, activity_type = ?, duration_min = ?,
          distance_km = ?, calories_burned = ?, intensity = ?, notes = ?, source_type = ?,
          source_id = ?, updated_at = ? WHERE id = ?`,
        [
          next.date,
          next.name,
          next.activityType,
          next.durationMin ?? null,
          next.distanceKm ?? null,
          next.caloriesBurned,
          next.intensity ?? null,
          next.notes ?? null,
          next.sourceType,
          next.sourceId ?? null,
          next.updatedAt,
          id,
        ],
      );
      return next;
    },

    async remove(id) {
      await db.runAsync('DELETE FROM activity_entries WHERE id = ?', [id]);
    },

    async previousByName(name, beforeDate, limit = 5) {
      const rows = await db.getAllAsync<Row>(
        `${SELECT} WHERE lower(name) = lower(?) AND date < ? ORDER BY date DESC, created_at DESC LIMIT ?`,
        [name.trim(), beforeDate, limit],
      );
      return rows.map(rowToEntry);
    },

    async totalBurnedForDate(date) {
      const row = await db.getFirstAsync<{ total: number | null }>(
        'SELECT SUM(calories_burned) AS total FROM activity_entries WHERE date = ?',
        [date],
      );
      return row?.total ?? 0;
    },
  };
}
