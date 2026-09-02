import { describe, expect, it } from 'vitest';
import { backend, signedInRepos } from './helpers';

describe('activity', () => {
  it('adds and lists entries for a date', async () => {
    const { activity } = await signedInRepos(backend());
    await activity.add({
      date: '2026-07-14',
      name: 'Morning run',
      activityType: 'cardio',
      durationMin: 32,
      distanceKm: 5.2,
      caloriesBurned: 310,
      intensity: 'moderate',
      sourceType: 'manual',
    });
    await activity.add({
      date: '2026-07-14',
      name: 'Push day',
      activityType: 'strength',
      durationMin: 45,
      caloriesBurned: 220,
      intensity: 'hard',
      sourceType: 'manual',
    });
    const list = await activity.entriesForDate('2026-07-14');
    expect(list).toHaveLength(2);
    expect(await activity.totalBurnedForDate('2026-07-14')).toBe(530);
    expect(await activity.get(list[0].id)).toMatchObject({ name: 'Morning run' });
  });

  it('finds previous sessions by name for improvement chips', async () => {
    const { activity } = await signedInRepos(backend());
    await activity.add({ date: '2026-07-01', name: '5k run', activityType: 'cardio', durationMin: 30, distanceKm: 5, caloriesBurned: 280, sourceType: 'manual' });
    await activity.add({ date: '2026-07-10', name: '5K Run', activityType: 'cardio', durationMin: 28, distanceKm: 5, caloriesBurned: 290, sourceType: 'manual' });
    await activity.add({ date: '2026-07-20', name: '5k run', activityType: 'cardio', durationMin: 27, distanceKm: 5, caloriesBurned: 295, sourceType: 'manual' });
    const prev = await activity.previousByName('5k run', '2026-07-14');
    expect(prev[0].durationMin).toBe(28);
    expect(prev).toHaveLength(2);
  });

  it('updates and removes entries', async () => {
    const { activity } = await signedInRepos(backend());
    const created = await activity.add({ date: '2026-07-14', name: 'Yoga', activityType: 'mobility', durationMin: 20, caloriesBurned: 80, sourceType: 'manual' });
    const updated = await activity.update(created.id, { caloriesBurned: 95, durationMin: 25, name: 'Hot yoga' });
    expect(updated.caloriesBurned).toBe(95);
    expect(updated.durationMin).toBe(25);
    expect(await activity.previousByName('hot yoga', '2026-07-15')).toHaveLength(1);
    await activity.remove(created.id);
    expect(await activity.entriesForDate('2026-07-14')).toHaveLength(0);
  });
});

describe('day notes', () => {
  it('adds, updates, and removes multiple notes per day', async () => {
    const { dayNotes } = await signedInRepos(backend());
    expect(await dayNotes.listForDate('2026-07-14')).toEqual([]);

    const a = await dayNotes.add('2026-07-14', '  Felt strong  ');
    const b = await dayNotes.add('2026-07-14', 'Late snack note');
    expect(a.body).toBe('Felt strong');
    expect((await dayNotes.listForDate('2026-07-14')).map((n) => n.body)).toEqual([
      'Felt strong',
      'Late snack note',
    ]);

    const updated = await dayNotes.update(a.id, 'Felt stronger');
    expect(updated.body).toBe('Felt stronger');

    await dayNotes.remove(b.id);
    expect((await dayNotes.listForDate('2026-07-14')).map((n) => n.body)).toEqual(['Felt stronger']);

    await expect(dayNotes.add('2026-07-14', '   ')).rejects.toThrow(/empty/i);
  });

  it('lists distinct dates with notes in a range', async () => {
    const { dayNotes } = await signedInRepos(backend());
    await dayNotes.add('2026-07-10', 'A');
    await dayNotes.add('2026-07-14', 'B1');
    await dayNotes.add('2026-07-14', 'B2');
    await dayNotes.add('2026-07-20', 'C');
    expect(await dayNotes.datesWithNotes('2026-07-12', '2026-07-18')).toEqual(['2026-07-14']);
  });
});
