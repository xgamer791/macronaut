import { continues, dayLabel, groupMessages, messageTime } from '@/domain/chatThread';
import type { ChatMessage } from '@/repositories/chatRepo';

/** A message at a wall-clock time on a given local day. */
function message(id: string, at: Date, isMine: boolean, body = id): ChatMessage {
  return { id, body, createdAt: at.toISOString(), isMine };
}

function at(day: number, hour: number, minute = 0): Date {
  return new Date(2026, 2, day, hour, minute, 0);
}

const NOW = at(12, 18);

describe('chat thread shape', () => {
  it('runs consecutive messages from one person into a single turn', () => {
    const turns = groupMessages(
      [
        message('a1', at(12, 9, 0), false),
        message('a2', at(12, 9, 2), false),
        message('a3', at(12, 9, 3), false),
        message('b1', at(12, 9, 4), true),
      ],
      NOW,
    );

    // Only the first of a run carries the gutter, only the last the tail.
    expect(turns.map((turn) => turn.first)).toEqual([true, false, false, true]);
    expect(turns.map((turn) => turn.last)).toEqual([false, false, true, true]);
  });

  it('breaks a run once the gap outgrows the grouping window', () => {
    const turns = groupMessages(
      [message('a1', at(12, 9, 0), false), message('a2', at(12, 9, 6), false)],
      NOW,
    );
    expect(turns.map((turn) => turn.first)).toEqual([true, true]);
    expect(turns.map((turn) => turn.last)).toEqual([true, true]);
  });

  it('never groups across senders, or across a day boundary', () => {
    const mine = message('mine', at(12, 9, 0), true);
    const theirs = message('theirs', at(12, 9, 1), false);
    expect(continues(mine, theirs)).toBe(false);

    const lateLastNight = message('late', new Date(2026, 2, 11, 23, 59), false);
    const earlyToday = message('early', new Date(2026, 2, 12, 0, 1), false);
    expect(continues(lateLastNight, earlyToday)).toBe(false);
  });

  it('keys a run by its sender, so two group members never share a bubble run', () => {
    const from = (id: string, at: Date, sender: string) => ({
      ...message(id, at, false),
      sender: { id: sender },
    });
    // Two people inside the window: two runs. The same person: one run.
    expect(continues(from('a', at(12, 9, 0), 'ana'), from('b', at(12, 9, 1), 'ben'))).toBe(false);
    expect(continues(from('a', at(12, 9, 0), 'ana'), from('b', at(12, 9, 1), 'ana'))).toBe(true);
    // A direct chat names no sender: the one peer is a single run, as before.
    expect(continues(message('a', at(12, 9, 0), false), message('b', at(12, 9, 1), false))).toBe(
      true,
    );
    // The viewer's own messages run together whether or not they carry a sender.
    expect(
      continues(message('a', at(12, 9, 0), true), {
        ...message('b', at(12, 9, 1), true),
        sender: { id: 'me' },
      }),
    ).toBe(true);

    const turns = groupMessages(
      [
        from('a1', at(12, 9, 0), 'ana'),
        from('b1', at(12, 9, 1), 'ben'),
        from('b2', at(12, 9, 2), 'ben'),
        from('a2', at(12, 9, 3), 'ana'),
      ],
      NOW,
    );
    expect(turns.map((turn) => turn.first)).toEqual([true, true, false, true]);
    expect(turns.map((turn) => turn.last)).toEqual([true, false, true, true]);
    // The message keeps its own shape through the turn.
    expect(turns[1]?.message.sender.id).toBe('ben');
  });

  it('heads each new day once, and only when the date changes', () => {
    const turns = groupMessages(
      [
        message('old', at(9, 12), false),
        message('yesterday', at(11, 12), true),
        message('today1', at(12, 8), false),
        message('today2', at(12, 17), false),
      ],
      NOW,
    );

    expect(turns.map((turn) => turn.daySeparator)).toEqual([
      dayLabel(at(9, 12).toISOString(), NOW),
      'Yesterday',
      'Today',
      null,
    ]);
  });

  it('names the last week and dates anything older', () => {
    expect(dayLabel(at(12, 9).toISOString(), NOW)).toBe('Today');
    expect(dayLabel(at(11, 9).toISOString(), NOW)).toBe('Yesterday');
    // Three days back is inside the week, so it reads as a weekday name.
    expect(dayLabel(at(9, 9).toISOString(), NOW)).toBe(
      at(9, 9).toLocaleDateString([], { weekday: 'long' }),
    );
    // A week back is a date, and a different year keeps its year.
    expect(dayLabel(at(1, 9).toISOString(), NOW)).toMatch(/Mar/);
    expect(dayLabel(new Date(2024, 0, 4, 9).toISOString(), NOW)).toMatch(/2024/);
  });

  it('leaves an unreadable timestamp blank rather than printing Invalid Date', () => {
    expect(dayLabel('not-a-date', NOW)).toBe('');
    expect(messageTime('not-a-date')).toBe('');
    expect(messageTime(at(12, 9, 5).toISOString())).toMatch(/\d/);
  });

  it('gives a lone message both ends of its own run', () => {
    const [only] = groupMessages([message('a1', at(12, 9), false)], NOW);
    expect(only).toMatchObject({ first: true, last: true, daySeparator: 'Today' });
    expect(groupMessages([], NOW)).toEqual([]);
  });
});
