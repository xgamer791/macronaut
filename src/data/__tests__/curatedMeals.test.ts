import { CURATED_MEALS, getCuratedMeal, searchCuratedMeals } from '../curatedMeals';

describe('curatedMeals', () => {
  it('ships exactly 8 Macronaut-curated meals', () => {
    expect(CURATED_MEALS).toHaveLength(8);
    expect(CURATED_MEALS.every((m) => m.curatedBy === 'Macronaut')).toBe(true);
  });

  it('includes ingredients, directions, and nutrition for every meal', () => {
    for (const m of CURATED_MEALS) {
      expect(m.ingredients.length).toBeGreaterThan(3);
      expect(m.directions.length).toBeGreaterThan(2);
      expect(m.nutrition.calories).toBeGreaterThan(0);
      expect(m.nutrition.protein).toBeGreaterThan(0);
      expect(m.image).toBeTruthy();
    }
  });

  it('looks up meals by id', () => {
    expect(getCuratedMeal('lemon-herb-chicken')?.name).toMatch(/Chicken/i);
    expect(getCuratedMeal('missing')).toBeUndefined();
  });

  it('searches by name, tag, and ingredient', () => {
    expect(searchCuratedMeals('salmon').map((m) => m.id)).toContain('salmon-avocado-plate');
    expect(searchCuratedMeals('vegan').map((m) => m.id)).toContain('chickpea-buddha-bowl');
    expect(searchCuratedMeals('tahini').map((m) => m.id)).toContain('chickpea-buddha-bowl');
    expect(searchCuratedMeals('zzzz-no-match')).toHaveLength(0);
    expect(searchCuratedMeals('')).toHaveLength(8);
  });
});
