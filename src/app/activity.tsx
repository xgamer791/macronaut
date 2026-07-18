import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ACTIVITY_CATEGORIES, computeImprovements } from '@/domain/activity';
import { useRepos } from '@/state/AppProvider';
import {
  useActivityEntries,
  useActivityRange,
  useDeleteActivityEntry,
  useDayProgress,
} from '@/state/queries';
import { useUiStore } from '@/state/uiStore';
import { ActivityEntry, ActivityType } from '@/repositories/types';
import {
  addDays,
  DayKey,
  formatDayKey,
  rangeDays,
  shortWeekdayLabel,
  todayKey,
} from '@/utils/date';
import {
  AppText,
  BarChart,
  BarEntranceProvider,
  Button,
  Card,
  Chip,
  DatePickSheet,
  EmptyState,
  ListRow,
  ProgressRing,
  Screen,
  ScreenHeader,
  StatTile,
} from '@/ui/components';
import { useTheme } from '@/ui/theme/ThemeProvider';
import { spacing } from '@/ui/theme/tokens';

type Range = '7' | '30' | '90';

/** Soft visual target for the burn ring fill (not a stored goal). */
const BURN_RING_TARGET = 400;

const TYPE_LABEL: Record<ActivityType, string> = {
  cardio: 'Cardio',
  strength: 'Strength',
  sports: 'Sports',
  mobility: 'Mobility',
  other: 'Other',
};

function isActivityType(v: string | undefined): v is ActivityType {
  return !!v && v in TYPE_LABEL;
}

/** Activity hub — burn-ring hero, today’s log, collapsible trends. */
export default function ActivityScreen() {
  return (
    <BarEntranceProvider pageKey="activity">
      <ActivityBody />
    </BarEntranceProvider>
  );
}

