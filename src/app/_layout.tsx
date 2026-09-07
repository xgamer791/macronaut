import {
  SpaceGrotesk_500Medium,
  SpaceGrotesk_600SemiBold,
  useFonts,
} from '@expo-google-fonts/space-grotesk';
import { QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import React, { useEffect, useRef, useSyncExternalStore } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { convexConfigStatus } from '@/services/convex/client';
import { AppProvider, useRepos } from '@/state/AppProvider';
import { AuthProvider, useAuth } from '@/state/AuthProvider';
import { keys, useSetting } from '@/state/queries';
import { SLIDE_OVER_OPTIONS } from '@/ui/motion/SlideScreen';
import { AppearanceMode, ThemeProvider } from '@/ui/theme/ThemeProvider';

SplashScreen.preventAutoHideAsync();

const subscribeNever = () => () => {};

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 30_000,
    },
  },
});

function ThemedApp() {
  const { settings, profile } = useRepos();
  const qc = useQueryClient();
  const { signedIn } = useAuth();
  const appearance = useSetting<AppearanceMode>('appearance', 'system', signedIn);

  // A profile row was only written the first time somebody edited their
  // profile, and that table is what everyone else's people search reads. An
  // account that just signed up and started logging food was therefore
  // invisible, so claim its row and handle as soon as we know who is here.
  const claimed = useRef(false);
  useEffect(() => {
    if (!signedIn || claimed.current) return;
    claimed.current = true;
    profile.ensure().catch(() => {
      claimed.current = false;
    });
  }, [signedIn, profile]);

  // Renders on the default mode and switches when the stored one arrives, so
  // signing in never unmounts the navigator below (see AccountApp).
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
        <Stack.Screen name="welcome" />
        <Stack.Screen name="login" />
        <Stack.Screen name="forgot-password" />
        <Stack.Screen name="signup-legal" />
        <Stack.Screen name="signup-account" />
        <Stack.Screen name="signup-credentials" />
        <Stack.Screen name="signup-health" />
        <Stack.Screen name="preview-signup-health" />
        <Stack.Screen name="onboarding" />
        <Stack.Screen name="add" options={{ presentation: 'modal' }} />
        <Stack.Screen name="manual-entry" options={{ presentation: 'modal' }} />
        <Stack.Screen name="goals" options={SLIDE_OVER_OPTIONS} />
        <Stack.Screen name="activity" options={{ presentation: 'modal' }} />
        <Stack.Screen name="scan" options={{ presentation: 'modal' }} />
        <Stack.Screen name="ai-scan" options={{ presentation: 'modal' }} />
        <Stack.Screen name="custom-food" options={{ presentation: 'modal' }} />
        <Stack.Screen name="log-collection" options={{ presentation: 'modal' }} />
        <Stack.Screen name="meal-editor" options={{ presentation: 'modal' }} />
        <Stack.Screen name="recipe-editor" options={{ presentation: 'modal' }} />
        <Stack.Screen name="meal/[id]" options={SLIDE_OVER_OPTIONS} />
        <Stack.Screen name="profile" options={SLIDE_OVER_OPTIONS} />
        <Stack.Screen name="photos" options={SLIDE_OVER_OPTIONS} />
        <Stack.Screen name="groups" options={SLIDE_OVER_OPTIONS} />
        <Stack.Screen name="chats" options={SLIDE_OVER_OPTIONS} />
        <Stack.Screen name="new-chat" options={{ presentation: 'modal' }} />
        <Stack.Screen name="chat/[id]" options={SLIDE_OVER_OPTIONS} />
        <Stack.Screen name="notifications" options={SLIDE_OVER_OPTIONS} />
        {/* Reachable signed-out: the create-account legal gate links to both,
            and a shared public profile link is opened by people with no
            account at all. */}
        <Stack.Screen name="privacy" options={SLIDE_OVER_OPTIONS} />
        <Stack.Screen name="terms" options={SLIDE_OVER_OPTIONS} />
        <Stack.Screen name="apple-health" options={SLIDE_OVER_OPTIONS} />
        <Stack.Screen name="u/[handle]" options={SLIDE_OVER_OPTIONS} />
      </Stack>
    </ThemeProvider>
  );
}

/**
 * The navigator must survive signing in. Creating an account swaps the session
 * under a mounted screen, and anything above <Stack> that unmounts on that
 * change — blanking while the viewer loads, or a key that follows the account —
 * throws away the navigation state with it, so the screen the flow had just
 * moved to is replaced by whatever the router falls back to.
 *
 * Nothing here needs to be rebuilt per account anyway: the repositories are
 * stateless wrappers over the one Convex client (createRepos), which account
 * they read is decided by the session it carries, and the cached queries of the
 * account before are dropped by AuthProvider. Each screen waits for `loading`
 * on its own.
 */
function AccountApp() {
  return (
    <AppProvider>
      <ThemedApp />
    </AppProvider>
  );
}

/** A build with no backend URL cannot do anything useful; say so instead of
 * crashing inside the provider tree. */
function NotConfigured({ message }: { message: string }) {
  return (
    <View style={styles.notConfigured}>
      <Text style={styles.notConfiguredTitle}>Macronaut is not configured</Text>
      <Text style={styles.notConfiguredBody}>{message}</Text>
    </View>
  );
}

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    SpaceGrotesk_500Medium,
    SpaceGrotesk_600SemiBold,
  });
  // The Convex client opens a WebSocket when created. The static web export
  // renders this tree in Node at build time, where that must not happen, so
  // on web nothing below renders until the page is really running in a
  // browser (the server snapshot is false, the client snapshot true).
  const inBrowser = useSyncExternalStore(
    subscribeNever,
    () => true,
    () => false,
  );
  const mounted = Platform.OS !== 'web' || inBrowser;

  useEffect(() => {
    if (fontsLoaded) SplashScreen.hideAsync();
  }, [fontsLoaded]);

  if (!fontsLoaded || !mounted) return null;

  const config = convexConfigStatus();
  if (!config.ok) return <NotConfigured message={config.message} />;

  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <AccountApp />
        </AuthProvider>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  notConfigured: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    backgroundColor: '#101418',
    gap: 12,
  },
  notConfiguredTitle: { color: '#FFFFFF', fontSize: 18, fontWeight: '700', textAlign: 'center' },
  notConfiguredBody: { color: '#B8C0CC', fontSize: 14, lineHeight: 20, textAlign: 'center' },
});
