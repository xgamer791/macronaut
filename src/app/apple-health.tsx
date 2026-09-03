import React from 'react';
import { View } from 'react-native';
import { AppText, Card, LegalSection, Screen, ScreenHeader } from '@/ui/components';
import { spacing } from '@/ui/theme/tokens';
import {
  APPLE_HEALTH_DONE,
  APPLE_HEALTH_STATUS_UPDATED,
  APPLE_HEALTH_TODO,
} from '@/utils/appleHealthStatus';

/** Pause note so we can pick this up after the rest of the build. HealthKit
 * is iOS-only — this page is documentation, not a working integration. */
export default function AppleHealthStatusScreen() {
  return (
    <Screen>
      <ScreenHeader title="Apple Health" />

      <Card>
        <View style={{ gap: spacing.md }}>
          <AppText variant="body" tone="secondary">
            Apple Health and Apple Watch are paused. The live site is a website, and
            HealthKit only exists inside a native iOS app, so this cannot finish on a
            GitHub Pages deploy. Resume once a development build is on a real iPhone.
          </AppText>
          <AppText variant="micro" tone="muted">
            Last updated {APPLE_HEALTH_STATUS_UPDATED}
          </AppText>
        </View>
      </Card>

      <LegalSection title="Done so far" paragraphs={[...APPLE_HEALTH_DONE]} />
      <LegalSection title="Still needed" paragraphs={[...APPLE_HEALTH_TODO]} />
    </Screen>
  );
}
