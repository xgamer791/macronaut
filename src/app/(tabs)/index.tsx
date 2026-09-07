import { Ionicons } from '@expo/vector-icons';
import { useQueryClient } from '@tanstack/react-query';
import { Image, type ImageSource } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';
import { useRepos } from '@/state/AppProvider';
import {
  keys,
  useActivityEntries,
  useDayProgress,
  useDiaryEntries,
  useMealCategories,
  useSetting,
} from '@/state/queries';
import { useUiStore } from '@/state/uiStore';
import { ActivityType } from '@/repositories/types';
import {
  DEFAULT_HERO_LEFT,
  DEFAULT_HERO_RIGHT,
  isHeroMetricId,
  type HeroMetricId,
} from '@/data/heroMetrics';
import {
  ActivityLogList,
  AppHeader,
  AppText,
  BarEntranceProvider,
  GlassHeaderBar,
  HeroMetricModule,
  HeroMetricPicker,
  Screen,
  SectionHeader,
  ToolLauncher,
} from '@/ui/components';
import type { HeroMetricValues } from '@/ui/components/HeroMetricModule';
import { useTheme } from '@/ui/theme/ThemeProvider';
import { radius, spacing } from '@/ui/theme/tokens';

const HERO_IMAGE = require('../../../assets/images/today/hero-gym.jpg');
/** Rows in the hero photo, and the empty ceiling it opens on above the runner. */
const HERO_ROWS = 640;
const HERO_CEILING_ROWS = 40;

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

/** Today — dual configurable metric modules + photo macros + meals. */
export default function TodayScreen() {
  return (
    <BarEntranceProvider pageKey="today">
      <TodayBody />
    </BarEntranceProvider>
  );
}

