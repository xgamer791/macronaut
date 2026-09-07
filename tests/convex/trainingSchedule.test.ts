import { describe, expect, it } from 'vitest';
import { api } from '../../convex/_generated/api';
import { backend, signIn } from './helpers';

describe('training schedule', () => {
  it('stores free-form day plans and replaces a date without duplicating it', async () => {
    const { repos } = await signIn(backend());

    const saved = await repos.trainingSchedule.save({
      date: '2026-09-07',
      label: '  Track speed + mobility  ',
      notes: '  Stay relaxed through the final reps.  ',
      workouts: [
        { id: 'reps', label: '  400 m repeats  ', macroLabel: '  Speed  ', sets: 8 },
        { id: 'hips', label: 'Hip mobility flow', macroLabel: 'Recovery' },
      ],
    });

    expect(saved).toMatchObject({
      date: '2026-09-07',
      label: 'Track speed + mobility',
      notes: 'Stay relaxed through the final reps.',
      workouts: [
        { id: 'reps', label: '400 m repeats', macroLabel: 'Speed', sets: 8 },
        { id: 'hips', label: 'Hip mobility flow', macroLabel: 'Recovery' },
      ],
    });

    await repos.trainingSchedule.save({
      date: '2026-09-07',
      label: 'Rest and reset',
      workouts: [],
    });
    expect(await repos.trainingSchedule.range('2026-09-07', '2026-09-13')).toEqual([
      expect.objectContaining({
        id: saved.id,
        label: 'Rest and reset',
        workouts: [],
      }),
    ]);
  });

  it('validates user-authored plans on the server', async () => {
    const { repos } = await signIn(backend());
    await expect(
      repos.trainingSchedule.save({ date: '2026-02-30', label: 'Impossible', workouts: [] }),
    ).rejects.toThrow(/valid training day/i);
    await expect(
      repos.trainingSchedule.save({ date: '2026-09-07', label: ' ', workouts: [] }),
    ).rejects.toThrow(/label/i);
    await expect(
      repos.trainingSchedule.save({
        date: '2026-09-07',
        label: 'Intervals',
        workouts: [{ id: 'run', label: 'Run', sets: 1.5 }],
      }),
    ).rejects.toThrow(/whole number/i);
  });

  it('keeps schedules private and deletes them with account data', async () => {
    const t = backend();
    const alice = await signIn(t, 'schedule-alice@example.com');
    const bob = await signIn(t, 'schedule-bob@example.com');
    await alice.repos.trainingSchedule.save({
      date: '2026-09-07',
      label: 'Pool work',
      workouts: [{ id: 'swim', label: 'Threshold swim', macroLabel: 'Aerobic', sets: 5 }],
    });

    expect(await bob.repos.trainingSchedule.range('2026-09-07', '2026-09-13')).toEqual([]);
    await expect(
      t.query(api.trainingSchedule.range, { from: '2026-09-07', to: '2026-09-13' }),
    ).rejects.toThrow(/not signed in/i);

    await alice.repos.account.deleteAllData();
    expect(await alice.repos.trainingSchedule.range('2026-09-07', '2026-09-13')).toEqual([]);
  });
});
