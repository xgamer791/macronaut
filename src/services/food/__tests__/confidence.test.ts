import { AUTO_SELECT_CONFIDENCE, confidenceLevel, LOW_CONFIDENCE, scoreConfidence, SOURCE_TRUST } from '../confidence';
import { normalizeFood } from '../normalize';
import { ProviderFood } from '../types';

describe('confidence SOURCE_TRUST', () => {
  it('includes nutritionix, fatsecret, and restaurant', () => {
    expect(SOURCE_TRUST.restaurant).toBeCloseTo(0.92);
    expect(SOURCE_TRUST.nutritionix).toBeCloseTo(0.8);
    expect(SOURCE_TRUST.fatsecret).toBeCloseTo(0.78);
    expect(SOURCE_TRUST.off).toBeCloseTo(0.5);
    expect(SOURCE_TRUST.usda).toBeCloseTo(0.85);
    expect(SOURCE_TRUST.local).toBeCloseTo(0.95);
  });
});

describe('scoreConfidence upgrades', () => {
  const mk = (over: Partial<ProviderFood>): ProviderFood => ({
    provider: 'off',
    id: '1',
    name: 'X',
    isGeneric: false,
    nutritionPerServing: { calories: 100, protein: 5, carbs: 10, fat: 3 },
    gramsPerServing: 100,
    ...over,
  });

  it('restaurant curated outranks nutritionix and off', () => {
    const restaurant = scoreConfidence(normalizeFood(mk({ provider: 'restaurant', name: 'Burrito' }))).score;
    const nix = scoreConfidence(normalizeFood(mk({ provider: 'nutritionix' }))).score;
    const off = scoreConfidence(normalizeFood(mk({ provider: 'off' }))).score;
    expect(restaurant).toBeGreaterThan(nix);
    expect(nix).toBeGreaterThan(off);
  });

  it('applies prep match bonus and mismatch penalty for meats', () => {
    const match = scoreConfidence(
      normalizeFood(mk({ provider: 'usda', name: 'Chicken breast, grilled' })),
      { query: 'grilled chicken breast' },
    );
    const mismatch = scoreConfidence(
      normalizeFood(mk({ provider: 'usda', name: 'Chicken breast, raw' })),
      { query: 'grilled chicken breast' },
    );
    expect(match.score).toBeGreaterThan(mismatch.score);
    expect(match.reasons).toEqual(expect.arrayContaining(['prep match']));
    expect(mismatch.reasons).toEqual(expect.arrayContaining(['prep mismatch']));
  });

  it('exports confidenceLevel helper aligned with bands', () => {
    expect(confidenceLevel(0.96)).toBe('verified');
    expect(confidenceLevel(0.85)).toBe('high');
    expect(confidenceLevel(0.65)).toBe('review');
    expect(confidenceLevel(0.4)).toBe('low');
  });

  it('LOW_CONFIDENCE is the never-auto-select floor; AUTO_SELECT is high', () => {
    expect(LOW_CONFIDENCE).toBe(0.6);
    expect(AUTO_SELECT_CONFIDENCE).toBe(0.8);
  });
});
