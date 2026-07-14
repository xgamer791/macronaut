import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  LayoutChangeEvent,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  useWindowDimensions,
} from 'react-native';
import Animated, {
  Easing,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useWeekProgress, useWeekStart } from '@/state/queries';
import {
  DayKey,
  addMonths,
  formatDayKey,
  formatMonthYear,
  monthCalendarDays,
  monthStartOf,
  todayKey,
  weekDays,
  weekdayLetter,
  weekdayLetters,
} from '@/utils/date';
import { useTheme } from '@/ui/theme/ThemeProvider';
import { spacing, touchTarget } from '@/ui/theme/tokens';
import { AppText } from './AppText';

const BUBBLE_SIZE = 36;
const BUBBLE_SLOT = 48;
const CALENDAR_RADIUS = 22;
const SPRING = { damping: 20, stiffness: 280, mass: 0.8 };

export interface DashboardHeaderProps {
  date: DayKey;
  onDateChange: (date: DayKey) => void;
  /** Optional trailing actions (status icons, etc.). */
  right?: React.ReactNode;
}

/**
 * Compact dashboard header: expandable day title + floating month calendar +
 * weekly day-bubble strip. Reusable across diary-style screens.
 */
export function DashboardHeader({ date, onDateChange, right }: DashboardHeaderProps) {
  const { colors, resolved } = useTheme();
  const weekStart = useWeekStart();
  const week = useWeekProgress(date);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [calendarEpoch, setCalendarEpoch] = useState(0);

  const completedDays = useMemo(() => {
    const set = new Set<DayKey>();
    for (const d of week?.days ?? []) {
      if (d.consumed.calories > 0) set.add(d.date);
    }
    return set;
  }, [week]);

  const title = formatDayKey(date);
  const isToday = date === todayKey();

  const openCalendar = useCallback(() => {
    void Haptics.selectionAsync();
    setCalendarEpoch((n) => n + 1);
    setCalendarOpen(true);
  }, []);

  const closeCalendar = useCallback(() => setCalendarOpen(false), []);

  const selectDate = useCallback(
    (next: DayKey) => {
      void Haptics.selectionAsync();
      onDateChange(next);
      setCalendarOpen(false);
    },
    [onDateChange],
  );

  return (
    <View style={styles.root}>
      <View style={styles.titleRow}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${title}. Open calendar`}
          accessibilityHint="Shows a month calendar to pick a day"
          accessibilityState={{ expanded: calendarOpen }}
          onPress={openCalendar}
          hitSlop={8}
          style={styles.titlePress}
        >
          <AppText variant="title" weight="600" display style={styles.titleText}>
            {title}
          </AppText>
          <AnimatedChevron open={calendarOpen} color={colors.textPrimary} />
        </Pressable>
        {right ? <View style={styles.right}>{right}</View> : null}
      </View>

      {!isToday ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Back to today"
          onPress={() => selectDate(todayKey())}
          style={styles.backToday}
        >
          <AppText variant="micro" tone="accent" weight="600">
            Back to today
          </AppText>
        </Pressable>
      ) : null}

      <WeekBubbleRow
        date={date}
        weekStart={weekStart}
        completedDays={completedDays}
        onSelect={selectDate}
      />

      <CalendarDropdown
        key={calendarEpoch}
        visible={calendarOpen}
        selected={date}
        weekStart={weekStart}
        onClose={closeCalendar}
        onSelect={selectDate}
        surface={resolved === 'dark' ? 'rgba(30, 36, 43, 0.94)' : 'rgba(255, 255, 255, 0.96)'}
        border={colors.border}
        accent={colors.accent}
        onAccent={colors.onAccent}
        textPrimary={colors.textPrimary}
        textMuted={colors.textMuted}
        textSecondary={colors.textSecondary}
        overlay={colors.overlay}
      />
    </View>
  );
}

function AnimatedChevron({ open, color }: { open: boolean; color: string }) {
  const rotation = useSharedValue(0);
  useEffect(() => {
    rotation.value = withSpring(open ? 1 : 0, SPRING);
  }, [open, rotation]);
  const style = useAnimatedStyle(() => ({
    transform: [{ rotate: `${interpolate(rotation.value, [0, 1], [0, 180])}deg` }],
  }));
  return (
    <Animated.View style={style}>
      <Ionicons name="chevron-down" size={18} color={color} />
    </Animated.View>
  );
}

function WeekBubbleRow({
  date,
  weekStart,
  completedDays,
  onSelect,
}: {
  date: DayKey;
  weekStart: 'sunday' | 'monday';
  completedDays: Set<DayKey>;
  onSelect: (date: DayKey) => void;
}) {
  const { colors } = useTheme();
  const days = useMemo(() => weekDays(date, weekStart), [date, weekStart]);
  const today = todayKey();
  const scrollRef = useRef<ScrollView>(null);
  const { width: windowWidth } = useWindowDimensions();
  const [rowWidth, setRowWidth] = useState(windowWidth - spacing.lg * 2);

  const onRowLayout = (e: LayoutChangeEvent) => {
    setRowWidth(e.nativeEvent.layout.width);
  };

  // Auto-center the selected bubble when the week or selection changes.
  useEffect(() => {
    const index = days.indexOf(date);
    if (index < 0) return;
    const contentWidth = days.length * BUBBLE_SLOT;
    if (contentWidth <= rowWidth) return;
    const target = index * BUBBLE_SLOT + BUBBLE_SLOT / 2 - rowWidth / 2;
    const max = Math.max(0, contentWidth - rowWidth);
    scrollRef.current?.scrollTo({ x: Math.max(0, Math.min(target, max)), animated: true });
  }, [date, days, rowWidth]);

  const needsScroll = days.length * BUBBLE_SLOT > rowWidth + 1;

  return (
    <View onLayout={onRowLayout} style={styles.bubbleRowWrap}>
      <ScrollView
        ref={scrollRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        scrollEnabled={needsScroll}
        contentContainerStyle={[
          styles.bubbleRow,
          !needsScroll && { width: rowWidth, justifyContent: 'space-between' },
        ]}
      >
        {days.map((day) => {
          const selected = day === date;
          const isToday = day === today;
          const completed = completedDays.has(day);
          const dayNum = Number(day.slice(8));
          return (
            <DayBubble
              key={day}
              letter={weekdayLetter(day)}
              dayNum={dayNum}
              selected={selected}
              isToday={isToday}
              completed={completed}
              accent={colors.accent}
              onAccent={colors.onAccent}
              textMuted={colors.textMuted}
              textPrimary={colors.textPrimary}
              border={colors.borderStrong}
              slotWidth={needsScroll ? BUBBLE_SLOT : undefined}
              onPress={() => onSelect(day)}
            />
          );
        })}
      </ScrollView>
    </View>
  );
}

function DayBubble({
  letter,
  dayNum,
  selected,
  isToday,
  completed,
  accent,
  onAccent,
  textMuted,
  textPrimary,
  border,
  slotWidth,
  onPress,
}: {
  letter: string;
  dayNum: number;
  selected: boolean;
  isToday: boolean;
  completed: boolean;
  accent: string;
  onAccent: string;
  textMuted: string;
  textPrimary: string;
  border: string;
  slotWidth?: number;
  onPress: () => void;
}) {
  const scale = useSharedValue(1);
  useEffect(() => {
    if (selected) {
      scale.value = withSpring(1.06, SPRING);
      scale.value = withSpring(1, { ...SPRING, stiffness: 200 });
    }
  }, [selected, scale]);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const filled = selected;
  const outlineToday = isToday && !selected;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${letter} ${dayNum}${isToday ? ', today' : ''}${selected ? ', selected' : ''}${completed ? ', logged' : ''}`}
      accessibilityState={{ selected }}
      onPress={onPress}
      style={[styles.bubbleSlot, slotWidth != null && { width: slotWidth }]}
    >
      <AppText
        variant="micro"
        weight={selected || isToday ? '600' : '400'}
        style={{ color: selected || isToday ? textPrimary : textMuted, marginBottom: 6 }}
      >
        {letter}
      </AppText>
      <Animated.View style={[styles.bubbleOuter, animStyle]}>
        {completed && !filled ? (
          <View
            pointerEvents="none"
            style={[
              styles.completionRing,
              { borderColor: accent + '66' },
            ]}
          />
        ) : null}
        <View
          style={[
            styles.bubble,
            {
              backgroundColor: filled ? accent : 'transparent',
              borderColor: outlineToday ? accent : filled ? accent : border,
              borderWidth: outlineToday || filled ? 2 : 1.5,
            },
          ]}
        >
          <AppText
            variant="caption"
            weight="600"
            display
            style={{ color: filled ? onAccent : isToday ? accent : textPrimary }}
          >
            {dayNum}
          </AppText>
        </View>
      </Animated.View>
    </Pressable>
  );
}

