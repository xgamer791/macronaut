import React from 'react';
import { View } from 'react-native';
import { spacing } from '@/ui/theme/tokens';
import { AppText } from './AppText';
import { Button } from './Button';

export interface ErrorStateProps {
  title?: string;
  message: string;
  retryTitle?: string;
  onRetry?: () => void;
}

export function ErrorState({
  title = "Something didn't work",
  message,
  retryTitle = 'Try again',
  onRetry,
}: ErrorStateProps) {
  return (
    <View style={{ alignItems: 'center', gap: spacing.sm, padding: spacing.xl }}>
      <AppText variant="heading" weight="600" align="center">
        {title}
      </AppText>
      <AppText variant="caption" tone="secondary" align="center">
        {message}
      </AppText>
      {onRetry ? <Button title={retryTitle} onPress={onRetry} variant="secondary" compact /> : null}
    </View>
  );
}
