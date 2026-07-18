import { Ionicons } from '@expo/vector-icons';
import { Image, type ImageSource } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  ACTIVITY_CATEGORIES,
  ACTIVITY_PRESETS,
  estimateBurn,
} from '@/domain/activity';
import { useAddActivityEntry } from '@/state/queries';
import { useUiStore } from '@/state/uiStore';
import { ActivityIntensity, ActivityType } from '@/repositories/types';
import { goBackOrHome } from '@/utils/navigation';
import { AppText, NumberField } from '@/ui/components';
import { useTheme } from '@/ui/theme/ThemeProvider';
import { radius, spacing, touchTarget } from '@/ui/theme/tokens';

const TYPE_IMAGES: Record<Exclude<ActivityType, 'other'>, ImageSource> = {
  cardio: require('../../assets/images/activity/activity-cardio.jpg'),
  strength: require('../../assets/images/activity/activity-strength.jpg'),
  sports: require('../../assets/images/activity/activity-sports.jpg'),
  mobility: require('../../assets/images/activity/activity-mobility.jpg'),
};

const HERO_BLURBS: Record<Exclude<ActivityType, 'other'>, string> = {
  cardio: 'Elevate your heart rate and boost endurance',
  strength: 'Build muscle, power, and resilience',
  sports: 'Play hard. Compete. Stay active.',
  mobility: 'Improve flexibility and move better',
};

const PHOTO_TYPES = ACTIVITY_CATEGORIES.map((c) => c.id);

const INTENSITY_LABEL: Record<ActivityIntensity, string> = {
  easy: 'Easy',
  moderate: 'Moderate',
  hard: 'High',
};

function isPhotoType(v: string | undefined): v is Exclude<ActivityType, 'other'> {
  return !!v && (PHOTO_TYPES as string[]).includes(v);
}

