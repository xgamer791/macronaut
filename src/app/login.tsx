import { Ionicons } from '@expo/vector-icons';
import { Redirect, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { isPlausibleEmail } from '@/services/auth/email';
import { useAuth } from '@/state/AuthProvider';
import { useSetting } from '@/state/queries';
import { useAccountAuth } from '@/state/useAccountAuth';
import { AppText } from '@/ui/components';
import { fieldStyles, FieldLabel, OutlineInput } from '@/ui/DarkField';
import { WelcomeBackground } from '@/ui/WelcomeBackground';
import { WelcomeCta } from '@/ui/WelcomeCta';
import { fonts, type } from '@/ui/theme/tokens';

/** Sign in with the email and password the account was created with. Same
 * chrome as Account Setup: the welcome loop, a back chevron, outlined
 * white-on-video fields, and the accent tile sitting in the form. */
export default function LoginScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { loading, signedIn } = useAuth();
  const onboarded = useSetting<boolean>('onboardingComplete', false, signedIn);
  const auth = useAccountAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  if (loading || (signedIn && onboarded.isLoading)) return null;
  // Navigation after a successful sign-in happens here: AuthProvider publishes
  // the new session and this screen replaces itself.
  if (signedIn) return <Redirect href={onboarded.data ? '/' : '/onboarding'} />;

  const ready = isPlausibleEmail(email) && password.length > 0;

  const goBack = () => {
    if (router.canGoBack()) router.back();
    else router.replace('/welcome');
  };

  async function signIn() {
    if (!ready || auth.busy) return;
    await auth.signIn(email, password);
  }

  return (
    <View style={styles.root}>
      <StatusBar style="light" />
      <WelcomeBackground />
      <View pointerEvents="none" style={styles.veil}>
        <View style={styles.veilFilm} />
      </View>

      <KeyboardAvoidingView
        style={styles.frame}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={[styles.header, { paddingTop: insets.top + 4 }]}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Back"
            hitSlop={8}
            onPress={goBack}
            style={styles.headerSide}
          >
            <Ionicons name="chevron-back" size={28} color="#FFFFFF" />
          </Pressable>
          <AppText accessibilityRole="header" style={styles.headerTitle}>
            Sign In
          </AppText>
          <View style={styles.headerSide} />
        </View>

        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.form}>
          <View>
            <FieldLabel>Email address</FieldLabel>
            <OutlineInput
              accessibilityLabel="Email address"
              value={email}
              onChangeText={(next) => {
                if (auth.error) auth.clearError();
                setEmail(next);
              }}
              autoCapitalize="none"
              autoComplete="email"
              autoCorrect={false}
              keyboardType="email-address"
              textContentType="emailAddress"
              returnKeyType="next"
            />
          </View>

          <View>
            <FieldLabel>Password</FieldLabel>
            <OutlineInput
              accessibilityLabel="Password"
              value={password}
              onChangeText={(next) => {
                if (auth.error) auth.clearError();
                setPassword(next);
              }}
              autoCapitalize="none"
              autoComplete="password"
              autoCorrect={false}
              secureTextEntry={!showPassword}
              textContentType="password"
              returnKeyType="go"
              onSubmitEditing={() => void signIn()}
              trailing={
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={showPassword ? 'Hide password' : 'Show password'}
                  hitSlop={8}
                  onPress={() => setShowPassword((current) => !current)}
                >
                  <Ionicons name={showPassword ? 'eye-off' : 'eye'} size={20} color="#FFFFFF" />
                </Pressable>
              }
            />
          </View>

          {auth.error ? (
            <AppText accessibilityRole="alert" style={fieldStyles.error}>
              {auth.error}
            </AppText>
          ) : null}

          <View style={styles.ctaWrap}>
            <WelcomeCta
              label={auth.busy ? 'Signing in…' : 'Sign In'}
              accessibilityLabel="Sign In"
              disabled={!ready || auth.busy}
              onPress={() => void signIn()}
            />
          </View>

          <Pressable
            accessibilityRole="link"
            accessibilityLabel="Create Account"
            disabled={auth.busy}
            onPress={() => {
              auth.clearError();
              router.replace('/signup-legal');
            }}
            style={styles.footerHit}
          >
            <AppText style={styles.footerLabel}>Don&apos;t have an account? </AppText>
            <AppText style={styles.footerLink}>Create Account.</AppText>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
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
    backgroundColor: 'rgba(0,0,0,0.50)',
  },
  frame: {
    flex: 1,
    zIndex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    minHeight: 44,
  },
  headerSide: {
    width: 44,
    height: 44,
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  headerTitle: {
    flex: 1,
    fontFamily: fonts.display,
    color: '#FFFFFF',
    fontSize: type.title.fontSize,
    lineHeight: type.title.lineHeight,
    fontWeight: '600',
    textAlign: 'center',
  },
  form: {
    paddingHorizontal: 24,
    paddingTop: 28,
    paddingBottom: 32,
    gap: 20,
  },
  ctaWrap: {
    marginTop: 8,
  },
  footerHit: {
    minHeight: 44,
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'center',
  },
  footerLabel: {
    color: 'rgba(255,255,255,0.78)',
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '400',
  },
  footerLink: {
    color: '#FFFFFF',
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
});
