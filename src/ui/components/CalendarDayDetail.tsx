import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { roundForDisplay } from '@/domain/nutrition';
import type { ActivityEntry, DiaryEntry, MealCategory } from '@/repositories/types';
import {
  useActivityEntries,
  useDayNotes,
  useDayProgress,
  useDayType,
  useDiaryEntries,
  useMealCategories,
  useTrainingSchedule,
} from '@/state/queries';
import { DayKey, formatDayKey, parseDayKey } from '@/utils/date';
import { BarEntranceProvider } from '@/ui/motion/barEntrance';
import { useTheme } from '@/ui/theme/ThemeProvider';
import { radius, spacing } from '@/ui/theme/tokens';
import { AppText } from './AppText';
import { MacroBar } from './MacroBar';
import { ProgressRing } from './ProgressRing';

/** Long enough to read as a wipe, short enough not to feel like waiting. */
const FADE_OUT_MS = 130;
const FADE_IN_MS = 260;
const RING = 108;

type Tab = 'macros' | 'meals' | 'training' | 'recovery';

/** What the section is currently reading: one day, through one tab. */
interface DayView {
  date: DayKey;
  tab: Tab;
}

const TABS: { value: Tab; label: string }[] = [
  { value: 'macros', label: 'Macros' },
  { value: 'meals', label: 'Meals' },
  { value: 'training', label: 'Training' },
  { value: 'recovery', label: 'Recovery' },
];

export interface CalendarDayDetailProps {
  date: DayKey;
}

/**
 * Everything recorded against one day, under the calendar that picked it:
 * macros against that date's own goal, the food behind them, training planned
 * and done, and the rest of the day around it.
 *
 * The date and the tab are double-buffered — a change fades the panel out,
 * swaps what is being read, and fades the new one in — so stepping through
 * dates never flashes half-loaded numbers.
 */
export function CalendarDayDetail({ date }: CalendarDayDetailProps) {
  const [shown, setShown] = useState<DayView>({ date, tab: 'macros' });
  const [pending, setPending] = useState<DayView | null>(null);
  const fade = useSharedValue(1);

  // A new date arrives from the calendar; a new tab from the row below it.
  // Either way the change is only requested — it is committed when the
  // fade-out lands, so nothing swaps under the reader's eye. Reading the prop
  // during render is what keeps the request in the same pass as the tap.
  const [prevDate, setPrevDate] = useState(date);
  if (date !== prevDate) {
    setPrevDate(date);
    // Returning to the day already on screen cancels a fade still running.
    setPending(date === shown.date ? null : { date, tab: 'macros' });
  }

  const changeTab = (tab: Tab) => {
    if (tab === shown.tab) return;
    void Haptics.selectionAsync();
    setPending({ date: shown.date, tab });
  };

  // The one place the fade is driven, so a request and a settle cannot race.
  useEffect(() => {
    if (!pending) {
      fade.value = withTiming(1, { duration: FADE_IN_MS, easing: Easing.out(Easing.cubic) });
      return;
    }
    fade.value = withTiming(
      0,
      { duration: FADE_OUT_MS, easing: Easing.in(Easing.quad) },
      (done) => {
        if (!done) return;
        runOnJS(setShown)(pending);
        runOnJS(setPending)(null);
      },
    );
  }, [fade, pending]);

  const bodyStyle = useAnimatedStyle(() => ({
    opacity: fade.value,
    transform: [{ translateY: (1 - fade.value) * 10 }],
  }));

  return (
    <View style={styles.root}>
      <View style={styles.heading}>
        <AppText variant="heading" weight="700" numberOfLines={1}>
          {formatDayKey(shown.date)}
        </AppText>
        <AppText variant="caption" tone="muted">
          {longDate(shown.date)}
        </AppText>
      </View>

      <Tabs value={shown.tab} onChange={changeTab} />

      <Animated.View style={bodyStyle}>
        {/* Keyed by day so the rings and bars refill for a date not seen yet. */}
        <BarEntranceProvider pageKey={`calendar-day:${shown.date}:${shown.tab}`}>
          <DayTab date={shown.date} tab={shown.tab} />
        </BarEntranceProvider>
      </Animated.View>
    </View>
  );
}

