/** Where the Supabase project credentials come from.
 *
 * Two sources, in order: an `EXPO_PUBLIC_*` environment variable, or the
 * committed `supabase.json`. The file exists because both values are public by
 * design — they are inlined into every bundle regardless — so keeping them in
 * CI secrets bought no protection while making the project harder to configure.
 * Editing one committed file in the GitHub web UI is enough to take accounts
 * live; the environment variables stay supported so a local `.env` or a fork
 * can point at a different project without editing tracked files. */

import file from '../../../supabase.json';

/** Expo inlines `EXPO_PUBLIC_*` at build time, so these must be static
 * property accesses — a computed lookup would come back undefined. */
const ENV_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const ENV_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

export type SupabaseConfig = {
  url: string;
  anonKey: string;
  /** Which source supplied the values, for diagnostics and error messages. */
  source: 'env' | 'file' | 'none';
};

/** Pure resolution, exported for tests. A source counts only when it supplies
 * both halves: a URL with no key (or the reverse) is a misconfiguration, and
 * silently completing it from the other source would point the app at one
 * project using another's credentials. */
export function pickSupabaseConfig(
  envUrl: string | undefined,
  envAnonKey: string | undefined,
  fileUrl: string | undefined,
  fileAnonKey: string | undefined,
): SupabaseConfig {
  const candidates: { url: string; anonKey: string; source: 'env' | 'file' }[] = [
    { url: (envUrl ?? '').trim(), anonKey: (envAnonKey ?? '').trim(), source: 'env' },
    { url: (fileUrl ?? '').trim(), anonKey: (fileAnonKey ?? '').trim(), source: 'file' },
  ];

  for (const candidate of candidates) {
    if (candidate.url && candidate.anonKey) return candidate;
    // A half-filled source is reported as-is so the config check can explain
    // the specific problem rather than falling through to "not configured".
    if (candidate.url || candidate.anonKey) return candidate;
  }
  return { url: '', anonKey: '', source: 'none' };
}

export const supabaseConfig: SupabaseConfig = pickSupabaseConfig(
  ENV_URL,
  ENV_ANON_KEY,
  file.url,
  file.anonKey,
);

/** Human-readable name for where a value should be corrected. */
export function configSourceLabel(source: SupabaseConfig['source']): string {
  return source === 'env' ? 'EXPO_PUBLIC_SUPABASE_*' : 'supabase.json';
}
