import { Ionicons } from '@expo/vector-icons';
import { useQueryClient } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { Redirect, useRouter } from 'expo-router';
import React, { useState } from 'react';
import {
  Platform,
  Pressable,
  StyleSheet,
  View,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path, Rect } from 'react-native-svg';
import { useRepos } from '@/state/AppProvider';
import { keys, useSetting } from '@/state/queries';
import { AppText, Button, Sheet, TextField } from '@/ui/components';
import { fonts, spacing } from '@/ui/theme/tokens';

const BG = require('../../assets/images/login/editorial-produce.png');

const NAVY = '#0B1F3A';
const NAVY_SOFT = '#1A2F4A';
const CARD_BG = 'rgba(255, 255, 255, 0.86)';

/** Editorial photo login — mockup 5 with Google above Email. */
export default function LoginScreen() {
  const router = useRouter();
  const qc = useQueryClient();
  const { settings } = useRepos();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const auth = useSetting<boolean>('authComplete', false);
  const onboarded = useSetting<boolean>('onboardingComplete', false);

  const [emailOpen, setEmailOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);

  if (auth.isLoading || onboarded.isLoading) return null;
  if (auth.data && onboarded.data) return <Redirect href="/" />;
  if (auth.data && !onboarded.data) return <Redirect href="/onboarding" />;

  const cardWidth = Math.min(width - spacing.xl * 2, 340);

  async function completeAuth(provider: 'google' | 'email', displayName?: string) {
    setBusy(true);
    try {
      await settings.set('authComplete', true);
      await settings.set('authProvider', provider);
      if (displayName?.trim()) {
        await settings.set('displayName', displayName.trim());
        qc.invalidateQueries({ queryKey: keys.setting('displayName') });
      }
      qc.invalidateQueries({ queryKey: keys.setting('authComplete') });
      const done = await settings.getOnboardingComplete();
      router.replace(done ? '/' : '/onboarding');
    } finally {
      setBusy(false);
      setEmailOpen(false);
    }
  }

  return (
    <View style={styles.root}>
      <Image
        source={BG}
        style={StyleSheet.absoluteFill}
        contentFit="cover"
        blurRadius={Platform.OS === 'web' ? 0 : 18}
      />
      {/* Soft blur veil so the glass card stays legible (matches mockup). */}
      <View
        style={[
          StyleSheet.absoluteFill,
          Platform.OS === 'web'
            ? ({
                backdropFilter: 'blur(10px) saturate(115%)',
                WebkitBackdropFilter: 'blur(10px) saturate(115%)',
                backgroundColor: 'rgba(255,255,255,0.12)',
              } as object)
            : { backgroundColor: 'rgba(255,255,255,0.18)' },
        ]}
      />

      <View
        style={[
          styles.center,
          {
            paddingTop: insets.top + spacing.lg,
            paddingBottom: insets.bottom + spacing.lg,
          },
        ]}
      >
        <View
          style={[
            styles.card,
            {
              width: cardWidth,
              maxHeight: height - insets.top - insets.bottom - spacing.xl * 2,
              ...(Platform.OS === 'web'
                ? ({
                    backdropFilter: 'blur(28px) saturate(140%)',
                    WebkitBackdropFilter: 'blur(28px) saturate(140%)',
                  } as object)
                : null),
            },
          ]}
        >
          <View style={styles.brand}>
            <BarbellMMark />
            <AppText style={styles.wordmark}>MacroNaught</AppText>
            <AppText style={styles.tagline}>Track your macros, own your goals.</AppText>
          </View>

          <View style={styles.actions}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Continue with Google"
              disabled={busy}
              onPress={() => void completeAuth('google')}
              style={({ pressed }) => [
                styles.btn,
                styles.btnGoogle,
                pressed && { opacity: 0.9 },
              ]}
            >
              <GoogleG />
              <AppText style={styles.btnGoogleLabel}>Continue with Google</AppText>
            </Pressable>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Continue with Email"
              disabled={busy}
              onPress={() => setEmailOpen(true)}
              style={({ pressed }) => [
                styles.btn,
                styles.btnEmail,
                pressed && { opacity: 0.9 },
              ]}
            >
              <Ionicons name="mail-outline" size={20} color="#FFFFFF" />
              <AppText style={styles.btnEmailLabel}>Continue with Email</AppText>
            </Pressable>
          </View>

          <Pressable
            accessibilityRole="link"
            accessibilityLabel="Create Account"
            disabled={busy}
            onPress={() => setEmailOpen(true)}
            style={styles.createRow}
          >
            <AppText style={styles.createMuted}>Don&apos;t have an account? </AppText>
            <AppText style={styles.createLink}>Create Account.</AppText>
          </Pressable>
        </View>
      </View>

      <Sheet visible={emailOpen} onClose={() => setEmailOpen(false)} title="Continue with Email">
        <TextField
          label="Email"
          value={email}
          onChangeText={setEmail}
          placeholder="you@example.com"
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="email-address"
          autoFocus
        />
        <Button
          title="Continue"
          loading={busy}
          disabled={!email.trim().includes('@')}
          onPress={() => {
            const local = email.trim().split('@')[0] ?? '';
            const pretty = local
              ? local.charAt(0).toUpperCase() + local.slice(1)
              : undefined;
            void completeAuth('email', pretty);
          }}
        />
      </Sheet>
    </View>
  );
}

