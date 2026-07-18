import { Ionicons } from '@expo/vector-icons';
import { Image, type ImageSource } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  useActivityEntries,
  useDayProgress,
  useDiaryEntries,
  useMealCategories,
  useSetting,
} from '@/state/queries';
import { useUiStore } from '@/state/uiStore';
import { displayFirstName, greetingForHour } from '@/utils/greeting';
import { ActivityType } from '@/repositories/types';
import {
  ActivityLogList,
  AppText,
  BarEntranceProvider,
  MonthCalendarPopup,
  ProgressRing,
  Screen,
  SectionHeader,
} from '@/ui/components';
import { useTheme } from '@/ui/theme/ThemeProvider';
import { radius, spacing, touchTarget } from '@/ui/theme/tokens';

const HERO_IMAGE = require('../../../assets/images/today/hero-gym.jpg');

const MACRO_IMAGES: Record<'protein' | 'carbs' | 'fat', ImageSource> = {
  protein: require('../../../assets/images/progress/macro-protein.png'),
  carbs: require('../../../assets/images/progress/macro-carbs.png'),
  fat: require('../../../assets/images/progress/macro-fat.png'),
};

const MEAL_IMAGES: Record<string, ImageSource> = {
  breakfast: require('../../../assets/images/today/meal-breakfast.png'),
  lunch: require('../../../assets/images/today/meal-lunch.png'),
  dinner: require('../../../assets/images/today/meal-dinner.png'),
  snacks: require('../../../assets/images/today/meal-snacks.png'),
  snack: require('../../../assets/images/today/meal-snacks.png'),
};

const MACRO_ICONS: Record<'protein' | 'carbs' | 'fat', keyof typeof Ionicons.glyphMap> = {
  protein: 'fish-outline',
  carbs: 'nutrition-outline',
  fat: 'water-outline',
};

/** Today — split dayboard (mockup 3): hero + ring/goals + photo macros + meals. */
export default function TodayScreen() {
  return (
    <BarEntranceProvider pageKey="today">
      <TodayBody />
    </BarEntranceProvider>
  );
}

