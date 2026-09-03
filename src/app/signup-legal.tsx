import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Link, Redirect, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect, useState } from 'react';
import { Animated, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@/state/AuthProvider';
import { useSetting } from '@/state/queries';
import { AppText } from '@/ui/components';
import { WelcomeBackground } from '@/ui/WelcomeBackground';
import { WelcomeCta } from '@/ui/WelcomeCta';
import { fonts, palette, radius, type } from '@/ui/theme/tokens';

const TRACK_W = 51;
const TRACK_H = 31;
const KNOB = 27;
const KNOB_PAD = 2;
const TRACK_OFF = '#6C7076';

function LegalToggle({
  value,
  onValueChange,
  accessibilityLabel,
}: {
  value: boolean;
  onValueChange: (next: boolean) => void;
  accessibilityLabel: string;
}) {
  const [anim] = useState(() => new Animated.Value(value ? 1 : 0));

  useEffect(() => {
    Animated.timing(anim, {
      toValue: value ? 1 : 0,
      duration: 180,
      useNativeDriver: false,
    }).start();
  }, [anim, value]);

  const translateX = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [KNOB_PAD, TRACK_W - KNOB - KNOB_PAD],
  });
  const backgroundColor = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [TRACK_OFF, palette.accent],
  });

  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ checked: value }}
      hitSlop={8}
      onPress={() => onValueChange(!value)}
      style={styles.toggleHit}
    >
      <Animated.View style={[styles.track, { backgroundColor }]}>
        <Animated.View style={[styles.knob, { transform: [{ translateX }] }]} />
      </Animated.View>
    </Pressable>
  );
}

function LegalLink({ href, children }: { href: '/terms' | '/privacy'; children: string }) {
  return (
    <Link href={href} asChild>
      <Pressable accessibilityRole="link" accessibilityLabel={children}>
        <AppText style={styles.link}>{children}</AppText>
      </Pressable>
    </Link>
  );
}

/** Create-account legal gate only. Save and continue stays on this page
 * until the next screen is built. Layout matches the supplied consent
 * frame; type, accent and the CTA come from the welcome splash. */
export default function SignupLegalScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { loading, signedIn } = useAuth();
  const onboarded = useSetting<boolean>('onboardingComplete', false, signedIn);
  const [agreed, setAgreed] = useState(false);
  const [offers, setOffers] = useState(false);

  if (loading || (signedIn && onboarded.isLoading)) return null;
  if (signedIn) return <Redirect href={onboarded.data ? '/' : '/onboarding'} />;

  const goBack = () => {
    if (router.canGoBack()) router.back();
    else router.replace('/welcome');
  };

  return (
    <View style={styles.root}>
      <StatusBar style="light" />
      <WelcomeBackground />
      <View pointerEvents="none" style={styles.veil}>
        <View style={styles.veilFilm} />
        <LinearGradient
          colors={['rgba(0,0,0,0.42)', 'rgba(0,0,0,0.28)', 'rgba(0,0,0,0.72)']}
          locations={[0, 0.4, 1]}
          style={StyleSheet.absoluteFill}
        />
      </View>

      <View style={[styles.frame, { paddingTop: insets.top + 4 }]}>
        <View style={styles.top}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Back"
            hitSlop={8}
            onPress={goBack}
            style={styles.backHit}
          >
            <Ionicons name="chevron-back" size={28} color="#FFFFFF" />
          </Pressable>

          <AppText accessibilityRole="header" style={styles.title}>
            {'Terms of Service\nand Privacy Policy'}
          </AppText>
          <AppText style={styles.subtitle}>Please review the following to continue:</AppText>

          <View style={styles.cards}>
            <View style={styles.card}>
              <View style={styles.cardCopy}>
                <AppText style={styles.cardText}>I have read and agree to the </AppText>
                <LegalLink href="/terms">Terms of Service</LegalLink>
                <AppText style={styles.cardText}> and </AppText>
                <LegalLink href="/privacy">Privacy Policy</LegalLink>
                <AppText style={styles.cardText}>.</AppText>
              </View>
              <LegalToggle
                value={agreed}
                onValueChange={setAgreed}
                accessibilityLabel="Agree to the Terms of Service and Privacy Policy"
              />
            </View>

            <View style={styles.card}>
              <AppText style={[styles.cardText, styles.cardFill]}>
                Receive exclusive health education, tips, and special offers to get the most out of
                your Macronaut experience.
              </AppText>
              <LegalToggle
                value={offers}
                onValueChange={setOffers}
                accessibilityLabel="Receive health education, tips, and special offers"
              />
            </View>
          </View>
        </View>

        <View style={[styles.dock, { paddingBottom: Math.max(insets.bottom, 12) + 8 }]}>
          <WelcomeCta
            label="Save and continue"
            disabled={!agreed}
            onPress={() => {}}
          />
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
    justifyContent: 'space-between',
  },
  top: {
    paddingHorizontal: 24,
  },
  backHit: {
    width: 44,
    height: 44,
    alignItems: 'flex-start',
    justifyContent: 'center',
    marginLeft: -6,
  },
  title: {
    fontFamily: fonts.displayMedium,
    color: '#FFFFFF',
    fontSize: type.hero.fontSize,
    lineHeight: type.hero.lineHeight,
    fontWeight: '500',
    marginTop: 12,
  },
  subtitle: {
    color: '#FFFFFF',
    fontSize: type.body.fontSize,
    lineHeight: type.body.lineHeight,
    fontWeight: '400',
    marginTop: 12,
  },
  cards: {
    marginTop: 24,
    gap: 10,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    paddingVertical: 18,
    paddingHorizontal: 18,
    backgroundColor: 'rgba(38, 40, 44, 0.92)',
    borderRadius: radius.lg,
  },
  cardCopy: {
    flex: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'baseline',
  },
  cardFill: {
    flex: 1,
  },
  cardText: {
    color: '#FFFFFF',
    fontSize: type.body.fontSize,
    lineHeight: type.body.lineHeight,
    fontWeight: '400',
  },
  link: {
    color: '#FFFFFF',
    fontSize: type.body.fontSize,
    lineHeight: type.body.lineHeight,
    fontWeight: '400',
    textDecorationLine: 'underline',
  },
  toggleHit: {
    width: TRACK_W,
    height: TRACK_H,
    justifyContent: 'center',
  },
  track: {
    width: TRACK_W,
    height: TRACK_H,
    borderRadius: TRACK_H / 2,
    justifyContent: 'center',
  },
  knob: {
    width: KNOB,
    height: KNOB,
    borderRadius: KNOB / 2,
    backgroundColor: '#FFFFFF',
  },
  dock: {
    paddingHorizontal: 24,
  },
});
