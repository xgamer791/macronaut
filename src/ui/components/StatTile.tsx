import React from 'react';
import { View } from 'react-native';
import { useTheme } from '@/ui/theme/ThemeProvider';
import { radius, spacing } from '@/ui/theme/tokens';
import { AppText } from './AppText';

export interface StatTileProps {
  label: string;
  value: string;
  detail?: string;
}

export function StatTile({ label, value, detail }: StatTileProps) {
  const { colors } = useTheme();
  return (
    <View
      style={{
        flex: 1,
        backgroundColor: colors.surface,
        borderColor: colors.border,
        borderWidth: 1,
        borderRadius: radius.md,
        padding: spacing.md,
        gap: 2,
      }}
      accessible
      accessibilityLabel={`${label}: ${value}${detail ? `, ${detail}` : ''}`}
    >
      <AppText variant="micro" tone="muted">
        {label}
      </AppText>
      <AppText variant="heading" weight="600" display>
        {value}
      </AppText>
      {detail ? (
        <AppText variant="micro" tone="secondary">
          {detail}
        </AppText>
      ) : null}
    </View>
  );
}
