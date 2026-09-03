import { LinearGradient } from 'expo-linear-gradient';
import { Redirect } from 'expo-router';
import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@/state/AuthProvider';
import { useSetting } from '@/state/queries';
import { AppText } from '@/ui/components';
import { WelcomeSlideshow } from '@/ui/WelcomeSlideshow';
import { fonts, palette } from '@/ui/theme/tokens';

/** Poster splash: full-bleed photo, mid-canvas stacked wordmark, two identical
 * CTAs, then a text link. No borrowed marks or provider pills. The buttons
 * are inert until the next pass wires them. */
export default function WelcomeScreen() {
  const { loading, signedIn } = useAuth();
  const onboarded = useSetting<boolean>('onboardingComplete', false, signedIn);
  const insets = useSafeAreaInsets();

  if (loading || (signedIn && onboarded.isLoading)) return null;
  if (signedIn) return <Redirect href={onboarded.data ? '/' : '/onboarding'} />;

  return (
    <View style={styles.root}>
      <WelcomeSlideshow />
      {/* Cinematic film + bottom-weighted wash — same idea as the Garmin
       * poster: the athlete stays visible, white type and the CTAs sit on
       * darkness. Flat colour, no blur, no glow. */}
      <View pointerEvents="none" style={styles.veil}>
        <View style={styles.veilFilm} />
        <LinearGradient
          colors={['rgba(0,0,0,0.28)', 'rgba(0,0,0,0.10)', 'rgba(0,0,0,0.64)']}
          locations={[0, 0.4, 1]}
          style={StyleSheet.absoluteFill}
        />
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
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Create Account"
              onPress={() => {}}
              style={styles.cta}
            >
              <AppText style={styles.ctaLabel}>Create Account</AppText>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Sign In"
              onPress={() => {}}
              style={styles.cta}
            >
              <AppText style={styles.ctaLabel}>Sign In</AppText>
            </Pressable>
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
    backgroundColor: '#101418',
  },
  veil: {
    ...StyleSheet.absoluteFill,
  },
  veilFilm: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0,0,0,0.36)',
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
  cta: {
    height: 50,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: palette.accent,
    borderRadius: 0,
  },
  ctaLabel: {
    fontFamily: fonts.display,
    color: '#FFFFFF',
    fontSize: 17,
    lineHeight: 22,
    fontWeight: '600',
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
