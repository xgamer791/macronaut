/** Turns a Resend refusal into the sentence the login screen keys off. A
 * sender that is not allowed to send (an unverified domain, a bad key) is not
 * something the person typing their address can fix, so it must not read as
 * "check your email address". The raw detail stays in the server log. */
export function describeResendFailure(status: number, detail: string): string {
  const text = detail.toLowerCase();
  if (
    status === 403 &&
    (text.includes('testing emails') ||
      text.includes('verify a domain') ||
      text.includes('not verified'))
  ) {
    return 'Email sign-in is not available yet: the sender domain is not verified in Resend';
  }
  if (status === 401 || status === 403) {
    return 'Email sign-in is not available yet: Resend refused the sender';
  }
  if (status === 429) return 'Too many sign-in emails were requested; wait a minute and try again';
  if (status === 400 || status === 422) return 'Could not send the sign-in code to that address';
  return `Could not send the sign-in code (Resend ${status})`;
}
