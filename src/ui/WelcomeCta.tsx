import { Link, type Href } from 'expo-router';
import React from 'react';
import { Platform, Pressable, StyleSheet } from 'react-native';
import { AppText } from '@/ui/components';
import { fonts, palette, radius } from '@/ui/theme/tokens';

/** Same 50pt accent tile as the welcome splash. `href` renders a real
 * expo-router Link (an <a> on web), not a Pressable slot wrapper. */
export function WelcomeCta({
  label,
  onPress,
  href,
  disabled = false,
  accessibilityLabel,
}: {
  label: string;
  onPress?: () => void;
  href?: Href;
  disabled?: boolean;
  accessibilityLabel?: string;
}) {
  const labelEl = <AppText style={styles.ctaLabel}>{label}</AppText>;
  const a11y = accessibilityLabel ?? label;

  if (href && !disabled) {
    return (
      <Link href={href} accessibilityRole="button" accessibilityLabel={a11y} style={styles.cta}>
        {labelEl}
      </Link>
    );
  }

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={a11y}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.cta,
        disabled && styles.ctaDisabled,
        pressed && !disabled && styles.ctaPressed,
      ]}
    >
      {labelEl}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  cta: {
    height: 50,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: palette.accent,
    borderRadius: radius.md,
    textDecorationLine: 'none',
    ...Platform.select({ web: { cursor: 'pointer' } }),
  },
  ctaDisabled: {
    opacity: 0.4,
  },
  ctaPressed: {
    opacity: 0.85,
  },
  ctaLabel: {
    fontFamily: fonts.display,
    color: '#FFFFFF',
    fontSize: 17,
    lineHeight: 22,
    fontWeight: '600',
    textDecorationLine: 'none',
  },
});
