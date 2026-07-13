import React from 'react';
import { TextInput, TextInputProps, View } from 'react-native';
import { useTheme } from '@/ui/theme/ThemeProvider';
import { radius, spacing, touchTarget, type } from '@/ui/theme/tokens';
import { AppText } from './AppText';

export interface TextFieldProps extends TextInputProps {
  label?: string;
  error?: string;
  required?: boolean;
}

export function TextField({ label, error, required, style, ...rest }: TextFieldProps) {
  const { colors } = useTheme();
  return (
    <View style={{ gap: spacing.xs }}>
      {label ? (
        <AppText variant="caption" tone="secondary">
          {label}
          {required ? ' *' : ''}
        </AppText>
      ) : null}
      <TextInput
        accessibilityLabel={label ?? rest.placeholder}
        placeholderTextColor={colors.textMuted}
        {...rest}
        style={[
          type.body,
          {
            borderWidth: 1,
            borderColor: error ? colors.danger : colors.borderStrong,
            borderRadius: radius.sm,
            backgroundColor: colors.surface,
            paddingHorizontal: spacing.md,
            paddingVertical: 10,
            minHeight: touchTarget,
            color: colors.textPrimary,
          },
          style,
        ]}
      />
      {error ? (
        <AppText variant="micro" tone="danger" accessibilityLiveRegion="polite">
          {error}
        </AppText>
      ) : null}
    </View>
  );
}
