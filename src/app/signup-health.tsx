import { Ionicons } from '@expo/vector-icons';
import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useState } from 'react';
import { Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@/state/AuthProvider';
import { useSetting } from '@/state/queries';
import { useSignupDraft } from '@/state/signupDraft';
import { AppText } from '@/ui/components';
import { SignupHealthBackground } from '@/ui/SignupHealthBackground';
import { WelcomeCta } from '@/ui/WelcomeCta';
import { fonts, type } from '@/ui/theme/tokens';

function firstParam(value?: string | string[]): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

/** Temporary work link: skip the post-create-account gate so the ask can be
 * opened without making a new account. */
export function isSignupHealthPreview(preview?: string | string[]): boolean {
  if (firstParam(preview) === '1') return true;
  if (typeof window === 'undefined') return false;
  try {
    return new URLSearchParams(window.location.search).get('preview') === '1';
  } catch {
    return false;
  }
}

/** Watch bbox in the 1024×1536 still when it is `cover`-scaled on a
 * portrait phone. Headline sits just above the band; copy and actions
 * sit just below it. */
const WATCH_TOP = 0.156;
const WATCH_BOTTOM = 0.633;
const AROUND = 24;

/** The last step of create-account, with the account already made: ask to
 * connect Apple Health for Apple Watch. Connect does nothing yet. Not now
 * leaves the stack for the dashboard. */
export function SignupHealthView() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const [introH, setIntroH] = useState(48);

  const watchTop = height * WATCH_TOP;
  const watchBottom = height * WATCH_BOTTOM;
  const headerBottom = insets.top + 4 + 44;
  const introTop = Math.max(headerBottom + 4, watchTop - introH - AROUND);
  const lowerTop = watchBottom + AROUND;

  const goBack = () => {
    if (router.canGoBack()) router.back();
    else router.replace('/signup-credentials');
  };

  return (
    <View style={styles.root}>
      <StatusBar style="light" />
      <SignupHealthBackground />

      <View style={styles.frame} pointerEvents="box-none">
        <View style={[styles.header, { paddingTop: insets.top + 4 }]}>
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

        <View
          style={[styles.intro, { top: introTop }]}
          onLayout={(e) => setIntroH(e.nativeEvent.layout.height)}
        >
          <AppText style={styles.headline}>Connect Apple Health to use Apple Watch</AppText>
        </View>

        <View style={[styles.lower, { top: lowerTop, paddingBottom: Math.max(insets.bottom, 12) + 8 }]}>
          <AppText style={styles.copy}>
            Bring workouts, heart rate, and activity from Apple Watch into Macronaut so your
            calories and macros stay in sync. You can change this later.
          </AppText>
          <View style={styles.dock}>
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
    </View>
  );
}

export default function SignupHealthScreen() {
  const params = useLocalSearchParams<{ preview?: string }>();
  const { loading, signedIn } = useAuth();
  const onboarded = useSetting<boolean>('onboardingComplete', false, signedIn);
  const signupComplete = useSignupDraft((s) => s.signupComplete);
  const preview = isSignupHealthPreview(params.preview);

  if (preview) return <SignupHealthView />;
  if (loading || (signedIn && onboarded.isLoading)) return null;
  // Signed in without having just created the account: this is not their step.
  if (signedIn && !signupComplete) return <Redirect href={onboarded.data ? '/' : '/onboarding'} />;

  return <SignupHealthView />;
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#000000',
  },
  frame: {
    ...StyleSheet.absoluteFill,
    zIndex: 1,
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
  intro: {
    position: 'absolute',
    left: 0,
    right: 0,
    paddingHorizontal: 24,
    alignItems: 'center',
  },
  headline: {
    fontFamily: fonts.display,
    color: '#FFFFFF',
    fontSize: type.heading.fontSize,
    lineHeight: type.heading.lineHeight,
    fontWeight: '600',
    textAlign: 'center',
  },
  lower: {
    position: 'absolute',
    left: 0,
    right: 0,
    paddingHorizontal: 24,
    alignItems: 'center',
    gap: 20,
  },
  copy: {
    color: 'rgba(255,255,255,0.78)',
    fontSize: type.body.fontSize,
    lineHeight: type.body.lineHeight,
    fontWeight: '400',
    textAlign: 'center',
  },
  dock: {
    alignSelf: 'stretch',
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