function TodayBody() {
  const router = useRouter();
  const qc = useQueryClient();
  const { settings } = useRepos();
  const { colors } = useTheme();
  const { width, height: windowHeight } = useWindowDimensions();
  const date = useUiStore((s) => s.selectedDate);
  const setSelectedDate = useUiStore((s) => s.setSelectedDate);
  const setTargetMeal = useUiStore((s) => s.setTargetMeal);
  const progress = useDayProgress(date);
  const entries = useDiaryEntries(date);
  const activities = useActivityEntries(date);
  const categories = useMealCategories();
  const waterGoal = useSetting<number>('waterGoalCups', 8);
  const stepGoal = useSetting<number>('stepGoal', 10000);
  const waterCups = useSetting<number>(`waterCups:${date}`, 0);
  const stepsToday = useSetting<number>(`stepsToday:${date}`, 0);
  const leftSetting = useSetting<string>('heroModuleLeft', DEFAULT_HERO_LEFT);
  const rightSetting = useSetting<string>('heroModuleRight', DEFAULT_HERO_RIGHT);
  const [pickerSlot, setPickerSlot] = useState<'left' | 'right' | null>(null);

  const leftMetric: HeroMetricId = isHeroMetricId(leftSetting.data)
    ? leftSetting.data
    : DEFAULT_HERO_LEFT;
  const rightMetric: HeroMetricId = isHeroMetricId(rightSetting.data)
    ? rightSetting.data
    : DEFAULT_HERO_RIGHT;

  const consumed = progress?.consumed.calories ?? 0;
  const burned = progress?.burned ?? 0;
  const target = progress?.target.calories ?? 0;

  // Equal modules fill the content row: edge inset lg, fixed md gutter between cards.
  const moduleSize = Math.floor((width - spacing.lg * 2 - spacing.md) / 2);

  function ringValues(consumedAmt: number, targetAmt: number): HeroMetricValues {
    const left = targetAmt - consumedAmt;
    return {
      value: Math.abs(left),
      target: targetAmt,
      progress: targetAmt > 0 ? Math.min(Math.max(consumedAmt / targetAmt, 0.02), 1) : 0.02,
      over: left < 0,
    };
  }

  function valuesFor(metric: HeroMetricId): HeroMetricValues {
    switch (metric) {
      case 'calories':
        return ringValues(consumed, target);
      case 'protein':
        return ringValues(progress?.consumed.protein ?? 0, progress?.target.protein ?? 0);
      case 'carbs':
        return ringValues(progress?.consumed.carbs ?? 0, progress?.target.carbs ?? 0);
      case 'fat':
        return ringValues(progress?.consumed.fat ?? 0, progress?.target.fat ?? 0);
      case 'fiber':
        return {
          value: progress?.consumed.fiber ?? 0,
          target: progress?.target.fiber ?? 0,
        };
      case 'water':
        return {
          value: waterCups.data ?? 0,
          target: waterGoal.data ?? 8,
        };
      case 'steps':
        return {
          value: stepsToday.data ?? 0,
          target: stepGoal.data ?? 10000,
        };
      case 'burned':
        return {
          value: burned,
          detail: burned > 0 ? 'From logged activity' : 'Log activity below',
        };
      default:
        return { value: 0 };
    }
  }

  async function setModuleMetric(slot: 'left' | 'right', id: HeroMetricId) {
    const current = slot === 'left' ? leftMetric : rightMetric;
    setPickerSlot(null);
    if (id === current) return;
    const key = slot === 'left' ? 'heroModuleLeft' : 'heroModuleRight';
    await settings.set(key, id);
    qc.invalidateQueries({ queryKey: keys.setting(key) });
  }

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
  const heroHeight = Math.round(Math.min(Math.max(windowHeight * 0.42, width * 0.95), 420));
  // The header is opaque, so the photo's empty ceiling reads as a gap beneath it
  // rather than as picture. Drawing the image this much taller than the hero and
  // pulling it up by the same amount crops the ceiling away, so the runner starts
  // at the header. Solved from the hero height so the framing holds at any size.
  const heroLift = Math.round((heroHeight * HERO_CEILING_ROWS) / (HERO_ROWS - HERO_CEILING_ROWS));
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
    <Screen
      tabBarSpace
      padded={false}
      safeTop={false}
      stickyHeader={
        <GlassHeaderBar>
          <AppHeader />
        </GlassHeaderBar>
      }
      floatingOverlay={<ToolLauncher />}
    >
      {/* —— Hero —— */}
      <View style={[styles.hero, { height: heroHeight }]}>
        <Image
          source={HERO_IMAGE}
          style={[styles.heroImage, { top: -heroLift, height: heroHeight + heroLift }]}
          contentFit="cover"
          contentPosition="top"
        />
        <LinearGradient
          colors={['rgba(8,12,16,0.62)', 'rgba(8,12,16,0.18)', 'rgba(14,17,20,0.88)']}
          locations={[0, 0.5, 1]}
          style={StyleSheet.absoluteFill}
        />

        <View style={styles.heroBottom}>
          <View style={styles.modulesRow}>
            <HeroMetricModule
              metric={leftMetric}
              values={valuesFor(leftMetric)}
              size={moduleSize}
              onPress={() => setPickerSlot('left')}
            />
            <HeroMetricModule
              metric={rightMetric}
              values={valuesFor(rightMetric)}
              size={moduleSize}
              onPress={() => setPickerSlot('right')}
            />
          </View>
        </View>
      </View>

      <HeroMetricPicker
        slot={pickerSlot}
        selected={pickerSlot === 'left' ? leftMetric : rightMetric}
        other={pickerSlot === 'left' ? rightMetric : leftMetric}
        onClose={() => setPickerSlot(null)}
        onSelect={(metric) => {
          if (!pickerSlot) return;
          void setModuleMetric(pickerSlot, metric);
        }}
      />

      <View style={styles.body}>
        {/* —— Macro photo cards —— */}
        <View style={styles.macroRow}>
          {macros.map((m) => {
            const pct = m.target && m.target > 0 ? Math.min(m.consumed / m.target, 1) : 0;
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
                  <Ionicons
                    name={MACRO_ICONS[m.key]}
                    size={18}
                    color="#FFFFFF"
                    style={styles.macroIconGlyph}
                  />
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
              accessibilityLabel="Browse curated meals"
              onPress={() => {
                setSelectedDate(date);
                router.push('/meals');
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
                  router.push(kcal > 0 ? '/day-detail' : '/add');
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
    </Screen>
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
    justifyContent: 'flex-end',
  },
  heroImage: {
    position: 'absolute',
    left: 0,
    right: 0,
  },
  heroBottom: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md + 15,
    zIndex: 3,
    gap: spacing.md,
  },
  modulesRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    justifyContent: 'flex-start',
    gap: spacing.md,
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
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  // The glyph sits straight on the hero photo, so it carries its own shadow.
  macroIconGlyph: {
    textShadowColor: 'rgba(0,0,0,0.7)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
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
