import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet } from 'react-native';
import { AppText } from '@/ui/components/AppText';
import { authColors, authStyles } from './theme';

export type PillVariant = 'apple' | 'google' | 'navy';

export interface AuthPillProps {
  label: string;
  onPress: () => void;
  variant: PillVariant;
  icon?: React.ReactNode;
  disabled?: boolean;
  /** Replaces the label with a spinner; the pill keeps its size. */
  loading?: boolean;
  accessibilityLabel?: string;
}

/** The one button shape every sign-in surface uses, in the three colours the
 * login mockup established: Apple black, Google white, everything else navy. */
export function AuthPill({
  label,
  onPress,
  variant,
  icon,
  disabled,
  loading,
  accessibilityLabel,
}: AuthPillProps) {
  const labelColor = variant === 'google' ? authColors.navy : '#FFFFFF';
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled: !!disabled || !!loading, busy: !!loading }}
      disabled={disabled || loading}
      onPress={onPress}
      style={({ pressed }) => [
        authStyles.pill,
        variant === 'apple' && styles.apple,
        variant === 'google' && styles.google,
        variant === 'navy' && styles.navy,
        pressed && { opacity: 0.9 },
        disabled && !loading && { opacity: 0.6 },
      ]}
    >
      {loading ? (
        <ActivityIndicator size="small" color={labelColor} />
      ) : (
        <>
          {icon}
          <AppText style={[authStyles.pillLabel, { color: labelColor }]}>{label}</AppText>
        </>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  apple: {
    backgroundColor: authColors.appleBlack,
    ...authStyles.shadowStrong,
  },
  google: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: 'rgba(11, 31, 58, 0.12)',
    ...authStyles.shadowSoft,
  },
  navy: {
    backgroundColor: authColors.navy,
    ...authStyles.shadowStrong,
  },
});
