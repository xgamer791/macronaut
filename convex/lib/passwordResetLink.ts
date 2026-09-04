/** Path and query keys for the emailed reset URL. The secret is `token`,
 * never `code`: Convex Auth's client auto-redeems `?code=` as a sign-in and
 * would consume the token before the person could set a password. */
export const PASSWORD_RESET_PATH = '/forgot-password';
export const PASSWORD_RESET_TOKEN_PARAM = 'token';
export const PASSWORD_RESET_EMAIL_PARAM = 'email';

/** One hour. Long enough to open mail on another device; short enough that a
 * leaked inbox is not a standing credential. */
export const PASSWORD_RESET_TTL_SECONDS = 60 * 60;

/** 32 bytes → 64 hex chars. Convex Auth treats tokens shorter than 24
 * characters as OTPs that also need the address; a reset link is the whole
 * proof, so it has to clear that bar on its own. */
export const PASSWORD_RESET_TOKEN_BYTES = 32;

export function passwordResetLink(siteUrl: string, email: string, token: string): string {
  const site = siteUrl.trim().replace(/\/$/, '');
  if (!site) throw new Error('SITE_URL is empty');
  const url = new URL(`${site}${PASSWORD_RESET_PATH}`);
  url.searchParams.set(PASSWORD_RESET_EMAIL_PARAM, email.trim().toLowerCase());
  url.searchParams.set(PASSWORD_RESET_TOKEN_PARAM, token);
  return url.toString();
}

/** Pulls the address and token out of a reset URL. Used by tests so a
 * change to the query shape fails here rather than on the live screen. */
export function parsePasswordResetLink(href: string): { email: string; token: string } {
  const url = new URL(href);
  const email = url.searchParams.get(PASSWORD_RESET_EMAIL_PARAM) ?? '';
  const token = url.searchParams.get(PASSWORD_RESET_TOKEN_PARAM) ?? '';
  if (!email || !token) throw new Error('reset link is missing email or token');
  if (url.searchParams.get('code')) throw new Error('reset link must not use the code query');
  return { email, token };
}
