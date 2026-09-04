import { ConvexError } from 'convex/values';

/** Which round trip failed, so the fallback can say something true. A
 * production Convex deployment redacts the text of any error that is not a
 * `ConvexError`, so the fallback is what people usually see. */
export type AuthFlow = 'signup' | 'signin' | 'generic';

const FALLBACK: Record<AuthFlow, string> = {
  signup:
    'We could not create that account. That email may already have one — try signing in instead.',
  signin: 'That email and password do not match an account.',
  generic: 'Something went wrong signing in. Please try again.',
};

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
  if (message.includes('already exists')) {
    return 'That email already has an account. Sign in instead.';
  }
  // `InvalidSecret` is Convex Auth's own wording for a password that does not
  // match the account.
  if (message.includes('invalidsecret') || message.includes('invalid credentials')) {
    return FALLBACK.signin;
  }
  if (message.includes('invalidaccountid') || message.includes('no account')) {
    return FALLBACK.signin;
  }
  if (message.includes('network') || message.includes('fetch')) {
    return 'Could not reach the server. Check your connection.';
  }
  return FALLBACK[flow];
}
