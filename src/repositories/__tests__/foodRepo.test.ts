import { createTestDb } from '@/db/__tests__/testDb';
import { createFoodRepo, FoodRepo, NewCustomFood } from '../foodRepo';

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

describe('foodRepo — custom foods', () => {
  let repo: FoodRepo;

  beforeEach(async () => {
    repo = createFoodRepo(await createTestDb());
  });

  it('creates, reads, searches', async () => {
    await repo.addCustomFood(food());
    await repo.addCustomFood(food({ name: 'Oatmeal', brand: undefined }));
    expect(await repo.listCustomFoods()).toHaveLength(2);
    expect(await repo.listCustomFoods('oat')).toHaveLength(1);
    expect(await repo.listCustomFoods('acme')).toHaveLength(1); // brand match
  });

  it('validates name and negative calories', async () => {
    await expect(repo.addCustomFood(food({ name: '  ' }))).rejects.toThrow('name');
    await expect(
      repo.addCustomFood(food({ nutrition: { calories: -100 } })),
    ).rejects.toThrow('negative');
  });

  it('updates and soft-deletes', async () => {
    const f = await repo.addCustomFood(food());
    await repo.updateCustomFood(f.id, { name: 'Better bar' });
    expect((await repo.getCustomFood(f.id))?.name).toBe('Better bar');
    await repo.deleteCustomFood(f.id);
    expect(await repo.getCustomFood(f.id)).toBeNull();
    expect(await repo.listCustomFoods()).toHaveLength(0);
  });

  it('duplicates with a copy suffix', async () => {
    const f = await repo.addCustomFood(food());
    const dup = await repo.duplicateCustomFood(f.id);
    expect(dup.name).toBe('Protein bar (copy)');
    expect(dup.nutrition).toEqual(f.nutrition);
  });

  it('favorites toggle', async () => {
    const f = await repo.addCustomFood(food());
    await repo.setCustomFavorite(f.id, true);
    expect((await repo.getCustomFood(f.id))?.favorite).toBe(true);
  });

  it('finds by barcode', async () => {
    await repo.addCustomFood(food({ barcode: '0123456789012' }));
    expect((await repo.findCustomByBarcode('0123456789012'))?.name).toBe('Protein bar');
    expect(await repo.findCustomByBarcode('nope')).toBeNull();
  });
});

describe('foodRepo — cached provider foods + favorites', () => {
  let repo: FoodRepo;

  beforeEach(async () => {
    repo = createFoodRepo(await createTestDb());
  });

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
    await repo.upsertCachedFood(cached);
    await repo.upsertCachedFood({ ...cached, name: 'Cheddar cheese, sharp' });
    const got = await repo.getCachedFood('usda', '12345');
    expect(got?.name).toBe('Cheddar cheese, sharp');
    expect(got?.nutritionPer100g?.calories).toBe(403);
  });

  it('finds by barcode and searches by name', async () => {
    await repo.upsertCachedFood(cached);
    expect((await repo.findCachedByBarcode('00012345'))?.providerId).toBe('12345');
    expect(await repo.searchCached('cheddar')).toHaveLength(1);
  });

  it('flags inaccurate foods locally', async () => {
    await repo.upsertCachedFood(cached);
    await repo.setFlagged('usda', '12345', true);
    expect((await repo.getCachedFood('usda', '12345'))?.flagged).toBe(true);
  });

  it('provider-food favorites round-trip', async () => {
    await repo.setFavorite('usda:12345', true);
    expect(await repo.isFavorite('usda:12345')).toBe(true);
    expect(await repo.listFavoriteKeys()).toEqual(['usda:12345']);
    await repo.setFavorite('usda:12345', false);
    expect(await repo.isFavorite('usda:12345')).toBe(false);
  });
});
