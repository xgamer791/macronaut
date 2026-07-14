import { createTestDb } from '@/db/__tests__/testDb';
import { createFoodRepo } from '@/repositories/foodRepo';
import { scoreConfidence, LOW_CONFIDENCE } from '../confidence';
import { createFoodSearchService } from '../foodSearchService';
import { mergeBestImage, nutritionAgrees } from '../merge';
import { normalizeFood, resolvePerServing } from '../normalize';
import { validateNutrition } from '../nutritionValidation';
import { parseServing, servingReferenceGrams } from '../servingParser';
import { FoodProvider, ProviderFood } from '../types';
import { webFoodLookup } from '../webFallback';

describe('NutritionValidationService', () => {
  it('passes a normal food', () => {
    const r = validateNutrition({ calories: 165, protein: 31, carbs: 0, fat: 3.6 }, 100);
    expect(r.severity).toBe('ok');
    expect(r.warnings).toHaveLength(0);
  });

  it('flags the Oikos-style case: 106 g protein in 355 ml is impossible for a liquid', () => {
    // Self-consistent numbers (calories ≈ macros), so only a liquid-aware
    // density check catches it: 29.8 g protein / 100 ml is impossible.
    const r = validateNutrition(
      { calories: 604, protein: 106, carbs: 28.4, fat: 12.4, fiber: 17.8 },
      355,
      { isLiquid: true },
    );
    expect(r.warnings).toContain('protein-implausible');
    expect(r.severity).toBe('suspect');
  });

  it('rejects macros that outweigh the serving', () => {
    const r = validateNutrition({ calories: 400, protein: 60, carbs: 60, fat: 10 }, 100);
    expect(r.warnings).toContain('macro-mass-exceeds-serving');
    expect(r.severity).toBe('suspect');
  });

  it('rejects impossible calorie density', () => {
    const r = validateNutrition({ calories: 1500, protein: 10, carbs: 10, fat: 10 }, 100);
    expect(r.warnings).toContain('impossible-calorie-density');
    expect(r.severity).toBe('suspect');
  });

  it('flags calorie/macro mismatch (wrong serving basis)', () => {
    // Macros say ~150 kcal but calories claim 600 → basis mismatch.
    const r = validateNutrition({ calories: 600, protein: 10, carbs: 20, fat: 3 }, 100);
    expect(r.warnings).toContain('calorie-macro-mismatch');
    expect(r.macroCalorieDelta).toBeGreaterThan(0.3);
  });

  it('flags negative values and fiber > carbs', () => {
    expect(validateNutrition({ calories: -5 }, 100).warnings).toContain('negative-values');
    expect(
      validateNutrition({ calories: 100, carbs: 5, fiber: 12 }, 100).warnings,
    ).toContain('fiber-exceeds-carbs');
  });

  it('flags missing calories when macros imply energy', () => {
    const r = validateNutrition({ calories: 0, protein: 20, carbs: 0, fat: 5 }, 100);
    expect(r.warnings).toContain('missing-calories');
    expect(r.severity).toBe('suspect');
  });

  it('flags missing macros clearly', () => {
    const r = validateNutrition({ calories: 100, protein: 10 }, 100);
    expect(r.warnings).toContain('missing-macros');
    expect(r.warnings).toContain('incomplete-nutrition');
  });

  it('marks large calorie/macro discrepancies as suspect (no auto-approve)', () => {
    const r = validateNutrition({ calories: 600, protein: 10, carbs: 20, fat: 3 }, 100);
    expect(r.warnings).toContain('calorie-macro-mismatch');
    expect(r.severity).toBe('suspect');
  });

  it('flags implausible protein per 100 g', () => {
    const r = validateNutrition({ calories: 400, protein: 95, carbs: 0, fat: 0 }, 100);
    expect(r.warnings).toContain('protein-implausible');
  });
});

describe('ServingParserService', () => {
  it('parses grams', () => {
    expect(parseServing('46 g (1/4 cup)').grams).toBe(46);
  });
  it('parses millilitres and bottles', () => {
    const p = parseServing('1 bottle (355 ml)');
    expect(p.ml).toBe(355);
    expect(p.isContainer).toBe(true);
    expect(p.basis).toBe('container');
  });
  it('parses scoops with a gram amount', () => {
    expect(parseServing('2 scoops (60 g)').grams).toBe(60);
  });
  it('converts fluid ounces to ml', () => {
    expect(parseServing('8 fl oz').ml).toBeCloseTo(236.6, 0);
  });
  it('converts ounces to grams', () => {
    expect(parseServing('4 oz').grams).toBeCloseTo(113.4, 0);
  });
  it('trusts OFF structured quantity+unit', () => {
    expect(parseServing(undefined, 30, 'g').grams).toBe(30);
    expect(parseServing(undefined, 240, 'ml').ml).toBe(240);
  });
  it('handles cups/tbsp/tsp volumes', () => {
    expect(parseServing('1 cup').ml).toBe(240);
    expect(parseServing('1 tbsp').ml).toBe(15);
  });
  it('reference grams treats ml as grams', () => {
    expect(servingReferenceGrams(parseServing('1 bottle (355 ml)'))).toBe(355);
  });
});

