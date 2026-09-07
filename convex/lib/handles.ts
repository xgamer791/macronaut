/** Profile handles. A handle is the only part of a profile that appears in a
 * URL, so it is deliberately boring: lowercase letters, digits and
 * underscores, with the lowercased form stored alongside it so the by-handle
 * lookup is case-insensitive.
 *
 * Pure so both the server and the client's validation can use the same rules
 * (tests/convex/profile.test.ts locks them). */

export const HANDLE_MIN = 3;
export const HANDLE_MAX = 24;

/** Everything a handle may not contain, collapsed to underscores, then
 * trimmed of leading and trailing underscores and truncated. Returns '' when
 * nothing usable is left. */
export function normalizeHandle(raw: string): string {
  const lowered = (raw ?? '').trim().toLowerCase();
  const collapsed = lowered.replace(/[^a-z0-9]+/g, '_').replace(/_+/g, '_');
  return collapsed.replace(/^_+|_+$/g, '').slice(0, HANDLE_MAX);
}

export function isValidHandle(handle: string): boolean {
  return handle.length >= HANDLE_MIN && handle === normalizeHandle(handle);
}

/** A starting handle for an account that has never chosen one. Prefers the
 * display name, falls back to the email local part, then to a generic stem so
 * the result is never empty. */
export function handleSeed(name?: string | null, email?: string | null): string {
  const fromName = normalizeHandle(name ?? '');
  if (fromName.length >= HANDLE_MIN) return fromName;
  const fromEmail = normalizeHandle((email ?? '').split('@')[0] ?? '');
  if (fromEmail.length >= HANDLE_MIN) return fromEmail;
  // Pad rather than reject: a short name is still the best stem available.
  const stem = fromName || fromEmail;
  return stem ? `${stem}_athlete`.slice(0, HANDLE_MAX) : 'athlete';
}

/** `base`, or `base_2`, `base_3`, … — whichever `taken` first allows. The
 * suffix is appended inside the length limit so long handles still fit. */
export async function firstFreeHandle(
  base: string,
  taken: (candidate: string) => Promise<boolean>,
): Promise<string> {
  const seed = base.length >= HANDLE_MIN ? base : handleSeed(base);
  if (!(await taken(seed))) return seed;
  for (let n = 2; n < 1000; n += 1) {
    const suffix = `_${n}`;
    const candidate = `${seed.slice(0, HANDLE_MAX - suffix.length)}${suffix}`;
    if (!(await taken(candidate))) return candidate;
  }
  throw new Error('Could not find a free profile handle');
}
