import { useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { View } from 'react-native';
import { GoalConfig, resolveTargetForDate } from '@/domain/goals';
import { MacroKey } from '@/domain/types';
import { useActivityRange, useDayTypeMarks, useDiaryRange, useGoalConfigs } from '@/state/queries';
import { ActivityEntry, DiaryEntry } from '@/repositories/types';
import {
  addDays,
  DayKey,
  formatDayKey,
  parseDayKey,
  rangeDays,
  shortWeekdayLabel,
  todayKey,
} from '@/utils/date';
import {
  AppText,
  BarChart,
  Button,
  Card,
  Chip,
  DatePickSheet,
  EmptyState,
  Screen,
  StatTile,
} from '@/ui/components';
import { spacing } from '@/ui/theme/tokens';

type Range = '7' | '30' | '90' | 'custom';
type Metric = 'calories' | 'burned' | 'protein' | 'carbs' | 'fat' | 'fiber';

const METRIC_LABEL: Record<Metric, string> = {
  calories: 'Net kcal',
  burned: 'Burned',
  protein: 'Protein',
  carbs: 'Carbs',
  fat: 'Fat',
  fiber: 'Fiber',
};

export default function ProgressScreen() {
  const router = useRouter();
  const [range, setRange] = useState<Range>('7');
  const [metric, setMetric] = useState<Metric>('calories');
  const [customFrom, setCustomFrom] = useState<DayKey>(addDays(todayKey(), -13));
  const [customTo, setCustomTo] = useState<DayKey>(todayKey());
  const [pickingFrom, setPickingFrom] = useState(false);
  const [pickingTo, setPickingTo] = useState(false);

  const today = todayKey();
  const from = range === 'custom' ? customFrom : addDays(today, -(Number(range) - 1));
  const to = range === 'custom' ? customTo : today;

  const entries = useDiaryRange(from, to);
  const activities = useActivityRange(from, to);
  const configs = useGoalConfigs();
  const marks = useDayTypeMarks();

  const stats = useMemo(() => {
    if (!entries.data || !activities.data || !configs.data || configs.data.length === 0 || !marks.data)
      return null;
    return computeStats(
      rangeDays(from, to),
      entries.data,
      activities.data,
      configs.data,
      marks.data,
      metric,
    );
  }, [entries.data, activities.data, configs.data, marks.data, from, to, metric]);

  const anyLogged = (stats?.daysLogged ?? 0) > 0;
  const isKcal = metric === 'calories' || metric === 'burned';

  return (
    <Screen tabBarSpace>
      <AppText variant="title" weight="600" display>
        Progress
      </AppText>

      <View style={{ flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' }}>
        {(['7', '30', '90'] as const).map((r) => (
          <Chip key={r} label={`${r} days`} selected={range === r} onPress={() => setRange(r)} />
        ))}
        <Chip label="Custom" selected={range === 'custom'} onPress={() => setRange('custom')} />
      </View>

      {range === 'custom' ? (
        <View style={{ flexDirection: 'row', gap: spacing.sm }}>
          <Button
            title={`From: ${formatDayKey(customFrom)}`}
            variant="secondary"
            compact
            style={{ flex: 1 }}
            onPress={() => setPickingFrom(true)}
          />
          <Button
            title={`To: ${formatDayKey(customTo)}`}
            variant="secondary"
            compact
            style={{ flex: 1 }}
            onPress={() => setPickingTo(true)}
          />
        </View>
      ) : null}

      <View style={{ flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' }}>
        {(Object.keys(METRIC_LABEL) as Metric[]).map((m) => (
          <Chip key={m} label={METRIC_LABEL[m]} selected={metric === m} onPress={() => setMetric(m)} />
        ))}
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
          <View style={{ flexDirection: 'row', gap: spacing.md }}>
            <StatTile
              label={`Avg ${METRIC_LABEL[metric].toLowerCase()}/day`}
              value={`${Math.round(stats.average).toLocaleString()}${isKcal ? '' : ' g'}`}
              detail={`over ${stats.daysLogged} logged day${stats.daysLogged === 1 ? '' : 's'}`}
            />
            <StatTile
              label="Within target"
              value={`${stats.daysWithin} / ${stats.daysLogged}`}
              detail={`${Math.round(stats.adherence * 100)}% adherence`}
            />
          </View>

          <Card>
            <BarChart
              data={stats.bars}
              unit={isKcal ? '' : ' g'}
              accessibilityLabel={`${METRIC_LABEL[metric]} per day from ${from} to ${to}`}
            />
          </Card>

          {stats.weeklyAverages.length > 1 ? (
            <Card style={{ gap: spacing.sm }}>
              <AppText variant="caption" tone="secondary">
                Weekly averages ({METRIC_LABEL[metric].toLowerCase()}/day)
              </AppText>
              {stats.weeklyAverages.map((w) => (
                <View key={w.label} style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <AppText variant="caption" tone="secondary">
                    {w.label}
                  </AppText>
                  <AppText variant="caption" weight="600">
                    {Math.round(w.average).toLocaleString()}
                    {isKcal ? '' : ' g'}
                  </AppText>
                </View>
              ))}
            </Card>
          ) : null}

          <View style={{ flexDirection: 'row', gap: spacing.md }}>
            <Button
              title="Daily goal detail"
              variant="secondary"
              style={{ flex: 1 }}
              onPress={() => router.push({ pathname: '/day-detail', params: { date: today } })}
            />
            <Button
              title="Weekly goal detail"
              variant="secondary"
              style={{ flex: 1 }}
              onPress={() => router.push({ pathname: '/week-detail', params: { date: today } })}
            />
          </View>
        </>
      )}

      <DatePickSheet
        visible={pickingFrom}
        onClose={() => setPickingFrom(false)}
        title="Range start"
        back={120}
        forward={0}
        onPick={(d) => setCustomFrom(d <= customTo ? d : customTo)}
      />
      <DatePickSheet
        visible={pickingTo}
        onClose={() => setPickingTo(false)}
        title="Range end"
        back={120}
        forward={0}
        onPick={(d) => setCustomTo(d >= customFrom ? d : customFrom)}
      />
    </Screen>
  );
}

interface Stats {
  bars: { key: string; label: string; value: number; goal?: number; detail?: string }[];
  average: number;
  daysLogged: number;
  daysWithin: number;
  adherence: number;
  weeklyAverages: { label: string; average: number }[];
}

function computeStats(
  days: DayKey[],
  entries: DiaryEntry[],
  activities: ActivityEntry[],
  configs: GoalConfig[],
  marks: Record<string, 'training' | 'rest'>,
  metric: Metric,
): Stats {
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

  const macroValue = (list: DiaryEntry[], key: MacroKey | 'calories') =>
    list.reduce(
      (sum, e) => sum + (key === 'calories' ? e.nutrition.calories : (e.nutrition[key] ?? 0)),
      0,
    );

  let sum = 0;
  let logged = 0;
  let within = 0;
  const bars: Stats['bars'] = [];
  const weekBuckets = new Map<string, { total: number; count: number }>();

  for (const d of days) {
    const list = byDay.get(d) ?? [];
    const burned = burnByDay.get(d) ?? 0;
    const food = macroValue(list, 'calories');
    const v =
      metric === 'burned'
        ? burned
        : metric === 'calories'
          ? food - burned
          : macroValue(list, metric);
    const target = resolveTargetForDate(d, configFor(d), marks);
    const goal =
      metric === 'burned'
        ? undefined
        : metric === 'calories'
          ? target.calories
          : (target[metric] ?? 0);
    const dt = parseDayKey(d);
    bars.push({
      key: d,
      label: days.length <= 7 ? shortWeekdayLabel(d) : `${dt.getMonth() + 1}/${dt.getDate()}`,
      value: Math.max(0, v),
      goal: goal && goal > 0 ? goal : undefined,
      detail:
        list.length > 0 || burned > 0
          ? `Food ${Math.round(food)} · burned ${Math.round(burned)} · net ${Math.round(food - burned)}`
          : 'Nothing logged',
    });
    if (list.length > 0 || burned > 0) {
      sum += v;
      logged++;
      if (metric === 'burned' || !goal || goal <= 0 || v <= goal) within++;
      const monthLabel = `${dt.toLocaleString(undefined, { month: 'short' })} wk${Math.ceil(dt.getDate() / 7)}`;
      const bucket = weekBuckets.get(monthLabel) ?? { total: 0, count: 0 };
      bucket.total += v;
      bucket.count++;
      weekBuckets.set(monthLabel, bucket);
    }
  }

  return {
    bars,
    average: logged > 0 ? sum / logged : 0,
    daysLogged: logged,
    daysWithin: within,
    adherence: logged > 0 ? within / logged : 0,
    weeklyAverages: [...weekBuckets.entries()].map(([label, b]) => ({
      label,
      average: b.total / b.count,
    })),
  };
}
