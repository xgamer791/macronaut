import { useRouter } from 'expo-router';
import React from 'react';
import { Linking, View } from 'react-native';
import { AppText, Card, LegalSection, ListRow, Screen, ScreenHeader } from '@/ui/components';
import { spacing } from '@/ui/theme/tokens';
import { useAuth } from '@/state/AuthProvider';
import { CONTACT_EMAIL, LEGAL_LAST_UPDATED } from '@/utils/legal';

export default function PrivacyScreen() {
  const router = useRouter();
  // This page has to describe the build in the reader's hands. The public demo
  // has no account server and genuinely never uploads anything; a build with a
  // Supabase project stores the diary in the account. Saying the wrong one is
  // not a copy problem, it is a false privacy promise.
  const { accountsEnabled } = useAuth();

  return (
    <Screen>
      <ScreenHeader title="Privacy Policy" />

      <Card>
        <View style={{ gap: spacing.md }}>
          <AppText variant="body" tone="secondary">
            {accountsEnabled
              ? 'Macronaut is a calorie and macro tracker. Your food diary is stored in your own account so it follows you between devices, and nobody else can read it. There are no ads, no analytics and no tracking of any kind.'
              : 'Macronaut is a calorie and macro tracker that keeps your food diary on your own device. There are no ads, no analytics and no tracking of any kind.'}
          </AppText>
          <AppText variant="micro" tone="muted">
            Last updated {LEGAL_LAST_UPDATED}
          </AppText>
        </View>
      </Card>

      {accountsEnabled ? (
        <>
          <LegalSection
            title="Where your diary is kept"
            paragraphs={[
              'Everything you log is stored in your account: diary entries, custom foods, saved meals and recipes, goals, weight and activity history, and your settings. A copy is kept on each device you use so the app keeps working offline.',
              'Your account is hosted on Supabase, our database and authentication provider, on your behalf. Every table is protected by row-level security keyed to your user id, which means a request carrying anyone else\u2019s sign-in cannot read your rows. We do not read your diary, and it is never sold, shared or used to build a profile of you.',
              'Deleting a diary entry deletes it from your account and from your other devices, not just the one you are holding.',
            ]}
          />

          <LegalSection
            title="Your account"
            paragraphs={[
              'Sign-in is handled by Supabase. It stores your email address and, when you use Google, the name and profile information Google returns. We use this only to identify you and to keep your data separate from everyone else\u2019s.',
              'Your sign-in session is stored on the device \u2014 in the system keychain on iOS and Android, and in browser storage on the web.',
              'Signing out leaves the cached copy on that device so it is ready next time. Anyone else signing in on the same device gets their own separate database and cannot see your food log.',
            ]}
          />
        </>
      ) : (
        <>
          <LegalSection
            title="What stays on your device"
            paragraphs={[
              'Everything you log lives in a database on the device you logged it on: diary entries, custom foods, saved meals and recipes, goals, weight and activity history, and your settings.',
              'None of it is uploaded to us. We operate no server that holds a copy of your diary, so there is nothing on our side to read, share or lose.',
            ]}
          />

          <LegalSection
            title="If you create an account"
            paragraphs={[
              'This build has no account server, so there is nothing to sign in to and nothing leaves the device.',
            ]}
          />
        </>
      )}

      <LegalSection
        title="Searching for foods"
        paragraphs={[
          'When you search for a food or scan a barcode, the text you typed or the barcode number is sent to the food databases below so they can return matches. Nothing identifying you is attached to those requests \u2014 no account, no email, no device identifier.',
          'Results are cached on your device so repeat lookups work offline.',
        ]}
      >
        <View>
          <ListRow
            title="USDA FoodData Central"
            subtitle="Generic and branded foods"
            onPress={() => Linking.openURL('https://fdc.nal.usda.gov/')}
          />
          <ListRow
            title="Open Food Facts"
            subtitle="Packaged products and barcodes"
            onPress={() => Linking.openURL('https://world.openfoodfacts.org/')}
          />
        </View>
      </LegalSection>

      <LegalSection
        title="Camera and microphone"
        paragraphs={[
          'The camera is used to scan barcodes and, if you choose, to photograph a meal for AI food logging. The microphone is used only when you start the voice assistant.',
          'Barcode scanning happens entirely on the device. Photos and voice recordings are never uploaded unless you use the AI features described below.',
        ]}
      />

      <LegalSection
        title="AI features and your own API key"
        paragraphs={[
          'The AI food-photo and voice assistant features work only if you add your own xAI (Grok) API key in Settings. They are off until you do.',
          'When you use them, the photo, audio or question you supply is sent directly from your device to xAI using your key, and is handled under xAI\u2019s own privacy terms.',
          accountsEnabled
            ? 'Your key is stored on the device you entered it on and is never sent to us. It is deliberately left out of the data that syncs to your account, which is why you have to enter it again on each device.'
            : 'Your key is stored locally on your device and is never sent to us.',
        ]}
      />

      <LegalSection
        title="What we never do"
        paragraphs={[
          'We do not run analytics, telemetry, crash reporting or advertising. We do not sell, rent or share personal information. We load no third-party trackers or scripts, and we do not build a profile of you.',
        ]}
      />

      <LegalSection
        title="Deleting your data"
        paragraphs={
          accountsEnabled
            ? [
                'Open Settings, then Data, then Delete all data. Because your diary is stored in your account, this erases it everywhere \u2014 this device, your other devices, and our database. It is immediate and cannot be undone.',
                'Signing out is not deletion: it deliberately leaves your data in your account so it is there next time you sign in. To delete the account itself, along with the email address held by our authentication provider, email us and we will remove it.',
              ]
            : [
                'To erase everything held on a device, open Settings, then Data, then Delete all data. This is immediate and cannot be undone.',
                'Signing out deliberately leaves that account\u2019s data on the device so it is still there next time you sign in.',
              ]
        }
      />

      <LegalSection
        title="Children"
        paragraphs={[
          'Macronaut is not directed at children under 13, and we do not knowingly collect information from them. If you believe a child has created an account, contact us and we will delete it.',
        ]}
      />

      <LegalSection
        title="Changes to this policy"
        paragraphs={[
          'If this policy changes, the date at the top of this page changes with it. Material changes will be noted in the app.',
        ]}
      />

      <LegalSection
        title="Contact"
        paragraphs={['Questions about privacy, or a request to delete an account, can go to:']}
      >
        <View>
          <ListRow
            title={CONTACT_EMAIL}
            onPress={() => Linking.openURL(`mailto:${CONTACT_EMAIL}`)}
          />
          <ListRow
            title="Terms of Service"
            subtitle="The terms you agree to by using Macronaut"
            onPress={() => router.push('/terms')}
          />
        </View>
      </LegalSection>
    </Screen>
  );
}