/** Pill tabs — wide targets, generous gaps, no boxed segments to crowd them. */
function Tabs({ value, onChange }: { value: Tab; onChange: (tab: Tab) => void }) {
  const { colors } = useTheme();
  return (
    <View style={styles.tabs} accessibilityRole="tablist">
      {TABS.map((tab) => {
        const selected = tab.value === value;
        return (
          <Pressable
            key={tab.value}
            accessibilityRole="tab"
            accessibilityLabel={tab.label}
            accessibilityState={{ selected }}
            onPress={() => onChange(tab.value)}
            style={[
              styles.tab,
              {
                backgroundColor: selected ? colors.accent : colors.surfaceRaised,
              },
            ]}
          >
            <AppText
              variant="caption"
              weight={selected ? '600' : '500'}
              numberOfLines={1}
              style={{ color: selected ? colors.onAccent : colors.textSecondary }}
            >
              {tab.label}
            </AppText>
          </Pressable>
        );
      })}
    </View>
  );
}

function DayTab({ date, tab }: { date: DayKey; tab: Tab }) {
  switch (tab) {
    case 'macros':
      return <MacrosTab date={date} />;
    case 'meals':
      return <MealsTab date={date} />;
    case 'training':
      return <TrainingTab date={date} />;
    case 'recovery':
      return <RecoveryTab date={date} />;
  }
}

/* ------------------------------------------------------------------ macros */

function MacrosTab({ date }: { date: DayKey }) {
  const { colors } = useTheme();
  const progress = useDayProgress(date);

  if (!progress) return <Loading />;

  const { consumed, target, burned } = progress;
  const goal = target.calories || 0;
  const eaten = Math.round(consumed.calories);
  const remaining = Math.round(progress.caloriesRemaining);
  const ratio = goal > 0 ? consumed.calories / goal : 0;

  return (
    <View style={styles.stack}>
      <Panel>
        <View style={styles.energyRow}>
          <ProgressRing
            progress={ratio}
            size={RING}
            strokeWidth={10}
            overColor={colors.warning}
            accessibilityLabel={`${eaten} of ${Math.round(goal)} calories`}
          >
            <AppText variant="title" weight="700" display>
              {eaten}
            </AppText>
            <AppText variant="micro" tone="muted">
              {goal > 0 ? `of ${Math.round(goal)}` : 'kcal'}
            </AppText>
          </ProgressRing>

          <View style={styles.energyStats}>
            <EnergyRow label="Eaten" value={`${eaten}`} unit="kcal" />
            <EnergyRow label="Burned" value={`${Math.round(burned)}`} unit="kcal" />
            <EnergyRow label="Net" value={`${Math.round(progress.netCalories)}`} unit="kcal" />
            <View style={[styles.divider, { backgroundColor: colors.border }]} />
            <EnergyRow
              label={remaining < 0 ? 'Over by' : 'Remaining'}
              value={`${Math.abs(remaining)}`}
              unit="kcal"
              tone={remaining < 0 ? 'danger' : 'accent'}
            />
          </View>
        </View>
      </Panel>

      <Panel title="Macros">
        <View style={styles.bars}>
          <MacroBar
            label="Protein"
            consumed={consumed.protein ?? 0}
            target={target.protein}
            color={colors.protein}
          />
          <MacroBar
            label="Carbohydrates"
            consumed={consumed.carbs ?? 0}
            target={target.carbs}
            color={colors.carbs}
          />
          <MacroBar
            label="Fat"
            consumed={consumed.fat ?? 0}
            target={target.fat}
            color={colors.fat}
          />
          <MacroBar
            label="Fiber"
            consumed={consumed.fiber ?? 0}
            target={target.fiber}
            color={colors.fiber}
          />
        </View>
      </Panel>

      <Panel title="Also tracked">
        <View style={styles.grid}>
          <MicroCell label="Sugar" amount={consumed.sugar} unit="g" />
          <MicroCell label="Saturated fat" amount={consumed.saturatedFat} unit="g" />
          <MicroCell label="Sodium" amount={consumed.sodium} unit="mg" />
          <MicroCell label="Cholesterol" amount={consumed.cholesterol} unit="mg" />
        </View>
      </Panel>
    </View>
  );
}

