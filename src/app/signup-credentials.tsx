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
import { COUNTRIES } from '@/data/countries';
import { isValidSignupBirthday, MONTHS } from '@/domain/signupAccount';
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
  onFocus,
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
  onFocus?: () => void;
}) {
  return (
    <View style={styles.field}>
      <TextInput
        accessibilityLabel={accessibilityLabel}
        value={value}
        onChangeText={onChangeText}
        onFocus={onFocus}
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

type OpenSelect = 'month' | 'country' | null;

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
      style={styles.field}
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
 * Account opens the Apple Health ask. */
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
  const [monthIndex, setMonthIndex] = useState(0);
  const [day, setDay] = useState('');
  const [year, setYear] = useState('');
  const [country, setCountry] = useState<string>(COUNTRIES[0]);
  const [openSelect, setOpenSelect] = useState<OpenSelect>(null);

  if (loading || (signedIn && onboarded.isLoading)) return null;
  if (signedIn) return <Redirect href={onboarded.data ? '/' : '/onboarding'} />;

  const ready =
    isValidSignupCredentials(name, email, confirmEmail, password, confirmPassword) &&
    isValidSignupBirthday(monthIndex, day, year) &&
    country.length > 0;

  const closeMenus = () => setOpenSelect(null);
  const toggle = (which: Exclude<OpenSelect, null>) => {
    setOpenSelect((current) => (current === which ? null : which));
  };

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
              onFocus={closeMenus}
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
              onFocus={closeMenus}
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

          <View>
            <FieldLabel>Date of birth</FieldLabel>
            <View style={styles.birthdayRow}>
              <View style={styles.monthCol}>
                <FieldLabel>Month</FieldLabel>
                <SelectTrigger
                  value={MONTHS[monthIndex]}
                  open={openSelect === 'month'}
                  accessibilityLabel="Month"
                  onPress={() => toggle('month')}
                />
              </View>
              <View style={styles.dayCol}>
                <FieldLabel>Day</FieldLabel>
                <TextInput
                  accessibilityLabel="Day"
                  value={day}
                  onChangeText={(next) => setDay(next.replace(/\D/g, '').slice(0, 2))}
                  onFocus={closeMenus}
                  placeholder="DD"
                  placeholderTextColor="rgba(255,255,255,0.45)"
                  keyboardType="number-pad"
                  maxLength={2}
                  style={styles.dateInput}
                />
              </View>
              <View style={styles.yearCol}>
                <FieldLabel>Year</FieldLabel>
                <TextInput
                  accessibilityLabel="Year"
                  value={year}
                  onChangeText={(next) => setYear(next.replace(/\D/g, '').slice(0, 4))}
                  onFocus={closeMenus}
                  placeholder="YYYY"
                  placeholderTextColor="rgba(255,255,255,0.45)"
                  keyboardType="number-pad"
                  maxLength={4}
                  style={styles.dateInput}
                />
              </View>
            </View>
            {openSelect === 'month' ? (
              <OptionList
                options={MONTHS}
                selected={MONTHS[monthIndex]}
                onSelect={(item) => {
                  setMonthIndex(MONTHS.indexOf(item as (typeof MONTHS)[number]));
                  setOpenSelect(null);
                }}
              />
            ) : null}
            <AppText style={styles.helper}>
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
            <AppText style={styles.helper}>
              Country or region of residence helps us comply with global regulations and calculate
              certain metrics. Once set, it cannot be changed.
            </AppText>
          </View>
        </ScrollView>

        <View style={[styles.dock, { paddingBottom: Math.max(insets.bottom, 12) + 8 }]}>
          <WelcomeCta label="Create Account" disabled={!ready} href="/signup-health" />
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
    backgroundColor: 'transparent',
    ...Platform.select({ web: { outlineStyle: 'none', outlineWidth: 0 } as object, default: {} }),
  },
  helper: {
    color: 'rgba(255,255,255,0.62)',
    fontSize: type.micro.fontSize,
    lineHeight: type.micro.lineHeight,
    fontWeight: '400',
    marginTop: 8,
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
  dateInput: {
    height: FIELD_H,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.55)',
    borderRadius: radius.md,
    color: '#FFFFFF',
    fontSize: type.body.fontSize,
    lineHeight: type.body.lineHeight,
    textAlign: 'center',
    paddingHorizontal: 8,
    backgroundColor: 'transparent',
    ...Platform.select({ web: { outlineStyle: 'none', outlineWidth: 0 } as object, default: {} }),
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
  },
});
