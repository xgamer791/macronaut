import { describe, expect, it } from 'vitest';
import { backend, signedInRepos, tick } from './helpers';

describe('settings', () => {
  it('round-trips typed settings with defaults', async () => {
    const { settings } = await signedInRepos(backend());
    expect(await settings.getOnboardingComplete()).toBe(false);
    expect(await settings.getUnitSystem()).toBe('us');
    expect(await settings.getWeekStart()).toBe('monday');
    expect(await settings.getAppearance()).toBe('system');

    await settings.setOnboardingComplete(true);
    await settings.setUnitSystem('metric');
    await settings.setWeekStart('sunday');
    await settings.setAppearance('dark');
    await settings.setProfile({ age: 33, sex: 'male', heightCm: 180, weightKg: 82 });

    expect(await settings.getOnboardingComplete()).toBe(true);
    expect(await settings.getUnitSystem()).toBe('metric');
    expect(await settings.getWeekStart()).toBe('sunday');
    expect(await settings.getAppearance()).toBe('dark');
    expect((await settings.getProfile()).age).toBe(33);
  });

  it('overwrites a key in place and stores arbitrary shapes', async () => {
    const { settings } = await signedInRepos(backend());
    await settings.set('mealTimes', { breakfast: '7:00 AM' });
    await settings.set('mealTimes', { breakfast: '8:00 AM' });
    expect(await settings.get('mealTimes', null)).toEqual({ breakfast: '8:00 AM' });
  });

  it('lists default meal categories and adds custom ones', async () => {
    const { settings } = await signedInRepos(backend());
    const cats = await settings.getMealCategories();
    expect(cats).toHaveLength(4);
    expect(cats.map((c) => c.id)).toEqual(['breakfast', 'lunch', 'dinner', 'snacks']);
    expect(cats[0].builtin).toBe(true);
    const added = await settings.addMealCategory('Pre-workout');
    expect(added.builtin).toBe(false);
    expect(added.position).toBe(4);
    expect(await settings.getMealCategories()).toHaveLength(5);
    await expect(settings.addMealCategory('  ')).rejects.toThrow(/required/);
  });
});

describe('history', () => {
  it('tracks recents ordered by last log', async () => {
    const { history } = await signedInRepos(backend());
    await history.recordLog('custom:1', 'Yogurt', 'breakfast');
    await tick();
    await history.recordLog('usda:2', 'Chicken', 'lunch');
    await tick();
    await history.recordLog('custom:1', 'Yogurt', 'breakfast');
    const recents = await history.recentFoods();
    expect(recents[0].foodKey).toBe('custom:1');
    expect(recents).toHaveLength(2);
  });

  it('ranks frequents by count', async () => {
    const { history } = await signedInRepos(backend());
    for (let i = 0; i < 3; i++) await history.recordLog('usda:2', 'Chicken', 'lunch');
    await history.recordLog('custom:1', 'Yogurt', 'breakfast');
    const freq = await history.frequentFoods();
    expect(freq[0].foodKey).toBe('usda:2');
    expect(freq[0].count).toBe(3);
  });

  it('biases frequents toward the target meal', async () => {
    const { history } = await signedInRepos(backend());
    for (let i = 0; i < 5; i++) await history.recordLog('usda:2', 'Chicken', 'lunch');
    for (let i = 0; i < 2; i++) await history.recordLog('custom:1', 'Yogurt', 'breakfast');
    const forBreakfast = await history.frequentFoods(10, 'breakfast');
    expect(forBreakfast[0].foodKey).toBe('custom:1');
  });

  it('search history dedupes and orders by recency', async () => {
    const { history } = await signedInRepos(backend());
    await history.recordSearch('chicken');
    await tick();
    await history.recordSearch('yogurt');
    await tick();
    await history.recordSearch('chicken');
    expect(await history.recentSearches()).toEqual(['chicken', 'yogurt']);
    await history.clearSearches();
    expect(await history.recentSearches()).toEqual([]);
  });
});
