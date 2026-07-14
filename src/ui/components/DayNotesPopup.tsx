import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { formatDayKey, DayKey } from '@/utils/date';
import {
  useAddDayNote,
  useDayNotes,
  useDeleteDayNote,
  useUpdateDayNote,
} from '@/state/queries';
import { DayNote } from '@/repositories/dayNotesRepo';
import { useTheme } from '@/ui/theme/ThemeProvider';
import { radius, spacing, type } from '@/ui/theme/tokens';
import { AppText } from './AppText';
import { GlassPopup } from './GlassPopup';

type Editor =
  | { mode: 'idle' }
  | { mode: 'create' }
  | { mode: 'edit'; note: DayNote };

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
  const notes = useDayNotes(date);
  const add = useAddDayNote();
  const update = useUpdateDayNote();
  const remove = useDeleteDayNote();
  const [editor, setEditor] = useState<Editor>({ mode: 'idle' });
  const [draft, setDraft] = useState('');
  const [sessionDate, setSessionDate] = useState<DayKey | null>(null);

  if (visible && sessionDate !== date) {
    setSessionDate(date);
    setEditor({ mode: 'idle' });
    setDraft('');
  }
  if (!visible && sessionDate !== null) {
    setSessionDate(null);
    setEditor({ mode: 'idle' });
    setDraft('');
  }

  const list = notes.data ?? [];
  const busy = add.isPending || update.isPending || remove.isPending;

  const startCreate = () => {
    setDraft('');
    setEditor({ mode: 'create' });
  };

  const startEdit = (note: DayNote) => {
    setDraft(note.body);
    setEditor({ mode: 'edit', note });
  };

  const cancelEditor = () => {
    setEditor({ mode: 'idle' });
    setDraft('');
  };

  const persist = async () => {
    const body = draft.trim();
    if (!body) return;
    if (editor.mode === 'create') {
      await add.mutateAsync({ date, body });
    } else if (editor.mode === 'edit') {
      await update.mutateAsync({ id: editor.note.id, date, body });
    }
    cancelEditor();
  };

  const deleteNote = async (note: DayNote) => {
    await remove.mutateAsync({ id: note.id, date });
    if (editor.mode === 'edit' && editor.note.id === note.id) cancelEditor();
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

      {editor.mode === 'idle' ? (
        <>
          <ScrollView
            style={styles.list}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {list.length === 0 ? (
              <AppText variant="caption" tone="muted">
                No notes yet — add one for how the day went.
              </AppText>
            ) : (
              list.map((note) => (
                <View
                  key={note.id}
                  style={[styles.noteCard, { borderColor: 'rgba(255,255,255,0.12)' }]}
                >
                  <AppText variant="caption" tone="secondary" style={styles.noteBody}>
                    {note.body}
                  </AppText>
                  <View style={styles.noteActions}>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel="Edit note"
                      onPress={() => startEdit(note)}
                      hitSlop={8}
                      style={styles.noteActionBtn}
                    >
                      <Ionicons name="pencil-outline" size={16} color={colors.accent} />
                      <AppText variant="micro" tone="accent" weight="600">
                        Edit
                      </AppText>
                    </Pressable>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel="Delete note"
                      onPress={() => void deleteNote(note)}
                      disabled={busy}
                      hitSlop={8}
                      style={styles.noteActionBtn}
                    >
                      <Ionicons name="trash-outline" size={16} color={colors.danger} />
                      <AppText variant="micro" weight="600" style={{ color: colors.danger }}>
                        Delete
                      </AppText>
                    </Pressable>
                  </View>
                </View>
              ))
            )}
          </ScrollView>

          <View style={styles.actions}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Close notes"
              onPress={onClose}
              style={styles.ghostBtn}
            >
              <AppText variant="caption" weight="600" tone="secondary">
                Close
              </AppText>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Add note"
              onPress={startCreate}
              style={[styles.saveBtn, { backgroundColor: colors.accent }]}
            >
              <Ionicons name="add" size={18} color={colors.onAccent} />
              <AppText variant="caption" weight="600" style={{ color: colors.onAccent }}>
                Add note
              </AppText>
            </Pressable>
          </View>
        </>
      ) : (
        <>
          <AppText variant="caption" tone="muted" style={{ marginBottom: spacing.sm }}>
            {editor.mode === 'create' ? 'New note' : 'Edit note'}
          </AppText>
          <TextInput
            accessibilityLabel="Note text"
            value={draft}
            onChangeText={setDraft}
            placeholder="How did today go? Wins, hunger, training…"
            placeholderTextColor={colors.textMuted}
            multiline
            textAlignVertical="top"
            autoFocus
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
              accessibilityLabel="Cancel editing"
              onPress={cancelEditor}
              style={styles.ghostBtn}
            >
              <AppText variant="caption" weight="600" tone="secondary">
                Cancel
              </AppText>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Save note"
              onPress={() => void persist()}
              disabled={busy || !draft.trim()}
              style={[
                styles.saveBtn,
                {
                  backgroundColor: colors.accent,
                  opacity: busy || !draft.trim() ? 0.5 : 1,
                },
              ]}
            >
              <AppText variant="caption" weight="600" style={{ color: colors.onAccent }}>
                {busy ? 'Saving…' : 'Save'}
              </AppText>
            </Pressable>
          </View>
        </>
      )}
    </GlassPopup>
  );
}

const styles = StyleSheet.create({
  header: {
    gap: 2,
    marginBottom: spacing.md,
  },
  list: {
    maxHeight: 280,
    marginBottom: spacing.md,
  },
  listContent: {
    gap: spacing.sm,
  },
  noteCard: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.lg,
    padding: spacing.md,
    gap: spacing.sm,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  noteBody: {
    lineHeight: 20,
  },
  noteActions: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  noteActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    minHeight: 28,
  },
  input: {
    minHeight: 120,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
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
    flexDirection: 'row',
    gap: 4,
  },
});
