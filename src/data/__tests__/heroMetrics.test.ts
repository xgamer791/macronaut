import {
  DEFAULT_HERO_LEFT,
  DEFAULT_HERO_RIGHT,
  HERO_METRICS,
  heroMetricDef,
  isHeroMetricId,
} from '@/data/heroMetrics';

describe('heroMetrics', () => {
  it('lists the core trackable metrics', () => {
    const ids = HERO_METRICS.map((m) => m.id);
    expect(ids).toEqual(
      expect.arrayContaining([
        'calories',
        'protein',
        'carbs',
        'fat',
        'fiber',
        'water',
        'steps',
        'burned',
      ]),
    );
  });

  it('uses distinct visual kinds (not every metric is a calorie ring)', () => {
    const kinds = new Set(HERO_METRICS.map((m) => m.kind));
    expect(kinds.has('ring')).toBe(true);
    expect(kinds.has('steps')).toBe(true);
    expect(kinds.has('water')).toBe(true);
    expect(kinds.has('macro')).toBe(true);
    expect(kinds.has('burned')).toBe(true);
  });

  it('validates ids and defaults', () => {
    expect(isHeroMetricId('calories')).toBe(true);
    expect(isHeroMetricId('nope')).toBe(false);
    expect(heroMetricDef(DEFAULT_HERO_LEFT).id).toBe('calories');
    expect(heroMetricDef(DEFAULT_HERO_RIGHT).kind).toBe('steps');
  });
});
