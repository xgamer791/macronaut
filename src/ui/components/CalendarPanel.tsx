import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useDayNotesRange, useDiaryRange, useWeekStart } from '@/state/queries';
import {
  DayKey,
  addDays,
  addMonths,
  formatDayKey,
  monthGridDays,
  monthLabel,
  monthNames,
  monthOf,
  monthStartOf,
  todayKey,
  weekdayShortLabels,
  withMonth,
  withYear,
  yearOf,
} from '@/utils/date';
import { usePushWhileOpen } from '@/ui/motion/SlidePush';
import { SLIDE_DURATION_MS, SLIDE_EASING } from '@/ui/motion/slideTiming';
import { useTheme } from '@/ui/theme/ThemeProvider';
import { radius, spacing, touchTarget } from '@/ui/theme/tokens';
import { AppText } from './AppText';

/** Gap from the screen edge to the first day circle. */
const EDGE = 20;
/** Space between two day circles. */
const CELL_GAP = 8;
const CIRCLE_MIN = 30;
const CIRCLE_MAX = 46;
/** Years offered either side of this year in the year dropdown. */
const YEAR_SPAN = 5;

export interface CalendarPanelProps {
  visible: boolean;
  selected: DayKey;
  /** Panel heading. Defaults to `Calendar`. */
  title?: string;
  onClose: () => void;
  onSelect: (date: DayKey) => void;
}

/**
 * The app's month calendar: a full-screen panel that slides in from the right
 * on the same curve as every other slide-over, pushing the page it covers
 * aside. Days are outlined circles — an accent ring marks a tracked day, a
 * filled circle the selected one — with the weekday row beneath the grid and
 * month / year pickers under that.
 */
