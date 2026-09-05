import { Ionicons } from '@expo/vector-icons';
import { Redirect, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useCallback, useMemo, useState } from 'react';
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
import { useQueryClient } from '@tanstack/react-query';
import { recommendTargets } from '@/domain/recommend';
import { ageFromBirthdayIso } from '@/domain/signupAccount';
import {
  ActivityLevel,
  BiologicalSex,
  GoalType,
  NutrientTargets,
  UnitSystem,
} from '@/domain/types';
import { useRepos } from '@/state/AppProvider';
import { useAuth } from '@/state/AuthProvider';
import { clearSignupComplete } from '@/state/signupDraft';
import { AppText } from '@/ui/components';
import { DARK_FIELD } from '@/ui/DarkField';
import { WelcomeBackground } from '@/ui/WelcomeBackground';
import { WelcomeCta } from '@/ui/WelcomeCta';
import { fonts, palette, radius, type } from '@/ui/theme/tokens';
import { todayKey } from '@/utils/date';

type Step = 'about' | 'goal' | 'activity' | 'review';
type IconName = React.ComponentProps<typeof Ionicons>['name'];

const STEPS: Step[] = ['about', 'goal', 'activity', 'review'];

const GOAL_OPTIONS: {
  value: GoalType;
  label: string;
  detail: string;
  icon: IconName;
}[] = [
  {
    value: 'lose',
    label: 'Lose weight',
    detail: 'A measured deficit with protein to help preserve muscle.',
    icon: 'trending-down',
  },
  {
    value: 'maintain',
    label: 'Maintain weight',
    detail: 'Balanced targets designed to keep you steady.',
    icon: 'remove',
  },
  {
    value: 'gain',
    label: 'Gain weight',
    detail: 'A controlled surplus for gradual, consistent progress.',
    icon: 'trending-up',
  },
  {
    value: 'muscle',
    label: 'Build muscle',
    detail: 'A lean surplus with extra emphasis on protein.',
    icon: 'barbell-outline',
  },
];

const ACTIVITY_OPTIONS: {
  value: ActivityLevel;
  label: string;
  detail: string;
  icon: IconName;
}[] = [
  {
    value: 'sedentary',
    label: 'Mostly seated',
    detail: 'Desk-based days with little structured exercise.',
    icon: 'desktop-outline',
  },
  {
    value: 'light',
    label: 'Lightly active',
    detail: 'Light exercise or movement 1–3 days each week.',
    icon: 'walk-outline',
  },
  {
    value: 'moderate',
    label: 'Moderately active',
    detail: 'Intentional training or exercise 3–5 days each week.',
    icon: 'bicycle-outline',
  },
  {
    value: 'very',
    label: 'Very active',
    detail: 'Hard training or exercise on most days.',
    icon: 'fitness-outline',
  },
  {
    value: 'extra',
    label: 'Extremely active',
    detail: 'Demanding daily training or a physical occupation.',
    icon: 'flame-outline',
  },
];

const KG_PER_LB = 0.45359237;
const CM_PER_IN = 2.54;

function round(value: number, places = 1): number {
  const power = 10 ** places;
  return Math.round(value * power) / power;
}

