import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';
import { roundForDisplay } from '@/domain/nutrition';
import { useBarEntranceProgress } from '@/ui/motion/barEntrance';
import { useTheme } from '@/ui/theme/ThemeProvider';
import { radius, spacing } from '@/ui/theme/tokens';
import { AppText } from './AppText';

/** Explicit track thickness (dp/css px) for the Protein/Carbs/Fat bars. */
const TRACK_HEIGHT = 9;

export interface MacroColumn {
  label: string;
  consumed: number;
  target?: number;
  /** @deprecated Bars always use the app accent; kept optional for call-site compat. */
  color?: string;
}

export interface MacroSummaryProps {
  /** Ordered columns — callers control Protein / Carbs / Fat sequence. */
  macros: MacroColumn[];
  unit?: string;
}

/**
 * Compact three-column macros card (Protein · Carbs · Fat).
 * Swap toggles consumed vs remaining values, matching diary-style UX.
 */
export function MacroSummary({ macros, unit = 'g' }: MacroSummaryProps) {
  const { colors } = useTheme();
  const entrance = useBarEntranceProgress();
  const [showRemaining, setShowRemaining] = useState(false);

  const fillStyle = useAnimatedStyle(() => ({
    transform: [{ scaleX: entrance.value }],
  }));

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: colors.surface,
          borderColor: colors.border,
        },
      ]}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={showRemaining ? 'Show consumed amounts' : 'Show remaining amounts'}
        onPress={() => setShowRemaining((v) => !v)}
        hitSlop={8}
        style={[styles.swap, { backgroundColor: colors.track }]}
      >
        <Ionicons name="swap-horizontal" size={16} color={colors.textSecondary} />
      </Pressable>

      <View style={styles.row}>
        {macros.map((macro) => {
          const target = macro.target;
          const consumed = macro.consumed;
          const over = target !== undefined && target > 0 && consumed > target;
          const pct = target && target > 0 ? Math.min(consumed / target, 1) : 0;
          const primary = showRemaining
            ? target !== undefined
              ? roundForDisplay(target - consumed)
              : roundForDisplay(consumed)
            : roundForDisplay(consumed);
          const primaryLabel = showRemaining && over ? Math.abs(primary) : primary;

          return (
            <View key={macro.label} style={styles.column}>
              <AppText variant="caption" tone="secondary">
                {macro.label}
              </AppText>
              <View style={styles.valueRow}>
                <AppText
                  variant="heading"
                  weight="600"
                  display
                  tone={over ? 'danger' : 'primary'}
                >
                  {showRemaining && over ? '−' : ''}
                  {primaryLabel} {unit}
                </AppText>
                {target !== undefined ? (
                  <AppText variant="caption" tone="muted">
                    {' '}
                    / {roundForDisplay(target)}
                  </AppText>
                ) : null}
              </View>
              <View
                style={[
                  styles.track,
                  { backgroundColor: colors.track, height: TRACK_HEIGHT },
                ]}
                accessible
                accessibilityRole="progressbar"
                accessibilityLabel={`${macro.label}: ${roundForDisplay(consumed)}${unit}${
                  target !== undefined ? ` of ${roundForDisplay(target)}${unit}` : ''
                }${over ? ', over target' : ''}${showRemaining ? ', showing remaining' : ''}`}
              >
                <Animated.View
                  style={[
                    styles.fill,
                    {
                      width: `${pct * 100}%`,
                      backgroundColor: colors.accent,
                    },
                    fillStyle,
                  ]}
                />
              </View>
            </View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.lg,
    paddingHorizontal: spacing.md,
    position: 'relative',
  },
  swap: {
    position: 'absolute',
    top: spacing.sm,
    right: spacing.sm,
    width: 28,
    height: 28,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
  row: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  column: {
    flex: 1,
    gap: 6,
    minWidth: 0,
  },
  valueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    flexWrap: 'wrap',
  },
  track: {
    height: TRACK_HEIGHT,
    borderRadius: radius.full,
    overflow: 'hidden',
    marginTop: 4,
  },
  fill: {
    height: '100%',
    borderRadius: radius.full,
    alignSelf: 'flex-start',
    transformOrigin: 'left center',
  },
});
