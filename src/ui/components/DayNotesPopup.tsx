import React, { useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import { formatDayKey, DayKey } from '@/utils/date';
import { useDayNote, useSetDayNote } from '@/state/queries';
import { useTheme } from '@/ui/theme/ThemeProvider';
import { radius, spacing, type } from '@/ui/theme/tokens';
import { AppText } from './AppText';
import { GlassPopup } from './GlassPopup';

export function DayNotesPopup({
  visible,
  date,
  onClose,
}: {
  visible: boolean;
  date: DayKey;
  onClose: () => void;
}) {
  const { colors } = useTheme();
  const note = useDayNote(date);
  const save = useSetDayNote();
  const [draft, setDraft] = useState<string | null>(null);
  const [editingFor, setEditingFor] = useState<DayKey | null>(null);

  // Sync editor session when the popup opens for a date (avoid setState-in-effect).
  if (visible && editingFor !== date) {
    setEditingFor(date);
    setDraft(null);
  }
  if (!visible && editingFor !== null) {
    setEditingFor(null);
    setDraft(null);
  }

  const value = draft ?? note.data?.body ?? '';

  const persist = async () => {
    await save.mutateAsync({ date, body: value });
    onClose();
  };

  return (
    <GlassPopup visible={visible} onClose={onClose} accessibilityLabel="Dismiss notes">
      <View style={styles.header}>
        <AppText variant="heading" weight="600" display>
          Notes
        </AppText>
        <AppText variant="caption" tone="secondary">
          {formatDayKey(date)}
        </AppText>
      </View>
      <TextInput
        accessibilityLabel="Day notes"
        value={value}
        onChangeText={setDraft}
        placeholder="How did today go? Wins, hunger, training…"
        placeholderTextColor={colors.textMuted}
        multiline
        textAlignVertical="top"
        style={[
          type.body,
          styles.input,
          {
            color: colors.textPrimary,
            backgroundColor: 'rgba(255,255,255,0.06)',
            borderColor: 'rgba(255,255,255,0.14)',
          },
        ]}
      />
      <View style={styles.actions}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Cancel notes"
          onPress={onClose}
          style={styles.ghostBtn}
        >
          <AppText variant="caption" weight="600" tone="secondary">
            Cancel
          </AppText>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Save notes"
          onPress={() => void persist()}
          disabled={save.isPending}
          style={[styles.saveBtn, { backgroundColor: colors.accent, opacity: save.isPending ? 0.7 : 1 }]}
        >
          <AppText variant="caption" weight="600" style={{ color: colors.onAccent }}>
            {save.isPending ? 'Saving…' : 'Save'}
          </AppText>
        </Pressable>
      </View>
    </GlassPopup>
  );
}

const styles = StyleSheet.create({
  header: {
    gap: 2,
    marginBottom: spacing.md,
  },
  input: {
    minHeight: 140,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: spacing.sm,
  },
  ghostBtn: {
    minHeight: 40,
    paddingHorizontal: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveBtn: {
    minHeight: 40,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
