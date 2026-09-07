import { describe, expect, it } from 'vitest';
import { api } from '../../convex/_generated/api';
import { backend, signIn } from './helpers';

describe('fasting tracker', () => {
  it('persists an active timer and clears it without losing saved times', async () => {
    const t = backend();
    const { repos } = await signIn(t);

    expect(await repos.fasting.state()).toEqual({
      activeStartAt: null,
      activeEndAt: null,
      customSlots: [],
      updatedAt: null,
    });

    const startAt = Date.now() - 3_600_000;
    const endAt = startAt + 12 * 3_600_000;
    await repos.fasting.start(startAt, endAt);
    const slot = await repos.fasting.saveSlot('Weekday 16:8', 16 * 60);

    expect(await repos.fasting.state()).toMatchObject({
      activeStartAt: startAt,
      activeEndAt: endAt,
      customSlots: [{ id: slot.id, label: 'Weekday 16:8', durationMinutes: 960 }],
    });

    await repos.fasting.stop();
    expect(await repos.fasting.state()).toMatchObject({
      activeStartAt: null,
      activeEndAt: null,
      customSlots: [{ id: slot.id }],
    });
  });

  it('validates times and enforces ten custom slots on the server', async () => {
    const { repos } = await signIn(backend());
    await expect(repos.fasting.start(2_000, 1_000)).rejects.toThrow(/end after it starts/i);
    await expect(repos.fasting.saveSlot(' ', 60)).rejects.toThrow(/name/i);
    await expect(repos.fasting.saveSlot('Invalid', 0)).rejects.toThrow(/longer than zero/i);

    const slots = [];
    for (let index = 0; index < 10; index += 1) {
      slots.push(await repos.fasting.saveSlot(`Routine ${index + 1}`, 480 + index));
    }
    expect((await repos.fasting.state()).customSlots).toHaveLength(10);
    await expect(repos.fasting.saveSlot('One too many', 600)).rejects.toThrow(/up to 10/i);

    await repos.fasting.removeSlot(slots[0].id);
    await expect(repos.fasting.saveSlot('Replacement', 600)).resolves.toMatchObject({
      label: 'Replacement',
    });
  });

  it('isolates each account, refuses signed-out access, and participates in data deletion', async () => {
    const t = backend();
    const a = await signIn(t, 'fast-a@example.com');
    const b = await signIn(t, 'fast-b@example.com');
    await a.repos.fasting.start(1_000, 2_000);
    await b.repos.fasting.start(3_000, 5_000);

    expect((await a.repos.fasting.state()).activeStartAt).toBe(1_000);
    expect((await b.repos.fasting.state()).activeStartAt).toBe(3_000);
    await expect(t.query(api.fasting.state, {})).rejects.toThrow(/not signed in/i);
    await expect(t.mutation(api.fasting.start, { startAt: 1, endAt: 2 })).rejects.toThrow(
      /not signed in/i,
    );

    await a.repos.account.deleteAllData();
    expect(await a.repos.fasting.state()).toMatchObject({
      activeStartAt: null,
      activeEndAt: null,
      customSlots: [],
    });
    expect((await b.repos.fasting.state()).activeStartAt).toBe(3_000);
  });
});
