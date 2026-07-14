import React, { useState } from 'react';
import { Pressable, View } from 'react-native';
import Svg, { Line, Rect } from 'react-native-svg';
import { useTheme } from '@/ui/theme/ThemeProvider';
import { radius, spacing } from '@/ui/theme/tokens';
import { AppText } from './AppText';

export interface BarDatum {
  key: string;
  label: string;
  value: number;
  /** Optional per-bar goal (drawn as a dashed line across the chart when
   * constant, and used for over-target coloring). */
  goal?: number;
  /** Detail line shown when the bar is selected. */
  detail?: string;
}

export interface BarChartProps {
  data: BarDatum[];
  height?: number;
  unit?: string;
  accessibilityLabel: string;
  /** Show every nth x label to avoid collisions on dense ranges. */
  labelEvery?: number;
}

/** Tappable SVG bar chart with goal line, over-target coloring, selection
 * tooltip and honest axes (baseline at zero). */
export function BarChart({
  data,
  height = 160,
  unit = '',
  accessibilityLabel,
  labelEvery,
}: BarChartProps) {
  const { colors } = useTheme();
  const [selected, setSelected] = useState<string | null>(null);

  if (data.length === 0) {
    return (
      <View style={{ padding: spacing.lg, alignItems: 'center' }}>
        <AppText variant="caption" tone="muted">
          Nothing logged in this period yet.
        </AppText>
      </View>
    );
  }

  const goals = data.map((d) => d.goal ?? 0);
  const maxVal = Math.max(...data.map((d) => d.value), ...goals, 1);
  const constantGoal =
    goals[0] > 0 && goals.every((g) => g === goals[0]) ? goals[0] : null;
  const every = labelEvery ?? Math.max(1, Math.ceil(data.length / 8));
  const sel = data.find((d) => d.key === selected) ?? null;

  return (
    <View accessible accessibilityLabel={accessibilityLabel} style={{ gap: spacing.sm }}>
      <View style={{ flexDirection: 'row', height, alignItems: 'flex-end', gap: 2 }}>
        {constantGoal !== null ? (
          <View
            pointerEvents="none"
            style={{
              position: 'absolute',
              left: 0,
              right: 0,
              bottom: (constantGoal / maxVal) * height,
              zIndex: 1,
            }}
          >
            <Svg width="100%" height={2}>
              <Line
                x1="0"
                y1="1"
                x2="100%"
                y2="1"
                stroke={colors.textMuted}
                strokeWidth={1.5}
                strokeDasharray="6 4"
              />
            </Svg>
          </View>
        ) : null}
        {data.map((d) => {
          const h = Math.max((d.value / maxVal) * height, d.value > 0 ? 3 : 1);
          const over = d.goal !== undefined && d.goal > 0 && d.value > d.goal;
          const isSel = selected === d.key;
          return (
            <Pressable
              key={d.key}
              accessibilityRole="button"
              accessibilityLabel={`${d.label}: ${Math.round(d.value)}${unit}${d.goal ? ` of ${Math.round(d.goal)}${unit} goal` : ''}${over ? ', over target' : ''}`}
              onPress={() => setSelected(isSel ? null : d.key)}
              style={{ flex: 1, height: '100%', justifyContent: 'flex-end' }}
            >
              <Svg width="100%" height={h}>
                <Rect
                  x="0"
                  y="0"
                  width="100%"
                  height={h}
                  rx={3}
                  fill={
                    over
                      ? colors.danger
                      : isSel
                        ? colors.textPrimary
                        : d.value > 0
                          ? colors.accent
                          : colors.track
                  }
                  opacity={selected && !isSel ? 0.45 : 1}
                />
              </Svg>
            </Pressable>
          );
        })}
      </View>
      <View style={{ flexDirection: 'row', gap: 2 }}>
        {data.map((d, i) => (
          <View key={d.key} style={{ flex: 1, alignItems: 'center' }}>
            {i % every === 0 ? (
              <AppText variant="micro" tone="muted">
                {d.label}
              </AppText>
            ) : null}
          </View>
        ))}
      </View>
      {sel ? (
        <View
          accessibilityLiveRegion="polite"
          style={{
            backgroundColor: colors.track,
            borderRadius: radius.sm,
            padding: spacing.md,
            gap: 2,
          }}
        >
          <AppText variant="caption" weight="600">
            {sel.label}: {Math.round(sel.value).toLocaleString()}
            {unit}
            {sel.goal ? ` / ${Math.round(sel.goal).toLocaleString()}${unit} goal` : ''}
          </AppText>
          {sel.detail ? (
            <AppText variant="micro" tone="secondary">
              {sel.detail}
            </AppText>
          ) : null}
        </View>
      ) : (
        <AppText variant="micro" tone="muted">
          Tap a bar for details.{constantGoal ? ' Dashed line = goal.' : ''}
        </AppText>
      )}
    </View>
  );
}
