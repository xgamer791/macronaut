import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Redirect } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, AppState, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@/state/AuthProvider';
import {
  useFastingState,
  useRemoveFastingSlot,
  useSaveFastingSlot,
  useStartFast,
  useStopFast,
} from '@/state/queries';
import { parseDayKey, toDayKey, type DayKey } from '@/utils/date';
import {
  AppText,
  Button,
  Card,
  GlassHeaderBar,
  LiquidGlassCard,
  MonthCalendarPopup,
  ProgressRing,
  Screen,
  ScreenHeader,
  SegmentedControl,
  Sheet,
  TextField,
} from '@/ui/components';
import { SlideScreen } from '@/ui/motion/SlideScreen';
import { useTheme } from '@/ui/theme/ThemeProvider';
import { fonts, radius, spacing, touchTarget } from '@/ui/theme/tokens';

const MINUTE_MS = 60_000;
const DEFAULT_DURATION_MINUTES = 12 * 60;
const MAX_CUSTOM_SLOTS = 10;

const PRESET_TIMES = [
  { label: '8 hours', minutes: 8 * 60 },
  { label: '12 hours', minutes: 12 * 60 },
  { label: '1 day', minutes: 24 * 60 },
  { label: '2 days', minutes: 2 * 24 * 60 },
  { label: '3 days', minutes: 3 * 24 * 60 },
] as const;

type DateTarget = 'start' | 'end';
type Period = 'am' | 'pm';

function roundedStart(): Date {
  const date = new Date();
  date.setSeconds(0, 0);
  date.setMinutes(Math.ceil(date.getMinutes() / 5) * 5);
  return date;
}

function defaultDraft() {
  const start = roundedStart();
  return { start, end: new Date(start.getTime() + DEFAULT_DURATION_MINUTES * MINUTE_MS) };
}

export default function FastingRoute() {
  const { loading, signedIn } = useAuth();
  if (loading) return null;
  if (!signedIn) return <Redirect href="/welcome" />;
  return (
    <SlideScreen from="right">
      <FastingScreen />
    </SlideScreen>
  );
}

function FastingScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const fasting = useFastingState();
  const startFast = useStartFast();
  const stopFast = useStopFast();
  const saveSlot = useSaveFastingSlot();
  const removeSlot = useRemoveFastingSlot();
  const [now, setNow] = useState(() => Date.now());
  const [draft, setDraft] = useState(defaultDraft);
  const [seededFastKey, setSeededFastKey] = useState<string | null>(null);
  const [dateTarget, setDateTarget] = useState<DateTarget | null>(null);
  const [timeTarget, setTimeTarget] = useState<DateTarget | null>(null);
  const [timeDraft, setTimeDraft] = useState(() => roundedStart());
  const [slotOpen, setSlotOpen] = useState(false);
  const [slotName, setSlotName] = useState('');
  const [slotError, setSlotError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const activeStartAt = fasting.data?.activeStartAt ?? null;
  const activeEndAt = fasting.data?.activeEndAt ?? null;
  const hasFast = activeStartAt !== null && activeEndAt !== null;
  const activeFastKey = hasFast ? `${activeStartAt}:${activeEndAt}` : null;

  // Reconcile only when the active server timer changes. Saving or removing
  // a custom slot must not overwrite dates the user is currently editing.
  if (activeFastKey && activeFastKey !== seededFastKey) {
    setSeededFastKey(activeFastKey);
    if (activeStartAt !== null && activeEndAt !== null) {
      setDraft({ start: new Date(activeStartAt), end: new Date(activeEndAt) });
    }
  } else if (!activeFastKey && seededFastKey) {
    setSeededFastKey(null);
  }

  useEffect(() => {
    if (!hasFast) return;
    const interval = setInterval(() => setNow(Date.now()), 1_000);
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') setNow(Date.now());
    });
    return () => {
      clearInterval(interval);
      subscription.remove();
    };
  }, [hasFast]);

  const durationMinutes = Math.max(
    1,
    Math.round((draft.end.getTime() - draft.start.getTime()) / MINUTE_MS),
  );
  const activeDuration = hasFast ? Math.max(1, activeEndAt - activeStartAt) : 1;
  const phase = !hasFast
    ? 'ready'
    : now < activeStartAt
      ? 'scheduled'
      : now >= activeEndAt
        ? 'complete'
        : 'active';
  const progress =
    phase === 'active'
      ? Math.min(1, Math.max(0, (now - activeStartAt!) / activeDuration))
      : phase === 'complete'
        ? 1
        : 0;
  const timerValue =
    phase === 'scheduled'
      ? formatTimer(activeStartAt! - now)
      : phase === 'active'
        ? formatTimer(now - activeStartAt!)
        : phase === 'complete'
          ? formatTimer(activeEndAt! - activeStartAt!)
          : '00:00:00';
  const statusLabel =
    phase === 'active'
      ? 'FASTING NOW'
      : phase === 'scheduled'
        ? 'FAST SCHEDULED'
        : phase === 'complete'
          ? 'FAST COMPLETE'
          : 'READY TO FAST';
  const timerCaption =
    phase === 'active'
      ? `${formatCompactDuration(Math.ceil((activeEndAt! - now) / MINUTE_MS))} remaining`
      : phase === 'scheduled'
        ? 'Until your fast begins'
        : phase === 'complete'
          ? 'You reached your fasting goal'
          : 'Choose a time below to begin';

  function applyDuration(minutes: number) {
    void Haptics.selectionAsync();
    setDraft((current) => ({
      ...current,
      end: new Date(current.start.getTime() + minutes * MINUTE_MS),
    }));
    setError(null);
  }

  function pickDate(target: DateTarget, day: DayKey) {
    setDraft((current) => {
      const currentValue = current[target];
      const calendarDate = parseDayKey(day);
      calendarDate.setHours(currentValue.getHours(), currentValue.getMinutes(), 0, 0);
      if (target === 'start') {
        const oldDuration = Math.max(MINUTE_MS, current.end.getTime() - current.start.getTime());
        return { start: calendarDate, end: new Date(calendarDate.getTime() + oldDuration) };
      }
      return {
        ...current,
        end:
          calendarDate.getTime() > current.start.getTime()
            ? calendarDate
            : new Date(current.start.getTime() + MINUTE_MS),
      };
    });
    setDateTarget(null);
    setError(null);
  }

  function openTime(target: DateTarget) {
    setTimeDraft(new Date(draft[target]));
    setTimeTarget(target);
  }

  function applyTime() {
    if (!timeTarget) return;
    setDraft((current) => {
      if (timeTarget === 'start') {
        const oldDuration = Math.max(MINUTE_MS, current.end.getTime() - current.start.getTime());
        return { start: new Date(timeDraft), end: new Date(timeDraft.getTime() + oldDuration) };
      }
      return {
        ...current,
        end:
          timeDraft.getTime() > current.start.getTime()
            ? new Date(timeDraft)
            : new Date(current.start.getTime() + MINUTE_MS),
      };
    });
    setTimeTarget(null);
    setError(null);
  }

  async function submitFast() {
    setError(null);
    if (draft.end.getTime() <= draft.start.getTime()) {
      setError('Your end time must be after your start time.');
      return;
    }
    try {
      await startFast.mutateAsync({
        startAt: draft.start.getTime(),
        endAt: draft.end.getTime(),
      });
      setNow(Date.now());
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not save your fast.');
    }
  }

  async function saveCustomSlot() {
    setSlotError(null);
    try {
      await saveSlot.mutateAsync({ label: slotName, durationMinutes });
      setSlotName('');
      setSlotOpen(false);
    } catch (caught) {
      setSlotError(caught instanceof Error ? caught.message : 'Could not save that time.');
    }
  }

  async function stopCurrentFast() {
    setError(null);
    try {
      await stopFast.mutateAsync();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not end your fast.');
    }
  }

  return (
    <Screen
      collapseHeader={false}
      stickyHeader={
        <GlassHeaderBar inset={spacing.lg}>
          <ScreenHeader title="Fasting" />
        </GlassHeaderBar>
      }
    >
      <LiquidGlassCard contentStyle={styles.trackerCard}>
        <View style={styles.statusRow}>
          <View style={[styles.liveDot, { backgroundColor: colors.accent }]} />
          <AppText variant="micro" weight="700" style={{ color: colors.accent }}>
            {statusLabel}
          </AppText>
        </View>

        <ProgressRing
          progress={progress}
          size={204}
          strokeWidth={11}
          color={colors.accent}
          overColor={colors.accent}
          accessibilityLabel={`${statusLabel}. ${timerValue}`}
        >
          <View style={styles.timerCenter}>
            {fasting.isLoading ? (
              <ActivityIndicator color={colors.accent} />
            ) : (
              <>
                <AppText style={styles.timerValue} numberOfLines={1} adjustsFontSizeToFit>
                  {timerValue}
                </AppText>
                <AppText variant="caption" tone="secondary" align="center">
                  {phase === 'scheduled' ? 'starts in' : 'elapsed'}
                </AppText>
              </>
            )}
          </View>
        </ProgressRing>

        <AppText variant="caption" tone="secondary" align="center">
          {timerCaption}
        </AppText>

        {hasFast ? (
          <View style={[styles.activeDates, { borderTopColor: colors.border }]}>
            <TrackerDate
              label={phase === 'scheduled' ? 'STARTS' : 'STARTED'}
              value={formatDateTime(new Date(activeStartAt))}
            />
            <View style={[styles.dateDivider, { backgroundColor: colors.border }]} />
            <TrackerDate
              label={phase === 'complete' ? 'FINISHED' : 'FINISHES'}
              value={formatDateTime(new Date(activeEndAt))}
            />
          </View>
        ) : null}

        {hasFast ? (
          <Button
            title={phase === 'complete' ? 'Clear completed fast' : 'End fast'}
            variant="secondary"
            loading={stopFast.isPending}
            onPress={() => void stopCurrentFast()}
            style={styles.fullButton}
          />
        ) : null}
      </LiquidGlassCard>

      <Card style={styles.sectionCard}>
        <View style={styles.sectionHeading}>
          <View style={styles.sectionTitleRow}>
            <View style={styles.sectionIcon}>
              <Ionicons name="calendar-clear-outline" size={22} color={colors.accent} />
            </View>
            <View style={styles.sectionHeadingCopy}>
              <AppText variant="heading" weight="600" display>
                Schedule
              </AppText>
              <AppText variant="caption" tone="secondary">
                Pick exact dates and times
              </AppText>
            </View>
          </View>
          <View style={[styles.durationBadge, { backgroundColor: `${colors.accent}1F` }]}>
            <AppText variant="micro" weight="700" style={{ color: colors.accent }}>
              {formatCompactDuration(durationMinutes)}
            </AppText>
          </View>
        </View>

        <DateTimeRow
          label="START"
          value={draft.start}
          onDate={() => setDateTarget('start')}
          onTime={() => openTime('start')}
        />
        <View style={styles.timelineConnector}>
          <View style={[styles.timelineLine, { backgroundColor: colors.borderStrong }]} />
          <Ionicons name="arrow-down" size={15} color={colors.textMuted} />
        </View>
        <DateTimeRow
          label="END"
          value={draft.end}
          onDate={() => setDateTarget('end')}
          onTime={() => openTime('end')}
        />

        <AppText variant="micro" tone="secondary" weight="700" style={styles.subheading}>
          QUICK TIMES
        </AppText>
        <View style={styles.chipWrap}>
          {PRESET_TIMES.map((preset) => {
            const selected = durationMinutes === preset.minutes;
            return (
              <Pressable
                key={preset.label}
                accessibilityRole="button"
                accessibilityLabel={`Set fast for ${preset.label}`}
                accessibilityState={{ selected }}
                onPress={() => applyDuration(preset.minutes)}
                style={({ pressed }) => [
                  styles.timeChip,
                  {
                    backgroundColor: selected ? colors.accent : colors.surfaceRaised,
                    borderColor: selected ? colors.accent : colors.border,
                  },
                  pressed && styles.pressed,
                ]}
              >
                <AppText
                  variant="caption"
                  weight="600"
                  style={{ color: selected ? colors.onAccent : colors.textPrimary }}
                >
                  {preset.label}
                </AppText>
              </Pressable>
            );
          })}
        </View>

        {error ? (
          <AppText variant="caption" tone="danger" accessibilityLiveRegion="polite">
            {error}
          </AppText>
        ) : null}

        <Button
          title={hasFast ? 'Update fast' : 'Start fast'}
          loading={startFast.isPending}
          onPress={() => void submitFast()}
          style={styles.fullButton}
        />
      </Card>

      <Card style={styles.sectionCard}>
        <View style={styles.sectionHeading}>
          <View>
            <AppText variant="heading" weight="600" display>
              Saved times
            </AppText>
            <AppText variant="caption" tone="secondary">
              Reuse your own fasting routines
            </AppText>
          </View>
          <AppText variant="micro" tone="secondary" weight="700">
            {fasting.data?.customSlots.length ?? 0}/{MAX_CUSTOM_SLOTS}
          </AppText>
        </View>

        {fasting.data?.customSlots.length ? (
          <View style={styles.savedList}>
            {fasting.data.customSlots.map((slot) => (
              <View key={slot.id} style={[styles.savedRow, { borderTopColor: colors.border }]}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Use ${slot.label}, ${formatCompactDuration(slot.durationMinutes)}`}
                  onPress={() => applyDuration(slot.durationMinutes)}
                  style={({ pressed }) => [styles.savedMain, pressed && styles.pressed]}
                >
                  <View style={styles.savedIcon}>
                    <Ionicons name="bookmark-outline" size={20} color={colors.accent} />
                  </View>
                  <View style={styles.savedCopy}>
                    <AppText weight="600">{slot.label}</AppText>
                    <AppText variant="caption" tone="secondary">
                      {formatCompactDuration(slot.durationMinutes)}
                    </AppText>
                  </View>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Delete ${slot.label}`}
                  onPress={() => removeSlot.mutate(slot.id)}
                  hitSlop={8}
                  style={styles.deleteSlot}
                >
                  <Ionicons name="trash-outline" size={18} color={colors.textMuted} />
                </Pressable>
              </View>
            ))}
          </View>
        ) : (
          <View style={[styles.savedEmpty, { borderColor: colors.border }]}>
            <Ionicons name="bookmark-outline" size={21} color={colors.textMuted} />
            <AppText variant="caption" tone="secondary" align="center">
              Save a custom duration and it will appear here.
            </AppText>
          </View>
        )}

        <Button
          title="Save current duration"
          variant="secondary"
          disabled={(fasting.data?.customSlots.length ?? 0) >= MAX_CUSTOM_SLOTS}
          onPress={() => {
            setSlotName('');
            setSlotError(null);
            setSlotOpen(true);
          }}
        />
      </Card>

      <View style={styles.persistenceNote}>
        <Ionicons name="cloud-done-outline" size={17} color={colors.accent} />
        <AppText variant="micro" tone="secondary" style={styles.persistenceCopy}>
          Your timer is saved to your Macronaut account and stays accurate when the app is closed.
        </AppText>
      </View>

      <MonthCalendarPopup
        visible={dateTarget !== null}
        selected={toDayKey(dateTarget ? draft[dateTarget] : draft.start)}
        top={insets.top + 64}
        onClose={() => setDateTarget(null)}
        onSelect={(day) => pickDate(dateTarget ?? 'start', day)}
      />

      <TimePickerSheet
        visible={timeTarget !== null}
        value={timeDraft}
        onChange={setTimeDraft}
        onClose={() => setTimeTarget(null)}
        onConfirm={applyTime}
      />

      <Sheet visible={slotOpen} onClose={() => setSlotOpen(false)} title="Save fasting time">
        <View style={[styles.slotSummary, { backgroundColor: colors.surfaceRaised }]}>
          <Ionicons name="timer-outline" size={22} color={colors.accent} />
          <View>
            <AppText variant="micro" tone="secondary" weight="700">
              DURATION
            </AppText>
            <AppText variant="heading" weight="600" display>
              {formatCompactDuration(durationMinutes)}
            </AppText>
          </View>
        </View>
        <TextField
          label="Name"
          placeholder="For example, Weekday 16:8"
          value={slotName}
          maxLength={36}
          autoCapitalize="words"
          onChangeText={setSlotName}
        />
        {slotError ? (
          <AppText variant="caption" tone="danger" accessibilityLiveRegion="polite">
            {slotError}
          </AppText>
        ) : null}
        <Button
          title="Save time"
          disabled={!slotName.trim()}
          loading={saveSlot.isPending}
          onPress={() => void saveCustomSlot()}
        />
      </Sheet>
    </Screen>
  );
}

