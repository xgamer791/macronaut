import { Ionicons } from '@expo/vector-icons';
import { Redirect } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AccessibilityInfo,
  ActivityIndicator,
  Animated,
  Easing,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';
import type { ScheduledWorkout, TrainingScheduleDay } from '@/repositories/trainingScheduleRepo';
import { useAuth } from '@/state/AuthProvider';
import {
  useRemoveTrainingScheduleDay,
  useSaveTrainingScheduleDay,
  useSetAllTrainingScheduleRepeats,
  useSetTrainingScheduleRepeatDay,
  useTrainingSchedule,
  useTrainingScheduleRepeatDays,
  useWeekStart,
} from '@/state/queries';
import {
  addDays,
  parseDayKey,
  shortWeekdayLabel,
  todayKey,
  weekDays,
  weekStartOf,
  weekdayOf,
  type DayKey,
} from '@/utils/date';
import {
  AppText,
  Button,
  ErrorState,
  GlassHeaderBar,
  CalendarPanel,
  Screen,
  ScreenHeader,
  TextField,
} from '@/ui/components';
import { useTheme } from '@/ui/theme/ThemeProvider';
import { radius, spacing, touchTarget } from '@/ui/theme/tokens';

interface DraftWorkout {
  id: string;
  label: string;
  macroLabel: string;
  sets: string;
}

let draftSequence = 0;
const newDraftId = () => `workout-${Date.now()}-${(draftSequence += 1)}`;
/** Painted size of the empty-day add control — the circle itself, not an
 * Ionicons glyph box (those sit smaller than their `size`). */
const ADD_ICON_SIZE = 27;
const TOGGLE_WIDTH = 48;
const TOGGLE_HEIGHT = 28;
const TOGGLE_KNOB = 24;
const TOGGLE_INSET = 2;

export default function TrainingScheduleRoute() {
  const { loading, signedIn } = useAuth();
  if (loading) return null;
  if (!signedIn) return <Redirect href="/welcome" />;
  return <TrainingScheduleScreen />;
}

