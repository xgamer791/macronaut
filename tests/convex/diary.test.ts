import { describe, expect, it } from 'vitest';
import type { NewDiaryEntry } from '../../src/repositories/diaryRepo';
import { backend, signedInRepos } from './helpers';

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

describe('diary', () => {
  it('adds and reads entries by date', async () => {
    const { diary } = await signedInRepos(backend());
    await diary.add(entry());
    await diary.add(entry({ meal: 'lunch', name: 'Burrito', nutrition: { calories: 560 } }));
    const list = await diary.entriesForDate('2026-07-13');
    expect(list).toHaveLength(2);
    expect(list[0].nutrition.calories).toBe(150);
    expect(list[0].id).toBeTypeOf('string');
  });

  it('updates an entry and preserves identity', async () => {
    const { diary } = await signedInRepos(backend());
    const e = await diary.add(entry());
    const updated = await diary.update(e.id, { quantity: 2, nutrition: { calories: 300 } });
    expect(updated.quantity).toBe(2);
    expect(updated.id).toBe(e.id);
    const list = await diary.entriesForDate('2026-07-13');
    expect(list).toHaveLength(1);
    expect(list[0].nutrition.calories).toBe(300);
  });

  it('drops undefined optional fields instead of rejecting them', async () => {
    const { diary } = await signedInRepos(backend());
    const e = await diary.add(entry({ brand: undefined, notes: undefined, time: undefined }));
    expect(e.brand).toBeUndefined();
    const updated = await diary.update(e.id, { notes: undefined, name: 'Skyr' });
    expect(updated.name).toBe('Skyr');
  });

  it('deletes entries (single and bulk)', async () => {
    const { diary } = await signedInRepos(backend());
    const a = await diary.add(entry());
    const b = await diary.add(entry({ name: 'Eggs' }));
    const c = await diary.add(entry({ name: 'Toast' }));
    await diary.remove(a.id);
    await diary.removeMany([b.id, c.id]);
    expect(await diary.entriesForDate('2026-07-13')).toHaveLength(0);
  });

  it('duplicates an entry', async () => {
    const { diary } = await signedInRepos(backend());
    const e = await diary.add(entry());
    const dup = await diary.duplicate(e.id);
    expect(dup.id).not.toBe(e.id);
    expect(dup.nutrition).toEqual(e.nutrition);
    expect(await diary.entriesForDate('2026-07-13')).toHaveLength(2);
  });

  it('moves an entry to another meal and date', async () => {
    const { diary } = await signedInRepos(backend());
    const e = await diary.add(entry());
    await diary.move(e.id, 'dinner', '2026-07-14');
    expect(await diary.entriesForDate('2026-07-13')).toHaveLength(0);
    const moved = await diary.entriesForDate('2026-07-14');
    expect(moved[0].meal).toBe('dinner');
  });

  it('copies a meal to another date without touching the source', async () => {
    const { diary } = await signedInRepos(backend());
    await diary.add(entry());
    await diary.add(entry({ name: 'Berries', nutrition: { calories: 40 } }));
    await diary.add(entry({ meal: 'lunch', name: 'Salad' }));
    const copied = await diary.copyMeal('2026-07-13', 'breakfast', '2026-07-14');
    expect(copied).toBe(2);
    expect(await diary.entriesForDate('2026-07-13')).toHaveLength(3);
    const target = await diary.entriesForDate('2026-07-14');
    expect(target).toHaveLength(2);
    expect(target.every((e) => e.meal === 'breakfast')).toBe(true);
  });

  it('copies an entire day', async () => {
    const { diary } = await signedInRepos(backend());
    await diary.add(entry());
    await diary.add(entry({ meal: 'lunch', name: 'Salad' }));
    const copied = await diary.copyDay('2026-07-13', '2026-07-20');
    expect(copied).toBe(2);
    expect(await diary.entriesForDate('2026-07-20')).toHaveLength(2);
  });

  it('clears a meal', async () => {
    const { diary } = await signedInRepos(backend());
    await diary.add(entry());
    await diary.add(entry({ name: 'Eggs' }));
    await diary.add(entry({ meal: 'lunch', name: 'Salad' }));
    const removed = await diary.clearMeal('2026-07-13', 'breakfast');
    expect(removed).toBe(2);
    expect(await diary.entriesForDate('2026-07-13')).toHaveLength(1);
  });

  it('reads a date range in date order', async () => {
    const { diary } = await signedInRepos(backend());
    await diary.add(entry({ date: '2026-07-12' }));
    await diary.add(entry({ date: '2026-07-10' }));
    await diary.add(entry({ date: '2026-07-15' }));
    const range = await diary.entriesForRange('2026-07-10', '2026-07-12');
    expect(range.map((e) => e.date)).toEqual(['2026-07-10', '2026-07-12']);
  });
});
