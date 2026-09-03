import { Redirect, useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useAuth } from '@/state/AuthProvider';
import { useSetting } from '@/state/queries';
import { useProviderSignIn } from '@/state/useProviderSignIn';
import { AppText } from '@/ui/components';
import {
  AuthBrand,
  AuthShell,
  EmailCodeFlow,
  ProviderButtons,
  authStyles,
} from '@/ui/components/auth';

/** Creating an account is the same round trip as signing in — the account is
 * created on first sign-in — so this screen is the login card with sign-up
 * wording and the legal line the stores expect at the point of sign-up. */
export default function CreateAccountScreen() {
  const router = useRouter();
  const { loading: authLoading, signedIn } = useAuth();
  const onboarded = useSetting<boolean>('onboardingComplete', false, signedIn);
  const auth = useProviderSignIn();
  const [view, setView] = useState<'providers' | 'email'>('providers');

  if (authLoading || (signedIn && onboarded.isLoading)) return null;
  if (signedIn) return <Redirect href={onboarded.data ? '/' : '/onboarding'} />;

  return (
    <AuthShell>
      {view === 'email' ? (
        <EmailCodeFlow
          mode="signup"
          busy={auth.busy}
          error={auth.error}
          clearError={auth.clearError}
          onSendCode={auth.sendEmailCode}
          onVerifyCode={auth.verifyEmailCode}
          onBack={() => {
            auth.clearError();
            setView('providers');
          }}
        />
      ) : (
        <>
          <AuthBrand tagline="Create your account and start tracking." />

          <ProviderButtons
            mode="signup"
            busy={auth.busy}
            onApple={() => void auth.signInWithApple()}
            onGoogle={() => void auth.signInWithGoogle()}
            onEmail={() => {
              auth.clearError();
              setView('email');
            }}
          />

          {auth.error ? (
            <AppText accessibilityRole="alert" style={authStyles.error}>
              {auth.error}
            </AppText>
          ) : null}

          <View style={styles.footer}>
            <AppText style={styles.legal}>
              By continuing, you agree to our{' '}
              <AppText
                accessibilityRole="link"
                style={styles.legalLink}
                onPress={() => router.push('/terms')}
              >
                Terms of Service
              </AppText>{' '}
              and{' '}
              <AppText
                accessibilityRole="link"
                style={styles.legalLink}
                onPress={() => router.push('/privacy')}
              >
                Privacy Policy
              </AppText>
              .
            </AppText>

            <Pressable
              accessibilityRole="link"
              accessibilityLabel="Sign in"
              disabled={auth.busy}
              onPress={() => {
                auth.clearError();
                router.replace('/login');
              }}
              style={authStyles.inlineRow}
            >
              <AppText style={authStyles.muted}>Already have an account? </AppText>
              <AppText style={authStyles.link}>Sign in.</AppText>
            </Pressable>
          </View>
        </>
      )}
    </AuthShell>
  );
}

const styles = StyleSheet.create({
  footer: {
    gap: 16,
    alignItems: 'center',
  },
  legal: {
    fontSize: 13,
    lineHeight: 19,
    color: authStyles.muted.color,
    textAlign: 'center',
  },
  legalLink: {
    fontSize: 13,
    lineHeight: 19,
    fontWeight: '600',
    color: authStyles.link.color,
    textDecorationLine: 'underline',
  },
});
