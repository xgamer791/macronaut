import { ConvexError } from 'convex/values';

/** Which round trip failed, so the fallback can say something true. A
 * production Convex deployment redacts the text of any error that is not a
 * `ConvexError`, so the fallback is what people usually see. */
export type AuthFlow = 'signup' | 'signin' | 'reset' | 'generic';

const FALLBACK: Record<AuthFlow, string> = {
  signup:
    'We could not create that account. That email may already have one — try signing in instead.',
  signin: 'That email and password do not match an account.',
  reset: 'We could not reset that password. Check the code and try again.',
  generic: 'Something went wrong signing in. Please try again.',
};

/** Convex Auth's wording when `flow: "reset"` cannot find a password account
 * for that address. The login screen treats this as a silent success so the
 * page cannot be used to see whether an email is registered. */
export function isUnknownPasswordAccount(err: unknown): boolean {
  const raw = err instanceof Error ? err.message : String(err ?? '');
  const message = raw.toLowerCase();
  return (
    message.includes('invalidaccountid') ||
    message.includes('could not find') ||
    message.includes('no account') ||
    message.includes('cannot find account') ||
    // Production redacts Convex Auth's InvalidAccountId to this.
    message.includes('server error')
  );
}

/** Keeps provider internals out of the UI while still telling the user what to
 * do next. Anything unrecognised gets the message for the flow rather than a
 * raw server string. */
export function friendlyAuthError(err: unknown, flow: AuthFlow = 'generic'): string {
  // Errors the backend raises deliberately (convex/lib/signupAccount.ts) are
  // already written for the person reading them, and Convex keeps their text.
  if (err instanceof ConvexError && typeof err.data === 'string') return err.data;

  const raw = err instanceof Error ? err.message : String(err ?? '');
  const message = raw.toLowerCase();
  if (message.includes('rate limit') || message.includes('too many')) {
    return 'Too many attempts. Wait a minute and try again.';
  }
  if (message.includes('expired')) return 'That code has expired. Request a new one.';
  if (message.includes('not available yet')) {
    return "Email isn't available yet. Try again later.";
  }
  if (message.includes('could not send')) {
    return 'We could not send the code to that address. Check it and try again.';
  }
  if (message.includes('already exists')) {
    return 'That email already has an account. Sign in instead.';
  }
  if (
    flow === 'reset' &&
    (message.includes('invalid code') ||
      message.includes('verification') ||
      message.includes('token'))
  ) {
    return 'That code is not right. Check it and try again.';
  }
  // `InvalidSecret` is Convex Auth's own wording for a password that does not
  // match the account.
  if (message.includes('invalidsecret') || message.includes('invalid credentials')) {
    return FALLBACK.signin;
  }
  if (message.includes('invalidaccountid') || message.includes('no account')) {
    return flow === 'reset' ? FALLBACK.reset : FALLBACK.signin;
  }
  if (message.includes('network') || message.includes('fetch')) {
    return 'Could not reach the server. Check your connection.';
  }
  return FALLBACK[flow];
}
