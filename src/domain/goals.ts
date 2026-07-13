import { DayKey, weekdayOf } from '@/utils/date';
import { NutrientTargets } from './types';

export type GoalMode = 'same-daily' | 'per-weekday' | 'training-rest';
export type WeeklyGoalMode = 'sum-daily' | 'custom';
export type DayType = 'training' | 'rest';

/** One effective-dated version of the user's goal configuration. Editing
 * goals creates a NEW config with a new effectiveFrom; historical dates keep
 * resolving against the version in effect back then, so past adherence never
 * changes retroactively. */
export interface GoalConfig {
  id: string;
  /** First day (inclusive, day key) this config applies to. */
  effectiveFrom: DayKey;
  mode: GoalMode;
  /** Fallback target and the target used by 'same-daily'. */
  baseTarget: NutrientTargets;
  /** Per-weekday overrides, index 0 = Sunday … 6 = Saturday. Missing/null
   * entries fall back to baseTarget. Only used in 'per-weekday' mode. */
  perWeekday?: (NutrientTargets | null)[];
  /** Training/rest targets — only used in 'training-rest' mode. */
  training?: NutrientTargets;
  rest?: NutrientTargets;
  /** Weekly pattern of training days (weekday indices, 0=Sun). */
  trainingDays?: number[];
  /** Weekly aggregation mode: sum of the 7 resolved daily targets, or an
   * explicitly configured combined weekly target. */
  weeklyMode: WeeklyGoalMode;
  weeklyTarget?: NutrientTargets;
}

/** Per-date training/rest marks override the weekly pattern. */
export type DayTypeMarks = Record<DayKey, DayType>;

/** Classify a date as training or rest. Resolution order (deterministic):
 * explicit per-date mark → weekly pattern → rest. */
export function classifyDay(date: DayKey, config: GoalConfig, marks: DayTypeMarks = {}): DayType {
  const marked = marks[date];
  if (marked) return marked;
  const wd = weekdayOf(date);
  return (config.trainingDays ?? []).includes(wd) ? 'training' : 'rest';
}

/** Resolve the nutrient targets that apply to a calendar date under a config.
 * Precedence by mode:
 *  - training-rest: per-date mark → weekly pattern → rest target (falls back
 *    to baseTarget if the type-specific target is missing)
 *  - per-weekday: weekday override → baseTarget
 *  - same-daily: baseTarget
 * No rollover by construction: only `date` is consulted, never other days. */
export function resolveTargetForDate(
  date: DayKey,
  config: GoalConfig,
  marks: DayTypeMarks = {},
): NutrientTargets {
  switch (config.mode) {
    case 'training-rest': {
      const type = classifyDay(date, config, marks);
      return (type === 'training' ? config.training : config.rest) ?? config.baseTarget;
    }
    case 'per-weekday': {
      const override = config.perWeekday?.[weekdayOf(date)];
      return override ?? config.baseTarget;
    }
    case 'same-daily':
      return config.baseTarget;
  }
}

/** Pick the config version in effect on `date`: the one with the latest
 * effectiveFrom <= date. Dates before the first version use the earliest
 * config (there is no "no goals" state once onboarding completes). */
export function configForDate(date: DayKey, configs: GoalConfig[]): GoalConfig | null {
  if (configs.length === 0) return null;
  const sorted = [...configs].sort((a, b) => a.effectiveFrom.localeCompare(b.effectiveFrom));
  let chosen = sorted[0];
  for (const c of sorted) {
    if (c.effectiveFrom <= date) chosen = c;
    else break;
  }
  return chosen;
}
