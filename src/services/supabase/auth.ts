import type { Session } from '@supabase/supabase-js';
import * as Linking from 'expo-linking';
import { Platform } from 'react-native';
import { getSupabase } from './client';

export type AuthProviderId = 'google' | 'email';

export class AuthUnavailableError extends Error {
  constructor() {
    super('Accounts are unavailable because Supabase is not configured on this build.');
    this.name = 'AuthUnavailableError';
  }
}

function requireClient() {
  const supabase = getSupabase();
  if (!supabase) throw new AuthUnavailableError();
  return supabase;
}

/** Where the OAuth provider sends the user back. Must be listed under
 * Authentication → URL Configuration → Redirect URLs in the Supabase
 * dashboard; anything else is rejected by Supabase, which is what stops an
 * attacker redirecting the authorization code to their own site. */
export function authRedirectUrl(): string {
  return Linking.createURL('/');
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function isPlausibleEmail(email: string): boolean {
  const value = normalizeEmail(email);
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value);
}

/** Sends a one-time code to the address. Deliberately does not reveal whether
 * the account already existed, so this cannot be used to enumerate users. */
export async function sendEmailCode(email: string): Promise<void> {
  const supabase = requireClient();
  const { error } = await supabase.auth.signInWithOtp({
    email: normalizeEmail(email),
    options: { shouldCreateUser: true, emailRedirectTo: authRedirectUrl() },
  });
  if (error) throw error;
}

export async function verifyEmailCode(email: string, code: string): Promise<Session> {
  const supabase = requireClient();
  const { data, error } = await supabase.auth.verifyOtp({
    email: normalizeEmail(email),
    token: code.replace(/\s+/g, ''),
    type: 'email',
  });
  if (error) throw error;
  if (!data.session) throw new Error('That code did not return a session. Request a new code.');
  return data.session;
}

/** Google sign-in. On web the browser is redirected and the session is picked
 * up on return (detectSessionInUrl). On native the flow runs in an
 * ASWebAuthenticationSession / Custom Tab and the authorization code is
 * exchanged here. */
export async function signInWithGoogle(): Promise<void> {
  const supabase = requireClient();
  const redirectTo = authRedirectUrl();

  if (Platform.OS === 'web') {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo },
    });
    if (error) throw error;
    return;
  }

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo, skipBrowserRedirect: true },
  });
  if (error) throw error;
  if (!data.url) throw new Error('Google sign-in could not be started.');

  // Required lazily: the web branch above never needs the native browser.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const WebBrowser = require('expo-web-browser') as typeof import('expo-web-browser');
  const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
  if (result.type !== 'success') return;

  const code = new URL(result.url).searchParams.get('code');
  if (!code) throw new Error('Google sign-in did not return an authorization code.');
  const exchange = await supabase.auth.exchangeCodeForSession(code);
  if (exchange.error) throw exchange.error;
}

export async function signOut(): Promise<void> {
  const supabase = getSupabase();
  if (!supabase) return;
  // 'local' clears this device only, so signing out of a phone does not kill
  // an active session on the user's other devices.
  const { error } = await supabase.auth.signOut({ scope: 'local' });
  if (error) throw error;
}

export async function getCurrentSession(): Promise<Session | null> {
  const supabase = getSupabase();
  if (!supabase) return null;
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  return data.session ?? null;
}

/** Human-readable display name for a session, falling back to the email local
 * part. Provider metadata is user-controlled, so treat it as untrusted text. */
export function displayNameFromSession(session: Session | null): string | undefined {
  if (!session) return undefined;
  const meta = session.user.user_metadata as Record<string, unknown> | null;
  const candidates = [meta?.full_name, meta?.name, meta?.preferred_username];
  for (const candidate of candidates) {
    if (typeof candidate === 'string' && candidate.trim()) return candidate.trim().slice(0, 60);
  }
  const local = session.user.email?.split('@')[0];
  if (!local) return undefined;
  return (local.charAt(0).toUpperCase() + local.slice(1)).slice(0, 60);
}

export function providerFromSession(session: Session | null): AuthProviderId | undefined {
  const provider = session?.user.app_metadata?.provider;
  if (provider === 'google') return 'google';
  if (provider === 'email') return 'email';
  return undefined;
}
