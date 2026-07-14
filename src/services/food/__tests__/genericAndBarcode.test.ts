import { createTestDb } from '@/db/__tests__/testDb';
import { createFoodRepo } from '@/repositories/foodRepo';
import { barcodeVariants, createFoodSearchService } from '../foodSearchService';
import { getGenericFood, searchGenericFoods } from '../genericFoods';
import { FoodProvider, ProviderFood } from '../types';

describe('generic foods dataset', () => {
  it('always finds common meats', () => {
    for (const q of [
      'chicken breast',
      'chicken tenderloin',
      'chicken thigh',
      'ground turkey',
      'ground beef',
      'sirloin steak',
      'ribeye',
      'pork chop',
      'salmon',
      'shrimp',
      'tilapia',
      'egg whites',
    ]) {
      const results = searchGenericFoods(q);
      expect(results.length).toBeGreaterThan(0);
    }
  });

  it('ranks exact alias matches first', () => {
    const r = searchGenericFoods('chicken breast');
    expect(r[0].name.toLowerCase()).toContain('chicken breast');
    expect(searchGenericFoods('ribeye')[0].name).toContain('Ribeye');
  });

  it('entries are weight-based (per 100 g) so portions recalculate by grams', () => {
    const f = searchGenericFoods('chicken breast')[0];
    expect(f.gramsPerServing).toBe(100);
    expect(f.nutritionPer100g?.calories).toBeGreaterThan(0);
    expect(f.provider).toBe('local');
  });

  it('does not match unrelated queries', () => {
    expect(searchGenericFoods('nutella hazelnut spread')).toHaveLength(0);
  });

  it('resolves by id for the detail screen', () => {
    expect(getGenericFood('chicken-breast-raw')?.name).toContain('Chicken breast');
    expect(getGenericFood('nope')).toBeNull();
  });
});

describe('barcodeVariants', () => {
  it('generates common re-encodings', () => {
    expect(barcodeVariants('096619348656')).toEqual(
      expect.arrayContaining(['096619348656', '96619348656', '0096619348656']),
    );
    expect(barcodeVariants('0096619348656')).toEqual(expect.arrayContaining(['96619348656']));
  });

  it('strips non-digits and handles empty input', () => {
    expect(barcodeVariants('  ')).toEqual([]);
    expect(barcodeVariants('30-1762-0422003')).toContain('3017620422003');
  });
});

describe('search ranking + barcode fan-out', () => {
  const branded: ProviderFood = {
    provider: 'off',
    id: 'b1',
    name: 'Chicken Breast Strips Frozen Meal',
    brand: 'MegaCorp',
    isGeneric: false,
    imageUrl: 'https://img/x.jpg',
    nutritionPer100g: { calories: 180 },
  };

  const stub = (id: 'usda' | 'off', search: ProviderFood[], byCode: ProviderFood | null): FoodProvider => ({
    id,
    search: async () => search,
    getByBarcode: async (code) => (byCode && code === byCode.barcode ? byCode : null),
  });

  it('bundled generics rank above branded results for ingredient queries', async () => {
    const repo = createFoodRepo(await createTestDb());
    const svc = createFoodSearchService(repo, [stub('off', [branded], null)]);
    const res = await svc.search('chicken breast');
    expect(res.foods[0].provider).toBe('local');
    expect(res.foods.some((f) => f.id === 'b1')).toBe(true);
  });

  it('generics still appear when every provider fails', async () => {
    const repo = createFoodRepo(await createTestDb());
    const failing: FoodProvider = {
      id: 'usda',
      search: async () => {
        throw new Error('down');
      },
      getByBarcode: async () => null,
    };
    const res = await svc(repo, [failing]).search('chicken breast');
    expect(res.allFailed).toBe(true);
    expect(res.foods.length).toBeGreaterThan(0);
    expect(res.foods[0].provider).toBe('local');

    function svc(r: ReturnType<typeof createFoodRepo>, p: FoodProvider[]) {
      return createFoodSearchService(r, p);
    }
  });

  it('barcode lookup matches variant encodings across providers in parallel', async () => {
    const repo = createFoodRepo(await createTestDb());
    const eggWhites: ProviderFood = {
      provider: 'usda',
      id: 'kirkland-1',
      name: 'Kirkland Signature Egg Whites',
      brand: 'Kirkland Signature',
      barcode: '96619348656', // stored without leading zero
      isGeneric: false,
      nutritionPerServing: { calories: 25, protein: 5 },
    };
    const svc = createFoodSearchService(repo, [
      stub('usda', [], eggWhites),
      stub('off', [], null),
    ]);
    // Scanned as UPC-A with leading zero — variant matching finds it.
    const hit = await svc.lookupBarcode('096619348656');
    expect(hit.food?.name).toContain('Kirkland');
  });

  it('returns best match first with remaining candidates', async () => {
    const repo = createFoodRepo(await createTestDb());
    const offHit: ProviderFood = {
      provider: 'off',
      id: 'o1',
      name: 'Egg Whites',
      barcode: '11122233344',
      isGeneric: false,
      imageUrl: 'https://img/e.jpg',
      nutritionPerServing: { calories: 25 },
    };
    const usdaHit: ProviderFood = {
      provider: 'usda',
      id: 'u1',
      name: 'EGG WHITES',
      barcode: '11122233345', // different code → not deduped
      isGeneric: false,
      nutritionPerServing: { calories: 26 },
    };
    const both: FoodProvider[] = [
      { id: 'usda', search: async () => [], getByBarcode: async () => usdaHit },
      { id: 'off', search: async () => [], getByBarcode: async () => offHit },
    ];
    const svc = createFoodSearchService(repo, both);
    const hit = await svc.lookupBarcode('11122233344');
    expect(hit.food?.provider).toBe('off'); // barcode-native + image wins
    expect(hit.candidates?.length).toBeGreaterThan(0);
  });
});
