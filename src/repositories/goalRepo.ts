import { Database } from '@/db/driver';
import { DayType, DayTypeMarks, GoalConfig, configForDate } from '@/domain/goals';
import { DayKey } from '@/utils/date';
import { newId, nowIso, safeParse } from './util';

export interface GoalRepo {
  listConfigs(): Promise<GoalConfig[]>;
  /** Save a new effective-dated version. Editing = adding a new version;
   * a same-day re-edit replaces that day's version instead of stacking. */
  saveConfig(config: Omit<GoalConfig, 'id'>): Promise<GoalConfig>;
  configFor(date: DayKey): Promise<GoalConfig | null>;
  getMarks(from: DayKey, to: DayKey): Promise<DayTypeMarks>;
  allMarks(): Promise<DayTypeMarks>;
  setMark(date: DayKey, type: DayType | null): Promise<void>;
}

export function createGoalRepo(db: Database): GoalRepo {
  async function listConfigs(): Promise<GoalConfig[]> {
    const rows = await db.getAllAsync<{ payload: string }>(
      'SELECT payload FROM goal_configs ORDER BY effective_from',
    );
    return rows
      .map((r) => safeParse<GoalConfig | null>(r.payload, null))
      .filter((c): c is GoalConfig => c !== null);
  }

  return {
    listConfigs,

    async saveConfig(config) {
      const full: GoalConfig = { ...config, id: newId() };
      await db.withTransaction(async () => {
        // Same-effective-date edits replace rather than stack versions.
        await db.runAsync('DELETE FROM goal_configs WHERE effective_from = ?', [
          full.effectiveFrom,
        ]);
        await db.runAsync(
          'INSERT INTO goal_configs (id, effective_from, created_at, payload) VALUES (?, ?, ?, ?)',
          [full.id, full.effectiveFrom, nowIso(), JSON.stringify(full)],
        );
      });
      return full;
    },

    async configFor(date) {
      return configForDate(date, await listConfigs());
    },

    async getMarks(from, to) {
      const rows = await db.getAllAsync<{ date: string; day_type: DayType }>(
        'SELECT date, day_type FROM day_type_marks WHERE date >= ? AND date <= ?',
        [from, to],
      );
      return Object.fromEntries(rows.map((r) => [r.date, r.day_type]));
    },

    async allMarks() {
      const rows = await db.getAllAsync<{ date: string; day_type: DayType }>(
        'SELECT date, day_type FROM day_type_marks',
      );
      return Object.fromEntries(rows.map((r) => [r.date, r.day_type]));
    },

    async setMark(date, type) {
      if (type === null) {
        await db.runAsync('DELETE FROM day_type_marks WHERE date = ?', [date]);
        return;
      }
      await db.runAsync(
        `INSERT INTO day_type_marks (date, day_type) VALUES (?, ?)
         ON CONFLICT(date) DO UPDATE SET day_type = excluded.day_type`,
        [date, type],
      );
    },
  };
}
