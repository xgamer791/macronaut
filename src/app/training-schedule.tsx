import { Ionicons } from '@expo/vector-icons';
import { Redirect } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { ScheduledWorkout, TrainingScheduleDay } from '@/repositories/trainingScheduleRepo';
import { useAuth } from '@/state/AuthProvider';
import {
  useRemoveTrainingScheduleDay,
  useSaveTrainingScheduleDay,
  useTrainingSchedule,
  useWeekStart,
} from '@/state/queries';
import {
  addDays,
  parseDayKey,
  shortWeekdayLabel,
  todayKey,
  weekDays,
  weekStartOf,
  type DayKey,
} from '@/utils/date';
import {
  AppText,
  Button,
  ErrorState,
  GlassHeaderBar,
  MonthCalendarPopup,
  Screen,
  ScreenHeader,
  Sheet,
  TextField,
} from '@/ui/components';
import { SlideScreen, useSlideBack } from '@/ui/motion/SlideScreen';
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
const ADD_ICON_SIZE = 30;

export default function TrainingScheduleRoute() {
  const { loading, signedIn } = useAuth();
  if (loading) return null;
  if (!signedIn) return <Redirect href="/welcome" />;
  return (
    <SlideScreen from="right">
      <TrainingScheduleScreen />
    </SlideScreen>
  );
}

function TrainingScheduleScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const onBack = useSlideBack();
  const weekStart = useWeekStart();
  const [anchor, setAnchor] = useState<DayKey>(() => todayKey());
  const [calendarOpen, setCalendarOpen] = useState(false);
  const start = weekStartOf(anchor, weekStart);
  const days = useMemo(() => weekDays(start, weekStart), [start, weekStart]);
  const schedule = useTrainingSchedule(days[0], days[6]);
  const saveDay = useSaveTrainingScheduleDay();
  const removeDay = useRemoveTrainingScheduleDay();
  const plans = useMemo(
    () => new Map((schedule.data ?? []).map((day) => [day.date, day])),
    [schedule.data],
  );

  const [editingDate, setEditingDate] = useState<DayKey | null>(null);
  const [draftLabel, setDraftLabel] = useState('');
  const [draftNotes, setDraftNotes] = useState('');
  const [draftWorkouts, setDraftWorkouts] = useState<DraftWorkout[]>([]);
  const [formError, setFormError] = useState<string | null>(null);

  function editDay(date: DayKey) {
    const plan = plans.get(date);
    setEditingDate(date);
    setDraftLabel(plan?.label ?? '');
    setDraftNotes(plan?.notes ?? '');
    setDraftWorkouts((plan?.workouts ?? []).map(toDraftWorkout));
    setFormError(null);
  }

  function closeEditor() {
    if (saveDay.isPending || removeDay.isPending) return;
    setEditingDate(null);
    setFormError(null);
  }

  function updateWorkout(id: string, patch: Partial<DraftWorkout>) {
    setDraftWorkouts((current) =>
      current.map((workout) => (workout.id === id ? { ...workout, ...patch } : workout)),
    );
  }

  async function save() {
    if (!editingDate) return;
    const label = draftLabel.trim();
    if (!label) {
      setFormError('Give this day a label, including rest or recovery days.');
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
      setEditingDate(null);
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Could not save this training day.');
    }
  }

  async function clearDay() {
    if (!editingDate) return;
    setFormError(null);
    try {
      await removeDay.mutateAsync(editingDate);
      setEditingDate(null);
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Could not clear this training day.');
    }
  }

  const existingPlan = editingDate ? plans.get(editingDate) : undefined;
  const busy = saveDay.isPending || removeDay.isPending;

  return (
    <Screen
      padded={false}
      safeTop={false}
      collapseHeader={false}
      stickyHeader={
        <GlassHeaderBar inset={spacing.lg}>
          <ScreenHeader
            title="Training Schedule"
            onBack={onBack}
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
          <AppText variant="micro" tone="accent" weight="700" style={styles.eyebrow}>
            7 DAY SCHEDULE
          </AppText>
          <AppText variant="heading" weight="700" align="center">
            {weekTitle(days[0], days[6])}
          </AppText>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Return to this week"
            onPress={() => setAnchor(todayKey())}
            hitSlop={6}
          >
            <AppText variant="micro" tone="muted" align="center">
              {weekRange(days[0], days[6])} · Today
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
        </View>
      )}

      <View style={styles.footerCopy}>
        <Ionicons name="sparkles-outline" size={16} color={colors.accent} />
        <AppText variant="caption" tone="muted" style={{ flex: 1 }}>
          Build the week in your own language. Every label is free-form, and sets or rounds are
          optional.
        </AppText>
      </View>

      <MonthCalendarPopup
        visible={calendarOpen}
        selected={anchor}
        top={insets.top + 62}
        onClose={() => setCalendarOpen(false)}
        onSelect={(date) => {
          setAnchor(date);
          setCalendarOpen(false);
        }}
      />

      <Sheet
        visible={editingDate !== null}
        onClose={closeEditor}
        title={editingDate ? editorTitle(editingDate) : undefined}
      >
        <View style={[styles.editorIntro, { backgroundColor: colors.surfaceRaised }]}>
          <View style={[styles.editorIcon, { backgroundColor: `${colors.accent}1A` }]}>
            <Ionicons name="create-outline" size={20} color={colors.accent} />
          </View>
          <View style={{ flex: 1, gap: 2 }}>
            <AppText weight="700">Shape this day your way</AppText>
            <AppText variant="caption" tone="muted">
              Use any sport, session, drill, lift, route, or recovery label.
            </AppText>
          </View>
        </View>

        <TextField
          label="Day label"
          required
          value={draftLabel}
          onChangeText={setDraftLabel}
          placeholder="Rest day, race prep, speed + mobility…"
          maxLength={64}
        />
        <TextField
          label="Day notes"
          value={draftNotes}
          onChangeText={setDraftNotes}
          placeholder="Optional intent, location, or coaching notes"
          multiline
          maxLength={600}
          style={styles.notesInput}
        />

        <View style={styles.workoutHeading}>
          <View style={{ flex: 1 }}>
            <AppText variant="caption" weight="700">
              SPECIFIC WORKOUTS
            </AppText>
            <AppText variant="micro" tone="muted">
              Add free-form macro labels and optional sets or rounds.
            </AppText>
          </View>
          <Button
            title="Add workout"
            compact
            variant="secondary"
            disabled={draftWorkouts.length >= 24}
            onPress={() =>
              setDraftWorkouts((current) => [
                ...current,
                { id: newDraftId(), label: '', macroLabel: '', sets: '' },
              ])
            }
          />
        </View>

        {draftWorkouts.map((workout, index) => (
          <View
            key={workout.id}
            style={[
              styles.workoutEditor,
              { backgroundColor: colors.surfaceRaised, borderColor: colors.border },
            ]}
          >
            <View style={styles.workoutEditorHeader}>
              <View style={[styles.workoutNumber, { backgroundColor: `${colors.accent}1A` }]}>
                <AppText variant="micro" tone="accent" weight="700">
                  {String(index + 1).padStart(2, '0')}
                </AppText>
              </View>
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
                style={styles.removeWorkout}
              >
                <Ionicons name="trash-outline" size={18} color={colors.danger} />
              </Pressable>
            </View>
            <TextField
              label="Workout label"
              required
              value={workout.label}
              onChangeText={(label) => updateWorkout(workout.id, { label })}
              placeholder="Workout, drill, movement, session…"
              maxLength={80}
            />
            <View style={styles.detailFields}>
              <View style={{ flex: 1 }}>
                <TextField
                  label="Macro label"
                  value={workout.macroLabel}
                  onChangeText={(macroLabel) => updateWorkout(workout.id, { macroLabel })}
                  placeholder="Power, Zone 2, technique…"
                  maxLength={48}
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
                />
              </View>
            </View>
          </View>
        ))}

        {!draftWorkouts.length ? (
          <View style={[styles.noWorkouts, { borderColor: colors.border }]}>
            <AppText variant="caption" tone="muted" align="center">
              No specific workouts yet. A day label can stand on its own for rest, travel, or
              recovery.
            </AppText>
          </View>
        ) : null}

        {formError ? (
          <AppText variant="caption" tone="danger" accessibilityLiveRegion="polite">
            {formError}
          </AppText>
        ) : null}

        <View style={styles.editorActions}>
          {existingPlan ? (
            <Button
              title="Clear day"
              variant="ghost"
              disabled={busy}
              onPress={() => void clearDay()}
            />
          ) : null}
          <Button
            title="Save day"
            loading={saveDay.isPending}
            disabled={removeDay.isPending}
            onPress={() => void save()}
            style={{ flex: 1 }}
          />
        </View>
      </Sheet>
    </Screen>
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
  const summary = plan
    ? plan.workouts.length
      ? `${plan.workouts.length} ${plan.workouts.length === 1 ? 'workout' : 'workouts'}${totalSets ? ` · ${totalSets} sets / rounds` : ''}`
      : plan.notes || 'Recovery, rest, or open training day'
    : 'Add a day label and specific workouts';

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
          { backgroundColor: colors.surfaceRaised, borderColor: colors.border },
          isToday && { backgroundColor: colors.accent, borderColor: colors.accent },
          selected && !isToday && { borderColor: colors.accent },
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
        <AppText weight={plan ? '700' : '500'} tone={plan ? 'primary' : 'secondary'}>
          {plan?.label ?? 'Plan this day'}
        </AppText>
        <AppText variant="caption" tone="muted" numberOfLines={1}>
          {summary}
        </AppText>
        {plan?.workouts.length ? (
          <View style={styles.previewLabels}>
            {plan.workouts.slice(0, 3).map((workout) => (
              <View
                key={workout.id}
                style={[styles.previewPill, { backgroundColor: `${colors.accent}14` }]}
              >
                <AppText variant="micro" tone="accent" numberOfLines={1}>
                  {workout.label}
                  {workout.macroLabel ? ` · ${workout.macroLabel}` : ''}
                </AppText>
              </View>
            ))}
          </View>
        ) : null}
      </View>

      {plan ? (
        <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
      ) : (
        <View
          style={[
            styles.addIcon,
            {
              width: ADD_ICON_SIZE,
              height: ADD_ICON_SIZE,
              borderColor: colors.accent,
            },
          ]}
        >
          <Ionicons name="add" size={20} color={colors.accent} />
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

function editorTitle(date: DayKey): string {
  return `Plan ${parseDayKey(date).toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
  })}`;
}

const styles = StyleSheet.create({
  headerButton: {
    width: touchTarget,
    height: touchTarget,
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  weekNavigator: {
    minHeight: 112,
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
  eyebrow: {
    letterSpacing: 1.2,
  },
  loading: {
    minHeight: 360,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayList: {
    paddingHorizontal: spacing.lg,
  },
  dayRow: {
    minHeight: 96,
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xs,
  },
  dateTile: {
    width: 56,
    height: 60,
    borderRadius: radius.md,
    borderWidth: 1,
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
    borderRadius: radius.full,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewLabels: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    paddingTop: spacing.xs,
  },
  previewPill: {
    maxWidth: '100%',
    borderRadius: radius.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
  },
  footerCopy: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.xl,
  },
  editorIntro: {
    borderRadius: radius.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
  },
  editorIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  notesInput: {
    minHeight: 84,
    textAlignVertical: 'top',
  },
  workoutHeading: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingTop: spacing.sm,
  },
  workoutEditor: {
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: spacing.md,
    gap: spacing.md,
  },
  workoutEditorHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  workoutNumber: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  removeWorkout: {
    width: 36,
    height: 36,
    alignItems: 'flex-end',
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
    borderWidth: 1,
    borderStyle: 'dashed',
    borderRadius: radius.md,
    padding: spacing.lg,
  },
  editorActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
});
