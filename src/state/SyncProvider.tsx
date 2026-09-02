import { useQueryClient } from '@tanstack/react-query';
import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { getState, pendingCount, setState, syncOnce } from '@/services/sync/engine';
import { SupabaseRemote } from '@/services/sync/remote';
import { getSupabase } from '@/services/supabase/client';
import { useAuth } from './AuthProvider';
import { useRepos } from './AppProvider';

/** How often to look for local changes waiting to upload. The check is a
 * COUNT over a table that is empty most of the time. */
const PENDING_POLL_MS = 4_000;

/** How often to ask the server for changes made on the user's other devices,
 * when nothing local is pending. */
const REMOTE_POLL_MS = 60_000;

/** Backoff after a failed sync, so a flaky connection or an unreachable
 * server does not turn into a request every four seconds. */
const RETRY_BASE_MS = 5_000;
const RETRY_MAX_MS = 5 * 60_000;

export type SyncState = 'off' | 'idle' | 'syncing' | 'error';

export interface SyncStatusValue {
  state: SyncState;
  /** Local changes not yet uploaded. */
  pending: number;
  lastSyncedAt: Date | null;
  /** Message from the last failure, cleared by the next success. */
  error: string | null;
  /** Sync immediately; resolves when the attempt finishes. */
  syncNow: () => Promise<void>;
}

const SyncContext = createContext<SyncStatusValue | null>(null);

/** Marks a local database as having completed one full download for its
 * account, so later launches never block on the network. */
const HYDRATED = 'hydrated';

/**
 * Keeps the local database and the account's Supabase tables in step.
 *
 * Writes stay local and immediate — screens never wait on the network — and
 * this provider moves them up in the background, then brings down whatever
 * changed elsewhere. In local-only builds it does nothing at all.
 */
export function SyncProvider({
  children,
  fallback = null,
}: {
  children: React.ReactNode;
  /** Shown while an account's data is downloaded for the first time on this
   * device. */
  fallback?: React.ReactNode;
}) {
  const { db } = useRepos();
  const { userId, signedIn, accountsEnabled } = useAuth();
  const qc = useQueryClient();

  const active = accountsEnabled && signedIn && !!userId;

  const [pending, setPending] = useState(0);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastSyncedAt, setLastSyncedAt] = useState<Date | null>(null);
  const [hydrated, setHydrated] = useState(false);

  // State updates are not visible to the caller that triggered them, and the
  // first-launch gate has to know right away whether the sync succeeded.
  const errorRef = useRef<string | null>(null);

  // One sync at a time. A request arriving mid-flight sets `again` instead of
  // starting a second pass, so the outbox is never drained concurrently.
  const inFlight = useRef(false);
  const again = useRef(false);
  const failures = useRef(0);
  const retryUntil = useRef(0);

  const runSync = useCallback(async () => {
    if (!active || !userId) return;
    if (inFlight.current) {
      again.current = true;
      return;
    }

    const supabase = getSupabase();
    if (!supabase) return;

    inFlight.current = true;
    setSyncing(true);
    try {
      do {
        again.current = false;
        const result = await syncOnce(db, new SupabaseRemote(supabase, userId));
        // Pulled rows land underneath React Query's cache, which has no way to
        // know the tables moved; refetch so open screens show them.
        if (result.pulled > 0) await qc.invalidateQueries();
      } while (again.current);

      failures.current = 0;
      retryUntil.current = 0;
      errorRef.current = null;
      setError(null);
      setLastSyncedAt(new Date());
    } catch (err) {
      failures.current += 1;
      const wait = Math.min(RETRY_BASE_MS * 2 ** (failures.current - 1), RETRY_MAX_MS);
      retryUntil.current = Date.now() + wait;
      errorRef.current = err instanceof Error ? err.message : String(err);
      setError(errorRef.current);
    } finally {
      inFlight.current = false;
      setSyncing(false);
      setPending(await pendingCount(db).catch(() => 0));
    }
  }, [active, db, qc, userId]);

  const syncNow = useCallback(async () => {
    // An explicit request should not be held back by the backoff window.
    failures.current = 0;
    retryUntil.current = 0;
    await runSync();
  }, [runSync]);

  // Sign-in, and switching account, starts with a full reconciliation.
  //
  // The first one on a given device has to finish before the app renders.
  // This local database is empty until it does, and an empty database looks
  // exactly like a brand-new user — the app would send someone with years of
  // history to the onboarding screen while their diary was still downloading.
  // Every launch after that renders immediately and syncs behind the screen.
  useEffect(() => {
    if (!active) {
      setHydrated(true);
      return;
    }
    let live = true;
    setHydrated(false);

    void (async () => {
      const done = await getState(db, HYDRATED).catch(() => null);
      if (!live) return;
      if (done === '1') {
        setHydrated(true);
        void runSync();
        return;
      }
      try {
        await runSync();
        // Only on success: a first launch that could not reach the server
        // must try again rather than settle into a permanently empty diary.
        if (!errorRef.current) await setState(db, HYDRATED, '1');
      } finally {
        // Offline on first launch still opens the app; it syncs when it can.
        if (live) setHydrated(true);
      }
    })();

    return () => {
      live = false;
    };
  }, [active, db, runSync]);

  // Upload local work shortly after it happens, and pick up remote changes on
  // a slower beat.
  useEffect(() => {
    if (!active) return;
    let lastRemote = Date.now();

    const timer = setInterval(async () => {
      if (inFlight.current || Date.now() < retryUntil.current) return;
      const count = await pendingCount(db).catch(() => 0);
      setPending(count);

      const dueForRemote = Date.now() - lastRemote >= REMOTE_POLL_MS;
      if (count > 0 || dueForRemote) {
        lastRemote = Date.now();
        void runSync();
      }
    }, PENDING_POLL_MS);

    return () => clearInterval(timer);
  }, [active, db, runSync]);

  // Coming back to the app is the moment another device's changes are most
  // likely to be waiting.
  useEffect(() => {
    if (!active) return;
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') void runSync();
    });
    return () => sub.remove();
  }, [active, runSync]);

  const value: SyncStatusValue = {
    state: !active ? 'off' : syncing ? 'syncing' : error ? 'error' : 'idle',
    pending,
    lastSyncedAt,
    error,
    syncNow,
  };

  return (
    <SyncContext.Provider value={value}>{hydrated ? children : fallback}</SyncContext.Provider>
  );
}

/** Sync status, or a dormant one when rendered outside a SyncProvider. */
export function useSync(): SyncStatusValue {
  return (
    useContext(SyncContext) ?? {
      state: 'off',
      pending: 0,
      lastSyncedAt: null,
      error: null,
      syncNow: async () => {},
    }
  );
}
