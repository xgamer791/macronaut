import React from 'react';
import { View } from 'react-native';
import Animated, { useAnimatedProps } from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';
import { useBarEntranceProgress } from '@/ui/motion/barEntrance';
import { useTheme } from '@/ui/theme/ThemeProvider';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

export interface ProgressRingProps {
  /** 0..1 — values over 1 render a full ring in the over color. */
  progress: number;
  size?: number;
  strokeWidth?: number;
  color?: string;
  /** Ring turns this color when progress exceeds 1 (over target). */
  overColor?: string;
  children?: React.ReactNode;
  accessibilityLabel?: string;
}

export function ProgressRing({
  progress,
  size = 120,
  strokeWidth = 10,
  color,
  overColor,
  children,
  accessibilityLabel,
}: ProgressRingProps) {
  const { colors } = useTheme();
  const entrance = useBarEntranceProgress();
  const over = progress > 1;
  const clamped = Math.min(Math.max(progress, 0), 1);
  const targetFill = over ? 1 : clamped;
  const r = (size - strokeWidth) / 2;
  const c = 2 * Math.PI * r;
  const stroke = over ? (overColor ?? colors.warning) : (color ?? colors.accent);

  const animatedProps = useAnimatedProps(() => ({
    strokeDashoffset: c * (1 - targetFill * entrance.value),
  }));

  return (
    <View
      style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={accessibilityLabel}
      accessibilityValue={{ now: Math.round(progress * 100), min: 0, max: 100 }}
    >
      <Svg width={size} height={size} style={{ position: 'absolute' }}>
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={colors.track}
          strokeWidth={strokeWidth}
          fill="none"
        />
        <AnimatedCircle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={stroke}
          strokeWidth={strokeWidth}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={`${c}`}
          animatedProps={animatedProps}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </Svg>
      {children}
    </View>
  );
}
