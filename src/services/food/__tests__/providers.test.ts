import { createTestDb } from '@/db/__tests__/testDb';
import { createFoodRepo } from '@/repositories/foodRepo';
import { createFoodSearchService } from '../foodSearchService';
import { offProvider } from '../openFoodFacts';
import { FoodProvider, ProviderError, ProviderFood } from '../types';
import { usdaProvider } from '../usda';

const realFetch = global.fetch;
afterEach(() => {
  global.fetch = realFetch;
});

function mockFetch(payload: unknown, status = 200) {
  global.fetch = jest.fn(async () => ({
    ok: status >= 200 && status < 300,
    status,
    json: async () => payload,
  })) as unknown as typeof fetch;
}

describe('usdaProvider', () => {
  it('maps search results with per-100g and per-serving nutrition', async () => {
    mockFetch({
      foods: [
        {
          fdcId: 123,
          description: 'Cheddar Cheese',
          dataType: 'Branded',
          brandName: 'Acme',
          gtinUpc: '00012345',
          servingSize: 28,
          servingSizeUnit: 'g',
          householdServingFullText: '1 slice',
          foodNutrients: [
            { nutrientId: 1008, value: 400 },
            { nutrientId: 1003, value: 25 },
            { nutrientId: 1004, value: 33 },
            { nutrientId: 1093, value: 650 },
          ],
        },
      ],
    });
    const foods = await usdaProvider.search('cheddar');
    expect(foods).toHaveLength(1);
    const f = foods[0];
    expect(f.provider).toBe('usda');
    expect(f.isGeneric).toBe(false);
    expect(f.nutritionPer100g?.calories).toBe(400);
    expect(f.nutritionPerServing?.calories).toBeCloseTo(112); // 28 g slice
    expect(f.nutritionPerServing?.protein).toBeCloseTo(7);
    expect(f.servingLabel).toBe('1 slice');
    expect(f.barcode).toBe('00012345');
  });

  it('classifies Foundation foods as generic with 100 g serving', async () => {
    mockFetch({
      foods: [
        {
          fdcId: 9,
          description: 'Broccoli, raw',
          dataType: 'Foundation',
          foodNutrients: [{ nutrientId: 1008, value: 34 }],
        },
      ],
    });
    const foods = await usdaProvider.search('broccoli');
    expect(foods[0].isGeneric).toBe(true);
    expect(foods[0].gramsPerServing).toBe(100);
  });

  it('raises typed errors for rate limits', async () => {
    mockFetch({}, 429);
    await expect(usdaProvider.search('x')).rejects.toMatchObject({ kind: 'rate-limit' });
  });

  it('matches barcodes ignoring leading zeros', async () => {
    mockFetch({
      foods: [
        {
          fdcId: 5,
          description: 'Bar',
          dataType: 'Branded',
          gtinUpc: '00812345678906',
          foodNutrients: [{ nutrientId: 1008, value: 200 }],
        },
      ],
    });
    const f = await usdaProvider.getByBarcode('812345678906');
    expect(f?.id).toBe('5');
  });
});

describe('offProvider', () => {
  it('maps products and converts sodium/cholesterol g→mg', async () => {
    mockFetch({
      products: [
        {
          code: '3017620422003',
          product_name: 'Hazelnut spread',
          brands: 'Nutello, Other',
          image_front_small_url: 'https://img.example/x.jpg',
          serving_size: '15 g',
          serving_quantity: 15,
          nutriments: {
            'energy-kcal_100g': 539,
            proteins_100g: 6.3,
            carbohydrates_100g: 57.5,
            fat_100g: 30.9,
            sodium_100g: 0.045,
            'energy-kcal_serving': 81,
            proteins_serving: 0.9,
          },
        },
      ],
    });
    const foods = await offProvider.search('hazelnut');
    expect(foods).toHaveLength(1);
    const f = foods[0];
    expect(f.brand).toBe('Nutello');
    expect(f.nutritionPer100g?.sodium).toBeCloseTo(45); // mg
    expect(f.nutritionPerServing?.calories).toBe(81);
    expect(f.gramsPerServing).toBe(15);
  });

  it('drops products without a name or nutrition', async () => {
    mockFetch({
      products: [
        { code: '1', product_name: '', nutriments: { 'energy-kcal_100g': 100 } },
        { code: '2', product_name: 'No data', nutriments: {} },
      ],
    });
    expect(await offProvider.search('x')).toHaveLength(0);
  });

  it('returns null for unknown barcodes', async () => {
    mockFetch({ status: 0 });
    expect(await offProvider.getByBarcode('404404')).toBeNull();
  });

  it('skips search entirely for generic-only filter', async () => {
    global.fetch = jest.fn() as unknown as typeof fetch;
    expect(await offProvider.search('x', { filter: 'generic' })).toEqual([]);
    expect(global.fetch).not.toHaveBeenCalled();
  });
});

