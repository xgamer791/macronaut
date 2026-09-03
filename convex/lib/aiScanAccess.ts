/** Named accounts that may use AI food scan even if they sign up after the
 * grandfather roster is frozen. The server enforces this. */
export const AI_FOOD_SCAN_ALLOWED_EMAILS = [
  'lifewirecg@gmail.com',
  'salonnewvine@gmail.com',
] as const;

export const AI_FOOD_SCAN_ALLOWED_NAMES = ['holly ky'] as const;

export function normalizeEmail(email: string | null | undefined): string {
  return (email ?? '').trim().toLowerCase();
}

export function normalizeName(name: string | null | undefined): string {
  return (name ?? '').trim().toLowerCase().replace(/\s+/g, ' ');
}

export function canUseAiFoodScan(...emails: (string | null | undefined)[]): boolean {
  return emails.some((email) => {
    const normalized = normalizeEmail(email);
    return (AI_FOOD_SCAN_ALLOWED_EMAILS as readonly string[]).includes(normalized);
  });
}

export function canUseAiFoodScanByName(name: string | null | undefined): boolean {
  const normalized = normalizeName(name);
  return (AI_FOOD_SCAN_ALLOWED_NAMES as readonly string[]).includes(normalized);
}

export function canUseAiFoodScanByProfile(opts: {
  email?: string | null;
  name?: string | null;
}): boolean {
  return canUseAiFoodScan(opts.email) || canUseAiFoodScanByName(opts.name);
}
