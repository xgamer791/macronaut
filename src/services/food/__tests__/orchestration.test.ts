import { createTestDb } from '@/db/__tests__/testDb';
import { createFoodRepo } from '@/repositories/foodRepo';
import { createFoodSearchService } from '../foodSearchService';
import { FoodProvider, ProviderFood } from '../types';

function stub(id: FoodProvider['id'], search: ProviderFood[] = [], byCode: Record<string, ProviderFood> = {}): FoodProvider {
  return {
    id,
    search: async () => search,
    getByBarcode: async (code) => byCode[code] ?? null,
  };
}

describe('foodSearchService orchestration', () => {
  it('returns groups and includes restaurant + generic bundled results', async () => {
    const repo = createFoodRepo(await createTestDb());
    const svc = createFoodSearchService(repo, [
      stub('usda'),
      stub('off'),
      stub('nutritionix'),
      stub('fatsecret'),
    ]);
    const res = await svc.search('chipotle chicken');
    expect(res.groups).toBeDefined();
    expect(res.groups.restaurantFoods.length).toBeGreaterThan(0);
    expect(res.foods.some((f) => f.provider === 'restaurant')).toBe(true);
    expect(res.foods[0].confidence).toBeGreaterThan(0.5);
  });

  it('filters raw meat when query asks for cooked/grilled', async () => {
    const repo = createFoodRepo(await createTestDb());
    const raw: ProviderFood = {
      provider: 'usda',
      id: 'raw1',
      name: 'Chicken breast, raw',
      isGeneric: true,
      preparationState: 'raw',
      category: 'generic',
      nutritionPer100g: { calories: 120, protein: 22, carbs: 0, fat: 3 },
      gramsPerServing: 100,
    };
    const grilled: ProviderFood = {
      provider: 'usda',
      id: 'g1',
      name: 'Chicken breast, grilled',
      isGeneric: true,
      preparationState: 'grilled',
      category: 'generic',
      nutritionPer100g: { calories: 165, protein: 31, carbs: 0, fat: 3.6 },
      gramsPerServing: 100,
    };
    const svc = createFoodSearchService(repo, [
      stub('usda', [raw, grilled]),
      stub('off'),
      stub('nutritionix'),
      stub('fatsecret'),
    ]);
    const res = await svc.search('grilled chicken breast');
    expect(res.foods.some((f) => f.id === 'raw1')).toBe(false);
    expect(res.foods.some((f) => f.id === 'g1' || f.name.toLowerCase().includes('grilled'))).toBe(true);
  });

  it('barcode pipeline prefers exact barcode match and sets autoSelected when high', async () => {
    const repo = createFoodRepo(await createTestDb());
    const hit: ProviderFood = {
      provider: 'nutritionix',
      id: 'nix',
      name: 'Protein Shake',
      barcode: '036632072238',
      isGeneric: false,
      category: 'packaged',
      verified: true,
      nutritionPerServing: { calories: 160, protein: 30, carbs: 5, fat: 2 },
      gramsPerServing: 325,
    };
    const svc = createFoodSearchService(repo, [
      stub('usda'),
      stub('off'),
      stub('nutritionix', [], { '036632072238': hit }),
      stub('fatsecret'),
    ]);
    const res = await svc.lookupBarcode('036632072238');
    expect(res.food?.id).toBe('nix');
    expect(res.groups?.bestMatch?.id).toBe('nix');
    expect(res.lowConfidence).toBe(false);
  });

  it('includes user-submitted custom foods in My Foods group', async () => {
    const repo = createFoodRepo(await createTestDb());
    const created = await repo.addCustomFood({
      name: 'Gym Protein Shake',
      brand: 'Homemade',
      barcode: '0123456789012',
      servingQty: 1,
      servingUnit: 'serving',
      gramsPerServing: 350,
      nutrition: { calories: 220, protein: 40, carbs: 8, fat: 3 },
      favorite: true,
    });
    const svc = createFoodSearchService(repo, [
      stub('usda'),
      stub('off'),
      stub('nutritionix'),
      stub('fatsecret'),
    ]);
    const res = await svc.search('protein shake');
    expect(res.groups.myFoods.some((f) => f.id === created.id)).toBe(true);
    expect(res.foods.some((f) => f.provider === 'custom' && f.id === created.id)).toBe(true);

    const byCode = await svc.lookupBarcode('0123456789012');
    expect(byCode.custom).toBe(created.id);
    expect(byCode.autoSelected).toBe(true);
  });

  it('prefetchLikely returns bundled hits without network providers', async () => {
    const repo = createFoodRepo(await createTestDb());
    const svc = createFoodSearchService(repo, []);
    const foods = await svc.prefetchLikely('big mac');
    expect(foods.some((f) => f.provider === 'restaurant')).toBe(true);
  });

  it('autoSelected only when confidence is high', async () => {
    const repo = createFoodRepo(await createTestDb());
    const svc = createFoodSearchService(repo, [
      stub('usda'),
      stub('off'),
      stub('nutritionix'),
      stub('fatsecret'),
    ]);
    const res = await svc.search('chicken breast');
    if (res.autoSelected) {
      expect(res.autoSelected.confidence ?? 0).toBeGreaterThanOrEqual(0.8);
    }
    expect(res.groups.bestMatch).toBeTruthy();
  });
});
