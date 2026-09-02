/** Public legal copy for the signed-out Privacy Policy and Terms of Use
 * screens. Kept as data so the pages stay thin and tests can check the
 * substance without mounting React Native. */

export const LEGAL_EFFECTIVE_DATE = 'September 2, 2026';
export const LEGAL_CONTACT_EMAIL = 'chris@mangomarketeers.com';

export interface LegalSection {
  heading: string;
  body: string;
}

export const PRIVACY_TITLE = 'Privacy Policy';
export const TERMS_TITLE = 'Terms of Use';

export const PRIVACY_SECTIONS: LegalSection[] = [
  {
    heading: 'What Macronaut is',
    body: 'Macronaut is a calorie and macro tracker. You can use it on this device without an account. Optional accounts use Google or email, handled by Supabase.',
  },
  {
    heading: 'Where your diary lives',
    body: 'Diary data is local-first. It stays on your device. Cloud sync of diary data is not shipping yet.',
  },
  {
    heading: 'What sign-in stores',
    body: 'If you sign in, Macronaut stores your identity — your email, and your Google profile name if you provide one — in Supabase Auth and a profiles row.',
  },
  {
    heading: 'Ads and tracking',
    body: 'Macronaut has no ads. We do not add trackers beyond what Google and Supabase need to sign you in.',
  },
  {
    heading: 'Contact',
    body: `Questions about this policy: ${LEGAL_CONTACT_EMAIL}`,
  },
];

export const TERMS_SECTIONS: LegalSection[] = [
  {
    heading: 'Not medical or nutrition advice',
    body: 'Macronaut is a tracking tool. It is not medical advice and it is not nutrition advice.',
  },
  {
    heading: 'Use at your own risk',
    body: 'Use Macronaut at your own risk. Food database data can be wrong. Check labels and your own judgment before you rely on a number.',
  },
  {
    heading: 'Accounts',
    body: 'Accounts are optional. You can use Macronaut on this device without signing in.',
  },
  {
    heading: 'Fair use',
    body: 'Do not abuse the service.',
  },
  {
    heading: 'Contact',
    body: `Questions about these terms: ${LEGAL_CONTACT_EMAIL}`,
  },
];
