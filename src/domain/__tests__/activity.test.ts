import { computeImprovements, estimateBurn } from '../activity';

describe('estimateBurn', () => {
  it('rounds kcal/min × duration', () => {
    expect(estimateBurn(10, 30)).toBe(300);
  });

  it('returns 0 for invalid inputs', () => {
    expect(estimateBurn(10, 0)).toBe(0);
    expect(estimateBurn(10, -5)).toBe(0);
  });
});

describe('computeImprovements', () => {
  it('flags a faster similar-distance run', () => {
    const chips = computeImprovements(
      { durationMin: 27, distanceKm: 5, caloriesBurned: 300 },
      { durationMin: 30, distanceKm: 5, caloriesBurned: 290 },
    );
    expect(chips.some((c) => c.kind === 'pace')).toBe(true);
  });

  it('flags longer duration and higher burn', () => {
    const chips = computeImprovements(
      { durationMin: 50, caloriesBurned: 350 },
      { durationMin: 40, caloriesBurned: 280 },
    );
    expect(chips.map((c) => c.kind).sort()).toEqual(['burn', 'duration']);
  });

  it('returns nothing without a previous session', () => {
    expect(computeImprovements({ caloriesBurned: 200 }, null)).toEqual([]);
  });
});
