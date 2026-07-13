import { createTestDb } from '@/db/__tests__/testDb';
import { createDiaryRepo, DiaryRepo, NewDiaryEntry } from '../diaryRepo';

const entry = (over: Partial<NewDiaryEntry> = {}): NewDiaryEntry => ({
  date: '2026-07-13',
  meal: 'breakfast',
  name: 'Greek yogurt',
  sourceType: 'manual',
  quantity: 1,
  unit: 'serving',
  nutrition: { calories: 150, protein: 15 },
  ...over,
});

describe('diaryRepo', () => {
  let repo: DiaryRepo;

  beforeEach(async () => {
    repo = createDiaryRepo(await createTestDb());
  });

  it('adds and reads entries by date', async () => {
    await repo.add(entry());
    await repo.add(entry({ meal: 'lunch', name: 'Burrito', nutrition: { calories: 560 } }));
    const list = await repo.entriesForDate('2026-07-13');
    expect(list).toHaveLength(2);
    expect(list[0].nutrition.calories).toBe(150);
  });

  it('updates an entry and preserves identity', async () => {
    const e = await repo.add(entry());
    const updated = await repo.update(e.id, { quantity: 2, nutrition: { calories: 300 } });
    expect(updated.quantity).toBe(2);
    const list = await repo.entriesForDate('2026-07-13');
    expect(list).toHaveLength(1);
    expect(list[0].nutrition.calories).toBe(300);
  });

  it('deletes entries (single and bulk)', async () => {
    const a = await repo.add(entry());
    const b = await repo.add(entry({ name: 'Eggs' }));
    const c = await repo.add(entry({ name: 'Toast' }));
    await repo.remove(a.id);
    await repo.removeMany([b.id, c.id]);
    expect(await repo.entriesForDate('2026-07-13')).toHaveLength(0);
  });

  it('duplicates an entry', async () => {
    const e = await repo.add(entry());
    const dup = await repo.duplicate(e.id);
    expect(dup.id).not.toBe(e.id);
    expect(dup.nutrition).toEqual(e.nutrition);
    expect(await repo.entriesForDate('2026-07-13')).toHaveLength(2);
  });

  it('moves an entry to another meal and date', async () => {
    const e = await repo.add(entry());
    await repo.move(e.id, 'dinner', '2026-07-14');
    expect(await repo.entriesForDate('2026-07-13')).toHaveLength(0);
    const moved = await repo.entriesForDate('2026-07-14');
    expect(moved[0].meal).toBe('dinner');
  });

  it('copies a meal to another date without touching the source', async () => {
    await repo.add(entry());
    await repo.add(entry({ name: 'Berries', nutrition: { calories: 40 } }));
    await repo.add(entry({ meal: 'lunch', name: 'Salad' }));
    const copied = await repo.copyMeal('2026-07-13', 'breakfast', '2026-07-14');
    expect(copied).toBe(2);
    expect(await repo.entriesForDate('2026-07-13')).toHaveLength(3);
    const target = await repo.entriesForDate('2026-07-14');
    expect(target).toHaveLength(2);
    expect(target.every((e) => e.meal === 'breakfast')).toBe(true);
  });

  it('copies an entire day', async () => {
    await repo.add(entry());
    await repo.add(entry({ meal: 'lunch', name: 'Salad' }));
    const copied = await repo.copyDay('2026-07-13', '2026-07-20');
    expect(copied).toBe(2);
    expect(await repo.entriesForDate('2026-07-20')).toHaveLength(2);
  });

  it('clears a meal', async () => {
    await repo.add(entry());
    await repo.add(entry({ name: 'Eggs' }));
    await repo.add(entry({ meal: 'lunch', name: 'Salad' }));
    const removed = await repo.clearMeal('2026-07-13', 'breakfast');
    expect(removed).toBe(2);
    expect(await repo.entriesForDate('2026-07-13')).toHaveLength(1);
  });

  it('reads a date range', async () => {
    await repo.add(entry({ date: '2026-07-10' }));
    await repo.add(entry({ date: '2026-07-12' }));
    await repo.add(entry({ date: '2026-07-15' }));
    const range = await repo.entriesForRange('2026-07-10', '2026-07-12');
    expect(range).toHaveLength(2);
  });

  it('degrades corrupted nutrition JSON to zero calories instead of crashing', async () => {
    const db = await createTestDb();
    const r = createDiaryRepo(db);
    await db.runAsync(
      `INSERT INTO diary_entries (id, date, meal, name, source_type, quantity, unit, nutrition, created_at, updated_at)
       VALUES ('bad', '2026-07-13', 'lunch', 'Corrupt', 'manual', 1, 'serving', '{not json', 'now', 'now')`,
    );
    const list = await r.entriesForDate('2026-07-13');
    expect(list[0].nutrition).toEqual({ calories: 0 });
  });
});