export function CalendarPanel({
  visible,
  selected,
  title = 'Calendar',
  onClose,
  onSelect,
}: CalendarPanelProps) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const weekStart = useWeekStart();
  const panelWidth = width || 390;

  const [mounted, setMounted] = useState(visible);
  const [prevVisible, setPrevVisible] = useState(visible);
  const [webOpen, setWebOpen] = useState(false);
  const [month, setMonth] = useState(() => monthStartOf(selected));
  const [menu, setMenu] = useState<'month' | 'year' | null>(null);
  const progress = useSharedValue(0);

  if (visible !== prevVisible) {
    setPrevVisible(visible);
    setWebOpen(false);
    if (visible) {
      setMounted(true);
      setMenu(null);
      setMonth(monthStartOf(selected));
    }
  }

  // Two frames, so the browser has painted the panel off-screen before the
  // class that transitions it back flips.
  useLayoutEffect(() => {
    if (Platform.OS !== 'web' || !mounted || !visible) return;
    let second = 0;
    const first = requestAnimationFrame(() => {
      second = requestAnimationFrame(() => setWebOpen(true));
    });
    return () => {
      cancelAnimationFrame(first);
      cancelAnimationFrame(second);
    };
  }, [mounted, visible]);

  useEffect(() => {
    if (visible) {
      progress.value = withTiming(1, { duration: SLIDE_DURATION_MS, easing: SLIDE_EASING });
      return;
    }
    if (!mounted) return;
    progress.value = withTiming(0, { duration: SLIDE_DURATION_MS, easing: SLIDE_EASING });
    const id = setTimeout(() => setMounted(false), SLIDE_DURATION_MS);
    return () => clearTimeout(id);
  }, [mounted, progress, visible]);

  // The panel is a Modal, portalled clear of the page, so the page below has
  // to be told to step aside on the same frame and by the same distance.
  const open = Platform.OS === 'web' ? webOpen : visible;
  usePushWhileOpen(open, { x: -panelWidth });

  const panelStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: (1 - progress.value) * panelWidth }],
  }));

  // A day counts as tracked once anything is recorded against it — food
  // logged, or a note written. Both are held back until the panel is on
  // screen, so opening a page that merely renders it costs nothing.
  const monthEnd = useMemo(() => addDays(addMonths(month, 1), -1), [month]);
  const notes = useDayNotesRange(month, monthEnd, mounted);
  const diary = useDiaryRange(month, monthEnd, mounted);
  const trackedDays = useMemo(() => {
    const days = new Set<DayKey>(notes.data ?? []);
    for (const entry of diary.data ?? []) days.add(entry.date);
    return days;
  }, [diary.data, notes.data]);
  const cells = useMemo(() => monthGridDays(month, weekStart), [month, weekStart]);
  const labels = useMemo(() => weekdayShortLabels(weekStart), [weekStart]);
  const today = todayKey();

  const cellWidth = (panelWidth - EDGE * 2) / 7;
  const circle = Math.max(CIRCLE_MIN, Math.min(CIRCLE_MAX, Math.round(cellWidth - CELL_GAP)));

  const years = useMemo(() => {
    const thisYear = yearOf(today);
    const span = Array.from({ length: YEAR_SPAN * 2 + 1 }, (_, i) => thisYear - YEAR_SPAN + i);
    const shown = yearOf(month);
    return span.includes(shown) ? span : [...span, shown].sort((a, b) => a - b);
  }, [month, today]);

  const step = (by: number) => {
    void Haptics.selectionAsync();
    setMenu(null);
    setMonth((m) => addMonths(m, by));
  };

  const pick = (day: DayKey) => {
    void Haptics.selectionAsync();
    onSelect(day);
  };

  if (!mounted) return null;

  const webRoot =
    Platform.OS === 'web' ? { dataSet: { calendarpanel: open ? 'open' : 'shut' } } : null;

  return (
    <Modal visible={mounted} transparent animationType="none" onRequestClose={onClose}>
      <View style={styles.root} pointerEvents="box-none" {...webRoot}>
        <Animated.View
          accessibilityViewIsModal
          {...(Platform.OS === 'web' ? { dataSet: { calendarsheet: '' } } : null)}
          style={[
            styles.panel,
            {
              width: panelWidth,
              paddingTop: insets.top,
              paddingBottom: insets.bottom,
              backgroundColor: colors.background,
            },
            Platform.OS === 'web'
              ? { transform: [{ translateX: open ? 0 : panelWidth }] }
              : panelStyle,
          ]}
        >
          <View style={styles.header}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Close calendar"
              onPress={onClose}
              hitSlop={8}
              style={styles.headerSide}
            >
              <Ionicons name="chevron-back" size={26} color={colors.textPrimary} />
            </Pressable>
            <AppText variant="heading" weight="700" numberOfLines={1} style={styles.headerTitle}>
              {title}
            </AppText>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Jump to today"
              onPress={() => pick(today)}
              hitSlop={8}
              style={[styles.headerSide, styles.headerRight]}
            >
              <AppText variant="caption" tone="accent" weight="600">
                Today
              </AppText>
            </Pressable>
          </View>

          <View style={styles.body}>
            {menu ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Close picker"
                onPress={() => setMenu(null)}
                style={[StyleSheet.absoluteFill, styles.menuScrim]}
              />
            ) : null}

            <View style={styles.grid}>
              {cells.map(({ key, inMonth }) => {
                const isSelected = key === selected;
                const isToday = key === today;
                const tracked = inMonth && trackedDays.has(key);
                const ring = isSelected
                  ? colors.accent
                  : tracked
                    ? colors.accent
                    : inMonth
                      ? colors.borderStrong
                      : 'transparent';
                const text = isSelected
                  ? colors.onAccent
                  : tracked
                    ? colors.accent
                    : inMonth
                      ? colors.textPrimary
                      : colors.textMuted;
                return (
                  <Pressable
                    key={key}
                    accessibilityRole="button"
                    accessibilityLabel={`${formatDayKey(key)}${tracked ? ', tracked' : ''}`}
                    accessibilityState={{ selected: isSelected }}
                    onPress={() => pick(key)}
                    style={[styles.cell, { height: cellWidth }]}
                  >
                    <View
                      style={[
                        styles.circle,
                        {
                          width: circle,
                          height: circle,
                          borderRadius: circle / 2,
                          borderColor: ring,
                          borderWidth: tracked || isSelected ? 1.5 : 1,
                          backgroundColor: isSelected ? colors.accent : 'transparent',
                        },
                      ]}
                    >
                      <AppText
                        variant="caption"
                        weight={isSelected || tracked ? '600' : '400'}
                        style={{ color: text }}
                      >
                        {Number(key.slice(8))}
                      </AppText>
                      {isToday && !isSelected ? (
                        <View style={[styles.todayDot, { backgroundColor: colors.accent }]} />
                      ) : null}
                    </View>
                  </Pressable>
                );
              })}
            </View>

            <View style={styles.weekdayRow}>
              {labels.map((label, i) => (
                <View key={`${label}-${i}`} style={styles.weekdayCell}>
                  <AppText variant="caption" style={{ color: colors.textSecondary }}>
                    {label}
                  </AppText>
                </View>
              ))}
            </View>

            <View style={styles.controls}>
              <View style={[styles.stepper, { backgroundColor: colors.surfaceRaised }]}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Previous month"
                  onPress={() => step(-1)}
                  style={styles.stepperHit}
                >
                  <Ionicons name="chevron-back" size={18} color={colors.textPrimary} />
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Next month"
                  onPress={() => step(1)}
                  style={styles.stepperHit}
                >
                  <Ionicons name="chevron-forward" size={18} color={colors.textPrimary} />
                </Pressable>
              </View>

              <Dropdown
                label={monthLabel(month)}
                accessibilityLabel={`Month, ${monthLabel(month)}`}
                wide
                open={menu === 'month'}
                onToggle={() => setMenu((m) => (m === 'month' ? null : 'month'))}
                options={monthNames.map((name, i) => ({
                  key: String(i),
                  label: name,
                  active: i === monthOf(month),
                }))}
                onPick={(key) => {
                  setMenu(null);
                  setMonth((m) => withMonth(m, Number(key)));
                }}
              />

              <Dropdown
                label={String(yearOf(month))}
                accessibilityLabel={`Year, ${yearOf(month)}`}
                open={menu === 'year'}
                onToggle={() => setMenu((m) => (m === 'year' ? null : 'year'))}
                options={years.map((year) => ({
                  key: String(year),
                  label: String(year),
                  active: year === yearOf(month),
                }))}
                onPick={(key) => {
                  setMenu(null);
                  setMonth((m) => withYear(m, Number(key)));
                }}
              />
            </View>
          </View>

          <View style={[styles.legend, { backgroundColor: colors.surface }]}>
            <View style={styles.legendItem}>
              <View style={[styles.legendRing, { borderColor: colors.accent, borderWidth: 1.5 }]} />
              <AppText variant="caption" tone="secondary">
                Tracked
              </AppText>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendRing, { borderColor: colors.borderStrong }]} />
              <AppText variant="caption" tone="secondary">
                Untracked
              </AppText>
            </View>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

