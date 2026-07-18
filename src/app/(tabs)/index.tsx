import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Image, type ImageSource } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import React, { useMemo } from 'react';
import { Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  useActivityEntries,
  useDayProgress,
  useDiaryEntries,
  useMealCategories,
  useWeekProgress,
  useWeekStart,
} from '@/state/queries';
import { useUiStore } from '@/state/uiStore';
import { ActivityType } from '@/repositories/types';
import { DayKey, shortWeekdayLabel, todayKey, weekDays } from '@/utils/date';
import {
  ActivityLogList,
  AppText,
  BarEntranceProvider,
  ProgressRing,
  Screen,
  SectionHeader,
} from '@/ui/components';
import { useTheme } from '@/ui/theme/ThemeProvider';
import { radius, spacing, touchTarget } from '@/ui/theme/tokens';

const HERO_IMAGE = require('../../../assets/images/today/hero-stretch.jpg');

const MEAL_IMAGES: Record<string, ImageSource> = {
  breakfast: require('../../../assets/images/today/meal-breakfast.png'),
  lunch: require('../../../assets/images/today/meal-lunch.png'),
  dinner: require('../../../assets/images/today/meal-dinner.png'),
  snacks: require('../../../assets/images/today/meal-snacks.png'),
  snack: require('../../../assets/images/today/meal-snacks.png'),
};

