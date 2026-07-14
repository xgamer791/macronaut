import { useLocalSearchParams, useRouter } from 'expo-router';
import React from 'react';
import { View } from 'react-native';
import { caloriesFromMacros } from '@/domain/nutrition';
import { useWeekProgress, useWeekStart } from '@/state/queries';
import { DayKey, formatDayKey, isValidDayKey, todayKey, weekStartOf } from '@/utils/date';
import { goBackOrHome } from '@/utils/navigation';
import { AppText, Button, Card, BarEntranceProvider, Screen, ScreenHeader, StatTile } from '@/ui/components';
import { useBarEntranceProgress } from '@/ui/motion/barEntrance';
import { useTheme } from '@/ui/theme/ThemeProvider';
import { spacing } from '@/ui/theme/tokens';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';

/** Weekly goal detail: weekly target vs consumed, daily breakdown, macro
 * distribution and adherence. Values never roll between weeks. */
export default function WeekDetailScreen() {
  const params = useLocalSearchParams<{ date?: string }>();
  const date: DayKey = params.date && isValidDayKey(params.date) ? params.date : todayKey();

  return (
    <BarEntranceProvider pageKey={`week-detail:${date}`}>
      <WeekDetailBody date={date} />
    </BarEntranceProvider>
  );
}

function WeekDetailBody({ date }: { date: DayKey }) {
  const router = useRouter();
  const { colors } = useTheme();
  const weekStart = useWeekStart();
  const week = useWeekProgress(date);

  if (!week) {
    return (
      <Screen>
        <AppText variant="caption" tone="muted" align="center">
          Loading…
        </AppText>
      </Screen>
    );
  }

  const start = weekStartOf(date, weekStart);
  const over = week.weeklyRemaining < 0;
  const p = week.weeklyConsumed.protein ?? 0;
  const c = week.weeklyConsumed.carbs ?? 0;
  const f = week.weeklyConsumed.fat ?? 0;
  const macroKcal = caloriesFromMacros(p, c, f);
  const dist =
    macroKcal > 0
      ? { p: (p * 4) / macroKcal, c: (c * 4) / macroKcal, f: (f * 9) / macroKcal }
      : null;

  return (
    <Screen>
      <ScreenHeader title={`Week of ${formatDayKey(start)}`} />

      <View style={{ flexDirection: 'row', gap: spacing.md }}>
        <StatTile label="Weekly target" value={Math.round(week.weeklyTarget.calories).toLocaleString()} />
        <StatTile label="Consumed" value={Math.round(week.weeklyConsumed.calories).toLocaleString()} />
        <StatTile label="Burned" value={Math.round(week.weeklyBurned).toLocaleString()} />
      </View>

      <View style={{ flexDirection: 'row', gap: spacing.md }}>
        <StatTile
          label={over ? 'Over by' : 'Remaining'}
          value={Math.abs(Math.round(week.weeklyRemaining)).toLocaleString()}
        />
        <StatTile
          label="Average per day"
          value={Math.round(week.averagePerDay.calories).toLocaleString()}
          detail={`${week.daysLogged} logged day${week.daysLogged === 1 ? '' : 's'}`}
        />
        <StatTile
          label="Adherence"
          value={`${Math.round(week.calorieAdherence * 100)}%`}
          detail={`${week.daysUnderCalories} within · ${week.daysOverCalories} over`}
        />
      </View>

      <Card style={{ gap: spacing.sm }}>
        <AppText variant="caption" tone="secondary">
          Daily breakdown
        </AppText>
        {week.days.map((d) => (
          <View key={d.date} style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <AppText variant="caption" tone="secondary">
              {formatDayKey(d.date)}
            </AppText>
            <AppText
              variant="caption"
              weight={d.consumed.calories > 0 ? '600' : '400'}
              tone={d.overCalories ? 'danger' : d.consumed.calories > 0 ? 'primary' : 'muted'}
            >
              {d.consumed.calories > 0
                ? `${Math.round(d.consumed.calories).toLocaleString()} / ${Math.round(d.target.calories).toLocaleString()}${d.overCalories ? ' · over' : ''}`
                : `— / ${Math.round(d.target.calories).toLocaleString()}`}
            </AppText>
          </View>
        ))}
      </Card>

      {dist ? (
        <Card style={{ gap: spacing.sm }}>
          <AppText variant="caption" tone="secondary">
            Macro distribution (share of calories)
          </AppText>
          <MacroDistBar dist={dist} colors={colors} />
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <AppText variant="micro" tone="secondary">
              ● Protein {Math.round(dist.p * 100)}%
            </AppText>
            <AppText variant="micro" tone="secondary">
              ● Carbs {Math.round(dist.c * 100)}%
            </AppText>
            <AppText variant="micro" tone="secondary">
              ● Fat {Math.round(dist.f * 100)}%
            </AppText>
          </View>
        </Card>
      ) : null}

      {Object.entries(week.macroAdherence).length > 0 ? (
        <Card style={{ gap: 6 }}>
          <AppText variant="caption" tone="secondary">
            Macro adherence (logged days within target)
          </AppText>
          {Object.entries(week.macroAdherence).map(([k, v]) => (
            <View key={k} style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <AppText variant="caption" tone="secondary" style={{ textTransform: 'capitalize' }}>
                {k}
              </AppText>
              <AppText variant="caption" weight="600">
                {Math.round((v ?? 0) * 100)}%
              </AppText>
            </View>
          ))}
        </Card>
      ) : null}

      <AppText variant="micro" tone="muted">
        Weekly goal mode: {week.weeklyTarget === undefined ? '' : ''}
        {`unused calories never roll into the next day or week.`}
      </AppText>

      <Button title="Done" variant="secondary" onPress={() => goBackOrHome(router)} />
    </Screen>
  );
}

function MacroDistBar({
  dist,
  colors,
}: {
  dist: { p: number; c: number; f: number };
  colors: { protein: string; carbs: string; fat: string };
}) {
  const entrance = useBarEntranceProgress();
  const style = useAnimatedStyle(() => ({
    transform: [{ scaleX: entrance.value }],
  }));

  return (
    <View style={{ height: 10, borderRadius: 5, overflow: 'hidden' }}>
      <Animated.View
        style={[
          {
            flexDirection: 'row',
            height: '100%',
            width: '100%',
            alignSelf: 'flex-start',
            transformOrigin: 'left center' as const,
          },
          style,
        ]}
      >
        <View style={{ flex: dist.p, backgroundColor: colors.protein }} />
        <View style={{ flex: dist.c, backgroundColor: colors.carbs }} />
        <View style={{ flex: dist.f, backgroundColor: colors.fat }} />
      </Animated.View>
    </View>
  );
}