interface DropdownOption {
  key: string;
  label: string;
  active: boolean;
}

/** Month / year picker. The list opens upward, inside the panel, because the
 * control row sits near the bottom and a second Modal over the first one is
 * more trouble than it is worth. */
function Dropdown({
  label,
  accessibilityLabel,
  open,
  options,
  wide,
  onToggle,
  onPick,
}: {
  label: string;
  accessibilityLabel: string;
  open: boolean;
  options: DropdownOption[];
  /** Months need more room than years. */
  wide?: boolean;
  onToggle: () => void;
  onPick: (key: string) => void;
}) {
  const { colors } = useTheme();
  const listRef = useRef<ScrollView>(null);
  const activeIndex = options.findIndex((option) => option.active);

  // Twelve months and eleven years do not fit the list, so it opens on the
  // current one rather than on January or the earliest year.
  useEffect(() => {
    if (!open || activeIndex < 0) return;
    const y = Math.max(0, (activeIndex - 2) * DROPDOWN_ROW);
    const id = requestAnimationFrame(() => listRef.current?.scrollTo({ y, animated: false }));
    return () => cancelAnimationFrame(id);
  }, [activeIndex, open]);

  return (
    <View style={[styles.dropdown, open && styles.dropdownOpen, wide && styles.dropdownWide]}>
      {open ? (
        <View
          style={[
            styles.dropdownList,
            { backgroundColor: colors.surfaceRaised, borderColor: colors.border },
          ]}
        >
          <ScrollView
            ref={listRef}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {options.map((option) => (
              <Pressable
                key={option.key}
                accessibilityRole="button"
                accessibilityLabel={option.label}
                accessibilityState={{ selected: option.active }}
                onPress={() => {
                  void Haptics.selectionAsync();
                  onPick(option.key);
                }}
                style={({ pressed }) => [
                  styles.dropdownRow,
                  pressed && { backgroundColor: colors.surface },
                ]}
              >
                <AppText
                  variant="caption"
                  weight={option.active ? '600' : '400'}
                  style={{ color: option.active ? colors.accent : colors.textPrimary }}
                >
                  {option.label}
                </AppText>
                {option.active ? (
                  <Ionicons name="checkmark" size={15} color={colors.accent} />
                ) : null}
              </Pressable>
            ))}
          </ScrollView>
        </View>
      ) : null}

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        accessibilityState={{ expanded: open }}
        onPress={() => {
          void Haptics.selectionAsync();
          onToggle();
        }}
        style={[styles.dropdownField, { backgroundColor: colors.surfaceRaised }]}
      >
        <AppText variant="body" weight="500" numberOfLines={1} style={styles.dropdownLabel}>
          {label}
        </AppText>
        <Ionicons name="chevron-down" size={16} color={colors.textSecondary} />
      </Pressable>
    </View>
  );
}