function EnergyRow({
  label,
  value,
  unit,
  tone = 'primary',
}: {
  label: string;
  value: string;
  unit: string;
  tone?: 'primary' | 'accent' | 'danger';
}) {
  return (
    <View style={styles.energyStat}>
      <AppText variant="caption" tone="secondary">
        {label}
      </AppText>
      <View style={styles.energyValue}>
        <AppText variant="body" weight="700" display tone={tone}>
          {value}
        </AppText>
        <AppText variant="micro" tone="muted">
          {unit}
        </AppText>
      </View>
    </View>
  );
}

function MicroCell({ label, amount, unit }: { label: string; amount?: number; unit: string }) {
  return (
    <View style={styles.gridCell}>
      <AppText variant="micro" tone="muted" numberOfLines={1}>
        {label}
      </AppText>
      <AppText variant="body" weight="600" display>
        {amount === undefined ? '—' : `${roundForDisplay(amount)}${unit}`}
      </AppText>
    </View>
  );
}

/* ------------------------------------------------------------------- meals */

function MealsTab({ date }: { date: DayKey }) {
  const { colors } = useTheme();
  const entries = useDiaryEntries(date);
  const categories = useMealCategories();

  const grouped = useMemo(
    () => groupByMeal(entries.data ?? [], categories.data ?? []),
    [categories.data, entries.data],
  );

  if (!entries.data || !categories.data) return <Loading />;
  if (grouped.length === 0) {
    return <Blank icon="restaurant-outline" title="No food logged" body="Nothing was recorded against this day." />;
  }

  return (
    <View style={styles.stack}>
      {grouped.map((group) => (
        <Panel key={group.id}>
          <View style={styles.mealHead}>
            <AppText variant="body" weight="600">
              {group.name}
            </AppText>
            <AppText variant="caption" weight="600" style={{ color: colors.accent }}>
              {Math.round(group.calories)} kcal
            </AppText>
          </View>
          <View style={styles.mealItems}>
            {group.entries.map((entry) => (
              <View key={entry.id} style={styles.mealItem}>
                <View style={styles.mealItemCopy}>
                  <AppText variant="caption" numberOfLines={1}>
                    {entry.name}
                  </AppText>
                  <AppText variant="micro" tone="muted" numberOfLines={1}>
                    {portionOf(entry)}
                  </AppText>
                </View>
                <AppText variant="caption" tone="secondary">
                  {Math.round(entry.nutrition.calories)}
                </AppText>
              </View>
            ))}
          </View>
        </Panel>
      ))}
    </View>
  );
}

interface MealGroup {
  id: string;
  name: string;
  calories: number;
  entries: DiaryEntry[];
}

/** Entries under their meal category, in the order the categories are set, and
 * anything whose category has since been deleted kept at the end rather than
 * dropped. */
function groupByMeal(entries: DiaryEntry[], categories: MealCategory[]): MealGroup[] {
  const byId = new Map<string, MealGroup>();
  for (const category of categories) {
    byId.set(category.id, { id: category.id, name: category.name, calories: 0, entries: [] });
  }
  for (const entry of entries) {
    let group = byId.get(entry.meal);
    if (!group) {
      group = { id: entry.meal, name: titleCase(entry.meal), calories: 0, entries: [] };
      byId.set(entry.meal, group);
    }
    group.entries.push(entry);
    group.calories += entry.nutrition.calories;
  }
  return [...byId.values()].filter((group) => group.entries.length > 0);
}

function portionOf(entry: DiaryEntry): string {
  const portion = entry.servingDesc ?? `${roundForDisplay(entry.quantity)} ${entry.unit}`;
  return entry.brand ? `${entry.brand} · ${portion}` : portion;
}

/* ---------------------------------------------------------------- training */