/** Type-reactive photo Log activity — matches photographic mockup 6. */
export default function LogActivityScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { width, height: windowHeight } = useWindowDimensions();
  const params = useLocalSearchParams<{ type?: string; name?: string }>();
  const addEntry = useAddActivityEntry();
  const date = useUiStore((s) => s.selectedDate);

  const initialType: Exclude<ActivityType, 'other'> = isPhotoType(params.type)
    ? params.type
    : 'cardio';
  const [activityType, setActivityType] =
    useState<Exclude<ActivityType, 'other'>>(initialType);
  const [name, setName] = useState(params.name ?? '');
  const [durationMin, setDurationMin] = useState<number | undefined>(55);
  const [caloriesOverride, setCaloriesOverride] = useState<number | undefined>();
  const [intensity, setIntensity] = useState<ActivityIntensity>('hard');
  const [notes, setNotes] = useState('');
  const [intensityOpen, setIntensityOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [calorieEdit, setCalorieEdit] = useState(false);

  const category = ACTIVITY_CATEGORIES.find((c) => c.id === activityType)!;
  const heroImage = TYPE_IMAGES[activityType];
  const chipWidth = Math.min(104, (width - spacing.lg * 2 - spacing.sm * 3) / 4);

  const defaultPreset = useMemo(
    () => ACTIVITY_PRESETS.find((p) => p.activityType === activityType),
    [activityType],
  );

  const estimatedBurn =
    defaultPreset && durationMin !== undefined
      ? estimateBurn(defaultPreset.kcalPerMin, durationMin)
      : undefined;
  const caloriesBurned = caloriesOverride ?? estimatedBurn ?? 0;

  // When type changes, adopt that type’s default workout name for save.
  useEffect(() => {
    if (params.name) return;
    const preset = ACTIVITY_PRESETS.find((p) => p.activityType === activityType);
    if (preset) {
      setName(preset.name);
      setCaloriesOverride(undefined);
    }
  }, [activityType, params.name]);

  async function save() {
    const workoutName = name.trim() || category.name;
    if (caloriesBurned < 0) return;
    setSaving(true);
    try {
      await addEntry.mutateAsync({
        date,
        name: workoutName,
        activityType,
        durationMin,
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

  // Fill the viewport: ~32% hero, fixed chips, panel grows to the bottom.
  const heroHeight = Math.round(
    Math.min(Math.max(windowHeight * 0.32, 200), width * 0.68),
  );

  return (
    <View
      style={[
        styles.root,
        {
          backgroundColor: colors.background,
          paddingBottom: Math.max(insets.bottom, spacing.sm),
        },
      ]}
    >
      {/* —— Hero —— */}
      <View style={[styles.hero, { height: heroHeight }]}>
        <Image
          source={heroImage}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          transition={200}
        />
        <LinearGradient
          colors={['rgba(8,12,16,0.35)', 'rgba(8,12,16,0.15)', 'rgba(8,12,16,0.92)']}
          locations={[0, 0.45, 1]}
          style={StyleSheet.absoluteFill}
        />

        {/* Header over hero */}
        <View style={[styles.header, { paddingTop: insets.top + spacing.xs }]}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Close"
            onPress={() => goBackOrHome(router)}
            hitSlop={8}
            style={styles.headerBtn}
          >
            <Ionicons name="close" size={26} color="#FFFFFF" />
          </Pressable>
          <AppText
            variant="heading"
            weight="600"
            display
            style={styles.headerTitle}
            numberOfLines={1}
          >
            Log Activity
          </AppText>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Save workout"
            disabled={saving}
            onPress={save}
            hitSlop={8}
            style={styles.headerBtn}
          >
            <Ionicons
              name="checkmark"
              size={28}
              color={saving ? colors.textMuted : colors.accent}
            />
          </Pressable>
        </View>

        {/* Hero copy */}
        <View style={styles.heroCopy}>
          <View style={[styles.heroIconRing, { borderColor: colors.accent }]}>
            <Ionicons name={category.icon} size={20} color={colors.accent} />
          </View>
          <AppText variant="title" weight="700" display style={{ color: '#FFFFFF' }}>
            {category.name}
          </AppText>
          <AppText
            variant="caption"
            style={{ color: 'rgba(235,240,245,0.9)', maxWidth: 260 }}
            numberOfLines={2}
          >
            {HERO_BLURBS[activityType]}
          </AppText>
        </View>
      </View>

      {/* —— Type photo chips —— */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        bounces={false}
        style={styles.chipScroll}
        contentContainerStyle={styles.chipRow}
      >
          {ACTIVITY_CATEGORIES.map((c) => {
            const typeId = c.id as Exclude<ActivityType, 'other'>;
            const selected = activityType === typeId;
            return (
              <Pressable
                key={c.id}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                accessibilityLabel={c.name}
                onPress={() => setActivityType(typeId)}
                style={[
                  styles.typeChip,
                  { width: chipWidth },
                  selected && { borderColor: colors.accent, borderWidth: 2 },
                ]}
              >
                <Image
                  source={TYPE_IMAGES[typeId]}
                  style={StyleSheet.absoluteFill}
                  contentFit="cover"
                />
                <LinearGradient
                  colors={['rgba(0,0,0,0.15)', 'rgba(0,0,0,0.75)']}
                  style={StyleSheet.absoluteFill}
                />
                <View
                  style={[
                    styles.chipIcon,
                    {
                      backgroundColor: selected ? colors.accent : 'rgba(20,24,28,0.75)',
                    },
                  ]}
                >
                  <Ionicons
                    name={c.icon}
                    size={16}
                    color={selected ? colors.onAccent : '#FFFFFF'}
                  />
                </View>
                <AppText
                  variant="caption"
                  weight="600"
                  style={styles.chipLabel}
                  numberOfLines={1}
                >
                  {c.name}
                </AppText>
              </Pressable>
            );
          })}
        </ScrollView>

      {/* —— Details panel (fills remaining viewport height) —— */}
      <View style={[styles.panel, { backgroundColor: colors.surface }]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Edit calories"
          onPress={() => setCalorieEdit((v) => !v)}
          style={styles.calRow}
        >
          <View style={{ flex: 1, gap: 2 }}>
            <AppText variant="micro" tone="muted" weight="600" style={styles.caps}>
              Calories
            </AppText>
            <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8 }}>
              <AppText
                variant="hero"
                weight="600"
                display
                style={{ color: colors.accent, fontSize: 36, lineHeight: 42 }}
              >
                {Math.round(caloriesBurned).toLocaleString()}
              </AppText>
              <AppText variant="body" style={{ color: colors.accent }}>
                kcal
              </AppText>
            </View>
          </View>
          <Ionicons name="flame" size={26} color={colors.accent} />
        </Pressable>

        {calorieEdit ? (
          <NumberField
            label="Adjust calories"
            value={caloriesBurned}
            onChange={setCaloriesOverride}
            min={0}
          />
        ) : null}

        <View style={[styles.splitRow, { borderColor: colors.border }]}>
          <View style={styles.splitCell}>
            <AppText variant="micro" tone="muted" weight="600" style={styles.caps}>
              Duration
            </AppText>
            <View style={styles.splitValue}>
              <Ionicons name="time-outline" size={18} color={colors.accent} />
              <TextInput
                accessibilityLabel="Duration in minutes"
                keyboardType="number-pad"
                value={durationMin !== undefined ? String(durationMin) : ''}
                onChangeText={(t) => {
                  if (t === '') {
                    setDurationMin(undefined);
                    return;
                  }
                  const n = Number(t);
                  if (Number.isFinite(n) && n >= 0) setDurationMin(Math.round(n));
                }}
                placeholder="0"
                placeholderTextColor={colors.textMuted}
                style={[styles.durationInput, { color: colors.textPrimary }]}
              />
              <AppText variant="caption" tone="muted">
                min
              </AppText>
            </View>
          </View>

          <View style={[styles.vRule, { backgroundColor: colors.borderStrong }]} />

          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Intensity ${INTENSITY_LABEL[intensity]}`}
            onPress={() => setIntensityOpen((o) => !o)}
            style={styles.splitCell}
          >
            <AppText variant="micro" tone="muted" weight="600" style={styles.caps}>
              Intensity
            </AppText>
            <View style={styles.splitValue}>
              <Ionicons name="cellular-outline" size={18} color={colors.accent} />
              <AppText variant="body" weight="600">
                {INTENSITY_LABEL[intensity]}
              </AppText>
              <Ionicons name="chevron-down" size={16} color={colors.textMuted} />
            </View>
          </Pressable>
        </View>

        {intensityOpen ? (
          <View style={styles.intensityMenu}>
            {(['easy', 'moderate', 'hard'] as ActivityIntensity[]).map((level) => (
              <Pressable
                key={level}
                onPress={() => {
                  setIntensity(level);
                  setIntensityOpen(false);
                }}
                style={[
                  styles.intensityOption,
                  intensity === level && { backgroundColor: colors.accent + '22' },
                ]}
              >
                <AppText
                  variant="body"
                  weight={intensity === level ? '600' : '400'}
                  style={{ color: intensity === level ? colors.accent : colors.textPrimary }}
                >
                  {INTENSITY_LABEL[level]}
                </AppText>
              </Pressable>
            ))}
          </View>
        ) : null}

        <View style={styles.notesBlock}>
          <AppText variant="micro" tone="muted" weight="600" style={styles.caps}>
            Notes (optional)
          </AppText>
          <TextInput
            accessibilityLabel="Notes"
            value={notes}
            onChangeText={(t) => setNotes(t.slice(0, 150))}
            placeholder="How did it go?"
            placeholderTextColor={colors.textMuted}
            multiline
            style={[
              styles.notes,
              {
                color: colors.textPrimary,
                borderColor: colors.borderStrong,
                backgroundColor: colors.background,
              },
            ]}
          />
          <AppText variant="micro" tone="muted" align="right">
            {notes.length}/150
          </AppText>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    overflow: 'hidden',
  },
  hero: {
    width: '100%',
    flexShrink: 0,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    minHeight: touchTarget,
    zIndex: 2,
  },
  headerBtn: {
    width: touchTarget,
    height: touchTarget,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    color: '#FFFFFF',
  },
  heroCopy: {
    position: 'absolute',
    left: spacing.lg,
    right: spacing.lg,
    bottom: spacing.md + 18,
    gap: 2,
  },
  heroIconRing: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
  },
  // Keep the chip row from stealing vertical flex space (RN ScrollView default).
  chipScroll: {
    flexGrow: 0,
    flexShrink: 0,
    // Negative margin pulls chips into the hero fade without leaving a gap below.
    marginTop: -20,
  },
  chipRow: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xs,
    paddingBottom: spacing.sm,
    gap: spacing.sm,
  },
  typeChip: {
    height: 88,
    borderRadius: radius.lg,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.08)',
    justifyContent: 'space-between',
    padding: spacing.sm,
    backgroundColor: '#1A1F24',
  },
  chipIcon: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'flex-start',
  },
  chipLabel: {
    color: '#FFFFFF',
    alignSelf: 'flex-start',
  },
  panel: {
    flex: 1,
    minHeight: 0,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.xs,
    borderRadius: radius.xl,
    padding: spacing.md,
    gap: spacing.sm,
  },
  notesBlock: {
    flex: 1,
    minHeight: 0,
    gap: spacing.xs,
  },
  calRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    flexShrink: 0,
  },
  caps: {
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  splitRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingVertical: spacing.sm,
    flexShrink: 0,
  },
  splitCell: {
    flex: 1,
    gap: 6,
    paddingHorizontal: spacing.xs,
  },
  splitValue: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  vRule: {
    width: StyleSheet.hairlineWidth,
    alignSelf: 'stretch',
  },
  durationInput: {
    minWidth: 36,
    fontSize: 17,
    fontWeight: '600',
    padding: 0,
  },
  intensityMenu: {
    gap: 4,
    flexShrink: 0,
  },
  intensityOption: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.sm,
  },
  notes: {
    flex: 1,
    minHeight: 64,
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    textAlignVertical: 'top',
    fontSize: 15,
  },
});
