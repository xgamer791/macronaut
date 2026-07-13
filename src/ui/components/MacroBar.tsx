import React from 'react';
import { View } from 'react-native';
import { useTheme } from '@/ui/theme/ThemeProvider';
import { radius, spacing } from '@/ui/theme/tokens';
import { roundForDisplay } from '@/domain/nutrition';
import { AppText } from './AppText';

export interface MacroBarProps {
  label: string;
  consumed: number;
  target?: number;
  color: string;
  unit?: string;
}

/** Labelled macro progress bar — label + numbers carry the meaning, color is
 * reinforcement only (non-color-only status). Turns the warning color when
 * over target. */
export function MacroBar({ label, consumed, target, color, unit = 'g' }: MacroBarProps) {
  const { colors } = useTheme();
  const over = target !== undefined && target > 0 && consumed > target;
  const pct = target && target > 0 ? Math.min(consumed / target, 1) : 0;
  const shown = roundForDisplay(consumed);

  return (
    <View style={{ gap: spacing.xs }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <View style={{ width: 8, height: 8, borderRadius: 2, backgroundColor: color }} />
          <AppText variant="caption" tone="secondary">
            {label}
          </AppText>
        </View>
        <AppText variant="caption" tone={over ? 'danger' : 'primary'} weight="600">
          {shown}
          {target !== undefined ? ` / ${roundForDisplay(target)}${unit}` : unit}
          {over ? ' · over' : ''}
        </AppText>
      </View>
      <View
        style={{
          height: 6,
          borderRadius: radius.full,
          backgroundColor: colors.track,
          overflow: 'hidden',
        }}
        accessible
        accessibilityRole="progressbar"
        accessibilityLabel={`${label}: ${shown}${unit}${target !== undefined ? ` of ${roundForDisplay(target)}${unit}` : ''}${over ? ', over target' : ''}`}
      >
        <View
          style={{
            width: `${pct * 100}%`,
            height: '100%',
            borderRadius: radius.full,
            backgroundColor: over ? colors.danger : color,
          }}
        />
      </View>
    </View>
  );
}
