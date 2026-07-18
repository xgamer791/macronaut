import { Ionicons } from '@expo/vector-icons';
import { Image, type ImageSource } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { GoalConfig, resolveTargetForDate } from '@/domain/goals';
import { WeekStart } from '@/domain/types';
import {
  useActivityRange,
  useDayTypeMarks,
  useDiaryRange,
  useGoalConfigs,
  useWeekStart,
} from '@/state/queries';
import { ActivityEntry, DiaryEntry } from '@/repositories/types';
import {
  addDays,
  DayKey,
  rangeDays,
  shortWeekdayLabel,
  todayKey,
  weekDays,
} from '@/utils/date';
import {
  AppText,
  Card,
  EmptyState,
  LineChart,
  MonthCalendarPopup,
  Screen,
} from '@/ui/components';
import { useTheme } from '@/ui/theme/ThemeProvider';
import { radius, spacing, touchTarget } from '@/ui/theme/tokens';

type Range = '7' | '30' | '90' | '365' | 'all';
type MosaicMacro = 'protein' | 'carbs' | 'fat' | 'fiber';

const RANGE_OPTIONS: { value: Range; label: string }[] = [
  { value: '7', label: '7D' },
  { value: '30', label: '30D' },
  { value: '90', label: '3M' },
  { value: '365', label: '1Y' },
  { value: 'all', label: 'All' },
];

const MACRO_KCAL: Record<MosaicMacro, number> = {
  protein: 4,
  carbs: 4,
  fat: 9,
  fiber: 4,
};

const MACRO_TILES: {
  key: MosaicMacro;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  image: ImageSource;
}[] = [
  {
    key: 'protein',
    label: 'Protein',
    icon: 'nutrition-outline',
    image: require('../../../assets/images/progress/macro-protein.png'),
  },
  {
    key: 'carbs',
    label: 'Carbs',
    icon: 'leaf-outline',
    image: require('../../../assets/images/progress/macro-carbs.png'),
  },
  {
    key: 'fat',
    label: 'Fat',
    icon: 'water-outline',
    image: require('../../../assets/images/progress/macro-fat.png'),
  },
  {
    key: 'fiber',
    label: 'Fiber',
    icon: 'flower-outline',
    image: require('../../../assets/images/progress/macro-fiber.png'),
  },
];

/** Progress — macro mosaic + net kcal line chart (mockup 2). */
export default function ProgressScreen() {
  return <ProgressBody />;
}

