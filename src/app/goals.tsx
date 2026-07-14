import { Ionicons } from '@expo/vector-icons';
import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';
import { GoalConfig, GoalMode, WeeklyGoalMode } from '@/domain/goals';
import { NutrientTargets } from '@/domain/types';
import { useRepos } from '@/state/AppProvider';
import { keys, useGoalConfigs } from '@/state/queries';
import { todayKey } from '@/utils/date';
import {
  AppText,
  Button,
  Card,
  Chip,
  Screen,
  SegmentedControl,
  Sheet,
  TargetEditor,
} from '@/ui/components';
import { useTheme } from '@/ui/theme/ThemeProvider';
import { spacing } from '@/ui/theme/tokens';

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export default function GoalsScreen() {
  const router = useRouter();
  const { goals } = useRepos();
  const qc = useQueryClient();
  const { colors } = useTheme();
  const configs = useGoalConfigs();

  const current: GoalConfig | null = useMemo(() => {
    const list = configs.data ?? [];
    if (list.length === 0) return null;
    const today = todayKey();
    let chosen = list[0];
    for (const c of list) if (c.effectiveFrom <= today) chosen = c;
    return chosen;
  }, [configs.data]);

  const [draft, setDraft] = useState<GoalConfig | null>(null);
  const [editingWeekday, setEditingWeekday] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);

  const working: GoalConfig | null = draft ?? current;
  if (configs.isLoading || !working) return <Screen>{null}</Screen>;

  const update = (patch: Partial<GoalConfig>) => setDraft({ ...working, ...patch });

  const setMode = (mode: GoalMode) => {
    const patch: Partial<GoalConfig> = { mode };
    if (mode === 'training-rest') {
      patch.training = working.training ?? {
        ...working.baseTarget,
        calories: working.baseTarget.calories + 300,
      };
      patch.rest = working.rest ?? working.baseTarget;
      patch.trainingDays = working.trainingDays ?? [1, 3, 5];
    }
    if (mode === 'per-weekday') {
      patch.perWeekday = working.perWeekday ?? [null, null, null, null, null, null, null];
    }
    update(patch);
  };

  async function save() {
    if (!working) return;
    setSaving(true);
    try {
      const { id: _id, ...rest } = working;
      await goals.saveConfig({ ...rest, effectiveFrom: todayKey() });
      qc.invalidateQueries({ queryKey: keys.goals });
      router.back();
    } finally {
      setSaving(false);
    }
  }

  const weekdayTarget = (i: number): NutrientTargets | null => working.perWeekday?.[i] ?? null;

  return (
    <Screen>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Back"
          onPress={() => router.back()}
          style={{ minWidth: 44, minHeight: 44, justifyContent: 'center' }}
        >
          <Ionicons name="chevron-back" size={24} color={colors.textPrimary} />
        </Pressable>
        <AppText variant="title" weight="600" display>
          Goals
        </AppText>
      </View>

      <Card>
        <AppText variant="caption" tone="secondary">
          Changes apply from today onward. Past days keep the targets that were in effect then, so
          your history and adherence never change retroactively.
        </AppText>
      </Card>

      <AppText variant="heading" weight="600" display>
        Daily targets
      </AppText>
      <SegmentedControl<GoalMode>
        options={[
          { value: 'same-daily', label: 'Every day' },
          { value: 'per-weekday', label: 'Per weekday' },
          { value: 'training-rest', label: 'Training/rest' },
        ]}
        value={working.mode}
        onChange={setMode}
      />

      {working.mode === 'same-daily' ? (
        <Card>
          <TargetEditor
            value={working.baseTarget}
            onChange={(t) => update({ baseTarget: t })}
          />
        </Card>
      ) : null}

      {working.mode === 'per-weekday' ? (
        <Card style={{ gap: spacing.sm }}>
          <AppText variant="caption" tone="secondary">
            Base target (used for days without an override)
          </AppText>
          <TargetEditor
            value={working.baseTarget}
            onChange={(t) => update({ baseTarget: t })}
            extended={false}
          />
          <AppText variant="caption" tone="secondary" style={{ marginTop: spacing.sm }}>
            Weekday overrides
          </AppText>
          {WEEKDAYS.map((label, i) => {
            const t = weekdayTarget(i);
            return (
              <Pressable
                key={label}
                accessibilityRole="button"
                accessibilityLabel={`Edit ${label} target`}
                onPress={() => setEditingWeekday(i)}
                style={{
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  paddingVertical: spacing.sm,
                  minHeight: 44,
                  alignItems: 'center',
                }}
              >
                <AppText variant="body">{label}</AppText>
                <AppText variant="caption" tone={t ? 'primary' : 'muted'}>
                  {t ? `${t.calories} kcal` : `Base (${working.baseTarget.calories} kcal)`}
                </AppText>
              </Pressable>
            );
          })}
        </Card>
      ) : null}

      {working.mode === 'training-rest' ? (
        <>
          <Card style={{ gap: spacing.sm }}>
            <AppText variant="caption" tone="secondary">
              Weekly training days (tap to toggle). You can also mark individual dates as training
              or rest from the Diary.
            </AppText>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
              {WEEKDAYS.map((label, i) => (
                <Chip
                  key={label}
                  label={label}
                  selected={(working.trainingDays ?? []).includes(i)}
                  onPress={() => {
                    const cur = new Set(working.trainingDays ?? []);
                    if (cur.has(i)) cur.delete(i);
                    else cur.add(i);
                    update({ trainingDays: [...cur].sort() });
                  }}
                />
              ))}
            </View>
          </Card>
          <Card style={{ gap: spacing.sm }}>
            <AppText variant="body" weight="600">
              Training day target
            </AppText>
            <TargetEditor
              value={working.training ?? working.baseTarget}
              onChange={(t) => update({ training: t })}
              extended={false}
            />
          </Card>
          <Card style={{ gap: spacing.sm }}>
            <AppText variant="body" weight="600">
              Rest day target
            </AppText>
            <TargetEditor
              value={working.rest ?? working.baseTarget}
              onChange={(t) => update({ rest: t })}
              extended={false}
            />
          </Card>
        </>
      ) : null}

      <AppText variant="heading" weight="600" display>
        Weekly goal
      </AppText>
      <SegmentedControl<WeeklyGoalMode>
        options={[
          { value: 'sum-daily', label: 'Sum of daily targets' },
          { value: 'custom', label: 'Custom weekly total' },
        ]}
        value={working.weeklyMode}
        onChange={(weeklyMode) =>
          update({
            weeklyMode,
            weeklyTarget:
              weeklyMode === 'custom'
                ? (working.weeklyTarget ?? {
                    calories: working.baseTarget.calories * 7,
                    protein: (working.baseTarget.protein ?? 0) * 7 || undefined,
                    carbs: (working.baseTarget.carbs ?? 0) * 7 || undefined,
                    fat: (working.baseTarget.fat ?? 0) * 7 || undefined,
                  })
                : working.weeklyTarget,
          })
        }
      />
      {working.weeklyMode === 'custom' && working.weeklyTarget ? (
        <Card>
          <TargetEditor
            value={working.weeklyTarget}
            onChange={(t) => update({ weeklyTarget: t })}
            extended={false}
          />
        </Card>
      ) : (
        <AppText variant="caption" tone="secondary">
          Your weekly goal is the sum of the 7 daily targets. Unused calories never roll over
          between days or weeks.
        </AppText>
      )}

      <Button title="Save goals" onPress={save} loading={saving} />

      <Sheet
        visible={editingWeekday !== null}
        onClose={() => setEditingWeekday(null)}
        title={editingWeekday !== null ? `${WEEKDAYS[editingWeekday]} target` : ''}
      >
        {editingWeekday !== null ? (
          <View style={{ gap: spacing.md }}>
            <TargetEditor
              value={weekdayTarget(editingWeekday) ?? working.baseTarget}
              onChange={(t) => {
                const arr = [...(working.perWeekday ?? [null, null, null, null, null, null, null])];
                arr[editingWeekday] = t;
                update({ perWeekday: arr });
              }}
              extended={false}
            />
            <Button
              title="Use base target"
              variant="secondary"
              onPress={() => {
                const arr = [...(working.perWeekday ?? [null, null, null, null, null, null, null])];
                arr[editingWeekday] = null;
                update({ perWeekday: arr });
                setEditingWeekday(null);
              }}
            />
            <Button title="Done" onPress={() => setEditingWeekday(null)} />
          </View>
        ) : null}
      </Sheet>
    </Screen>
  );
}
