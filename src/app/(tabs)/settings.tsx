import { Ionicons } from '@expo/vector-icons';
import { useQueryClient } from '@tanstack/react-query';
import * as Application from 'expo-application';
import { useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { Linking, Platform, Pressable, StyleSheet, View } from 'react-native';
import { ActivityLevel, UnitSystem, WeekStart } from '@/domain/types';
import { loadDemoData } from '@/seed/demoData';
import { OnboardingProfile } from '@/repositories/settingsRepo';
import { useRepos } from '@/state/AppProvider';
import { keys, useMealCategories, useSetting } from '@/state/queries';
import { AppearanceMode, useTheme } from '@/ui/theme/ThemeProvider';
import {
  AppText,
  Button,
  Card,
  ListRow,
  Screen,
  SectionHeader,
  Sheet,
  TextField,
} from '@/ui/components';
import { radius, spacing, touchTarget } from '@/ui/theme/tokens';

type NutritionStyle = 'cut' | 'maintain' | 'bulk';

const STYLE_TO_GOAL: Record<NutritionStyle, OnboardingProfile['goalType']> = {
  cut: 'lose',
  maintain: 'maintain',
  bulk: 'gain',
};

const GOAL_TO_STYLE: Record<string, NutritionStyle> = {
  lose: 'cut',
  maintain: 'maintain',
  gain: 'bulk',
  muscle: 'bulk',
};

const ACTIVITY_OPTIONS: { value: ActivityLevel; label: string }[] = [
  { value: 'sedentary', label: 'Sedentary' },
  { value: 'light', label: 'Lightly active' },
  { value: 'moderate', label: 'Moderately active' },
  { value: 'very', label: 'Very active' },
  { value: 'extra', label: 'Extremely active' },
];

const DEFAULT_MEAL_TIMES: Record<string, string> = {
  breakfast: '7:30 AM',
  lunch: '12:30 PM',
  dinner: '6:30 PM',
  snacks: '3:30 PM',
  snack: '3:30 PM',
};

const MEAL_ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  breakfast: 'sunny-outline',
  lunch: 'partly-sunny-outline',
  dinner: 'moon-outline',
  snacks: 'leaf-outline',
  snack: 'leaf-outline',
};

const MEAL_TIME_OPTIONS = [
  '6:00 AM',
  '6:30 AM',
  '7:00 AM',
  '7:30 AM',
  '8:00 AM',
  '8:30 AM',
  '9:00 AM',
  '11:30 AM',
  '12:00 PM',
  '12:30 PM',
  '1:00 PM',
  '1:30 PM',
  '3:00 PM',
  '3:30 PM',
  '4:00 PM',
  '5:30 PM',
  '6:00 PM',
  '6:30 PM',
  '7:00 PM',
  '7:30 PM',
  '8:00 PM',
];

