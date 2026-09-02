import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { AppState, Platform } from 'react-native';
import { getDeviceStore } from '@/services/storage/deviceStore';
import { configSourceLabel, supabaseConfig } from './config';
import { describeKeyProblem, inspectPublishableKey, isValidSupabaseUrl } from './keyGuard';

const { url: SUPABASE_URL, anonKey: SUPABASE_ANON_KEY, source: CONFIG_SOURCE } = supabaseConfig;

const SESSION_KEY = 'macronaut.auth.session';

export type SupabaseConfigStatus =
  | { ok: true }
  | { ok: false; reason: 'not-configured' | 'invalid-url' | 'invalid-key'; message: string };

function computeStatus(): SupabaseConfigStatus {
  const where = configSourceLabel(CONFIG_SOURCE);

  if (!SUPABASE_URL && !SUPABASE_ANON_KEY) {
    return {
      ok: false,
      reason: 'not-configured',
      message:
        'Supabase is not configured. Fill in url and anonKey in supabase.json (or set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY) to enable accounts.',
    };
  }
  if (!isValidSupabaseUrl(SUPABASE_URL)) {
    return {
      ok: false,
      reason: 'invalid-url',
      message: `The Supabase project URL in ${where} must be an https URL (http is allowed for localhost).`,
    };
  }
  const keyProblem = inspectPublishableKey(SUPABASE_ANON_KEY);
  if (keyProblem) {
    return {
      ok: false,
      reason: 'invalid-key',
      message: `${describeKeyProblem(keyProblem)} Correct it in ${where}.`,
    };
  }
  return { ok: true };
}

let warned = false;

/** Configuration state, logging a misconfiguration once per session. A build
 * that meant to have accounts but supplied a bad URL or a privileged key
 * degrades to local-only, which should never happen quietly — the login screen
 * says so too. */
export function supabaseConfigStatus(): SupabaseConfigStatus {
  const status = computeStatus();
  if (!status.ok && status.reason !== 'not-configured' && !warned) {
    warned = true;
    console.error(`[supabase] ${status.message}`);
  }
  return status;
}

/** True when the app can talk to a real Supabase project. When false the app
 * stays in local-only mode (the GitHub Pages demo runs this way) rather than
 * crashing or pretending a user is signed in to a backend. */
export function isSupabaseConfigured(): boolean {
  return supabaseConfigStatus().ok;
}

let client: SupabaseClient | null = null;
let appStateBound = false;

/** Supabase refreshes tokens on a timer, which iOS suspends in the
 * background; restarting it on foreground keeps sessions from going stale. */
function bindAppStateRefresh(supabase: SupabaseClient): void {
  if (appStateBound || Platform.OS === 'web') return;
  appStateBound = true;
  AppState.addEventListener('change', (state) => {
    if (state === 'active') supabase.auth.startAutoRefresh();
    else supabase.auth.stopAutoRefresh();
  });
}

/** The Supabase client, or null when the app is running local-only. */
export function getSupabase(): SupabaseClient | null {
  if (!supabaseConfigStatus().ok) return null;
  if (!client) {
    const store = getDeviceStore();
    client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        storage: {
          getItem: (key) => store.getItem(key),
          setItem: (key, value) => store.setItem(key, value),
          removeItem: (key) => store.removeItem(key),
        },
        storageKey: SESSION_KEY,
        persistSession: true,
        autoRefreshToken: true,
        // PKCE keeps the authorization code useless without the verifier this
        // client holds, which is what a public client needs.
        flowType: 'pkce',
        // Only the web build ever returns to a URL carrying auth params.
        detectSessionInUrl: Platform.OS === 'web',
      },
      global: {
        headers: { 'X-Client-Info': 'macronaut' },
      },
    });
    bindAppStateRefresh(client);
  }
  return client;
}

/** Test seam. */
export function setSupabaseForTesting(next: SupabaseClient | null): void {
  client = next;
}