function DateTimeRow({
  label,
  value,
  onDate,
  onTime,
}: {
  label: string;
  value: Date;
  onDate: () => void;
  onTime: () => void;
}) {
  const { colors } = useTheme();
  return (
    <View>
      <AppText variant="micro" tone="secondary" weight="700" style={styles.dateLabel}>
        {label}
      </AppText>
      <View style={styles.dateTimeRow}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Change ${label.toLowerCase()} date`}
          onPress={onDate}
          style={({ pressed }) => [
            styles.dateButton,
            { backgroundColor: colors.surfaceRaised, borderColor: colors.border },
            pressed && styles.pressed,
          ]}
        >
          <Ionicons name="calendar-outline" size={18} color={colors.accent} />
          <AppText variant="caption" weight="600">
            {formatDate(value)}
          </AppText>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Change ${label.toLowerCase()} time`}
          onPress={onTime}
          style={({ pressed }) => [
            styles.timeButton,
            { backgroundColor: colors.surfaceRaised, borderColor: colors.border },
            pressed && styles.pressed,
          ]}
        >
          <Ionicons name="time-outline" size={18} color={colors.accent} />
          <AppText variant="caption" weight="600">
            {formatTime(value)}
          </AppText>
        </Pressable>
      </View>
    </View>
  );
}

