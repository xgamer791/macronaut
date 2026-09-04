import { isPlausibleEmail } from './email';

/** Convex Auth treats tokens shorter than 24 characters as typed OTPs. A
 * reset link has to be a credential on its own, so anything shorter is not
 * one — the request form stays up instead of the new-password fields. */
export const PASSWORD_RESET_TOKEN_MIN_LENGTH = 24;

export function firstSearchParam(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return (value[0] ?? '').trim();
  return (value ?? '').trim();
}

/** The emailed reset URL carries `email` and `token`. Both have to be present
 * and plausible before the reset page shows the new-password fields. */
export function passwordResetFromParams(params: {
  email?: string | string[];
  token?: string | string[];
}): { email: string; token: string } | null {
  const email = firstSearchParam(params.email);
  const token = firstSearchParam(params.token).replace(/\s+/g, '');
  if (!isPlausibleEmail(email) || token.length < PASSWORD_RESET_TOKEN_MIN_LENGTH) return null;
  return { email, token };
}
