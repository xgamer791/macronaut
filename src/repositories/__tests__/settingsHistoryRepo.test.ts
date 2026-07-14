import { createTestDb } from '@/db/__tests__/testDb';
import { createSettingsRepo } from '../settingsRepo';
import { createHistoryRepo } from '../historyRepo';

describe('settingsRepo', () => {
  it('round-trips typed settings with defaults', async () => {
    const repo = createSettingsRepo(await createTestDb());
    expect(await repo.getOnboardingComplete()).toBe(false);
    expect(await repo.getUnitSystem()).toBe('us');
    expect(await repo.getWeekStart()).toBe('monday');
    expect(await repo.getAppearance()).toBe('system');

    await repo.setOnboardingComplete(true);
    await repo.setUnitSystem('metric');
    await repo.setWeekStart('sunday');
    await repo.setAppearance('dark');
    await repo.setProfile({ age: 33, sex: 'male', heightCm: 180, weightKg: 82 });

    expect(await repo.getOnboardingComplete()).toBe(true);
    expect(await repo.getUnitSystem()).toBe('metric');
    expect(await repo.getWeekStart()).toBe('sunday');
    expect(await repo.getAppearance()).toBe('dark');
    expect((await repo.getProfile()).age).toBe(33);
  });

  it('lists default meal categories and adds custom ones', async () => {
    const repo = createSettingsRepo(await createTestDb());
    const cats = await repo.getMealCategories();
    expect(cats).toHaveLength(4);
    expect(cats.map((c) => c.id)).toEqual(['breakfast', 'lunch', 'dinner', 'snacks']);
    expect(cats[0].builtin).toBe(true);
    const added = await repo.addMealCategory('Pre-workout');
    expect(added.builtin).toBe(false);
    expect(await repo.getMealCategories()).toHaveLength(5);
  });
});

describe('historyRepo', () => {
  it('tracks recents ordered by last log', async () => {
    const repo = createHistoryRepo(await createTestDb());
    await repo.recordLog('custom:1', 'Yogurt', 'breakfast');
    await repo.recordLog('usda:2', 'Chicken', 'lunch');
    await repo.recordLog('custom:1', 'Yogurt', 'breakfast');
    const recents = await repo.recentFoods();
    expect(recents[0].foodKey).toBe('custom:1');
    expect(recents).toHaveLength(2);
  });

  it('ranks frequents by count', async () => {
    const repo = createHistoryRepo(await createTestDb());
    for (let i = 0; i < 3; i++) await repo.recordLog('usda:2', 'Chicken', 'lunch');
    await repo.recordLog('custom:1', 'Yogurt', 'breakfast');
    const freq = await repo.frequentFoods();
    expect(freq[0].foodKey).toBe('usda:2');
    expect(freq[0].count).toBe(3);
  });

  it('biases frequents toward the target meal', async () => {
    const repo = createHistoryRepo(await createTestDb());
    for (let i = 0; i < 5; i++) await repo.recordLog('usda:2', 'Chicken', 'lunch');
    for (let i = 0; i < 2; i++) await repo.recordLog('custom:1', 'Yogurt', 'breakfast');
    const forBreakfast = await repo.frequentFoods(10, 'breakfast');
    expect(forBreakfast[0].foodKey).toBe('custom:1'); // logged in breakfast wins the bias
  });

  it('search history dedupes and orders by recency', async () => {
    const repo = createHistoryRepo(await createTestDb());
    await repo.recordSearch('chicken');
    await repo.recordSearch('yogurt');
    await repo.recordSearch('chicken');
    expect(await repo.recentSearches()).toEqual(['chicken', 'yogurt']);
    await repo.clearSearches();
    expect(await repo.recentSearches()).toEqual([]);
  });
});
