import { useLocalSearchParams, useRouter } from 'expo-router';
import React from 'react';
import { View } from 'react-native';
import { roundForDisplay } from '@/domain/nutrition';
import { useDayProgress } from '@/state/queries';
import { DayKey, formatDayKey, isValidDayKey, todayKey } from '@/utils/date';
import { goBackOrHome } from '@/utils/navigation';
import { AppText, Button, Card, MacroBar, BarEntranceProvider, Screen, ScreenHeader } from '@/ui/components';
import { useTheme } from '@/ui/theme/ThemeProvider';

/** Daily goal detail: consumed vs the targets in effect for one date. */
export default function DayDetailScreen() {
  const params = useLocalSearchParams<{ date?: string }>();
  const date: DayKey = params.date && isValidDayKey(params.date) ? params.date : todayKey();

  return (
    <BarEntranceProvider pageKey={`day-detail:${date}`}>
      <DayDetailBody date={date} />
    </BarEntranceProvider>
  );
}

function DayDetailBody({ date }: { date: DayKey }) {
  const router = useRouter();
  const { colors } = useTheme();
  const progress = useDayProgress(date);

  if (!progress) {
    return (
      <Screen>
        <AppText variant="caption" tone="muted" align="center">
          Loading…
        </AppText>
      </Screen>
    );
  }

  const rows: { label: string; key: 'protein' | 'carbs' | 'fat' | 'fiber' | 'sugar' | 'sodium' | 'cholesterol'; unit: string; color: string }[] = [
    { label: 'Protein', key: 'protein', unit: 'g', color: colors.protein },
    { label: 'Carbohydrates', key: 'carbs', unit: 'g', color: colors.carbs },
    { label: 'Fat', key: 'fat', unit: 'g', color: colors.fat },
    { label: 'Fiber', key: 'fiber', unit: 'g', color: colors.fiber },
    { label: 'Sugar', key: 'sugar', unit: 'g', color: colors.fiber },
    { label: 'Sodium', key: 'sodium', unit: 'mg', color: colors.fiber },
    { label: 'Cholesterol', key: 'cholesterol', unit: 'mg', color: colors.fiber },
  ];

  const over = progress.caloriesRemaining < 0;

  return (
    <Screen>
      <ScreenHeader title={formatDayKey(date)} />
      <AppText variant="caption" tone="secondary">
        Compared against the goal that was in effect on this date.
      </AppText>

      <Card style={{ flexDirection: 'row', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <View style={{ alignItems: 'center', minWidth: 72 }}>
          <AppText variant="micro" tone="muted">
            Consumed
          </AppText>
          <AppText variant="title" weight="600" display>
            {Math.round(progress.consumed.calories).toLocaleString()}
          </AppText>
        </View>
        <View style={{ alignItems: 'center', minWidth: 72 }}>
          <AppText variant="micro" tone="muted">
            Burned
          </AppText>
          <AppText variant="title" weight="600" display tone="accent">
            {Math.round(progress.burned).toLocaleString()}
          </AppText>
        </View>
        <View style={{ alignItems: 'center', minWidth: 72 }}>
          <AppText variant="micro" tone="muted">
            Goal
          </AppText>
          <AppText variant="title" weight="600" display>
            {Math.round(progress.target.calories).toLocaleString()}
          </AppText>
        </View>
        <View style={{ alignItems: 'center', minWidth: 72 }}>
          <AppText variant="micro" tone="muted">
            {over ? 'Over by' : 'Remaining'}
          </AppText>
          <AppText variant="title" weight="600" display tone={over ? 'danger' : 'accent'}>
            {Math.abs(Math.round(progress.caloriesRemaining)).toLocaleString()}
          </AppText>
        </View>
      </Card>

      <Card style={{ gap: 12 }}>
        {rows.map((r) =>
          progress.target[r.key] !== undefined || (progress.consumed[r.key] ?? 0) > 0 ? (
            <MacroBar
              key={r.key}
              label={r.label}
              consumed={progress.consumed[r.key] ?? 0}
              target={progress.target[r.key]}
              color={r.color}
              unit={r.unit}
            />
          ) : null,
        )}
      </Card>

      {progress.consumed.micros ? (
        <Card style={{ gap: 6 }}>
          <AppText variant="caption" tone="secondary">
            Micronutrients logged
          </AppText>
          {Object.entries(progress.consumed.micros).map(([name, m]) => (
            <View key={name} style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <AppText variant="caption" tone="secondary">
                {name}
              </AppText>
              <AppText variant="caption">
                {roundForDisplay(m.amount)} {m.unit}
              </AppText>
            </View>
          ))}
        </Card>
      ) : null}

      <Button title="Done" variant="secondary" onPress={() => goBackOrHome(router)} />
    </Screen>
  );
}
