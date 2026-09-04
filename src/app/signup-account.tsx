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
import { useAuth } from '@/state/AuthProvider';
import { useSetting } from '@/state/queries';
import { saveSignupDraftValues, useSignupDraft } from '@/state/signupDraft';
import { AppText } from '@/ui/components';
import { WelcomeBackground } from '@/ui/WelcomeBackground';
import { WelcomeCta } from '@/ui/WelcomeCta';
import { fonts, palette, radius, type } from '@/ui/theme/tokens';

type OpenSelect = 'month' | 'country' | null;

function FieldLabel({ children }: { children: string }) {
  return (
    <AppText style={styles.label}>
      {children}
      <AppText style={styles.required}> *</AppText>
    </AppText>
  );
}

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

/** Birthday + country after the legal gate. Month and country expand in the
 * page instead of a slide-up overlay. Continue opens credentials. */
export default function SignupAccountScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { loading, signedIn } = useAuth();
  const onboarded = useSetting<boolean>('onboardingComplete', false, signedIn);
  const initial = useSignupDraft.getState();
  const [monthIndex, setMonthIndex] = useState(initial.monthIndex);
  const [day, setDay] = useState(initial.day);
  const [year, setYear] = useState(initial.year);
  const [country, setCountry] = useState(initial.country);
  const [openSelect, setOpenSelect] = useState<OpenSelect>(null);

  if (loading || (signedIn && onboarded.isLoading)) return null;
  if (signedIn) return <Redirect href={onboarded.data ? '/' : '/onboarding'} />;

  const ready = isValidSignupBirthday(monthIndex, day, year) && country.length > 0;

  const goBack = () => {
    if (router.canGoBack()) router.back();
    else router.replace('/signup-legal');
  };

  const toggle = (which: Exclude<OpenSelect, null>) => {
    setOpenSelect((current) => (current === which ? null : which));
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
            Account Setup
          </AppText>
          <View style={styles.headerSide} />
        </View>

        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.form}
        >
          <View>
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
                  onFocus={() => setOpenSelect(null)}
                  placeholder="DD"
                  placeholderTextColor="rgba(255,255,255,0.45)"
                  keyboardType="number-pad"
                  maxLength={2}
                  autoComplete="off"
                  textContentType="none"
                  {...(Platform.OS === 'web' ? ({ className: 'macronaut-dark-field' } as object) : {})}
                  style={styles.input}
                />
              </View>
              <View style={styles.yearCol}>
                <FieldLabel>Year</FieldLabel>
                <TextInput
                  accessibilityLabel="Year"
                  value={year}
                  onChangeText={(next) => setYear(next.replace(/\D/g, '').slice(0, 4))}
                  onFocus={() => setOpenSelect(null)}
                  placeholder="YYYY"
                  placeholderTextColor="rgba(255,255,255,0.45)"
                  keyboardType="number-pad"
                  maxLength={4}
                  autoComplete="off"
                  textContentType="none"
                  {...(Platform.OS === 'web' ? ({ className: 'macronaut-dark-field' } as object) : {})}
                  style={styles.input}
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
          </View>

          <View style={styles.ctaWrap}>
            <WelcomeCta
              label="Continue"
              disabled={!ready}
              onPress={() => saveSignupDraftValues({ monthIndex, day, year, country })}
              href={{
                pathname: '/signup-credentials',
                params: {
                  month: String(monthIndex),
                  day,
                  year,
                  country,
                },
              }}
            />
          </View>
        </ScrollView>
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
    paddingTop: 28,
    paddingBottom: 32,
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
    backgroundColor: 'transparent',
    ...Platform.select({
      web: {
        outlineStyle: 'none',
        outlineWidth: 0,
        WebkitTextFillColor: '#FFFFFF',
        caretColor: '#FFFFFF',
      } as object,
      default: {},
    }),
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
  ctaWrap: {
    marginTop: 8,
  },
});
