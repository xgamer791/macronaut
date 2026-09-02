import { describe, expect, it } from 'vitest';
import type { NewCustomFood } from '../../src/repositories/foodRepo';
import { backend, signedInRepos } from './helpers';

const food = (over: Partial<NewCustomFood> = {}): NewCustomFood => ({
  name: 'Protein bar',
  brand: 'Acme',
  servingQty: 1,
  servingUnit: 'piece',
  gramsPerServing: 60,
  nutrition: { calories: 220, protein: 20, carbs: 24, fat: 7 },
  favorite: false,
  ...over,
});

describe('custom foods', () => {
  it('creates, reads, searches', async () => {
    const { food: repo } = await signedInRepos(backend());
    await repo.addCustomFood(food());
    await repo.addCustomFood(food({ name: 'Oatmeal', brand: undefined }));
    expect(await repo.listCustomFoods()).toHaveLength(2);
    expect(await repo.listCustomFoods('oat')).toHaveLength(1);
    expect(await repo.listCustomFoods('acme')).toHaveLength(1);
  });

  it('validates name and negative calories', async () => {
    const { food: repo } = await signedInRepos(backend());
    await expect(repo.addCustomFood(food({ name: '  ' }))).rejects.toThrow('name');
    await expect(repo.addCustomFood(food({ nutrition: { calories: -100 } }))).rejects.toThrow(
      'negative',
    );
  });

  it('updates and soft-deletes', async () => {
    const { food: repo } = await signedInRepos(backend());
    const f = await repo.addCustomFood(food());
    await repo.updateCustomFood(f.id, { name: 'Better bar' });
    expect((await repo.getCustomFood(f.id))?.name).toBe('Better bar');
    await repo.deleteCustomFood(f.id);
    expect(await repo.getCustomFood(f.id)).toBeNull();
    expect(await repo.listCustomFoods()).toHaveLength(0);
  });

  it('duplicates with a copy suffix', async () => {
    const { food: repo } = await signedInRepos(backend());
    const f = await repo.addCustomFood(food());
    const dup = await repo.duplicateCustomFood(f.id);
    expect(dup.name).toBe('Protein bar (copy)');
    expect(dup.nutrition).toEqual(f.nutrition);
  });

  it('favorites toggle', async () => {
    const { food: repo } = await signedInRepos(backend());
    const f = await repo.addCustomFood(food());
    await repo.setCustomFavorite(f.id, true);
    expect((await repo.getCustomFood(f.id))?.favorite).toBe(true);
  });

  it('finds by barcode', async () => {
    const { food: repo } = await signedInRepos(backend());
    await repo.addCustomFood(food({ barcode: '0123456789012' }));
    expect((await repo.findCustomByBarcode('0123456789012'))?.name).toBe('Protein bar');
    expect(await repo.findCustomByBarcode('nope')).toBeNull();
  });
});

describe('cached provider foods + favorites', () => {
  const cached = {
    provider: 'usda' as const,
    providerId: '12345',
    name: 'Cheddar cheese',
    barcode: '00012345',
    nutritionPer100g: { calories: 403, protein: 23, fat: 33 },
    flagged: false,
    cachedAt: '2026-07-13T00:00:00Z',
  };

  it('upserts and reads back', async () => {
    const { food: repo } = await signedInRepos(backend());
    await repo.upsertCachedFood(cached);
    await repo.upsertCachedFood({ ...cached, name: 'Cheddar cheese, sharp' });
    const got = await repo.getCachedFood('usda', '12345');
    expect(got?.name).toBe('Cheddar cheese, sharp');
    expect(got?.nutritionPer100g?.calories).toBe(403);
  });

  it('batches a result set in one call', async () => {
    const { food: repo } = await signedInRepos(backend());
    await repo.upsertCachedFoods([cached, { ...cached, providerId: '999', name: 'Brie' }]);
    expect((await repo.getCachedFood('usda', '999'))?.name).toBe('Brie');
    expect(await repo.searchCached('cheese')).toHaveLength(1);
  });

  it('finds by barcode and searches by name', async () => {
    const { food: repo } = await signedInRepos(backend());
    await repo.upsertCachedFood(cached);
    expect((await repo.findCachedByBarcode('00012345'))?.providerId).toBe('12345');
    expect(await repo.searchCached('cheddar')).toHaveLength(1);
  });

  it('keeps the flag through a refresh and never overwrites a corrected record', async () => {
    const { food: repo } = await signedInRepos(backend());
    await repo.upsertCachedFood(cached);
    await repo.setFlagged('usda', '12345', true);
    await repo.upsertCachedFood({ ...cached, name: 'Refreshed' });
    const got = await repo.getCachedFood('usda', '12345');
    expect(got?.flagged).toBe(true);
    expect(got?.name).toBe('Refreshed');

    await repo.upsertCachedFood({ ...cached, providerId: 'c1', name: 'Fixed by user', corrected: true });
    await repo.upsertCachedFood({ ...cached, providerId: 'c1', name: 'Provider says otherwise' });
    expect((await repo.getCachedFood('usda', 'c1'))?.name).toBe('Fixed by user');
  });

  it('upserts enrichment fields (restaurant, prep, verified, category)', async () => {
    const { food: repo } = await signedInRepos(backend());
    await repo.upsertCachedFood({
      ...cached,
      restaurant: 'Chipotle',
      preparationState: 'grilled',
      ingredients: ['chicken', 'rice'],
      allergens: ['none'],
      verified: true,
      lastVerified: '2026-07-01T00:00:00Z',
      category: 'restaurant',
      sourceLabel: 'Restaurant menu',
      nutritionPer100g: { calories: 200, protein: 20, carbs: 10, fat: 8, saturatedFat: 2 },
    });
    const got = await repo.getCachedFood('usda', '12345');
    expect(got?.restaurant).toBe('Chipotle');
    expect(got?.preparationState).toBe('grilled');
    expect(got?.ingredients).toEqual(['chicken', 'rice']);
    expect(got?.verified).toBe(true);
    expect(got?.category).toBe('restaurant');
    expect(got?.nutritionPer100g?.saturatedFat).toBe(2);
    expect(await repo.searchCached('chipotle')).toHaveLength(1);
  });

  it('provider-food favorites round-trip', async () => {
    const { food: repo } = await signedInRepos(backend());
    await repo.setFavorite('usda:12345', true);
    expect(await repo.isFavorite('usda:12345')).toBe(true);
    expect(await repo.listFavoriteKeys()).toEqual(['usda:12345']);
    await repo.setFavorite('usda:12345', false);
    expect(await repo.isFavorite('usda:12345')).toBe(false);
  });
});
