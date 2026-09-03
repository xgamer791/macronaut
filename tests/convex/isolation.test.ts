import { describe, expect, it } from 'vitest';
import { api } from '../../convex/_generated/api';
import { backend, signIn } from './helpers';

/** The guarantee everything else rests on: one account can neither read nor
 * touch another's rows, and nothing works without a session at all. */
describe('account isolation', () => {
  it('keeps two accounts apart', async () => {
    const t = backend();
    const a = await signIn(t, 'a@example.com');
    const b = await signIn(t, 'b@example.com');

    const mine = await a.repos.diary.add({
      date: '2026-07-13',
      meal: 'lunch',
      name: 'Salad',
      sourceType: 'manual',
      quantity: 1,
      unit: 'serving',
      nutrition: { calories: 320 },
    });
    await a.repos.settings.set('displayName', 'A');
    await a.repos.dayNotes.add('2026-07-13', 'Felt strong');

    expect(await b.repos.diary.entriesForDate('2026-07-13')).toEqual([]);
    expect(await b.repos.settings.get('displayName', 'nobody')).toBe('nobody');
    expect(await b.repos.dayNotes.listForDate('2026-07-13')).toEqual([]);

    // Knowing an id is not enough to read, edit or delete the row.
    await expect(b.repos.diary.update(mine.id, { name: 'Hijacked' })).rejects.toThrow();
    await b.repos.diary.remove(mine.id);
    await expect(b.repos.diary.duplicate(mine.id)).rejects.toThrow();
    const still = await a.repos.diary.entriesForDate('2026-07-13');
    expect(still).toHaveLength(1);
    expect(still[0].name).toBe('Salad');
  });

  it('refuses every call without a session', async () => {
    const t = backend();
    await expect(t.query(api.diary.entriesForDate, { date: '2026-07-13' })).rejects.toThrow(
      /not signed in/i,
    );
    await expect(t.mutation(api.settings.set, { key: 'x', value: '1' })).rejects.toThrow(
      /not signed in/i,
    );
    await expect(t.mutation(api.account.deleteAllData, {})).rejects.toThrow(/not signed in/i);
    await expect(t.query(api.foodScan.available, {})).rejects.toThrow(/not signed in/i);
    await expect(
      t.action(api.foodScan.analyzePhoto, { dataUrl: 'data:image/jpeg;base64,abc' }),
    ).rejects.toThrow(/not signed in/i);
  });

  it('deleteAllData erases only the caller, and deleteAccount removes the user', async () => {
    const t = backend();
    const a = await signIn(t, 'a@example.com');
    const b = await signIn(t, 'b@example.com');
    for (const who of [a, b]) {
      await who.repos.diary.add({
        date: '2026-07-13',
        meal: 'lunch',
        name: 'Salad',
        sourceType: 'manual',
        quantity: 1,
        unit: 'serving',
        nutrition: { calories: 320 },
      });
      await who.repos.settings.set('unitSystem', 'metric');
      await who.repos.history.recordLog('manual:1', 'Salad', 'lunch');
    }

    await a.repos.account.deleteAllData();
    expect(await a.repos.diary.entriesForDate('2026-07-13')).toEqual([]);
    expect(await a.repos.settings.getUnitSystem()).toBe('us');
    expect(await b.repos.diary.entriesForDate('2026-07-13')).toHaveLength(1);
    expect(await b.repos.settings.getUnitSystem()).toBe('metric');

    await b.repos.account.deleteAccount();
    const users = await t.run(async (ctx) => ctx.db.query('users').collect());
    expect(users.map((u) => u.email)).toEqual(['a@example.com']);
    const sessions = await t.run(async (ctx) => ctx.db.query('authSessions').collect());
    expect(sessions.map((s) => s.userId)).toEqual([a.userId]);
  });
});
