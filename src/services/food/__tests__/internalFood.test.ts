import { toInternalFood } from '../internalFood';
import { normalizeFood } from '../normalize';
import { ProviderFood } from '../types';

describe('toInternalFood', () => {
  const raw: ProviderFood = {
    provider: 'usda',
    id: '171077',
    name: 'Chicken, broilers or fryers, breast, meat only, cooked, grilled',
    isGeneric: true,
    nutritionPer100g: {
      calories: 165,
      protein: 31,
      carbs: 0,
      fat: 3.6,
      saturatedFat: 1.0,
      fiber: 0,
      sugar: 0,
      sodium: 74,
    },
    gramsPerServing: 100,
    servingLabel: '100 g',
    preparationState: 'grilled',
    verified: true,
    lastVerified: '2026-01-15T00:00:00Z',
    category: 'generic',
    dataType: 'SR Legacy',
  };

  it('maps provider food fields into InternalFood', () => {
    const internal = toInternalFood(raw, { confidence: 0.96 });
    expect(internal.id).toBe('usda:171077');
    expect(internal.name).toContain('Chicken');
    expect(internal.preparationState).toBe('grilled');
    expect(internal.servingWeightGrams).toBe(100);
    expect(internal.calories).toBe(165);
    expect(internal.protein).toBe(31);
    expect(internal.carbohydrates).toBe(0);
    expect(internal.saturatedFat).toBe(1);
    expect(internal.caloriesPer100g).toBe(165);
    expect(internal.proteinPer100g).toBe(31);
    expect(internal.source).toBe('usda');
    expect(internal.confidenceScore).toBe(0.96);
    expect(internal.verifiedStatus).toBe('verified');
    expect(internal.confidenceLevel).toBe('verified');
    expect(internal.lastVerifiedDate).toBe('2026-01-15T00:00:00Z');
  });

  it('accepts NormalizedFood and scales per-100g from serving', () => {
    const packaged: ProviderFood = {
      provider: 'off',
      id: '123',
      name: 'Protein Bar',
      brand: 'Acme',
      barcode: '0123456789012',
      isGeneric: false,
      nutritionPerServing: { calories: 200, protein: 20, carbs: 22, fat: 7, sugar: 8 },
      gramsPerServing: 50,
      ingredients: ['whey', 'oats'],
      allergens: ['milk'],
      category: 'packaged',
    };
    const nf = normalizeFood(packaged);
    const internal = toInternalFood(nf, { confidence: 0.72 });
    expect(internal.brand).toBe('Acme');
    expect(internal.barcode).toBe('0123456789012');
    expect(internal.calories).toBe(200);
    expect(internal.caloriesPer100g).toBeCloseTo(400);
    expect(internal.proteinPer100g).toBeCloseTo(40);
    expect(internal.ingredients).toEqual(['whey', 'oats']);
    expect(internal.allergens).toEqual(['milk']);
    expect(internal.confidenceLevel).toBe('review');
  });

  it('requires serving weight for verified foods when available', () => {
    const internal = toInternalFood({ ...raw, gramsPerServing: 112 }, { confidence: 0.97 });
    expect(internal.verifiedStatus).toBe('verified');
    expect(internal.servingWeightGrams).toBe(112);
  });
});