function CalendarDropdown({
  visible,
  selected,
  weekStart,
  onClose,
  onSelect,
  surface,
  border,
  accent,
  onAccent,
  textPrimary,
  textMuted,
  textSecondary,
  overlay,
}: {
  visible: boolean;
  selected: DayKey;
  weekStart: 'sunday' | 'monday';
  onClose: () => void;
  onSelect: (date: DayKey) => void;
  surface: string;
  border: string;
  accent: string;
  onAccent: string;
  textPrimary: string;
  textMuted: string;
  textSecondary: string;
  overlay: string;
}) {
  const insets = useSafeAreaInsets();
  const [month, setMonth] = useState(() => monthStartOf(selected));
  const [mounted, setMounted] = useState(visible);
  const [prevVisible, setPrevVisible] = useState(visible);
  const progress = useSharedValue(0);

  // Keep the modal mounted through the exit animation (React-recommended prop→state sync).
  if (visible !== prevVisible) {
    setPrevVisible(visible);
    if (visible) setMounted(true);
  }

  useEffect(() => {
    if (visible) {
      progress.value = 0;
      progress.value = withSpring(1, SPRING);
    } else {
      progress.value = withTiming(0, { duration: 200, easing: Easing.out(Easing.cubic) }, (finished) => {
        if (finished) runOnJS(setMounted)(false);
      });
    }
  }, [visible, progress]);

  const letters = useMemo(() => weekdayLetters(weekStart), [weekStart]);
  const cells = useMemo(() => monthCalendarDays(month, weekStart), [month, weekStart]);
  const today = todayKey();

  const cardStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [
      { translateY: interpolate(progress.value, [0, 1], [-10, 0]) },
      { scale: interpolate(progress.value, [0, 1], [0.96, 1]) },
    ],
  }));

  const scrimStyle = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0, 1], [0, 1]),
  }));

  if (!mounted) return null;

  return (
    <Modal visible={mounted} transparent animationType="none" onRequestClose={onClose}>
      <View style={styles.modalRoot} pointerEvents="box-none">
        <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: overlay }, scrimStyle]}>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel="Dismiss calendar"
          />
        </Animated.View>

        <Animated.View
          style={[
            styles.calendarCard,
            {
              marginTop: insets.top + spacing.sm,
              backgroundColor: surface,
              borderColor: border,
              shadowColor: '#000',
            },
            cardStyle,
          ]}
        >
          <View style={styles.calendarHeader}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Previous month"
              onPress={() => setMonth((m) => addMonths(m, -1))}
              style={styles.monthArrow}
            >
              <Ionicons name="chevron-back" size={20} color={textPrimary} />
            </Pressable>
            <AppText variant="heading" weight="600" display>
              {formatMonthYear(month)}
            </AppText>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Next month"
              onPress={() => setMonth((m) => addMonths(m, 1))}
              style={styles.monthArrow}
            >
              <Ionicons name="chevron-forward" size={20} color={textPrimary} />
            </Pressable>
          </View>

          <View style={styles.weekdayRow}>
            {letters.map((letter, i) => (
              <View key={`${letter}-${i}`} style={styles.calCell}>
                <AppText variant="micro" weight="600" style={{ color: textMuted }}>
                  {letter}
                </AppText>
              </View>
            ))}
          </View>

          <View style={styles.calGrid}>
            {cells.map((day, i) => {
              if (!day) {
                return <View key={`empty-${i}`} style={styles.calCell} />;
              }
              const isSelected = day === selected;
              const isToday = day === today;
              return (
                <Pressable
                  key={day}
                  accessibilityRole="button"
                  accessibilityLabel={`${formatDayKey(day)}${isToday ? ', today' : ''}`}
                  accessibilityState={{ selected: isSelected }}
                  onPress={() => onSelect(day)}
                  style={styles.calCell}
                >
                  <View
                    style={[
                      styles.calDay,
                      isSelected && { backgroundColor: accent },
                      isToday && !isSelected && { borderColor: accent, borderWidth: 1.5 },
                      !isSelected && !isToday && { backgroundColor: 'transparent' },
                    ]}
                  >
                    <AppText
                      variant="caption"
                      weight={isSelected || isToday ? '600' : '400'}
                      display={isSelected || isToday}
                      style={{
                        color: isSelected ? onAccent : isToday ? accent : textPrimary,
                      }}
                    >
                      {Number(day.slice(8))}
                    </AppText>
                  </View>
                </Pressable>
              );
            })}
          </View>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Jump to today"
            onPress={() => onSelect(today)}
            style={styles.jumpToday}
          >
            <AppText variant="caption" tone="accent" weight="600">
              Today
            </AppText>
            <AppText variant="micro" style={{ color: textSecondary }}>
              {formatMonthYear(today)} · {Number(today.slice(8))}
            </AppText>
          </Pressable>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    gap: spacing.sm,
    zIndex: 2,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: touchTarget,
  },
  titlePress: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minHeight: touchTarget,
    paddingRight: spacing.sm,
  },
  titleText: {
    letterSpacing: -0.3,
  },
  right: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  backToday: {
    alignSelf: 'flex-start',
    marginTop: -spacing.xs,
    paddingVertical: 2,
  },
  bubbleRowWrap: {
    marginTop: spacing.xs,
  },
  bubbleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 2,
  },
  bubbleSlot: {
    alignItems: 'center',
    minWidth: BUBBLE_SLOT,
    minHeight: touchTarget + 8,
  },
  bubbleOuter: {
    width: BUBBLE_SIZE + 6,
    height: BUBBLE_SIZE + 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  completionRing: {
    position: 'absolute',
    width: BUBBLE_SIZE + 6,
    height: BUBBLE_SIZE + 6,
    borderRadius: (BUBBLE_SIZE + 6) / 2,
    borderWidth: 1.5,
  },
  bubble: {
    width: BUBBLE_SIZE,
    height: BUBBLE_SIZE,
    borderRadius: BUBBLE_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalRoot: {
    flex: 1,
    paddingHorizontal: spacing.lg,
  },
  calendarCard: {
    borderRadius: CALENDAR_RADIUS,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    paddingBottom: spacing.lg,
    shadowOpacity: 0.28,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 12 },
    elevation: 16,
  },
  calendarHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
    minHeight: touchTarget,
  },
  monthArrow: {
    width: touchTarget,
    height: touchTarget,
    alignItems: 'center',
    justifyContent: 'center',
  },
  weekdayRow: {
    flexDirection: 'row',
    marginBottom: spacing.xs,
  },
  calGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  calCell: {
    width: '14.2857%',
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
    maxHeight: 44,
  },
  calDay: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  jumpToday: {
    marginTop: spacing.sm,
    paddingTop: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(128,128,128,0.25)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: touchTarget,
  },
});