/** Today — week cinema (mockup 6): week strip, stretch hero, ring+macros card, meal cards. */
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
  const weekStart = useWeekStart();
  const progress = useDayProgress(date);
  const week = useWeekProgress(date);
  const entries = useDiaryEntries(date);
  const activities = useActivityEntries(date);
  const categories = useMealCategories();

  const consumed = progress?.consumed.calories ?? 0;
  const target = progress?.target.calories ?? 0;
  const ringProgress = target > 0 ? Math.min(consumed / target, 1) : 0;

  const mealTotals = new Map<string, number>();
  for (const e of entries.data ?? []) {
    mealTotals.set(e.meal, (mealTotals.get(e.meal) ?? 0) + e.nutrition.calories);
  }

  const completedDays = useMemo(() => {
    const set = new Set<DayKey>();
    for (const d of week?.days ?? []) {
      if (d.consumed.calories > 0) set.add(d.date);
    }
    return set;
  }, [week]);

  const burnedByType = new Map<ActivityType, number>();
  for (const a of activities.data ?? []) {
    burnedByType.set(a.activityType, (burnedByType.get(a.activityType) ?? 0) + a.caloriesBurned);
  }

  const heroHeight = Math.round(Math.min(Math.max(windowHeight * 0.38, width * 0.85), 360));
  const cardBg = resolved === 'dark' ? 'rgba(23,27,32,0.96)' : colors.surface;

  const macros = [
    { key: 'protein', label: 'PROTEIN', value: progress?.consumed.protein ?? 0 },
    { key: 'carbs', label: 'CARBS', value: progress?.consumed.carbs ?? 0 },
    { key: 'fat', label: 'FAT', value: progress?.consumed.fat ?? 0 },
  ] as const;

  const weekKeys = weekDays(date, weekStart);

  return (
    <Screen tabBarSpace padded={false} safeTop={false}>
      {/* —— Hero + week strip —— */}
      <View style={[styles.hero, { height: heroHeight + insets.top }]}>
        <Image
          source={HERO_IMAGE}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          contentPosition="center"
        />
        <LinearGradient
          colors={['rgba(8,12,16,0.55)', 'rgba(8,12,16,0.15)', 'rgba(14,17,20,0.95)']}
          locations={[0, 0.45, 1]}
          style={StyleSheet.absoluteFill}
        />

        <View style={[styles.weekStrip, { paddingTop: insets.top + spacing.sm }]}>
          {weekKeys.map((d) => {
            const selected = d === date;
            const logged = completedDays.has(d);
            const dayNum = Number(d.slice(8));
            return (
              <Pressable
                key={d}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                accessibilityLabel={`${shortWeekdayLabel(d)} ${dayNum}`}
                onPress={() => {
                  void Haptics.selectionAsync();
                  setSelectedDate(d);
                }}
                style={styles.weekCell}
              >
                <AppText
                  variant="micro"
                  weight="600"
                  style={{
                    color: selected ? 'rgba(242,244,247,0.95)' : 'rgba(242,244,247,0.7)',
                    textTransform: 'uppercase',
                    fontSize: 10,
                    letterSpacing: 0.4,
                  }}
                >
                  {shortWeekdayLabel(d).slice(0, 3).toUpperCase()}
                </AppText>
                <View
                  style={[
                    styles.weekBubble,
                    selected && { backgroundColor: colors.accent },
                  ]}
                >
                  <AppText
                    variant="caption"
                    weight="700"
                    style={{ color: selected ? colors.onAccent : '#FFFFFF' }}
                  >
                    {dayNum}
                  </AppText>
                </View>
                <View
                  style={[
                    styles.weekDot,
                    {
                      backgroundColor: logged
                        ? colors.accent
                        : 'transparent',
                    },
                  ]}
                />
              </Pressable>
            );
          })}
        </View>
      </View>

      {/* Stats card — overlaps hero bottom */}
      <View style={styles.statsWrap}>
        <View
          style={[
            styles.statsCard,
            { backgroundColor: cardBg, borderColor: colors.borderStrong },
          ]}
        >
          <ProgressRing
            progress={Math.max(ringProgress, consumed > 0 ? 0.02 : 0)}
            size={108}
            strokeWidth={10}
            accessibilityLabel={`${Math.round(consumed)} of ${Math.round(target)} calories`}
          >
            <View style={{ alignItems: 'center', paddingHorizontal: 2 }}>
              <AppText
                variant="heading"
                weight="700"
                display
                align="center"
                style={{ fontSize: 18, lineHeight: 22 }}
              >
                {Math.round(consumed).toLocaleString()}
              </AppText>
              <AppText variant="micro" tone="muted" align="center">
                kcal
              </AppText>
              <AppText variant="micro" tone="muted" align="center">
                of {Math.round(target).toLocaleString()}
              </AppText>
            </View>
          </ProgressRing>

          <View style={styles.macroCols}>
            {macros.map((m, i) => (
              <React.Fragment key={m.key}>
                {i > 0 ? (
                  <View style={[styles.macroRule, { backgroundColor: colors.borderStrong }]} />
                ) : null}
                <View style={styles.macroCol}>
                  <AppText
                    variant="heading"
                    weight="700"
                    display
                    style={{ color: colors.accent, fontSize: 20, lineHeight: 24 }}
                  >
                    {Math.round(m.value)}g
                  </AppText>
                  <AppText variant="micro" tone="muted" style={styles.macroLabel}>
                    {m.label}
                  </AppText>
                </View>
              </React.Fragment>
            ))}
          </View>
        </View>
      </View>

      <View style={styles.body}>
        {/* Large meal cards (mockup shows Breakfast / Lunch; keep Dinner/Snacks for function) */}
        {(categories.data ?? []).map((cat) => {
          const kcal = Math.round(mealTotals.get(cat.id) ?? 0);
          const logged = kcal > 0;
          const image = MEAL_IMAGES[cat.id] ?? MEAL_IMAGES.lunch;
          return (
            <Pressable
              key={cat.id}
              accessibilityRole="button"
              accessibilityLabel={`${cat.name}. ${logged ? `${kcal} kcal logged` : 'Log meal'}`}
              onPress={() => {
                setSelectedDate(date);
                setTargetMeal(cat.id);
                router.push(logged ? '/diary' : '/add');
              }}
              style={styles.mealCard}
            >
              <Image source={image} style={StyleSheet.absoluteFill} contentFit="cover" />
              <LinearGradient
                colors={['rgba(8,12,16,0.72)', 'rgba(8,12,16,0.25)', 'rgba(8,12,16,0.55)']}
                start={{ x: 0, y: 0.5 }}
                end={{ x: 1, y: 0.5 }}
                style={StyleSheet.absoluteFill}
              />
              <View style={styles.mealCopy}>
                <AppText
                  variant="heading"
                  weight="700"
                  display
                  numberOfLines={1}
                  style={{ color: '#FFFFFF' }}
                >
                  {cat.name}
                </AppText>
                {logged ? (
                  <View style={styles.loggedRow}>
                    <AppText variant="caption" weight="600" style={{ color: colors.accent }}>
                      Logged
                    </AppText>
                    <Ionicons name="checkmark-circle" size={16} color={colors.accent} />
                  </View>
                ) : (
                  <View style={[styles.logPill, { borderColor: colors.accent }]}>
                    <AppText variant="caption" weight="600" style={{ color: colors.accent }}>
                      Log
                    </AppText>
                  </View>
                )}
              </View>
              <View
                style={[
                  styles.mealBadge,
                  {
                    backgroundColor: logged ? colors.accent : 'transparent',
                    borderColor: colors.accent,
                  },
                ]}
              >
                {logged ? (
                  <Ionicons name="checkmark" size={18} color={colors.onAccent} />
                ) : null}
              </View>
            </Pressable>
          );
        })}

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

        {date !== todayKey() ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Back to today"
            onPress={() => setSelectedDate(todayKey())}
            style={styles.backToday}
          >
            <AppText variant="caption" weight="600" tone="accent">
              Back to today
            </AppText>
          </Pressable>
        ) : null}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: {
    width: '100%',
    overflow: 'hidden',
  },
  weekStrip: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    zIndex: 3,
  },
  weekCell: {
    alignItems: 'center',
    gap: 4,
    minWidth: 36,
  },
  weekBubble: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  weekDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
  },
  statsWrap: {
    marginTop: -56,
    paddingHorizontal: spacing.lg,
    zIndex: 4,
  },
  statsCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    borderRadius: radius.xl,
    borderWidth: 1,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
  },
  macroCols: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    minWidth: 0,
  },
  macroCol: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
  },
  macroRule: {
    width: StyleSheet.hairlineWidth,
    alignSelf: 'stretch',
    marginVertical: spacing.sm,
  },
  macroLabel: {
    letterSpacing: 0.8,
    fontSize: 10,
  },
  body: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    gap: spacing.md,
  },
  mealCard: {
    height: 132,
    borderRadius: radius.xl,
    overflow: 'hidden',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  mealCopy: {
    gap: spacing.sm,
    maxWidth: '58%',
    zIndex: 2,
  },
  loggedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  logPill: {
    alignSelf: 'flex-start',
    borderWidth: 1.5,
    borderRadius: radius.full,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    backgroundColor: 'rgba(8,12,16,0.35)',
  },
  mealBadge: {
    position: 'absolute',
    right: spacing.lg,
    top: '50%',
    marginTop: -18,
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 2.5,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 3,
  },
  backToday: {
    alignSelf: 'center',
    minHeight: touchTarget,
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
  },
});
