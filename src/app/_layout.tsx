import {
  SpaceGrotesk_500Medium,
  SpaceGrotesk_600SemiBold,
  useFonts,
} from '@expo-google-fonts/space-grotesk';
import { QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import React, { useEffect } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AppProvider, useRepos } from '@/state/AppProvider';
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

function ThemedApp() {
  const { settings } = useRepos();
  const qc = useQueryClient();
  const appearance = useSetting<AppearanceMode>('appearance', 'system');

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
        <Stack.Screen name="onboarding" />
        <Stack.Screen name="add" options={{ presentation: 'modal' }} />
        <Stack.Screen name="manual-entry" options={{ presentation: 'modal' }} />
        <Stack.Screen name="goals" />
        <Stack.Screen name="activity" />
        <Stack.Screen name="log-activity" options={{ presentation: 'modal' }} />
        <Stack.Screen name="scan" options={{ presentation: 'modal' }} />
        <Stack.Screen name="ai-scan" options={{ presentation: 'modal' }} />
        <Stack.Screen name="custom-food" options={{ presentation: 'modal' }} />
        <Stack.Screen name="log-collection" options={{ presentation: 'modal' }} />
        <Stack.Screen name="meal-editor" options={{ presentation: 'modal' }} />
        <Stack.Screen name="recipe-editor" options={{ presentation: 'modal' }} />
      </Stack>
    </ThemeProvider>
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
        <AppProvider>
          <ThemedApp />
        </AppProvider>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}
