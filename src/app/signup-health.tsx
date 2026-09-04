import { Ionicons } from '@expo/vector-icons';
import { Redirect, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@/state/AuthProvider';
import { useSetting } from '@/state/queries';
import { AppText } from '@/ui/components';
import { WatchConnectMark } from '@/ui/WatchConnectMark';
import { WelcomeBackground } from '@/ui/WelcomeBackground';
import { WelcomeCta } from '@/ui/WelcomeCta';
import { fonts, type } from '@/ui/theme/tokens';

/** After credentials: ask to connect Apple Health for Apple Watch. Connect
 * does nothing yet. Not now leaves the stack for the dashboard. */
export default function SignupHealthScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { loading, signedIn } = useAuth();
  const onboarded = useSetting<boolean>('onboardingComplete', false, signedIn);

  if (loading || (signedIn && onboarded.isLoading)) return null;
  if (signedIn) return <Redirect href={onboarded.data ? '/' : '/onboarding'} />;

  const goBack = () => {
    if (router.canGoBack()) router.back();
    else router.replace('/signup-credentials');
  };

  return (
    <View style={styles.root}>
      <StatusBar style="light" />
      <WelcomeBackground />
      <View pointerEvents="none" style={styles.veil}>
        <View style={styles.veilFilm} />
      </View>

      <View style={[styles.frame, { paddingTop: insets.top + 4 }]}>
        <View style={styles.header}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Back"
            hitSlop={8}
            onPress={goBack}
            style={styles.headerSide}
          >
            <Ionicons name="chevron-back" size={28} color="#FFFFFF" />
          </Pressable>
          <AppText accessibilityRole="header" style={styles.headerTitle}>
            Apple Health
          </AppText>
          <View style={styles.headerSide} />
        </View>

        <View style={styles.body}>
          <WatchConnectMark />
          <AppText style={styles.headline}>Connect Apple Health to use Apple Watch</AppText>
          <AppText style={styles.copy}>
            Bring workouts, heart rate, and activity from Apple Watch into Macronaut so your
            calories and macros stay in sync. You can change this later.
          </AppText>
        </View>

        <View style={[styles.dock, { paddingBottom: Math.max(insets.bottom, 12) + 8 }]}>
          <WelcomeCta label="Connect" onPress={() => {}} />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Not now"
            onPress={() => router.replace('/')}
            style={styles.skipHit}
          >
            <AppText style={styles.skipLabel}>Not now</AppText>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#101418',
  },
  veil: {
    ...StyleSheet.absoluteFill,
  },
  veilFilm: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0,0,0,0.50)',
  },
  frame: {
    flex: 1,
    zIndex: 1,
    justifyContent: 'space-between',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    minHeight: 44,
  },
  headerSide: {
    width: 44,
    height: 44,
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  headerTitle: {
    flex: 1,
    fontFamily: fonts.display,
    color: '#FFFFFF',
    fontSize: type.title.fontSize,
    lineHeight: type.title.lineHeight,
    fontWeight: '600',
    textAlign: 'center',
  },
  body: {
    paddingHorizontal: 24,
    alignItems: 'center',
    gap: 20,
  },
  headline: {
    fontFamily: fonts.display,
    color: '#FFFFFF',
    fontSize: type.heading.fontSize,
    lineHeight: type.heading.lineHeight,
    fontWeight: '600',
    textAlign: 'center',
  },
  copy: {
    color: 'rgba(255,255,255,0.78)',
    fontSize: type.body.fontSize,
    lineHeight: type.body.lineHeight,
    fontWeight: '400',
    textAlign: 'center',
  },
  dock: {
    paddingHorizontal: 24,
    gap: 8,
  },
  skipHit: {
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  skipLabel: {
    color: '#FFFFFF',
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '400',
  },
});
