import {
  emailsMatch,
  isValidSignupCredentials,
  isValidSignupName,
  isValidSignupPassword,
  passwordsMatch,
} from '@/domain/signupCredentials';

describe('signup credentials', () => {
  it('requires a non-empty name', () => {
    expect(isValidSignupName('')).toBe(false);
    expect(isValidSignupName('   ')).toBe(false);
    expect(isValidSignupName('Sam Lee')).toBe(true);
  });

  it('requires matching plausible emails', () => {
    expect(emailsMatch('samlee.mobbin@gmail.com', 'samlee.mobbin@gmail.com')).toBe(true);
    expect(emailsMatch('Sam@Ex.com', 'sam@ex.com')).toBe(true);
    expect(emailsMatch('sam@ex.com', 'other@ex.com')).toBe(false);
    expect(emailsMatch('not-an-email', 'not-an-email')).toBe(false);
  });

  it('requires 8 characters with upper, lower, and a number', () => {
    expect(isValidSignupPassword('Short1A')).toBe(false);
    expect(isValidSignupPassword('alllowercase1')).toBe(false);
    expect(isValidSignupPassword('ALLUPPERCASE1')).toBe(false);
    expect(isValidSignupPassword('NoNumberHere')).toBe(false);
    expect(isValidSignupPassword('ValidPass1')).toBe(true);
  });

  it('requires the password confirmation to match', () => {
    expect(passwordsMatch('ValidPass1', 'ValidPass1')).toBe(true);
    expect(passwordsMatch('ValidPass1', 'ValidPass2')).toBe(false);
    expect(passwordsMatch('', '')).toBe(false);
  });

  it('accepts a complete form', () => {
    expect(
      isValidSignupCredentials(
        'Sam Lee',
        'samlee.mobbin@gmail.com',
        'samlee.mobbin@gmail.com',
        'ValidPass1',
        'ValidPass1',
      ),
    ).toBe(true);
    expect(
      isValidSignupCredentials(
        'Sam Lee',
        'samlee.mobbin@gmail.com',
        'samlee.mobbin@gmail.com',
        'ValidPass1',
        'WrongPass1',
      ),
    ).toBe(false);
  });
});
