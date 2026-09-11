import { resolveFastWindow } from '../fasting';

const MINUTE_MS = 60_000;

describe('resolveFastWindow', () => {
  it('starts a future window immediately and keeps the same duration', () => {
    const now = Date.parse('2026-09-11T12:23:10.000Z');
    const startAt = Date.parse('2026-09-11T12:25:00.000Z');
    const endAt = startAt + 12 * 60 * MINUTE_MS;

    expect(resolveFastWindow(startAt, endAt, now)).toEqual({
      startAt: now,
      endAt: now + 12 * 60 * MINUTE_MS,
    });
  });

  it('leaves a backdated or already-started window unchanged', () => {
    const now = Date.parse('2026-09-11T12:23:10.000Z');
    const startAt = Date.parse('2026-09-11T10:00:00.000Z');
    const endAt = Date.parse('2026-09-11T22:00:00.000Z');

    expect(resolveFastWindow(startAt, endAt, now)).toEqual({ startAt, endAt });
  });

  it('never returns an empty window when the times are inverted', () => {
    const now = Date.parse('2026-09-11T12:00:00.000Z');
    expect(resolveFastWindow(now + 5_000, now + 1_000, now)).toEqual({
      startAt: now,
      endAt: now + MINUTE_MS,
    });
  });
});
