/** Macronaut design tokens. One confident accent + neutral ramp, fixed macro
 * hues (never color-only — always paired with a label), light default +
 * true-dark. Matches the approved mockups. */

export const palette = {
  // Accent — Macronaut teal (calorie ring, FAB, primary actions)
  accent: '#17A673',
  accentDark: '#1FC98B',
  onAccent: '#FFFFFF',

  // Fixed macro hues (constant across themes; always shown with labels)
  protein: '#2A78D6',
  carbs: '#E09A00',
  fat: '#7A5AF8',
  fiber: '#8A8F98',

  // Status
  danger: '#D64545',
  dangerDark: '#F07B7B',
  warning: '#B97509',
  warningDark: '#E5A438',
  success: '#17A673',
  successDark: '#1FC98B',
} as const;

export interface ThemeColors {
  background: string;
  surface: string;
  surfaceRaised: string;
  border: string;
  borderStrong: string;
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  accent: string;
  onAccent: string;
  danger: string;
  warning: string;
  success: string;
  overlay: string;
  protein: string;
  carbs: string;
  fat: string;
  fiber: string;
  track: string;
}

export const lightColors: ThemeColors = {
  background: '#F6F7F9',
  surface: '#FFFFFF',
  surfaceRaised: '#FFFFFF',
  border: '#E3E7EE',
  borderStrong: '#C9CFD9',
  textPrimary: '#14181D',
  textSecondary: '#5A6270',
  textMuted: '#8A93A1',
  accent: palette.accent,
  onAccent: palette.onAccent,
  danger: palette.danger,
  warning: palette.warning,
  success: palette.success,
  overlay: 'rgba(16, 20, 24, 0.5)',
  protein: palette.protein,
  carbs: palette.carbs,
  fat: palette.fat,
  fiber: palette.fiber,
  track: '#E9ECF1',
};

export const darkColors: ThemeColors = {
  background: '#0E1114',
  surface: '#171B20',
  surfaceRaised: '#1E242B',
  border: '#262C34',
  borderStrong: '#3A424D',
  textPrimary: '#F2F4F7',
  textSecondary: '#A6AEBB',
  textMuted: '#717A88',
  accent: palette.accentDark,
  onAccent: '#08130E',
  danger: palette.dangerDark,
  warning: palette.warningDark,
  success: palette.successDark,
  overlay: 'rgba(0, 0, 0, 0.6)',
  protein: '#5B9BE6',
  carbs: '#EDB43C',
  fat: '#9B82FA',
  fiber: '#9AA0A9',
  track: '#242A32',
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  full: 999,
} as const;

/** Space Grotesk carries display numerals + headings; body text uses the
 * platform face for maximum legibility. */
export const fonts = {
  display: 'SpaceGrotesk_600SemiBold',
  displayMedium: 'SpaceGrotesk_500Medium',
  body: undefined as string | undefined, // platform default
} as const;

export const type = {
  hero: { fontSize: 40, lineHeight: 46 },
  title: { fontSize: 24, lineHeight: 30 },
  heading: { fontSize: 18, lineHeight: 24 },
  body: { fontSize: 15, lineHeight: 21 },
  caption: { fontSize: 13, lineHeight: 18 },
  micro: { fontSize: 11, lineHeight: 15 },
} as const;

/** Minimum accessible touch target. */
export const touchTarget = 44;
