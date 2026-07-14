import { readFileSync } from 'fs';
import { join } from 'path';
import { portionNutrition } from '@/domain/serving';
import { MACRO_KEYS } from '@/domain/types';
import { getGenericFood, searchGenericFoods } from '../genericFoods';
import { VERIFIED_GENERIC_FOODS } from '../genericFoods.data';

/** The committed source snapshot: verbatim nutrient amounts extracted from
 * the USDA SR Legacy 2021-10-28 release, keyed by FDC nutrient id. */
const snapshot: {
  records: { fdcId: number; description: string; nutrients: Record<string, number> }[];
} = JSON.parse(
  readFileSync(join(__dirname, '../../../../docs/generic-foods-source.json'), 'utf8'),
);

const CORE: Record<string, string> = {
  1008: 'calories',
  1003: 'protein',
  1005: 'carbs',
  1004: 'fat',
  1079: 'fiber',
  2000: 'sugar',
  1093: 'sodium',
  1253: 'cholesterol',
};
const MICRO: Record<string, string> = {
  1092: 'potassium',
  1089: 'iron',
  1087: 'calcium',
  1090: 'magnesium',
  1095: 'zinc',
  1178: 'vitamin B12',
  1175: 'vitamin B6',
  1162: 'vitamin C',
  1114: 'vitamin D',
  1106: 'vitamin A',
};

describe('verified generic foods — every value matches the USDA source record', () => {
  it('covers all entries with a source record and exact attribution', () => {
    expect(VERIFIED_GENERIC_FOODS.length).toBeGreaterThanOrEqual(50);
    for (const e of VERIFIED_GENERIC_FOODS) {
      const rec = snapshot.records.find((r) => r.fdcId === e.fdcId);
      expect(rec).toBeDefined();
      expect(e.srDescription).toBe(rec!.description);
      expect(e.ndbNumber).toBeGreaterThan(0);
      expect(e.prep.length).toBeGreaterThan(0);
    }
  });

  it.each(VERIFIED_GENERIC_FOODS.map((e) => [e.id, e] as const))(
    '%s matches USDA values verbatim',
    (_id, e) => {
      const rec = snapshot.records.find((r) => r.fdcId === e.fdcId)!;
      for (const [nid, field] of Object.entries(CORE)) {
        const src = rec.nutrients[nid];
        if (src === undefined) continue;
        const stored = field === 'calories' ? e.n.calories : e.n[field as (typeof MACRO_KEYS)[number]];
        expect(stored).toBe(src); // verbatim — no rounding, no estimating
      }
      for (const [nid, name] of Object.entries(MICRO)) {
        const src = rec.nutrients[nid];
        if (src === undefined) continue;
        expect(e.n.micros?.[name]?.amount).toBe(src);
      }
    },
  );
});

describe('weight-based scaling derives from exact per-100g values', () => {
  const braised = VERIFIED_GENERIC_FOODS.find((e) => e.id === 'chicken-breast-braised')!;
  const food = getGenericFood('chicken-breast-braised')!;
  const info = {
    nutritionPerServing: food.nutritionPerServing!,
    gramsPerServing: food.gramsPerServing,
    servingLabel: food.servingLabel,
  };

  it.each([100, 150, 250, 500])('%s g scales every nutrient exactly', (grams) => {
    const n = portionNutrition(grams, 'g', info);
    const k = grams / 100;
    expect(n.calories).toBeCloseTo(braised.n.calories * k, 10);
    expect(n.protein).toBeCloseTo(braised.n.protein! * k, 10);
    expect(n.fat).toBeCloseTo(braised.n.fat! * k, 10);
    expect(n.cholesterol).toBeCloseTo(braised.n.cholesterol! * k, 10);
    expect(n.micros?.potassium.amount).toBeCloseTo(braised.n.micros!.potassium.amount * k, 10);
    expect(n.micros?.iron.amount).toBeCloseTo(braised.n.micros!.iron.amount * k, 10);
  });

  it('1 lb converts through exact grams (453.59237)', () => {
    const n = portionNutrition(1, 'lb', info);
    const k = 453.59237 / 100;
    expect(n.calories).toBeCloseTo(braised.n.calories * k, 8);
    expect(n.protein).toBeCloseTo(braised.n.protein! * k, 8);
  });

  it('the user-reported case: 11 oz of braised breast ≈ 490 kcal / 100 g protein', () => {
    const n = portionNutrition(11, 'oz', info);
    // 11 oz = 311.84 g → 157 kcal/100 g × 3.1184 = 489.6 kcal, 32.1 P → 100.1 g
    expect(n.calories).toBeCloseTo(489.6, 0);
    expect(n.protein).toBeCloseTo(100.1, 0);
    expect(n.fat).toBeCloseTo(10.1, 0);
  });
});

describe('preparation states are distinct entries, never merged', () => {
  it('chicken breast has raw, braised, grilled and roasted variants', () => {
    const ids = VERIFIED_GENERIC_FOODS.filter((e) => e.id.startsWith('chicken-breast')).map(
      (e) => e.prep,
    );
    expect(ids).toEqual(
      expect.arrayContaining(['raw', 'cooked, braised', 'cooked, grilled', 'cooked, roasted']),
    );
  });

  it('ground beef keeps each lean percentage separate', () => {
    const gb = VERIFIED_GENERIC_FOODS.filter((e) => e.id.startsWith('ground-beef'));
    expect(gb.length).toBeGreaterThanOrEqual(5);
    const kcals = new Set(gb.map((e) => e.n.calories));
    expect(kcals.size).toBe(gb.length); // all differ — nothing averaged
  });

  it('search returns results for every requested category', () => {
    for (const q of [
      'chicken',
      'chicken breast',
      'steak',
      'beef',
      'turkey',
      'salmon',
      'shrimp',
      'scallops',
      'crab',
      'lobster',
      'eggs',
      'egg whites',
    ]) {
      expect(searchGenericFoods(q).length).toBeGreaterThan(0);
    }
  });
});
