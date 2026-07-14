import { useRouter } from 'expo-router';
import React from 'react';
import { Pressable, View } from 'react-native';
import { roundForDisplay } from '@/domain/nutrition';
import { useRepos } from '@/state/AppProvider';
import {
  keys,
  useDayProgress,
  useDiaryEntries,
  useMealCategories,
  useWeekProgress,
} from '@/state/queries';
import { useUiStore } from '@/state/uiStore';
import { useQuery } from '@tanstack/react-query';
import { formatDayKey, todayKey } from '@/utils/date';
import {
  AppText,
  Button,
  Card,
  FoodImage,
  ListRow,
  MacroBar,
  ProgressRing,
  Screen,
  SectionHeader,
} from '@/ui/components';
import { useTheme } from '@/ui/theme/ThemeProvider';
import { spacing } from '@/ui/theme/tokens';

export default function TodayScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const today = todayKey();
  const progress = useDayProgress(today);
  const week = useWeekProgress(today);
  const entries = useDiaryEntries(today);
  const categories = useMealCategories();
  const { history } = useRepos();
  const setSelectedDate = useUiStore((s) => s.setSelectedDate);
  const setTargetMeal = useUiStore((s) => s.setTargetMeal);

  const recents = useQuery({ queryKey: keys.recents, queryFn: () => history.recentFoods(5) });
  const frequents = useQuery({
    queryKey: keys.frequents(),
    queryFn: () => history.frequentFoods(5),
  });

  const consumed = progress?.consumed.calories ?? 0;
  const target = progress?.target.calories ?? 0;
  const remaining = target - consumed;
  const over = remaining < 0;

  const mealTotals = new Map<string, number>();
  for (const e of entries.data ?? []) {
    mealTotals.set(e.meal, (mealTotals.get(e.meal) ?? 0) + e.nutrition.calories);
  }

  return (
    <Screen tabBarSpace>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <AppText variant="title" weight="600" display>
          Today
        </AppText>
        <AppText variant="caption" tone="secondary">
          {formatDayKey(today) === 'Today' ? new Date().toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' }) : formatDayKey(today)}
        </AppText>
      </View>

      <Card>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xl }}>
          <ProgressRing
            progress={target > 0 ? consumed / target : 0}
            size={124}
            strokeWidth={11}
            accessibilityLabel={`Calories: ${Math.round(consumed)} of ${Math.round(target)}`}
          >
            <View style={{ alignItems: 'center' }}>
              <AppText variant="title" weight="600" display>
                {Math.round(Math.abs(remaining)).toLocaleString()}
              </AppText>
              <AppText variant="micro" tone={over ? 'danger' : 'muted'}>
                {over ? 'kcal over' : 'kcal left'}
              </AppText>
            </View>
          </ProgressRing>
          <View style={{ flex: 1, gap: 6 }}>
            <Row label="Goal" value={Math.round(target).toLocaleString()} />
            <Row label="Food" value={Math.round(consumed).toLocaleString()} />
            <Row
              label={over ? 'Over by' : 'Remaining'}
              value={Math.round(Math.abs(remaining)).toLocaleString()}
              emphasized
              danger={over}
            />
          </View>
        </View>
      </Card>

      <Card style={{ gap: spacing.md }}>
        <MacroBar
          label="Protein"
          consumed={progress?.consumed.protein ?? 0}
          target={progress?.target.protein}
          color={colors.protein}
        />
        <MacroBar
          label="Carbs"
          consumed={progress?.consumed.carbs ?? 0}
          target={progress?.target.carbs}
          color={colors.carbs}
        />
        <MacroBar
          label="Fat"
          consumed={progress?.consumed.fat ?? 0}
          target={progress?.target.fat}
          color={colors.fat}
        />
        <MacroBar
          label="Fiber"
          consumed={progress?.consumed.fiber ?? 0}
          target={progress?.target.fiber}
          color={colors.fiber}
        />
      </Card>

      {week ? (
        <Card style={{ gap: spacing.sm }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <AppText variant="caption" tone="secondary">
              This week
            </AppText>
            <AppText variant="caption" tone={week.weeklyRemaining < 0 ? 'danger' : 'secondary'}>
              {Math.round(Math.abs(week.weeklyRemaining)).toLocaleString()} kcal{' '}
              {week.weeklyRemaining < 0 ? 'over' : 'left'} of{' '}
              {Math.round(week.weeklyTarget.calories).toLocaleString()}
            </AppText>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 6, height: 56 }}>
            {week.days.map((d) => {
              const ratio = d.target.calories > 0 ? d.consumed.calories / d.target.calories : 0;
              const isToday = d.date === today;
              return (
                <View key={d.date} style={{ flex: 1, alignItems: 'center', gap: 3 }}>
                  <View
                    accessible
                    accessibilityLabel={`${formatDayKey(d.date)}: ${Math.round(d.consumed.calories)} of ${Math.round(d.target.calories)} calories`}
                    style={{
                      width: '100%',
                      height: Math.max(Math.min(ratio, 1.2) * 44, 3),
                      borderRadius: 3,
                      backgroundColor: d.overCalories
                        ? colors.danger
                        : d.consumed.calories > 0
                          ? colors.accent
                          : colors.track,
                    }}
                  />
                  <AppText variant="micro" tone={isToday ? 'accent' : 'muted'} weight={isToday ? '600' : '400'}>
                    {d.date.slice(8)}
                  </AppText>
                </View>
              );
            })}
          </View>
          <View style={{ flexDirection: 'row', gap: spacing.lg }}>
            <AppText variant="micro" tone="secondary">
              Protein avg {roundForDisplay(week.averagePerDay.protein ?? 0)}g
            </AppText>
            <AppText variant="micro" tone="secondary">
              {week.daysUnderCalories} within · {week.daysOverCalories} over
            </AppText>
          </View>
        </Card>
      ) : null}

      <SectionHeader
        title="Meals"
        right={
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Open diary"
            onPress={() => {
              setSelectedDate(today);
              router.push('/diary');
            }}
            style={{ minHeight: 44, justifyContent: 'center' }}
          >
            <AppText variant="caption" tone="accent" weight="600">
              Open diary
            </AppText>
          </Pressable>
        }
      />
      <Card padded={false} style={{ paddingHorizontal: spacing.lg, paddingVertical: spacing.xs }}>
        {(categories.data ?? []).map((cat) => (
          <ListRow
            key={cat.id}
            title={cat.name}
            value={`${Math.round(mealTotals.get(cat.id) ?? 0)} kcal`}
            onPress={() => {
              setSelectedDate(today);
              setTargetMeal(cat.id);
              router.push('/add');
            }}
            accessibilityHint="Add food to this meal"
          />
        ))}
      </Card>

      <View style={{ flexDirection: 'row', gap: spacing.md }}>
        <Button
          title="Quick add"
          variant="secondary"
          style={{ flex: 1 }}
          onPress={() => {
            setSelectedDate(today);
            router.push('/manual-entry');
          }}
        />
        <Button title="Add food" style={{ flex: 1 }} onPress={() => router.push('/add')} />
      </View>

      {(recents.data?.length ?? 0) > 0 ? (
        <>
          <SectionHeader title="Recent" />
          <Card padded={false} style={{ paddingHorizontal: spacing.lg, paddingVertical: spacing.xs }}>
            {recents.data!.map((r) => (
              <ListRow
                key={r.foodKey}
                left={r.imageUrl ? <FoodImage uri={r.imageUrl} size={36} /> : undefined}
                title={r.name}
                subtitle="Recently logged"
                onPress={() => router.push('/add')}
              />
            ))}
          </Card>
        </>
      ) : null}

      {(frequents.data?.length ?? 0) > 0 ? (
        <>
          <SectionHeader title="Frequent" />
          <Card padded={false} style={{ paddingHorizontal: spacing.lg, paddingVertical: spacing.xs }}>
            {frequents.data!.map((f) => (
              <ListRow
                key={f.foodKey}
                left={f.imageUrl ? <FoodImage uri={f.imageUrl} size={36} /> : undefined}
                title={f.name}
                subtitle={`Logged ${f.count} time${f.count === 1 ? '' : 's'}`}
                onPress={() => router.push('/add')}
              />
            ))}
          </Card>
        </>
      ) : null}
    </Screen>
  );
}

function Row({
  label,
  value,
  emphasized,
  danger,
}: {
  label: string;
  value: string;
  emphasized?: boolean;
  danger?: boolean;
}) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
      <AppText variant="caption" tone="secondary">
        {label}
      </AppText>
      <AppText
        variant="caption"
        weight={emphasized ? '600' : '400'}
        tone={danger ? 'danger' : 'primary'}
      >
        {value}
      </AppText>
    </View>
  );
}
