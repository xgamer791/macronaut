import React from 'react';
import { View } from 'react-native';
import { spacing } from '@/ui/theme/tokens';
import { AppText } from './AppText';

export interface SectionHeaderProps {
  title: string;
  right?: React.ReactNode;
}

export function SectionHeader({ title, right }: SectionHeaderProps) {
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginTop: spacing.sm,
      }}
    >
      <AppText variant="heading" weight="600" display accessibilityRole="header">
        {title}
      </AppText>
      {right}
    </View>
  );
}
