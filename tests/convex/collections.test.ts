import { describe, expect, it } from 'vitest';
import { backend, signedInRepos } from './helpers';

const items = [
  { name: 'Oats', quantity: 1, unit: 'cup', nutrition: { calories: 300, protein: 10, carbs: 54, fat: 6 } },
  { name: 'Milk', quantity: 1, unit: 'cup', nutrition: { calories: 120, protein: 8, carbs: 12, fat: 5 } },
  { name: 'Berries', quantity: 0.5, unit: 'cup', nutrition: { calories: 40, carbs: 10 } },
];

describe('recipes', () => {
  it('creates a recipe and auto-computes totals + per-serving', async () => {
    const { recipes } = await signedInRepos(backend());
    const r = await recipes.create({ name: 'Overnight oats', servings: 2, items });
    expect(r.ingredients).toHaveLength(3);
    expect(r.ingredients.map((i) => i.position)).toEqual([0, 1, 2]);
    const total = recipes.totalNutrition(r);
    expect(total.calories).toBe(460);
    expect(total.protein).toBe(18);
    const per = recipes.perServing(r);
    expect(per.calories).toBe(230);
    expect(per.protein).toBe(9);
  });

  it('recalculates when an ingredient is added, removed or scaled', async () => {
    const { recipes } = await signedInRepos(backend());
    const r = await recipes.create({ name: 'Oats', servings: 2, items });
    const added = await recipes.update(r.id, {
      items: [...items, { name: 'Honey', quantity: 1, unit: 'tbsp', nutrition: { calories: 64, carbs: 17 } }],
    });
    expect(recipes.totalNutrition(added).calories).toBe(524);
    const removed = await recipes.update(r.id, { items: items.slice(0, 2) });
    expect(recipes.totalNutrition(removed).calories).toBe(420);
    const doubledMilk = await recipes.update(r.id, {
      items: [items[0], { ...items[1], quantity: 2, nutrition: { calories: 240, protein: 16, carbs: 24, fat: 10 } }],
    });
    expect(recipes.totalNutrition(doubledMilk).calories).toBe(540);
  });

  it('per-serving recalculates when servings change', async () => {
    const { recipes } = await signedInRepos(backend());
    const r = await recipes.create({ name: 'Oats', servings: 2, items });
    const updated = await recipes.update(r.id, { servings: 4 });
    expect(recipes.perServing(updated).calories).toBe(115);
    expect(updated.ingredients).toHaveLength(3);
  });

  it('validates name and servings', async () => {
    const { recipes } = await signedInRepos(backend());
    await expect(recipes.create({ name: ' ', servings: 1, items: [] })).rejects.toThrow('Name');
    await expect(recipes.create({ name: 'X', servings: 0, items: [] })).rejects.toThrow('Servings');
  });

  it('duplicates, favorites, deletes', async () => {
    const { recipes } = await signedInRepos(backend());
    const r = await recipes.create({ name: 'Oats', servings: 2, items });
    const dup = await recipes.duplicate(r.id);
    expect(dup.name).toBe('Oats (copy)');
    expect(dup.ingredients).toHaveLength(3);
    await recipes.setFavorite(r.id, true);
    expect((await recipes.get(r.id))?.favorite).toBe(true);
    await recipes.remove(r.id);
    expect(await recipes.get(r.id)).toBeNull();
    expect(await recipes.list()).toHaveLength(1);
  });
});

describe('saved meals', () => {
  it('saved meal totals and per-serving', async () => {
    const { savedMeals } = await signedInRepos(backend());
    const m = await savedMeals.create({ name: 'My breakfast', servings: 1, items });
    expect(savedMeals.totalNutrition(m).calories).toBe(460);
    expect(savedMeals.perServing(m).calories).toBe(460);
    expect(m.items).toHaveLength(3);
  });

  it('searches by name', async () => {
    const { savedMeals } = await signedInRepos(backend());
    await savedMeals.create({ name: 'My breakfast', servings: 1, items });
    await savedMeals.create({ name: 'Post-workout', servings: 1, items: items.slice(0, 1) });
    expect(await savedMeals.list('break')).toHaveLength(1);
  });
});