function ActivityBody() {
  const router = useRouter();
  const { colors } = useTheme();
  const { activity } = useRepos();
  const params = useLocalSearchParams<{ type?: string }>();
  const date = useUiStore((s) => s.selectedDate);
  const setSelectedDate = useUiStore((s) => s.setSelectedDate);
  const progress = useDayProgress(date);
  const todayEntries = useActivityEntries(date);
  const removeEntry = useDeleteActivityEntry();

  const filterType: ActivityType | 'all' = isActivityType(params.type) ? params.type : 'all';
  const [range, setRange] = useState<Range>('7');
  const [typeFilter, setTypeFilter] = useState<ActivityType | 'all'>(filterType);
  const [trendsOpen, setTrendsOpen] = useState(false);
  const [datePickerOpen, setDatePickerOpen] = useState(false);

  const today = todayKey();
  const from = addDays(today, -(Number(range) - 1));
  const rangeQuery = useActivityRange(from, today);

  const filteredToday = useMemo(() => {
    const list = todayEntries.data ?? [];
    if (typeFilter === 'all') return list;
    return list.filter((e) => e.activityType === typeFilter);
  }, [todayEntries.data, typeFilter]);

  const chart = useMemo(() => {
    const days = rangeDays(from, today);
    const byDay: Record<DayKey, number> = {};
    for (const e of rangeQuery.data ?? []) {
      if (typeFilter !== 'all' && e.activityType !== typeFilter) continue;
      byDay[e.date] = (byDay[e.date] ?? 0) + e.caloriesBurned;
    }
    return days.map((d) => ({
      key: d,
      label: shortWeekdayLabel(d),
      value: Math.round(byDay[d] ?? 0),
      detail: `${formatDayKey(d)} · ${Math.round(byDay[d] ?? 0)} kcal burned`,
    }));
  }, [rangeQuery.data, from, today, typeFilter]);

  const typeBreakdown = useMemo(() => {
    const totals: Record<ActivityType, number> = {
      cardio: 0,
      strength: 0,
      sports: 0,
      mobility: 0,
      other: 0,
    };
    for (const e of rangeQuery.data ?? []) totals[e.activityType] += e.caloriesBurned;
    return (Object.keys(totals) as ActivityType[])
      .map((t) => ({
        key: t,
        label: TYPE_LABEL[t].slice(0, 3),
        value: Math.round(totals[t]),
        detail: `${TYPE_LABEL[t]} · ${Math.round(totals[t])} kcal`,
      }))
      .filter((r) => r.value > 0);
  }, [rangeQuery.data]);

  const durationChart = useMemo(() => {
    const days = rangeDays(from, today);
    const byDay: Record<DayKey, number> = {};
    for (const e of rangeQuery.data ?? []) {
      if (typeFilter !== 'all' && e.activityType !== typeFilter) continue;
      byDay[e.date] = (byDay[e.date] ?? 0) + (e.durationMin ?? 0);
    }
    return days.map((d) => ({
      key: d,
      label: shortWeekdayLabel(d),
      value: Math.round(byDay[d] ?? 0),
      detail: `${formatDayKey(d)} · ${Math.round(byDay[d] ?? 0)} min`,
    }));
  }, [rangeQuery.data, from, today, typeFilter]);

  const rangeTotals = useMemo(() => {
    const list = (rangeQuery.data ?? []).filter(
      (e) => typeFilter === 'all' || e.activityType === typeFilter,
    );
    const burned = list.reduce((s, e) => s + e.caloriesBurned, 0);
    const minutes = list.reduce((s, e) => s + (e.durationMin ?? 0), 0);
    const activeDays = new Set(list.map((e) => e.date)).size;
    return { burned, minutes, sessions: list.length, activeDays };
  }, [rangeQuery.data, typeFilter]);

  const [highlights, setHighlights] = useState<
    { entry: ActivityEntry; chips: ReturnType<typeof computeImprovements> }[]
  >([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const list = todayEntries.data ?? [];
      const out: { entry: ActivityEntry; chips: ReturnType<typeof computeImprovements> }[] = [];
      for (const entry of list.slice(0, 6)) {
        const prev = await activity.previousByName(entry.name, entry.date, 1);
        const chips = computeImprovements(entry, prev[0] ?? null);
        if (chips.length) out.push({ entry, chips });
      }
      if (!cancelled) setHighlights(out);
    })();
    return () => {
      cancelled = true;
    };
  }, [activity, todayEntries.data]);

  const burnedToday = progress?.burned ?? 0;
  const netFood = progress?.netCalories ?? 0;
  const left = Math.abs(Math.round(progress?.caloriesRemaining ?? 0));
  const ringProgress = burnedToday / BURN_RING_TARGET;

  const goLog = () =>
    router.push({
      pathname: '/log-activity',
      params: typeFilter === 'all' ? undefined : { type: typeFilter },
    });

  return (
    <Screen style={{ flexGrow: 1 }}>
      <ScreenHeader
        title="Activity"
        right={
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Log activity"
            onPress={goLog}
            style={{ minWidth: 44, minHeight: 44, alignItems: 'flex-end', justifyContent: 'center' }}
          >
            <Ionicons name="add" size={28} color={colors.accent} />
          </Pressable>
        }
      />

      <View style={{ flexGrow: 1, justifyContent: 'center', gap: spacing.lg }}>
      <View style={{ alignItems: 'center', gap: spacing.md, paddingVertical: spacing.sm }}>
        <ProgressRing
          progress={ringProgress}
          size={188}
          strokeWidth={18}
          accessibilityLabel={`${Math.round(burnedToday)} kilocalories burned today`}
        >
          <View style={{ alignItems: 'center', gap: 2 }}>
            <AppText variant="hero" weight="600" display>
              {Math.round(burnedToday).toLocaleString()}
            </AppText>
            <AppText variant="caption" tone="muted">
              kcal burned
            </AppText>
          </View>
        </ProgressRing>

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
          <AppText variant="body" tone="secondary">
            Left {left.toLocaleString()}
          </AppText>
          <AppText variant="body" tone="muted">
            ·
          </AppText>
          <AppText variant="body" tone="secondary">
            Net {Math.round(netFood).toLocaleString()}
          </AppText>
        </View>
      </View>

      {/* Pills + Today share the same left/right edges (mockup alignment). */}
      <View style={{ gap: spacing.md }}>
        <View
          style={{
            flexDirection: 'row',
            flexWrap: 'nowrap',
            alignItems: 'center',
            gap: 6,
          }}
        >
          <Chip
            label="All"
            selected={typeFilter === 'all'}
            onPress={() => setTypeFilter('all')}
            style={styles.typeChip}
          />
          {ACTIVITY_CATEGORIES.map((c) => (
            <Chip
              key={c.id}
              label={c.name}
              selected={typeFilter === c.id}
              onPress={() => setTypeFilter(c.id)}
              style={styles.typeChip}
            />
          ))}
        </View>

        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            minHeight: 44,
          }}
        >
          <AppText variant="heading" weight="600" display>
            {date === todayKey() ? 'Today' : formatDayKey(date)}
          </AppText>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Choose date"
            accessibilityHint="Opens a date picker"
            hitSlop={8}
            onPress={() => setDatePickerOpen(true)}
            style={{
              minWidth: 44,
              minHeight: 44,
              alignItems: 'flex-end',
              justifyContent: 'center',
            }}
          >
            <Ionicons name="calendar-outline" size={22} color={colors.textPrimary} />
          </Pressable>
        </View>
      </View>

      {filteredToday.length === 0 ? (
        <EmptyState
          title="No workouts yet"
          body="Log a session to see burn, pace improvements, and charts."
        />
      ) : (
        <Card padded={false} style={{ paddingHorizontal: spacing.lg, paddingVertical: spacing.xs }}>
          {filteredToday.map((e) => (
            <ListRow
              key={e.id}
              title={e.name}
              subtitle={[
                TYPE_LABEL[e.activityType],
                e.durationMin !== undefined ? `${e.durationMin} min` : null,
                e.distanceKm !== undefined ? `${e.distanceKm} km` : null,
                e.intensity,
              ]
                .filter(Boolean)
                .join(' · ')}
              value={`${Math.round(e.caloriesBurned)} kcal`}
              right={
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Delete ${e.name}`}
                  hitSlop={8}
                  onPress={() => removeEntry.mutate(e.id)}
                  style={{ padding: spacing.sm }}
                >
                  <Ionicons name="trash-outline" size={18} color={colors.textMuted} />
                </Pressable>
              }
            />
          ))}
        </Card>
      )}

      {highlights.length > 0 ? (
        <>
          <AppText variant="heading" weight="600" display>
            Improvements
          </AppText>
          <Card style={{ gap: spacing.md }}>
            {highlights.map(({ entry, chips }) => (
              <View key={entry.id} style={{ gap: 4 }}>
                <AppText variant="body" weight="600">
                  {entry.name}
                </AppText>
                {chips.map((c) => (
                  <AppText key={c.label} variant="caption" tone="accent">
                    {c.label} · {c.detail}
                  </AppText>
                ))}
              </View>
            ))}
          </Card>
        </>
      ) : null}

      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: trendsOpen }}
        accessibilityLabel={trendsOpen ? 'Hide trends' : 'Show trends'}
        onPress={() => setTrendsOpen((o) => !o)}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          minHeight: 44,
        }}
      >
        <AppText variant="heading" weight="600" display>
          Trends
        </AppText>
        <Ionicons
          name={trendsOpen ? 'chevron-up' : 'chevron-down'}
          size={22}
          color={colors.textSecondary}
        />
      </Pressable>

      {trendsOpen ? (
        <View style={{ gap: spacing.lg }}>
          <View style={{ flexDirection: 'row', gap: spacing.sm }}>
            {(['7', '30', '90'] as const).map((r) => (
              <Chip key={r} label={`${r}d`} selected={range === r} onPress={() => setRange(r)} />
            ))}
          </View>

          <View style={{ flexDirection: 'row', gap: spacing.md }}>
            <StatTile label="Burned" value={Math.round(rangeTotals.burned).toLocaleString()} />
            <StatTile label="Minutes" value={Math.round(rangeTotals.minutes).toLocaleString()} />
            <StatTile label="Active days" value={String(rangeTotals.activeDays)} />
          </View>

          <AppText variant="heading" weight="600" display>
            Calories burned
          </AppText>
          <Card>
            {rangeTotals.sessions === 0 ? (
              <AppText variant="caption" tone="muted" align="center">
                Charts fill in as you log workouts.
              </AppText>
            ) : (
              <BarChart
                data={chart}
                accessibilityLabel={`Calories burned over the last ${range} days`}
              />
            )}
          </Card>

          <AppText variant="heading" weight="600" display>
            Minutes active
          </AppText>
          <Card>
            {rangeTotals.minutes === 0 ? (
              <AppText variant="caption" tone="muted" align="center">
                Add durations to unlock this chart.
              </AppText>
            ) : (
              <BarChart
                data={durationChart}
                accessibilityLabel={`Active minutes over the last ${range} days`}
              />
            )}
          </Card>

          {typeBreakdown.length > 0 ? (
            <>
              <AppText variant="heading" weight="600" display>
                Burn by type
              </AppText>
              <Card>
                <BarChart data={typeBreakdown} accessibilityLabel="Calories burned by activity type" />
              </Card>
            </>
          ) : null}
        </View>
      ) : null}

      <Button title="Log activity" onPress={goLog} />
      </View>

      <DatePickSheet
        visible={datePickerOpen}
        onClose={() => setDatePickerOpen(false)}
        title="Choose a date"
        onPick={setSelectedDate}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  typeChip: {
    flex: 1,
    paddingHorizontal: 4,
    paddingVertical: 6,
    minHeight: 28,
    alignItems: 'center',
  },
});
