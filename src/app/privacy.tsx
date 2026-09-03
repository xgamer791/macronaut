import { useRouter } from 'expo-router';
import React from 'react';
import { Linking, View } from 'react-native';
import { AppText, Card, LegalSection, ListRow, Screen, ScreenHeader } from '@/ui/components';
import { spacing } from '@/ui/theme/tokens';
import { CONTACT_EMAIL, LEGAL_LAST_UPDATED } from '@/utils/legal';

export default function PrivacyScreen() {
  const router = useRouter();

  return (
    <Screen>
      <ScreenHeader title="Privacy Policy" />

      <Card>
        <View style={{ gap: spacing.md }}>
          <AppText variant="body" tone="secondary">
            Macronaut is a calorie and macro tracker. Your food diary is stored in your own
            account, which only you can open. There are no ads, no analytics and no tracking of
            any kind.
          </AppText>
          <AppText variant="micro" tone="muted">
            Last updated {LEGAL_LAST_UPDATED}
          </AppText>
        </View>
      </Card>

      <LegalSection
        title="Your account and what it holds"
        paragraphs={[
          'Macronaut requires an account. Everything you log is stored in it: diary entries, custom foods, saved meals and recipes, goals, activity history, day notes, and your settings.',
          'That data is held for us by Convex, the hosting provider that runs our backend, in the United States. It is stored so that you can sign in from any device and see the same diary. Each account can read only its own rows; we enforce that on the server, not in the app.',
          'We use your data only to show it back to you. We do not read it, analyse it, sell it, or share it with anyone.',
        ]}
      />

      <LegalSection
        title="Signing in"
        paragraphs={[
          'You sign in with Apple, with Google, or with a six-digit code sent to your email address. We store your email address and, when you use Google, the name and profile picture Google returns, so we can show who is signed in and greet you by name.',
          'Sign in with Apple gives us your email address and, only the first time you use it, your name. If you choose Apple\u2019s Hide My Email option we receive a relay address instead of your real one, and that is the address we store. Apple does not give us a profile picture.',
          'Sign-in codes are delivered by Resend, an email delivery service, which receives your email address for that purpose. Apple and Google sign-in follow their own privacy terms.',
          'Your sign-in session is stored on the device \u2014 in the system keychain on iOS and Android, and in browser storage on the web. Signing out removes it from that device only.',
        ]}
      />

      <LegalSection
        title="Searching for foods"
        paragraphs={[
          'When you search for a food or scan a barcode, the text you typed or the barcode number is sent to the food databases below so they can return matches. Nothing identifying you is attached to those requests \u2014 no account, no email, no device identifier.',
          'Results are cached in your account so repeat lookups are fast.',
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
        title="AI features"
        paragraphs={[
          'AI food scan is a Pro feature. When it is available on your account, the photo is sent from our server to xAI to estimate the food and nutrition. We do not give you that API key, and it never lives on your device.',
          'The voice assistant works only if you add your own xAI (Grok) API key in Settings. It is off until you do. The audio or question you supply is sent from your device to xAI using your key, and is handled under xAI\u2019s own privacy terms. Your key is stored in your account settings so it follows you between devices.',
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
        paragraphs={[
          'To erase everything in your account but keep the account, open Settings, then Data, then Delete all data. To remove the account itself, including your email address and sign-in details, open Settings, then Account, then Delete account. Both are immediate and cannot be undone.',
          'Signing out does not delete anything; your diary is there again the next time you sign in.',
        ]}
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
