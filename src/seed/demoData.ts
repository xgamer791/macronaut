import { Repos } from '@/state/AppProvider';
import { addDays, todayKey } from '@/utils/date';

/** Development/testing demo data: ~2.5 weeks of varied diary history, a
 * custom food, a saved meal, a recipe, a training/rest goal config and some
 * per-date day marks. Never loaded automatically — only via the guarded
 * Settings action. */
export async function loadDemoData(repos: Repos): Promise<void> {
  const { diary, food, savedMeals, recipes, goals, history, settings } = repos;
  const today = todayKey();

  // Training/rest goal config effective three weeks back — so history shows
  // different daily targets (2,450 training / 1,950 rest).
  await goals.saveConfig({
    effectiveFrom: addDays(today, -21),
    mode: 'training-rest',
    baseTarget: { calories: 2100, protein: 150, carbs: 220, fat: 65, fiber: 30 },
    training: { calories: 2450, protein: 170, carbs: 280, fat: 65, fiber: 32 },
    rest: { calories: 1950, protein: 150, carbs: 180, fat: 62, fiber: 30 },
    trainingDays: [1, 3, 5], // Mon/Wed/Fri
    weeklyMode: 'sum-daily',
  });
  await goals.setMark(addDays(today, -4), 'training'); // one manual override
  await goals.setMark(addDays(today, -9), 'rest');

  const customFood = await food.addCustomFood({
    name: 'Protein oatmeal bowl',
    brand: 'Homemade',
    servingQty: 1,
    servingUnit: 'serving',
    gramsPerServing: 350,
    nutrition: { calories: 420, protein: 32, carbs: 52, fat: 10, fiber: 8, sugar: 12 },
    notes: 'Oats + whey + berries',
    favorite: true,
  });

  const meal = await savedMeals.create({
    name: 'Usual breakfast',
    servings: 1,
    items: [
      { name: 'Greek yogurt', quantity: 1, unit: 'cup', nutrition: { calories: 150, protein: 15, carbs: 8, fat: 4 } },
      { name: 'Granola', quantity: 0.5, unit: 'cup', nutrition: { calories: 210, protein: 5, carbs: 32, fat: 7 } },
      { name: 'Blueberries', quantity: 0.5, unit: 'cup', nutrition: { calories: 42, carbs: 10, fiber: 2 } },
    ],
  });

  const recipe = await recipes.create({
    name: 'Chicken burrito bowls',
    servings: 4,
    notes: 'Meal prep for the week. Rice, chicken thighs, beans, salsa, cheese.',
    items: [
      { name: 'Chicken thighs', quantity: 700, unit: 'g', nutrition: { calories: 1250, protein: 130, fat: 80 } },
      { name: 'White rice (cooked)', quantity: 4, unit: 'cup', nutrition: { calories: 820, protein: 17, carbs: 178 } },
      { name: 'Black beans', quantity: 2, unit: 'cup', nutrition: { calories: 454, protein: 30, carbs: 82, fiber: 30 } },
      { name: 'Cheddar', quantity: 100, unit: 'g', nutrition: { calories: 403, protein: 23, fat: 33 } },
      { name: 'Salsa', quantity: 1, unit: 'cup', nutrition: { calories: 70, carbs: 16 } },
    ],
  });

  // 17 days of history with varied but realistic patterns; a couple of days
  // intentionally over target and two days unlogged.
  const meals = ['breakfast', 'lunch', 'dinner', 'snacks'];
  for (let back = 17; back >= 0; back--) {
    const date = addDays(today, -back);
    if (back === 6 || back === 13) continue; // unlogged days

    const heavy = back % 5 === 0; // periodic over-target days
    const base = heavy ? 2600 : 1900 + ((back * 137) % 300);
    const split = [0.28, 0.35, 0.3, 0.07];

    for (let m = 0; m < meals.length; m++) {
      const cal = Math.round(base * split[m]);
      if (cal < 60) continue;
      await diary.add({
        date,
        meal: meals[m],
        name:
          m === 0
            ? back % 2 === 0
              ? 'Protein oatmeal bowl'
              : 'Eggs and toast'
            : m === 1
              ? back % 3 === 0
                ? 'Chicken burrito bowl'
                : 'Turkey sandwich'
              : m === 2
                ? back % 2 === 0
                  ? 'Salmon, rice and greens'
                  : 'Pasta with meat sauce'
                : 'Dark chocolate square',
        sourceType: 'manual',
        quantity: 1,
        unit: 'serving',
        nutrition: {
          calories: cal,
          protein: Math.round((cal * 0.3) / 4),
          carbs: Math.round((cal * 0.45) / 4),
          fat: Math.round((cal * 0.25) / 9),
          fiber: Math.round(cal / 200),
        },
      });
    }
    await history.recordLog(`custom:${customFood.id}`, customFood.name, 'breakfast');
    if (back % 3 === 0) await history.recordLog(`recipe:${recipe.id}`, recipe.name, 'lunch');
    if (back % 2 === 0) await history.recordLog(`meal:${meal.id}`, meal.name, 'breakfast');
  }

  await settings.set('demoDataLoaded', true);
}
