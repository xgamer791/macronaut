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
  /** Header and tab-bar chrome. Cards keep `surface`. */
  chrome: string;
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
  chrome: '#FFFFFF',
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
  chrome: '#101418',
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

/**
 * Macronaut is set in one face: Inter, at four weights.
 *
 * Each weight is its own loaded family (expo-font registers them that way on
 * native and on the web, and its web `@font-face` declares no font-weight),
 * so weight is expressed by choosing a family — never through `fontWeight`,
 * which on a loaded face means the platform synthesising a second, smeared
 * bold on top of the real one. `fontFor` is the one place that mapping lives.
 */
export const fonts = {
  regular: 'Inter_400Regular',
  medium: 'Inter_500Medium',
  semibold: 'Inter_600SemiBold',
  bold: 'Inter_700Bold',
} as const;

/** The Inter family for a weight. Anything at or above 700 is bold; the
 * keywords and the unset case resolve the way CSS would. */
export function fontFor(weight?: string | number | null): string {
  const w = weight === undefined || weight === null ? 400 : weight;
  const n =
    typeof w === 'number'
      ? w
      : w === 'bold'
        ? 700
        : w === 'normal'
          ? 400
          : Number.parseInt(w, 10) || 400;
  if (n >= 700) return fonts.bold;
  if (n >= 600) return fonts.semibold;
  if (n >= 500) return fonts.medium;
  return fonts.regular;
}

/** Sizes carry the face, so an input that spreads `type.body` is set in
 * Inter without knowing anything about fonts. */
export const type = {
  hero: { fontFamily: fonts.regular, fontSize: 40, lineHeight: 46 },
  title: { fontFamily: fonts.regular, fontSize: 24, lineHeight: 30 },
  heading: { fontFamily: fonts.regular, fontSize: 18, lineHeight: 24 },
  body: { fontFamily: fonts.regular, fontSize: 15, lineHeight: 21 },
  caption: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 18 },
  micro: { fontFamily: fonts.regular, fontSize: 11, lineHeight: 15 },
} as const;

/** Minimum accessible touch target. */
export const touchTarget = 44;
