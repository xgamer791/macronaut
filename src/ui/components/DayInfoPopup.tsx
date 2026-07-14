import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { roundForDisplay } from '@/domain/nutrition';
import {
  useActivityEntries,
  useDayNote,
  useDayProgress,
} from '@/state/queries';
import { DayKey, formatDayKey } from '@/utils/date';
import { radius, spacing } from '@/ui/theme/tokens';
import { AppText } from './AppText';
import { GlassPopup } from './GlassPopup';

export function DayInfoPopup({
  visible,
  date,
  onClose,
  onEditNotes,
}: {
  visible: boolean;
  date: DayKey;
  onClose: () => void;
  onEditNotes: () => void;
}) {
  const progress = useDayProgress(date);
  const activities = useActivityEntries(date);
  const note = useDayNote(date);

  const consumed = progress?.consumed;
  const burned = progress?.burned ?? 0;
  const target = progress?.target;
  const list = activities.data ?? [];

  return (
    <GlassPopup visible={visible} onClose={onClose} accessibilityLabel="Dismiss day summary">
      <View style={styles.header}>
        <AppText variant="heading" weight="600" display>
          {formatDayKey(date)}
        </AppText>
        <AppText variant="caption" tone="secondary">
          Macros, activity, and notes
        </AppText>
      </View>

      <View style={styles.section}>
        <AppText variant="caption" tone="muted" weight="600">
          Intake
        </AppText>
        <View style={styles.statRow}>
          <Stat
            label="Food"
            value={`${Math.round(consumed?.calories ?? 0)}`}
            unit="kcal"
          />
          <Stat label="Burned" value={`${Math.round(burned)}`} unit="kcal" accent />
          <Stat
            label="Left"
            value={`${Math.abs(Math.round(progress?.caloriesRemaining ?? 0))}`}
            unit="kcal"
            danger={(progress?.caloriesRemaining ?? 0) < 0}
          />
        </View>
        <View style={styles.macroRow}>
          <Macro
            label="P"
            value={roundForDisplay(consumed?.protein ?? 0)}
            target={target?.protein}
          />
          <Macro
            label="C"
            value={roundForDisplay(consumed?.carbs ?? 0)}
            target={target?.carbs}
          />
          <Macro
            label="F"
            value={roundForDisplay(consumed?.fat ?? 0)}
            target={target?.fat}
          />
        </View>
      </View>

      <View style={styles.section}>
        <AppText variant="caption" tone="muted" weight="600">
          Activity
        </AppText>
        {list.length === 0 ? (
          <AppText variant="caption" tone="secondary">
            No workouts logged
          </AppText>
        ) : (
          <View style={styles.stack}>
            {list.slice(0, 4).map((a) => (
              <View key={a.id} style={styles.activityRow}>
                <AppText variant="caption" weight="600" numberOfLines={1} style={{ flex: 1 }}>
                  {a.name}
                </AppText>
                <AppText variant="caption" tone="secondary">
                  {Math.round(a.caloriesBurned)} kcal
                </AppText>
              </View>
            ))}
            {list.length > 4 ? (
              <AppText variant="micro" tone="muted">
                +{list.length - 4} more
              </AppText>
            ) : null}
          </View>
        )}
      </View>

      <View style={styles.section}>
        <View style={styles.notesHeader}>
          <AppText variant="caption" tone="muted" weight="600">
            Notes
          </AppText>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Edit notes"
            onPress={onEditNotes}
            hitSlop={8}
          >
            <AppText variant="micro" tone="accent" weight="600">
              {note.data?.body ? 'Edit' : 'Add'}
            </AppText>
          </Pressable>
        </View>
        {note.data?.body ? (
          <AppText variant="caption" tone="secondary">
            {note.data.body}
          </AppText>
        ) : (
          <AppText variant="caption" tone="muted">
            No notes for this day
          </AppText>
        )}
      </View>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Close day summary"
        onPress={onClose}
        style={[styles.closeBtn, { backgroundColor: 'rgba(255,255,255,0.08)' }]}
      >
        <AppText variant="caption" weight="600">
          Close
        </AppText>
      </Pressable>
    </GlassPopup>
  );
}

function Stat({
  label,
  value,
  unit,
  accent,
  danger,
}: {
  label: string;
  value: string;
  unit: string;
  accent?: boolean;
  danger?: boolean;
}) {
  return (
    <View style={styles.stat}>
      <AppText variant="micro" tone="muted">
        {label}
      </AppText>
      <AppText
        variant="body"
        weight="600"
        display
        tone={danger ? 'danger' : accent ? 'accent' : 'primary'}
      >
        {value}
      </AppText>
      <AppText variant="micro" tone="muted">
        {unit}
      </AppText>
    </View>
  );
}

function Macro({ label, value, target }: { label: string; value: number; target?: number }) {
  return (
    <View style={styles.macro}>
      <AppText variant="micro" tone="muted">
        {label}
      </AppText>
      <AppText variant="caption" weight="600">
        {value}
        {target !== undefined ? ` / ${roundForDisplay(target)}` : ''}g
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    gap: 2,
    marginBottom: spacing.md,
  },
  section: {
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  statRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  stat: {
    flex: 1,
    gap: 2,
    padding: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  macroRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  macro: {
    flex: 1,
    gap: 2,
  },
  stack: {
    gap: spacing.xs,
  },
  activityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  notesHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  closeBtn: {
    minHeight: 44,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
