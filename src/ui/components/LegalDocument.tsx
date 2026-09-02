import { Link, useRouter } from 'expo-router';
import React from 'react';
import { Pressable, StyleSheet } from 'react-native';
import { useAuth } from '@/state/AuthProvider';
import { spacing } from '@/ui/theme/tokens';
import { AppText } from './AppText';
import { Card } from './Card';
import { Screen } from './Screen';
import { ScreenHeader } from './ScreenHeader';

export function LegalDocument({
  title,
  effectiveDate,
  sections,
}: {
  title: string;
  effectiveDate: string;
  sections: { heading: string; body: string }[];
}) {
  const router = useRouter();
  const { signedIn } = useAuth();
  const homeHref = signedIn ? '/' : '/login';

  return (
    <Screen>
      <ScreenHeader
        title={title}
        onBack={() => {
          if (router.canGoBack()) router.back();
          else router.replace(homeHref);
        }}
      />
      <AppText variant="caption" tone="muted">
        Effective {effectiveDate}
      </AppText>
      {sections.map((section) => (
        <Card key={section.heading} style={styles.section}>
          <AppText variant="heading" weight="600" display accessibilityRole="header">
            {section.heading}
          </AppText>
          <AppText variant="body" tone="secondary">
            {section.body}
          </AppText>
        </Card>
      ))}
      <Link href={homeHref} asChild>
        <Pressable accessibilityRole="link" accessibilityLabel="Back to Macronaut">
          <AppText variant="body" weight="600" style={styles.homeLink}>
            Back to Macronaut
          </AppText>
        </Pressable>
      </Link>
    </Screen>
  );
}

const styles = StyleSheet.create({
  section: {
    gap: spacing.sm,
  },
  homeLink: {
    textDecorationLine: 'underline',
    paddingVertical: spacing.sm,
  },
});
