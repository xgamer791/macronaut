import React from 'react';
import { StyleProp, View, ViewProps, ViewStyle } from 'react-native';
import { useTheme } from '@/ui/theme/ThemeProvider';
import { radius, spacing } from '@/ui/theme/tokens';
import { LiquidGlassCard } from './LiquidGlassCard';

export interface CardProps extends ViewProps {
  padded?: boolean;
  style?: StyleProp<ViewStyle>;
}

/** Surface card — liquid glass in dark mode, solid surface in light. */
export function Card({ padded = true, style, children, ...rest }: CardProps) {
  const { colors, resolved } = useTheme();

  if (resolved === 'dark') {
    return (
      <View {...rest} collapsable={false}>
        <LiquidGlassCard padded={padded} contentStyle={style}>
          {children}
        </LiquidGlassCard>
      </View>
    );
  }

  return (
    <View
      {...rest}
      style={[
        {
          backgroundColor: colors.surface,
          borderColor: colors.border,
          borderWidth: 1,
          borderRadius: radius.md,
        },
        padded && { padding: spacing.lg },
        style,
      ]}
    >
      {children}
    </View>
  );
}
