import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { Platform, StyleSheet, TextInput, TextInputProps, View } from 'react-native';
import { fonts } from '@/ui/theme/tokens';
import { authColors } from './theme';

/** A text field in the card's own palette. The app-wide TextField follows the
 * theme, which would put a dark input inside the light card in dark mode. */
export function AuthTextField({
  icon,
  style,
  onFocus,
  onBlur,
  ...rest
}: TextInputProps & { icon?: keyof typeof Ionicons.glyphMap }) {
  const [focused, setFocused] = useState(false);
  return (
    <View style={[styles.field, focused && styles.fieldFocused]}>
      {icon ? (
        <Ionicons
          name={icon}
          size={20}
          color={focused ? authColors.navy : authColors.fieldPlaceholder}
        />
      ) : null}
      <TextInput
        placeholderTextColor={authColors.fieldPlaceholder}
        selectionColor={authColors.navy}
        {...rest}
        onFocus={(e) => {
          setFocused(true);
          onFocus?.(e);
        }}
        onBlur={(e) => {
          setFocused(false);
          onBlur?.(e);
        }}
        style={[styles.input, style]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  field: {
    minHeight: 52,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: authColors.fieldBorder,
    backgroundColor: authColors.fieldBg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
  },
  fieldFocused: {
    borderColor: authColors.navy,
    borderWidth: 1.5,
    paddingHorizontal: 15.5,
  },
  input: {
    flex: 1,
    fontFamily: fonts.displayMedium,
    fontSize: 16,
    lineHeight: 22,
    color: authColors.navy,
    paddingVertical: 12,
    // React Native Web draws its own focus ring; the border above is ours.
    ...Platform.select({ web: { outlineStyle: 'none' } as object, default: {} }),
  },
});
