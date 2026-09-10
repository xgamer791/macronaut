import React from 'react';
import { Platform, StyleSheet, TextInput, View } from 'react-native';
import { AppText } from '@/ui/components';
import { fonts, lightColors, palette, radius, type } from '@/ui/theme/tokens';

/** The outlined fields the create-account and sign-in screens share. */

/** Marks a field so the web shell can force light autofill text.
 * react-native-web forwards dataSet, not className, and dataSet
 * is absent from the React Native prop types. */
export const DARK_FIELD: object = Platform.OS === 'web' ? { dataSet: { authfield: 'true' } } : {};

export const FIELD_HEIGHT = 50;

export function FieldLabel({ children }: { children: string }) {
  return (
    <AppText style={fieldStyles.label}>
      {children}
      <AppText style={fieldStyles.required}> *</AppText>
    </AppText>
  );
}

export function OutlineInput({
  value,
  onChangeText,
  accessibilityLabel,
  placeholder,
  autoCapitalize,
  autoComplete,
  autoCorrect,
  keyboardType,
  secureTextEntry,
  textContentType,
  maxLength,
  trailing,
  onFocus,
  onBlur,
  onSubmitEditing,
  returnKeyType,
  invalid,
}: {
  value: string;
  onChangeText: (next: string) => void;
  accessibilityLabel: string;
  placeholder?: string;
  autoCapitalize?: 'none' | 'words';
  autoComplete?: 'name' | 'email' | 'password' | 'password-new' | 'one-time-code' | 'off';
  autoCorrect?: boolean;
  keyboardType?: 'default' | 'email-address' | 'number-pad';
  secureTextEntry?: boolean;
  textContentType?: 'name' | 'emailAddress' | 'password' | 'newPassword' | 'oneTimeCode';
  maxLength?: number;
  trailing?: React.ReactNode;
  onFocus?: () => void;
  onBlur?: () => void;
  onSubmitEditing?: () => void;
  returnKeyType?: 'go' | 'next' | 'done' | 'send';
  /** Outlines the field in the danger colour. The reason belongs next to it,
   * in words — the outline alone is not something everyone can see. */
  invalid?: boolean;
}) {
  return (
    <View style={[fieldStyles.field, invalid ? fieldStyles.fieldInvalid : null]} {...DARK_FIELD}>
      <TextInput
        accessibilityLabel={accessibilityLabel}
        value={value}
        onChangeText={onChangeText}
        onFocus={onFocus}
        onBlur={onBlur}
        onSubmitEditing={onSubmitEditing}
        returnKeyType={returnKeyType}
        placeholder={placeholder}
        placeholderTextColor={lightColors.textMuted}
        autoCapitalize={autoCapitalize}
        autoComplete={autoComplete}
        autoCorrect={autoCorrect}
        keyboardType={keyboardType}
        secureTextEntry={secureTextEntry}
        textContentType={textContentType}
        maxLength={maxLength}
        {...DARK_FIELD}
        style={fieldStyles.fieldInput}
      />
      {trailing}
    </View>
  );
}

export const fieldStyles = StyleSheet.create({
  label: {
    color: lightColors.textPrimary,
    fontSize: type.caption.fontSize,
    lineHeight: type.caption.lineHeight,
    fontWeight: '600',
    marginBottom: 8,
  },
  required: {
    color: palette.danger,
    fontSize: type.caption.fontSize,
    lineHeight: type.caption.lineHeight,
    fontWeight: '600',
  },
  field: {
    minHeight: FIELD_HEIGHT,
    borderWidth: 1,
    borderColor: lightColors.borderStrong,
    borderRadius: radius.md,
    backgroundColor: lightColors.surface,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  fieldInvalid: {
    borderColor: palette.danger,
  },
  fieldInput: {
    fontFamily: fonts.regular,
    flex: 1,
    height: FIELD_HEIGHT,
    color: lightColors.textPrimary,
    fontSize: type.body.fontSize,
    lineHeight: type.body.lineHeight,
    padding: 0,
    backgroundColor: 'transparent',
    ...Platform.select({
      web: {
        outlineStyle: 'none',
        outlineWidth: 0,
        WebkitTextFillColor: lightColors.textPrimary,
        caretColor: lightColors.textPrimary,
      } as object,
      default: {},
    }),
  },
  helper: {
    color: lightColors.textSecondary,
    fontSize: type.micro.fontSize,
    lineHeight: type.micro.lineHeight,
    fontWeight: '400',
    marginTop: 8,
  },
  error: {
    color: palette.danger,
    fontSize: type.caption.fontSize,
    lineHeight: type.caption.lineHeight,
    fontWeight: '600',
  },
  /** Sits where the error would, so a field settling from bad to good does not
   * shift the rest of the form. */
  ok: {
    color: palette.accent,
    fontSize: type.caption.fontSize,
    lineHeight: type.caption.lineHeight,
    fontWeight: '600',
  },
  fieldNote: {
    marginTop: 8,
  },
});