const STEPPER_HEIGHT = 40;
/** Fixed, so the list can be scrolled to the active row by index. */
const DROPDOWN_ROW = 38;

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  panel: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    right: 0,
    maxWidth: '100%',
    ...Platform.select({
      web: { boxShadow: '-12px 0 28px rgba(0,0,0,0.35)' } as object,
      default: {
        shadowColor: '#000',
        shadowOffset: { width: -10, height: 0 },
        shadowOpacity: 0.38,
        shadowRadius: 18,
        elevation: 16,
      },
    }),
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: touchTarget + spacing.md,
    paddingHorizontal: EDGE - spacing.sm,
  },
  headerSide: {
    minWidth: 64,
    height: touchTarget,
    justifyContent: 'center',
  },
  headerRight: {
    alignItems: 'flex-end',
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
  },
  body: {
    paddingHorizontal: EDGE,
    paddingTop: spacing.lg,
  },
  menuScrim: {
    zIndex: 1,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  cell: {
    width: '14.2857%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  circle: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  todayDot: {
    position: 'absolute',
    bottom: 5,
    width: 4,
    height: 4,
    borderRadius: 2,
  },
  weekdayRow: {
    flexDirection: 'row',
    marginTop: spacing.sm,
  },
  weekdayCell: {
    width: '14.2857%',
    alignItems: 'center',
  },
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.xl,
    // Above the scrim, so the open list and its field stay tappable while a
    // tap anywhere else closes the list.
    zIndex: 2,
  },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    height: STEPPER_HEIGHT,
    borderRadius: radius.full,
    paddingHorizontal: spacing.xs,
  },
  stepperHit: {
    width: 34,
    height: STEPPER_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dropdown: {
    flex: 1,
    position: 'relative',
  },
  dropdownWide: {
    flex: 1.3,
  },
  dropdownOpen: {
    zIndex: 3,
  },
  dropdownField: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: STEPPER_HEIGHT,
    borderRadius: radius.full,
    paddingLeft: spacing.md,
    paddingRight: spacing.sm,
    gap: spacing.xs,
  },
  dropdownLabel: {
    flexShrink: 1,
  },
  dropdownList: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: STEPPER_HEIGHT + spacing.sm,
    maxHeight: DROPDOWN_ROW * 6,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
    ...Platform.select({
      web: { boxShadow: '0 12px 28px rgba(0,0,0,0.45)' } as object,
      default: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.4,
        shadowRadius: 16,
        elevation: 12,
      },
    }),
  },
  dropdownRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: DROPDOWN_ROW,
    paddingHorizontal: spacing.lg,
    gap: spacing.sm,
  },
  legend: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xl,
    marginTop: spacing.xl,
    marginHorizontal: EDGE,
    paddingVertical: spacing.lg,
    borderRadius: radius.lg,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  legendRing: {
    width: 15,
    height: 15,
    borderRadius: 7.5,
    borderWidth: 1,
  },
});
