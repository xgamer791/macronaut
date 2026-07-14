import { Ionicons } from '@expo/vector-icons';
import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';
import { classifyDay } from '@/domain/goals';
import { roundForDisplay, sumNutrition } from '@/domain/nutrition';
import { useRepos } from '@/state/AppProvider';
import {
  keys,
  useDayProgress,
  useDayTypeMarks,
  useDiaryEntries,
  useGoalConfigs,
  useInvalidateDiary,
  useMealCategories,
} from '@/state/queries';
import { useUiStore } from '@/state/uiStore';
import { DiaryEntry } from '@/repositories/types';
import { addDays, formatDayKey, todayKey } from '@/utils/date';
import {
  AppText,
  Button,
  Card,
  DatePickSheet,
  ListRow,
  NumberField,
  Screen,
  SegmentedControl,
  Sheet,
} from '@/ui/components';
import { useTheme } from '@/ui/theme/ThemeProvider';
import { spacing, touchTarget } from '@/ui/theme/tokens';

type CopySource = { kind: 'meal'; meal: string } | { kind: 'day' } | null;

export default function DiaryScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const qc = useQueryClient();
  const { diary, goals } = useRepos();
  const invalidate = useInvalidateDiary();

  const date = useUiStore((s) => s.selectedDate);
  const setDate = useUiStore((s) => s.setSelectedDate);
  const setTargetMeal = useUiStore((s) => s.setTargetMeal);
  const selection = useUiStore((s) => s.selectedEntryIds);
  const toggleSelected = useUiStore((s) => s.toggleEntrySelected);
  const clearSelection = useUiStore((s) => s.clearSelection);

  const entries = useDiaryEntries(date);
  const categories = useMealCategories();
  const progress = useDayProgress(date);
  const configs = useGoalConfigs();
  const marks = useDayTypeMarks();

  const [editing, setEditing] = useState<DiaryEntry | null>(null);
  const [editQty, setEditQty] = useState<number | undefined>(1);
  const [copySource, setCopySource] = useState<CopySource>(null);
  const [moveTargetOpen, setMoveTargetOpen] = useState(false);

  const byMeal = useMemo(() => {
    const map = new Map<string, DiaryEntry[]>();
    for (const e of entries.data ?? []) {
      const list = map.get(e.meal) ?? [];
      list.push(e);
      map.set(e.meal, list);
    }
    return map;
  }, [entries.data]);

  const selectionActive = selection.size > 0;

  const currentConfig = useMemo(() => {
    const list = configs.data ?? [];
    if (list.length === 0) return null;
    let chosen = list[0];
    for (const c of list) if (c.effectiveFrom <= date) chosen = c;
    return chosen;
  }, [configs.data, date]);

  const dayType =
    currentConfig?.mode === 'training-rest'
      ? classifyDay(date, currentConfig, marks.data ?? {})
      : null;

  async function saveEdit() {
    if (!editing || editQty === undefined || editQty <= 0) return;
    // Rescale the snapshot: total nutrition follows quantity proportionally.
    const factor = editQty / editing.quantity;
    await diary.update(editing.id, {
      quantity: editQty,
      nutrition: scaleAll(editing.nutrition, factor),
    });
    invalidate();
    setEditing(null);
  }

  function scaleAll(n: DiaryEntry['nutrition'], factor: number): DiaryEntry['nutrition'] {
    const out: DiaryEntry['nutrition'] = { calories: n.calories * factor };
    for (const k of ['protein', 'carbs', 'fat', 'fiber', 'sugar', 'sodium', 'cholesterol'] as const) {
      const v = n[k];
      if (v !== undefined) out[k] = v * factor;
    }
    return out;
  }

  return (
    <Screen tabBarSpace>
      {/* Date navigator */}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Previous day"
          onPress={() => setDate(addDays(date, -1))}
          style={{ minWidth: touchTarget, minHeight: touchTarget, alignItems: 'center', justifyContent: 'center' }}
        >
          <Ionicons name="chevron-back" size={22} color={colors.textPrimary} />
        </Pressable>
        <View style={{ alignItems: 'center' }}>
          <AppText variant="heading" weight="600" display>
            {formatDayKey(date)}
          </AppText>
          {date !== todayKey() ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Back to today"
              onPress={() => setDate(todayKey())}
            >
              <AppText variant="micro" tone="accent" weight="600">
                Back to today
              </AppText>
            </Pressable>
          ) : null}
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Next day"
          onPress={() => setDate(addDays(date, 1))}
          style={{ minWidth: touchTarget, minHeight: touchTarget, alignItems: 'center', justifyContent: 'center' }}
        >
          <Ionicons name="chevron-forward" size={22} color={colors.textPrimary} />
        </Pressable>
      </View>

      {/* Summary strip */}
      <Card style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <Summary label="Goal" value={Math.round(progress?.target.calories ?? 0)} />
        <Summary label="Food" value={Math.round(progress?.consumed.calories ?? 0)} />
        <Summary
          label={(progress?.caloriesRemaining ?? 0) < 0 ? 'Over' : 'Left'}
          value={Math.abs(Math.round(progress?.caloriesRemaining ?? 0))}
          danger={(progress?.caloriesRemaining ?? 0) < 0}
        />
      </Card>

      {/* Training/rest mark */}
      {currentConfig?.mode === 'training-rest' && dayType ? (
        <View style={{ gap: spacing.xs }}>
          <AppText variant="caption" tone="secondary">
            Day type (changes this date&apos;s targets)
          </AppText>
          <SegmentedControl
            options={[
              { value: 'training', label: 'Training day' },
              { value: 'rest', label: 'Rest day' },
            ]}
            value={dayType}
            onChange={async (t) => {
              await goals.setMark(date, t);
              qc.invalidateQueries({ queryKey: keys.marks });
            }}
          />
        </View>
      ) : null}

      {/* Selection toolbar */}
      {selectionActive ? (
        <Card style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
          <AppText variant="caption" weight="600" style={{ flex: 1 }}>
            {selection.size} selected
          </AppText>
          <Button title="Move" compact variant="secondary" onPress={() => setMoveTargetOpen(true)} />
          <Button
            title="Delete"
            compact
            variant="danger"
            onPress={async () => {
              await diary.removeMany([...selection]);
              clearSelection();
              invalidate();
            }}
          />
          <Button title="Done" compact variant="ghost" onPress={clearSelection} />
        </Card>
      ) : null}

      {/* Meal sections */}
      {(categories.data ?? []).map((cat) => {
        const list = byMeal.get(cat.id) ?? [];
        const totals = sumNutrition(list.map((e) => e.nutrition));
        return (
          <Card key={cat.id} padded={false} style={{ padding: spacing.md, gap: spacing.xs }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <AppText variant="body" weight="600" display>
                {cat.name}
              </AppText>
              <AppText variant="caption" tone="secondary">
                {Math.round(totals.calories)} kcal
              </AppText>
            </View>
            {list.length > 0 ? (
              <AppText variant="micro" tone="muted">
                P {roundForDisplay(totals.protein ?? 0)} · C {roundForDisplay(totals.carbs ?? 0)} · F{' '}
                {roundForDisplay(totals.fat ?? 0)}
              </AppText>
            ) : null}
            {list.map((e) => (
              <ListRow
                key={e.id}
                title={e.name}
                subtitle={e.servingDesc ?? `${e.quantity} ${e.unit}`}
                value={`${Math.round(e.nutrition.calories)}`}
                selected={selection.has(e.id)}
                onPress={() => {
                  if (selectionActive) {
                    toggleSelected(e.id);
                  } else {
                    setEditing(e);
                    setEditQty(e.quantity);
                  }
                }}
                onLongPress={() => toggleSelected(e.id)}
                accessibilityHint={selectionActive ? 'Toggle selection' : 'Edit entry'}
              />
            ))}
            <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.xs }}>
              <Button
                title="Add food"
                compact
                variant="secondary"
                onPress={() => {
                  setTargetMeal(cat.id);
                  router.push('/add');
                }}
              />
              {list.length > 0 ? (
                <>
                  <Button
                    title="Copy to…"
                    compact
                    variant="ghost"
                    onPress={() => setCopySource({ kind: 'meal', meal: cat.id })}
                  />
                  <Button
                    title="Clear"
                    compact
                    variant="ghost"
                    onPress={async () => {
                      await diary.clearMeal(date, cat.id);
                      invalidate();
                    }}
                  />
                </>
              ) : null}
            </View>
          </Card>
        );
      })}

      {(entries.data?.length ?? 0) > 0 ? (
        <Button title="Copy entire day to…" variant="secondary" onPress={() => setCopySource({ kind: 'day' })} />
      ) : null}

      {/* Edit entry sheet */}
      <Sheet visible={editing !== null} onClose={() => setEditing(null)} title={editing?.name}>
        {editing ? (
          <View style={{ gap: spacing.md }}>
            <AppText variant="caption" tone="secondary">
              {Math.round((editing.nutrition.calories / editing.quantity) * (editQty ?? 0))} kcal ·
              P {roundForDisplay(((editing.nutrition.protein ?? 0) / editing.quantity) * (editQty ?? 0))} · C{' '}
              {roundForDisplay(((editing.nutrition.carbs ?? 0) / editing.quantity) * (editQty ?? 0))} · F{' '}
              {roundForDisplay(((editing.nutrition.fat ?? 0) / editing.quantity) * (editQty ?? 0))}
            </AppText>
            <NumberField
              label={`Quantity (${editing.unit})`}
              value={editQty}
              onChange={setEditQty}
              min={0.01}
            />
            <View style={{ gap: spacing.xs }}>
              <AppText variant="caption" tone="secondary">
                Meal
              </AppText>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
                {(categories.data ?? []).map((cat) => (
                  <Button
                    key={cat.id}
                    title={cat.name}
                    compact
                    variant={editing.meal === cat.id ? 'primary' : 'secondary'}
                    onPress={async () => {
                      await diary.move(editing.id, cat.id);
                      invalidate();
                      setEditing({ ...editing, meal: cat.id });
                    }}
                  />
                ))}
              </View>
            </View>
            <Button title="Save changes" onPress={saveEdit} />
            <View style={{ flexDirection: 'row', gap: spacing.md }}>
              <Button
                title="Duplicate"
                variant="secondary"
                style={{ flex: 1 }}
                onPress={async () => {
                  await diary.duplicate(editing.id);
                  invalidate();
                  setEditing(null);
                }}
              />
              <Button
                title="Delete"
                variant="danger"
                style={{ flex: 1 }}
                onPress={async () => {
                  await diary.remove(editing.id);
                  invalidate();
                  setEditing(null);
                }}
              />
            </View>
          </View>
        ) : null}
      </Sheet>

      {/* Copy target date picker */}
      <DatePickSheet
        visible={copySource !== null}
        onClose={() => setCopySource(null)}
        title={copySource?.kind === 'day' ? 'Copy day to…' : 'Copy meal to…'}
        onPick={async (target) => {
          if (!copySource) return;
          if (copySource.kind === 'day') await diary.copyDay(date, target);
          else await diary.copyMeal(date, copySource.meal, target);
          invalidate();
        }}
      />

      {/* Move selection to meal */}
      <Sheet visible={moveTargetOpen} onClose={() => setMoveTargetOpen(false)} title="Move to meal">
        {(categories.data ?? []).map((cat) => (
          <ListRow
            key={cat.id}
            title={cat.name}
            onPress={async () => {
              await diary.moveMany([...selection], cat.id);
              clearSelection();
              invalidate();
              setMoveTargetOpen(false);
            }}
          />
        ))}
      </Sheet>
    </Screen>
  );
}

function Summary({ label, value, danger }: { label: string; value: number; danger?: boolean }) {
  return (
    <View style={{ alignItems: 'center', gap: 2 }}>
      <AppText variant="micro" tone="muted">
        {label}
      </AppText>
      <AppText variant="heading" weight="600" display tone={danger ? 'danger' : 'primary'}>
        {value.toLocaleString()}
      </AppText>
    </View>
  );
}
