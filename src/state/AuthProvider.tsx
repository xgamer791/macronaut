import { ConvexAuthProvider, useAuthActions } from '@convex-dev/auth/react';
import { useQueryClient } from '@tanstack/react-query';
import { useConvexAuth, useQuery } from 'convex/react';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef } from 'react';
import { Platform } from 'react-native';
import { api } from '../../convex/_generated/api';
import { AuthUser } from '@/services/auth/displayName';
import { getConvexClient } from '@/services/convex/client';
import { getDeviceStore } from '@/services/storage/deviceStore';

export interface AuthContextValue {
  /** True until the stored session has been verified with the server. */
  loading: boolean;
  signedIn: boolean;
  /** The signed-in account, once loaded. */
  user: AuthUser | null;
  userId: string | null;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

/** Session tokens go to the device keychain on native (expo-secure-store,
 * chunked by deviceStore). On web Convex Auth's own localStorage handling is
 * used directly, because it also syncs sign-in state across tabs. */
function nativeTokenStorage() {
  const store = getDeviceStore();
  return {
    getItem: (key: string) => store.getItem(key),
    setItem: (key: string, value: string) => store.setItem(key, value),
    removeItem: (key: string) => store.removeItem(key),
  };
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const client = getConvexClient();
  const storage = useMemo(
    () => (Platform.OS === 'web' ? undefined : nativeTokenStorage()),
    [],
  );
  return (
    <ConvexAuthProvider client={client} storage={storage}>
      <AuthState>{children}</AuthState>
    </ConvexAuthProvider>
  );
}

function AuthState({ children }: { children: React.ReactNode }) {
  const qc = useQueryClient();
  const { isLoading, isAuthenticated } = useConvexAuth();
  const { signOut: convexSignOut } = useAuthActions();
  const viewer = useQuery(api.account.viewer, isAuthenticated ? {} : 'skip');

  const user: AuthUser | null = isAuthenticated && viewer ? viewer : null;
  const userId = user?.id ?? null;

  // Any cached query result belongs to the account that fetched it.
  const previousUser = useRef<string | null>(null);
  useEffect(() => {
    if (userId && previousUser.current && previousUser.current !== userId) qc.clear();
    if (userId) previousUser.current = userId;
  }, [userId, qc]);

  const signOut = useCallback(async () => {
    await convexSignOut();
    qc.clear();
  }, [convexSignOut, qc]);

  const value: AuthContextValue = {
    loading: isLoading || (isAuthenticated && viewer === undefined),
    signedIn: isAuthenticated,
    user,
    userId,
    signOut,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