describe('foodSearchService', () => {
  const foodA: ProviderFood = {
    provider: 'usda',
    id: '1',
    name: 'Peanut Butter',
    brand: 'Acme',
    barcode: '0099',
    isGeneric: false,
    nutritionPer100g: { calories: 588 },
  };
  const foodADupe: ProviderFood = { ...foodA, provider: 'off', id: '99', barcode: '99' };
  const foodB: ProviderFood = {
    provider: 'off',
    id: '2',
    name: 'Almond Butter',
    isGeneric: false,
    nutritionPer100g: { calories: 614 },
  };

  function stubProvider(id: 'usda' | 'off', result: ProviderFood[] | Error): FoodProvider {
    return {
      id,
      search: async () => {
        if (result instanceof Error) throw result;
        return result;
      },
      getByBarcode: async () => null,
    };
  }

  it('merges providers, dedupes by barcode, caches locally', async () => {
    const repo = createFoodRepo(await createTestDb());
    const svc = createFoodSearchService(repo, [
      stubProvider('usda', [foodA]),
      stubProvider('off', [foodADupe, foodB]),
    ]);
    const res = await svc.search('butter');
    expect(res.foods.map((f) => f.id)).toEqual(['1', '2']);
    expect(res.allFailed).toBe(false);
    // Wait a tick for fire-and-forget cache, then confirm offline availability.
    await new Promise((r) => setTimeout(r, 20));
    expect(await repo.searchCached('Peanut')).toHaveLength(1);
  });

  it('reports partial failures without losing results', async () => {
    const repo = createFoodRepo(await createTestDb());
    const svc = createFoodSearchService(repo, [
      stubProvider('usda', new ProviderError('limit', 'usda', 'rate-limit')),
      stubProvider('off', [foodB]),
    ]);
    const res = await svc.search('butter');
    expect(res.foods).toHaveLength(1);
    expect(res.failures).toEqual([{ provider: 'usda', kind: 'rate-limit' }]);
    expect(res.allFailed).toBe(false);
  });

  it('flags total failure', async () => {
    const repo = createFoodRepo(await createTestDb());
    const svc = createFoodSearchService(repo, [
      stubProvider('usda', new ProviderError('x', 'usda', 'network')),
      stubProvider('off', new ProviderError('y', 'off', 'network')),
    ]);
    const res = await svc.search('butter');
    expect(res.allFailed).toBe(true);
  });

  it('barcode lookup prefers local custom foods, then cache, then providers', async () => {
    const repo = createFoodRepo(await createTestDb());
    const custom = await repo.addCustomFood({
      name: 'My bar',
      barcode: '555',
      servingQty: 1,
      servingUnit: 'piece',
      nutrition: { calories: 200 },
      favorite: false,
    });
    const svc = createFoodSearchService(repo, [stubProvider('usda', []), stubProvider('off', [])]);
    const hit = await svc.lookupBarcode('555');
    expect(hit.custom).toBe(custom.id);

    await repo.upsertCachedFood({
      provider: 'off',
      providerId: '777',
      name: 'Cached snack',
      barcode: '777',
      nutritionPer100g: { calories: 100 },
      flagged: false,
      cachedAt: new Date().toISOString(),
    });
    const cachedHit = await svc.lookupBarcode('777');
    expect(cachedHit.food?.name).toBe('Cached snack');

    const miss = await svc.lookupBarcode('000');
    expect(miss.food).toBeUndefined();
    expect(miss.custom).toBeUndefined();
  });
});
