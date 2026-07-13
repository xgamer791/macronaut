import React from 'react';
import { AppText, Screen } from '@/ui/components';

export default function SettingsScreen() {
  return (
    <Screen tabBarSpace>
      <AppText variant="title" weight="600" display>
        Settings
      </AppText>
    </Screen>
  );
}