function TrackerDate({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.trackerDate}>
      <AppText variant="micro" tone="secondary" weight="700">
        {label}
      </AppText>
      <AppText variant="caption" weight="600" align="center">
        {value}
      </AppText>
    </View>
  );
}

function TimePickerSheet({
  visible,
  value,
  onChange,
  onClose,
  onConfirm,
}: {
  visible: boolean;
  value: Date;
  onChange: (date: Date) => void;
  onClose: () => void;
  onConfirm: () => void;
}) {
  const { colors } = useTheme();
  const hour24 = value.getHours();
  const hour12 = hour24 % 12 || 12;
  const period: Period = hour24 >= 12 ? 'pm' : 'am';
  const minute = value.getMinutes();

  function setClock(nextHour12: number, nextMinute: number, nextPeriod: Period) {
    const next = new Date(value);
    const normalizedHour = (nextHour12 % 12) + (nextPeriod === 'pm' ? 12 : 0);
    next.setHours(normalizedHour, nextMinute, 0, 0);
    onChange(next);
  }

  return (
    <Sheet visible={visible} onClose={onClose} title="Choose time">
      <View style={styles.clockRow}>
        <ClockStepper
          label="HOUR"
          value={String(hour12)}
          onDown={() => setClock(hour12 === 1 ? 12 : hour12 - 1, minute, period)}
          onUp={() => setClock(hour12 === 12 ? 1 : hour12 + 1, minute, period)}
        />
        <AppText style={[styles.clockColon, { color: colors.textMuted }]}>:</AppText>
        <ClockStepper
          label="MINUTE"
          value={String(minute).padStart(2, '0')}
          onDown={() => setClock(hour12, minute === 0 ? 55 : minute - 5, period)}
          onUp={() => setClock(hour12, minute >= 55 ? 0 : minute + 5, period)}
        />
      </View>
      <SegmentedControl<Period>
        value={period}
        options={[
          { value: 'am', label: 'AM' },
          { value: 'pm', label: 'PM' },
        ]}
        onChange={(next) => setClock(hour12, minute, next)}
      />
      <Button title="Use this time" onPress={onConfirm} />
    </Sheet>
  );
}

