import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useQueryClient } from '@tanstack/react-query';
import * as Application from 'expo-application';
import { useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { Linking, Platform, Pressable, StyleSheet, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
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
import { radius, spacing } from '@/ui/theme/tokens';

type NutritionStyle = 'cut' | 'maintain' | 'bulk';
type IconSpec =
  | { set: 'ion'; name: keyof typeof Ionicons.glyphMap }
  | { set: 'mci'; name: React.ComponentProps<typeof MaterialCommunityIcons>['name'] };

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

/** Mockup meal glyphs: sunrise / sun / sunset / leaf (no circular chrome). */
const MEAL_ICONS: Record<string, IconSpec> = {
  breakfast: { set: 'mci', name: 'weather-sunset-up' },
  lunch: { set: 'mci', name: 'white-balance-sunny' },
  dinner: { set: 'mci', name: 'weather-sunset-down' },
  snacks: { set: 'mci', name: 'leaf' },
  snack: { set: 'mci', name: 'leaf' },
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

  // Decorative fill ~80% like the mockup (goal label sits beside the track).
  const stepFill = 0.8;

  return (
    <Screen tabBarSpace>
      <View style={styles.lifestyleStack}>
      <View style={styles.header}>
        <Ionicons name="settings" size={28} color={colors.accent} />
        <AppText variant="title" weight="700" display>
          Settings
        </AppText>
      </View>

      {/* Nutrition style */}
      <Card style={[styles.card, styles.lifestyleCard]}>
        <SectionTitle
          icon={{ set: 'ion', name: 'restaurant' }}
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
      <Card style={[styles.card, styles.lifestyleCard]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Activity level ${activityLabel}`}
          onPress={() => setActivityOpen(true)}
          style={styles.rowBetween}
        >
          <SectionTitle
            icon={{ set: 'mci', name: 'run' }}
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
      <Card style={[styles.card, styles.lifestyleCard]}>
        <SectionTitle
          icon={{ set: 'mci', name: 'calendar-clock' }}
          title="Meal schedule"
          subtitle="Set your daily eating windows."
        />
        <View style={styles.mealList}>
          {(categories.data ?? []).map((cat, idx, arr) => (
            <Pressable
              key={cat.id}
              accessibilityRole="button"
              accessibilityLabel={`${cat.name} time ${times[cat.id] ?? DEFAULT_MEAL_TIMES[cat.id] ?? 'unset'}`}
              onPress={() => setMealTimeEdit(cat.id)}
              style={[
                styles.mealRow,
                idx < arr.length - 1 && {
                  borderBottomWidth: StyleSheet.hairlineWidth,
                  borderBottomColor: colors.border,
                },
              ]}
            >
              <AccentIcon
                icon={MEAL_ICONS[cat.id] ?? { set: 'ion', name: 'restaurant-outline' }}
                size={20}
              />
              <AppText variant="body" weight="600" style={{ flex: 1 }}>
                {cat.name}
              </AppText>
              <AppText variant="caption" tone="secondary">
                {times[cat.id] ?? DEFAULT_MEAL_TIMES[cat.id] ?? 'Set time'}
              </AppText>
              <Ionicons name="chevron-forward" size={16} color={colors.accent} />
            </Pressable>
          ))}
        </View>
      </Card>

      {/* Water goal */}
      <Card style={[styles.card, styles.lifestyleCard]}>
        <View style={styles.rowBetween}>
          <SectionTitle
            icon={{ set: 'ion', name: 'water' }}
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
          {Array.from({ length: 9 }, (_, i) => (
            <WaterGlass key={i} filled={i < cups} color={colors.accent} />
          ))}
        </View>
      </Card>

      {/* Step goal */}
      <Card style={[styles.card, styles.lifestyleCard]}>
        <View style={styles.rowBetween}>
          <SectionTitle
            icon={{ set: 'mci', name: 'shoe-sneaker' }}
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
        <View style={styles.stepRow}>
          <View style={[styles.stepTrack, { backgroundColor: colors.track }]}>
            <View
              style={[
                styles.stepFill,
                { width: `${stepFill * 100}%`, backgroundColor: colors.accent },
              ]}
            />
          </View>
          <AppText variant="micro" tone="muted">
            {Math.round(steps / 1000)}K steps
          </AppText>
        </View>
      </Card>

      <AppText variant="caption" tone="muted" style={styles.prefLabel}>
        Preferences
      </AppText>
      <Card padded={false} style={styles.prefCard}>
        <PrefRow
          icon={{ set: 'mci', name: 'scale-balance' }}
          title="Units"
          value={units.data === 'metric' ? 'Metric (kg, cm)' : 'US (lb, ft)'}
          onPress={() => setUnitsOpen(true)}
        />
        <View style={[styles.prefDivider, { backgroundColor: colors.border }]} />
        <PrefRow
          icon={{ set: 'mci', name: 'brush' }}
          title="Appearance"
          value={mode === 'system' ? 'System' : mode === 'dark' ? 'Dark' : 'Light'}
          onPress={() => setAppearanceOpen(true)}
        />
      </Card>
      </View>

      <Card padded={false} style={{ paddingHorizontal: spacing.lg }}>
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

function AccentIcon({ icon, size = 22 }: { icon: IconSpec; size?: number }) {
  const { colors } = useTheme();
  if (icon.set === 'mci') {
    return <MaterialCommunityIcons name={icon.name} size={size} color={colors.accent} />;
  }
  return <Ionicons name={icon.name} size={size} color={colors.accent} />;
}

/** Trapezoid tumbler — wider top, rounded base; wavy fill like the mockup. */
function WaterGlass({ filled, color }: { filled: boolean; color: string }) {
  const outline =
    'M3.5 2.5 H18.5 L16.2 24.5 C16 25.5 15.1 26.2 14 26.2 H8 C6.9 26.2 6 25.5 5.8 24.5 Z';
  const waveFill =
    'M4.2 5.2 C6.5 3.6 8.8 6.4 11 5.2 C13.2 4 15.5 6.2 17.5 4.8 L16.1 24.3 C15.95 25.1 15.2 25.6 14 25.6 H8 C6.8 25.6 6.05 25.1 5.9 24.3 Z';
  return (
    <View style={styles.glassSlot} accessibilityElementsHidden>
      <Svg width={22} height={28} viewBox="0 0 22 28">
        {filled ? <Path d={waveFill} fill={color} /> : null}
        <Path d={outline} fill="none" stroke={color} strokeWidth={1.6} />
      </Svg>
    </View>
  );
}

function SectionTitle({
  icon,
  title,
  subtitle,
  compact,
}: {
  icon: IconSpec;
  title: string;
  subtitle: string;
  compact?: boolean;
}) {
  return (
    <View style={[styles.sectionTitle, compact && { flex: 1, minWidth: 0, paddingRight: spacing.sm }]}>
      <AccentIcon icon={icon} size={22} />
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
    <View style={[styles.stepper, { backgroundColor: colors.track, borderColor: colors.borderStrong }]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Decrease"
        onPress={onMinus}
        style={styles.stepperBtn}
      >
        <Ionicons name="remove" size={16} color={colors.accent} />
      </Pressable>
      <View style={[styles.stepperDivider, { backgroundColor: colors.borderStrong }]} />
      <AppText
        variant="caption"
        weight="700"
        style={{
          color: colors.accent,
          minWidth: 58,
          textAlign: 'center',
          paddingHorizontal: 4,
        }}
      >
        {label}
      </AppText>
      <View style={[styles.stepperDivider, { backgroundColor: colors.borderStrong }]} />
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Increase"
        onPress={onPlus}
        style={styles.stepperBtn}
      >
        <Ionicons name="add" size={16} color={colors.accent} />
      </Pressable>
    </View>
  );
}

function PrefRow({
  icon,
  title,
  value,
  onPress,
}: {
  icon: IconSpec;
  title: string;
  value: string;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${title}, ${value}`}
      onPress={onPress}
      style={styles.prefRow}
    >
      <AccentIcon icon={icon} size={20} />
      <AppText variant="body" weight="600" style={{ flex: 1 }}>
        {title}
      </AppText>
      <AppText variant="caption" weight="600" style={{ color: colors.accent }}>
        {value}
      </AppText>
      <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  lifestyleStack: {
    gap: 8,
  },
  lifestyleCard: {
    padding: 12,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: 32,
    marginBottom: 2,
  },
  card: {
    gap: 8,
    marginBottom: 0,
  },
  sectionTitle: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  segment: {
    flexDirection: 'row',
    borderRadius: radius.full,
    padding: 3,
    gap: 3,
  },
  segmentBtn: {
    flex: 1,
    minHeight: 32,
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
    gap: 0,
    marginTop: 2,
  },
  mealRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minHeight: 34,
    paddingVertical: 4,
  },
  glasses: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'flex-end',
    justifyContent: 'flex-start',
    marginTop: 4,
  },
  glassSlot: {
    alignItems: 'center',
  },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    flexShrink: 0,
    borderRadius: radius.full,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 2,
    minHeight: 30,
  },
  stepperBtn: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperDivider: {
    width: StyleSheet.hairlineWidth,
    alignSelf: 'stretch',
    marginVertical: 6,
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  stepTrack: {
    flex: 1,
    height: 6,
    borderRadius: 4,
    overflow: 'hidden',
  },
  stepFill: {
    height: '100%',
    borderRadius: 4,
  },
  prefLabel: {
    marginTop: 2,
    marginLeft: 2,
    marginBottom: 2,
  },
  prefCard: {
    paddingHorizontal: 12,
    paddingVertical: 2,
    marginBottom: 0,
  },
  prefRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minHeight: 42,
    paddingVertical: 8,
  },
  prefDivider: {
    height: StyleSheet.hairlineWidth,
  },
});
