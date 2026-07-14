import { createTestDb } from '@/db/__tests__/testDb';
import { createDiaryRepo } from '@/repositories/diaryRepo';
import { createFoodRepo } from '@/repositories/foodRepo';
import { createGoalRepo } from '@/repositories/goalRepo';
import { createHistoryRepo } from '@/repositories/historyRepo';
import { createRecipeRepo, createSavedMealRepo } from '@/repositories/collectionsRepo';
import { createSettingsRepo } from '@/repositories/settingsRepo';
import { Repos } from '@/state/AppProvider';
import { addDays, todayKey } from '@/utils/date';
import { loadDemoData } from '../demoData';

describe('demo data', () => {
  it('seeds 2+ weeks of coherent data across every store', async () => {
    const db = await createTestDb();
    const repos: Repos = {
      db,
      diary: createDiaryRepo(db),
      food: createFoodRepo(db),
      goals: createGoalRepo(db),
      savedMeals: createSavedMealRepo(db),
      recipes: createRecipeRepo(db),
      history: createHistoryRepo(db),
      settings: createSettingsRepo(db),
    };
    await loadDemoData(repos);

    const today = todayKey();
    const entries = await repos.diary.entriesForRange(addDays(today, -17), today);
    const daysWithData = new Set(entries.map((e) => e.date));
    expect(daysWithData.size).toBeGreaterThanOrEqual(14); // 2+ weeks

    // Training/rest config with a manual mark.
    const config = await repos.goals.configFor(today);
    expect(config?.mode).toBe('training-rest');
    expect(config?.training?.calories).toBe(2450);
    const marks = await repos.goals.allMarks();
    expect(Object.values(marks)).toContain('training');

    // Custom food, saved meal, recipe.
    expect(await repos.food.listCustomFoods()).toHaveLength(1);
    const meals = await repos.savedMeals.list();
    expect(meals).toHaveLength(1);
    expect(repos.savedMeals.totalNutrition(meals[0]).calories).toBeGreaterThan(300);
    const recipesList = await repos.recipes.list();
    expect(recipesList).toHaveLength(1);
    expect(repos.recipes.perServing(recipesList[0]).calories).toBeGreaterThan(500);

    // History powers recents/frequents.
    expect((await repos.history.recentFoods()).length).toBeGreaterThan(0);
    expect((await repos.history.frequentFoods())[0].count).toBeGreaterThan(5);
  });
});
