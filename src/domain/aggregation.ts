import { DayKey } from '@/utils/date';
import { sumNutrition } from './nutrition';
import { GoalConfig, DayTypeMarks, resolveTargetForDate } from './goals';
import { MACRO_KEYS, MacroKey, Nutrition, NutrientTargets } from './types';

export interface DayProgress {
  date: DayKey;
  consumed: Nutrition;
  target: NutrientTargets;
  /** Exercise calories burned (manual / future Apple Watch). */
  burned: number;
  /** Food − exercise. */
  netCalories: number;
  /** calories remaining (target − food + burned); negative = over. */
  caloriesRemaining: number;
  overCalories: boolean;
}

export function dayProgress(
  date: DayKey,
  entries: Nutrition[],
  config: GoalConfig,
  marks: DayTypeMarks = {},
  burned = 0,
): DayProgress {
  const consumed = sumNutrition(entries);
  const target = resolveTargetForDate(date, config, marks);
  const safeBurned = Math.max(0, burned);
  const netCalories = consumed.calories - safeBurned;
  return {
    date,
    consumed,
    target,
    burned: safeBurned,
    netCalories,
    caloriesRemaining: target.calories - consumed.calories + safeBurned,
    overCalories: netCalories > target.calories,
  };
}

export interface WeekProgress {
  days: DayProgress[];
  /** Weekly target: explicit custom target, or the sum of the 7 resolved
   * daily targets. Never rolls between weeks. */
  weeklyTarget: NutrientTargets;
  weeklyConsumed: Nutrition;
  weeklyBurned: number;
  weeklyRemaining: number;
  averagePerDay: Nutrition;
  /** Days with any logged food that landed within the calorie target (net). */
  daysOverCalories: number;
  daysUnderCalories: number;
  daysLogged: number;
  /** 0..1 — share of logged days within the calorie target. */
  calorieAdherence: number;
  /** Per-macro adherence for protein/carbs/fat (within = consumed ≤ target). */
  macroAdherence: Partial<Record<MacroKey, number>>;
}

/** Aggregate a week of day-entry lists. `weekDates` must be the 7 day keys of
 * the target week (from weekDays()); entriesByDay maps day key → the
 * already-scaled nutrition of each entry that day. */
export function weekProgress(
  weekDates: DayKey[],
  entriesByDay: Record<DayKey, Nutrition[]>,
  config: GoalConfig,
  marks: DayTypeMarks = {},
  burnedByDay: Record<DayKey, number> = {},
): WeekProgress {
  const days = weekDates.map((d) =>
    dayProgress(d, entriesByDay[d] ?? [], config, marks, burnedByDay[d] ?? 0),
  );

  const summedDailyTargets = sumNutrition(days.map((d) => d.target));
  const weeklyTarget =
    config.weeklyMode === 'custom' && config.weeklyTarget
      ? config.weeklyTarget
      : summedDailyTargets;

  const weeklyConsumed = sumNutrition(days.map((d) => d.consumed));
  const weeklyBurned = days.reduce((sum, d) => sum + d.burned, 0);
  const logged = days.filter((d) => d.consumed.calories > 0 || d.burned > 0);
  const over = logged.filter((d) => d.overCalories).length;

  const averagePerDay =
    logged.length > 0
      ? scaleDown(sumNutrition(logged.map((d) => d.consumed)), logged.length)
      : { calories: 0 };

  const macroAdherence: Partial<Record<MacroKey, number>> = {};
  for (const key of ['protein', 'carbs', 'fat'] as const) {
    const withTarget = logged.filter((d) => (d.target[key] ?? 0) > 0);
    if (withTarget.length === 0) continue;
    const within = withTarget.filter((d) => (d.consumed[key] ?? 0) <= (d.target[key] as number));
    macroAdherence[key] = within.length / withTarget.length;
  }

  return {
    days,
    weeklyTarget,
    weeklyConsumed,
    weeklyBurned,
    weeklyRemaining: weeklyTarget.calories - weeklyConsumed.calories + weeklyBurned,
    averagePerDay,
    daysOverCalories: over,
    daysUnderCalories: logged.length - over,
    daysLogged: logged.length,
    calorieAdherence: logged.length > 0 ? (logged.length - over) / logged.length : 0,
    macroAdherence,
  };
}

function scaleDown(n: Nutrition, divisor: number): Nutrition {
  const out: Nutrition = { calories: n.calories / divisor };
  for (const key of MACRO_KEYS) {
    const v = n[key];
    if (v !== undefined) out[key] = v / divisor;
  }
  return out;
}
