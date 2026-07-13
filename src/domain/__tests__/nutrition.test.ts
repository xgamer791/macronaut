import { caloriesFromMacros, roundForDisplay, scaleNutrition, sumNutrition } from '../nutrition';
import { Nutrition } from '../types';

describe('caloriesFromMacros', () => {
  it('uses 4/4/9 kcal per gram', () => {
    expect(caloriesFromMacros(30, 40, 10)).toBe(30 * 4 + 40 * 4 + 10 * 9);
  });

  it('is zero for zero macros', () => {
    expect(caloriesFromMacros(0, 0, 0)).toBe(0);
  });
});

describe('scaleNutrition', () => {
  const base: Nutrition = {
    calories: 200,
    protein: 10,
    carbs: 20,
    fat: 5,
    micros: { 'vitamin c': { amount: 30, unit: 'mg' } },
  };

  it('scales all present fields', () => {
    const doubled = scaleNutrition(base, 2);
    expect(doubled.calories).toBe(400);
    expect(doubled.protein).toBe(20);
    expect(doubled.carbs).toBe(40);
    expect(doubled.fat).toBe(10);
    expect(doubled.micros?.['vitamin c']).toEqual({ amount: 60, unit: 'mg' });
  });

  it('does not invent missing optional fields', () => {
    const scaled = scaleNutrition({ calories: 100 }, 3);
    expect(scaled).toEqual({ calories: 300 });
    expect(scaled.protein).toBeUndefined();
  });

  it('handles fractional factors without corrupting values', () => {
    const half = scaleNutrition(base, 0.5);
    expect(half.calories).toBe(100);
    expect(half.protein).toBe(5);
  });
});

describe('sumNutrition', () => {
  it('sums calories and macros, treating missing fields as 0 when present elsewhere', () => {
    const total = sumNutrition([
      { calories: 100, protein: 10 },
      { calories: 50, carbs: 12 },
      { calories: 25 },
    ]);
    expect(total).toEqual({ calories: 175, protein: 10, carbs: 12 });
  });

  it('returns zero calories for an empty day', () => {
    expect(sumNutrition([])).toEqual({ calories: 0 });
  });

  it('merges micros with matching units', () => {
    const total = sumNutrition([
      { calories: 0, micros: { iron: { amount: 2, unit: 'mg' } } },
      { calories: 0, micros: { iron: { amount: 3, unit: 'mg' } } },
    ]);
    expect(total.micros?.iron).toEqual({ amount: 5, unit: 'mg' });
  });
});

describe('roundForDisplay', () => {
  it('rounds calories to whole numbers', () => {
    expect(roundForDisplay(123.6, 'calories')).toBe(124);
  });

  it('rounds grams to one decimal, avoiding float artifacts', () => {
    expect(roundForDisplay(0.1 + 0.2)).toBe(0.3);
    expect(roundForDisplay(7 * 1.1)).toBe(7.7);
  });
});
