import { Redirect, useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import { recommendTargets } from '@/domain/recommend';
import {
  ActivityLevel,
  BiologicalSex,
  GoalType,
  NutrientTargets,
  UnitSystem,
} from '@/domain/types';
import { useRepos } from '@/state/AppProvider';
import { keys, useSetting } from '@/state/queries';
import { todayKey } from '@/utils/date';
import {
  AppText,
  Button,
  Card,
  NumberField,
  Screen,
  SegmentedControl,
  TargetEditor,
  TextField,
} from '@/ui/components';
import { useTheme } from '@/ui/theme/ThemeProvider';
import { radius, spacing } from '@/ui/theme/tokens';

type Step = 'welcome' | 'about' | 'goal' | 'activity' | 'review';
const STEPS: Step[] = ['welcome', 'about', 'goal', 'activity', 'review'];

const GOAL_OPTIONS: { value: GoalType; label: string; detail: string }[] = [
  { value: 'lose', label: 'Lose weight', detail: 'Calorie deficit with protein to hold muscle' },
  { value: 'maintain', label: 'Maintain weight', detail: 'Stay where you are, eat balanced' },
  { value: 'gain', label: 'Gain weight', detail: 'Steady surplus for overall gain' },
  { value: 'muscle', label: 'Build muscle', detail: 'Lean surplus, high protein' },
];

const ACTIVITY_OPTIONS: { value: ActivityLevel; label: string; detail: string }[] = [
  { value: 'sedentary', label: 'Sedentary', detail: 'Little or no exercise, desk job' },
  { value: 'light', label: 'Lightly active', detail: 'Light exercise 1–3 days/week' },
  { value: 'moderate', label: 'Moderately active', detail: 'Moderate exercise 3–5 days/week' },
  { value: 'very', label: 'Very active', detail: 'Hard exercise 6–7 days/week' },
  { value: 'extra', label: 'Extremely active', detail: 'Very hard exercise or physical job' },
];

const KG_PER_LB = 0.45359237;
const CM_PER_IN = 2.54;

export default function Onboarding() {
  const router = useRouter();
  const { settings, goals } = useRepos();
  const qc = useQueryClient();
  const { colors } = useTheme();
  const auth = useSetting<boolean>('authComplete', false);

  const [step, setStep] = useState<Step>('welcome');
  const [displayName, setDisplayName] = useState('');
  const [units, setUnits] = useState<UnitSystem>('us');
  const [age, setAge] = useState<number | undefined>();
  const [sex, setSex] = useState<BiologicalSex>('male');
  const [heightFt, setHeightFt] = useState<number | undefined>(5);
  const [heightIn, setHeightIn] = useState<number | undefined>(9);
  const [heightCm, setHeightCm] = useState<number | undefined>();
  const [weightLb, setWeightLb] = useState<number | undefined>();
  const [weightKg, setWeightKg] = useState<number | undefined>();
  const [goalWeightLb, setGoalWeightLb] = useState<number | undefined>();
  const [goalWeightKg, setGoalWeightKg] = useState<number | undefined>();
  const [goalType, setGoalType] = useState<GoalType>('maintain');
  const [rateLb, setRateLb] = useState<number | undefined>(1);
  const [activity, setActivity] = useState<ActivityLevel>('moderate');
  const [targets, setTargets] = useState<NutrientTargets | null>(null);
  const [saving, setSaving] = useState(false);

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

  const recommendation = useMemo(() => {
    if (!canRecommend) return null;
    const signedRate = goalType === 'lose' ? -(rateLb ?? 1) : goalType === 'maintain' ? 0 : (rateLb ?? 0.5);
    return recommendTargets({
      age: age!,
      sex,
      height: metrics.height!,
      weight: metrics.weight!,
      goalWeight: metrics.goalWeight,
      activity,
      goalType,
      weeklyRateKg: signedRate * KG_PER_LB,
    });
  }, [canRecommend, age, sex, metrics, activity, goalType, rateLb]);

  if (auth.isLoading) return null;
  if (!auth.data) return <Redirect href="/login" />;

  async function complete(finalTargets: NutrientTargets) {
    setSaving(true);
    try {
      const name = displayName.trim();
      if (name) {
        await settings.set('displayName', name);
        qc.invalidateQueries({ queryKey: keys.setting('displayName') });
      }
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
          goalType === 'lose'
            ? -(rateLb ?? 1) * KG_PER_LB
            : goalType === 'maintain'
              ? 0
              : (rateLb ?? 0.5) * KG_PER_LB,
      });
      await goals.saveConfig({
        effectiveFrom: todayKey(),
        mode: 'same-daily',
        baseTarget: finalTargets,
        weeklyMode: 'sum-daily',
      });
      await settings.setOnboardingComplete(true);
      qc.clear();
      router.replace('/');
    } finally {
      setSaving(false);
    }
  }

  /** Skip: sensible default targets, fully editable later in Goals. */
  function skip() {
    complete({
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

  const stepIndex = STEPS.indexOf(step);

  const optionCard = (
    selected: boolean,
    onPress: () => void,
    label: string,
    detail: string,
  ) => (
    <Pressable
      key={label}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={detail}
      accessibilityState={{ selected }}
      onPress={onPress}
      style={{
        borderWidth: selected ? 2 : 1,
        borderColor: selected ? colors.accent : colors.border,
        backgroundColor: colors.surface,
        borderRadius: radius.md,
        padding: spacing.lg,
        gap: 2,
      }}
    >
      <AppText variant="body" weight="600">
        {label}
      </AppText>
      <AppText variant="caption" tone="secondary">
        {detail}
      </AppText>
    </Pressable>
  );

  return (
    <Screen>
      {step !== 'welcome' ? (
        <View style={{ flexDirection: 'row', gap: 4 }}>
          {STEPS.slice(1).map((s, i) => (
            <View
              key={s}
              style={{
                flex: 1,
                height: 4,
                borderRadius: 2,
                backgroundColor: i < stepIndex ? colors.accent : colors.track,
              }}
            />
          ))}
        </View>
      ) : null}

      {step === 'welcome' ? (
        <View style={{ gap: spacing.lg, marginTop: spacing.xxl }}>
          <AppText variant="hero" weight="600" display>
            Macronaut
          </AppText>
          <AppText variant="heading" tone="secondary">
            Track calories and macros without the clutter.
          </AppText>
          <AppText variant="body" tone="secondary">
            Answer a few optional questions and Macronaut will recommend daily calorie and macro
            targets. They are recommendations, not rules — you can change every number, any time.
          </AppText>
          <TextField
            label="What should we call you?"
            value={displayName}
            onChangeText={setDisplayName}
            placeholder="Your first name"
            autoCapitalize="words"
            autoCorrect={false}
          />
          <Button title="Get started" onPress={() => setStep('about')} />
          <Button
            title="Skip — I'll set my own targets"
            variant="ghost"
            onPress={skip}
            loading={saving}
          />
        </View>
      ) : null}

      {step === 'about' ? (
        <View style={{ gap: spacing.lg }}>
          <AppText variant="title" weight="600" display>
            About you
          </AppText>
          <SegmentedControl
            options={[
              { value: 'us', label: 'US units' },
              { value: 'metric', label: 'Metric' },
            ]}
            value={units}
            onChange={setUnits}
          />
          <NumberField label="Age" value={age} onChange={setAge} unit="years" min={13} max={120} integer />
          <View style={{ gap: spacing.xs }}>
            <AppText variant="caption" tone="secondary">
              Biological sex (used only for the calorie formula)
            </AppText>
            <SegmentedControl
              options={[
                { value: 'male', label: 'Male' },
                { value: 'female', label: 'Female' },
              ]}
              value={sex}
              onChange={setSex}
            />
          </View>
          {units === 'us' ? (
            <View style={{ flexDirection: 'row', gap: spacing.md }}>
              <View style={{ flex: 1 }}>
                <NumberField label="Height (ft)" value={heightFt} onChange={setHeightFt} min={3} max={8} integer />
              </View>
              <View style={{ flex: 1 }}>
                <NumberField label="Height (in)" value={heightIn} onChange={setHeightIn} min={0} max={11} />
              </View>
            </View>
          ) : (
            <NumberField label="Height" value={heightCm} onChange={setHeightCm} unit="cm" min={90} max={250} />
          )}
          {units === 'us' ? (
            <NumberField label="Current weight" value={weightLb} onChange={setWeightLb} unit="lb" min={50} max={1000} />
          ) : (
            <NumberField label="Current weight" value={weightKg} onChange={setWeightKg} unit="kg" min={25} max={450} />
          )}
          <Button
            title="Continue"
            onPress={() => setStep('goal')}
            disabled={!canRecommend}
          />
          <Button title="Back" variant="ghost" onPress={() => setStep('welcome')} />
        </View>
      ) : null}

      {step === 'goal' ? (
        <View style={{ gap: spacing.md }}>
          <AppText variant="title" weight="600" display>
            Your goal
          </AppText>
          {GOAL_OPTIONS.map((o) =>
            optionCard(goalType === o.value, () => setGoalType(o.value), o.label, o.detail),
          )}
          {goalType !== 'maintain' ? (
            <>
              {units === 'us' ? (
                <NumberField
                  label="Goal weight (optional)"
                  value={goalWeightLb}
                  onChange={setGoalWeightLb}
                  unit="lb"
                />
              ) : (
                <NumberField
                  label="Goal weight (optional)"
                  value={goalWeightKg}
                  onChange={setGoalWeightKg}
                  unit="kg"
                />
              )}
              <NumberField
                label={`Weekly ${goalType === 'lose' ? 'loss' : 'gain'} rate`}
                value={rateLb}
                onChange={setRateLb}
                unit="lb/week"
                min={0.1}
                max={2}
              />
            </>
          ) : null}
          <Button title="Continue" onPress={() => setStep('activity')} />
          <Button title="Back" variant="ghost" onPress={() => setStep('about')} />
        </View>
      ) : null}

      {step === 'activity' ? (
        <View style={{ gap: spacing.md }}>
          <AppText variant="title" weight="600" display>
            Activity level
          </AppText>
          {ACTIVITY_OPTIONS.map((o) =>
            optionCard(activity === o.value, () => setActivity(o.value), o.label, o.detail),
          )}
          <Button
            title="See my targets"
            onPress={() => {
              if (recommendation) setTargets(recommendation.targets);
              setStep('review');
            }}
          />
          <Button title="Back" variant="ghost" onPress={() => setStep('goal')} />
        </View>
      ) : null}

      {step === 'review' && targets ? (
        <View style={{ gap: spacing.lg }}>
          <AppText variant="title" weight="600" display>
            Your recommended targets
          </AppText>
          <Card>
            <AppText variant="caption" tone="secondary">
              Based on Mifflin-St Jeor: BMR {recommendation?.bmr} kcal, maintenance ~
              {recommendation?.tdee} kcal/day. These are recommendations — edit anything below, and
              change them later in Settings → Goals.
            </AppText>
          </Card>
          <TargetEditor value={targets} onChange={setTargets} />
          <Button title="Save and start tracking" onPress={() => complete(targets)} loading={saving} />
          <Button title="Back" variant="ghost" onPress={() => setStep('activity')} />
        </View>
      ) : null}
    </Screen>
  );
}
