import { Redirect } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@/state/AuthProvider';
import { useSetting } from '@/state/queries';
import { AppText } from '@/ui/components';
import { WelcomeBackground } from '@/ui/WelcomeBackground';
import { WelcomeCta } from '@/ui/WelcomeCta';
import { fonts, lightColors } from '@/ui/theme/tokens';

/** Poster splash: photo band, stacked wordmark, two identical CTAs, then a
 * text link. Create Account opens the legal gate, Sign In the email and
 * password form; More options stays inert until that pass. */
export default function WelcomeScreen() {
  const { loading, signedIn } = useAuth();
  const onboarded = useSetting<boolean>('onboardingComplete', false, signedIn);
  const insets = useSafeAreaInsets();

  if (loading || (signedIn && onboarded.isLoading)) return null;
  if (signedIn) return <Redirect href={onboarded.data ? '/' : '/onboarding'} />;

  return (
    <View style={styles.root}>
      <StatusBar style="dark" />
      <View style={styles.hero}>
        <WelcomeBackground />
      </View>

      <View style={styles.frame}>
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
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: lightColors.background,
  },
  hero: {
    height: '38%',
    overflow: 'hidden',
    backgroundColor: lightColors.track,
  },
  frame: {
    flex: 1,
  },
  wordmarkWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  macro: {
    fontFamily: fonts.semibold,
    color: lightColors.textPrimary,
    fontSize: 46,
    lineHeight: 50,
    fontWeight: '700',
    letterSpacing: 6,
    textAlign: 'center',
  },
  naut: {
    fontFamily: fonts.medium,
    color: lightColors.textPrimary,
    fontSize: 28,
    lineHeight: 32,
    fontWeight: '500',
    letterSpacing: 1.5,
    textAlign: 'center',
    marginTop: 2,
  },
  dock: {
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
    color: lightColors.textSecondary,
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '400',
  },
});
