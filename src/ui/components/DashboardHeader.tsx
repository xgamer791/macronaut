import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  LayoutChangeEvent,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  useWindowDimensions,
} from 'react-native';
import Animated, {
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useDayNotes, useDayNotesRange, useWeekProgress, useWeekStart } from '@/state/queries';
import {
  DayKey,
  formatDayKey,
  todayKey,
  weekDays,
  weekdayLetter,
} from '@/utils/date';
import { useTheme } from '@/ui/theme/ThemeProvider';
import { spacing, touchTarget } from '@/ui/theme/tokens';
import { AppText } from './AppText';
import { DayInfoPopup } from './DayInfoPopup';
import { DayNotesPopup } from './DayNotesPopup';
import { MonthCalendarPopup } from './MonthCalendarPopup';

const BUBBLE_SIZE = 36;
const BUBBLE_SLOT = 48;
const SPRING = { damping: 20, stiffness: 280, mass: 0.8 };
/** Small gap between the Today title and the floating month calendar. */
const CALENDAR_GAP = 8;

export interface DashboardHeaderProps {
  date: DayKey;
  onDateChange: (date: DayKey) => void;
  /** Optional trailing actions (status icons, etc.). */
  right?: React.ReactNode;
}

/**
 * Compact dashboard header: notes + activity actions, expandable day title,
 * floating liquid-glass month calendar, and weekly day-bubble strip.
 */
export function DashboardHeader({ date, onDateChange, right }: DashboardHeaderProps) {
  const { colors } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const weekStart = useWeekStart();
  const week = useWeekProgress(date);
  const titleRef = useRef<View>(null);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [calendarTop, setCalendarTop] = useState(insets.top + touchTarget + CALENDAR_GAP);
  const [notesOpen, setNotesOpen] = useState(false);
  const [dayInfoOpen, setDayInfoOpen] = useState(false);

  const weekKeys = useMemo(() => weekDays(date, weekStart), [date, weekStart]);
  const notesWeek = useDayNotesRange(weekKeys[0], weekKeys[weekKeys.length - 1]);
  const dayNotes = useDayNotes(date);

  const notedDays = useMemo(() => new Set(notesWeek.data ?? []), [notesWeek.data]);
  const hasNotes = (dayNotes.data?.length ?? 0) > 0;

  const completedDays = useMemo(() => {
    const set = new Set<DayKey>();
    for (const d of week?.days ?? []) {
      if (d.consumed.calories > 0) set.add(d.date);
    }
    return set;
  }, [week]);

  const title = formatDayKey(date);
  const isToday = date === todayKey();
  const today = todayKey();

  const closeCalendar = useCallback(() => setCalendarOpen(false), []);

  const openCalendar = useCallback(() => {
    void Haptics.selectionAsync();
    const finishOpen = (top: number) => {
      setCalendarTop(top);
      setCalendarOpen(true);
    };
    const node = titleRef.current;
    if (node && typeof node.measureInWindow === 'function') {
      node.measureInWindow((_x, y, _w, h) => {
        finishOpen(Math.max(insets.top + spacing.sm, y + h + CALENDAR_GAP));
      });
      return;
    }
    finishOpen(insets.top + touchTarget + spacing.lg + CALENDAR_GAP);
  }, [insets.top]);

  const toggleCalendar = useCallback(() => {
    if (calendarOpen) {
      void Haptics.selectionAsync();
      closeCalendar();
      return;
    }
    openCalendar();
  }, [calendarOpen, closeCalendar, openCalendar]);

  const changeDate = useCallback(
    (next: DayKey) => {
      void Haptics.selectionAsync();
      onDateChange(next);
    },
    [onDateChange],
  );

  /** Select a day; past days also open the day-info glass popup. */
  const selectDay = useCallback(
    (next: DayKey) => {
      changeDate(next);
      if (next < today) {
        closeCalendar();
        setDayInfoOpen(true);
      }
    },
    [changeDate, today, closeCalendar],
  );

  return (
    <View style={styles.root}>
      <View ref={titleRef} style={styles.titleRow} collapsable={false}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${title}. ${calendarOpen ? 'Close' : 'Open'} calendar`}
          accessibilityHint="Shows a month calendar to pick a day"
          accessibilityState={{ expanded: calendarOpen }}
          onPress={toggleCalendar}
          hitSlop={8}
          style={styles.titlePress}
        >
          <AppText variant="title" weight="600" display style={styles.titleText} numberOfLines={1}>
            {title}
          </AppText>
          <AnimatedChevron open={calendarOpen} color={colors.textPrimary} />
        </Pressable>

        <View style={styles.rightActions}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={hasNotes ? 'Manage day notes' : 'Add day notes'}
            onPress={() => {
              void Haptics.selectionAsync();
              setNotesOpen(true);
            }}
            hitSlop={6}
            style={styles.iconBtn}
          >
            <Ionicons
              name={hasNotes ? 'document-text' : 'document-text-outline'}
              size={22}
              color={hasNotes ? colors.accent : colors.textPrimary}
            />
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Open activity"
            onPress={() => {
              void Haptics.selectionAsync();
              router.push('/activity');
            }}
            hitSlop={6}
            style={styles.iconBtn}
          >
            <Ionicons
              name="barbell-outline"
              size={22}
              color={colors.textPrimary}
            />
          </Pressable>
          {right ? <View style={styles.right}>{right}</View> : null}
        </View>
      </View>

      {!isToday ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Back to today"
          onPress={() => changeDate(todayKey())}
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
        notedDays={notedDays}
        onSelect={selectDay}
      />

      <MonthCalendarPopup
        visible={calendarOpen}
        selected={date}
        top={calendarTop}
        onClose={closeCalendar}
        onSelect={selectDay}
      />

      <DayNotesPopup visible={notesOpen} date={date} onClose={() => setNotesOpen(false)} />
      <DayInfoPopup
        visible={dayInfoOpen}
        date={date}
        onClose={() => setDayInfoOpen(false)}
        onEditNotes={() => {
          setDayInfoOpen(false);
          setNotesOpen(true);
        }}
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
  notedDays,
  onSelect,
}: {
  date: DayKey;
  weekStart: 'sunday' | 'monday';
  completedDays: Set<DayKey>;
  notedDays: Set<DayKey>;
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
          const hasNote = notedDays.has(day);
          const dayNum = Number(day.slice(8));
          return (
            <DayBubble
              key={day}
              letter={weekdayLetter(day)}
              dayNum={dayNum}
              selected={selected}
              isToday={isToday}
              completed={completed}
              hasNote={hasNote}
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
  hasNote,
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
  hasNote: boolean;
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
      accessibilityLabel={`${letter} ${dayNum}${isToday ? ', today' : ''}${selected ? ', selected' : ''}${completed ? ', logged' : ''}${hasNote ? ', has notes' : ''}`}
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
            style={[styles.completionRing, { borderColor: accent + '66' }]}
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
        {hasNote ? (
          <View
            pointerEvents="none"
            style={[styles.noteDot, { backgroundColor: filled ? onAccent : accent }]}
          />
        ) : null}
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: {
    gap: spacing.xs,
    zIndex: 2,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: touchTarget,
    gap: spacing.sm,
  },
  rightActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  iconBtn: {
    width: 40,
    height: touchTarget,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titlePress: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minHeight: touchTarget,
    minWidth: 0,
  },
  titleText: {
    letterSpacing: -0.3,
    flexShrink: 1,
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
    marginTop: 0,
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
  noteDot: {
    position: 'absolute',
    bottom: 1,
    width: 5,
    height: 5,
    borderRadius: 2.5,
  },
});
