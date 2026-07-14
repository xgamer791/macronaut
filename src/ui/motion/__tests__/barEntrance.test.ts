import {
  hasBarEntrancePlayedForTests,
  markBarEntrancePlayedForTests,
  resetBarEntranceForTests,
} from '../barEntranceStore';

describe('barEntrance session flags', () => {
  beforeEach(() => {
    resetBarEntranceForTests();
  });

  it('marks a page as played once per session', () => {
    expect(hasBarEntrancePlayedForTests('today')).toBe(false);
    markBarEntrancePlayedForTests('today');
    expect(hasBarEntrancePlayedForTests('today')).toBe(true);
    markBarEntrancePlayedForTests('today');
    expect(hasBarEntrancePlayedForTests('today')).toBe(true);
    expect(hasBarEntrancePlayedForTests('progress')).toBe(false);
  });
});
