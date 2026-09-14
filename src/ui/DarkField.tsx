import React from 'react';
import { Platform, StyleSheet, TextInput, View } from 'react-native';
import { AppText } from '@/ui/components';
import { fonts, lightColors, palette, radius, type } from '@/ui/theme/tokens';
import { welcomeColors } from '@/ui/welcomeMedia';

/** The outlined fields the create-account and sign-in screens share. */

/** Marks a field so the web shell can force light autofill text.
 * react-native-web forwards dataSet, not className, and dataSet
 * is absent from the React Native prop types. */
export const DARK_FIELD: object = Platform.OS === 'web' ? { dataSet: { authfield: 'true' } } : {};
export const VIDEO_FIELD: object =
  Platform.OS === 'web' ? { dataSet: { videoauthfield: 'true' } } : {};

export const FIELD_HEIGHT = 50;

export function FieldLabel({ children, appearance }: { children: string; appearance?: 'video' }) {
  return (
    <AppText style={appearance === 'video' ? videoFieldStyles.label : fieldStyles.label}>
      {children}
      <AppText style={appearance === 'video' ? videoFieldStyles.required : fieldStyles.required}>
        {' '}
        *
      </AppText>
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
  appearance,
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
  appearance?: 'video';
}) {
  const styles = appearance === 'video' ? videoFieldStyles : fieldStyles;
  const attributes = appearance === 'video' ? VIDEO_FIELD : DARK_FIELD;
  return (
    <View style={[styles.field, invalid ? styles.fieldInvalid : null]} {...attributes}>
      <TextInput
        accessibilityLabel={accessibilityLabel}
        value={value}
        onChangeText={onChangeText}
        onFocus={onFocus}
        onBlur={onBlur}
        onSubmitEditing={onSubmitEditing}
        returnKeyType={returnKeyType}
        placeholder={placeholder}
        placeholderTextColor={
          appearance === 'video' ? welcomeColors.textMuted : lightColors.textMuted
        }
        autoCapitalize={autoCapitalize}
        autoComplete={autoComplete}
        autoCorrect={autoCorrect}
        keyboardType={keyboardType}
        secureTextEntry={secureTextEntry}
        textContentType={textContentType}
        maxLength={maxLength}
        {...attributes}
        style={styles.fieldInput}
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

export const videoFieldStyles = StyleSheet.create({
  ...fieldStyles,
  label: { ...fieldStyles.label, color: welcomeColors.textPrimary },
  required: { ...fieldStyles.required, color: '#FFB4B4' },
  field: {
    ...fieldStyles.field,
    backgroundColor: welcomeColors.surface,
    borderColor: welcomeColors.borderStrong,
  },
  fieldInvalid: { borderColor: '#FFB4B4' },
  fieldInput: {
    ...fieldStyles.fieldInput,
    color: welcomeColors.textPrimary,
    ...Platform.select({
      web: {
        WebkitTextFillColor: welcomeColors.textPrimary,
        caretColor: welcomeColors.textPrimary,
      } as object,
      default: {},
    }),
  },
  helper: { ...fieldStyles.helper, color: welcomeColors.textSecondary },
  error: { ...fieldStyles.error, color: '#FFB4B4' },
  ok: { ...fieldStyles.ok, color: '#87F0C9' },
});
