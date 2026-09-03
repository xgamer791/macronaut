import { StyleSheet } from 'react-native';
import { fonts } from '@/ui/theme/tokens';

/** The sign-in surfaces sit on the editorial produce photo and are always the
 * light glass card, whatever the app theme — so their palette is fixed here
 * rather than read from ThemeProvider. */
export const authColors = {
  navy: '#0B1F3A',
  navySoft: '#1A2F4A',
  navyMuted: 'rgba(26, 47, 74, 0.6)',
  cardBg: 'rgba(255, 255, 255, 0.86)',
  cardBorder: 'rgba(255, 255, 255, 0.95)',
  danger: '#B3261E',
  /** Apple's branding rules for a custom Sign in with Apple button: black or
   * white only, and no other colour. */
  appleBlack: '#000000',
  fieldBg: '#FFFFFF',
  fieldBorder: 'rgba(11, 31, 58, 0.14)',
  fieldPlaceholder: 'rgba(26, 47, 74, 0.45)',
  page: '#E8E4DF',
} as const;

export const authStyles = StyleSheet.create({
  pill: {
    minHeight: 52,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingHorizontal: 16,
  },
  pillLabel: {
    fontFamily: fonts.displayMedium,
    fontSize: 16,
    lineHeight: 22,
    fontWeight: '600',
  },
  shadowStrong: {
    shadowColor: authColors.navy,
    shadowOpacity: 0.22,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  shadowSoft: {
    shadowColor: authColors.navy,
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  title: {
    fontFamily: fonts.display,
    fontSize: 24,
    lineHeight: 30,
    fontWeight: '700',
    color: authColors.navy,
    letterSpacing: -0.3,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    lineHeight: 20,
    color: authColors.navySoft,
    textAlign: 'center',
  },
  subtitleStrong: {
    fontWeight: '600',
    color: authColors.navy,
  },
  error: {
    fontSize: 14,
    lineHeight: 20,
    color: authColors.danger,
    textAlign: 'center',
  },
  muted: {
    fontSize: 14,
    lineHeight: 20,
    color: authColors.navySoft,
  },
  link: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '600',
    color: authColors.navy,
    textDecorationLine: 'underline',
  },
  linkDisabled: {
    color: authColors.navyMuted,
    textDecorationLine: 'none',
  },
  inlineRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    alignItems: 'center',
  },
});
