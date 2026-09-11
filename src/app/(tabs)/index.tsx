import { Ionicons } from '@expo/vector-icons';
import { Image, type ImageSource } from 'expo-image';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';
import { ActivityType } from '@/repositories/types';
import { useAuth } from '@/state/AuthProvider';
import {
  useActivityEntries,
  useDayProgress,
  useDiaryEntries,
  useMealCategories,
  useNotifications,
} from '@/state/queries';
import { useUiStore } from '@/state/uiStore';
import {
  ActivityLogList,
  AppText,
  BarEntranceProvider,
  CalendarPanel,
  HeaderMenu,
  Screen,
  SectionHeader,
  TodayDashboard,
} from '@/ui/components';
import { TODAY } from '@/ui/components/TodayDashboard';
import { useTheme } from '@/ui/theme/ThemeProvider';
import { radius, spacing } from '@/ui/theme/tokens';
import { addDays, formatDiaryNavLabel } from '@/utils/date';

const MEAL_IMAGES: Record<string, ImageSource> = {
  breakfast: require('../../../assets/images/today/meal-breakfast.png'),
  lunch: require('../../../assets/images/today/meal-lunch.png'),
  dinner: require('../../../assets/images/today/meal-dinner.png'),
  snacks: require('../../../assets/images/today/meal-snacks.png'),
  snack: require('../../../assets/images/today/meal-snacks.png'),
};

