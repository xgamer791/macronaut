import { api } from '../../convex/_generated/api';
import { DayType, DayTypeMarks, GoalConfig, configForDate } from '@/domain/goals';
import { DayKey } from '@/utils/date';
import { clean, ConvexCaller } from './convexCall';

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

export function createGoalRepo(convex: ConvexCaller): GoalRepo {
  const listConfigs = () => convex.query(api.goals.listConfigs, {});
  return {
    listConfigs,
    saveConfig: (config) => convex.mutation(api.goals.saveConfig, clean(config)),
    async configFor(date) {
      return configForDate(date, await listConfigs());
    },
    getMarks: (from, to) => convex.query(api.goals.getMarks, { from, to }),
    allMarks: () => convex.query(api.goals.allMarks, {}),
    async setMark(date, type) {
      await convex.mutation(api.goals.setMark, { date, dayType: type });
    },
  };
}
