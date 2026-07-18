import React, { useMemo, useState } from 'react';
import { LayoutChangeEvent, Pressable, View } from 'react-native';
import Svg, { Circle, Line, Polyline } from 'react-native-svg';
import { useTheme } from '@/ui/theme/ThemeProvider';
import { radius, spacing } from '@/ui/theme/tokens';
import { AppText } from './AppText';

export interface LineDatum {
  key: string;
  label: string;
  value: number;
  goal?: number;
  detail?: string;
  over?: boolean;
}

export interface LineChartProps {
  data: LineDatum[];
  height?: number;
  accessibilityLabel: string;
  /** Show every nth x label. */
  labelEvery?: number;
}

/** Line chart with y-axis ticks, dashed goal, accent dots, over-target coloring. */
export function LineChart({
  data,
  height = 168,
  accessibilityLabel,
  labelEvery,
}: LineChartProps) {
  const { colors } = useTheme();
  const [width, setWidth] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);

  const padL = 36;
  const padR = 8;
  const padT = 12;
  const padB = 4;
  const chartH = height - padT - padB;

  const onLayout = (e: LayoutChangeEvent) => {
    setWidth(e.nativeEvent.layout.width);
  };

  const { maxVal, ticks, points, goalY, every } = useMemo(() => {
    const goals = data.map((d) => d.goal ?? 0);
    const maxRaw = Math.max(...data.map((d) => d.value), ...goals, 1);
    // Nice ceiling in steps of ~700 like the mockup.
    const step = maxRaw > 2000 ? 700 : maxRaw > 800 ? 400 : 200;
    const maxVal = Math.ceil(maxRaw / step) * step || step;
    const tickCount = 5;
    const ticks = Array.from({ length: tickCount }, (_, i) =>
      Math.round((maxVal * (tickCount - 1 - i)) / (tickCount - 1)),
    );
    const chartW = Math.max(width - padL - padR, 1);
    const n = Math.max(data.length - 1, 1);
    const points = data.map((d, i) => {
      const x = padL + (i / n) * chartW;
      const y = padT + (1 - d.value / maxVal) * chartH;
      return { ...d, x, y };
    });
    const constantGoal =
      goals[0] > 0 && goals.every((g) => g === goals[0] || g === 0) ? goals[0] : null;
    const goalY =
      constantGoal && constantGoal > 0
        ? padT + (1 - constantGoal / maxVal) * chartH
        : null;
    const every = labelEvery ?? Math.max(1, Math.ceil(data.length / 8));
    return { maxVal, ticks, points, goalY, every };
  }, [data, width, chartH, labelEvery]);

  if (data.length === 0) {
    return (
      <View style={{ padding: spacing.lg, alignItems: 'center' }}>
        <AppText variant="caption" tone="muted">
          Nothing logged in this period yet.
        </AppText>
      </View>
    );
  }

  const poly = points.map((p) => `${p.x},${p.y}`).join(' ');
  const sel = points.find((p) => p.key === selected) ?? null;

  return (
    <View accessible accessibilityLabel={accessibilityLabel} style={{ gap: spacing.sm }}>
      <View style={{ height }} onLayout={onLayout}>
        {width > 0 ? (
          <Svg width={width} height={height}>
            {ticks.map((t) => {
              const y = padT + (1 - t / maxVal) * chartH;
              return (
                <Line
                  key={`g-${t}`}
                  x1={padL}
                  y1={y}
                  x2={width - padR}
                  y2={y}
                  stroke={colors.border}
                  strokeWidth={1}
                />
              );
            })}
            {goalY !== null ? (
              <Line
                x1={padL}
                y1={goalY}
                x2={width - padR}
                y2={goalY}
                stroke={colors.textMuted}
                strokeWidth={1.5}
                strokeDasharray="6 4"
              />
            ) : null}
            <Polyline
              points={poly}
              fill="none"
              stroke={colors.accent}
              strokeWidth={2.5}
              strokeLinejoin="round"
              strokeLinecap="round"
            />
            {points.map((p) => {
              const over = p.over ?? (p.goal !== undefined && p.goal > 0 && p.value > p.goal);
              const isSel = selected === p.key;
              return (
                <Circle
                  key={p.key}
                  cx={p.x}
                  cy={p.y}
                  r={isSel ? 6 : 4.5}
                  fill={over ? colors.danger : colors.accent}
                  stroke={colors.surface}
                  strokeWidth={2}
                />
              );
            })}
          </Svg>
        ) : null}

        {/* Y labels */}
        <View
          pointerEvents="none"
          style={{ position: 'absolute', left: 0, top: padT, bottom: padB, width: padL - 4 }}
        >
          {ticks.map((t) => (
            <AppText
              key={t}
              variant="micro"
              tone="muted"
              style={{
                position: 'absolute',
                top: (1 - t / maxVal) * chartH - 7,
                right: 0,
                fontSize: 10,
              }}
            >
              {t >= 1000 ? `${(t / 1000).toFixed(t % 1000 === 0 ? 0 : 1)}k` : String(t)}
            </AppText>
          ))}
        </View>

        {/* Tap targets */}
        {width > 0
          ? points.map((p, i) => {
              const chartW = width - padL - padR;
              const n = Math.max(data.length, 1);
              const slot = chartW / n;
              return (
                <Pressable
                  key={p.key}
                  accessibilityRole="button"
                  accessibilityLabel={`${p.label}: ${Math.round(p.value)} kcal`}
                  onPress={() => setSelected(selected === p.key ? null : p.key)}
                  style={{
                    position: 'absolute',
                    left: padL + (i + 0.5) * (chartW / Math.max(data.length - 1, 1)) - slot / 2,
                    top: 0,
                    width: Math.max(slot, 28),
                    height,
                  }}
                />
              );
            })
          : null}
      </View>

      <View style={{ flexDirection: 'row', paddingLeft: padL, paddingRight: padR }}>
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
            {sel.label}: {Math.round(sel.value).toLocaleString()} kcal
            {sel.goal ? ` · goal ${Math.round(sel.goal).toLocaleString()}` : ''}
          </AppText>
          {sel.detail ? (
            <AppText variant="micro" tone="secondary">
              {sel.detail}
            </AppText>
          ) : null}
        </View>
      ) : (
        <AppText variant="micro" tone="muted">
          Tap a point for details.{goalY !== null ? ' Dashed line = goal.' : ''}
        </AppText>
      )}
    </View>
  );
}