/** Settings — lifestyle toggles (mockup 3). */
export default function SettingsScreen() {
  const router = useRouter();
  const qc = useQueryClient();
  const allRepos = useRepos();
  const { settings, db } = allRepos;
  const { colors, mode, setMode } = useTheme();
  const categories = useMealCategories();

  const demoAvailable =
    __DEV__ ||
    (Platform.OS === 'web' &&
      typeof window !== 'undefined' &&
      window.location.search.includes('demo=1'));

  const units = useSetting<UnitSystem>('unitSystem', 'us');
  const weekStart = useSetting<WeekStart>('weekStart', 'monday');
  const savedGrokKey = useSetting<string>('grokApiKey', '');
  const savedDisplayName = useSetting<string>('displayName', '');
  const profile = useSetting<OnboardingProfile>('profile', {});
  const waterGoal = useSetting<number>('waterGoalCups', 8);
  const stepGoal = useSetting<number>('stepGoal', 10000);
  const mealTimes = useSetting<Record<string, string>>('mealTimes', DEFAULT_MEAL_TIMES);

  const [newMealOpen, setNewMealOpen] = useState(false);
  const [newMealName, setNewMealName] = useState('');
  const [confirmReset, setConfirmReset] = useState<null | 'onboarding' | 'all'>(null);
  const [draftGrokKey, setDraftGrokKey] = useState<string | null>(null);
  const [showGrokKey, setShowGrokKey] = useState(false);
  const grokKey = draftGrokKey ?? savedGrokKey.data ?? '';
  const [draftDisplayName, setDraftDisplayName] = useState<string | null>(null);
  const displayName = draftDisplayName ?? savedDisplayName.data ?? '';

  const [activityOpen, setActivityOpen] = useState(false);
  const [unitsOpen, setUnitsOpen] = useState(false);
  const [appearanceOpen, setAppearanceOpen] = useState(false);
  const [mealTimeEdit, setMealTimeEdit] = useState<string | null>(null);

  const nutritionStyle: NutritionStyle = useMemo(() => {
    const g = profile.data?.goalType ?? 'maintain';
    return GOAL_TO_STYLE[g] ?? 'maintain';
  }, [profile.data?.goalType]);

  const activity = profile.data?.activity ?? 'moderate';
  const activityLabel =
    ACTIVITY_OPTIONS.find((o) => o.value === activity)?.label ?? 'Moderately active';

  const cups = waterGoal.data ?? 8;
  const steps = stepGoal.data ?? 10000;
  const times = { ...DEFAULT_MEAL_TIMES, ...(mealTimes.data ?? {}) };

  async function patchProfile(patch: Partial<OnboardingProfile>) {
    const next = { ...(profile.data ?? {}), ...patch };
    await settings.setProfile(next);
    qc.invalidateQueries({ queryKey: keys.setting('profile') });
  }

  async function setNutritionStyle(style: NutritionStyle) {
    await patchProfile({ goalType: STYLE_TO_GOAL[style] });
  }

  async function setActivity(level: ActivityLevel) {
    await patchProfile({ activity: level });
    setActivityOpen(false);
  }

  async function setWater(n: number) {
    const clamped = Math.max(1, Math.min(16, n));
    await settings.set('waterGoalCups', clamped);
    qc.invalidateQueries({ queryKey: keys.setting('waterGoalCups') });
  }

  async function setSteps(n: number) {
    const clamped = Math.max(1000, Math.min(30000, Math.round(n / 500) * 500));
    await settings.set('stepGoal', clamped);
    qc.invalidateQueries({ queryKey: keys.setting('stepGoal') });
  }

  async function setMealTime(mealId: string, time: string) {
    const next = { ...times, [mealId]: time };
    await settings.set('mealTimes', next);
    qc.invalidateQueries({ queryKey: keys.setting('mealTimes') });
    setMealTimeEdit(null);
  }

  async function setUnits(u: UnitSystem) {
    await settings.setUnitSystem(u);
    qc.invalidateQueries({ queryKey: keys.setting('unitSystem') });
    setUnitsOpen(false);
  }

  async function setWeekStart(w: WeekStart) {
    await settings.setWeekStart(w);
    qc.invalidateQueries({ queryKey: keys.setting('weekStart') });
    qc.invalidateQueries({ queryKey: ['diary-range'] });
  }

  async function resetOnboarding() {
    await settings.setOnboardingComplete(false);
    qc.clear();
    router.replace('/onboarding');
  }

  async function resetAllData() {
    await db.execAsync(`
      DELETE FROM diary_entries;
      DELETE FROM custom_foods;
      DELETE FROM cached_foods;
      DELETE FROM saved_meal_items;
      DELETE FROM saved_meals;
      DELETE FROM recipe_ingredients;
      DELETE FROM recipes;
      DELETE FROM food_log_history;
      DELETE FROM search_history;
      DELETE FROM favorites;
      DELETE FROM goal_configs;
      DELETE FROM day_type_marks;
      DELETE FROM settings;
      DELETE FROM meal_categories WHERE builtin = 0;
    `);
    qc.clear();
    router.replace('/onboarding');
  }

  const stepFill = Math.min(steps / 12500, 1);

  return (
    <Screen tabBarSpace>
      <View style={styles.header}>
        <Ionicons name="settings" size={28} color={colors.accent} />
        <AppText variant="title" weight="700" display>
          Settings
        </AppText>
      </View>

      {/* Nutrition style */}
      <Card style={styles.card}>
        <SectionTitle
          icon="restaurant-outline"
          title="Nutrition style"
          subtitle="Choose your nutrition goal."
        />
        <View style={[styles.segment, { backgroundColor: colors.track }]}>
          {(
            [
              { value: 'cut', label: 'Cut' },
              { value: 'maintain', label: 'Maintain' },
              { value: 'bulk', label: 'Bulk' },
            ] as const
          ).map((opt) => {
            const selected = nutritionStyle === opt.value;
            return (
              <Pressable
                key={opt.value}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                accessibilityLabel={`Nutrition style ${opt.label}`}
                onPress={() => void setNutritionStyle(opt.value)}
                style={[
                  styles.segmentBtn,
                  selected && { backgroundColor: colors.accent },
                ]}
              >
                <AppText
                  variant="caption"
                  weight="600"
                  style={{ color: selected ? colors.onAccent : colors.textPrimary }}
                >
                  {opt.label}
                </AppText>
              </Pressable>
            );
          })}
        </View>
      </Card>

      {/* Activity level — effort levels */}
      <Card style={styles.card}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Activity level ${activityLabel}`}
          onPress={() => setActivityOpen(true)}
          style={styles.rowBetween}
        >
          <SectionTitle
            icon="walk-outline"
            title="Activity level"
            subtitle="How active are you daily?"
            compact
          />
          <View style={styles.valueChevron}>
            <AppText variant="caption" weight="600" style={{ color: colors.accent }}>
              {activityLabel}
            </AppText>
            <Ionicons name="chevron-down" size={16} color={colors.accent} />
          </View>
        </Pressable>
      </Card>

      {/* Meal schedule */}
      <Card style={styles.card}>
        <SectionTitle
          icon="calendar-outline"
          title="Meal schedule"
          subtitle="Set your daily eating windows."
        />
        <View style={styles.mealList}>
          {(categories.data ?? []).map((cat) => (
            <Pressable
              key={cat.id}
              accessibilityRole="button"
              accessibilityLabel={`${cat.name} time ${times[cat.id] ?? DEFAULT_MEAL_TIMES[cat.id] ?? 'unset'}`}
              onPress={() => setMealTimeEdit(cat.id)}
              style={styles.mealRow}
            >
              <View style={[styles.mealIcon, { backgroundColor: colors.accent + '22' }]}>
                <Ionicons
                  name={MEAL_ICONS[cat.id] ?? 'restaurant-outline'}
                  size={16}
                  color={colors.accent}
                />
              </View>
              <AppText variant="body" weight="600" style={{ flex: 1 }}>
                {cat.name}
              </AppText>
              <AppText variant="caption" style={{ color: colors.accent }}>
                {times[cat.id] ?? DEFAULT_MEAL_TIMES[cat.id] ?? 'Set time'}
              </AppText>
              <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
            </Pressable>
          ))}
        </View>
      </Card>

      {/* Water goal */}
      <Card style={styles.card}>
        <View style={styles.rowBetween}>
          <SectionTitle
            icon="water-outline"
            title="Water goal"
            subtitle="Daily water intake goal."
            compact
          />
          <Stepper
            label={`${cups} cups`}
            onMinus={() => void setWater(cups - 1)}
            onPlus={() => void setWater(cups + 1)}
          />
        </View>
        <View style={styles.glasses}>
          {Array.from({ length: 10 }, (_, i) => (
            <View
              key={i}
              style={[
                styles.glass,
                {
                  backgroundColor: i < cups ? colors.accent : 'transparent',
                  borderColor: colors.accent,
                },
              ]}
            />
          ))}
        </View>
      </Card>

      {/* Step goal */}
      <Card style={styles.card}>
        <View style={styles.rowBetween}>
          <SectionTitle
            icon="footsteps-outline"
            title="Step goal"
            subtitle="Daily step target."
            compact
          />
          <Stepper
            label={steps.toLocaleString()}
            onMinus={() => void setSteps(steps - 500)}
            onPlus={() => void setSteps(steps + 500)}
          />
        </View>
        <View style={[styles.stepTrack, { backgroundColor: colors.track }]}>
          <View
            style={[
              styles.stepFill,
              { width: `${stepFill * 100}%`, backgroundColor: colors.accent },
            ]}
          />
        </View>
        <AppText variant="micro" weight="600" style={{ color: colors.accent, alignSelf: 'flex-end' }}>
          {Math.round(steps / 1000)}K steps
        </AppText>
      </Card>

      <AppText variant="caption" tone="muted" style={styles.prefLabel}>
        Preferences
      </AppText>
      <Card padded={false} style={{ paddingHorizontal: spacing.lg }}>
        <ListRow
          title="Units"
          value={units.data === 'metric' ? 'Metric (kg, cm)' : 'US (lb, ft)'}
          left={<Ionicons name="scale-outline" size={20} color={colors.accent} />}
          right={<Ionicons name="chevron-forward" size={16} color={colors.textMuted} />}
          onPress={() => setUnitsOpen(true)}
        />
        <ListRow
          title="Appearance"
          value={mode === 'system' ? 'System' : mode === 'dark' ? 'Dark' : 'Light'}
          left={<Ionicons name="brush-outline" size={20} color={colors.accent} />}
          right={<Ionicons name="chevron-forward" size={16} color={colors.textMuted} />}
          onPress={() => setAppearanceOpen(true)}
        />
        <ListRow
          title="Display name"
          value={displayName.trim() || 'Not set'}
          left={<Ionicons name="person-outline" size={20} color={colors.accent} />}
          onPress={() => setDraftDisplayName(displayName)}
        />
        <ListRow
          title="Daily and weekly goals"
          subtitle="Targets, training and rest days"
          left={<Ionicons name="flag-outline" size={20} color={colors.accent} />}
          right={<Ionicons name="chevron-forward" size={16} color={colors.textMuted} />}
          onPress={() => router.push('/goals')}
        />
      </Card>

      <SectionHeader title="AI features" />
      <Card style={{ gap: spacing.md }}>
        <AppText variant="caption" tone="secondary">
          Paste your personal xAI Grok API key for AI food scan and the voice assistant. The key
          stays on this device.
        </AppText>
        <TextField
          label="Grok API key"
          value={grokKey}
          onChangeText={setDraftGrokKey}
          placeholder="xai-…"
          autoCapitalize="none"
          autoCorrect={false}
          secureTextEntry={!showGrokKey}
        />
        <View style={{ flexDirection: 'row', gap: spacing.sm }}>
          <Button
            title={showGrokKey ? 'Hide key' : 'Show key'}
            variant="ghost"
            compact
            onPress={() => setShowGrokKey((v) => !v)}
          />
          <Button
            title="Save key"
            compact
            onPress={async () => {
              await settings.set('grokApiKey', grokKey.trim());
              setDraftGrokKey(null);
              qc.invalidateQueries({ queryKey: keys.setting('grokApiKey') });
            }}
          />
        </View>
      </Card>

      <SectionHeader title="Data" />
      <Card padded={false} style={{ paddingHorizontal: spacing.lg, paddingVertical: spacing.xs }}>
        {demoAvailable ? (
          <ListRow
            title="Load demo data"
            subtitle="Development only: sample history"
            onPress={async () => {
              await loadDemoData(allRepos);
              qc.clear();
            }}
          />
        ) : null}
        <ListRow
          title="Reset onboarding"
          subtitle="Redo the setup wizard"
          onPress={() => setConfirmReset('onboarding')}
        />
        <ListRow
          title="Delete all data"
          subtitle="Erases everything on this device"
          destructive
          onPress={() => setConfirmReset('all')}
        />
      </Card>

      <SectionHeader title="Privacy" />
      <Card>
        <AppText variant="caption" tone="secondary">
          All of your data lives in a local database on this device. Macronaut has no account
          system, no analytics and no tracking.
        </AppText>
      </Card>

      <SectionHeader title="Food data sources" />
      <Card padded={false} style={{ paddingHorizontal: spacing.lg, paddingVertical: spacing.xs }}>
        <ListRow
          title="USDA FoodData Central"
          onPress={() => Linking.openURL('https://fdc.nal.usda.gov/')}
        />
        <ListRow
          title="Open Food Facts"
          onPress={() => Linking.openURL('https://world.openfoodfacts.org/')}
        />
      </Card>

      <AppText variant="micro" tone="muted" align="center">
        Macronaut {Application.nativeApplicationVersion ?? '1.0.0'}
        {Platform.OS === 'web' ? ' · web preview' : ''}
      </AppText>

      {/* Activity level sheet */}
      <Sheet visible={activityOpen} onClose={() => setActivityOpen(false)} title="Activity level">
        {ACTIVITY_OPTIONS.map((opt) => (
          <ListRow
            key={opt.value}
            title={opt.label}
            selected={activity === opt.value}
            onPress={() => void setActivity(opt.value)}
          />
        ))}
      </Sheet>

      {/* Units sheet */}
      <Sheet visible={unitsOpen} onClose={() => setUnitsOpen(false)} title="Units">
        <ListRow
          title="US (lb, ft)"
          selected={(units.data ?? 'us') === 'us'}
          onPress={() => void setUnits('us')}
        />
        <ListRow
          title="Metric (kg, cm)"
          selected={(units.data ?? 'us') === 'metric'}
          onPress={() => void setUnits('metric')}
        />
        <AppText variant="caption" tone="muted" style={{ marginTop: spacing.md }}>
          Week starts on
        </AppText>
        <ListRow
          title="Monday"
          selected={(weekStart.data ?? 'monday') === 'monday'}
          onPress={() => void setWeekStart('monday')}
        />
        <ListRow
          title="Sunday"
          selected={(weekStart.data ?? 'monday') === 'sunday'}
          onPress={() => void setWeekStart('sunday')}
        />
      </Sheet>

      {/* Appearance sheet */}
      <Sheet visible={appearanceOpen} onClose={() => setAppearanceOpen(false)} title="Appearance">
        {(
          [
            { value: 'light', label: 'Light' },
            { value: 'dark', label: 'Dark' },
            { value: 'system', label: 'System' },
          ] as { value: AppearanceMode; label: string }[]
        ).map((opt) => (
          <ListRow
            key={opt.value}
            title={opt.label}
            selected={mode === opt.value}
            onPress={() => {
              setMode(opt.value);
              setAppearanceOpen(false);
            }}
          />
        ))}
      </Sheet>

      {/* Meal time sheet */}
      <Sheet
        visible={mealTimeEdit !== null}
        onClose={() => setMealTimeEdit(null)}
        title="Meal time"
      >
        {MEAL_TIME_OPTIONS.map((t) => (
          <ListRow
            key={t}
            title={t}
            selected={mealTimeEdit ? times[mealTimeEdit] === t : false}
            onPress={() => mealTimeEdit && void setMealTime(mealTimeEdit, t)}
          />
        ))}
      </Sheet>

      {/* Display name sheet */}
      <Sheet
        visible={draftDisplayName !== null}
        onClose={() => setDraftDisplayName(null)}
        title="Display name"
      >
        <TextField
          value={displayName}
          onChangeText={setDraftDisplayName}
          placeholder="Your name"
          autoCapitalize="words"
          autoFocus
        />
        <Button
          title="Save"
          onPress={async () => {
            await settings.set('displayName', (draftDisplayName ?? '').trim());
            setDraftDisplayName(null);
            qc.invalidateQueries({ queryKey: keys.setting('displayName') });
          }}
        />
      </Sheet>

      <Sheet visible={newMealOpen} onClose={() => setNewMealOpen(false)} title="New meal category">
        <TextField
          label="Name"
          value={newMealName}
          onChangeText={setNewMealName}
          placeholder="Pre-workout"
          autoFocus
        />
        <Button
          title="Add"
          disabled={!newMealName.trim()}
          onPress={async () => {
            await settings.addMealCategory(newMealName);
            qc.invalidateQueries({ queryKey: keys.mealCategories });
            setNewMealName('');
            setNewMealOpen(false);
          }}
        />
      </Sheet>

      <Sheet
        visible={confirmReset !== null}
        onClose={() => setConfirmReset(null)}
        title={confirmReset === 'all' ? 'Delete all data?' : 'Reset onboarding?'}
      >
        <AppText variant="body" tone="secondary">
          {confirmReset === 'all'
            ? 'This permanently erases your diary, foods, meals, recipes, goals and settings from this device.'
            : 'You will go through the setup wizard again. Your diary, foods and history are kept.'}
        </AppText>
        <Button
          title={confirmReset === 'all' ? 'Yes, delete everything' : 'Yes, reset onboarding'}
          variant={confirmReset === 'all' ? 'danger' : 'primary'}
          onPress={() => {
            const kind = confirmReset;
            setConfirmReset(null);
            if (kind === 'all') void resetAllData();
            else void resetOnboarding();
          }}
        />
        <Button title="Cancel" variant="ghost" onPress={() => setConfirmReset(null)} />
      </Sheet>
    </Screen>
  );
}

function SectionTitle({
  icon,
  title,
  subtitle,
  compact,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle: string;
  compact?: boolean;
}) {
  const { colors } = useTheme();
  return (
    <View style={[styles.sectionTitle, compact && { flex: 1, minWidth: 0, paddingRight: spacing.sm }]}>
      <Ionicons name={icon} size={22} color={colors.accent} />
      <View style={{ flex: 1, gap: 2, minWidth: 0 }}>
        <AppText variant="body" weight="600" numberOfLines={1}>
          {title}
        </AppText>
        <AppText variant="micro" tone="muted" numberOfLines={2}>
          {subtitle}
        </AppText>
      </View>
    </View>
  );
}

function Stepper({
  label,
  onMinus,
  onPlus,
}: {
  label: string;
  onMinus: () => void;
  onPlus: () => void;
}) {
  const { colors } = useTheme();
  return (
    <View style={styles.stepper}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Decrease"
        onPress={onMinus}
        style={[styles.stepperBtn, { backgroundColor: colors.track }]}
      >
        <Ionicons name="remove" size={18} color={colors.accent} />
      </Pressable>
      <AppText variant="caption" weight="700" style={{ color: colors.accent, minWidth: 64, textAlign: 'center' }}>
        {label}
      </AppText>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Increase"
        onPress={onPlus}
        style={[styles.stepperBtn, { backgroundColor: colors.track }]}
      >
        <Ionicons name="add" size={18} color={colors.accent} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: touchTarget,
  },
  card: {
    gap: spacing.md,
  },
  sectionTitle: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
  },
  segment: {
    flexDirection: 'row',
    borderRadius: radius.full,
    padding: 4,
    gap: 4,
  },
  segmentBtn: {
    flex: 1,
    minHeight: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.full,
  },
  rowBetween: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  valueChevron: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    flexShrink: 0,
  },
  mealList: {
    gap: 2,
  },
  mealRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: 48,
    paddingVertical: spacing.xs,
  },
  mealIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  glasses: {
    flexDirection: 'row',
    gap: 6,
    flexWrap: 'wrap',
  },
  glass: {
    width: 22,
    height: 28,
    borderRadius: 6,
    borderWidth: 1.5,
  },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flexShrink: 0,
  },
  stepperBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepTrack: {
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
  },
  stepFill: {
    height: '100%',
    borderRadius: 3,
  },
  prefLabel: {
    marginTop: spacing.xs,
    marginLeft: spacing.xs,
  },
});
