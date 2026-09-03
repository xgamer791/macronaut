import { Redirect, useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Pressable, StyleSheet } from 'react-native';
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

export default function LoginScreen() {
  const router = useRouter();
  const { loading: authLoading, signedIn } = useAuth();
  const onboarded = useSetting<boolean>('onboardingComplete', false, signedIn);
  const auth = useProviderSignIn();
  const [view, setView] = useState<'providers' | 'email'>('providers');

  if (authLoading || (signedIn && onboarded.isLoading)) return null;
  // Navigation after a successful sign-in happens here: AuthProvider publishes
  // the new session and this screen replaces itself.
  if (signedIn) return <Redirect href={onboarded.data ? '/' : '/onboarding'} />;

  return (
    <AuthShell>
      {view === 'email' ? (
        <EmailCodeFlow
          mode="signin"
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
          <AuthBrand tagline="Track your macros, own your goals." />

          <ProviderButtons
            mode="signin"
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

          <Pressable
            accessibilityRole="link"
            accessibilityLabel="Create Account"
            disabled={auth.busy}
            onPress={() => {
              auth.clearError();
              router.push('/create-account');
            }}
            style={styles.footerRow}
          >
            <AppText style={authStyles.muted}>Don&apos;t have an account? </AppText>
            <AppText style={authStyles.link}>Create Account.</AppText>
          </Pressable>
        </>
      )}
    </AuthShell>
  );
}

const styles = StyleSheet.create({
  footerRow: {
    ...authStyles.inlineRow,
    paddingTop: 4,
  },
});
