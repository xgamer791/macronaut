import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { isPlausibleEmail, normalizeEmail } from '@/services/auth/email';
import { AuthMode } from '@/services/auth/providers';
import { AppText } from '@/ui/components/AppText';
import { AuthLink } from './AuthLink';
import { AuthPill } from './AuthPill';
import { AuthTextField } from './AuthTextField';
import { CODE_LENGTH, CodeInput } from './CodeInput';
import { BarbellMMark } from './icons';
import { authColors, authStyles } from './theme';

/** Seconds before a code can be re-sent. Long enough for the email to arrive,
 * short enough not to strand someone whose first one went to spam. */
const RESEND_COOLDOWN = 30;

export interface EmailCodeFlowProps {
  mode: AuthMode;
  busy: boolean;
  error: string | null;
  clearError: () => void;
  onSendCode: (email: string) => Promise<boolean>;
  onVerifyCode: (email: string, code: string) => Promise<boolean>;
  /** Back to the provider buttons. */
  onBack: () => void;
}

/** Two steps inside the card: an address, then the six-digit code we emailed
 * to it. The code verifies itself the moment its last digit lands. */
export function EmailCodeFlow({
  mode,
  busy,
  error,
  clearError,
  onSendCode,
  onVerifyCode,
  onBack,
}: EmailCodeFlowProps) {
  const [stage, setStage] = useState<'email' | 'code'>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [cooldown, setCooldown] = useState(0);
  // The code that was last submitted automatically, so a wrong one is not
  // re-sent on every render until the person changes it.
  const autoSubmitted = useRef<string | null>(null);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setTimeout(() => setCooldown((s) => s - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  useEffect(() => {
    if (stage !== 'code' || busy) return;
    if (code.length !== CODE_LENGTH || autoSubmitted.current === code) return;
    autoSubmitted.current = code;
    void onVerifyCode(email, code);
  }, [code, stage, busy, email, onVerifyCode]);

  async function sendCode() {
    if (await onSendCode(email)) {
      setStage('code');
      setCode('');
      autoSubmitted.current = null;
      setCooldown(RESEND_COOLDOWN);
    }
  }

  async function resend() {
    if (cooldown > 0) return;
    setCode('');
    autoSubmitted.current = null;
    if (await onSendCode(email)) setCooldown(RESEND_COOLDOWN);
  }

  function changeEmail() {
    clearError();
    setStage('email');
    setCode('');
    autoSubmitted.current = null;
  }

  const address = normalizeEmail(email);

  return (
    <View style={styles.flow}>
      <View style={styles.header}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Back"
          hitSlop={10}
          disabled={busy}
          onPress={stage === 'code' ? changeEmail : onBack}
          style={({ pressed }) => [styles.back, pressed && { opacity: 0.7 }]}
        >
          <Ionicons name="chevron-back" size={22} color={authColors.navy} />
        </Pressable>
        <BarbellMMark width={60} />
        <View style={styles.backSpacer} />
      </View>

      {stage === 'email' ? (
        <>
          <View style={styles.copy}>
            <AppText style={authStyles.title}>
              {mode === 'signup' ? 'Create your account' : 'Continue with Email'}
            </AppText>
            <AppText style={authStyles.subtitle}>
              {mode === 'signup'
                ? "Enter your email and we'll send a six-digit code to set up your account. No password to remember or leak."
                : "We'll email you a six-digit code. No password to remember or leak."}
            </AppText>
          </View>

          <AuthTextField
            icon="mail-outline"
            value={email}
            onChangeText={(next) => {
              if (error) clearError();
              setEmail(next);
            }}
            placeholder="you@example.com"
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            textContentType="emailAddress"
            autoComplete="email"
            returnKeyType="send"
            onSubmitEditing={() => {
              if (isPlausibleEmail(email) && !busy) void sendCode();
            }}
            editable={!busy}
            autoFocus
          />

          {error ? (
            <AppText accessibilityRole="alert" style={authStyles.error}>
              {error}
            </AppText>
          ) : null}

          <AuthPill
            label="Send code"
            variant="navy"
            loading={busy}
            disabled={!isPlausibleEmail(email)}
            onPress={() => void sendCode()}
          />
        </>
      ) : (
        <>
          <View style={styles.copy}>
            <AppText style={authStyles.title}>Check your email</AppText>
            <AppText style={authStyles.subtitle}>
              We sent a six-digit code to{' '}
              <AppText style={[authStyles.subtitle, authStyles.subtitleStrong]}>{address}</AppText>.
              Not there? Check your spam folder.
            </AppText>
          </View>

          <CodeInput
            value={code}
            onChange={(next) => {
              if (error) clearError();
              setCode(next);
            }}
            disabled={busy}
            autoFocus
          />

          {error ? (
            <AppText accessibilityRole="alert" style={authStyles.error}>
              {error}
            </AppText>
          ) : null}

          <AuthPill
            label={mode === 'signup' ? 'Create account' : 'Sign in'}
            variant="navy"
            loading={busy}
            disabled={code.length !== CODE_LENGTH}
            onPress={() => void onVerifyCode(email, code)}
          />

          <View style={styles.links}>
            <View style={authStyles.inlineRow}>
              {cooldown > 0 ? (
                <AppText style={[authStyles.muted, { color: authColors.navyMuted }]}>
                  Resend code in 0:{String(cooldown).padStart(2, '0')}
                </AppText>
              ) : (
                <AuthLink label="Resend code" disabled={busy} onPress={() => void resend()} />
              )}
            </View>
            <AuthLink label="Use a different email" disabled={busy} onPress={changeEmail} />
          </View>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  flow: {
    gap: 20,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  back: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(11, 31, 58, 0.06)',
  },
  backSpacer: {
    width: 36,
  },
  copy: {
    gap: 8,
  },
  links: {
    alignItems: 'center',
    gap: 12,
    paddingTop: 4,
  },
});
