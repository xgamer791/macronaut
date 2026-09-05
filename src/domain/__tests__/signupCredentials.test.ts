import {
  confirmationSettled,
  emailAllowsSignup,
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

  it('waits for a confirmation to say something before calling it a mismatch', () => {
    // Mid-keystroke: "Valid" against "ValidPass1" is not wrong yet.
    expect(confirmationSettled('Valid', 'ValidPass1', false)).toBe(false);
    // As long as what it copies, so it has had its say.
    expect(confirmationSettled('ValidPass2', 'ValidPass1', false)).toBe(true);
    // Left the field early: judge what is there.
    expect(confirmationSettled('Valid', 'ValidPass1', true)).toBe(true);
    // Nothing typed is nothing to flag, blurred or not.
    expect(confirmationSettled('', 'ValidPass1', true)).toBe(false);
  });

  it('holds Create Account back until the address is known to be free', () => {
    expect(emailAllowsSignup('available')).toBe(true);
    expect(emailAllowsSignup('taken')).toBe(false);
    expect(emailAllowsSignup('checking')).toBe(false);
    expect(emailAllowsSignup('idle')).toBe(false);
    // A lookup that failed must not trap someone on the form; the sign-up
    // call refuses a duplicate on its own.
    expect(emailAllowsSignup('unknown')).toBe(true);
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