function TodayBody() {
  const router = useRouter();
  const { colors, resolved } = useTheme();
  const insets = useSafeAreaInsets();
  const { width, height: windowHeight } = useWindowDimensions();
  const date = useUiStore((s) => s.selectedDate);
  const setSelectedDate = useUiStore((s) => s.setSelectedDate);
  const setTargetMeal = useUiStore((s) => s.setTargetMeal);
  const progress = useDayProgress(date);
  const entries = useDiaryEntries(date);
  const activities = useActivityEntries(date);
  const categories = useMealCategories();
  const displayName = useSetting<string>('displayName', '');
  const [calendarOpen, setCalendarOpen] = useState(false);

  const greeting = useMemo(() => greetingForHour(), []);
  const firstName = displayFirstName(displayName.data);

  const consumed = progress?.consumed.calories ?? 0;
  const burned = progress?.burned ?? 0;
  const target = progress?.target.calories ?? 0;
  const remaining = progress?.caloriesRemaining ?? target - consumed;
  const over = remaining < 0;

  const mealTotals = new Map<string, number>();
  const mealTimes = new Map<string, string>();
  const mealTitles = new Map<string, string>();
  for (const e of entries.data ?? []) {
    mealTotals.set(e.meal, (mealTotals.get(e.meal) ?? 0) + e.nutrition.calories);
    if (!mealTimes.has(e.meal) && e.createdAt) {
      mealTimes.set(e.meal, formatEntryTime(e.createdAt));
    }
    if (!mealTitles.has(e.meal) && e.name?.trim()) {
      mealTitles.set(e.meal, e.name.trim());
    }
  }

  const burnedByType = new Map<ActivityType, number>();
  for (const a of activities.data ?? []) {
    burnedByType.set(a.activityType, (burnedByType.get(a.activityType) ?? 0) + a.caloriesBurned);
  }

  // Hero is tall enough that the athlete stays visible above the goals card.
  const heroHeight = Math.round(
    Math.min(Math.max(windowHeight * 0.42, width * 0.95), 420),
  );
  const macros = [
    {
      key: 'protein' as const,
      label: 'Protein',
      consumed: progress?.consumed.protein ?? 0,
      target: progress?.target.protein,
    },
    {
      key: 'carbs' as const,
      label: 'Carbs',
      consumed: progress?.consumed.carbs ?? 0,
      target: progress?.target.carbs,
    },
    {
      key: 'fat' as const,
      label: 'Fat',
      consumed: progress?.consumed.fat ?? 0,
      target: progress?.target.fat,
    },
  ];

  return (
    <Screen tabBarSpace padded={false} safeTop={false}>
      {/* —— Hero —— */}
      <View style={[styles.hero, { height: heroHeight + insets.top }]}>
        <Image
          source={HERO_IMAGE}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          contentPosition="top"
        />
        <LinearGradient
          colors={['rgba(8,12,16,0.35)', 'rgba(8,12,16,0.12)', 'rgba(14,17,20,0.88)']}
          locations={[0, 0.55, 1]}
          style={StyleSheet.absoluteFill}
        />

        <View style={[styles.heroTop, { paddingTop: insets.top + spacing.sm }]}>
          <View style={{ flex: 1, gap: 2 }}>
            <AppText variant="caption" style={{ color: 'rgba(242,244,247,0.85)' }}>
              {greeting},
            </AppText>
            <AppText
              variant="title"
              weight="700"
              display
              style={{ color: '#FFFFFF' }}
              numberOfLines={1}
            >
              {firstName}
            </AppText>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Open calendar"
            onPress={() => setCalendarOpen(true)}
            hitSlop={8}
            style={styles.bellBtn}
          >
            <Ionicons name="notifications-outline" size={22} color="#FFFFFF" />
            <View style={[styles.bellDot, { backgroundColor: colors.accent }]} />
          </Pressable>
        </View>

      </View>

      {/* Ring + Daily Goals — overlaps hero fade into the body (mockup 3). */}
      <View style={styles.overlayWrap}>
        <View
          style={[
            styles.overlayCard,
            {
              backgroundColor: resolved === 'dark' ? 'rgba(23,27,32,0.96)' : colors.surface,
              borderColor: colors.borderStrong,
            },
          ]}
        >
          <ProgressRing
            progress={target > 0 ? Math.min(Math.max(consumed / target, 0.02), 1) : 0.02}
            size={118}
            strokeWidth={11}
            accessibilityLabel={`Calories: ${Math.round(consumed)} of ${Math.round(target)}`}
          >
            <View style={{ alignItems: 'center', paddingHorizontal: 4 }}>
              <AppText variant="micro" tone={over ? 'danger' : 'muted'} align="center">
                {over ? 'Calories over' : 'Calories left'}
              </AppText>
              <AppText
                variant="heading"
                weight="700"
                display
                align="center"
                style={{ fontSize: 22, lineHeight: 26 }}
              >
                {Math.round(Math.abs(remaining)).toLocaleString()}
              </AppText>
              <AppText variant="micro" tone="muted">
                kcal
              </AppText>
            </View>
          </ProgressRing>

          <View style={styles.goalsCol}>
            <AppText variant="body" weight="600" display>
              Daily Goals
            </AppText>
            <GoalRow label="Calorie Goal" value={Math.round(target).toLocaleString()} />
            <GoalRow
              label="Protein Goal"
              value={`${Math.round(progress?.target.protein ?? 0).toLocaleString()} g`}
            />
            {burned > 0 ? (
              <GoalRow
                label="Exercise"
                value={`+${Math.round(burned).toLocaleString()}`}
                accent
              />
            ) : null}
          </View>
        </View>
      </View>

      <View style={styles.body}>
        {/* —— Macro photo cards —— */}
        <View style={styles.macroRow}>
          {macros.map((m) => {
            const pct =
              m.target && m.target > 0 ? Math.min(m.consumed / m.target, 1) : 0;
            return (
              <View key={m.key} style={styles.macroTile}>
                <Image
                  source={MACRO_IMAGES[m.key]}
                  style={StyleSheet.absoluteFill}
                  contentFit="cover"
                />
                <LinearGradient
                  colors={['rgba(10,12,16,0.55)', 'rgba(10,12,16,0.88)']}
                  style={StyleSheet.absoluteFill}
                />
                <View style={styles.macroIcon}>
                  <Ionicons name={MACRO_ICONS[m.key]} size={14} color="#FFFFFF" />
                </View>
                <AppText variant="caption" style={{ color: 'rgba(255,255,255,0.85)' }}>
                  {m.label}
                </AppText>
                <AppText variant="heading" weight="700" display style={{ color: '#FFFFFF' }}>
                  {Math.round(m.consumed)} g
                </AppText>
                <View style={styles.macroTrack}>
                  <View
                    style={[
                      styles.macroFill,
                      { width: `${pct * 100}%`, backgroundColor: colors.accent },
                    ]}
                  />
                </View>
                <AppText variant="micro" style={{ color: 'rgba(255,255,255,0.65)' }}>
                  / {Math.round(m.target ?? 0)} g
                </AppText>
              </View>
            );
          })}
        </View>

        {/* —— Meals —— */}
        <SectionHeader
          title="Meals"
          right={
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="View all diary entries"
              onPress={() => {
                setSelectedDate(date);
                router.push('/diary');
              }}
              style={{ minHeight: 44, justifyContent: 'center' }}
            >
              <AppText variant="caption" weight="600" style={{ color: colors.accent }}>
                View all ›
              </AppText>
            </Pressable>
          }
        />

        <View
          style={[
            styles.mealsCard,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
        >
          {(categories.data ?? []).map((cat, idx, arr) => {
            const kcal = Math.round(mealTotals.get(cat.id) ?? 0);
            const time = mealTimes.get(cat.id);
            const title = mealTitles.get(cat.id) ?? cat.name;
            const image = MEAL_IMAGES[cat.id] ?? MEAL_IMAGES.lunch;
            return (
              <Pressable
                key={cat.id}
                accessibilityRole="button"
                accessibilityLabel={`${title}, ${kcal} kcal`}
                onPress={() => {
                  setSelectedDate(date);
                  setTargetMeal(cat.id);
                  router.push(kcal > 0 ? '/diary' : '/add');
                }}
                style={[
                  styles.mealRow,
                  idx < arr.length - 1 && {
                    borderBottomWidth: StyleSheet.hairlineWidth,
                    borderBottomColor: colors.border,
                  },
                ]}
              >
                <Image source={image} style={styles.mealThumb} contentFit="cover" />
                <View style={styles.mealCopy}>
                  <AppText variant="body" weight="600" numberOfLines={1}>
                    {title}
                  </AppText>
                  <AppText variant="caption" tone="muted">
                    {kcal > 0 ? `${kcal.toLocaleString()} kcal` : 'Not logged'}
                  </AppText>
                </View>
                {time ? (
                  <AppText variant="caption" tone="muted" style={{ marginRight: 4 }}>
                    {time}
                  </AppText>
                ) : null}
                <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
              </Pressable>
            );
          })}
        </View>

        {/* —— Activity (below fold; keeps logging entry points) —— */}
        <SectionHeader
          title="Activity"
          right={
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Open activity tracking"
              onPress={() => router.push('/activity')}
              style={{ minHeight: 44, justifyContent: 'center' }}
            >
              <AppText variant="caption" weight="600" style={{ color: colors.accent }}>
                View all ›
              </AppText>
            </Pressable>
          }
        />
        <ActivityLogList
          burnedByType={burnedByType}
          onLog={(type) => {
            setSelectedDate(date);
            router.push({ pathname: '/activity', params: { type } });
          }}
          onOpenType={(type) => {
            setSelectedDate(date);
            router.push({ pathname: '/activity', params: { type } });
          }}
        />
      </View>

      <MonthCalendarPopup
        visible={calendarOpen}
        selected={date}
        top={insets.top + 56}
        onClose={() => setCalendarOpen(false)}
        onSelect={(d) => {
          setCalendarOpen(false);
          setSelectedDate(d);
        }}
      />
    </Screen>
  );
}

function GoalRow({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <View style={styles.goalRow}>
      <AppText variant="caption" tone="secondary">
        {label}
      </AppText>
      <AppText variant="caption" weight="600" tone={accent ? 'accent' : 'primary'}>
        {value}
      </AppText>
    </View>
  );
}

function formatEntryTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

const styles = StyleSheet.create({
  hero: {
    width: '100%',
    overflow: 'hidden',
  },
  heroTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: spacing.lg,
    zIndex: 2,
  },
  bellBtn: {
    width: touchTarget,
    height: touchTarget,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bellDot: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  overlayWrap: {
    // Light overlap only — keep the athlete photo open above the card.
    marginTop: -28,
    paddingHorizontal: spacing.lg,
    zIndex: 3,
  },
  overlayCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
    borderRadius: radius.xl,
    borderWidth: 1,
    padding: spacing.md,
  },
  goalsCol: {
    flex: 1,
    gap: 8,
    minWidth: 0,
  },
  goalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  body: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    gap: spacing.lg,
  },
  macroRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  macroTile: {
    flex: 1,
    borderRadius: radius.lg,
    overflow: 'hidden',
    padding: spacing.md,
    gap: 4,
    minHeight: 158,
    justifyContent: 'flex-end',
  },
  macroIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.85)',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.25)',
    marginBottom: 4,
  },
  macroTrack: {
    height: 5,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.2)',
    overflow: 'hidden',
    marginTop: 2,
  },
  macroFill: {
    height: '100%',
    borderRadius: 3,
  },
  mealsCard: {
    borderRadius: radius.lg,
    borderWidth: 1,
    overflow: 'hidden',
  },
  mealRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    gap: spacing.md,
    minHeight: 64,
  },
  mealThumb: {
    width: 48,
    height: 48,
    borderRadius: 24,
  },
  mealCopy: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
});