function ClockStepper({
  label,
  value,
  onDown,
  onUp,
}: {
  label: string;
  value: string;
  onDown: () => void;
  onUp: () => void;
}) {
  const { colors } = useTheme();
  return (
    <View style={styles.clockStepper}>
      <AppText variant="micro" tone="secondary" weight="700">
        {label}
      </AppText>
      <View style={styles.clockControls}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Decrease ${label.toLowerCase()}`}
          onPress={onDown}
          style={[styles.clockButton, { backgroundColor: colors.surfaceRaised }]}
        >
          <Ionicons name="remove" size={21} color={colors.textPrimary} />
        </Pressable>
        <AppText style={styles.clockValue}>{value}</AppText>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Increase ${label.toLowerCase()}`}
          onPress={onUp}
          style={[styles.clockButton, { backgroundColor: colors.surfaceRaised }]}
        >
          <Ionicons name="add" size={21} color={colors.textPrimary} />
        </Pressable>
      </View>
    </View>
  );
}

function formatTimer(milliseconds: number): string {
  const totalSeconds = Math.max(0, Math.floor(milliseconds / 1_000));
  const days = Math.floor(totalSeconds / 86_400);
  const hours = Math.floor((totalSeconds % 86_400) / 3_600);
  const minutes = Math.floor((totalSeconds % 3_600) / 60);
  const seconds = totalSeconds % 60;
  const clock = [hours, minutes, seconds].map((value) => String(value).padStart(2, '0')).join(':');
  return days > 0 ? `${days}d ${clock}` : clock;
}

