import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Redirect, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useMemo, useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
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
import { useAuth } from '@/state/AuthProvider';
import { useSetting } from '@/state/queries';
import { AppText } from '@/ui/components';
import { WelcomeBackground } from '@/ui/WelcomeBackground';
import { WelcomeCta } from '@/ui/WelcomeCta';
import { fonts, palette, radius, type } from '@/ui/theme/tokens';

type Picker = 'month' | 'country' | null;

function FieldLabel({ children }: { children: string }) {
  return (
    <AppText style={styles.label}>
      {children}
      <AppText style={styles.required}> *</AppText>
    </AppText>
  );
}

function SelectField({
  value,
  onPress,
  accessibilityLabel,
}: {
  value: string;
  onPress: () => void;
  accessibilityLabel: string;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      style={styles.field}
    >
      <AppText style={styles.fieldValue} numberOfLines={1}>
        {value}
      </AppText>
      <Ionicons name="chevron-down" size={16} color="#FFFFFF" />
    </Pressable>
  );
}

/** Birthday + country after the legal gate. Layout follows the supplied
 * account-setup frame; type, accent and the CTA stay Macronaut. Continue
 * does not leave this page until the next screen is built. */
export default function SignupAccountScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { loading, signedIn } = useAuth();
  const onboarded = useSetting<boolean>('onboardingComplete', false, signedIn);
  const [monthIndex, setMonthIndex] = useState(0);
  const [day, setDay] = useState('');
  const [year, setYear] = useState('');
  const [country, setCountry] = useState<string>(COUNTRIES[0]);
  const [picker, setPicker] = useState<Picker>(null);
  const pickerItems = useMemo(() => (picker === 'month' ? [...MONTHS] : [...COUNTRIES]), [picker]);

  if (loading || (signedIn && onboarded.isLoading)) return null;
  if (signedIn) return <Redirect href={onboarded.data ? '/' : '/onboarding'} />;

  const ready = isValidSignupBirthday(monthIndex, day, year) && country.length > 0;
  const pickerTitle = picker === 'month' ? 'Month' : 'Country/Region';

  const goBack = () => {
    if (router.canGoBack()) router.back();
    else router.replace('/signup-legal');
  };

  return (
    <View style={styles.root}>
      <StatusBar style="light" />
      <WelcomeBackground />
      <View pointerEvents="none" style={styles.veil}>
        <View style={styles.veilFilm} />
        <LinearGradient
          colors={['rgba(0,0,0,0.42)', 'rgba(0,0,0,0.28)', 'rgba(0,0,0,0.72)']}
          locations={[0, 0.4, 1]}
          style={StyleSheet.absoluteFill}
        />
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
            Account Setup
          </AppText>
          <View style={styles.headerSide} />
        </View>

        <View style={styles.form}>
          <View style={styles.birthdayRow}>
            <View style={styles.monthCol}>
              <FieldLabel>Month</FieldLabel>
              <SelectField
                value={MONTHS[monthIndex]}
                accessibilityLabel="Month"
                onPress={() => setPicker('month')}
              />
            </View>
            <View style={styles.dayCol}>
              <FieldLabel>Day</FieldLabel>
              <TextInput
                accessibilityLabel="Day"
                value={day}
                onChangeText={(next) => setDay(next.replace(/\D/g, '').slice(0, 2))}
                placeholder="DD"
                placeholderTextColor="rgba(255,255,255,0.45)"
                keyboardType="number-pad"
                maxLength={2}
                style={styles.input}
              />
            </View>
            <View style={styles.yearCol}>
              <FieldLabel>Year</FieldLabel>
              <TextInput
                accessibilityLabel="Year"
                value={year}
                onChangeText={(next) => setYear(next.replace(/\D/g, '').slice(0, 4))}
                placeholder="YYYY"
                placeholderTextColor="rgba(255,255,255,0.45)"
                keyboardType="number-pad"
                maxLength={4}
                style={styles.input}
              />
            </View>
          </View>

          <View>
            <FieldLabel>Country/Region</FieldLabel>
            <SelectField
              value={country}
              accessibilityLabel="Country or region"
              onPress={() => setPicker('country')}
            />
          </View>

          <View style={styles.ctaWrap}>
            <WelcomeCta label="Continue" disabled={!ready} onPress={() => {}} />
          </View>
        </View>
      </KeyboardAvoidingView>

      <Modal
        visible={picker !== null}
        transparent
        animationType="slide"
        onRequestClose={() => setPicker(null)}
      >
        <View style={styles.sheetRoot}>
          <Pressable
            style={styles.sheetScrim}
            onPress={() => setPicker(null)}
            accessibilityRole="button"
            accessibilityLabel="Close"
          />
          <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 12) + 8 }]}>
            <AppText style={styles.sheetTitle}>{pickerTitle}</AppText>
            <ScrollView keyboardShouldPersistTaps="handled">
              {pickerItems.map((item) => {
                const selected =
                  picker === 'month' ? item === MONTHS[monthIndex] : item === country;
                return (
                  <Pressable
                    key={item}
                    accessibilityRole="button"
                    accessibilityState={{ selected }}
                    onPress={() => {
                      if (picker === 'month')
                        setMonthIndex(MONTHS.indexOf(item as (typeof MONTHS)[number]));
                      else setCountry(item);
                      setPicker(null);
                    }}
                    style={styles.sheetRow}
                  >
                    <AppText style={styles.sheetRowLabel}>{item}</AppText>
                    {selected ? (
                      <Ionicons name="checkmark" size={18} color={palette.accent} />
                    ) : null}
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
        </View>
      </Modal>
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
    backgroundColor: 'rgba(0,0,0,0.36)',
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
    gap: 20,
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
    height: FIELD_H,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.55)',
    borderRadius: radius.md,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  fieldValue: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: type.body.fontSize,
    lineHeight: type.body.lineHeight,
    fontWeight: '400',
  },
  input: {
    height: FIELD_H,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.55)',
    borderRadius: radius.md,
    color: '#FFFFFF',
    fontSize: type.body.fontSize,
    lineHeight: type.body.lineHeight,
    textAlign: 'center',
    paddingHorizontal: 8,
  },
  ctaWrap: {
    marginTop: 8,
  },
  sheetRoot: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  sheetScrim: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  sheet: {
    maxHeight: '70%',
    backgroundColor: '#171B20',
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    paddingTop: 16,
    paddingHorizontal: 20,
  },
  sheetTitle: {
    fontFamily: fonts.display,
    color: '#FFFFFF',
    fontSize: type.heading.fontSize,
    lineHeight: type.heading.lineHeight,
    fontWeight: '600',
    marginBottom: 8,
  },
  sheetRow: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.12)',
  },
  sheetRowLabel: {
    color: '#FFFFFF',
    fontSize: type.body.fontSize,
    lineHeight: type.body.lineHeight,
  },
});
