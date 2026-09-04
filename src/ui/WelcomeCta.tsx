import { useRouter, type Href } from 'expo-router';
import React from 'react';
import { Pressable, StyleSheet } from 'react-native';
import { AppText } from '@/ui/components';
import { fonts, palette, radius } from '@/ui/theme/tokens';

/** Same 50pt accent tile for every welcome action. `href` navigates through
 * the same Pressable as `onPress`, so the label stays centered. */
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
  const router = useRouter();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={() => {
        onPress?.();
        if (href) router.push(href);
      }}
      style={({ pressed }) => [
        styles.cta,
        disabled && styles.ctaDisabled,
        pressed && !disabled && styles.ctaPressed,
      ]}
    >
      <AppText style={styles.ctaLabel}>{label}</AppText>
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
