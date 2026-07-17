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
    return `Date: ${date}. Daily goals are not set yet — remind the user to finish onboarding or set goals in Settings.`;
  }

  const proteinLeft = (progress.target.protein ?? 0) - (progress.consumed.protein ?? 0);
  const carbsLeft = (progress.target.carbs ?? 0) - (progress.consumed.carbs ?? 0);
  const fatLeft = (progress.target.fat ?? 0) - (progress.consumed.fat ?? 0);
  const fiberLeft =
    progress.target.fiber !== undefined
      ? progress.target.fiber - (progress.consumed.fiber ?? 0)
      : undefined;

  const logged =
    entries.length === 0
      ? 'No foods logged yet today.'
      : entries
          .map((e) => {
            const p = e.nutrition.protein != null ? ` · P ${Math.round(e.nutrition.protein)}` : '';
            return `- ${e.meal}: ${e.name} (${Math.round(e.nutrition.calories)} kcal${p})`;
          })
          .join('\n');

  return [
    `Date: ${date}`,
    `Calories — target ${Math.round(progress.target.calories)}, food ${Math.round(progress.consumed.calories)}, burned ${Math.round(progress.burned)}, remaining ${Math.round(progress.caloriesRemaining)}${progress.overCalories ? ' (OVER)' : ''}.`,
    `Protein — target ${Math.round(progress.target.protein ?? 0)} g, eaten ${Math.round(progress.consumed.protein ?? 0)} g, remaining ${Math.round(proteinLeft)} g.`,
    `Carbs — target ${Math.round(progress.target.carbs ?? 0)} g, eaten ${Math.round(progress.consumed.carbs ?? 0)} g, remaining ${Math.round(carbsLeft)} g.`,
    `Fat — target ${Math.round(progress.target.fat ?? 0)} g, eaten ${Math.round(progress.consumed.fat ?? 0)} g, remaining ${Math.round(fatLeft)} g.`,
    fiberLeft !== undefined
      ? `Fiber — target ${Math.round(progress.target.fiber ?? 0)} g, eaten ${Math.round(progress.consumed.fiber ?? 0)} g, remaining ${Math.round(fiberLeft)} g.`
      : null,
    `Logged foods:\n${logged}`,
  ]
    .filter(Boolean)
    .join('\n');
}