function TrainingScheduleScreen() {
  const { colors } = useTheme();
  const weekStart = useWeekStart();
  const [anchor, setAnchor] = useState<DayKey>(() => todayKey());
  const [calendarOpen, setCalendarOpen] = useState(false);
  const start = weekStartOf(anchor, weekStart);
  const days = useMemo(() => weekDays(start, weekStart), [start, weekStart]);
  const schedule = useTrainingSchedule(days[0], days[6]);
  const repeatDays = useTrainingScheduleRepeatDays();
  const saveDay = useSaveTrainingScheduleDay();
  const removeDay = useRemoveTrainingScheduleDay();
  const setRepeatDay = useSetTrainingScheduleRepeatDay();
  const setRepeatAll = useSetAllTrainingScheduleRepeats();
  const plans = useMemo(
    () => new Map((schedule.data ?? []).map((day) => [day.date, day])),
    [schedule.data],
  );
  const repeatingWeekdays = useMemo(() => new Set(repeatDays.data ?? []), [repeatDays.data]);
  const repeatCount = repeatingWeekdays.size;
  const allDaysRepeat = repeatCount === 7;

  const [editingDate, setEditingDate] = useState<DayKey | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [draftLabel, setDraftLabel] = useState('');
  const [draftNotes, setDraftNotes] = useState('');
  const [draftWorkouts, setDraftWorkouts] = useState<DraftWorkout[]>([]);
  const [formError, setFormError] = useState<string | null>(null);
  const [repeatError, setRepeatError] = useState<string | null>(null);

  function editDay(date: DayKey) {
    const plan = plans.get(date);
    setAnchor(date);
    setEditingDate(date);
    setDraftLabel(plan?.label ?? trainingTitle(date));
    setDraftNotes(plan?.notes ?? '');
    setDraftWorkouts((plan?.workouts ?? []).map(toDraftWorkout));
    setFormError(null);
    setEditorOpen(true);
  }

  function closeEditor() {
    if (saveDay.isPending || removeDay.isPending || setRepeatDay.isPending) return;
    setEditorOpen(false);
    setFormError(null);
  }

  const finishClosingEditor = useCallback(() => {
    setEditingDate(null);
  }, []);

  function updateWorkout(id: string, patch: Partial<DraftWorkout>) {
    setDraftWorkouts((current) =>
      current.map((workout) => (workout.id === id ? { ...workout, ...patch } : workout)),
    );
  }

  async function save() {
    if (!editingDate) return;
    const label = draftLabel.trim();
    if (!label) {
      setFormError('Enter a training name.');
      return;
    }

    const workouts: ScheduledWorkout[] = [];
    for (const workout of draftWorkouts) {
      const workoutLabel = workout.label.trim();
      if (!workoutLabel) {
        setFormError('Every workout needs a label. Remove empty workouts before saving.');
        return;
      }
      const setText = workout.sets.trim();
      const sets = setText ? Number(setText) : undefined;
      if (sets !== undefined && (!Number.isInteger(sets) || sets < 1 || sets > 999)) {
        setFormError('Sets or rounds must be a whole number from 1 to 999.');
        return;
      }
      workouts.push({
        id: workout.id,
        label: workoutLabel,
        macroLabel: workout.macroLabel.trim() || undefined,
        sets,
      });
    }

    setFormError(null);
    try {
      await saveDay.mutateAsync({
        date: editingDate,
        label,
        notes: draftNotes.trim() || undefined,
        workouts,
      });
      setEditorOpen(false);
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Could not save this training day.');
    }
  }

  async function clearDay() {
    if (!editingDate) return;
    setFormError(null);
    try {
      await removeDay.mutateAsync(editingDate);
      setEditorOpen(false);
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Could not clear this training day.');
    }
  }

  async function changeDayRepeat(enabled: boolean) {
    if (!editingDate) return;
    setFormError(null);
    try {
      await setRepeatDay.mutateAsync({ date: editingDate, enabled });
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Could not update this repeat.');
    }
  }

  async function changeAllRepeats(enabled: boolean) {
    setRepeatError(null);
    try {
      await setRepeatAll.mutateAsync({ dates: days, enabled });
    } catch (error) {
      setRepeatError(error instanceof Error ? error.message : 'Could not update repeats.');
    }
  }

  const existingPlan = editingDate ? plans.get(editingDate) : undefined;
  const busy = saveDay.isPending || removeDay.isPending || setRepeatDay.isPending;

  return (
    <Screen
      scroll={false}
      padded={false}
      safeTop={false}
      collapseHeader={false}
      stickyHeader={
        <GlassHeaderBar inset={spacing.lg}>
          <ScreenHeader
            title="Training Schedule"
            right={
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Open full calendar"
                onPress={() => setCalendarOpen(true)}
                hitSlop={8}
                style={styles.headerButton}
              >
                <Ionicons name="calendar-outline" size={22} color={colors.accent} />
              </Pressable>
            }
          />
        </GlassHeaderBar>
      }
    >
      <View style={styles.workspace}>
        <ScrollView
          style={styles.scheduleScroll}
          contentContainerStyle={styles.scheduleContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={[styles.weekNavigator, { borderBottomColor: colors.border }]}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Previous week"
              onPress={() => setAnchor(addDays(start, -7))}
              style={styles.weekArrow}
            >
              <Ionicons name="chevron-back" size={23} color={colors.accent} />
            </Pressable>
            <View style={styles.weekCopy}>
              <AppText variant="heading" weight="700" align="center">
                {weekTitle(days[0], days[6])}
              </AppText>
              <AppText variant="caption" tone="muted" align="center">
                {weekRange(days[0], days[6])}
              </AppText>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Return to this week"
                onPress={() => setAnchor(todayKey())}
                hitSlop={6}
                style={styles.todayAction}
              >
                <AppText variant="caption" tone="accent" weight="600">
                  Today
                </AppText>
              </Pressable>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Next week"
              onPress={() => setAnchor(addDays(start, 7))}
              style={styles.weekArrow}
            >
              <Ionicons name="chevron-forward" size={23} color={colors.accent} />
            </Pressable>
          </View>

          {schedule.isLoading ? (
            <View style={styles.loading}>
              <ActivityIndicator color={colors.accent} />
            </View>
          ) : schedule.isError ? (
            <ErrorState
              message="Your training schedule could not be loaded."
              onRetry={() => void schedule.refetch()}
            />
          ) : (
            <View style={styles.dayList}>
              {days.map((date) => (
                <ScheduleDayRow
                  key={date}
                  date={date}
                  selected={date === anchor}
                  plan={plans.get(date)}
                  onPress={() => editDay(date)}
                />
              ))}
              <View style={styles.masterRepeat}>
                <RepeatSettingRow
                  title="Repeat every week"
                  value={allDaysRepeat}
                  disabled={repeatDays.isLoading || repeatDays.isError || setRepeatAll.isPending}
                  accessibilityLabel="Repeat every week"
                  onValueChange={(enabled) => void changeAllRepeats(enabled)}
                />
                {repeatError ? (
                  <AppText
                    variant="caption"
                    tone="danger"
                    accessibilityLiveRegion="polite"
                    style={styles.repeatError}
                  >
                    {repeatError}
                  </AppText>
                ) : null}
              </View>
            </View>
          )}
        </ScrollView>

        {editingDate ? (
          <RightEditorPanel
            visible={editorOpen}
            date={editingDate}
            onClose={closeEditor}
            onHidden={finishClosingEditor}
            footer={
              <View style={styles.editorActions}>
                {existingPlan ? (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Clear ${longWeekday(editingDate)} training`}
                    disabled={busy}
                    onPress={() => void clearDay()}
                    style={({ pressed }) => [
                      styles.clearAction,
                      { opacity: busy ? 0.4 : pressed ? 0.7 : 1 },
                    ]}
                  >
                    <AppText variant="caption" tone="danger" weight="600">
                      Clear {longWeekday(editingDate)}
                    </AppText>
                  </Pressable>
                ) : null}
                <Button
                  title={`Save ${longWeekday(editingDate)}`}
                  loading={saveDay.isPending}
                  disabled={removeDay.isPending || setRepeatDay.isPending}
                  onPress={() => void save()}
                  style={{ flex: 1 }}
                />
              </View>
            }
          >
            <View style={styles.formSection}>
              <AppText variant="heading" weight="700">
                Training details
              </AppText>
              <TextField
                label="Training name"
                required
                value={draftLabel}
                onChangeText={setDraftLabel}
                placeholder="Strength, recovery, long run…"
                maxLength={64}
                style={[styles.editorField, { backgroundColor: colors.surfaceRaised }]}
              />
              <TextField
                label="Notes"
                value={draftNotes}
                onChangeText={setDraftNotes}
                placeholder="Location, focus, or coaching notes"
                multiline
                maxLength={600}
                style={[
                  styles.editorField,
                  styles.notesInput,
                  { backgroundColor: colors.surfaceRaised },
                ]}
              />
            </View>

            <View style={styles.formSection}>
              <View style={styles.workoutHeading}>
                <View style={{ flex: 1, gap: 2 }}>
                  <AppText variant="heading" weight="700">
                    Workouts
                  </AppText>
                  <AppText variant="caption" tone="muted">
                    Add exercises, sessions, sets, or rounds.
                  </AppText>
                </View>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Add workout"
                  accessibilityState={{ disabled: draftWorkouts.length >= 24 }}
                  disabled={draftWorkouts.length >= 24}
                  onPress={() =>
                    setDraftWorkouts((current) => [
                      ...current,
                      { id: newDraftId(), label: '', macroLabel: '', sets: '' },
                    ])
                  }
                  style={({ pressed }) => [
                    styles.addWorkout,
                    { opacity: draftWorkouts.length >= 24 ? 0.4 : pressed ? 0.7 : 1 },
                  ]}
                >
                  <Ionicons name="add" size={19} color={colors.accent} />
                  <AppText variant="caption" tone="accent" weight="600">
                    Add workout
                  </AppText>
                </Pressable>
              </View>

              {draftWorkouts.map((workout, index) => (
                <View
                  key={workout.id}
                  style={[
                    styles.workoutEditor,
                    index > 0 && {
                      borderTopWidth: StyleSheet.hairlineWidth,
                      borderTopColor: colors.border,
                      marginTop: spacing.sm,
                      paddingTop: spacing.xl,
                    },
                  ]}
                >
                  <View style={styles.workoutEditorHeader}>
                    <AppText weight="700" style={{ flex: 1 }}>
                      Workout {index + 1}
                    </AppText>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`Remove workout ${index + 1}`}
                      onPress={() =>
                        setDraftWorkouts((current) =>
                          current.filter((candidate) => candidate.id !== workout.id),
                        )
                      }
                      hitSlop={8}
                      style={({ pressed }) => [
                        styles.removeWorkout,
                        { opacity: pressed ? 0.7 : 1 },
                      ]}
                    >
                      <Ionicons name="trash-outline" size={17} color={colors.danger} />
                    </Pressable>
                  </View>
                  <TextField
                    label="Workout name"
                    required
                    value={workout.label}
                    onChangeText={(label) => updateWorkout(workout.id, { label })}
                    placeholder="Exercise, drill, movement, or session"
                    maxLength={80}
                    style={[styles.editorField, { backgroundColor: colors.surfaceRaised }]}
                  />
                  <View style={styles.detailFields}>
                    <View style={{ flex: 1 }}>
                      <TextField
                        label="Macro label"
                        value={workout.macroLabel}
                        onChangeText={(macroLabel) => updateWorkout(workout.id, { macroLabel })}
                        placeholder="Power, Zone 2, technique…"
                        maxLength={48}
                        style={[styles.editorField, { backgroundColor: colors.surfaceRaised }]}
                      />
                    </View>
                    <View style={styles.setsField}>
                      <TextField
                        label="Sets / rounds"
                        value={workout.sets}
                        onChangeText={(sets) => updateWorkout(workout.id, { sets })}
                        placeholder="—"
                        keyboardType="number-pad"
                        inputMode="numeric"
                        maxLength={3}
                        style={[styles.editorField, { backgroundColor: colors.surfaceRaised }]}
                      />
                    </View>
                  </View>
                </View>
              ))}

              {!draftWorkouts.length ? (
                <View style={styles.noWorkouts}>
                  <View style={styles.emptyIcon}>
                    <Ionicons name="barbell-outline" size={20} color={colors.accent} />
                  </View>
                  <View style={{ flex: 1, gap: 2 }}>
                    <AppText weight="600">No workouts added</AppText>
                    <AppText variant="caption" tone="muted">
                      Add a workout, or save this as a rest day.
                    </AppText>
                  </View>
                </View>
              ) : null}
            </View>

            <View style={[styles.dayRepeat, { borderTopColor: colors.border }]}>
              <RepeatSettingRow
                title={`Repeat every ${longWeekday(editingDate)}`}
                description={`Use this training plan every ${longWeekday(editingDate)}.`}
                value={repeatingWeekdays.has(weekdayOf(editingDate))}
                disabled={repeatDays.isLoading || repeatDays.isError || setRepeatDay.isPending}
                accessibilityLabel={`Repeat ${longWeekday(editingDate)} training every week`}
                onValueChange={(enabled) => void changeDayRepeat(enabled)}
              />
            </View>

            {formError ? (
              <View style={[styles.formError, { backgroundColor: `${colors.danger}12` }]}>
                <Ionicons name="alert-circle-outline" size={18} color={colors.danger} />
                <AppText
                  variant="caption"
                  tone="danger"
                  accessibilityLiveRegion="polite"
                  style={{ flex: 1 }}
                >
                  {formError}
                </AppText>
              </View>
            ) : null}
          </RightEditorPanel>
        ) : null}
      </View>

      <CalendarPanel
        visible={calendarOpen}
        selected={anchor}
        title="Training Schedule"
        onClose={() => setCalendarOpen(false)}
        onSelect={(date) => {
          setAnchor(date);
          setCalendarOpen(false);
        }}
      />
    </Screen>
  );
}

function RepeatSettingRow({
  title,
  description,
  value,
  disabled,
  accessibilityLabel,
  onValueChange,
}: {
  title: string;
  description?: string;
  value: boolean;
  disabled?: boolean;
  accessibilityLabel: string;
  onValueChange: (value: boolean) => void;
}) {
  return (
    <View style={styles.repeatRow}>
      <View style={styles.repeatCopy}>
        <AppText weight="700">{title}</AppText>
        {description ? (
          <AppText variant="caption" tone="muted">
            {description}
          </AppText>
        ) : null}
      </View>
      <ScheduleToggle
        value={value}
        disabled={disabled}
        accessibilityLabel={accessibilityLabel}
        onValueChange={onValueChange}
      />
    </View>
  );
}

function ScheduleToggle({
  value,
  disabled,
  accessibilityLabel,
  onValueChange,
}: {
  value: boolean;
  disabled?: boolean;
  accessibilityLabel: string;
  onValueChange: (value: boolean) => void;
}) {
  const { colors } = useTheme();
  const [position] = useState(() => new Animated.Value(value ? 1 : 0));

  useEffect(() => {
    let active = true;
    let animation: Animated.CompositeAnimation | undefined;
    void AccessibilityInfo.isReduceMotionEnabled().then((reduceMotion) => {
      if (!active) return;
      if (reduceMotion) {
        position.setValue(value ? 1 : 0);
        return;
      }
      animation = Animated.timing(position, {
        toValue: value ? 1 : 0,
        duration: 160,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      });
      animation.start();
    });
    return () => {
      active = false;
      animation?.stop();
    };
  }, [position, value]);

  const translateX = position.interpolate({
    inputRange: [0, 1],
    outputRange: [TOGGLE_INSET, TOGGLE_WIDTH - TOGGLE_KNOB - TOGGLE_INSET],
  });

  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ checked: value, disabled: Boolean(disabled) }}
      disabled={disabled}
      onPress={() => onValueChange(!value)}
      hitSlop={6}
      style={({ pressed }) => [styles.toggleHit, { opacity: disabled ? 0.4 : pressed ? 0.72 : 1 }]}
    >
      <View style={[styles.toggleTrack, { backgroundColor: value ? colors.accent : colors.track }]}>
        <Animated.View
          style={[
            styles.toggleKnob,
            {
              backgroundColor: value ? colors.onAccent : colors.textSecondary,
              transform: [{ translateX }],
            },
          ]}
        />
      </View>
    </Pressable>
  );
}

function RightEditorPanel({
  visible,
  date,
  onClose,
  onHidden,
  footer,
  children,
}: {
  visible: boolean;
  date: DayKey;
  onClose: () => void;
  onHidden: () => void;
  footer: React.ReactNode;
  children: React.ReactNode;
}) {
  const { colors } = useTheme();
  const { width } = useWindowDimensions();
  const fullWidth = width < 760;
  const panelWidth = fullWidth ? width : Math.min(520, Math.round(width * 0.56));
  const [translateX] = useState(() => new Animated.Value(panelWidth));

  useEffect(() => {
    let active = true;
    let animation: Animated.CompositeAnimation | undefined;

    void AccessibilityInfo.isReduceMotionEnabled().then((reduceMotion) => {
      if (!active) return;
      const target = visible ? 0 : panelWidth;
      if (visible) translateX.setValue(panelWidth);

      if (reduceMotion) {
        translateX.setValue(target);
        if (!visible) onHidden();
        return;
      }

      animation = Animated.timing(translateX, {
        toValue: target,
        duration: visible ? 220 : 180,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      });
      animation.start(({ finished }) => {
        if (finished && !visible) onHidden();
      });
    });

    return () => {
      active = false;
      animation?.stop();
    };
  }, [onHidden, panelWidth, translateX, visible]);

  return (
    <Animated.View
      accessibilityViewIsModal={fullWidth}
      style={[
        styles.editorPanel,
        {
          width: panelWidth,
          backgroundColor: colors.background,
          borderLeftColor: colors.border,
          borderLeftWidth: fullWidth ? 0 : StyleSheet.hairlineWidth,
          transform: [{ translateX }],
        },
      ]}
    >
      <View style={[styles.editorHeader, { borderBottomColor: colors.border }]}>
        <View style={styles.editorTitle}>
          <AppText variant="heading" weight="700" numberOfLines={1}>
            {trainingTitle(date)}
          </AppText>
          <AppText variant="caption" tone="muted" numberOfLines={1}>
            {editorDate(date)}
          </AppText>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Close ${longWeekday(date)} training editor`}
          onPress={onClose}
          hitSlop={6}
          style={({ pressed }) => [styles.closeEditor, { opacity: pressed ? 0.7 : 1 }]}
        >
          <Ionicons name="close" size={23} color={colors.textPrimary} />
        </Pressable>
      </View>

      <KeyboardAvoidingView
        style={styles.editorBody}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.editorContent}
        >
          {children}
        </ScrollView>
        <View
          style={[
            styles.editorFooter,
            { backgroundColor: colors.chrome, borderTopColor: colors.border },
          ]}
        >
          {footer}
        </View>
      </KeyboardAvoidingView>
    </Animated.View>
  );
}

function ScheduleDayRow({
  date,
  selected,
  plan,
  onPress,
}: {
  date: DayKey;
  selected: boolean;
  plan?: TrainingScheduleDay;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  const isToday = date === todayKey();
  const totalSets = plan?.workouts.reduce((total, workout) => total + (workout.sets ?? 0), 0) ?? 0;
  const title = trainingTitle(date);
  const workoutSummary = plan?.workouts.length
    ? `${plan.workouts.length} ${plan.workouts.length === 1 ? 'workout' : 'workouts'}${totalSets ? ` · ${totalSets} sets / rounds` : ''}`
    : null;
  const summary = plan
    ? [
        plan.label !== title ? plan.label : null,
        workoutSummary ?? plan.notes ?? 'No workouts added',
      ]
        .filter(Boolean)
        .join(' · ')
    : 'No training added';

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${fullDate(date)}. ${plan?.label ?? 'No training plan'}`}
      onPress={onPress}
      style={({ pressed }) => [
        styles.dayRow,
        { borderBottomColor: colors.border },
        pressed && { backgroundColor: colors.surfaceRaised },
      ]}
    >
      <View
        style={[
          styles.dateTile,
          { backgroundColor: colors.surfaceRaised },
          selected && !isToday && { backgroundColor: `${colors.accent}18` },
          isToday && { backgroundColor: colors.accent },
        ]}
      >
        <AppText
          variant="micro"
          weight="700"
          style={{ color: isToday ? colors.onAccent : colors.accent }}
        >
          {shortWeekdayLabel(date)}
        </AppText>
        <AppText
          variant="heading"
          weight="700"
          style={{ color: isToday ? colors.onAccent : colors.textPrimary }}
        >
          {Number(date.slice(8))}
        </AppText>
      </View>

      <View style={styles.dayCopy}>
        <AppText weight="700" tone="primary">
          {title}
        </AppText>
        <AppText variant="caption" tone="muted" numberOfLines={1}>
          {summary}
        </AppText>
      </View>

      {plan ? (
        <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
      ) : (
        <View style={[styles.addIcon, { width: ADD_ICON_SIZE, height: ADD_ICON_SIZE }]}>
          <Ionicons name="add" size={22} color={colors.accent} />
        </View>
      )}
    </Pressable>
  );
}

function toDraftWorkout(workout: ScheduledWorkout): DraftWorkout {
  return {
    id: workout.id,
    label: workout.label,
    macroLabel: workout.macroLabel ?? '',
    sets: workout.sets?.toString() ?? '',
  };
}

function weekTitle(from: DayKey, to: DayKey): string {
  const first = parseDayKey(from);
  const last = parseDayKey(to);
  if (first.getFullYear() !== last.getFullYear()) {
    return `${first.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })} – ${last.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}`;
  }
  if (first.getMonth() !== last.getMonth()) {
    return `${first.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} – ${last.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}`;
  }
  return `${first.toLocaleDateString(undefined, { month: 'long' })} ${first.getDate()}–${last.getDate()}`;
}

function weekRange(from: DayKey, to: DayKey): string {
  const first = parseDayKey(from);
  const last = parseDayKey(to);
  return `${first.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} – ${last.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}`;
}

function fullDate(date: DayKey): string {
  return parseDayKey(date).toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

function longWeekday(date: DayKey): string {
  return parseDayKey(date).toLocaleDateString(undefined, { weekday: 'long' });
}

function trainingTitle(date: DayKey): string {
  return `${longWeekday(date)} Training`;
}

function editorDate(date: DayKey): string {
  return parseDayKey(date).toLocaleDateString(undefined, {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

const styles = StyleSheet.create({
  headerButton: {
    width: touchTarget,
    height: touchTarget,
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  workspace: {
    flex: 1,
    position: 'relative',
    overflow: 'hidden',
  },
  scheduleScroll: {
    flex: 1,
  },
  scheduleContent: {
    flexGrow: 1,
    paddingBottom: spacing.xxl,
  },
  weekNavigator: {
    minHeight: 120,
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.md,
  },
  weekArrow: {
    width: touchTarget,
    height: touchTarget,
    alignItems: 'center',
    justifyContent: 'center',
  },
  weekCopy: {
    flex: 1,
    alignItems: 'center',
    gap: 3,
  },
  todayAction: {
    minHeight: 28,
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
  },
  loading: {
    minHeight: 360,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayList: {
    flex: 1,
    paddingHorizontal: spacing.lg,
  },
  masterRepeat: {
    marginTop: 'auto',
    paddingTop: spacing.xl,
    paddingHorizontal: spacing.xs,
  },
  dayRow: {
    minHeight: 86,
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xs,
  },
  dateTile: {
    width: 52,
    height: 56,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 1,
  },
  dayCopy: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  addIcon: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  editorPanel: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    zIndex: 20,
  },
  editorHeader: {
    minHeight: 78,
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
  },
  editorTitle: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  closeEditor: {
    width: touchTarget,
    height: touchTarget,
    alignItems: 'center',
    justifyContent: 'center',
  },
  editorBody: {
    flex: 1,
  },
  editorContent: {
    gap: spacing.xxl,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xl,
    paddingBottom: spacing.xxl,
  },
  editorFooter: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  formSection: {
    gap: spacing.lg,
  },
  editorField: {
    borderWidth: 0,
    borderRadius: radius.md,
  },
  notesInput: {
    minHeight: 96,
    textAlignVertical: 'top',
  },
  workoutHeading: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  addWorkout: {
    minHeight: touchTarget,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
  },
  workoutEditor: {
    gap: spacing.lg,
  },
  workoutEditorHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  removeWorkout: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  detailFields: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  setsField: {
    width: 116,
  },
  noWorkouts: {
    minHeight: 76,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
  },
  emptyIcon: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayRepeat: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: spacing.xl,
  },
  repeatRow: {
    minHeight: 68,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
  },
  repeatCopy: {
    flex: 1,
    minWidth: 0,
    gap: 3,
  },
  repeatError: {
    paddingBottom: spacing.sm,
  },
  toggleHit: {
    width: TOGGLE_WIDTH,
    height: touchTarget,
    alignItems: 'center',
    justifyContent: 'center',
  },
  toggleTrack: {
    width: TOGGLE_WIDTH,
    height: TOGGLE_HEIGHT,
    borderRadius: TOGGLE_HEIGHT / 2,
    justifyContent: 'center',
  },
  toggleKnob: {
    width: TOGGLE_KNOB,
    height: TOGGLE_KNOB,
    borderRadius: TOGGLE_KNOB / 2,
  },
  formError: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  editorActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  clearAction: {
    minHeight: touchTarget,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
  },
});
