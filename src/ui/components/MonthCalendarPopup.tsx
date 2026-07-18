import { Ionicons } from '@expo/vector-icons';
import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useDayNotesRange, useWeekStart } from '@/state/queries';
import {
  DayKey,
  addDays,
  addMonths,
  formatDayKey,
  formatMonthYear,
  monthCalendarDays,
  monthStartOf,
  todayKey,
  weekdayLetters,
} from '@/utils/date';
import { useTheme } from '@/ui/theme/ThemeProvider';
import { spacing, touchTarget } from '@/ui/theme/tokens';
import { AppText } from './AppText';
import { GlassPopup } from './GlassPopup';

export interface MonthCalendarPopupProps {
  visible: boolean;
  selected: DayKey;
  /** Distance from top of screen for the floating glass card. */
  top: number;
  onClose: () => void;
  onSelect: (date: DayKey) => void;
}

/** Liquid-glass month calendar — same popup as the Today dashboard header. */
export function MonthCalendarPopup({
  visible,
  selected,
  top,
  onClose,
  onSelect,
}: MonthCalendarPopupProps) {
  const { colors } = useTheme();
  const weekStart = useWeekStart();
  const [month, setMonth] = useState(() => monthStartOf(selected));
  const [prevVisible, setPrevVisible] = useState(visible);
  const monthEnd = useMemo(() => addDays(addMonths(month, 1), -1), [month]);
  const notesMonth = useDayNotesRange(month, monthEnd);
  const notedDays = useMemo(() => new Set(notesMonth.data ?? []), [notesMonth.data]);

  if (visible !== prevVisible) {
    setPrevVisible(visible);
    if (visible) setMonth(monthStartOf(selected));
  }

  const letters = useMemo(() => weekdayLetters(weekStart), [weekStart]);
  const cells = useMemo(() => monthCalendarDays(month, weekStart), [month, weekStart]);
  const today = todayKey();

  return (
    <GlassPopup
      visible={visible}
      onClose={onClose}
      top={top}
      accessibilityLabel="Dismiss calendar"
    >
      <View style={styles.calendarHeader}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Previous month"
          onPress={() => setMonth((m) => addMonths(m, -1))}
          style={styles.monthArrow}
        >
          <Ionicons name="chevron-back" size={20} color={colors.textPrimary} />
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
          <Ionicons name="chevron-forward" size={20} color={colors.textPrimary} />
        </Pressable>
      </View>

      <View style={styles.weekdayRow}>
        {letters.map((letter, i) => (
          <View key={`${letter}-${i}`} style={styles.calCell}>
            <AppText variant="micro" weight="600" style={{ color: colors.textMuted }}>
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
          const hasNote = notedDays.has(day);
          return (
            <Pressable
              key={day}
              accessibilityRole="button"
              accessibilityLabel={`${formatDayKey(day)}${isToday ? ', today' : ''}${hasNote ? ', has notes' : ''}`}
              accessibilityState={{ selected: isSelected }}
              onPress={() => onSelect(day)}
              style={styles.calCell}
            >
              <View
                style={[
                  styles.calDay,
                  isSelected && { backgroundColor: colors.accent },
                  isToday && !isSelected && { borderColor: colors.accent, borderWidth: 1.5 },
                  !isSelected && !isToday && { backgroundColor: 'transparent' },
                ]}
              >
                <AppText
                  variant="caption"
                  weight={isSelected || isToday ? '600' : '400'}
                  display={isSelected || isToday}
                  style={{
                    color: isSelected ? colors.onAccent : isToday ? colors.accent : colors.textPrimary,
                  }}
                >
                  {Number(day.slice(8))}
                </AppText>
                {hasNote ? (
                  <View
                    style={[
                      styles.calNoteDot,
                      { backgroundColor: isSelected ? colors.onAccent : colors.accent },
                    ]}
                  />
                ) : null}
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
        <AppText variant="micro" style={{ color: colors.textSecondary }}>
          {formatMonthYear(today)} · {Number(today.slice(8))}
        </AppText>
      </Pressable>
    </GlassPopup>
  );
}

const styles = StyleSheet.create({
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
  calNoteDot: {
    position: 'absolute',
    bottom: 3,
    width: 4,
    height: 4,
    borderRadius: 2,
  },
  jumpToday: {
    marginTop: spacing.sm,
    paddingTop: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255,255,255,0.12)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: touchTarget,
  },
});