function BarbellMMark() {
  return (
    <Svg width={78} height={52} viewBox="0 0 78 52" accessibilityLabel="MacroNaught logo">
      {/* Left plates */}
      <Rect x={2} y={16} width={5} height={20} rx={1.5} fill="#2E8B57" />
      <Rect x={8} y={12} width={6} height={28} rx={1.5} fill="#3FA66A" />
      <Rect x={15} y={17} width={5} height={18} rx={1.2} fill="#57C07E" />
      {/* Crossbar through M */}
      <Rect x={20} y={24} width={38} height={4.5} rx={1} fill={NAVY} />
      {/* Bold M */}
      <Path
        d="M24 40 V12 H30 L39 30 L48 12 H54 V40 H48 V22 L39 38 H36 L27 22 V40 Z"
        fill={NAVY}
      />
      {/* Right plates */}
      <Rect x={58} y={17} width={5} height={18} rx={1.2} fill="#57C07E" />
      <Rect x={64} y={12} width={6} height={28} rx={1.5} fill="#3FA66A" />
      <Rect x={71} y={16} width={5} height={20} rx={1.5} fill="#2E8B57" />
    </Svg>
  );
}

/** Official-style four-color Google G. */
function GoogleG() {
  return (
    <Svg width={20} height={20} viewBox="0 0 48 48">
      <Path
        fill="#EA4335"
        d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
      />
      <Path
        fill="#4285F4"
        d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
      />
      <Path
        fill="#FBBC05"
        d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
      />
      <Path
        fill="#34A853"
        d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
      />
      <Path fill="none" d="M0 0h48v48H0z" />
    </Svg>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#E8E4DF',
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
  },
  card: {
    backgroundColor: CARD_BG,
    borderRadius: 28,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.95)',
    paddingHorizontal: 28,
    paddingTop: 36,
    paddingBottom: 28,
    gap: 28,
    shadowColor: '#0B1F3A',
    shadowOpacity: 0.18,
    shadowRadius: 28,
    shadowOffset: { width: 0, height: 14 },
    elevation: 12,
  },
  brand: {
    alignItems: 'center',
    gap: 10,
  },
  wordmark: {
    fontFamily: fonts.display,
    fontSize: 30,
    lineHeight: 36,
    fontWeight: '700',
    color: NAVY,
    letterSpacing: -0.4,
    textAlign: 'center',
  },
  tagline: {
    fontFamily: fonts.displayMedium,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '500',
    color: NAVY_SOFT,
    textAlign: 'center',
  },
  actions: {
    gap: 12,
    width: '100%',
  },
  btn: {
    minHeight: 52,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingHorizontal: spacing.lg,
  },
  btnGoogle: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: 'rgba(11, 31, 58, 0.12)',
    shadowColor: '#0B1F3A',
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  btnGoogleLabel: {
    fontFamily: fonts.displayMedium,
    fontSize: 16,
    lineHeight: 22,
    fontWeight: '600',
    color: NAVY,
  },
  btnEmail: {
    backgroundColor: NAVY,
    shadowColor: '#0B1F3A',
    shadowOpacity: 0.22,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  btnEmailLabel: {
    fontFamily: fonts.displayMedium,
    fontSize: 16,
    lineHeight: 22,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  createRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 4,
  },
  createMuted: {
    fontSize: 14,
    lineHeight: 20,
    color: NAVY_SOFT,
  },
  createLink: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '600',
    color: NAVY,
    textDecorationLine: 'underline',
  },
});