describe('NutritionNormalizationService', () => {
  it('never treats per-100 g as per-serving; scales correctly', () => {
    const per100 = resolvePerServing(undefined, { calories: 160, protein: 30 }, 40);
    expect(per100?.calories).toBeCloseTo(64); // 40 g serving
  });
  it('uses the provider per-serving panel verbatim when given', () => {
    const ns = resolvePerServing({ calories: 150, protein: 25 }, { calories: 375 }, 40);
    expect(ns?.calories).toBe(150); // not rescaled
  });
  it('normalizes an OFF food and records the basis', () => {
    const raw: ProviderFood = {
      provider: 'off',
      id: 'x',
      name: 'Shake',
      isGeneric: false,
      nutritionPerServing: { calories: 150, protein: 30, carbs: 5, fat: 2 },
      nutritionPer100g: { calories: 42, protein: 8.5 },
      gramsPerServing: 355,
      servingUnit: 'ml',
      servingLabel: '1 bottle (355 ml)',
    };
    const nf = normalizeFood(raw, { servingSize: raw.servingLabel, servingQuantity: 355, servingUnit: 'ml' });
    expect(nf.servingBasis).toBe('container');
    expect(nf.perServing?.calories).toBe(150);
  });
});

describe('FoodConfidenceService', () => {
  const mk = (over: Partial<ProviderFood>): ProviderFood => ({
    provider: 'off',
    id: '1',
    name: 'X',
    isGeneric: false,
    nutritionPerServing: { calories: 100, protein: 5, carbs: 10, fat: 3 },
    gramsPerServing: 100,
    ...over,
  });

  it('curated sources score higher than crowd-sourced', () => {
    const usda = scoreConfidence(normalizeFood(mk({ provider: 'usda' }))).score;
    const off = scoreConfidence(normalizeFood(mk({ provider: 'off' }))).score;
    expect(usda).toBeGreaterThan(off);
  });

  it('a barcode match raises confidence', () => {
    const nf = normalizeFood(mk({ barcode: '096619833252' }));
    const withMatch = scoreConfidence(nf, { scannedBarcode: '096619833252' }).score;
    const without = scoreConfidence(nf).score;
    expect(withMatch).toBeGreaterThan(without);
  });

  it('a suspect panel collapses confidence below the review bar', () => {
    const nf = normalizeFood(mk({ nutritionPerServing: { calories: 900, protein: 80, carbs: 80, fat: 40 }, gramsPerServing: 100 }));
    expect(scoreConfidence(nf).score).toBeLessThan(LOW_CONFIDENCE);
  });
});

describe('data merging', () => {
  const base = normalizeFood({ provider: 'usda', id: 'u', name: 'Egg Whites', brand: 'Kirkland', barcode: '096619833252', isGeneric: false, nutritionPer100g: { calories: 52, protein: 11 }, gramsPerServing: 46 });
  const withImage = normalizeFood({ provider: 'off', id: 'o', name: 'Egg Whites', brand: 'Kirkland', barcode: '96619833252', isGeneric: false, imageUrl: 'https://img/e.jpg', nutritionPerServing: { calories: 25, protein: 5 }, gramsPerServing: 46 });

  it('borrows an image from a same-identity result', () => {
    const { food, imageFrom } = mergeBestImage(base, [base, withImage]);
    expect(food.imageUrl).toBe('https://img/e.jpg');
    expect(imageFrom).toBe('off');
  });

  it('never borrows from an unrelated product', () => {
    const other = normalizeFood({ provider: 'off', id: 'z', name: 'Cola', brand: 'SodaCo', barcode: '111', isGeneric: false, imageUrl: 'https://img/c.jpg', nutritionPer100g: { calories: 42 } });
    const { food } = mergeBestImage(base, [base, other]);
    expect(food.imageUrl).toBeUndefined();
  });

  it('detects nutrition agreement on a per-100g basis', () => {
    const a = normalizeFood({ provider: 'usda', id: 'a', name: 'Oats', isGeneric: true, nutritionPer100g: { calories: 380 } });
    const b = normalizeFood({ provider: 'off', id: 'b', name: 'Oats', isGeneric: false, nutritionPer100g: { calories: 400 } });
    const c = normalizeFood({ provider: 'off', id: 'c', name: 'Oats', isGeneric: false, nutritionPer100g: { calories: 900 } });
    expect(nutritionAgrees(a, b)).toBe(true);
    expect(nutritionAgrees(a, c)).toBe(false);
  });
});

