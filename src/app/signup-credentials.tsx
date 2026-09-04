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
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { isValidSignupCredentials } from '@/domain/signupCredentials';
import { useAuth } from '@/state/AuthProvider';
import { useSetting } from '@/state/queries';
import { AppText } from '@/ui/components';
import { WelcomeBackground } from '@/ui/WelcomeBackground';
import { WelcomeCta } from '@/ui/WelcomeCta';
import { fonts, palette, radius, type } from '@/ui/theme/tokens';

function FieldLabel({ children }: { children: string }) {
  return (
    <AppText style={styles.label}>
      {children}
      <AppText style={styles.required}> *</AppText>
    </AppText>
  );
}

function OutlineInput({
  value,
  onChangeText,
  accessibilityLabel,
  placeholder,
  autoCapitalize,
  autoComplete,
  autoCorrect,
  keyboardType,
  secureTextEntry,
  textContentType,
  trailing,
}: {
  value: string;
  onChangeText: (next: string) => void;
  accessibilityLabel: string;
  placeholder?: string;
  autoCapitalize?: 'none' | 'words';
  autoComplete?: 'name' | 'email' | 'password-new' | 'off';
  autoCorrect?: boolean;
  keyboardType?: 'default' | 'email-address';
  secureTextEntry?: boolean;
  textContentType?: 'name' | 'emailAddress' | 'newPassword';
  trailing?: React.ReactNode;
}) {
  return (
    <View style={styles.field}>
      <TextInput
        accessibilityLabel={accessibilityLabel}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="rgba(255,255,255,0.45)"
        autoCapitalize={autoCapitalize}
        autoComplete={autoComplete}
        autoCorrect={autoCorrect}
        keyboardType={keyboardType}
        secureTextEntry={secureTextEntry}
        textContentType={textContentType}
        style={styles.fieldInput}
      />
      {trailing}
    </View>
  );
}

/** Name, email, and password after birthday + country. Layout follows the
 * supplied create-account frame; type, accent and the CTA stay Macronaut.
 * Create Account does not leave this page until the next screen is built. */
export default function SignupCredentialsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { loading, signedIn } = useAuth();
  const onboarded = useSetting<boolean>('onboardingComplete', false, signedIn);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [confirmEmail, setConfirmEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  if (loading || (signedIn && onboarded.isLoading)) return null;
  if (signedIn) return <Redirect href={onboarded.data ? '/' : '/onboarding'} />;

  const ready = isValidSignupCredentials(name, email, confirmEmail, password, confirmPassword);

  const goBack = () => {
    if (router.canGoBack()) router.back();
    else router.replace('/signup-account');
  };

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
            Create An Account
          </AppText>
          <View style={styles.headerSide} />
        </View>

        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.form}
        >
          <View>
            <FieldLabel>Name</FieldLabel>
            <OutlineInput
              accessibilityLabel="Name"
              value={name}
              onChangeText={setName}
              autoCapitalize="words"
              autoComplete="name"
              textContentType="name"
            />
          </View>

          <View>
            <FieldLabel>Email address</FieldLabel>
            <OutlineInput
              accessibilityLabel="Email address"
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              autoComplete="email"
              autoCorrect={false}
              keyboardType="email-address"
              textContentType="emailAddress"
            />
          </View>

          <View>
            <FieldLabel>Confirm email address</FieldLabel>
            <OutlineInput
              accessibilityLabel="Confirm email address"
              value={confirmEmail}
              onChangeText={setConfirmEmail}
              autoCapitalize="none"
              autoComplete="email"
              autoCorrect={false}
              keyboardType="email-address"
              textContentType="emailAddress"
            />
          </View>

          <View>
            <FieldLabel>Password</FieldLabel>
            <OutlineInput
              accessibilityLabel="Password"
              value={password}
              onChangeText={setPassword}
              autoCapitalize="none"
              autoComplete="password-new"
              autoCorrect={false}
              secureTextEntry={!showPassword}
              textContentType="newPassword"
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
            <AppText style={styles.helper}>
              Minimum password length is 8 characters. Please use at least 1 uppercase letter, 1
              lowercase letter and 1 number.
            </AppText>
          </View>

          <View>
            <FieldLabel>Confirm password</FieldLabel>
            <OutlineInput
              accessibilityLabel="Confirm password"
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              autoCapitalize="none"
              autoComplete="password-new"
              autoCorrect={false}
              secureTextEntry={!showConfirm}
              textContentType="newPassword"
              trailing={
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={showConfirm ? 'Hide confirm password' : 'Show confirm password'}
                  hitSlop={8}
                  onPress={() => setShowConfirm((current) => !current)}
                >
                  <Ionicons name={showConfirm ? 'eye-off' : 'eye'} size={20} color="#FFFFFF" />
                </Pressable>
              }
            />
          </View>
        </ScrollView>

        <View style={[styles.dock, { paddingBottom: Math.max(insets.bottom, 12) + 8 }]}>
          <WelcomeCta label="Create Account" disabled={!ready} onPress={() => {}} />
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const FIELD_H = 50;

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
    paddingTop: 20,
    paddingBottom: 16,
    gap: 20,
  },
  label: {
    color: '#FFFFFF',
    fontSize: type.caption.fontSize,
    lineHeight: type.caption.lineHeight,
    fontWeight: '600',
    marginBottom: 8,
  },
  required: {
    color: palette.danger,
    fontSize: type.caption.fontSize,
    lineHeight: type.caption.lineHeight,
    fontWeight: '600',
  },
  field: {
    minHeight: FIELD_H,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.55)',
    borderRadius: radius.md,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  fieldInput: {
    flex: 1,
    height: FIELD_H,
    color: '#FFFFFF',
    fontSize: type.body.fontSize,
    lineHeight: type.body.lineHeight,
    padding: 0,
    ...Platform.select({ web: { outlineStyle: 'none', outlineWidth: 0 } as object, default: {} }),
  },
  helper: {
    color: 'rgba(255,255,255,0.62)',
    fontSize: type.micro.fontSize,
    lineHeight: type.micro.lineHeight,
    fontWeight: '400',
    marginTop: 8,
  },
  dock: {
    paddingHorizontal: 24,
    paddingTop: 8,
  },
});
