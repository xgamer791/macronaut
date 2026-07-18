import React from 'react';
import { Pressable, StyleProp, ViewStyle } from 'react-native';
import { useTheme } from '@/ui/theme/ThemeProvider';
import { radius, spacing } from '@/ui/theme/tokens';
import { AppText } from './AppText';

export interface ChipProps {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
}

export function Chip({ label, selected = false, onPress, style }: ChipProps) {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected }}
      onPress={onPress}
      style={({ pressed }) => [
        {
          paddingHorizontal: spacing.md,
          paddingVertical: 7,
          borderRadius: radius.full,
          borderWidth: 1,
          minHeight: 32,
          justifyContent: 'center',
          borderColor: selected ? colors.textPrimary : colors.border,
          backgroundColor: selected ? colors.textPrimary : colors.surface,
          opacity: pressed ? 0.8 : 1,
        },
        style,
      ]}
    >
      <AppText
        variant="caption"
        weight={selected ? '600' : '400'}
        align="center"
        numberOfLines={1}
        style={{ color: selected ? colors.surface : colors.textSecondary }}
      >
        {label}
      </AppText>
    </Pressable>
  );
}
