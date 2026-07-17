import { DayProgress } from '@/domain/aggregation';
import { DiaryEntry } from '@/repositories/types';
import { DayKey } from '@/utils/date';

/** Compact daily nutrition snapshot for the voice assistant system prompt. */
export function buildNutritionContext(opts: {
  date: DayKey;
  progress: DayProgress | null;
  entries: DiaryEntry[];
}): string {
  const { date, progress, entries } = opts;
  if (!progress) {
    return `Date: ${date}. Goals not set — ask them to finish onboarding or open Settings.`;
  }

  const recent = entries.slice(-5);
  const logged =
    recent.length === 0
      ? 'none yet'
      : recent
          .map((e) => {
            const p = e.nutrition.protein != null ? ` P${Math.round(e.nutrition.protein)}` : '';
            return `${e.name} ${Math.round(e.nutrition.calories)}kcal${p}`;
          })
          .join('; ');

  return [
    `Date ${date}.`,
    `Cal ${Math.round(progress.consumed.calories)}/${Math.round(progress.target.calories)} (left ${Math.round(progress.caloriesRemaining)}${progress.overCalories ? ' OVER' : ''}).`,
    `P ${Math.round(progress.consumed.protein ?? 0)}/${Math.round(progress.target.protein ?? 0)}g,`,
    `C ${Math.round(progress.consumed.carbs ?? 0)}/${Math.round(progress.target.carbs ?? 0)}g,`,
    `F ${Math.round(progress.consumed.fat ?? 0)}/${Math.round(progress.target.fat ?? 0)}g.`,
    `Foods: ${logged}.`,
  ].join(' ');
}
