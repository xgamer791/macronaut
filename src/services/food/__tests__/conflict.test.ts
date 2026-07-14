import { resolveConflicts, significantNutritionConflict } from '../conflict';
import { ProviderFood } from '../types';

const base = (over: Partial<ProviderFood>): ProviderFood => ({
  provider: 'usda',
  id: '1',
  name: 'Chicken breast',
  isGeneric: true,
  nutritionPer100g: { calories: 165, protein: 31, carbs: 0, fat: 3.6 },
  ...over,
});

describe('significantNutritionConflict', () => {
  it('detects large calorie deltas', () => {
    expect(
      significantNutritionConflict(
        { calories: 165, protein: 31 },
        { calories: 250, protein: 31 },
      ),
    ).toBe(true);
  });

  it('ignores small deltas', () => {
    expect(
      significantNutritionConflict(
        { calories: 165, protein: 31, carbs: 0, fat: 3.6 },
        { calories: 170, protein: 30, carbs: 0, fat: 3.5 },
      ),
    ).toBe(false);
  });
});

describe('resolveConflicts', () => {
  it('returns null for empty input', () => {
    expect(resolveConflicts([])).toBeNull();
  });

  it('USDA wins for generic foods', () => {
    const result = resolveConflicts([
      { food: base({ provider: 'off', id: 'o', isGeneric: false, brand: 'X', category: 'generic' }) },
      { food: base({ provider: 'usda', id: 'u', category: 'generic' }) },
    ]);
    expect(result?.winner.provider).toBe('usda');
  });

  it('branded / manufacturer wins for packaged', () => {
    const result = resolveConflicts([
      {
        food: base({
          provider: 'usda',
          id: 'u',
          isGeneric: false,
          category: 'packaged',
          brand: 'GenericBrand',
        }),
      },
      {
        food: base({
          provider: 'off',
          id: 'o',
          isGeneric: false,
          category: 'packaged',
          brand: 'Acme',
          barcode: '0123456789012',
        }),
        barcodeMatch: true,
      },
    ]);
    // Barcode match beats text / weaker packaged hits
    expect(result?.winner.id).toBe('o');
  });

  it('official restaurant wins for restaurant foods', () => {
    const result = resolveConflicts([
      {
        food: base({
          provider: 'nutritionix',
          id: 'n',
          restaurant: 'Chipotle',
          category: 'restaurant',
          isGeneric: false,
        }),
      },
      {
        food: base({
          provider: 'restaurant',
          id: 'r',
          restaurant: 'Chipotle',
          category: 'restaurant',
          verified: true,
          isGeneric: false,
        }),
      },
    ]);
    expect(result?.winner.provider).toBe('restaurant');
  });

  it('newest verified beats outdated peer', () => {
    const result = resolveConflicts([
      {
        food: base({
          provider: 'local',
          id: 'old',
          verified: true,
          lastVerified: '2020-01-01T00:00:00Z',
          category: 'generic',
        }),
      },
      {
        food: base({
          provider: 'local',
          id: 'new',
          verified: true,
          lastVerified: '2026-01-01T00:00:00Z',
          category: 'generic',
          nutritionPer100g: { calories: 200, protein: 30, carbs: 0, fat: 8 },
        }),
      },
    ]);
    expect(result?.winner.id).toBe('new');
    expect(result?.conflictNotice).toBeDefined();
  });

  it('never averages nutrition — winner panel is intact', () => {
    const a = base({
      id: 'a',
      nutritionPer100g: { calories: 100, protein: 10, carbs: 0, fat: 5 },
    });
    const b = base({
      provider: 'off',
      id: 'b',
      nutritionPer100g: { calories: 300, protein: 20, carbs: 10, fat: 15 },
    });
    const result = resolveConflicts([{ food: a }, { food: b }]);
    expect(result?.winner.nutritionPer100g?.calories).toBe(100);
  });
});
