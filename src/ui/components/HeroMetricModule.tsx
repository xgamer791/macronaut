import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { heroMetricDef, type HeroMetricId } from '@/data/heroMetrics';
import { useTheme } from '@/ui/theme/ThemeProvider';
import { fonts, radius, spacing } from '@/ui/theme/tokens';
import { AppText } from './AppText';
import { ProgressRing } from './ProgressRing';

export interface HeroMetricValues {
  /** Primary displayed amount (remaining, grams, cups, steps, burned…). */
  value: number;
  /** Goal / target when applicable. */
  target?: number;
  /** 0..1 fill for rings/bars when the primary value isn’t a simple ratio. */
  progress?: number;
  /** For calories ring: true when over goal. */
  over?: boolean;
  /** Optional secondary line (e.g. burned total label). */
  detail?: string;
}

export interface HeroMetricModuleProps {
  metric: HeroMetricId;
  values: HeroMetricValues;
  onPress: () => void;
  /** Shared outer size so left/right modules stay aligned. */
  size: number;
}

/**
 * Today hero tracking module. Outer chrome matches the calorie card shell;
 * inner layout is metric-specific (ring / macro / steps / water / burned).
 */
export function HeroMetricModule({ metric, values, onPress, size }: HeroMetricModuleProps) {
  const { colors, resolved } = useTheme();
  const def = heroMetricDef(metric);
  const shell = {
    backgroundColor: resolved === 'dark' ? 'rgba(23,27,32,0.94)' : colors.surface,
    borderColor: colors.borderStrong,
    width: size,
    height: size,
  };

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${def.label} module. ${Math.round(values.value)} ${def.unit}. Tap to change.`}
      onPress={onPress}
      style={({ pressed }) => [
        styles.shell,
        shell,
        { opacity: pressed ? 0.92 : 1 },
      ]}
    >
      {def.kind === 'ring' ? (
        <RingInner
          metric={metric}
          values={values}
          ringSize={Math.min(118, size - spacing.md * 2)}
        />
      ) : def.kind === 'macro' ? (
        <MacroInner metric={metric} values={values} />
      ) : def.kind === 'steps' ? (
        <StepsInner values={values} />
      ) : def.kind === 'water' ? (
        <WaterInner values={values} />
      ) : (
        <BurnedInner values={values} />
      )}
    </Pressable>
  );
}

function ringAccent(
  metric: HeroMetricId,
  colors: { protein: string; carbs: string; fat: string },
): string | undefined {
  if (metric === 'protein') return colors.protein;
  if (metric === 'carbs') return colors.carbs;
  if (metric === 'fat') return colors.fat;
  return undefined; // calories uses theme accent
}

/** Shared ring layout used by calories + protein/carbs/fat. */
function RingInner({
  metric,
  values,
  ringSize,
}: {
  metric: HeroMetricId;
  values: HeroMetricValues;
  ringSize: number;
}) {
  const { colors } = useTheme();
  const def = heroMetricDef(metric);
  const remaining = values.value;
  const progress = Math.min(Math.max(values.progress ?? 0.02, 0.02), 1);
  const accent = ringAccent(metric, colors);

  return (
    <ProgressRing
      progress={progress}
      size={ringSize}
      strokeWidth={Math.max(8, Math.round(ringSize * 0.09))}
      color={accent}
      accessibilityLabel={`${def.label}: ${Math.round(remaining)} ${values.over ? 'over' : 'left'}`}
    >
      <View style={styles.centerCopy}>
        <AppText variant="micro" tone={values.over ? 'danger' : 'muted'} align="center">
          {values.over ? `${def.label} over` : `${def.label} left`}
        </AppText>
        <AppText
          variant="heading"
          weight="700"
          display
          align="center"
          style={styles.bigNumber}
        >
          {Math.round(Math.abs(remaining)).toLocaleString()}
        </AppText>
        <AppText variant="micro" tone="muted">
          {def.unit}
        </AppText>
      </View>
    </ProgressRing>
  );
}

function MacroInner({ metric, values }: { metric: HeroMetricId; values: HeroMetricValues }) {
  const { colors } = useTheme();
  const def = heroMetricDef(metric);
  const accent =
    metric === 'protein'
      ? colors.protein
      : metric === 'carbs'
        ? colors.carbs
        : metric === 'fat'
          ? colors.fat
          : colors.fiber;
  const target = values.target ?? 0;
  const pct = target > 0 ? Math.min(values.value / target, 1) : 0;

  return (
    <View style={styles.macroLayout}>
      <View style={styles.macroTop}>
        <View style={[styles.iconBadge, { backgroundColor: accent + '33' }]}>
          <Ionicons name={def.icon} size={16} color={accent} />
        </View>
        <AppText variant="caption" weight="600" tone="secondary">
          {def.label}
        </AppText>
      </View>
      <AppText variant="heading" weight="700" display style={styles.macroValue}>
        {Math.round(values.value)}
        <AppText variant="caption" tone="muted">
          {' '}
          g
        </AppText>
      </AppText>
      <View style={[styles.barTrack, { backgroundColor: colors.track }]}>
        <View
          style={[
            styles.barFill,
            { width: `${pct * 100}%`, backgroundColor: accent },
          ]}
        />
      </View>
      <AppText variant="micro" tone="muted">
        / {Math.round(target)} g goal
      </AppText>
    </View>
  );
}

function StepsInner({ values }: { values: HeroMetricValues }) {
  const { colors } = useTheme();
  const target = values.target ?? 0;
  const pct = target > 0 ? Math.min(values.value / target, 1) : 0;

  return (
    <View style={styles.stepsLayout}>
      <Ionicons name="walk-outline" size={26} color={colors.accent} />
      <AppText variant="micro" tone="muted" weight="600">
        Steps
      </AppText>
      <AppText variant="heading" weight="700" display style={styles.stepsValue}>
        {Math.round(values.value).toLocaleString()}
      </AppText>
      <View style={[styles.strideTrack, { backgroundColor: colors.track }]}>
        <View
          style={[
            styles.strideFill,
            { width: `${Math.max(pct * 100, pct > 0 ? 4 : 0)}%`, backgroundColor: colors.accent },
          ]}
        />
      </View>
      <AppText variant="micro" tone="muted">
        / {Math.round(target).toLocaleString()} goal
      </AppText>
    </View>
  );
}

function WaterInner({ values }: { values: HeroMetricValues }) {
  const { colors } = useTheme();
  const target = Math.max(1, Math.round(values.target ?? 8));
  const filled = Math.max(0, Math.round(values.value));
  const cupCount = Math.min(target, 8);
  const water = '#4EA8F0';

  return (
    <View style={styles.waterLayout}>
      <View style={styles.waterHeader}>
        <Ionicons name="water" size={18} color={water} />
        <AppText variant="caption" weight="600" tone="secondary">
          Water
        </AppText>
      </View>
      <AppText variant="heading" weight="700" display align="center" style={styles.waterValue}>
        {filled}
        <AppText variant="caption" tone="muted">
          {' '}
          / {target}
        </AppText>
      </AppText>
      <View style={styles.cupRow}>
        {Array.from({ length: cupCount }, (_, i) => {
          const on = i < filled;
          return (
            <View key={i} style={styles.cupGlyph} accessibilityLabel={on ? 'Cup filled' : 'Cup empty'}>
              <Ionicons
                name={on ? 'cafe' : 'cafe-outline'}
                size={20}
                color={on ? water : colors.textMuted}
              />
            </View>
          );
        })}
      </View>
      <AppText variant="micro" tone="muted" align="center">
        cups today
      </AppText>
    </View>
  );
}

function BurnedInner({ values }: { values: HeroMetricValues }) {
  const { colors } = useTheme();
  return (
    <View style={styles.burnedLayout}>
      <View style={[styles.iconBadge, { backgroundColor: colors.warning + '33' }]}>
        <Ionicons name="flash" size={18} color={colors.warning} />
      </View>
      <AppText variant="micro" tone="muted" weight="600">
        Burned
      </AppText>
      <AppText variant="heading" weight="700" display style={styles.burnedValue}>
        {Math.round(values.value).toLocaleString()}
      </AppText>
      <AppText variant="caption" tone="secondary">
        kcal from activity
      </AppText>
      {values.detail ? (
        <AppText variant="micro" tone="muted" numberOfLines={1}>
          {values.detail}
        </AppText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  shell: {
    borderRadius: radius.xl,
    borderWidth: 1,
    padding: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  centerCopy: {
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  bigNumber: {
    fontSize: 22,
    lineHeight: 26,
    fontFamily: fonts.display,
  },
  macroLayout: {
    flex: 1,
    width: '100%',
    justifyContent: 'space-between',
    gap: 6,
  },
  macroTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  iconBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  macroValue: {
    fontSize: 28,
    lineHeight: 32,
    fontFamily: fonts.display,
  },
  barTrack: {
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
    width: '100%',
  },
  barFill: {
    height: '100%',
    borderRadius: 4,
  },
  stepsLayout: {
    flex: 1,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  stepsValue: {
    fontSize: 26,
    lineHeight: 30,
    fontFamily: fonts.display,
  },
  strideTrack: {
    marginTop: 4,
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
    width: '100%',
  },
  strideFill: {
    height: '100%',
    borderRadius: 3,
  },
  waterLayout: {
    flex: 1,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  waterHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  waterValue: {
    fontSize: 28,
    lineHeight: 32,
    fontFamily: fonts.display,
  },
  cupRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    maxWidth: '100%',
  },
  cupGlyph: {
    width: 22,
    height: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  burnedLayout: {
    flex: 1,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  burnedValue: {
    fontSize: 28,
    lineHeight: 32,
    fontFamily: fonts.display,
  },
});
