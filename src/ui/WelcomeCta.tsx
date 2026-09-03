import { Link, type Href } from 'expo-router';
import React from 'react';
import { Pressable, StyleSheet } from 'react-native';
import { AppText } from '@/ui/components';
import { fonts, palette, radius } from '@/ui/theme/tokens';

/** Same 50pt accent tile as the welcome splash — square corners, white
 * Space Grotesk label. Disabled dims in place; it does not change shape.
 * Pass `href` for a real link so the tap cannot get lost behind the video. */
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
  const button = (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.cta,
        disabled && styles.ctaDisabled,
        pressed && !disabled && styles.ctaPressed,
      ]}
    >
      <AppText style={styles.ctaLabel}>{label}</AppText>
    </Pressable>
  );

  if (href && !disabled) {
    return (
      <Link href={href} asChild>
        {button}
      </Link>
    );
  }

  return button;
}

const styles = StyleSheet.create({
  cta: {
    height: 50,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: palette.accent,
    borderRadius: radius.md,
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
  },
});
