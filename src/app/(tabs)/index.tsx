import { useRouter } from 'expo-router';
import React from 'react';
import { Pressable, View } from 'react-native';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';
import { roundForDisplay } from '@/domain/nutrition';
import {
  useActivityEntries,
  useDayProgress,
  useDiaryEntries,
  useMealCategories,
  useWeekProgress,
} from '@/state/queries';
import { useUiStore } from '@/state/uiStore';
import { formatDayKey } from '@/utils/date';
import {
  ActivityLogList,
  AppText,
  BarEntranceProvider,
  Card,
  DashboardHeader,
  MacroSummary,
  MealLogList,
  ProgressRing,
  Screen,
  SectionHeader,
} from '@/ui/components';
import { useBarEntranceProgress } from '@/ui/motion/barEntrance';
import { useTheme } from '@/ui/theme/ThemeProvider';
import { spacing } from '@/ui/theme/tokens';
import { ActivityType } from '@/repositories/types';

export default function TodayScreen() {
  return (
    <BarEntranceProvider pageKey="today">
      <TodayBody />
    </BarEntranceProvider>
  );
}

function TodayBody() {
  const router = useRouter();
  const { colors } = useTheme();
  const date = useUiStore((s) => s.selectedDate);
  const setSelectedDate = useUiStore((s) => s.setSelectedDate);
  const setTargetMeal = useUiStore((s) => s.setTargetMeal);
  const progress = useDayProgress(date);
  const week = useWeekProgress(date);
  const entries = useDiaryEntries(date);
  const activities = useActivityEntries(date);
  const categories = useMealCategories();

  const consumed = progress?.consumed.calories ?? 0;
  const burned = progress?.burned ?? 0;
  const target = progress?.target.calories ?? 0;
  const remaining = progress?.caloriesRemaining ?? target - consumed;
  const over = remaining < 0;

  const mealTotals = new Map<string, number>();
  for (const e of entries.data ?? []) {
    mealTotals.set(e.meal, (mealTotals.get(e.meal) ?? 0) + e.nutrition.calories);
  }

  const burnedByType = new Map<ActivityType, number>();
  for (const a of activities.data ?? []) {
    burnedByType.set(a.activityType, (burnedByType.get(a.activityType) ?? 0) + a.caloriesBurned);
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
            {burned > 0 ? (
              <Row label="Exercise" value={`+${Math.round(burned).toLocaleString()}`} emphasized />
            ) : null}
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
              const ratio = d.target.calories > 0 ? d.netCalories / d.target.calories : 0;
              const isSelected = d.date === date;
              const barHeight = Math.max(Math.min(Math.max(ratio, 0), 1.2) * 44, 3);
              return (
                <View key={d.date} style={{ flex: 1, alignItems: 'center', gap: 3 }}>
                  <WeekMiniBar
                    height={barHeight}
                    color={
                      d.overCalories
                        ? colors.danger
                        : d.consumed.calories > 0 || d.burned > 0
                          ? colors.accent
                          : colors.track
                    }
                    accessibilityLabel={`${formatDayKey(d.date)}: ${Math.round(d.consumed.calories)} food, ${Math.round(d.burned)} burned, of ${Math.round(d.target.calories)} calories`}
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
            accessibilityLabel="View all diary entries"
            onPress={() => {
              setSelectedDate(date);
              router.push('/diary');
            }}
            style={{ minHeight: 44, justifyContent: 'center' }}
          >
            <AppText variant="caption" tone="secondary" weight="600">
              View all
            </AppText>
          </Pressable>
        }
      />
      <MealLogList
        categories={categories.data ?? []}
        mealTotals={mealTotals}
        onLog={(mealId) => {
          setSelectedDate(date);
          setTargetMeal(mealId);
          router.push('/add');
        }}
        onOpenMeal={(mealId) => {
          setSelectedDate(date);
          setTargetMeal(mealId);
          router.push('/diary');
        }}
      />

      <SectionHeader
        title="Activity"
        right={
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Open activity tracking"
            onPress={() => router.push('/activity')}
            style={{ minHeight: 44, justifyContent: 'center' }}
          >
            <AppText variant="caption" tone="secondary" weight="600">
              View all
            </AppText>
          </Pressable>
        }
      />
      <ActivityLogList
        burnedByType={burnedByType}
        onLog={(type) => {
          setSelectedDate(date);
          router.push({ pathname: '/log-activity', params: { type } });
        }}
        onOpenType={(type) => {
          setSelectedDate(date);
          router.push({ pathname: '/activity', params: { type } });
        }}
      />
    </Screen>
  );
}

function WeekMiniBar({
  height,
  color,
  accessibilityLabel,
}: {
  height: number;
  color: string;
  accessibilityLabel: string;
}) {
  const entrance = useBarEntranceProgress();
  const style = useAnimatedStyle(() => ({
    height: Math.max(height * entrance.value, 1),
  }));

  return (
    <Animated.View
      accessible
      accessibilityLabel={accessibilityLabel}
      style={[
        {
          width: '100%',
          borderRadius: 3,
          backgroundColor: color,
        },
        style,
      ]}
    />
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
