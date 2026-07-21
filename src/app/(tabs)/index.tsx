import { Ionicons } from '@expo/vector-icons';
import { useQueryClient } from '@tanstack/react-query';
import { Image, type ImageSource } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
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
import { displayFirstName, greetingForHour } from '@/utils/greeting';
import { ActivityType } from '@/repositories/types';
import {
  DEFAULT_HERO_LEFT,
  DEFAULT_HERO_RIGHT,
  HERO_METRICS,
  isHeroMetricId,
  type HeroMetricId,
} from '@/data/heroMetrics';
import {
  ActivityLogList,
  AppText,
  BarEntranceProvider,
  Button,
  HeroMetricModule,
  ListRow,
  MonthCalendarPopup,
  Screen,
  SectionHeader,
  Sheet,
  TextField,
} from '@/ui/components';
import type { HeroMetricValues } from '@/ui/components/HeroMetricModule';
import { useTheme } from '@/ui/theme/ThemeProvider';
import { fonts, radius, spacing, touchTarget } from '@/ui/theme/tokens';

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

/** Today — hero greeting + dual configurable metric modules + photo macros + meals. */
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
  const waterGoal = useSetting<number>('waterGoalCups', 8);
  const stepGoal = useSetting<number>('stepGoal', 10000);
  const waterCups = useSetting<number>(`waterCups:${date}`, 0);
  const stepsToday = useSetting<number>(`stepsToday:${date}`, 0);
  const leftSetting = useSetting<string>('heroModuleLeft', DEFAULT_HERO_LEFT);
  const rightSetting = useSetting<string>('heroModuleRight', DEFAULT_HERO_RIGHT);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [nameOpen, setNameOpen] = useState(false);
  const [draftName, setDraftName] = useState('');
  const [pickerSlot, setPickerSlot] = useState<'left' | 'right' | null>(null);

  const greeting = useMemo(() => greetingForHour(), []);
  const firstName = displayFirstName(displayName.data);

  const leftMetric: HeroMetricId = isHeroMetricId(leftSetting.data)
    ? leftSetting.data
    : DEFAULT_HERO_LEFT;
  const rightMetric: HeroMetricId = isHeroMetricId(rightSetting.data)
    ? rightSetting.data
    : DEFAULT_HERO_RIGHT;

  const consumed = progress?.consumed.calories ?? 0;
  const burned = progress?.burned ?? 0;
  const target = progress?.target.calories ?? 0;
  const remaining = progress?.caloriesRemaining ?? target - consumed;
  const over = remaining < 0;

  // Equal modules fill the content row: edge inset lg, fixed md gutter between cards.
  const moduleSize = Math.floor((width - spacing.lg * 2 - spacing.md) / 2);

  function valuesFor(metric: HeroMetricId): HeroMetricValues {
    switch (metric) {
      case 'calories':
        return {
          value: Math.abs(remaining),
          target,
          progress: target > 0 ? Math.min(Math.max(consumed / target, 0.02), 1) : 0.02,
          over,
        };
      case 'protein':
        return {
          value: progress?.consumed.protein ?? 0,
          target: progress?.target.protein ?? 0,
        };
      case 'carbs':
        return {
          value: progress?.consumed.carbs ?? 0,
          target: progress?.target.carbs ?? 0,
        };
      case 'fat':
        return {
          value: progress?.consumed.fat ?? 0,
          target: progress?.target.fat ?? 0,
        };
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
    const key = slot === 'left' ? 'heroModuleLeft' : 'heroModuleRight';
    await settings.set(key, id);
    qc.invalidateQueries({ queryKey: keys.setting(key) });
    setPickerSlot(null);
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

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Open calendar"
          onPress={() => setCalendarOpen(true)}
          hitSlop={8}
          style={[styles.bellBtn, { top: insets.top + spacing.sm }]}
        >
          <Ionicons name="notifications-outline" size={22} color="#FFFFFF" />
          <View style={[styles.bellDot, { backgroundColor: colors.accent }]} />
        </Pressable>

        {/* Greeting + dual metric modules (Daily Goals removed). */}
        <View style={styles.heroBottom}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={
              firstName ? `Greeting for ${firstName}. Tap to edit name.` : 'Tap to set your name'
            }
            onPress={() => {
              setDraftName((displayName.data ?? '').trim());
              setNameOpen(true);
            }}
            style={styles.greetingBlock}
          >
            <AppText style={styles.greetingLine}>{greeting},</AppText>
            <AppText
              style={[styles.nameLine, !firstName && styles.namePlaceholder]}
              numberOfLines={1}
            >
              {firstName ?? 'Your name'}
            </AppText>
          </Pressable>

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

      <Sheet visible={nameOpen} onClose={() => setNameOpen(false)} title="Your name">
        <TextField
          label="What should we call you?"
          value={draftName}
          onChangeText={setDraftName}
          placeholder="First name"
          autoCapitalize="words"
          autoCorrect={false}
          autoFocus
        />
        <Button
          title="Save"
          onPress={async () => {
            await settings.set('displayName', draftName.trim());
            qc.invalidateQueries({ queryKey: keys.setting('displayName') });
            setNameOpen(false);
          }}
        />
      </Sheet>

      <Sheet
        visible={pickerSlot !== null}
        onClose={() => setPickerSlot(null)}
        title={
          pickerSlot
            ? `Show on ${pickerSlot === 'left' ? 'left' : 'right'} module`
            : 'Choose metric'
        }
      >
        <AppText variant="caption" tone="secondary" style={{ marginBottom: spacing.md }}>
          Each module uses a layout optimized for that metric — rings, bars, cups, and stride
          meters are intentional, not required to match.
        </AppText>
        {HERO_METRICS.map((m) => {
          const selected =
            pickerSlot === 'left' ? m.id === leftMetric : m.id === rightMetric;
          const usedElsewhere =
            pickerSlot === 'left' ? m.id === rightMetric : m.id === leftMetric;
          return (
            <ListRow
              key={m.id}
              title={m.label}
              subtitle={usedElsewhere ? `${m.subtitle} · on other module` : m.subtitle}
              selected={selected}
              left={<Ionicons name={m.icon} size={20} color={colors.textSecondary} />}
              onPress={() => {
                if (!pickerSlot) return;
                void setModuleMetric(pickerSlot, m.id);
              }}
            />
          );
        })}
      </Sheet>

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
  bellBtn: {
    position: 'absolute',
    right: spacing.md,
    width: touchTarget,
    height: touchTarget,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 4,
  },
  bellDot: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  heroBottom: {
    paddingHorizontal: spacing.lg,
    // Lift the greeting + modules 15px toward the top of the hero.
    paddingBottom: spacing.md + 15,
    zIndex: 3,
    gap: spacing.md,
  },
  greetingBlock: {
    gap: 2,
    marginLeft: 0,
    paddingLeft: 0,
    alignSelf: 'flex-start',
  },
  greetingLine: {
    color: 'rgba(242,244,247,0.92)',
    fontFamily: fonts.displayMedium,
    fontSize: 26,
    lineHeight: 32,
    fontWeight: '500',
    marginLeft: 0,
    paddingLeft: 0,
    includeFontPadding: false,
  },
  nameLine: {
    color: '#FFFFFF',
    fontFamily: fonts.display,
    fontSize: 30,
    lineHeight: 36,
    fontWeight: '700',
    letterSpacing: -0.4,
    marginLeft: 0,
    paddingLeft: 0,
    includeFontPadding: false,
  },
  namePlaceholder: {
    color: 'rgba(242,244,247,0.55)',
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