function PremiumNumberField({
  label,
  value,
  onChange,
  unit,
  min = 0,
  max,
  integer = false,
  required = false,
}: {
  label: string;
  value: number | undefined;
  onChange: (value: number | undefined) => void;
  unit?: string;
  min?: number;
  max?: number;
  integer?: boolean;
  required?: boolean;
}) {
  const [text, setText] = useState(value === undefined ? '' : String(value));
  const [error, setError] = useState<string | undefined>();
  const [lastValue, setLastValue] = useState(value);

  if (value !== lastValue) {
    setLastValue(value);
    const parsed = text === '' ? undefined : Number(text);
    if (parsed !== value) setText(value === undefined ? '' : String(value));
  }

  const handleChange = useCallback(
    (next: string) => {
      const normalized = next.replace(',', '.');
      setText(normalized);
      if (normalized.trim() === '') {
        setError(required ? 'Required' : undefined);
        onChange(undefined);
        return;
      }

      const number = Number(normalized);
      if (Number.isNaN(number)) {
        setError('Enter a number');
      } else if (integer && !Number.isInteger(number)) {
        setError('Use a whole number');
      } else if (number < min) {
        setError(`Minimum ${min}`);
      } else if (max !== undefined && number > max) {
        setError(`Maximum ${max}`);
      } else {
        setError(undefined);
        onChange(number);
      }
    },
    [integer, max, min, onChange, required],
  );

  return (
    <View style={styles.fieldBlock}>
      <AppText style={styles.fieldLabel}>
        {label}
        {required ? <AppText style={styles.required}> *</AppText> : null}
      </AppText>
      <View style={[styles.field, error ? styles.fieldError : null]} {...DARK_FIELD}>
        <TextInput
          accessibilityLabel={label}
          value={text}
          onChangeText={handleChange}
          placeholder="—"
          placeholderTextColor="rgba(255,255,255,0.36)"
          keyboardType="decimal-pad"
          inputMode="decimal"
          {...DARK_FIELD}
          style={styles.fieldInput}
        />
        {unit ? <AppText style={styles.fieldUnit}>{unit}</AppText> : null}
      </View>
      {error ? (
        <AppText accessibilityLiveRegion="polite" style={styles.fieldErrorText}>
          {error}
        </AppText>
      ) : null}
    </View>
  );
}

