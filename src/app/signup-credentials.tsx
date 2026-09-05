import { Ionicons } from '@expo/vector-icons';
import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useLayoutEffect, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COUNTRIES } from '@/data/countries';
import { isValidSignupBirthday, MONTHS, signupBirthdayIso } from '@/domain/signupAccount';
import {
  confirmationSettled,
  emailAllowsSignup,
  emailsMatch,
  isValidSignupCredentials,
  passwordsMatch,
} from '@/domain/signupCredentials';
import { useAuth } from '@/state/AuthProvider';
import { useSetting } from '@/state/queries';
import {
  applySignupDraftFromRoute,
  clearSignupComplete,
  hydrateSignupDraftFromStorage,
  markSignupComplete,
  useSignupDraft,
} from '@/state/signupDraft';
import { useAccountAuth } from '@/state/useAccountAuth';
import { useEmailAvailability } from '@/state/useEmailAvailability';
import { AppText } from '@/ui/components';
import { fieldStyles, FieldLabel, OutlineInput } from '@/ui/DarkField';
import { WelcomeBackground } from '@/ui/WelcomeBackground';
import { WelcomeCta } from '@/ui/WelcomeCta';
import { fonts, palette, radius, type } from '@/ui/theme/tokens';

function LockedField({
  value,
  accessibilityLabel,
  centered,
}: {
  value: string;
  accessibilityLabel: string;
  centered?: boolean;
}) {
  return (
    <View
      accessible
      accessibilityRole="text"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled: true }}
      pointerEvents="none"
      style={[styles.fieldLocked, centered ? styles.fieldLockedCenter : null]}
    >
      <AppText
        style={[styles.fieldValue, centered ? styles.fieldLockedCenterValue : null]}
        numberOfLines={1}
      >
        {value}
      </AppText>
    </View>
  );
}

type OpenSelect = 'country' | null;

function SelectTrigger({
  value,
  open,
  onPress,
  accessibilityLabel,
}: {
  value: string;
  open: boolean;
  onPress: () => void;
  accessibilityLabel: string;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ expanded: open }}
      onPress={onPress}
      style={fieldStyles.field}
    >
      <AppText style={styles.fieldValue} numberOfLines={1}>
        {value}
      </AppText>
      <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={16} color="#FFFFFF" />
    </Pressable>
  );
}

