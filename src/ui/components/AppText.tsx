import React from 'react';
import { StyleSheet, Text, TextProps, TextStyle } from 'react-native';
import { useTheme } from '@/ui/theme/ThemeProvider';
import { fontFor, type } from '@/ui/theme/tokens';

type Variant = keyof typeof type;
type Tone = 'primary' | 'secondary' | 'muted' | 'accent' | 'danger' | 'onAccent';

export interface AppTextProps extends TextProps {
  variant?: Variant;
  tone?: Tone;
  /** Semibold — the weight hero numbers and headings are set in. A `weight`
   * still wins when both are given. */
  display?: boolean;
  weight?: TextStyle['fontWeight'];
  align?: TextStyle['textAlign'];
}

/**
 * Every piece of text in the app. Inter is the only face, and each weight is
 * a separate loaded family, so this is where a weight — from the prop, from a
 * `fontWeight` in `style`, or from `display` — becomes the right family. The
 * `fontWeight` itself is dropped on the way out: on a loaded face it would
 * only ask the platform to fake a bold it already has.
 */
export function AppText({
  variant = 'body',
  tone = 'primary',
  display = false,
  weight,
  align,
  style,
  ...rest
}: AppTextProps) {
  const { colors } = useTheme();
  const color =
    tone === 'primary'
      ? colors.textPrimary
      : tone === 'secondary'
        ? colors.textSecondary
        : tone === 'muted'
          ? colors.textMuted
          : tone === 'accent'
            ? colors.accent
            : tone === 'danger'
              ? colors.danger
              : colors.onAccent;

  const flat: TextStyle = StyleSheet.flatten([type[variant], { color }, style]) ?? {};
  const asked = weight ?? flat.fontWeight ?? (display ? '600' : undefined);
  // An explicit family in `style` stands, unless a weight was asked for —
  // then the weight decides, which is what a fontWeight beside a family means.
  const fontFamily = asked !== undefined ? fontFor(asked) : (flat.fontFamily ?? fontFor());
  const { fontWeight: _dropped, ...rest_style } = flat;

  return (
    <Text
      {...rest}
      style={[rest_style, { fontFamily }, align !== undefined && { textAlign: align }]}
    />
  );
}
