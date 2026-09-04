import { Redirect } from 'expo-router';
import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@/state/AuthProvider';
import { useSetting } from '@/state/queries';
import { AppText } from '@/ui/components';
import { WelcomeCta } from '@/ui/WelcomeCta';
import { fonts } from '@/ui/theme/tokens';

/** Poster splash: full-bleed photo, mid-canvas stacked wordmark, two identical
 * CTAs, then a text link. Create Account opens the legal gate; Sign In and
 * More options stay inert until those passes. */
export default function WelcomeScreen() {
  const { loading, signedIn } = useAuth();
  const onboarded = useSetting<boolean>('onboardingComplete', false, signedIn);
  const insets = useSafeAreaInsets();

  if (loading || (signedIn && onboarded.isLoading)) return null;
  if (signedIn) return <Redirect href={onboarded.data ? '/' : '/onboarding'} />;

  return (
    <View style={styles.root}>
      {/* Flat 50% film so white type stays readable. No extra gradient. */}
      <View pointerEvents="none" style={styles.veil}>
        <View style={styles.veilFilm} />
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
            <WelcomeCta label="Sign In" onPress={() => {}} />
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
    backgroundColor: 'transparent',
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
  },
  wordmarkWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  macro: {
    fontFamily: fonts.display,
    color: '#FFFFFF',
    fontSize: 46,
    lineHeight: 50,
    fontWeight: '700',
    letterSpacing: 6,
    textAlign: 'center',
  },
  naut: {
    fontFamily: fonts.displayMedium,
    color: '#FFFFFF',
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
    color: '#FFFFFF',
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '400',
  },
});
