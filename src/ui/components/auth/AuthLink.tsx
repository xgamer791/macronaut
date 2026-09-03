import React from 'react';
import { Pressable, StyleProp, TextStyle } from 'react-native';
import { AppText } from '@/ui/components/AppText';
import { authStyles } from './theme';

/** An underlined text action, the tertiary control on these surfaces. */
export function AuthLink({
  label,
  onPress,
  disabled,
  style,
  accessibilityLabel,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  style?: StyleProp<TextStyle>;
  accessibilityLabel?: string;
}) {
  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled}
      onPress={onPress}
      hitSlop={8}
    >
      <AppText style={[authStyles.link, disabled && authStyles.linkDisabled, style]}>
        {label}
      </AppText>
    </Pressable>
  );
}
