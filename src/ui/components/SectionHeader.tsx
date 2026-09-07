import React from 'react';
import { View } from 'react-native';
import { spacing } from '@/ui/theme/tokens';
import { AppText } from './AppText';

export interface SectionHeaderProps {
  title: string;
  right?: React.ReactNode;
  /** Drop the default top inset when a parent already owns the section gap. */
  flush?: boolean;
}

export function SectionHeader({ title, right, flush = false }: SectionHeaderProps) {
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginTop: flush ? 0 : spacing.sm,
      }}
    >
      <AppText variant="heading" weight="600" display accessibilityRole="header">
        {title}
      </AppText>
      {right}
    </View>
  );
}
