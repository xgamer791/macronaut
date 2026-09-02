import type { Session } from '@supabase/supabase-js';
import { useQueryClient } from '@tanstack/react-query';
import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { LEGACY_SCOPE, resolveDbScope } from '@/db/scope';
import { getDeviceStore } from '@/services/storage/deviceStore';
import { signOut as supabaseSignOut } from '@/services/supabase/auth';
import { getSupabase, isSupabaseConfigured } from '@/services/supabase/client';

/** Set when the user continues on a build that has no Supabase project
 * configured (the public GitHub Pages demo). It unlocks the local-only app and
 * is explicitly not an account. */
const LOCAL_ONLY_KEY = 'macronaut.auth.localOnly';

export interface AuthContextValue {
  /** True until the stored session has been read. */
  loading: boolean;
  /** False when this build has no Supabase project, i.e. local-only mode. */
  accountsEnabled: boolean;
  session: Session | null;
  /** Supabase user id, or null in local-only mode. */
  userId: string | null;
  signedIn: boolean;
  /** Local database this session may read and write. */
  dbScope: string;
  /** Local-only mode: unlock the app without an account. */
  continueLocalOnly: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const qc = useQueryClient();
  const accountsEnabled = isSupabaseConfigured();

  const [session, setSession] = useState<Session | null>(null);
  const [localOnly, setLocalOnly] = useState(false);
  const [sessionLoaded, setSessionLoaded] = useState(false);
  // Tagged with the user it was resolved for so a scope belonging to the
  // previous account is never used for the next one.
  const [resolved, setResolved] = useState<{ userId: string | null; scope: string } | null>(null);

  const userId = session?.user.id ?? null;
  const signedIn = accountsEnabled ? session !== null : localOnly;

  useEffect(() => {
    let active = true;
    const supabase = accountsEnabled ? getSupabase() : null;

    if (supabase) {
      supabase.auth
        .getSession()
        .then(({ data }) => {
          if (!active) return;
          setSession(data.session ?? null);
          setSessionLoaded(true);
        })
        .catch(() => {
          if (active) setSessionLoaded(true);
        });

      // Only assigns state: calling back into supabase.auth from this handler
      // can deadlock the client's internal lock.
      const { data: subscription } = supabase.auth.onAuthStateChange((_event, next) => {
        if (!active) return;
        setSession(next ?? null);
        setSessionLoaded(true);
      });

      return () => {
        active = false;
        subscription.subscription.unsubscribe();
      };
    }

    getDeviceStore()
      .getItem(LOCAL_ONLY_KEY)
      .then((value) => {
        if (!active) return;
        setLocalOnly(value === '1');
        setSessionLoaded(true);
      })
      .catch(() => {
        if (active) setSessionLoaded(true);
      });

    return () => {
      active = false;
    };
  }, [accountsEnabled]);

  // Which local database this account owns. Resolved before children mount so
  // no screen can read rows from the wrong scope.
  useEffect(() => {
    if (!sessionLoaded || !signedIn) return;
    let active = true;
    resolveDbScope(userId)
      .then((scope) => {
        if (active) setResolved({ userId, scope });
      })
      .catch(() => {
        if (active) setResolved(null);
      });
    return () => {
      active = false;
    };
  }, [sessionLoaded, signedIn, userId]);

  const dbScope = !signedIn
    ? LEGACY_SCOPE
    : resolved && resolved.userId === userId
      ? resolved.scope
      : null;

  // Any cached query result belongs to the account that fetched it.
  const previousScope = useRef<string | null>(null);
  useEffect(() => {
    if (dbScope && previousScope.current && previousScope.current !== dbScope) {
      qc.clear();
    }
    if (dbScope) previousScope.current = dbScope;
  }, [dbScope, qc]);

  const continueLocalOnly = useCallback(async () => {
    await getDeviceStore().setItem(LOCAL_ONLY_KEY, '1');
    setLocalOnly(true);
  }, []);

  const signOut = useCallback(async () => {
    if (accountsEnabled) await supabaseSignOut();
    else await getDeviceStore().removeItem(LOCAL_ONLY_KEY);
    setSession(null);
    setLocalOnly(false);
    qc.clear();
  }, [accountsEnabled, qc]);

  const value: AuthContextValue = {
    loading: !sessionLoaded || dbScope === null,
    accountsEnabled,
    session,
    userId,
    signedIn,
    dbScope: dbScope ?? LEGACY_SCOPE,
    continueLocalOnly,
    signOut,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
