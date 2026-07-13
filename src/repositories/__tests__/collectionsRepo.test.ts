import { createTestDb } from '@/db/__tests__/testDb';
import { createRecipeRepo, createSavedMealRepo, RecipeRepo, SavedMealRepo } from '../collectionsRepo';

const items = [
  { name: 'Oats', quantity: 1, unit: 'cup', nutrition: { calories: 300, protein: 10, carbs: 54, fat: 6 } },
  { name: 'Milk', quantity: 1, unit: 'cup', nutrition: { calories: 120, protein: 8, carbs: 12, fat: 5 } },
  { name: 'Berries', quantity: 0.5, unit: 'cup', nutrition: { calories: 40, carbs: 10 } },
];

describe('recipeRepo', () => {
  let repo: RecipeRepo;

  beforeEach(async () => {
    repo = createRecipeRepo(await createTestDb());
  });

  it('creates a recipe and auto-computes totals + per-serving', async () => {
    const r = await repo.create({ name: 'Overnight oats', servings: 2, items });
    expect(r.ingredients).toHaveLength(3);
    const total = repo.totalNutrition(r);
    expect(total.calories).toBe(460);
    expect(total.protein).toBe(18);
    const per = repo.perServing(r);
    expect(per.calories).toBe(230);
    expect(per.protein).toBe(9);
  });

  it('recalculates when an ingredient is added', async () => {
    const r = await repo.create({ name: 'Oats', servings: 2, items });
    const updated = await repo.update(r.id, {
      items: [...items, { name: 'Honey', quantity: 1, unit: 'tbsp', nutrition: { calories: 64, carbs: 17 } }],
    });
    expect(repo.totalNutrition(updated).calories).toBe(524);
  });

  it('recalculates when an ingredient is removed or quantity changes', async () => {
    const r = await repo.create({ name: 'Oats', servings: 2, items });
    const removed = await repo.update(r.id, { items: items.slice(0, 2) });
    expect(repo.totalNutrition(removed).calories).toBe(420);
    const doubledMilk = await repo.update(r.id, {
      items: [items[0], { ...items[1], quantity: 2, nutrition: { calories: 240, protein: 16, carbs: 24, fat: 10 } }],
    });
    expect(repo.totalNutrition(doubledMilk).calories).toBe(540);
  });

  it('per-serving recalculates when servings change', async () => {
    const r = await repo.create({ name: 'Oats', servings: 2, items });
    const updated = await repo.update(r.id, { servings: 4 });
    expect(repo.perServing(updated).calories).toBe(115);
  });

  it('validates name and servings', async () => {
    await expect(repo.create({ name: ' ', servings: 1, items: [] })).rejects.toThrow('Name');
    await expect(repo.create({ name: 'X', servings: 0, items: [] })).rejects.toThrow('Servings');
  });

  it('duplicates, favorites, deletes', async () => {
    const r = await repo.create({ name: 'Oats', servings: 2, items });
    const dup = await repo.duplicate(r.id);
    expect(dup.name).toBe('Oats (copy)');
    expect(dup.ingredients).toHaveLength(3);
    await repo.setFavorite(r.id, true);
    expect((await repo.get(r.id))?.favorite).toBe(true);
    await repo.remove(r.id);
    expect(await repo.get(r.id)).toBeNull();
    expect(await repo.list()).toHaveLength(1); // only the copy remains
  });
});

describe('savedMealRepo', () => {
  let repo: SavedMealRepo;

  beforeEach(async () => {
    repo = createSavedMealRepo(await createTestDb());
  });

  it('saved meal totals and per-serving', async () => {
    const m = await repo.create({ name: 'My breakfast', servings: 1, items });
    expect(repo.totalNutrition(m).calories).toBe(460);
    expect(repo.perServing(m).calories).toBe(460);
    expect(m.items).toHaveLength(3);
  });

  it('searches by name', async () => {
    await repo.create({ name: 'My breakfast', servings: 1, items });
    await repo.create({ name: 'Post-workout', servings: 1, items: items.slice(0, 1) });
    expect(await repo.list('break')).toHaveLength(1);
  });
});
