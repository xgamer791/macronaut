import { DayProgress } from '@/domain/aggregation';
import { DiaryEntry } from '@/repositories/types';
import { buildNutritionContext } from '../nutritionContext';

const progress: DayProgress = {
  date: '2026-07-15',
  consumed: { calories: 1200, protein: 80, carbs: 100, fat: 40 },
  target: { calories: 2000, protein: 150, carbs: 200, fat: 60 },
  burned: 200,
  netCalories: 1000,
  caloriesRemaining: 1000,
  overCalories: false,
};

const entries: DiaryEntry[] = [
  {
    id: '1',
    date: '2026-07-15',
    meal: 'lunch',
    name: 'Chicken bowl',
    sourceType: 'custom',
    quantity: 1,
    unit: 'serving',
    nutrition: { calories: 500, protein: 40 },
    createdAt: '',
    updatedAt: '',
  },
];

describe('buildNutritionContext', () => {
  it('includes remaining calories and macros', () => {
    const text = buildNutritionContext({
      date: '2026-07-15',
      progress,
      entries,
    });
    expect(text).toContain('left 1000');
    expect(text).toMatch(/P 80\/150/);
    expect(text).toContain('Chicken bowl');
  });

  it('handles missing progress', () => {
    const text = buildNutritionContext({
      date: '2026-07-15',
      progress: null,
      entries: [],
    });
    expect(text).toContain('Goals not set');
  });
});
