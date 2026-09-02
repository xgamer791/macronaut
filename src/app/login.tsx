import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { Redirect } from 'expo-router';
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
import {
  isPlausibleEmail,
  sendEmailCode,
  signInWithGoogle,
  verifyEmailCode,
} from '@/services/supabase/auth';
import { supabaseConfigStatus } from '@/services/supabase/client';
import { useAuth } from '@/state/AuthProvider';
import { useSetting } from '@/state/queries';
import { AppText, Button, Sheet, TextField } from '@/ui/components';
import { fonts, spacing } from '@/ui/theme/tokens';

const BG = require('../../assets/images/login/editorial-produce.png');

const NAVY = '#0B1F3A';
const NAVY_SOFT = '#1A2F4A';
const CARD_BG = 'rgba(255, 255, 255, 0.86)';
const DANGER = '#B3261E';

/** Keeps provider internals out of the UI while still telling the user what to
 * do next. Anything unrecognised gets a generic message rather than a raw
 * server string. */
function friendlyAuthError(err: unknown): string {
  const raw = err instanceof Error ? err.message : String(err ?? '');
  const message = raw.toLowerCase();
  if (message.includes('rate limit') || message.includes('too many')) {
    return 'Too many attempts. Wait a minute and try again.';
  }
  if (message.includes('expired')) return 'That code has expired. Request a new one.';
  if (message.includes('invalid') && message.includes('token')) {
    return 'That code is not right. Check it and try again.';
  }
  if (message.includes('otp') || message.includes('token')) {
    return 'That code is not right. Check it and try again.';
  }
  if (message.includes('network') || message.includes('fetch')) {
    return 'Could not reach the server. Check your connection.';
  }
  if (message.includes('not configured')) {
    return 'Accounts are not enabled on this build.';
  }
  return 'Something went wrong signing in. Please try again.';
}

export default function LoginScreen() {
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const { loading: authLoading, signedIn, accountsEnabled, continueLocalOnly } = useAuth();
  const onboarded = useSetting<boolean>('onboardingComplete', false);

  const [emailOpen, setEmailOpen] = useState(false);
  const [stage, setStage] = useState<'email' | 'code'>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (authLoading || onboarded.isLoading) return null;
  if (signedIn) return <Redirect href={onboarded.data ? '/' : '/onboarding'} />;

  const cardWidth = Math.min(width - spacing.xl * 2, 340);

  // A build that was *meant* to have accounts but has a bad URL or a
  // privileged key falls back to local-only. Say so instead of quietly
  // behaving like a build that never had a project configured.
  const config = supabaseConfigStatus();
  const misconfigured = !config.ok && config.reason !== 'not-configured' ? config : null;

  function closeEmail() {
    setEmailOpen(false);
    setStage('email');
    setCode('');
    setError(null);
  }

  async function run(action: () => Promise<void>) {
    setBusy(true);
    setError(null);
    try {
      await action();
    } catch (err) {
      setError(friendlyAuthError(err));
    } finally {
      setBusy(false);
    }
  }

  // Navigation after a successful sign-in is handled by the redirect above:
  // AuthProvider publishes the new session and this screen unmounts itself.
  const onGoogle = () =>
    run(async () => {
      if (!accountsEnabled) return continueLocalOnly();
      await signInWithGoogle();
    });

  const onSendCode = () =>
    run(async () => {
      await sendEmailCode(email);
      setStage('code');
    });

  const onVerifyCode = () =>
    run(async () => {
      await verifyEmailCode(email, code);
    });

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
              accessibilityLabel={
                accountsEnabled ? 'Continue with Google' : 'Continue on this device'
              }
              disabled={busy}
              onPress={() => void onGoogle()}
              style={({ pressed }) => [
                styles.btn,
                styles.btnGoogle,
                pressed && { opacity: 0.9 },
                busy && { opacity: 0.6 },
              ]}
            >
              {accountsEnabled ? (
                <GoogleG />
              ) : (
                <Ionicons name="phone-portrait-outline" size={20} color={NAVY} />
              )}
              <AppText style={styles.btnGoogleLabel}>
                {accountsEnabled ? 'Continue with Google' : 'Continue on this device'}
              </AppText>
            </Pressable>

            {accountsEnabled ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Continue with Email"
                disabled={busy}
                onPress={() => {
                  setError(null);
                  setEmailOpen(true);
                }}
                style={({ pressed }) => [
                  styles.btn,
                  styles.btnEmail,
                  pressed && { opacity: 0.9 },
                  busy && { opacity: 0.6 },
                ]}
              >
                <Ionicons name="mail-outline" size={20} color="#FFFFFF" />
                <AppText style={styles.btnEmailLabel}>Continue with Email</AppText>
              </Pressable>
            ) : null}
          </View>

          {error ? (
            <AppText accessibilityRole="alert" style={styles.error}>
              {error}
            </AppText>
          ) : null}

          {accountsEnabled ? (
            <Pressable
              accessibilityRole="link"
              accessibilityLabel="Create Account"
              disabled={busy}
              onPress={() => {
                setError(null);
                setEmailOpen(true);
              }}
              style={styles.createRow}
            >
              <AppText style={styles.createMuted}>Don&apos;t have an account? </AppText>
              <AppText style={styles.createLink}>Create Account.</AppText>
            </Pressable>
          ) : misconfigured ? (
            <AppText accessibilityRole="alert" style={styles.error}>
              Accounts are misconfigured on this build, so it is running local-only.{' '}
              {misconfigured.message}
            </AppText>
          ) : (
            <AppText style={styles.localNote}>
              This build has no account server configured, so your diary stays in a local database
              on this device only.
            </AppText>
          )}
        </View>
      </View>

      <Sheet
        visible={emailOpen}
        onClose={closeEmail}
        title={stage === 'email' ? 'Continue with Email' : 'Enter your code'}
      >
        {stage === 'email' ? (
          <>
            <TextField
              label="Email"
              value={email}
              onChangeText={setEmail}
              placeholder="you@example.com"
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              textContentType="emailAddress"
              autoFocus
            />
            <AppText variant="caption" tone="secondary">
              We&apos;ll email you a six-digit code. No password to remember or leak.
            </AppText>
            {error ? (
              <AppText accessibilityRole="alert" style={styles.error}>
                {error}
              </AppText>
            ) : null}
            <Button
              title="Send code"
              loading={busy}
              disabled={busy || !isPlausibleEmail(email)}
              onPress={() => void onSendCode()}
            />
          </>
        ) : (
          <>
            <TextField
              label="Six-digit code"
              value={code}
              onChangeText={(next) => setCode(next.replace(/[^0-9]/g, '').slice(0, 6))}
              placeholder="123456"
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="number-pad"
              textContentType="oneTimeCode"
              autoFocus
            />
            <AppText variant="caption" tone="secondary">
              Sent to {email.trim().toLowerCase()}. Codes expire shortly.
            </AppText>
            {error ? (
              <AppText accessibilityRole="alert" style={styles.error}>
                {error}
              </AppText>
            ) : null}
            <Button
              title="Sign in"
              loading={busy}
              disabled={busy || code.length !== 6}
              onPress={() => void onVerifyCode()}
            />
            <Button
              title="Use a different email"
              variant="ghost"
              disabled={busy}
              onPress={() => {
                setStage('email');
                setCode('');
                setError(null);
              }}
            />
          </>
        )}
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
  error: {
    fontSize: 14,
    lineHeight: 20,
    color: DANGER,
    textAlign: 'center',
  },
  localNote: {
    fontSize: 13,
    lineHeight: 19,
    color: NAVY_SOFT,
    textAlign: 'center',
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