describe('barcode lookup accuracy (end to end)', () => {
  const provider = (id: 'usda' | 'off', byCode: Record<string, ProviderFood>): FoodProvider => ({
    id,
    search: async () => [],
    getByBarcode: async (code) => byCode[code] ?? null,
  });

  it('an exact-barcode match outranks a higher-trust name collision', async () => {
    const repo = createFoodRepo(await createTestDb());
    const offReal: ProviderFood = {
      provider: 'off',
      id: 'off-real',
      name: 'Oikos Pro Shake',
      brand: 'Oikos',
      barcode: '036632072238',
      isGeneric: false,
      imageUrl: 'https://img/o.jpg',
      nutritionPerServing: { calories: 190, protein: 30, carbs: 12, fat: 2.5 },
      gramsPerServing: 355,
      servingUnit: 'ml',
    };
    const usdaCollision: ProviderFood = {
      provider: 'usda',
      id: 'usda-x',
      name: 'Yogurt drink',
      barcode: '999999999999', // does NOT match the scan
      isGeneric: false,
      nutritionPerServing: { calories: 120, protein: 8 },
      gramsPerServing: 100,
    };
    const svc = createFoodSearchService(repo, [
      provider('usda', { '036632072238': usdaCollision }),
      provider('off', { '036632072238': offReal }),
    ]);
    const hit = await svc.lookupBarcode('036632072238');
    expect(hit.food?.id).toBe('off-real'); // the record carrying the barcode wins
  });

  it('flags a barcode result that fails validation as low confidence', async () => {
    const repo = createFoodRepo(await createTestDb());
    const garbage: ProviderFood = {
      provider: 'off',
      id: 'bad',
      name: 'Mystery',
      barcode: '111222333444',
      isGeneric: false,
      // macros outweigh the serving → suspect
      nutritionPerServing: { calories: 900, protein: 80, carbs: 80, fat: 40 },
      gramsPerServing: 100,
      servingUnit: 'g',
    };
    const svc = createFoodSearchService(repo, [
      provider('usda', {}),
      provider('off', { '111222333444': garbage }),
    ]);
    const hit = await svc.lookupBarcode('111222333444');
    expect(hit.food).toBeDefined();
    expect(hit.lowConfidence).toBe(true);
    expect(hit.food?.warnings?.length).toBeGreaterThan(0);
  });

  it('a flagged cached food is re-queried live instead of reused', async () => {
    const repo = createFoodRepo(await createTestDb());
    await repo.upsertCachedFood({
      provider: 'off',
      providerId: 'stale',
      name: 'Stale bad data',
      barcode: '222333444555',
      nutritionPerServing: { calories: 190, protein: 30 },
      gramsPerServing: 40,
      flagged: true, // user reported it
      confidence: 0.8,
      cachedAt: new Date().toISOString(),
    });
    const fresh: ProviderFood = {
      provider: 'usda',
      id: 'fresh',
      name: 'Fresh good data',
      barcode: '222333444555',
      isGeneric: false,
      nutritionPerServing: { calories: 25, protein: 5 },
      gramsPerServing: 46,
    };
    const svc = createFoodSearchService(repo, [
      provider('usda', { '222333444555': fresh }),
      provider('off', {}),
    ]);
    const hit = await svc.lookupBarcode('222333444555');
    expect(hit.food?.id).toBe('fresh'); // not the flagged cache
  });
});

describe('search ranking with confidence', () => {
  it('generics lead ingredient searches; branded stay reachable', async () => {
    const repo = createFoodRepo(await createTestDb());
    const branded: ProviderFood = {
      provider: 'off',
      id: 'b',
      name: 'Chicken Breast Ready Meal',
      brand: 'MegaCorp',
      isGeneric: false,
      nutritionPer100g: { calories: 180, protein: 12, carbs: 15, fat: 8 },
      gramsPerServing: 300,
    };
    const svc = createFoodSearchService(repo, [
      { id: 'usda', search: async () => [], getByBarcode: async () => null },
      { id: 'off', search: async () => [branded], getByBarcode: async () => null },
    ]);
    const res = await svc.search('chicken breast');
    expect(res.foods[0].provider).toBe('local');
    expect(res.foods.some((f) => f.id === 'b')).toBe(true);
    expect(res.foods[0].confidence).toBeGreaterThan(0.8);
  });
});

describe('WebFoodLookupService', () => {
  it('builds a barcode-first search url', () => {
    const url = webFoodLookup.searchUrl({ barcode: '096619833252', name: 'Egg Whites', brand: 'Kirkland' });
    expect(url).toContain('096619833252');
    expect(url).toContain('nutrition');
  });
  it('client lookup returns null (no fabricated data)', async () => {
    expect(await webFoodLookup.lookup({ barcode: '1' })).toBeNull();
  });
});
