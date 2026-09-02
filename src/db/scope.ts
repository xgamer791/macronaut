import { getDeviceStore } from '@/services/storage/deviceStore';

/** Which local SQLite database an account reads and writes.
 *
 * Before accounts there was exactly one local database per device. Adding
 * sign-in without scoping it would mean the next person to sign in on a shared
 * phone or browser inherits the previous account's diary, so every account
 * gets its own database file (web: its own IndexedDB record).
 *
 * The pre-accounts database is adopted by the first account that signs in on
 * the device, which keeps existing users' history intact instead of stranding
 * it behind a login. Every account after that gets a fresh scope. */

export const LEGACY_SCOPE = 'legacy';

/** Scope used while nobody is signed in on a build that has accounts.
 *
 * Signed out, the app still mounts its data layer — the login screen lives
 * inside it, and a route can be opened directly by URL before the redirect to
 * login lands. Pointing that at the pre-accounts database would mean a visitor
 * on a shared browser could read and write the diary of whoever used it last.
 * This scope is a scratch database that no account ever owns. */
export const SIGNED_OUT_SCOPE = 'signedout';

const LEGACY_OWNER_KEY = 'macronaut.db.legacyOwner';

/** Supabase user ids are UUIDs; anything else is normalised so it can never
 * escape into a filename or IndexedDB key. */
export function scopeForUserId(userId: string): string {
  const safe = userId
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '')
    .slice(0, 40);
  if (!safe) throw new Error('Cannot derive a database scope from an empty user id');
  return `u${safe}`;
}

/** Resolves the scope for the signed-in user, adopting the pre-accounts
 * database for whichever account claims the device first. Pass null for
 * local-only mode (no Supabase configured). */
export async function resolveDbScope(userId: string | null): Promise<string> {
  if (!userId) return LEGACY_SCOPE;

  const store = getDeviceStore();
  let owner: string | null = null;
  try {
    owner = await store.getItem(LEGACY_OWNER_KEY);
  } catch {
    // A device store that cannot be read must not grant access to another
    // account's data, so fall back to a scope unique to this user.
    return scopeForUserId(userId);
  }

  if (!owner) {
    try {
      await store.setItem(LEGACY_OWNER_KEY, userId);
    } catch {
      return scopeForUserId(userId);
    }
    return LEGACY_SCOPE;
  }

  return owner === userId ? LEGACY_SCOPE : scopeForUserId(userId);
}

/** SQLite filename for a scope (native). */
export function dbFileNameForScope(scope: string): string {
  return scope === LEGACY_SCOPE ? 'macronaut.db' : `macronaut-${scope}.db`;
}

/** IndexedDB record key for a scope (web). */
export function idbKeyForScope(scope: string): string {
  return scope === LEGACY_SCOPE ? 'main' : `main:${scope}`;
}
