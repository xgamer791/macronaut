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

  it('repeats a selected weekday and uses the latest saved workout as its template', async () => {
    const { repos } = await signIn(backend());
    await repos.trainingSchedule.save({
      date: '2026-09-07',
      label: 'Monday strength',
      workouts: [{ id: 'squat', label: 'Back squat', sets: 5 }],
    });

    expect(await repos.trainingSchedule.setRepeatDay('2026-09-07', true)).toEqual([1]);
    expect(await repos.trainingSchedule.repeatDays()).toEqual([1]);
    expect(await repos.trainingSchedule.range('2026-09-14', '2026-09-20')).toEqual([
      expect.objectContaining({
        date: '2026-09-14',
        label: 'Monday strength',
        workouts: [{ id: 'squat', label: 'Back squat', sets: 5 }],
      }),
    ]);

    await repos.trainingSchedule.save({
      date: '2026-09-14',
      label: 'Updated Monday strength',
      workouts: [{ id: 'deadlift', label: 'Deadlift', sets: 3 }],
    });
    expect(await repos.trainingSchedule.range('2026-09-21', '2026-09-27')).toEqual([
      expect.objectContaining({
        date: '2026-09-21',
        label: 'Updated Monday strength',
        workouts: [{ id: 'deadlift', label: 'Deadlift', sets: 3 }],
      }),
    ]);

    await repos.trainingSchedule.setRepeatDay('2026-09-14', false);
    expect(await repos.trainingSchedule.repeatDays()).toEqual([]);
    expect(await repos.trainingSchedule.range('2026-09-21', '2026-09-27')).toEqual([]);
  });

  it('turns all seven repeat rules on and off with one setting', async () => {
    const { repos } = await signIn(backend());
    const week = [
      '2026-09-07',
      '2026-09-08',
      '2026-09-09',
      '2026-09-10',
      '2026-09-11',
      '2026-09-12',
      '2026-09-13',
    ];
    await repos.trainingSchedule.save({
      date: week[0],
      label: 'Monday strength',
      workouts: [{ id: 'squat', label: 'Squat', sets: 5 }],
    });
    await repos.trainingSchedule.save({
      date: week[1],
      label: 'Tuesday run',
      workouts: [{ id: 'run', label: 'Easy run' }],
    });

    expect(await repos.trainingSchedule.setRepeatAll(week, true)).toEqual([0, 1, 2, 3, 4, 5, 6]);
    expect(await repos.trainingSchedule.range('2026-09-14', '2026-09-20')).toEqual([
      expect.objectContaining({ date: '2026-09-14', label: 'Monday strength' }),
      expect.objectContaining({ date: '2026-09-15', label: 'Tuesday run' }),
    ]);

    expect(await repos.trainingSchedule.setRepeatAll(week, false)).toEqual([]);
    expect(await repos.trainingSchedule.range('2026-09-14', '2026-09-20')).toEqual([]);
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
    await alice.repos.trainingSchedule.setRepeatDay('2026-09-07', true);
    expect(await bob.repos.trainingSchedule.repeatDays()).toEqual([]);
    await expect(t.query(api.trainingSchedule.repeatDays, {})).rejects.toThrow(/not signed in/i);

    await alice.repos.account.deleteAllData();
    expect(await alice.repos.trainingSchedule.range('2026-09-07', '2026-09-13')).toEqual([]);
    expect(await alice.repos.trainingSchedule.repeatDays()).toEqual([]);
  });
});
