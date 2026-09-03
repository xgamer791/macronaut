/** Keeps provider internals out of the UI while still telling the user what to
 * do next. Anything unrecognised gets a generic message rather than a raw
 * server string. */
export function friendlyAuthError(err: unknown): string {
  const raw = err instanceof Error ? err.message : String(err ?? '');
  const message = raw.toLowerCase();
  if (message.includes('rate limit') || message.includes('too many')) {
    return 'Too many attempts. Wait a minute and try again.';
  }
  if (message.includes('expired')) return 'That code has expired. Request a new one.';
  if (message.includes('could not send')) {
    return 'We could not send the code to that address. Check it and try again.';
  }
  if (message.includes('apple')) return 'Apple sign-in did not finish. Please try again.';
  if (
    message.includes('code') ||
    message.includes('token') ||
    message.includes('secret') ||
    message.includes('verification')
  ) {
    return 'That code is not right. Check it and try again.';
  }
  if (message.includes('network') || message.includes('fetch')) {
    return 'Could not reach the server. Check your connection.';
  }
  return 'Something went wrong signing in. Please try again.';
}
