import { Ionicons } from '@expo/vector-icons';
import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
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
import { isValidSignupPassword, passwordsMatch } from '@/domain/signupCredentials';
import { isPlausibleEmail } from '@/services/auth/email';
import { useAuth } from '@/state/AuthProvider';
import { useSetting } from '@/state/queries';
import { useAccountAuth } from '@/state/useAccountAuth';
import { AppText } from '@/ui/components';
import { fieldStyles, FieldLabel, OutlineInput } from '@/ui/DarkField';
import { WelcomeBackground } from '@/ui/WelcomeBackground';
import { WelcomeCta } from '@/ui/WelcomeCta';
import { fonts, type } from '@/ui/theme/tokens';

const RESET_CODE_LENGTH = 6;

/** Email a six-digit code, then set a new password. Same chrome as Sign In.
 * Requesting a code never reveals whether the address has an account. */
export default function ForgotPasswordScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { loading, signedIn } = useAuth();
  const onboarded = useSetting<boolean>('onboardingComplete', false, signedIn);
  const auth = useAccountAuth();
  const params = useLocalSearchParams<{ email?: string }>();
  const routeEmail = Array.isArray(params.email) ? params.email[0] : params.email;
  const [stage, setStage] = useState<'request' | 'confirm'>('request');
  const [email, setEmail] = useState(routeEmail ?? '');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  if (loading || (signedIn && onboarded.isLoading)) return null;
  if (signedIn) return <Redirect href={onboarded.data ? '/' : '/onboarding'} />;

  const requestReady = isPlausibleEmail(email);
  const confirmReady =
    code.replace(/\s+/g, '').length === RESET_CODE_LENGTH &&
    isValidSignupPassword(password) &&
    passwordsMatch(password, confirmPassword);

  const goBack = () => {
    if (stage === 'confirm') {
      auth.clearError();
      setStage('request');
      setCode('');
      setPassword('');
      setConfirmPassword('');
      return;
    }
    if (router.canGoBack()) router.back();
    else router.replace('/login');
  };

  async function sendCode() {
    if (!requestReady || auth.busy) return;
    if (await auth.requestPasswordReset(email)) {
      setStage('confirm');
      setCode('');
      setPassword('');
      setConfirmPassword('');
    }
  }

  async function resetPassword() {
    if (!confirmReady || auth.busy) return;
    await auth.confirmPasswordReset(email, code, password);
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
            Forgot password
          </AppText>
          <View style={styles.headerSide} />
        </View>

        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.form}>
          {stage === 'request' ? (
            <>
              <AppText style={styles.copy}>
                Enter the email on your account. If it has a password, we will send a six-digit
                code.
              </AppText>

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
                  returnKeyType="send"
                  onSubmitEditing={() => void sendCode()}
                />
              </View>

              {auth.error ? (
                <AppText accessibilityRole="alert" style={fieldStyles.error}>
                  {auth.error}
                </AppText>
              ) : null}

              <View style={styles.ctaWrap}>
                <WelcomeCta
                  label={auth.busy ? 'Sending…' : 'Send code'}
                  accessibilityLabel="Send code"
                  disabled={!requestReady || auth.busy}
                  onPress={() => void sendCode()}
                />
              </View>
            </>
          ) : (
            <>
              <AppText style={styles.copy}>
                If {email.trim()} has a password on Macronaut, we sent a six-digit code. Enter it
                and choose a new password.
              </AppText>

              <View>
                <FieldLabel>Reset code</FieldLabel>
                <OutlineInput
                  accessibilityLabel="Reset code"
                  value={code}
                  onChangeText={(next) => {
                    if (auth.error) auth.clearError();
                    setCode(next.replace(/[^0-9]/g, '').slice(0, RESET_CODE_LENGTH));
                  }}
                  autoCapitalize="none"
                  autoComplete="one-time-code"
                  autoCorrect={false}
                  keyboardType="number-pad"
                  textContentType="oneTimeCode"
                  maxLength={RESET_CODE_LENGTH}
                  returnKeyType="next"
                />
              </View>

              <View>
                <FieldLabel>New password</FieldLabel>
                <OutlineInput
                  accessibilityLabel="New password"
                  value={password}
                  onChangeText={(next) => {
                    if (auth.error) auth.clearError();
                    setPassword(next);
                  }}
                  autoCapitalize="none"
                  autoComplete="password-new"
                  autoCorrect={false}
                  secureTextEntry={!showPassword}
                  textContentType="newPassword"
                  returnKeyType="next"
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
                <AppText style={fieldStyles.helper}>
                  Minimum password length is 8 characters. Please use at least 1 uppercase letter, 1
                  lowercase letter and 1 number.
                </AppText>
              </View>

              <View>
                <FieldLabel>Confirm new password</FieldLabel>
                <OutlineInput
                  accessibilityLabel="Confirm new password"
                  value={confirmPassword}
                  onChangeText={(next) => {
                    if (auth.error) auth.clearError();
                    setConfirmPassword(next);
                  }}
                  autoCapitalize="none"
                  autoComplete="password-new"
                  autoCorrect={false}
                  secureTextEntry={!showConfirm}
                  textContentType="newPassword"
                  returnKeyType="go"
                  onSubmitEditing={() => void resetPassword()}
                  trailing={
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={
                        showConfirm ? 'Hide confirm password' : 'Show confirm password'
                      }
                      hitSlop={8}
                      onPress={() => setShowConfirm((current) => !current)}
                    >
                      <Ionicons name={showConfirm ? 'eye-off' : 'eye'} size={20} color="#FFFFFF" />
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
                  label={auth.busy ? 'Resetting…' : 'Reset password'}
                  accessibilityLabel="Reset password"
                  disabled={!confirmReady || auth.busy}
                  onPress={() => void resetPassword()}
                />
              </View>

              <Pressable
                accessibilityRole="link"
                accessibilityLabel="Use a different email"
                disabled={auth.busy}
                onPress={goBack}
                style={styles.footerHit}
              >
                <AppText style={styles.footerLink}>Use a different email</AppText>
              </Pressable>
            </>
          )}
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
  copy: {
    color: 'rgba(255,255,255,0.78)',
    fontSize: type.body.fontSize,
    lineHeight: type.body.lineHeight,
    fontWeight: '400',
  },
  ctaWrap: {
    marginTop: 8,
  },
  footerHit: {
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  footerLink: {
    color: '#FFFFFF',
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
});
