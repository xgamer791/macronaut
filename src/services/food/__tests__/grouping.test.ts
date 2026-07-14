import { dedupeByIdentity, foodIdentityKey, groupRankedFoods } from '../grouping';
import { RankedFood } from '../ranking';
import { ProviderFood } from '../types';

const ranked = (food: ProviderFood, score = 0.9): RankedFood => ({
  food,
  score,
  level: score >= 0.95 ? 'verified' : score >= 0.8 ? 'high' : score >= 0.6 ? 'review' : 'low',
  reasons: [],
  autoSelect: score >= 0.8,
});

describe('foodIdentityKey', () => {
  it('uses barcode canonical form', () => {
    const a = foodIdentityKey({
      provider: 'off',
      id: '1',
      name: 'Bar',
      barcode: '096619348656',
      isGeneric: false,
    });
    const b = foodIdentityKey({
      provider: 'usda',
      id: '2',
      name: 'Bar',
      barcode: '0096619348656',
      isGeneric: false,
    });
    expect(a).toBe(b);
  });

  it('includes prep in name identity', () => {
    const raw = foodIdentityKey({
      provider: 'usda',
      id: '1',
      name: 'Chicken breast, raw',
      isGeneric: true,
      preparationState: 'raw',
    });
    const cooked = foodIdentityKey({
      provider: 'usda',
      id: '2',
      name: 'Chicken breast, cooked',
      isGeneric: true,
      preparationState: 'cooked',
    });
    expect(raw).not.toBe(cooked);
  });
});

describe('groupRankedFoods', () => {
  it('dedupes and buckets by category', () => {
    const chicken1: ProviderFood = {
      provider: 'local',
      id: 'c1',
      name: 'Chicken breast, grilled',
      isGeneric: true,
      category: 'generic',
      nutritionPer100g: { calories: 165, protein: 31, carbs: 0, fat: 3.6 },
    };
    const chicken2: ProviderFood = {
      provider: 'usda',
      id: 'c2',
      name: 'Chicken breast, grilled',
      isGeneric: true,
      category: 'generic',
      nutritionPer100g: { calories: 170, protein: 30, carbs: 0, fat: 4 },
    };
    const packaged: ProviderFood = {
      provider: 'off',
      id: 'p1',
      name: 'Chicken Strips',
      brand: 'MegaCorp',
      isGeneric: false,
      category: 'packaged',
      barcode: '111222333444',
      nutritionPerServing: { calories: 250, protein: 20, carbs: 15, fat: 10 },
    };
    const restaurant: ProviderFood = {
      provider: 'restaurant',
      id: 'r1',
      name: 'Chicken Bowl',
      restaurant: 'Chipotle',
      isGeneric: false,
      category: 'restaurant',
      nutritionPerServing: { calories: 540, protein: 45, carbs: 40, fat: 20 },
    };
    const custom: ProviderFood = {
      provider: 'local',
      id: 'my1',
      name: 'My chicken mix',
      isGeneric: false,
      category: 'custom',
      nutritionPerServing: { calories: 200, protein: 25, carbs: 5, fat: 8 },
    };

    const groups = groupRankedFoods([
      ranked(chicken1, 0.96),
      ranked(chicken2, 0.9),
      ranked(packaged, 0.7),
      ranked(restaurant, 0.88),
      ranked(custom, 0.95),
    ]);

    expect(groups.bestMatch?.id).toBe('c1');
    // chicken2 deduped away (same name+prep)
    expect(groups.usdaWholeFoods.map((f) => f.id)).toEqual(['c1']);
    expect(groups.packagedFoods.map((f) => f.id)).toEqual(['p1']);
    expect(groups.restaurantFoods.map((f) => f.id)).toEqual(['r1']);
    expect(groups.myFoods.map((f) => f.id)).toEqual(['my1']);
  });

  it('dedupeByIdentity keeps best first', () => {
    const a = ranked(
      {
        provider: 'off',
        id: 'a',
        name: 'Cola',
        barcode: '0123456789012',
        isGeneric: false,
      },
      0.9,
    );
    const b = ranked(
      {
        provider: 'usda',
        id: 'b',
        name: 'Cola',
        barcode: '123456789012',
        isGeneric: false,
      },
      0.7,
    );
    expect(dedupeByIdentity([a, b])).toHaveLength(1);
    expect(dedupeByIdentity([a, b])[0].food.id).toBe('a');
  });
});
