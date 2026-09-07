import {
  DAY_MS,
  GYM_VOTE_RULES,
  distinctActiveVoters,
  isRestricted,
  nextThreshold,
  outcomeFor,
  untilIso,
  untilLabel,
} from '../../../../convex/lib/gymVotes';

const NOW = Date.parse('2026-09-07T12:00:00.000Z');
const ago = (days: number) => new Date(NOW - days * DAY_MS).toISOString();

describe('gym vote rules', () => {
  it('reads three as a suspension and five as a ban', () => {
    expect(outcomeFor(0, false)).toBe('none');
    expect(outcomeFor(2, false)).toBe('none');
    expect(outcomeFor(3, false)).toBe('suspend');
    expect(outcomeFor(4, false)).toBe('suspend');
    expect(outcomeFor(5, false)).toBe('ban');
    // Already suspended: only the ban tier does anything more.
    expect(outcomeFor(3, true)).toBe('none');
    expect(outcomeFor(4, true)).toBe('none');
    expect(outcomeFor(5, true)).toBe('ban');
    expect(GYM_VOTE_RULES.SUSPEND_VOTES).toBe(3);
    expect(GYM_VOTE_RULES.BAN_VOTES).toBe(5);
  });

  it('counts each voter once and only within the window', () => {
    const votes = [
      { voterUserId: 'a', createdAt: ago(1) },
      { voterUserId: 'a', createdAt: ago(2) },
      { voterUserId: 'b', createdAt: ago(6.9) },
      { voterUserId: 'c', createdAt: ago(7.1) },
      { voterUserId: 'd', createdAt: 'not a date' },
    ];
    expect(distinctActiveVoters(votes, NOW)).toBe(2);
  });

  it('knows when a restriction has lapsed', () => {
    expect(isRestricted(null, NOW)).toBe(false);
    expect(isRestricted({ until: ago(-1) }, NOW)).toBe(true);
    expect(isRestricted({ until: ago(1) }, NOW)).toBe(false);
    expect(untilIso(NOW, GYM_VOTE_RULES.BAN_DAYS)).toBe('2026-10-07T12:00:00.000Z');
    expect(untilLabel('2026-10-07T12:00:00.000Z')).toBe('2026-10-07');
  });

  it('labels the tier a tally is counting toward', () => {
    expect(nextThreshold('member')).toBe(3);
    expect(nextThreshold('suspended')).toBe(5);
  });
});