function OptionList({
  options,
  selected,
  onSelect,
}: {
  options: readonly string[];
  selected: string;
  onSelect: (item: string) => void;
}) {
  return (
    <View style={styles.inlineMenu}>
      <ScrollView
        nestedScrollEnabled
        keyboardShouldPersistTaps="handled"
        style={styles.inlineMenuScroll}
      >
        {options.map((item) => {
          const isSelected = item === selected;
          return (
            <Pressable
              key={item}
              accessibilityRole="button"
              accessibilityState={{ selected: isSelected }}
              onPress={() => onSelect(item)}
              style={styles.inlineRow}
            >
              <AppText style={styles.inlineRowLabel}>{item}</AppText>
              {isSelected ? <Ionicons name="checkmark" size={18} color={palette.accent} /> : null}
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

/** Name, email, password, birthday, and country. Layout follows the supplied
 * create-account frame; type, accent and the CTA stay Macronaut. Create
 * Account creates the account on the Convex deployment — name, date of birth
 * and country included — signs in, and opens the Apple Health ask. */
export default function SignupCredentialsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { loading, signedIn } = useAuth();
  const onboarded = useSetting<boolean>('onboardingComplete', false, signedIn);
  const auth = useAccountAuth();
  const params = useLocalSearchParams<{
    month?: string;
    day?: string;
    year?: string;
    country?: string;
  }>();
  const routeMonth = Array.isArray(params.month) ? params.month[0] : params.month;
  const routeDay = Array.isArray(params.day) ? params.day[0] : params.day;
  const routeYear = Array.isArray(params.year) ? params.year[0] : params.year;
  const routeCountry = Array.isArray(params.country) ? params.country[0] : params.country;
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [confirmEmail, setConfirmEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  // A half-typed confirmation is not a mismatch yet; the notes wait for the
  // field to be left, or for it to be as long as what it is copying.
  const [confirmEmailTouched, setConfirmEmailTouched] = useState(false);
  const [confirmPasswordTouched, setConfirmPasswordTouched] = useState(false);
  const emailStatus = useEmailAvailability(email);
  const monthIndex = useSignupDraft((s) => s.monthIndex);
  const day = useSignupDraft((s) => s.day);
  const year = useSignupDraft((s) => s.year);
  const country = useSignupDraft((s) => s.country);
  const signupComplete = useSignupDraft((s) => s.signupComplete);
  const setCountry = useSignupDraft((s) => s.setCountry);
  const [openSelect, setOpenSelect] = useState<OpenSelect>(null);

  useLayoutEffect(() => {
    if (
      !applySignupDraftFromRoute({
        month: routeMonth,
        day: routeDay,
        year: routeYear,
        country: routeCountry,
      })
    ) {
      hydrateSignupDraftFromStorage();
    }
  }, [routeMonth, routeDay, routeYear, routeCountry]);

  if (loading || (signedIn && onboarded.isLoading)) return null;
  // A session that arrived from this screen is on its way to the Apple Health
  // ask; anyone else who is already signed in has no business here.
  if (signedIn && !signupComplete) return <Redirect href={onboarded.data ? '/' : '/onboarding'} />;

  const emailTaken = emailStatus === 'taken';
  const checkingEmail = emailStatus === 'checking';
  const emailMismatch =
    confirmationSettled(confirmEmail, email, confirmEmailTouched) &&
    !emailsMatch(email, confirmEmail);
  const emailConfirmed = confirmEmail.length > 0 && emailsMatch(email, confirmEmail);
  const passwordMismatch =
    confirmationSettled(confirmPassword, password, confirmPasswordTouched) &&
    !passwordsMatch(password, confirmPassword);
  const passwordConfirmed = passwordsMatch(password, confirmPassword);

  const ready =
    isValidSignupCredentials(name, email, confirmEmail, password, confirmPassword) &&
    isValidSignupBirthday(monthIndex, day, year) &&
    country.length > 0 &&
    emailAllowsSignup(emailStatus);

  const closeMenus = () => setOpenSelect(null);
  const toggle = (which: Exclude<OpenSelect, null>) => {
    setOpenSelect((current) => (current === which ? null : which));
  };

  async function createAccount() {
    if (!ready || auth.busy) return;
    setOpenSelect(null);
    // Set before the round trip: the new session lands mid-await, and the
    // guard above must not send it to onboarding on the way past.
    markSignupComplete();
    const created = await auth.createAccount({
      name,
      email,
      password,
      birthday: signupBirthdayIso(monthIndex, day, year),
      country,
    });
    if (!created) {
      clearSignupComplete();
      return;
    }
    router.replace('/signup-health');
  }

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
              onFocus={closeMenus}
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
              onFocus={closeMenus}
              invalid={emailTaken}
            />
            {emailTaken ? (
              <AppText
                accessibilityRole="alert"
                style={[fieldStyles.error, fieldStyles.fieldNote]}
              >
                An account already uses this email address. Sign in instead, or use another
                address.
              </AppText>
            ) : checkingEmail ? (
              <AppText style={fieldStyles.helper}>Checking this email address…</AppText>
            ) : null}
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
              onFocus={closeMenus}
              onBlur={() => setConfirmEmailTouched(true)}
              invalid={emailMismatch}
            />
            {emailMismatch ? (
              <AppText
                accessibilityRole="alert"
                style={[fieldStyles.error, fieldStyles.fieldNote]}
              >
                Email addresses do not match.
              </AppText>
            ) : emailConfirmed ? (
              <AppText style={[fieldStyles.ok, fieldStyles.fieldNote]}>
                Email addresses match.
              </AppText>
            ) : null}
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
              onFocus={closeMenus}
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
              onFocus={closeMenus}
              onBlur={() => setConfirmPasswordTouched(true)}
              invalid={passwordMismatch}
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
            {passwordMismatch ? (
              <AppText
                accessibilityRole="alert"
                style={[fieldStyles.error, fieldStyles.fieldNote]}
              >
                Passwords do not match.
              </AppText>
            ) : passwordConfirmed ? (
              <AppText style={[fieldStyles.ok, fieldStyles.fieldNote]}>Passwords match.</AppText>
            ) : null}
          </View>

          <View>
            <FieldLabel>Date of birth</FieldLabel>
            <View style={styles.birthdayRow}>
              <View style={styles.monthCol}>
                <FieldLabel>Month</FieldLabel>
                <LockedField value={MONTHS[monthIndex]} accessibilityLabel="Month" />
              </View>
              <View style={styles.dayCol}>
                <FieldLabel>Day</FieldLabel>
                <LockedField value={day} accessibilityLabel="Day" centered />
              </View>
              <View style={styles.yearCol}>
                <FieldLabel>Year</FieldLabel>
                <LockedField value={year} accessibilityLabel="Year" centered />
              </View>
            </View>
            <AppText style={fieldStyles.helper}>
              Date of birth helps us comply with global regulations and calculate certain metrics.
              Once set, it cannot be changed.
            </AppText>
          </View>

          <View>
            <FieldLabel>Country/Region</FieldLabel>
            <SelectTrigger
              value={country}
              open={openSelect === 'country'}
              accessibilityLabel="Country or region"
              onPress={() => toggle('country')}
            />
            {openSelect === 'country' ? (
              <OptionList
                options={COUNTRIES}
                selected={country}
                onSelect={(item) => {
                  setCountry(item);
                  setOpenSelect(null);
                }}
              />
            ) : null}
            <AppText style={fieldStyles.helper}>
              Country or region of residence helps us comply with global regulations and calculate
              certain metrics. Once set, it cannot be changed.
            </AppText>
          </View>
        </ScrollView>

        <View style={[styles.dock, { paddingBottom: Math.max(insets.bottom, 12) + 8 }]}>
          {auth.error ? (
            <AppText accessibilityRole="alert" style={fieldStyles.error}>
              {auth.error}
            </AppText>
          ) : null}
          <WelcomeCta
            label={auth.busy ? 'Creating account…' : 'Create Account'}
            accessibilityLabel="Create Account"
            disabled={!ready || auth.busy}
            onPress={() => void createAccount()}
          />
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
  fieldValue: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: type.body.fontSize,
    lineHeight: type.body.lineHeight,
    fontWeight: '400',
  },
  birthdayRow: {
    flexDirection: 'row',
    gap: 10,
  },
  monthCol: {
    flex: 1.35,
  },
  dayCol: {
    flex: 0.85,
  },
  yearCol: {
    flex: 1,
  },
  fieldLocked: {
    minHeight: FIELD_H,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.35)',
    borderRadius: radius.md,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    opacity: 0.72,
  },
  fieldLockedCenter: {
    height: FIELD_H,
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  fieldLockedCenterValue: {
    textAlign: 'center',
  },
  inlineMenu: {
    marginTop: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.55)',
    borderRadius: radius.md,
    backgroundColor: 'rgba(16,20,24,0.92)',
    overflow: 'hidden',
    maxHeight: 240,
  },
  inlineMenuScroll: {
    maxHeight: 240,
  },
  inlineRow: {
    minHeight: 48,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.12)',
  },
  inlineRowLabel: {
    color: '#FFFFFF',
    fontSize: type.body.fontSize,
    lineHeight: type.body.lineHeight,
  },
  dock: {
    paddingHorizontal: 24,
    paddingTop: 8,
    gap: 10,
  },
});
