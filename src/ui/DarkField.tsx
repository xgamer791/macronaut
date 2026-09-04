import React from 'react';
import { Platform, StyleSheet, TextInput, View } from 'react-native';
import { AppText } from '@/ui/components';
import { palette, radius, type } from '@/ui/theme/tokens';

/** The outlined white-on-video fields the create-account and sign-in screens
 * share. Both sit on the welcome loop, so they need the same 50pt outline and
 * the same fight with WebKit's autofill styling. */

/** Marks a field that sits on the dark video so the web shell can force white
 * autofill text. react-native-web forwards dataSet, not className, and dataSet
 * is absent from the React Native prop types. */
export const DARK_FIELD: object = Platform.OS === 'web' ? { dataSet: { darkfield: 'true' } } : {};

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
  onSubmitEditing,
  returnKeyType,
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
  onSubmitEditing?: () => void;
  returnKeyType?: 'go' | 'next' | 'done' | 'send';
}) {
  return (
    <View style={fieldStyles.field} {...DARK_FIELD}>
      <TextInput
        accessibilityLabel={accessibilityLabel}
        value={value}
        onChangeText={onChangeText}
        onFocus={onFocus}
        onSubmitEditing={onSubmitEditing}
        returnKeyType={returnKeyType}
        placeholder={placeholder}
        placeholderTextColor="rgba(255,255,255,0.45)"
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
    color: '#FFFFFF',
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
    borderColor: 'rgba(255,255,255,0.55)',
    borderRadius: radius.md,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  fieldInput: {
    flex: 1,
    height: FIELD_HEIGHT,
    color: '#FFFFFF',
    fontSize: type.body.fontSize,
    lineHeight: type.body.lineHeight,
    padding: 0,
    backgroundColor: 'transparent',
    ...Platform.select({
      web: {
        outlineStyle: 'none',
        outlineWidth: 0,
        WebkitTextFillColor: '#FFFFFF',
        caretColor: '#FFFFFF',
      } as object,
      default: {},
    }),
  },
  helper: {
    color: 'rgba(255,255,255,0.62)',
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
});
