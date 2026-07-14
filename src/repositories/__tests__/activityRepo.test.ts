import { createTestDb } from '@/db/__tests__/testDb';
import { createActivityRepo } from '../activityRepo';

describe('activityRepo', () => {
  it('adds and lists entries for a date', async () => {
    const repo = createActivityRepo(await createTestDb());
    await repo.add({
      date: '2026-07-14',
      name: 'Morning run',
      activityType: 'cardio',
      durationMin: 32,
      distanceKm: 5.2,
      caloriesBurned: 310,
      intensity: 'moderate',
      sourceType: 'manual',
    });
    await repo.add({
      date: '2026-07-14',
      name: 'Push day',
      activityType: 'strength',
      durationMin: 45,
      caloriesBurned: 220,
      intensity: 'hard',
      sourceType: 'manual',
    });
    const list = await repo.entriesForDate('2026-07-14');
    expect(list).toHaveLength(2);
    expect(await repo.totalBurnedForDate('2026-07-14')).toBe(530);
  });

  it('finds previous sessions by name for improvement chips', async () => {
    const repo = createActivityRepo(await createTestDb());
    await repo.add({
      date: '2026-07-01',
      name: '5k run',
      activityType: 'cardio',
      durationMin: 30,
      distanceKm: 5,
      caloriesBurned: 280,
      sourceType: 'manual',
    });
    await repo.add({
      date: '2026-07-10',
      name: '5k run',
      activityType: 'cardio',
      durationMin: 28,
      distanceKm: 5,
      caloriesBurned: 290,
      sourceType: 'manual',
    });
    const prev = await repo.previousByName('5k run', '2026-07-14');
    expect(prev[0].durationMin).toBe(28);
    expect(prev).toHaveLength(2);
  });

  it('updates and removes entries', async () => {
    const repo = createActivityRepo(await createTestDb());
    const created = await repo.add({
      date: '2026-07-14',
      name: 'Yoga',
      activityType: 'mobility',
      durationMin: 20,
      caloriesBurned: 80,
      sourceType: 'manual',
    });
    const updated = await repo.update(created.id, { caloriesBurned: 95, durationMin: 25 });
    expect(updated.caloriesBurned).toBe(95);
    expect(updated.durationMin).toBe(25);
    await repo.remove(created.id);
    expect(await repo.entriesForDate('2026-07-14')).toHaveLength(0);
  });
});