function TrainingTab({ date }: { date: DayKey }) {
  const { colors } = useTheme();
  const schedule = useTrainingSchedule(date, date);
  const activities = useActivityEntries(date);
  const dayType = useDayType(date);

  if (!schedule.data || !activities.data) return <Loading />;

  const planned = schedule.data.find((day) => day.date === date);
  const logged = activities.data;
  const burned = logged.reduce((sum, a) => sum + a.caloriesBurned, 0);
  const minutes = logged.reduce((sum, a) => sum + (a.durationMin ?? 0), 0);

  return (
    <View style={styles.stack}>
      <View style={styles.tiles}>
        <Tile label="Burned" value={`${Math.round(burned)}`} unit="kcal" />
        <Tile label="Active" value={`${Math.round(minutes)}`} unit="min" />
        <Tile label="Sessions" value={`${logged.length}`} unit={logged.length === 1 ? 'log' : 'logs'} />
      </View>

      {dayType ? (
        <View style={styles.badgeRow}>
          <View
            style={[
              styles.badge,
              {
                backgroundColor: dayType === 'training' ? `${colors.accent}22` : colors.surfaceRaised,
              },
            ]}
          >
            <Ionicons
              name={dayType === 'training' ? 'barbell-outline' : 'moon-outline'}
              size={14}
              color={dayType === 'training' ? colors.accent : colors.textSecondary}
            />
            <AppText
              variant="micro"
              weight="600"
              style={{ color: dayType === 'training' ? colors.accent : colors.textSecondary }}
            >
              {dayType === 'training' ? 'Training day' : 'Rest day'}
            </AppText>
          </View>
        </View>
      ) : null}

      <Panel title="Planned">
        {planned ? (
          <View style={styles.stackTight}>
            <AppText variant="body" weight="600">
              {planned.label}
            </AppText>
            {planned.workouts.map((workout) => (
              <View key={workout.id} style={styles.mealItem}>
                <View style={styles.mealItemCopy}>
                  <AppText variant="caption" numberOfLines={1}>
                    {workout.label}
                  </AppText>
                  {workout.macroLabel ? (
                    <AppText variant="micro" tone="muted" numberOfLines={1}>
                      {workout.macroLabel}
                    </AppText>
                  ) : null}
                </View>
                {workout.sets !== undefined ? (
                  <AppText variant="caption" tone="secondary">
                    {workout.sets} {workout.sets === 1 ? 'set' : 'sets'}
                  </AppText>
                ) : null}
              </View>
            ))}
            {planned.notes ? (
              <AppText variant="caption" tone="secondary">
                {planned.notes}
              </AppText>
            ) : null}
          </View>
        ) : (
          <AppText variant="caption" tone="muted">
            No training scheduled for this day.
          </AppText>
        )}
      </Panel>

      <Panel title="Logged">
        {logged.length === 0 ? (
          <AppText variant="caption" tone="muted">
            No workout recorded.
          </AppText>
        ) : (
          <View style={styles.stackTight}>
            {logged.map((entry) => (
              <View key={entry.id} style={styles.mealItem}>
                <View style={styles.mealItemCopy}>
                  <AppText variant="caption" numberOfLines={1}>
                    {entry.name}
                  </AppText>
                  <AppText variant="micro" tone="muted" numberOfLines={1}>
                    {workoutDetail(entry)}
                  </AppText>
                </View>
                <AppText variant="caption" tone="secondary">
                  {Math.round(entry.caloriesBurned)} kcal
                </AppText>
              </View>
            ))}
          </View>
        )}
      </Panel>
    </View>
  );
}

function workoutDetail(entry: ActivityEntry): string {
  const parts: string[] = [entry.activityType];
  if (entry.durationMin !== undefined) parts.push(`${roundForDisplay(entry.durationMin)} min`);
  if (entry.distanceKm !== undefined) parts.push(`${roundForDisplay(entry.distanceKm)} km`);
  if (entry.intensity) parts.push(entry.intensity);
  return parts.join(' · ');
}

/* ---------------------------------------------------------------- recovery */

