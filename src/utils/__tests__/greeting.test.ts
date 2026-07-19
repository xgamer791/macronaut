import { displayFirstName, greetingForHour } from '../greeting';

describe('greetingForHour', () => {
  it('returns morning in the morning', () => {
    expect(greetingForHour(7)).toBe('Good morning');
    expect(greetingForHour(11)).toBe('Good morning');
  });

  it('returns afternoon midday', () => {
    expect(greetingForHour(12)).toBe('Good afternoon');
    expect(greetingForHour(16)).toBe('Good afternoon');
  });

  it('returns evening at nightfall', () => {
    expect(greetingForHour(17)).toBe('Good evening');
    expect(greetingForHour(21)).toBe('Good evening');
  });

  it('returns night late', () => {
    expect(greetingForHour(23)).toBe('Good night');
    expect(greetingForHour(2)).toBe('Good night');
  });
});

describe('displayFirstName', () => {
  it('uses first token and returns null when unset', () => {
    expect(displayFirstName('Alex Rivera')).toBe('Alex');
    expect(displayFirstName('  ')).toBeNull();
    expect(displayFirstName(undefined)).toBeNull();
  });
});
