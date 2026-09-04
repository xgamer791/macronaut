import { ConvexError } from 'convex/values';
import { friendlyAuthError } from '../errors';

describe('friendlyAuthError', () => {
  it('never echoes a raw server message', () => {
    const raw = 'InvalidSecret: stack trace at convex/auth.ts:12';
    expect(friendlyAuthError(new Error(raw))).not.toContain('convex');
  });

  it('repeats the backend wording that was written for the person reading it', () => {
    // convex/lib/signupAccount.ts throws ConvexErrors precisely so their text
    // survives a production deployment.
    const message = 'You must be at least 13 to use Macronaut.';
    expect(friendlyAuthError(new ConvexError(message), 'signup')).toBe(message);
  });

  it('maps the cases a person can act on', () => {
    expect(friendlyAuthError(new Error('Rate limit exceeded'))).toMatch(/wait a minute/i);
    expect(friendlyAuthError(new Error('Account ada@example.com already exists'))).toMatch(
      /already has an account/i,
    );
    expect(friendlyAuthError(new Error('InvalidSecret'))).toMatch(/do not match/i);
    expect(friendlyAuthError(new TypeError('Failed to fetch'))).toMatch(/connection/i);
  });

  it('says what failed when the deployment redacted the reason', () => {
    // Production Convex replaces the text of anything that is not a
    // ConvexError, so these fallbacks are what people usually read.
    const redacted = new Error('[Request ID: abc] Server Error');
    expect(friendlyAuthError(redacted, 'signin')).toMatch(/do not match an account/i);
    expect(friendlyAuthError(redacted, 'signup')).toMatch(/may already have one/i);
    expect(friendlyAuthError(redacted)).toMatch(/something went wrong/i);
  });

  it('falls back to a generic message for anything else', () => {
    expect(friendlyAuthError('???')).toMatch(/something went wrong/i);
    expect(friendlyAuthError(undefined)).toMatch(/something went wrong/i);
  });
});
