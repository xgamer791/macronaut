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

  it('uses ring design for calories and macros; other metrics keep specialized kinds', () => {
    expect(heroMetricDef('calories').kind).toBe('ring');
    expect(heroMetricDef('protein').kind).toBe('ring');
    expect(heroMetricDef('carbs').kind).toBe('ring');
    expect(heroMetricDef('fat').kind).toBe('ring');
    expect(heroMetricDef('steps').kind).toBe('steps');
    expect(heroMetricDef('water').kind).toBe('water');
    expect(heroMetricDef('burned').kind).toBe('burned');
  });

  it('validates ids and defaults', () => {
    expect(isHeroMetricId('calories')).toBe(true);
    expect(isHeroMetricId('nope')).toBe(false);
    expect(heroMetricDef(DEFAULT_HERO_LEFT).id).toBe('calories');
    expect(heroMetricDef(DEFAULT_HERO_RIGHT).kind).toBe('steps');
  });
});
