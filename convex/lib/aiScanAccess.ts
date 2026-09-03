/** Accounts that may use AI food scan until a Pro subscription exists.
 * The server enforces this; the client only greys the Add-screen tile out. */
export const AI_FOOD_SCAN_ALLOWED_EMAILS = [
  'lifewirecg@gmail.com',
  'salonnewvine@gmail.com',
] as const;

export function normalizeEmail(email: string | null | undefined): string {
  return (email ?? '').trim().toLowerCase();
}

export function canUseAiFoodScan(...emails: (string | null | undefined)[]): boolean {
  return emails.some((email) => {
    const normalized = normalizeEmail(email);
    return (AI_FOOD_SCAN_ALLOWED_EMAILS as readonly string[]).includes(normalized);
  });
}
