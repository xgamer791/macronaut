/** Guards against shipping a privileged Supabase key inside the client bundle.
 *
 * Everything in an `EXPO_PUBLIC_*` variable is inlined into the JavaScript that
 * every user downloads. The publishable (anon) key is designed for that; the
 * service-role / secret key bypasses Row Level Security entirely, so leaking it
 * hands every user's data to anyone who opens devtools. These checks make that
 * mistake fail loudly at startup instead of silently. */

export type KeyProblem = 'empty' | 'service-role' | 'secret-key' | 'malformed';

function decodeJwtRole(key: string): string | null {
  const parts = key.split('.');
  if (parts.length !== 3) return null;
  try {
    const payload = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const padded = payload.padEnd(payload.length + ((4 - (payload.length % 4)) % 4), '=');
    const json = JSON.parse(
      typeof atob === 'function'
        ? atob(padded)
        : Buffer.from(padded, 'base64').toString('utf8'),
    ) as { role?: unknown };
    return typeof json.role === 'string' ? json.role : null;
  } catch {
    return null;
  }
}

/** Returns the reason a key must not be used in the client, or null if it is
 * a legitimate publishable key. */
export function inspectPublishableKey(key: string | undefined): KeyProblem | null {
  const trimmed = (key ?? '').trim();
  if (!trimmed) return 'empty';
  if (trimmed.startsWith('sb_secret_')) return 'secret-key';
  if (trimmed.startsWith('sb_publishable_')) return null;

  const role = decodeJwtRole(trimmed);
  if (role === 'service_role') return 'service-role';
  if (role === 'anon' || role === 'authenticated') return null;
  return 'malformed';
}

export function describeKeyProblem(problem: KeyProblem): string {
  switch (problem) {
    case 'empty':
      return 'EXPO_PUBLIC_SUPABASE_ANON_KEY is empty.';
    case 'service-role':
      return 'EXPO_PUBLIC_SUPABASE_ANON_KEY holds a service_role key. That key bypasses Row Level Security and must never be bundled into the app. Use the publishable (anon) key.';
    case 'secret-key':
      return 'EXPO_PUBLIC_SUPABASE_ANON_KEY holds an sb_secret_ key. Secret keys are server-only. Use the sb_publishable_ key.';
    case 'malformed':
      return 'EXPO_PUBLIC_SUPABASE_ANON_KEY is not a recognisable Supabase publishable key.';
  }
}

/** Rejects anything that is not an https Supabase endpoint, so a stray http
 * URL cannot downgrade token traffic to cleartext. */
export function isValidSupabaseUrl(url: string | undefined): boolean {
  const trimmed = (url ?? '').trim();
  if (!trimmed) return false;
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol === 'https:') return true;
    return parsed.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(parsed.hostname);
  } catch {
    return false;
  }
}