/** Today — mint remaining-calorie diary cloned from the reference. */
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
  const { height } = useWindowDimensions();
  const { signedIn } = useAuth();
  const date = useUiStore((s) => s.selectedDate);
  const setSelectedDate = useUiStore((s) => s.setSelectedDate);
  const setTargetMeal = useUiStore((s) => s.setTargetMeal);
  const progress = useDayProgress(date);
  const entries = useDiaryEntries(date);
  const activities = useActivityEntries(date);
  const categories = useMealCategories();
  const notifications = useNotifications();
  const [menuOpen, setMenuOpen] = useState(false);
  const [calendarOpen, setCalendarOpen] = useState(false);

  const consumed = progress?.consumed.calories ?? 0;
  const burned = progress?.burned ?? 0;
  const target = progress?.target.calories ?? 0;
  const remaining = progress?.caloriesRemaining ?? target;

  const mealTotals = new Map<string, number>();
  const mealTimes = new Map<string, string>();
  const mealTitles = new Map<string, string>();
  for (const e of entries.data ?? []) {
    mealTotals.set(e.meal, (mealTotals.get(e.meal) ?? 0) + e.nutrition.calories);
    if (!mealTimes.has(e.meal) && e.createdAt) {
      mealTimes.set(e.meal, formatEntryTime(e.createdAt));
    }
    if (!mealTitles.has(e.meal) && e.name?.trim()) {
      mealTitles.set(e.meal, e.name.trim());
    }
  }

  const burnedByType = new Map<ActivityType, number>();
  for (const a of activities.data ?? []) {
    burnedByType.set(a.activityType, (burnedByType.get(a.activityType) ?? 0) + a.caloriesBurned);
  }

  const macros = [
    {
      label: 'Carbs',
      consumed: progress?.consumed.carbs ?? 0,
      target: progress?.target.carbs ?? 0,
      bar: TODAY.carbsBar,
    },
    {
      label: 'Protein',
      consumed: progress?.consumed.protein ?? 0,
      target: progress?.target.protein ?? 0,
      bar: TODAY.proteinBar,
    },
    {
      label: 'Fat',
      consumed: progress?.consumed.fat ?? 0,
      target: progress?.target.fat ?? 0,
      bar: TODAY.fatBar,
    },
  ];

  return (
    <Screen tabBarSpace={false} padded={false} safeTop={false} backgroundColor={TODAY.limeTop}>
      <TodayDashboard
        dateLabel={formatDiaryNavLabel(date)}
        consumed={consumed}
        burned={burned}
        remaining={remaining}
        goal={target}
        macros={macros}
        notificationDot={(notifications.data?.unreadCount ?? 0) > 0}
        minHeight={height}
        onLogoPress={() => setMenuOpen(true)}
        onProfilePress={() => router.push('/profile')}
        onNotifyPress={() => router.push(signedIn ? '/notifications' : '/login')}
        onPrevDate={() => setSelectedDate(addDays(date, -1))}
        onNextDate={() => setSelectedDate(addDays(date, 1))}
        onDatePress={() => setCalendarOpen(true)}
        onRingPress={() => {
          setSelectedDate(date);
          router.push(consumed > 0 ? '/day-detail' : '/add');
        }}
        onMacroPress={() => {
          setSelectedDate(date);
          router.push('/day-detail');
        }}
      />

      <View style={styles.body}>
        {/* —— Meals —— */}
        <View style={styles.section}>
        <SectionHeader flush title="Meals" />

        <View
          style={[
            styles.mealsCard,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
        >
          {(categories.data ?? []).map((cat, idx, arr) => {
            const kcal = Math.round(mealTotals.get(cat.id) ?? 0);
            const time = mealTimes.get(cat.id);
            const title = mealTitles.get(cat.id) ?? cat.name;
            const image = MEAL_IMAGES[cat.id] ?? MEAL_IMAGES.lunch;
            return (
              <Pressable
                key={cat.id}
                accessibilityRole="button"
                accessibilityLabel={`${title}, ${kcal} kcal`}
                onPress={() => {
                  setSelectedDate(date);
                  setTargetMeal(cat.id);
                  router.push(kcal > 0 ? '/day-detail' : '/add');
                }}
                style={[
                  styles.mealRow,
                  idx < arr.length - 1 && {
                    borderBottomWidth: StyleSheet.hairlineWidth,
                    borderBottomColor: colors.border,
                  },
                ]}
              >
                <Image source={image} style={styles.mealThumb} contentFit="cover" />
                <View style={styles.mealCopy}>
                  <AppText variant="body" weight="600" numberOfLines={1}>
                    {title}
                  </AppText>
                  <AppText variant="caption" tone="muted">
                    {kcal > 0 ? `${kcal.toLocaleString()} kcal` : 'Not logged'}
                  </AppText>
                </View>
                {time ? (
                  <AppText variant="caption" tone="muted" style={{ marginRight: 4 }}>
                    {time}
                  </AppText>
                ) : null}
                <Ionicons name="add" size={22} color={colors.accent} />
              </Pressable>
            );
          })}
        </View>
        </View>

        {/* —— Activity —— */}
        <View style={styles.section}>
        <SectionHeader
          flush
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
        </View>
      </View>

      <HeaderMenu
        visible={menuOpen}
        onClose={() => setMenuOpen(false)}
        extraItems={[
          { href: '/chats', label: 'Chats', icon: 'chatbubble-outline' },
          { href: '/friends', label: 'Friends', icon: 'people-outline' },
          { href: '/groups', label: 'Groups', icon: 'people-circle-outline' },
          { href: '/progress', label: 'Progress', icon: 'stats-chart-outline' },
          { href: '/fasting', label: 'Fasting', icon: 'timer-outline' },
        ]}
      />
      <CalendarPanel
        visible={calendarOpen}
        selected={date}
        dayDetail
        onClose={() => setCalendarOpen(false)}
        onSelect={(next) => {
          setSelectedDate(next);
          setCalendarOpen(false);
        }}
      />
    </Screen>
  );
}

function formatEntryTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

const styles = StyleSheet.create({
  body: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl,
    paddingBottom: spacing.xxl,
    gap: spacing.xl,
    backgroundColor: '#F6F7F9',
  },
  section: {
    gap: spacing.sm,
  },
  mealsCard: {
    borderRadius: radius.lg,
    borderWidth: 1,
    overflow: 'hidden',
  },
  mealRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    gap: spacing.md,
    minHeight: 64,
  },
  mealThumb: {
    width: 48,
    height: 48,
    borderRadius: 24,
  },
  mealCopy: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
});
