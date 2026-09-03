import { friendlyAuthError } from '../errors';

describe('friendlyAuthError', () => {
  it('never echoes a raw server message', () => {
    const raw = 'InvalidSecret: stack trace at convex/auth.ts:12';
    expect(friendlyAuthError(new Error(raw))).not.toContain('convex');
  });

  it('maps the cases a person can act on', () => {
    expect(friendlyAuthError(new Error('Rate limit exceeded'))).toMatch(/wait a minute/i);
    expect(friendlyAuthError(new Error('Token expired'))).toMatch(/expired/i);
    expect(friendlyAuthError(new Error('Could not send the sign-in code (Resend 422)'))).toMatch(
      /could not send/i,
    );
    expect(friendlyAuthError(new Error('Invalid verification code'))).toMatch(/not right/i);
    expect(friendlyAuthError(new Error('Apple sign-in did not return an identity token.'))).toMatch(
      /apple/i,
    );
    expect(friendlyAuthError(new TypeError('Failed to fetch'))).toMatch(/connection/i);
  });

  it('falls back to a generic message for anything else', () => {
    expect(friendlyAuthError('???')).toMatch(/something went wrong/i);
    expect(friendlyAuthError(undefined)).toMatch(/something went wrong/i);
  });
});