function ProgressBody() {
  const router = useRouter();
  const { colors } = useTheme();
  const weekStart = useWeekStart();
  const [range, setRange] = useState<Range>('7');
  const [calendarOpen, setCalendarOpen] = useState(false);

  const today = todayKey();
  const from =
    range === 'all'
      ? addDays(today, -729)
      : addDays(today, -(Number(range) - 1));
  const to = today;

  const entries = useDiaryRange(from, to);
  const activities = useActivityRange(from, to);
  const configs = useGoalConfigs();
  const marks = useDayTypeMarks();

  const stats = useMemo(() => {
    if (!entries.data || !activities.data || !configs.data || configs.data.length === 0 || !marks.data)
      return null;
    return computeProgress(
      rangeDays(from, to),
      entries.data,
      activities.data,
      configs.data,
      marks.data,
      today,
      weekStart,
    );
  }, [entries.data, activities.data, configs.data, marks.data, from, to, today, weekStart]);

  const anyLogged = (stats?.daysLogged ?? 0) > 0;

  return (
    <Screen tabBarSpace>
      <View style={styles.headerRow}>
        <AppText variant="title" weight="600" display style={{ flex: 1 }}>
          Progress
        </AppText>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Open calendar"
          onPress={() => setCalendarOpen(true)}
          hitSlop={8}
          style={styles.calBtn}
        >
          <Ionicons name="calendar-outline" size={22} color={colors.accent} />
        </Pressable>
      </View>

      <View style={styles.rangeRow}>
        {RANGE_OPTIONS.map((opt) => {
          const selected = range === opt.value;
          return (
            <Pressable
              key={opt.value}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              accessibilityLabel={opt.label}
              onPress={() => setRange(opt.value)}
              style={[
                styles.rangePill,
                {
                  backgroundColor: selected ? colors.accent : colors.surface,
                  borderColor: selected ? colors.accent : colors.borderStrong,
                },
              ]}
            >
              <AppText
                variant="caption"
                weight={selected ? '600' : '500'}
                style={{ color: selected ? colors.onAccent : colors.textSecondary }}
              >
                {opt.label}
              </AppText>
            </Pressable>
          );
        })}
      </View>

      {!stats ? (
        <AppText variant="caption" tone="muted" align="center">
          Loading…
        </AppText>
      ) : !anyLogged ? (
        <EmptyState
          title="No data in this period"
          body="Log food or workouts and your trends will appear here."
        />
      ) : (
        <>
          <View style={styles.mosaic}>
            {MACRO_TILES.map((tile) => {
              const grams = stats.macroTotals[tile.key];
              const kcal = Math.round(grams * MACRO_KCAL[tile.key]);
              return (
                <Pressable
                  key={tile.key}
                  accessibilityRole="button"
                  accessibilityLabel={`${tile.label}: ${kcal} kcal, ${Math.round(grams)} grams`}
                  style={styles.mosaicTile}
                >
                  <Image source={tile.image} style={StyleSheet.absoluteFill} contentFit="cover" />
                  <LinearGradient
                    colors={['rgba(0,0,0,0.15)', 'rgba(8,12,16,0.82)']}
                    style={StyleSheet.absoluteFill}
                  />
                  <View style={styles.mosaicIcon}>
                    <Ionicons name={tile.icon} size={16} color="#FFFFFF" />
                  </View>
                  <View style={styles.mosaicCopy}>
                    <AppText variant="body" weight="600" style={{ color: '#FFFFFF' }}>
                      {tile.label}
                    </AppText>
                    <AppText
                      variant="caption"
                      weight="600"
                      style={{ color: colors.accent }}
                      numberOfLines={1}
                    >
                      {kcal.toLocaleString()} kcal / {Math.round(grams).toLocaleString()} g
                    </AppText>
                  </View>
                </Pressable>
              );
            })}
          </View>

          <Card style={styles.chartCard}>
            <View style={styles.sectionHead}>
              <View style={styles.sectionTitleRow}>
                <AppText variant="body" weight="600">
                  Net kcal
                </AppText>
                <Ionicons
                  name="information-circle-outline"
                  size={16}
                  color={colors.textMuted}
                  style={{ marginLeft: 4 }}
                />
              </View>
              <AppText variant="caption" weight="600" style={{ color: colors.accent }}>
                {Math.round(stats.averageNet).toLocaleString()} kcal avg
              </AppText>
            </View>
            <LineChart
              data={stats.line}
              accessibilityLabel={`Net calories from ${from} to ${to}`}
              labelEvery={stats.line.length > 10 ? Math.ceil(stats.line.length / 7) : 1}
            />
          </Card>

          <Card padded={false} style={styles.weekCard}>
            <View style={[styles.sectionHead, styles.weekHead]}>
              <AppText variant="body" weight="600">
                This Week
              </AppText>
              <AppText variant="caption" weight="600" style={{ color: colors.accent }}>
                Avg {Math.round(stats.weekAverageNet).toLocaleString()} kcal
              </AppText>
            </View>

            <View style={[styles.weekColHeader, { borderBottomColor: colors.border }]}>
              <AppText variant="micro" tone="muted" style={styles.weekDayCol}>
                Day
              </AppText>
              <AppText variant="micro" tone="muted" style={styles.weekKcalCol}>
                kcal
              </AppText>
              <AppText variant="micro" tone="muted" style={styles.weekMacroCol}>
                P
              </AppText>
              <AppText variant="micro" tone="muted" style={styles.weekMacroCol}>
                C
              </AppText>
              <AppText variant="micro" tone="muted" style={styles.weekMacroCol}>
                F
              </AppText>
              <AppText variant="micro" tone="muted" style={styles.weekMacroCol}>
                Fi
              </AppText>
              <View style={styles.weekChevronCol} />
            </View>

            {stats.weekRows.map((row, idx) => (
              <Pressable
                key={row.key}
                accessibilityRole="button"
                accessibilityLabel={`${row.label}, ${Math.round(row.net)} kcal`}
                onPress={() =>
                  router.push({ pathname: '/day-detail', params: { date: row.key } })
                }
                style={[
                  styles.weekRow,
                  idx < stats.weekRows.length - 1 && {
                    borderBottomWidth: StyleSheet.hairlineWidth,
                    borderBottomColor: colors.border,
                  },
                ]}
              >
                <View style={[styles.weekDayCol, styles.weekDayCell]}>
                  <View
                    style={[
                      styles.statusDot,
                      { backgroundColor: row.over ? colors.danger : colors.accent },
                    ]}
                  />
                  <AppText variant="caption" weight="600" numberOfLines={1}>
                    {row.label}
                  </AppText>
                </View>
                <AppText
                  variant="caption"
                  weight="600"
                  style={[
                    styles.weekKcalCol,
                    { color: row.over ? colors.danger : colors.textPrimary },
                  ]}
                  numberOfLines={1}
                >
                  {Math.round(row.net).toLocaleString()}
                </AppText>
                <AppText variant="micro" tone="secondary" style={styles.weekMacroCol}>
                  {Math.round(row.protein)}
                </AppText>
                <AppText variant="micro" tone="secondary" style={styles.weekMacroCol}>
                  {Math.round(row.carbs)}
                </AppText>
                <AppText variant="micro" tone="secondary" style={styles.weekMacroCol}>
                  {Math.round(row.fat)}
                </AppText>
                <AppText variant="micro" tone="secondary" style={styles.weekMacroCol}>
                  {Math.round(row.fiber)}
                </AppText>
                <View style={styles.weekChevronCol}>
                  <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
                </View>
              </Pressable>
            ))}
          </Card>
        </>
      )}

      <MonthCalendarPopup
        visible={calendarOpen}
        selected={today}
        top={72}
        onClose={() => setCalendarOpen(false)}
        onSelect={(d) => {
          setCalendarOpen(false);
          router.push({ pathname: '/day-detail', params: { date: d } });
        }}
      />
    </Screen>
  );
}