function Segmented<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label?: string;
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <View style={styles.fieldBlock}>
      {label ? <AppText style={styles.fieldLabel}>{label}</AppText> : null}
      <View style={styles.segmented}>
        {options.map((option) => {
          const selected = option.value === value;
          return (
            <Pressable
              key={option.value}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              onPress={() => onChange(option.value)}
              style={({ pressed }) => [
                styles.segment,
                selected ? styles.segmentSelected : null,
                pressed ? styles.pressed : null,
              ]}
            >
              <AppText style={[styles.segmentLabel, selected ? styles.segmentLabelSelected : null]}>
                {option.label}
              </AppText>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

function OptionCard({
  selected,
  onPress,
  label,
  detail,
  icon,
}: {
  selected: boolean;
  onPress: () => void;
  label: string;
  detail: string;
  icon: IconName;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={detail}
      accessibilityState={{ selected }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.option,
        selected ? styles.optionSelected : null,
        pressed ? styles.pressed : null,
      ]}
    >
      <View style={[styles.optionIcon, selected ? styles.optionIconSelected : null]}>
        <Ionicons name={icon} size={20} color={selected ? '#07140F' : '#FFFFFF'} />
      </View>
      <View style={styles.optionCopy}>
        <AppText style={styles.optionLabel}>{label}</AppText>
        <AppText style={styles.optionDetail}>{detail}</AppText>
      </View>
      <View style={[styles.radio, selected ? styles.radioSelected : null]}>
        {selected ? <View style={styles.radioDot} /> : null}
      </View>
    </Pressable>
  );
}

function SecondaryAction({
  label,
  onPress,
  disabled = false,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [styles.secondaryAction, pressed ? styles.pressed : null]}
    >
      <AppText style={styles.secondaryLabel}>{label}</AppText>
    </Pressable>
  );
}

function Intro({ eyebrow, title, copy }: { eyebrow: string; title: string; copy: string }) {
  return (
    <View style={styles.intro}>
      <AppText style={styles.eyebrow}>{eyebrow}</AppText>
      <AppText accessibilityRole="header" style={styles.title}>
        {title}
      </AppText>
      <AppText style={styles.subtitle}>{copy}</AppText>
    </View>
  );
}

export default function Onboarding() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { settings, goals } = useRepos();
  const qc = useQueryClient();
  const { loading: authLoading, signedIn, user } = useAuth();

  const [step, setStep] = useState<Step>('about');
  const [units, setUnits] = useState<UnitSystem>('us');
  const accountAge = ageFromBirthdayIso(user?.birthday);
  const [fallbackAge, setFallbackAge] = useState<number | undefined>();
  const age = accountAge ?? fallbackAge;
  const [sex, setSex] = useState<BiologicalSex>('male');
  const [heightFt, setHeightFt] = useState<number | undefined>(5);
  const [heightIn, setHeightIn] = useState<number | undefined>(9);
  const [heightCm, setHeightCm] = useState<number | undefined>();
  const [weightLb, setWeightLb] = useState<number | undefined>();
  const [weightKg, setWeightKg] = useState<number | undefined>();
  const [goalWeightLb, setGoalWeightLb] = useState<number | undefined>();
  const [goalWeightKg, setGoalWeightKg] = useState<number | undefined>();
  const [goalType, setGoalType] = useState<GoalType>('maintain');
  const [weeklyRate, setWeeklyRate] = useState<number | undefined>(1);
  const [activity, setActivity] = useState<ActivityLevel>('moderate');
  const [targets, setTargets] = useState<NutrientTargets | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const metrics = useMemo(() => {
    const height =
      units === 'metric'
        ? heightCm
        : heightFt !== undefined
          ? heightFt * 12 * CM_PER_IN + (heightIn ?? 0) * CM_PER_IN
          : undefined;
    const weight = units === 'metric' ? weightKg : weightLb ? weightLb * KG_PER_LB : undefined;
    const goalWeight =
      units === 'metric' ? goalWeightKg : goalWeightLb ? goalWeightLb * KG_PER_LB : undefined;
    return { height, weight, goalWeight };
  }, [units, heightCm, heightFt, heightIn, weightKg, weightLb, goalWeightKg, goalWeightLb]);

  const canRecommend =
    age !== undefined && metrics.height !== undefined && metrics.weight !== undefined;
  const weeklyRateKg =
    (weeklyRate ?? (units === 'metric' ? 0.5 : 1)) * (units === 'metric' ? 1 : KG_PER_LB);

  const recommendation = useMemo(() => {
    if (!canRecommend) return null;
    const signedRate =
      goalType === 'lose' ? -weeklyRateKg : goalType === 'maintain' ? 0 : weeklyRateKg;
    return recommendTargets({
      age: age!,
      sex,
      height: metrics.height!,
      weight: metrics.weight!,
      goalWeight: metrics.goalWeight,
      activity,
      goalType,
      weeklyRateKg: signedRate,
    });
  }, [canRecommend, age, sex, metrics, activity, goalType, weeklyRateKg]);

  if (authLoading) return null;
  if (!signedIn) return <Redirect href="/login" />;

  const stepIndex = STEPS.indexOf(step);

  function changeUnits(next: UnitSystem) {
    if (next === units) return;
    if (next === 'metric') {
      if (heightFt !== undefined) {
        setHeightCm(round((heightFt * 12 + (heightIn ?? 0)) * CM_PER_IN));
      }
      if (weightLb !== undefined) setWeightKg(round(weightLb * KG_PER_LB));
      if (goalWeightLb !== undefined) setGoalWeightKg(round(goalWeightLb * KG_PER_LB));
      if (weeklyRate !== undefined) setWeeklyRate(round(weeklyRate * KG_PER_LB));
    } else {
      if (heightCm !== undefined) {
        const totalInches = heightCm / CM_PER_IN;
        const feet = Math.floor(totalInches / 12);
        setHeightFt(feet);
        setHeightIn(round(totalInches - feet * 12));
      }
      if (weightKg !== undefined) setWeightLb(round(weightKg / KG_PER_LB));
      if (goalWeightKg !== undefined) setGoalWeightLb(round(goalWeightKg / KG_PER_LB));
      if (weeklyRate !== undefined) setWeeklyRate(round(weeklyRate / KG_PER_LB));
    }
    setUnits(next);
  }

  function goTo(next: Step) {
    setSaveError(null);
    setStep(next);
  }

  async function complete(finalTargets: NutrientTargets) {
    if (saving) return;
    setSaving(true);
    setSaveError(null);
    try {
      await settings.setUnitSystem(units);
      await settings.setProfile({
        age,
        sex,
        heightCm: metrics.height,
        weightKg: metrics.weight,
        goalWeightKg: metrics.goalWeight,
        activity,
        goalType,
        weeklyRateKg:
          goalType === 'lose' ? -weeklyRateKg : goalType === 'maintain' ? 0 : weeklyRateKg,
      });
      await goals.saveConfig({
        effectiveFrom: todayKey(),
        mode: 'same-daily',
        baseTarget: finalTargets,
        weeklyMode: 'sum-daily',
      });
      await settings.setOnboardingComplete(true);
      clearSignupComplete();
      qc.clear();
      router.replace('/');
    } catch {
      setSaveError("We couldn't save your targets. Check your connection and try again.");
    } finally {
      setSaving(false);
    }
  }

  function skip() {
    void complete({
      calories: 2000,
      protein: 120,
      carbs: 220,
      fat: 65,
      fiber: 30,
      sugar: 50,
      sodium: 2300,
      cholesterol: 300,
    });
  }

  function showRecommendation() {
    if (!recommendation) return;
    setTargets(recommendation.targets);
    goTo('review');
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
        <View style={[styles.headerWrap, { paddingTop: insets.top + 4 }]}>
          <View style={styles.header}>
            {stepIndex > 0 ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Back"
                hitSlop={8}
                onPress={() => goTo(STEPS[stepIndex - 1])}
                style={styles.headerSide}
              >
                <Ionicons name="chevron-back" size={28} color="#FFFFFF" />
              </Pressable>
            ) : (
              <View style={styles.headerSide} />
            )}
            <AppText style={styles.headerTitle}>Personalize</AppText>
            <AppText style={styles.stepCount}>
              {stepIndex + 1}/{STEPS.length}
            </AppText>
          </View>
          <View
            accessibilityLabel={`Step ${stepIndex + 1} of ${STEPS.length}`}
            style={styles.progress}
          >
            {STEPS.map((item, index) => (
              <View
                key={item}
                style={[
                  styles.progressSegment,
                  index <= stepIndex ? styles.progressSegmentActive : null,
                ]}
              />
            ))}
          </View>
        </View>

        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={[
            styles.content,
            { paddingBottom: Math.max(insets.bottom, 12) + 24 },
          ]}
        >
          {step === 'about' ? (
            <>
              <Intro
                eyebrow="BUILT AROUND YOU"
                title="Let’s shape your daily targets."
                copy="Your account basics are already here. Add only what changes the recommendation."
              />

              <View style={styles.accountNote}>
                <Ionicons name="lock-closed-outline" size={17} color={palette.accentDark} />
                <AppText style={styles.accountNoteText}>
                  {accountAge === undefined
                    ? 'Your name and region stay linked to your account—no need to enter them again.'
                    : 'Your name, birthday, and region stay linked to your account—no need to enter them again.'}
                </AppText>
              </View>

              <View style={styles.panel}>
                <Segmented
                  options={[
                    { value: 'us', label: 'US units' },
                    { value: 'metric', label: 'Metric' },
                  ]}
                  value={units}
                  onChange={changeUnits}
                />

                {accountAge === undefined ? (
                  <PremiumNumberField
                    label="Age"
                    value={fallbackAge}
                    onChange={setFallbackAge}
                    unit="years"
                    min={13}
                    max={120}
                    integer
                    required
                  />
                ) : null}

                <Segmented
                  label="Biological sex"
                  options={[
                    { value: 'male', label: 'Male' },
                    { value: 'female', label: 'Female' },
                  ]}
                  value={sex}
                  onChange={setSex}
                />
                <AppText style={styles.helper}>Used only for the calorie formula.</AppText>

                {units === 'us' ? (
                  <View style={styles.fieldRow}>
                    <View style={styles.fieldColumn}>
                      <PremiumNumberField
                        label="Height"
                        value={heightFt}
                        onChange={setHeightFt}
                        unit="ft"
                        min={3}
                        max={8}
                        integer
                        required
                      />
                    </View>
                    <View style={styles.fieldColumn}>
                      <PremiumNumberField
                        label="Inches"
                        value={heightIn}
                        onChange={setHeightIn}
                        unit="in"
                        min={0}
                        max={11}
                        required
                      />
                    </View>
                  </View>
                ) : (
                  <PremiumNumberField
                    label="Height"
                    value={heightCm}
                    onChange={setHeightCm}
                    unit="cm"
                    min={90}
                    max={250}
                    required
                  />
                )}

                {units === 'us' ? (
                  <PremiumNumberField
                    label="Current weight"
                    value={weightLb}
                    onChange={setWeightLb}
                    unit="lb"
                    min={50}
                    max={1000}
                    required
                  />
                ) : (
                  <PremiumNumberField
                    label="Current weight"
                    value={weightKg}
                    onChange={setWeightKg}
                    unit="kg"
                    min={25}
                    max={450}
                    required
                  />
                )}
              </View>

              {saveError ? <AppText style={styles.saveError}>{saveError}</AppText> : null}
              <View style={styles.actions}>
                <WelcomeCta
                  label="Continue"
                  onPress={() => goTo('goal')}
                  disabled={!canRecommend || saving}
                />
                <SecondaryAction
                  label={saving ? 'Saving…' : 'I’ll set my own targets'}
                  onPress={skip}
                  disabled={saving}
                />
              </View>
            </>
          ) : null}

          {step === 'goal' ? (
            <>
              <Intro
                eyebrow="YOUR DIRECTION"
                title="What are you working toward?"
                copy="Choose the outcome that best matches this season. You can adjust it at any time."
              />
              <View style={styles.optionStack}>
                {GOAL_OPTIONS.map((option) => (
                  <OptionCard
                    key={option.value}
                    selected={goalType === option.value}
                    onPress={() => setGoalType(option.value)}
                    label={option.label}
                    detail={option.detail}
                    icon={option.icon}
                  />
                ))}
              </View>

              {goalType !== 'maintain' ? (
                <View style={styles.panel}>
                  {units === 'us' ? (
                    <PremiumNumberField
                      label="Goal weight (optional)"
                      value={goalWeightLb}
                      onChange={setGoalWeightLb}
                      unit="lb"
                    />
                  ) : (
                    <PremiumNumberField
                      label="Goal weight (optional)"
                      value={goalWeightKg}
                      onChange={setGoalWeightKg}
                      unit="kg"
                    />
                  )}
                  <PremiumNumberField
                    label={`Weekly ${goalType === 'lose' ? 'loss' : 'gain'} rate`}
                    value={weeklyRate}
                    onChange={setWeeklyRate}
                    unit={units === 'us' ? 'lb/week' : 'kg/week'}
                    min={0.1}
                    max={units === 'us' ? 2 : 0.9}
                    required
                  />
                </View>
              ) : null}

              <View style={styles.actions}>
                <WelcomeCta label="Continue" onPress={() => goTo('activity')} />
                <SecondaryAction label="Back" onPress={() => goTo('about')} />
              </View>
            </>
          ) : null}

          {step === 'activity' ? (
            <>
              <Intro
                eyebrow="YOUR RHYTHM"
                title="How active is a typical week?"
                copy="Think about your usual routine—not your busiest week or your quietest one."
              />
              <View style={styles.optionStack}>
                {ACTIVITY_OPTIONS.map((option) => (
                  <OptionCard
                    key={option.value}
                    selected={activity === option.value}
                    onPress={() => setActivity(option.value)}
                    label={option.label}
                    detail={option.detail}
                    icon={option.icon}
                  />
                ))}
              </View>
              <View style={styles.actions}>
                <WelcomeCta label="See my targets" onPress={showRecommendation} />
                <SecondaryAction label="Back" onPress={() => goTo('goal')} />
              </View>
            </>
          ) : null}

          {step === 'review' && targets ? (
            <>
              <Intro
                eyebrow="YOUR STARTING POINT"
                title="Targets made for your routine."
                copy="Use these as a flexible baseline. Every number remains editable now and later."
              />

              <View style={styles.recommendationCard}>
                <View style={styles.recommendationIcon}>
                  <Ionicons name="sparkles" size={20} color="#07140F" />
                </View>
                <View style={styles.recommendationCopy}>
                  <AppText style={styles.recommendationTitle}>Personalized baseline</AppText>
                  <AppText style={styles.recommendationDetail}>
                    Estimated maintenance is about {recommendation?.tdee} kcal/day, using the
                    Mifflin–St Jeor formula.
                  </AppText>
                </View>
              </View>

              <View style={styles.targetHero}>
                <AppText style={styles.targetHeroValue}>{targets.calories}</AppText>
                <AppText style={styles.targetHeroUnit}>daily calories</AppText>
                <View style={styles.macroStrip}>
                  <View style={styles.macroItem}>
                    <AppText style={styles.macroValue}>{targets.protein ?? '—'}g</AppText>
                    <AppText style={styles.macroLabel}>Protein</AppText>
                  </View>
                  <View style={styles.macroDivider} />
                  <View style={styles.macroItem}>
                    <AppText style={styles.macroValue}>{targets.carbs ?? '—'}g</AppText>
                    <AppText style={styles.macroLabel}>Carbs</AppText>
                  </View>
                  <View style={styles.macroDivider} />
                  <View style={styles.macroItem}>
                    <AppText style={styles.macroValue}>{targets.fat ?? '—'}g</AppText>
                    <AppText style={styles.macroLabel}>Fat</AppText>
                  </View>
                </View>
              </View>

              <View style={styles.panel}>
                <AppText style={styles.panelTitle}>Fine-tune your targets</AppText>
                <PremiumNumberField
                  label="Calories"
                  value={targets.calories}
                  onChange={(value) => setTargets({ ...targets, calories: value ?? 0 })}
                  unit="kcal"
                  required
                />
                <View style={styles.fieldRow}>
                  <View style={styles.fieldColumn}>
                    <PremiumNumberField
                      label="Protein"
                      value={targets.protein}
                      onChange={(value) => setTargets({ ...targets, protein: value })}
                      unit="g"
                    />
                  </View>
                  <View style={styles.fieldColumn}>
                    <PremiumNumberField
                      label="Carbs"
                      value={targets.carbs}
                      onChange={(value) => setTargets({ ...targets, carbs: value })}
                      unit="g"
                    />
                  </View>
                </View>
                <View style={styles.fieldRow}>
                  <View style={styles.fieldColumn}>
                    <PremiumNumberField
                      label="Fat"
                      value={targets.fat}
                      onChange={(value) => setTargets({ ...targets, fat: value })}
                      unit="g"
                    />
                  </View>
                  <View style={styles.fieldColumn}>
                    <PremiumNumberField
                      label="Fiber"
                      value={targets.fiber}
                      onChange={(value) => setTargets({ ...targets, fiber: value })}
                      unit="g"
                    />
                  </View>
                </View>
                <AppText style={styles.optionalLabel}>OPTIONAL DETAILS</AppText>
                <View style={styles.fieldRow}>
                  <View style={styles.fieldColumn}>
                    <PremiumNumberField
                      label="Sugar"
                      value={targets.sugar}
                      onChange={(value) => setTargets({ ...targets, sugar: value })}
                      unit="g"
                    />
                  </View>
                  <View style={styles.fieldColumn}>
                    <PremiumNumberField
                      label="Sodium"
                      value={targets.sodium}
                      onChange={(value) => setTargets({ ...targets, sodium: value })}
                      unit="mg"
                    />
                  </View>
                </View>
                <PremiumNumberField
                  label="Cholesterol"
                  value={targets.cholesterol}
                  onChange={(value) => setTargets({ ...targets, cholesterol: value })}
                  unit="mg"
                />
              </View>

              {saveError ? <AppText style={styles.saveError}>{saveError}</AppText> : null}
              <View style={styles.actions}>
                <WelcomeCta
                  label={saving ? 'Saving…' : 'Save and start tracking'}
                  onPress={() => void complete(targets)}
                  disabled={saving || targets.calories <= 0}
                />
                <SecondaryAction label="Back" onPress={() => goTo('activity')} disabled={saving} />
              </View>
            </>
          ) : null}
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
    backgroundColor: 'rgba(0,0,0,0.68)',
  },
  frame: {
    flex: 1,
    zIndex: 1,
  },
  headerWrap: {
    width: '100%',
    maxWidth: 560,
    alignSelf: 'center',
    paddingHorizontal: 20,
    gap: 8,
  },
  header: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerSide: {
    width: 52,
    height: 44,
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  headerTitle: {
    flex: 1,
    color: '#FFFFFF',
    fontFamily: fonts.display,
    fontSize: type.heading.fontSize,
    lineHeight: type.heading.lineHeight,
    fontWeight: '600',
    textAlign: 'center',
  },
  stepCount: {
    width: 52,
    color: 'rgba(255,255,255,0.68)',
    fontFamily: fonts.displayMedium,
    fontSize: type.caption.fontSize,
    lineHeight: type.caption.lineHeight,
    textAlign: 'right',
  },
  progress: {
    flexDirection: 'row',
    gap: 6,
  },
  progressSegment: {
    flex: 1,
    height: 3,
    borderRadius: radius.full,
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
  progressSegmentActive: {
    backgroundColor: palette.accentDark,
  },
  content: {
    width: '100%',
    maxWidth: 560,
    alignSelf: 'center',
    paddingHorizontal: 24,
    paddingTop: 34,
    gap: 22,
  },
  intro: {
    gap: 8,
  },
  eyebrow: {
    color: palette.accentDark,
    fontFamily: fonts.display,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '700',
    letterSpacing: 1.8,
  },
  title: {
    color: '#FFFFFF',
    fontFamily: fonts.display,
    fontSize: 30,
    lineHeight: 36,
    fontWeight: '600',
    letterSpacing: -0.4,
  },
  subtitle: {
    color: 'rgba(255,255,255,0.72)',
    fontSize: type.body.fontSize,
    lineHeight: 22,
    fontWeight: '400',
  },
  accountNote: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    borderWidth: 1,
    borderColor: 'rgba(31,201,139,0.34)',
    borderRadius: radius.lg,
    backgroundColor: 'rgba(13,58,43,0.46)',
    padding: 14,
  },
  accountNoteText: {
    flex: 1,
    color: 'rgba(255,255,255,0.78)',
    fontSize: type.caption.fontSize,
    lineHeight: 19,
  },
  panel: {
    gap: 18,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.16)',
    borderRadius: radius.xl,
    backgroundColor: 'rgba(9,13,16,0.76)',
    padding: 18,
  },
  panelTitle: {
    color: '#FFFFFF',
    fontFamily: fonts.display,
    fontSize: type.heading.fontSize,
    lineHeight: type.heading.lineHeight,
    fontWeight: '600',
  },
  fieldBlock: {
    gap: 7,
  },
  fieldLabel: {
    color: 'rgba(255,255,255,0.84)',
    fontSize: type.caption.fontSize,
    lineHeight: type.caption.lineHeight,
    fontWeight: '600',
  },
  required: {
    color: palette.accentDark,
  },
  field: {
    minHeight: 50,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.42)',
    borderRadius: radius.md,
    backgroundColor: 'rgba(255,255,255,0.04)',
    paddingHorizontal: 13,
  },
  fieldError: {
    borderColor: '#F07B7B',
  },
  fieldInput: {
    flex: 1,
    minWidth: 0,
    height: 50,
    color: '#FFFFFF',
    fontSize: type.body.fontSize,
    lineHeight: type.body.lineHeight,
    padding: 0,
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
  fieldUnit: {
    color: 'rgba(255,255,255,0.54)',
    fontSize: type.caption.fontSize,
    lineHeight: type.caption.lineHeight,
  },
  fieldErrorText: {
    color: '#F07B7B',
    fontSize: type.micro.fontSize,
    lineHeight: type.micro.lineHeight,
    fontWeight: '600',
  },
  fieldRow: {
    flexDirection: 'row',
    gap: 12,
  },
  fieldColumn: {
    flex: 1,
    minWidth: 0,
  },
  segmented: {
    minHeight: 50,
    flexDirection: 'row',
    gap: 4,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.20)',
    borderRadius: radius.md,
    backgroundColor: 'rgba(255,255,255,0.05)',
    padding: 4,
  },
  segment: {
    flex: 1,
    minHeight: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.sm,
    paddingHorizontal: 8,
  },
  segmentSelected: {
    backgroundColor: palette.accent,
  },
  segmentLabel: {
    color: 'rgba(255,255,255,0.66)',
    fontFamily: fonts.displayMedium,
    fontSize: type.caption.fontSize,
    lineHeight: type.caption.lineHeight,
    fontWeight: '500',
  },
  segmentLabelSelected: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  helper: {
    color: 'rgba(255,255,255,0.48)',
    fontSize: type.micro.fontSize,
    lineHeight: type.micro.lineHeight,
    marginTop: -12,
  },
  optionStack: {
    gap: 10,
  },
  option: {
    minHeight: 82,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 13,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.17)',
    borderRadius: radius.lg,
    backgroundColor: 'rgba(9,13,16,0.72)',
    padding: 14,
  },
  optionSelected: {
    borderColor: palette.accentDark,
    backgroundColor: 'rgba(13,58,43,0.76)',
  },
  optionIcon: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.10)',
  },
  optionIconSelected: {
    backgroundColor: palette.accentDark,
  },
  optionCopy: {
    flex: 1,
    gap: 2,
  },
  optionLabel: {
    color: '#FFFFFF',
    fontFamily: fonts.displayMedium,
    fontSize: type.body.fontSize,
    lineHeight: type.body.lineHeight,
    fontWeight: '600',
  },
  optionDetail: {
    color: 'rgba(255,255,255,0.58)',
    fontSize: type.caption.fontSize,
    lineHeight: 18,
  },
  radio: {
    width: 20,
    height: 20,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.46)',
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioSelected: {
    borderColor: palette.accentDark,
  },
  radioDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: palette.accentDark,
  },
  actions: {
    gap: 8,
  },
  secondaryAction: {
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  secondaryLabel: {
    color: '#FFFFFF',
    fontSize: type.body.fontSize,
    lineHeight: type.body.lineHeight,
    fontWeight: '500',
  },
  pressed: {
    opacity: 0.78,
  },
  saveError: {
    color: '#F7A0A0',
    fontSize: type.caption.fontSize,
    lineHeight: type.caption.lineHeight,
    fontWeight: '600',
    textAlign: 'center',
  },
  recommendationCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 13,
    borderWidth: 1,
    borderColor: 'rgba(31,201,139,0.38)',
    borderRadius: radius.lg,
    backgroundColor: 'rgba(13,58,43,0.66)',
    padding: 16,
  },
  recommendationIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: palette.accentDark,
  },
  recommendationCopy: {
    flex: 1,
    gap: 3,
  },
  recommendationTitle: {
    color: '#FFFFFF',
    fontFamily: fonts.displayMedium,
    fontSize: type.body.fontSize,
    lineHeight: type.body.lineHeight,
    fontWeight: '600',
  },
  recommendationDetail: {
    color: 'rgba(255,255,255,0.66)',
    fontSize: type.caption.fontSize,
    lineHeight: 18,
  },
  targetHero: {
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.16)',
    borderRadius: radius.xl,
    backgroundColor: 'rgba(9,13,16,0.78)',
    paddingHorizontal: 18,
    paddingVertical: 24,
  },
  targetHeroValue: {
    color: '#FFFFFF',
    fontFamily: fonts.display,
    fontSize: 46,
    lineHeight: 50,
    fontWeight: '600',
    letterSpacing: -1,
  },
  targetHeroUnit: {
    color: 'rgba(255,255,255,0.56)',
    fontSize: type.caption.fontSize,
    lineHeight: type.caption.lineHeight,
  },
  macroStrip: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 20,
  },
  macroItem: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
  },
  macroDivider: {
    width: 1,
    height: 28,
    backgroundColor: 'rgba(255,255,255,0.14)',
  },
  macroValue: {
    color: '#FFFFFF',
    fontFamily: fonts.displayMedium,
    fontSize: type.heading.fontSize,
    lineHeight: type.heading.lineHeight,
    fontWeight: '600',
  },
  macroLabel: {
    color: 'rgba(255,255,255,0.48)',
    fontSize: type.micro.fontSize,
    lineHeight: type.micro.lineHeight,
  },
  optionalLabel: {
    color: 'rgba(255,255,255,0.44)',
    fontFamily: fonts.displayMedium,
    fontSize: 10,
    lineHeight: 14,
    fontWeight: '600',
    letterSpacing: 1.3,
    marginTop: 2,
  },
});
