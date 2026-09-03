/** Named accounts that may use AI food scan even if they were missed by the
 * first roster freeze. The server enforces this. */
export const AI_FOOD_SCAN_ALLOWED_EMAILS = [
  'lifewirecg@gmail.com',
  'salonnewvine@gmail.com',
] as const;

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

/** Holly Ky — match display name or an email local-part that contains holly. */
export function canUseAiFoodScanByName(name: string | null | undefined): boolean {
  const normalized = normalizeName(name);
  if (!normalized) return false;
  if (normalized === 'holly ky' || normalized === 'hollyky') return true;
  if (normalized.split(' ')[0] === 'holly') return true;
  return normalized.includes('holly ky') || normalized.includes('hollyky');
}

export function canUseAiFoodScanByProfile(opts: {
  email?: string | null;
  name?: string | null;
}): boolean {
  if (canUseAiFoodScan(opts.email)) return true;
  if (canUseAiFoodScanByName(opts.name)) return true;
  const local = normalizeEmail(opts.email).split('@')[0] ?? '';
  return local.includes('holly');
}