function RecoveryTab({ date }: { date: DayKey }) {
  const { colors } = useTheme();
  const notes = useDayNotes(date);
  const dayType = useDayType(date);

  return (
    <View style={styles.stack}>
      <Panel title="Sleep">
        <View style={styles.pending}>
          <Ionicons name="moon-outline" size={18} color={colors.textMuted} />
          <AppText variant="caption" tone="muted" style={styles.pendingCopy}>
            Sleep arrives with Apple Health, which needs a native iOS build — see Settings →
            Apple Health for where that stands. Nothing is recorded for this day yet.
          </AppText>
        </View>
      </Panel>

      <Panel title="Day type">
        <AppText variant="body" weight="600">
          {dayType === null ? '—' : dayType === 'training' ? 'Training' : 'Rest'}
        </AppText>
        <AppText variant="caption" tone="muted">
          Sets the calorie and macro targets this day is measured against.
        </AppText>
      </Panel>

      <Panel title="Notes">
        {!notes.data ? (
          <Loading />
        ) : notes.data.length === 0 ? (
          <AppText variant="caption" tone="muted">
            Nothing written for this day.
          </AppText>
        ) : (
          <View style={styles.stackTight}>
            {notes.data.map((note) => (
              <AppText key={note.id} variant="caption">
                {note.body}
              </AppText>
            ))}
          </View>
        )}
      </Panel>
    </View>
  );
}

/* ------------------------------------------------------------------ shared */

function Panel({ title, children }: { title?: string; children: React.ReactNode }) {
  const { colors } = useTheme();
  return (
    <View style={[styles.panel, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      {title ? (
        <AppText variant="micro" weight="600" style={{ color: colors.textMuted }}>
          {title.toUpperCase()}
        </AppText>
      ) : null}
      {children}
    </View>
  );
}

function Tile({ label, value, unit }: { label: string; value: string; unit: string }) {
  const { colors } = useTheme();
  return (
    <View
      style={[styles.tile, { backgroundColor: colors.surface, borderColor: colors.border }]}
      accessible
      accessibilityLabel={`${label}: ${value} ${unit}`}
    >
      <AppText variant="micro" tone="muted">
        {label}
      </AppText>
      <View style={styles.tileValue}>
        <AppText variant="heading" weight="700" display>
          {value}
        </AppText>
        <AppText variant="micro" tone="muted">
          {unit}
        </AppText>
      </View>
    </View>
  );
}

function Loading() {
  return (
    <View style={styles.loading}>
      <AppText variant="caption" tone="muted">
        Loading…
      </AppText>
    </View>
  );
}

function Blank({
  icon,
  title,
  body,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  body: string;
}) {
  const { colors } = useTheme();
  return (
    <View style={styles.blank}>
      <Ionicons name={icon} size={26} color={colors.textMuted} />
      <AppText variant="body" weight="600">
        {title}
      </AppText>
      <AppText variant="caption" tone="muted" align="center">
        {body}
      </AppText>
    </View>
  );
}

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

/** `Monday, 7 September 2026` — the full date, since the heading above it may
 * only say `Today`. */
function longDate(key: DayKey): string {
  const d = parseDayKey(key);
  return `${WEEKDAYS[d.getDay()]}, ${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

function titleCase(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

const styles = StyleSheet.create({
  root: {
    gap: spacing.lg,
  },
  heading: {
    gap: 2,
  },
  tabs: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  tab: {
    flex: 1,
    minHeight: 38,
    paddingHorizontal: spacing.xs,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stack: {
    gap: spacing.md,
  },
  stackTight: {
    gap: spacing.sm,
  },
  panel: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.md,
  },
  energyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
  },
  energyStats: {
    flex: 1,
    gap: spacing.sm,
  },
  energyStat: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  energyValue: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 3,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    marginVertical: 2,
  },
  bars: {
    gap: spacing.md,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    rowGap: spacing.md,
  },
  gridCell: {
    width: '50%',
    gap: 2,
  },
  mealHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  mealItems: {
    gap: spacing.sm,
  },
  mealItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  mealItemCopy: {
    flex: 1,
    gap: 1,
  },
  tiles: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  tile: {
    flex: 1,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.lg,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    gap: 2,
  },
  tileValue: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 3,
  },
  badgeRow: {
    flexDirection: 'row',
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.full,
  },
  pending: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  pendingCopy: {
    flex: 1,
  },
  loading: {
    paddingVertical: spacing.xl,
    alignItems: 'center',
  },
  blank: {
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.xxl,
  },
});
