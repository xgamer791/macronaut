/** Accounts that may use AI food scan until a Pro subscription exists.
 * Enforcement is on the server; the client only uses this to hide the entry. */
export const AI_FOOD_SCAN_ALLOWED_EMAILS = [
  'lifewirecg@gmail.com',
  'salonnewvine@gmail.com',
] as const;

export function normalizeEmail(email: string | null | undefined): string {
  return (email ?? '').trim().toLowerCase();
}

export function canUseAiFoodScan(email: string | null | undefined): boolean {
  const normalized = normalizeEmail(email);
  return (AI_FOOD_SCAN_ALLOWED_EMAILS as readonly string[]).includes(normalized);
}
