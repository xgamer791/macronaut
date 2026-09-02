import { useRouter } from 'expo-router';
import React from 'react';
import { Linking, View } from 'react-native';
import { AppText, Card, LegalSection, ListRow, Screen, ScreenHeader } from '@/ui/components';
import { spacing } from '@/ui/theme/tokens';
import { useAuth } from '@/state/AuthProvider';
import { CONTACT_EMAIL, LEGAL_LAST_UPDATED } from '@/utils/legal';

export default function TermsScreen() {
  const router = useRouter();
  // Storage terms differ by build: the demo keeps everything on the device,
  // a configured build keeps it in the user's account.
  const { accountsEnabled } = useAuth();

  return (
    <Screen>
      <ScreenHeader title="Terms of Service" />

      <Card>
        <View style={{ gap: spacing.md }}>
          <AppText variant="body" tone="secondary">
            These terms cover your use of Macronaut. By using the app you agree to them.
          </AppText>
          <AppText variant="micro" tone="muted">
            Last updated {LEGAL_LAST_UPDATED}
          </AppText>
        </View>
      </Card>

      <LegalSection
        title="What Macronaut is"
        paragraphs={[
          accountsEnabled
            ? 'Macronaut is a personal calorie and macro tracker. It is free to use and carries no ads. Your food diary is stored in your account so it is available on every device you sign in on.'
            : 'Macronaut is a personal calorie and macro tracker. It is free to use, carries no ads, and stores your food diary on your own device.',
          accountsEnabled
            ? 'An account identifies you and keeps your data separate from everyone else\u2019s, including other people using the same device.'
            : 'An account is optional and exists only to identify you and keep separate accounts\u2019 data apart on a shared device.',
        ]}
      />

      <LegalSection
        title="Not medical advice"
        paragraphs={[
          'Macronaut is a general-purpose tracking and information tool. It is not a medical device and does not provide medical, nutritional or clinical advice, diagnosis or treatment.',
          'Calorie and macro targets the app suggests are estimates produced by standard public formulas from the details you enter. They are a starting point, not a prescription. Talk to a qualified professional before making decisions about your diet, especially if you are pregnant, under 18, or managing a medical condition or eating disorder.',
        ]}
      />

      <LegalSection
        title="Accuracy of food data"
        paragraphs={[
          'Nutrition figures come from public databases, from manufacturers, and from foods you enter yourself. They are frequently incomplete or wrong, and portion sizes vary between products and preparations.',
          'We do not warrant that any figure in the app is accurate. Check the label where it matters.',
        ]}
      />

      <LegalSection
        title="Your account and your responsibilities"
        paragraphs={[
          'You are responsible for keeping access to your email account and sign-in method secure, and for the content you enter into the app.',
          'Do not use Macronaut to break the law, to interfere with the service or the food-data providers it relies on, or to attempt to reach another person\u2019s data.',
        ]}
      />

      <LegalSection
        title="Your own API keys"
        paragraphs={[
          'The optional AI photo and voice features require your own xAI (Grok) API key. If you supply one, any usage, cost and rate limit on that key is yours, and your use of that service is governed by xAI\u2019s terms rather than these.',
        ]}
      />

      <LegalSection
        title="Your data, and backups"
        paragraphs={
          accountsEnabled
            ? [
                'Your diary is stored in your account, so losing a device does not lose your data \u2014 sign in again elsewhere and it is there.',
                'We are not a backup service, though. Deleting your data deletes it everywhere and cannot be undone, and we do not guarantee we can recover anything for you. Keeping your own copy of anything you cannot afford to lose is up to you.',
              ]
            : [
                'Because your diary lives on your device, we hold no copy of it and cannot restore it for you. If you delete the app, clear your browser storage, use Delete all data, or lose the device, that data is gone.',
                'Keeping a backup, where your platform offers one, is up to you.',
              ]
        }
      />

      <LegalSection
        title="Availability"
        paragraphs={[
          'Macronaut is provided as-is and as-available, without warranties of any kind, express or implied. Features may change or be withdrawn, and the service may be interrupted or discontinued at any time.',
          'Food search depends on third-party databases we do not control, and sign-in depends on our authentication provider. Neither is guaranteed to be available.',
        ]}
      />

      <LegalSection
        title="Limitation of liability"
        paragraphs={[
          'To the fullest extent permitted by law, we are not liable for any indirect, incidental or consequential loss, or for lost data, arising from your use of Macronaut. Nothing in these terms limits liability that cannot be limited by law.',
        ]}
      />

      <LegalSection
        title="Ending your use"
        paragraphs={[
          'You can stop using Macronaut at any time and delete your data from Settings. We may suspend access where it is necessary to protect the service or comply with the law.',
        ]}
      />

      <LegalSection
        title="Changes to these terms"
        paragraphs={[
          'If these terms change, the date at the top of this page changes with them. Continuing to use the app after a change means you accept the updated terms.',
        ]}
      />

      <LegalSection title="Contact" paragraphs={['Questions about these terms can go to:']}>
        <View>
          <ListRow
            title={CONTACT_EMAIL}
            onPress={() => Linking.openURL(`mailto:${CONTACT_EMAIL}`)}
          />
          <ListRow
            title="Privacy Policy"
            subtitle="How your data is handled"
            onPress={() => router.push('/privacy')}
          />
        </View>
      </LegalSection>
    </Screen>
  );
}
