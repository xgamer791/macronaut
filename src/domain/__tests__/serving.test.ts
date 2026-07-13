import { availableUnits, describePortion, FoodPortionInfo, portionNutrition, toServings } from '../serving';

const oatmeal: FoodPortionInfo = {
  nutritionPerServing: { calories: 150, protein: 5, carbs: 27, fat: 3 },
  gramsPerServing: 40, // 1 serving = 40 g dry oats
  servingLabel: '1/2 cup dry',
};

describe('toServings', () => {
  it('weight conversions are exact', () => {
    expect(toServings(80, 'g', oatmeal)).toBe(2);
    expect(toServings(0.04, 'kg', oatmeal)).toBeCloseTo(1);
    expect(toServings(1, 'oz', oatmeal)).toBeCloseTo(28.349523125 / 40);
    expect(toServings(1, 'lb', oatmeal)).toBeCloseTo(453.59237 / 40);
  });

  it('volume converts through density (default 1 g/ml)', () => {
    expect(toServings(40, 'ml', oatmeal)).toBeCloseTo(1);
    expect(toServings(1, 'cup', oatmeal)).toBeCloseTo(240 / 40);
    expect(toServings(1, 'tbsp', oatmeal)).toBeCloseTo(15 / 40);
    expect(toServings(1, 'tsp', oatmeal)).toBeCloseTo(5 / 40);
  });

  it('respects a custom density', () => {
    const oil = { ...oatmeal, density: 0.92 };
    expect(toServings(100, 'ml', oil)).toBeCloseTo((100 * 0.92) / 40);
  });

  it('count units map 1:1 to servings', () => {
    expect(toServings(3, 'serving', oatmeal)).toBe(3);
    expect(toServings(2, 'piece', oatmeal)).toBe(2);
  });

  it('throws for weight/volume without gram info', () => {
    const noGrams: FoodPortionInfo = { nutritionPerServing: { calories: 100 } };
    expect(() => toServings(50, 'g', noGrams)).toThrow();
    expect(() => toServings(1, 'cup', noGrams)).toThrow();
  });

  it('rejects negative quantities', () => {
    expect(() => toServings(-1, 'g', oatmeal)).toThrow();
  });
});

describe('portionNutrition', () => {
  it('scales nutrition by the converted serving count', () => {
    const n = portionNutrition(80, 'g', oatmeal);
    expect(n.calories).toBe(300);
    expect(n.protein).toBe(10);
  });

  it('handles fractional portions without float display bugs downstream', () => {
    const n = portionNutrition(60, 'g', oatmeal); // 1.5 servings
    expect(n.calories).toBeCloseTo(225);
    expect(n.carbs).toBeCloseTo(40.5);
  });
});

describe('availableUnits', () => {
  it('offers all units when grams are known', () => {
    expect(availableUnits(oatmeal)).toContain('g');
    expect(availableUnits(oatmeal)).toContain('cup');
  });

  it('offers only count units without gram info', () => {
    const units = availableUnits({ nutritionPerServing: { calories: 1 } });
    expect(units).toContain('serving');
    expect(units).not.toContain('g');
    expect(units).not.toContain('cup');
  });
});

describe('describePortion', () => {
  it('describes servings with the food label', () => {
    expect(describePortion(2, 'serving', oatmeal)).toBe('2 × 1/2 cup dry');
  });

  it('describes weight with gram equivalent', () => {
    expect(describePortion(1, 'oz', oatmeal)).toBe('1 oz (28.35 g)');
  });
});
