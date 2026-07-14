import {
  AUTO_SELECT_MIN,
  RANK_LOW_CONFIDENCE,
  neverAutoSelect,
  rankFoods,
  rankScore,
  shouldAutoSelect,
  confidenceLevelFromScore,
} from '../ranking';
import { ProviderFood } from '../types';

const food = (over: Partial<ProviderFood> = {}): ProviderFood => ({
  provider: 'usda',
  id: '1',
  name: 'Chicken breast, grilled',
  isGeneric: true,
  nutritionPer100g: { calories: 165, protein: 31, carbs: 0, fat: 3.6 },
  gramsPerServing: 100,
  confidence: 0.85,
  category: 'generic',
  ...over,
});

describe('confidenceLevelFromScore', () => {
  it('maps bands', () => {
    expect(confidenceLevelFromScore(0.96)).toBe('verified');
    expect(confidenceLevelFromScore(0.85)).toBe('high');
    expect(confidenceLevelFromScore(0.7)).toBe('review');
    expect(confidenceLevelFromScore(0.4)).toBe('low');
  });
});

describe('rankScore', () => {
  it('rewards exact name, barcode, prep, and verification', () => {
    const ranked = rankScore(
      food({
        barcode: '0123456789012',
        verified: true,
        lastVerified: new Date().toISOString(),
        preparationState: 'grilled',
      }),
      { query: 'chicken breast, grilled', scannedBarcode: '0123456789012' },
    );
    expect(ranked.score).toBeGreaterThanOrEqual(AUTO_SELECT_MIN);
    expect(ranked.autoSelect).toBe(true);
    expect(ranked.reasons).toEqual(
      expect.arrayContaining(['barcode match', 'exact prep match', 'verified']),
    );
  });

  it('penalizes raw/cooked meat mismatch', () => {
    const ok = rankScore(food({ preparationState: 'grilled', name: 'Chicken breast, grilled' }), {
      query: 'grilled chicken breast',
    });
    const bad = rankScore(food({ preparationState: 'raw', name: 'Chicken breast, raw' }), {
      query: 'grilled chicken breast',
    });
    expect(bad.score).toBeLessThan(ok.score);
    expect(bad.reasons).toContain('raw/cooked mismatch');
  });

  it('penalizes missing serving weight and incomplete nutrition', () => {
    const incomplete = rankScore(
      food({
        gramsPerServing: undefined,
        nutritionPer100g: { calories: 100 },
        confidence: 0.7,
      }),
    );
    expect(incomplete.reasons).toEqual(
      expect.arrayContaining(['missing serving weight', 'missing nutrition']),
    );
  });

  it('never auto-selects below the low bar', () => {
    const low = rankScore(food({ confidence: 0.2, nutritionPer100g: undefined, gramsPerServing: undefined }));
    expect(neverAutoSelect(low.score)).toBe(true);
    expect(shouldAutoSelect(low.score)).toBe(false);
    expect(low.score).toBeLessThan(RANK_LOW_CONFIDENCE);
  });
});

describe('rankFoods', () => {
  it('orders by score and demotes duplicates', () => {
    const ranked = rankFoods(
      [
        food({ id: 'a', name: 'Chicken breast', barcode: '111' }),
        food({ id: 'b', name: 'Chicken breast', barcode: '0111', confidence: 0.7 }),
        food({ id: 'c', name: 'Salmon', confidence: 0.9 }),
      ],
      { query: 'chicken breast' },
    );
    expect(ranked[0].food.name.toLowerCase()).toContain('chicken');
    expect(ranked.some((r) => r.reasons.includes('duplicate'))).toBe(true);
  });
});
