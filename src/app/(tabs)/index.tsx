import { Ionicons } from '@expo/vector-icons';
import { useQueryClient } from '@tanstack/react-query';
import { Image, type ImageSource } from 'expo-image';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';
import { useRepos } from '@/state/AppProvider';
import {
  keys,
  useActivityEntries,
  useDayProgress,
  useDiaryEntries,
  useFastingState,
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
import { HERO_GAP_BELOW_HEADER, TODAY_SECTION_GAP } from '@/ui/components/todayHeroLayout';

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

/** Today — dual configurable metric modules + macros + meals. */
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
  const { width } = useWindowDimensions();
  const date = useUiStore((s) => s.selectedDate);
  const setSelectedDate = useUiStore((s) => s.setSelectedDate);
  const setTargetMeal = useUiStore((s) => s.setTargetMeal);
  const progress = useDayProgress(date);
  const entries = useDiaryEntries(date);
  const activities = useActivityEntries(date);
  const fasting = useFastingState();
  const categories = useMealCategories();
  const waterGoal = useSetting<number>('waterGoalCups', 8);
  const stepGoal = useSetting<number>('stepGoal', 10000);
  const waterCups = useSetting<number>(`waterCups:${date}`, 0);
  const stepsToday = useSetting<number>(`stepsToday:${date}`, 0);
  const leftSetting = useSetting<string>('heroModuleLeft', DEFAULT_HERO_LEFT);
  const rightSetting = useSetting<string>('heroModuleRight', DEFAULT_HERO_RIGHT);
  const [pickerSlot, setPickerSlot] = useState<'left' | 'right' | null>(null);
  const [fastingNow, setFastingNow] = useState(() => Date.now());

  const leftMetric: HeroMetricId = isHeroMetricId(leftSetting.data)
    ? leftSetting.data
    : DEFAULT_HERO_LEFT;
  const rightMetric: HeroMetricId = isHeroMetricId(rightSetting.data)
    ? rightSetting.data
    : DEFAULT_HERO_RIGHT;

  const consumed = progress?.consumed.calories ?? 0;
  const burned = progress?.burned ?? 0;
  const target = progress?.target.calories ?? 0;
  const fastStartAt = fasting.data?.activeStartAt ?? null;
  const fastEndAt = fasting.data?.activeEndAt ?? null;

  useEffect(() => {
    if (fastStartAt === null || fastEndAt === null) return;
    const refresh = () => setFastingNow(Date.now());
    const immediate = setTimeout(refresh, 0);
    const timer = setInterval(refresh, 30_000);
    return () => {
      clearTimeout(immediate);
      clearInterval(timer);
    };
  }, [fastEndAt, fastStartAt]);

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
      case 'fasting': {
        if (fastStartAt === null || fastEndAt === null) {
          return { value: 0, target: 0, progress: 0, detail: 'Ready to start' };
        }
        const durationMinutes = Math.max(1, Math.round((fastEndAt - fastStartAt) / 60_000));
        if (fastingNow >= fastEndAt) {
          return { value: 0, target: durationMinutes, progress: 1, detail: 'Fast complete' };
        }
        const remainingMinutes = Math.max(1, Math.ceil((fastEndAt - fastingNow) / 60_000));
        return {
          value: remainingMinutes,
          target: durationMinutes,
          progress: Math.min(
            1,
            Math.max(0, (fastingNow - fastStartAt) / (fastEndAt - fastStartAt)),
          ),
          detail: 'Fasting now',
        };
      }
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
      <View style={styles.hero}>
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
        left={leftMetric}
        right={rightMetric}
        onClose={() => setPickerSlot(null)}
        onSelect={(metric) => {
          if (!pickerSlot) return;
          void setModuleMetric(pickerSlot, metric);
        }}
      />

      <View style={styles.body}>
        {/* —— Macro cards —— */}
        <View style={styles.macroRow}>
          {macros.map((m) => {
            const pct = m.target && m.target > 0 ? Math.min(m.consumed / m.target, 1) : 0;
            const hue = colors[m.key];
            return (
              <View
                key={m.key}
                style={[
                  styles.macroTile,
                  { backgroundColor: colors.surface, borderColor: colors.borderStrong },
                ]}
              >
                <View style={styles.macroIcon}>
                  <Ionicons name={MACRO_ICONS[m.key]} size={18} color={hue} />
                </View>
                <AppText variant="caption" tone="secondary">
                  {m.label}
                </AppText>
                <AppText variant="heading" weight="700" display>
                  {Math.round(m.consumed)} g
                </AppText>
                <View style={[styles.macroTrack, { backgroundColor: colors.track }]}>
                  <View
                    style={[styles.macroFill, { width: `${pct * 100}%`, backgroundColor: hue }]}
                  />
                </View>
                <AppText variant="micro" tone="muted">
                  / {Math.round(m.target ?? 0)} g
                </AppText>
              </View>
            );
          })}
        </View>

        {/* —— Meals —— */}
        <View style={styles.section}>
          <SectionHeader flush title="Meals" />

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
                  <Ionicons name="add" size={22} color={colors.accent} />
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* —— Activity (below fold; keeps logging entry points) —— */}
        <View style={styles.section}>
          <SectionHeader
            flush
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
  },
  heroBottom: {
    paddingHorizontal: spacing.lg,
    paddingTop: HERO_GAP_BELOW_HEADER,
    paddingBottom: TODAY_SECTION_GAP,
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
    paddingTop: 0,
    gap: TODAY_SECTION_GAP,
  },
  section: {
    gap: spacing.sm,
  },
  macroRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  macroTile: {
    flex: 1,
    borderRadius: radius.lg,
    borderWidth: 1,
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
  macroTrack: {
    height: 5,
    borderRadius: 3,
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
