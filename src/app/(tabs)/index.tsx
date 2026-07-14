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
import { formatDayKey } from '@/utils/date';
import {
  AppText,
  Button,
  Card,
  DashboardHeader,
  FoodImage,
  ListRow,
  MacroSummary,
  ProgressRing,
  Screen,
  SectionHeader,
} from '@/ui/components';
import { useTheme } from '@/ui/theme/ThemeProvider';
import { spacing } from '@/ui/theme/tokens';

export default function TodayScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const date = useUiStore((s) => s.selectedDate);
  const setSelectedDate = useUiStore((s) => s.setSelectedDate);
  const setTargetMeal = useUiStore((s) => s.setTargetMeal);
  const progress = useDayProgress(date);
  const week = useWeekProgress(date);
  const entries = useDiaryEntries(date);
  const categories = useMealCategories();
  const { history } = useRepos();

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
      <DashboardHeader date={date} onDateChange={setSelectedDate} />

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
          <View style={{ flex: 1, gap: 10 }}>
            <AppText
              variant="heading"
              weight="600"
              display
              tone="primary"
              style={{ fontSize: 20, lineHeight: 24, letterSpacing: -0.2, marginBottom: 4 }}
            >
              Daily Goals
            </AppText>
            <Row label="Calorie Goal" value={Math.round(target).toLocaleString()} />
            <Row
              label="Protein Goal"
              value={Math.round(progress?.target.protein ?? 0).toLocaleString()}
            />
            <Row
              label="Fat Goal"
              value={Math.round(progress?.target.fat ?? 0).toLocaleString()}
            />
          </View>
        </View>
      </Card>

      <MacroSummary
        macros={[
          {
            label: 'Protein',
            consumed: progress?.consumed.protein ?? 0,
            target: progress?.target.protein,
          },
          {
            label: 'Carbs',
            consumed: progress?.consumed.carbs ?? 0,
            target: progress?.target.carbs,
          },
          {
            label: 'Fat',
            consumed: progress?.consumed.fat ?? 0,
            target: progress?.target.fat,
          },
        ]}
      />

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
              const isSelected = d.date === date;
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
                  <AppText
                    variant="micro"
                    tone={isSelected ? 'accent' : 'muted'}
                    weight={isSelected ? '600' : '400'}
                  >
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
              setSelectedDate(date);
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
              setSelectedDate(date);
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
            setSelectedDate(date);
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
