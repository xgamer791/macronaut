import React from 'react';
import { View } from 'react-native';
import { spacing } from '@/ui/theme/tokens';
import { AppText } from './AppText';
import { Button } from './Button';

export interface EmptyStateProps {
  title: string;
  body?: string;
  actionTitle?: string;
  onAction?: () => void;
}

export function EmptyState({ title, body, actionTitle, onAction }: EmptyStateProps) {
  return (
    <View style={{ alignItems: 'center', gap: spacing.sm, padding: spacing.xl }}>
      <AppText variant="heading" weight="600" align="center">
        {title}
      </AppText>
      {body ? (
        <AppText variant="caption" tone="secondary" align="center">
          {body}
        </AppText>
      ) : null}
      {actionTitle && onAction ? (
        <Button title={actionTitle} onPress={onAction} variant="secondary" compact />
      ) : null}
    </View>
  );
}