function formatCompactDuration(minutes: number): string {
  const rounded = Math.max(1, Math.round(minutes));
  const days = Math.floor(rounded / (24 * 60));
  const hours = Math.floor((rounded % (24 * 60)) / 60);
  const mins = rounded % 60;
  if (days && hours) return `${days}d ${hours}h`;
  if (days) return `${days} ${days === 1 ? 'day' : 'days'}`;
  if (hours && mins) return `${hours}h ${mins}m`;
  if (hours) return `${hours} ${hours === 1 ? 'hour' : 'hours'}`;
  return `${mins} min`;
}

function formatDate(date: Date): string {
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

function formatDateTime(date: Date): string {
  return `${date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} · ${formatTime(date)}`;
}

const styles = StyleSheet.create({
  trackerCard: {
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.lg,
    gap: spacing.md,
  },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  liveDot: { width: 7, height: 7, borderRadius: 4 },
  timerCenter: { alignItems: 'center', paddingHorizontal: spacing.md, width: 178 },
  timerValue: {
    color: '#F2F4F7',
    fontFamily: fonts.bold,
    fontSize: 29,
    lineHeight: 36,
    fontWeight: '700',
    letterSpacing: -0.6,
  },
  activeDates: {
    width: '100%',
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: spacing.md,
    flexDirection: 'row',
    alignItems: 'stretch',
  },
  trackerDate: { flex: 1, alignItems: 'center', gap: spacing.xs },
  dateDivider: { width: StyleSheet.hairlineWidth },
  fullButton: { alignSelf: 'stretch' },
  sectionCard: { gap: spacing.lg },
  sectionHeading: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  sectionTitleRow: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  sectionIcon: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionHeadingCopy: { flex: 1 },
  durationBadge: { borderRadius: radius.full, paddingHorizontal: spacing.md, paddingVertical: 7 },
  dateLabel: { marginBottom: spacing.sm },
  dateTimeRow: { flexDirection: 'row', gap: spacing.sm },
  dateButton: {
    flex: 1,
    minHeight: touchTarget,
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  timeButton: {
    minWidth: 124,
    minHeight: touchTarget,
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  timelineConnector: { height: 25, width: 24, alignItems: 'center', justifyContent: 'center' },
  timelineLine: { width: 1, height: 9 },
  subheading: { marginTop: spacing.xs },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  timeChip: {
    borderWidth: 1,
    borderRadius: radius.full,
    minHeight: 38,
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
  },
  pressed: { opacity: 0.7 },
  savedList: { marginHorizontal: -spacing.xs },
  savedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  savedMain: {
    flex: 1,
    minHeight: 64,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.xs,
  },
  savedIcon: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  savedCopy: { flex: 1 },
  deleteSlot: {
    width: touchTarget,
    height: touchTarget,
    alignItems: 'center',
    justifyContent: 'center',
  },
  savedEmpty: {
    borderWidth: 1,
    borderStyle: 'dashed',
    borderRadius: radius.md,
    minHeight: 96,
    padding: spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  persistenceNote: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    paddingHorizontal: spacing.sm,
  },
  persistenceCopy: { flex: 1 },
  slotSummary: {
    minHeight: 68,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  clockRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  clockStepper: { alignItems: 'center', gap: spacing.sm },
  clockControls: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  clockButton: {
    width: touchTarget,
    height: touchTarget,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  clockValue: {
    width: 52,
    textAlign: 'center',
    fontFamily: fonts.semibold,
    fontSize: 28,
    lineHeight: 34,
    fontWeight: '600',
  },
  clockColon: { fontFamily: fonts.semibold, fontSize: 28, lineHeight: 44, paddingBottom: 1 },
});
