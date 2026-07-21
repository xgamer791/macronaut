import {
  CURATED_MEALS,
  getCuratedMeal,
  mealSlotForHour,
  mealsBySlot,
  orderedMealSlots,
  searchCuratedMeals,
} from '../curatedMeals';

describe('curatedMeals', () => {
  it('ships 24 unique Macronaut-curated meals', () => {
    expect(CURATED_MEALS).toHaveLength(24);
    expect(CURATED_MEALS.every((m) => m.curatedBy === 'Macronaut')).toBe(true);
    const ids = CURATED_MEALS.map((m) => m.id);
    expect(new Set(ids).size).toBe(24);
    const names = CURATED_MEALS.map((m) => m.name.toLowerCase());
    expect(new Set(names).size).toBe(24);
  });

  it('covers Breakfast, Lunch, Dinner, and Snack slots', () => {
    expect(mealsBySlot('Breakfast').length).toBeGreaterThanOrEqual(5);
    expect(mealsBySlot('Lunch').length).toBeGreaterThanOrEqual(5);
    expect(mealsBySlot('Dinner').length).toBeGreaterThanOrEqual(5);
    expect(mealsBySlot('Snack').length).toBeGreaterThanOrEqual(5);
  });

  it('includes ingredients, directions, difficulty, and nutrition for every meal', () => {
    for (const m of CURATED_MEALS) {
      expect(m.ingredients.length).toBeGreaterThan(2);
      expect(m.directions.length).toBeGreaterThan(1);
      expect(['easy', 'medium', 'hard']).toContain(m.difficulty);
      expect(m.nutrition.calories).toBeGreaterThan(0);
      expect(m.image).toBeTruthy();
    }
  });

  it('looks up meals by id', () => {
    expect(getCuratedMeal('lemon-herb-chicken')?.name).toMatch(/Chicken/i);
    expect(getCuratedMeal('missing')).toBeUndefined();
  });

  it('searches by name, tag, and ingredient', () => {
    expect(searchCuratedMeals('salmon').map((m) => m.id)).toContain('salmon-avocado-plate');
    expect(searchCuratedMeals('hummus').map((m) => m.id)).toContain('protein-hummus-veg');
    expect(searchCuratedMeals('zzzz-no-match')).toHaveLength(0);
    expect(searchCuratedMeals('')).toHaveLength(24);
  });

  it('orders carousels by time of day with Snacks always last', () => {
    expect(mealSlotForHour(8)).toBe('Breakfast');
    expect(mealSlotForHour(12)).toBe('Lunch');
    expect(mealSlotForHour(19)).toBe('Dinner');
    expect(mealSlotForHour(23)).toBe('Dinner');

    expect(orderedMealSlots(8)).toEqual(['Breakfast', 'Lunch', 'Dinner', 'Snack']);
    expect(orderedMealSlots(13)).toEqual(['Lunch', 'Breakfast', 'Dinner', 'Snack']);
    expect(orderedMealSlots(18)).toEqual(['Dinner', 'Breakfast', 'Lunch', 'Snack']);
    for (const h of [0, 8, 12, 15, 20, 23]) {
      const order = orderedMealSlots(h);
      expect(order[order.length - 1]).toBe('Snack');
    }
  });
});