interface DayRow {
  key: DayKey;
  label: string;
  net: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
  goal?: number;
  over: boolean;
}

interface ProgressStats {
  daysLogged: number;
  averageNet: number;
  weekAverageNet: number;
  macroTotals: Record<MosaicMacro, number>;
  line: {
    key: string;
    label: string;
    value: number;
    goal?: number;
    detail?: string;
    over?: boolean;
  }[];
  weekRows: DayRow[];
}

function computeProgress(
  days: DayKey[],
  entries: DiaryEntry[],
  activities: ActivityEntry[],
  configs: GoalConfig[],
  marks: Record<string, 'training' | 'rest'>,
  today: DayKey,
  weekStart: WeekStart,
): ProgressStats {
  const byDay = new Map<DayKey, DiaryEntry[]>();
  for (const e of entries) {
    const list = byDay.get(e.date) ?? [];
    list.push(e);
    byDay.set(e.date, list);
  }
  const burnByDay = new Map<DayKey, number>();
  for (const a of activities) {
    burnByDay.set(a.date, (burnByDay.get(a.date) ?? 0) + a.caloriesBurned);
  }

  const configFor = (date: DayKey) => {
    let chosen = configs[0];
    for (const c of configs) if (c.effectiveFrom <= date) chosen = c;
    return chosen;
  };

  const macrosFor = (list: DiaryEntry[]) => {
    const out = { protein: 0, carbs: 0, fat: 0, fiber: 0 };
    for (const e of list) {
      out.protein += e.nutrition.protein ?? 0;
      out.carbs += e.nutrition.carbs ?? 0;
      out.fat += e.nutrition.fat ?? 0;
      out.fiber += e.nutrition.fiber ?? 0;
    }
    return out;
  };

  const foodKcal = (list: DiaryEntry[]) =>
    list.reduce((sum, e) => sum + e.nutrition.calories, 0);

  const macroTotals = { protein: 0, carbs: 0, fat: 0, fiber: 0 };
  let netSum = 0;
  let logged = 0;
  const line: ProgressStats['line'] = [];

  for (const d of days) {
    const list = byDay.get(d) ?? [];
    const burned = burnByDay.get(d) ?? 0;
    const food = foodKcal(list);
    const net = food - burned;
    const m = macrosFor(list);
    macroTotals.protein += m.protein;
    macroTotals.carbs += m.carbs;
    macroTotals.fat += m.fat;
    macroTotals.fiber += m.fiber;

    const target = resolveTargetForDate(d, configFor(d), marks);
    const goal = target.calories > 0 ? target.calories : undefined;
    const over = goal !== undefined && net > goal;
    const hasLog = list.length > 0 || burned > 0;

    line.push({
      key: d,
      label: days.length <= 7 ? shortWeekdayLabel(d) : shortWeekdayLabel(d).slice(0, 1),
      value: Math.max(0, net),
      goal,
      over,
      detail: hasLog
        ? `Food ${Math.round(food)} · burned ${Math.round(burned)} · net ${Math.round(net)}`
        : 'Nothing logged',
    });

    if (hasLog) {
      netSum += net;
      logged++;
    }
  }

  const week = weekDays(today, weekStart);
  const weekRows: DayRow[] = [...week]
    .reverse()
    .map((d) => {
      const list = byDay.get(d) ?? [];
      const burned = burnByDay.get(d) ?? 0;
      const food = foodKcal(list);
      const net = food - burned;
      const m = macrosFor(list);
      const target = resolveTargetForDate(d, configFor(d), marks);
      const goal = target.calories > 0 ? target.calories : undefined;
      const over = goal !== undefined && (list.length > 0 || burned > 0) && net > goal;
      return {
        key: d,
        label: d === today ? 'Today' : shortWeekdayLabel(d),
        net,
        protein: m.protein,
        carbs: m.carbs,
        fat: m.fat,
        fiber: m.fiber,
        goal,
        over,
      };
    });

  const weekLogged = weekRows.filter((r) => {
    const list = byDay.get(r.key) ?? [];
    return list.length > 0 || (burnByDay.get(r.key) ?? 0) > 0;
  });
  const weekAverageNet =
    weekLogged.length > 0
      ? weekLogged.reduce((s, r) => s + r.net, 0) / weekLogged.length
      : 0;

  return {
    daysLogged: logged,
    averageNet: logged > 0 ? netSum / logged : 0,
    weekAverageNet,
    macroTotals,
    line,
    weekRows,
  };
}

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: touchTarget,
  },
  calBtn: {
    width: touchTarget,
    height: touchTarget,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rangeRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  rangePill: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    borderRadius: radius.full,
    borderWidth: 1,
    minHeight: 34,
  },
  mosaic: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  mosaicTile: {
    width: '48.5%',
    flexGrow: 1,
    aspectRatio: 1.15,
    borderRadius: radius.lg,
    overflow: 'hidden',
    justifyContent: 'space-between',
    padding: spacing.md,
    minHeight: 118,
  },
  mosaicIcon: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.85)',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.25)',
  },
  mosaicCopy: {
    gap: 2,
  },
  chartCard: {
    gap: spacing.md,
  },
  sectionHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  weekCard: {
    overflow: 'hidden',
  },
  weekHead: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.sm,
  },
  weekColHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xs,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  weekRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    minHeight: 48,
  },
  weekDayCol: {
    flex: 1.15,
  },
  weekDayCell: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  weekKcalCol: {
    width: 52,
    textAlign: 'right',
  },
  weekMacroCol: {
    width: 28,
    textAlign: 'right',
  },
  weekChevronCol: {
    width: 18,
    alignItems: 'flex-end',
  },
  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
});
