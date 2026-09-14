import { Redirect } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React from 'react';
import { Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@/state/AuthProvider';
import { useSetting } from '@/state/queries';
import { AppText } from '@/ui/components';
import { WelcomeBackground } from '@/ui/WelcomeBackground';
import { WelcomeCta } from '@/ui/WelcomeCta';
import { fonts, lightColors } from '@/ui/theme/tokens';
import { getWelcomeLayout, WELCOME_SCRIM } from '@/ui/welcomeMedia';

/** Full-screen video splash, stacked wordmark, two identical CTAs, then a
 * text link. Create Account opens the legal gate, Sign In the email and
 * password form; More options stays inert until that pass. */
export default function WelcomeScreen() {
  const { loading, signedIn } = useAuth();
  const onboarded = useSetting<boolean>('onboardingComplete', false, signedIn);
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const layout = getWelcomeLayout(width, height);

  if (loading || (signedIn && onboarded.isLoading)) return null;
  if (signedIn) return <Redirect href={onboarded.data ? '/' : '/onboarding'} />;

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.scrollContent}>
      <StatusBar style="light" />
      <View style={[styles.canvas, { width: layout.width, minHeight: layout.minHeight }]}>
        <WelcomeBackground />
        <View pointerEvents="none" style={styles.scrim} />

        <View style={[styles.frame, { paddingTop: insets.top }]}>
          <View style={styles.wordmarkWrap}>
            <AppText accessibilityRole="header" style={styles.macro}>
              MACRO
            </AppText>
            <AppText style={styles.naut}>naut</AppText>
          </View>

          <View style={[styles.dock, { paddingBottom: Math.max(insets.bottom, 12) + 8 }]}>
            <View style={styles.ctaStack}>
              <WelcomeCta label="Create Account" href="/signup-legal" />
              <WelcomeCta label="Sign In" href="/login" />
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="More options"
              onPress={() => {}}
              style={styles.footerHit}
            >
              <AppText style={styles.footerLabel}>More options</AppText>
            </Pressable>
          </View>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: lightColors.background,
  },
  scrollContent: {
    flexGrow: 1,
  },
  canvas: {
    flexGrow: 1,
    alignSelf: 'center',
    overflow: 'hidden',
    backgroundColor: lightColors.track,
  },
  scrim: {
    ...StyleSheet.absoluteFill,
    backgroundColor: WELCOME_SCRIM,
  },
  frame: {
    flexGrow: 1,
    zIndex: 1,
  },
  wordmarkWrap: {
    flexGrow: 1,
    paddingVertical: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  macro: {
    fontFamily: fonts.semibold,
    color: '#FFFFFF',
    fontSize: 46,
    lineHeight: 50,
    fontWeight: '700',
    letterSpacing: 6,
    textAlign: 'center',
  },
  naut: {
    fontFamily: fonts.medium,
    color: '#FFFFFF',
    fontSize: 28,
    lineHeight: 32,
    fontWeight: '500',
    letterSpacing: 1.5,
    textAlign: 'center',
    marginTop: 2,
  },
  dock: {
    flexShrink: 0,
    paddingHorizontal: 24,
    gap: 16,
  },
  ctaStack: {
    gap: 12,
  },
  footerHit: {
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  footerLabel: {
    color: '#FFFFFF',
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '400',
  },
});
