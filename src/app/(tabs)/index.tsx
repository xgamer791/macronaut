import React from 'react';
import { AppText, Screen } from '@/ui/components';

export default function TodayScreen() {
  return (
    <Screen tabBarSpace>
      <AppText variant="title" weight="600" display>
        Today
      </AppText>
      <AppText variant="caption" tone="secondary">
        Dashboard wiring lands with the data layer.
      </AppText>
    </Screen>
  );
}
