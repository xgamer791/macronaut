import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import { View } from 'react-native';
import {
  ACTIVITY_CATEGORIES,
  ACTIVITY_PRESETS,
  computeImprovements,
  estimateBurn,
} from '@/domain/activity';
import { useRepos } from '@/state/AppProvider';
import { useAddActivityEntry } from '@/state/queries';
import { useUiStore } from '@/state/uiStore';
import { ActivityIntensity, ActivityType } from '@/repositories/types';
import { formatDayKey } from '@/utils/date';
import { goBackOrHome } from '@/utils/navigation';
import {
  AppText,
  Button,
  Card,
  Chip,
  NumberField,
  Screen,
  ScreenHeader,
  TextField,
} from '@/ui/components';
import { useTheme } from '@/ui/theme/ThemeProvider';
import { spacing } from '@/ui/theme/tokens';

const TYPES: ActivityType[] = ['cardio', 'strength', 'sports', 'mobility', 'other'];

function isActivityType(v: string | undefined): v is ActivityType {
  return !!v && (TYPES as string[]).includes(v);
}

/** Manual workout logger — live estimate card with form above. */
export default function LogActivityScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const params = useLocalSearchParams<{ type?: string; name?: string }>();
  const { activity } = useRepos();
  const addEntry = useAddActivityEntry();
  const date = useUiStore((s) => s.selectedDate);

  const initialType: ActivityType = isActivityType(params.type) ? params.type : 'cardio';
  const [activityType, setActivityType] = useState<ActivityType>(initialType);
  const [name, setName] = useState(params.name ?? '');
  const [nameError, setNameError] = useState<string | undefined>();
  const [durationMin, setDurationMin] = useState<number | undefined>(30);
  const [distanceKm, setDistanceKm] = useState<number | undefined>();
  /** Manual override; when unset, burn is derived from preset × duration. */
  const [caloriesOverride, setCaloriesOverride] = useState<number | undefined>();
  const [intensity, setIntensity] = useState<ActivityIntensity>('moderate');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [improvements, setImprovements] = useState<
    ReturnType<typeof computeImprovements>
  >([]);

  const presets = useMemo(
    () => ACTIVITY_PRESETS.filter((p) => p.activityType === activityType),
    [activityType],
  );

  const selectedPreset = ACTIVITY_PRESETS.find(
    (p) => p.name.toLowerCase() === name.trim().toLowerCase(),
  );

  const estimatedBurn =
    selectedPreset && durationMin !== undefined
      ? estimateBurn(selectedPreset.kcalPerMin, durationMin)
      : undefined;
  const caloriesBurned = caloriesOverride ?? estimatedBurn;
  const hasEstimate = caloriesBurned !== undefined && caloriesBurned >= 0;
  const isManualBurn = caloriesOverride !== undefined;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!name.trim()) {
        setImprovements([]);
        return;
      }
      const prev = await activity.previousByName(name.trim(), date, 1);
      if (cancelled) return;
      setImprovements(
        computeImprovements(
          {
            durationMin,
            distanceKm,
            caloriesBurned: caloriesBurned ?? 0,
          },
          prev[0] ?? null,
        ),
      );
    })();
    return () => {
      cancelled = true;
    };
  }, [activity, name, date, durationMin, distanceKm, caloriesBurned]);

  async function save() {
    if (!name.trim()) {
      setNameError('Name this workout');
      return;
    }
    if (caloriesBurned === undefined || caloriesBurned < 0) return;
    setSaving(true);
    try {
      await addEntry.mutateAsync({
        date,
        name: name.trim(),
        activityType,
        durationMin,
        distanceKm,
        caloriesBurned,
        intensity,
        notes: notes.trim() || undefined,
        sourceType: 'manual',
      });
      goBackOrHome(router);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Screen>
      <ScreenHeader title="Log activity" />
      <AppText variant="caption" tone="secondary">
        {formatDayKey(date)} · burned calories credit your daily budget
      </AppText>

      <AppText variant="caption" tone="secondary">
        Type
      </AppText>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
        {ACTIVITY_CATEGORIES.map((c) => (
          <Chip
            key={c.id}
            label={c.name}
            selected={activityType === c.id}
            onPress={() => {
              setActivityType(c.id);
              setCaloriesOverride(undefined);
            }}
          />
        ))}
        <Chip
          label="Other"
          selected={activityType === 'other'}
          onPress={() => {
            setActivityType('other');
            setCaloriesOverride(undefined);
          }}
        />
      </View>

      {presets.length > 0 ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
          {presets.map((p) => (
            <Chip
              key={p.name}
              label={p.name}
              selected={name.trim().toLowerCase() === p.name.toLowerCase()}
              onPress={() => {
                setName(p.name);
                setNameError(undefined);
                setCaloriesOverride(undefined);
              }}
            />
          ))}
        </View>
      ) : null}

      <TextField
        label="Workout name"
        value={name}
        onChangeText={(t) => {
          setName(t);
          if (t.trim()) setNameError(undefined);
          setCaloriesOverride(undefined);
        }}
        placeholder="Morning run"
        error={nameError}
        required
      />

      <View style={{ flexDirection: 'row', gap: spacing.md }}>
        <View style={{ flex: 1 }}>
          <NumberField
            label="Duration (min)"
            value={durationMin}
            onChange={(v) => {
              setDurationMin(v);
              if (!isManualBurn) setCaloriesOverride(undefined);
            }}
            min={0}
          />
        </View>
        <View style={{ flex: 1 }}>
          <NumberField
            label="Distance (km)"
            value={distanceKm}
            onChange={setDistanceKm}
            min={0}
          />
        </View>
      </View>

      {/* Live estimate hero — mockup 6 */}
      <Card style={{ gap: spacing.md }}>
        <AppText variant="caption" tone="secondary" weight="600">
          {isManualBurn ? 'Calories burned' : 'Live estimate'}
        </AppText>
        <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: spacing.sm }}>
          <AppText
            variant="hero"
            weight="600"
            display
            style={{ color: hasEstimate ? colors.accent : colors.textMuted }}
          >
            {hasEstimate ? Math.round(caloriesBurned).toLocaleString() : '—'}
          </AppText>
          <AppText variant="body" tone="secondary">
            kcal burned
          </AppText>
        </View>
        {!hasEstimate ? (
          <AppText variant="micro" tone="muted">
            Pick a preset or enter calories below to estimate burn.
          </AppText>
        ) : estimatedBurn !== undefined && isManualBurn ? (
          <AppText variant="micro" tone="muted">
            Estimate was {Math.round(estimatedBurn).toLocaleString()} kcal · edited
          </AppText>
        ) : selectedPreset ? (
          <AppText variant="micro" tone="muted">
            From {selectedPreset.name}
            {durationMin !== undefined ? ` · ${durationMin} min` : ''}
          </AppText>
        ) : null}

        {improvements.length > 0 ? (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
            {improvements.map((chip) => (
              <View
                key={chip.label}
                style={{
                  paddingHorizontal: spacing.md,
                  paddingVertical: spacing.sm,
                  borderRadius: 999,
                  backgroundColor: colors.accent + '22',
                }}
              >
                <AppText variant="caption" weight="600" style={{ color: colors.accent }}>
                  {chip.label}
                </AppText>
              </View>
            ))}
          </View>
        ) : null}

        <NumberField
          label="Adjust calories"
          value={caloriesBurned}
          onChange={setCaloriesOverride}
          min={0}
          required
        />
      </Card>

      <AppText variant="caption" tone="secondary">
        Intensity
      </AppText>
      <View style={{ flexDirection: 'row', gap: spacing.sm }}>
        {(['easy', 'moderate', 'hard'] as ActivityIntensity[]).map((level) => (
          <Chip
            key={level}
            label={level[0].toUpperCase() + level.slice(1)}
            selected={intensity === level}
            onPress={() => setIntensity(level)}
          />
        ))}
      </View>

      <TextField
        label="Notes (optional)"
        value={notes}
        onChangeText={setNotes}
        placeholder="Felt strong on the last set…"
      />

      <Button title="Save workout" onPress={save} loading={saving} />
      <Button title="Cancel" variant="ghost" onPress={() => goBackOrHome(router)} />
    </Screen>
  );
}
