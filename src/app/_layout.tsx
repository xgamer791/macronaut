import {
  SpaceGrotesk_500Medium,
  SpaceGrotesk_600SemiBold,
  useFonts,
} from '@expo-google-fonts/space-grotesk';
import { QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query';
import { Stack, useRouter, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import React, { useEffect } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AppProvider, useRepos } from '@/state/AppProvider';
import { AuthProvider, useAuth } from '@/state/AuthProvider';
import { SyncProvider } from '@/state/SyncProvider';
import { keys, useSetting } from '@/state/queries';
import { AppearanceMode, ThemeProvider } from '@/ui/theme/ThemeProvider';

SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 30_000,
    },
  },
});

/** Routes a signed-out visitor may open. Everything else belongs to an
 * account. The two legal pages are here because Google's OAuth consent screen
 * links to them and must be able to reach them without a session. */
const PUBLIC_ROUTES = new Set(['login', 'privacy', 'terms', '+not-found']);

/**
 * Sends signed-out visitors to the login screen.
 *
 * The tab shell and onboarding already guarded themselves, but the modal
 * routes — add, scan, meal-editor, custom-food and the rest — did not. Signed
 * out, `dbScope` falls back to the pre-accounts database, so opening one of
 * those URLs directly gave an unauthenticated visitor a working screen over
 * the last account's data, and any entry they added would upload to that
 * account when its owner next signed in. Guarding here covers every route
 * instead of relying on each new screen to remember.
 *
 * This cannot use `<Redirect>`: at the root there is no parent navigator left
 * to render the login route once this one is replaced.
 */
function useRequireAccount() {
  const { loading, signedIn } = useAuth();
  const segments = useSegments();
  const router = useRouter();
  const top = segments[0] ?? '';

  useEffect(() => {
    if (loading || signedIn || PUBLIC_ROUTES.has(top)) return;
    router.replace('/login');
  }, [loading, signedIn, top, router]);
}

function ThemedApp() {
  const { settings } = useRepos();
  const qc = useQueryClient();
  const appearance = useSetting<AppearanceMode>('appearance', 'system');
  useRequireAccount();

  if (appearance.isLoading) return null;

  return (
    <ThemeProvider
      initialMode={appearance.data ?? 'system'}
      onModeChange={(mode) => {
        settings.setAppearance(mode).then(() => {
          qc.invalidateQueries({ queryKey: keys.setting('appearance') });
        });
      }}
    >
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="login" />
        <Stack.Screen name="onboarding" />
        <Stack.Screen name="add" options={{ presentation: 'modal' }} />
        <Stack.Screen name="manual-entry" options={{ presentation: 'modal' }} />
        <Stack.Screen name="goals" />
        <Stack.Screen name="activity" options={{ presentation: 'modal' }} />
        <Stack.Screen name="scan" options={{ presentation: 'modal' }} />
        <Stack.Screen name="ai-scan" options={{ presentation: 'modal' }} />
        <Stack.Screen name="custom-food" options={{ presentation: 'modal' }} />
        <Stack.Screen name="log-collection" options={{ presentation: 'modal' }} />
        <Stack.Screen name="meal-editor" options={{ presentation: 'modal' }} />
        <Stack.Screen name="recipe-editor" options={{ presentation: 'modal' }} />
        <Stack.Screen name="meal/[id]" />
        {/* Reachable signed-out: Google's OAuth consent screen links to both. */}
        <Stack.Screen name="privacy" />
        <Stack.Screen name="terms" />
      </Stack>
    </ThemeProvider>
  );
}

/** Opens the signed-in account's database. Remounted on scope change so no
 * repository instance outlives the account it was created for. */
function ScopedApp() {
  const { loading, dbScope } = useAuth();
  if (loading) return null;
  return (
    <AppProvider key={dbScope} scope={dbScope}>
      <SyncProvider>
        <ThemedApp />
      </SyncProvider>
    </AppProvider>
  );
}

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    SpaceGrotesk_500Medium,
    SpaceGrotesk_600SemiBold,
  });

  useEffect(() => {
    if (fontsLoaded) SplashScreen.hideAsync();
  }, [fontsLoaded]);

  if (!fontsLoaded) return null;

  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <ScopedApp />
        </AuthProvider>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}
