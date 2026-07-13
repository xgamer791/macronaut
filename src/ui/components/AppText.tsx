import React from 'react';
import { Text, TextProps, TextStyle } from 'react-native';
import { useTheme } from '@/ui/theme/ThemeProvider';
import { fonts, type } from '@/ui/theme/tokens';

type Variant = keyof typeof type;
type Tone = 'primary' | 'secondary' | 'muted' | 'accent' | 'danger' | 'onAccent';

export interface AppTextProps extends TextProps {
  variant?: Variant;
  tone?: Tone;
  /** Space Grotesk — hero numbers and headings. */
  display?: boolean;
  weight?: TextStyle['fontWeight'];
  align?: TextStyle['textAlign'];
}

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

  return (
    <Text
      {...rest}
      style={[
        type[variant],
        { color },
        display && { fontFamily: fonts.display },
        weight !== undefined && { fontWeight: weight },
        align !== undefined && { textAlign: align },
        style,
      ]}
    />
  );
}
