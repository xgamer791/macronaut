import React, { useCallback, useState } from 'react';
import { TextInput, View } from 'react-native';
import { useTheme } from '@/ui/theme/ThemeProvider';
import { radius, spacing, touchTarget, type } from '@/ui/theme/tokens';
import { AppText } from './AppText';

export interface NumberFieldProps {
  label: string;
  value: number | undefined;
  onChange: (value: number | undefined) => void;
  unit?: string;
  placeholder?: string;
  /** Reject values below this (default 0 — nutrition can't be negative). */
  min?: number;
  max?: number;
  integer?: boolean;
  error?: string;
  required?: boolean;
}

/** Numeric input with validation. Keeps a local text state so partial input
 * ("1." or "") doesn't fight the parsed value. */
export function NumberField({
  label,
  value,
  onChange,
  unit,
  placeholder,
  min = 0,
  max,
  integer = false,
  error,
  required = false,
}: NumberFieldProps) {
  const { colors } = useTheme();
  const [text, setText] = useState(value !== undefined ? String(value) : '');
  const [localError, setLocalError] = useState<string | undefined>();
  const [lastValue, setLastValue] = useState(value);

  // Derived-state sync (render-time, per React docs): when the outside value
  // changes and disagrees with the parsed local text, adopt it.
  if (value !== lastValue) {
    setLastValue(value);
    const parsed = text === '' ? undefined : Number(text);
    if (parsed !== value && !(Number.isNaN(parsed as number) && value === undefined)) {
      setText(value !== undefined ? String(value) : '');
    }
  }

  const handleChange = useCallback(
    (t: string) => {
      const normalized = t.replace(',', '.');
      setText(normalized);
      if (normalized.trim() === '') {
        setLocalError(required ? 'Required' : undefined);
        onChange(undefined);
        return;
      }
      const n = Number(normalized);
      if (Number.isNaN(n)) {
        setLocalError('Enter a number');
        return;
      }
      if (integer && !Number.isInteger(n)) {
        setLocalError('Whole numbers only');
        return;
      }
      if (n < min) {
        setLocalError(`Must be at least ${min}`);
        return;
      }
      if (max !== undefined && n > max) {
        setLocalError(`Must be at most ${max}`);
        return;
      }
      setLocalError(undefined);
      onChange(n);
    },
    [integer, max, min, onChange, required],
  );

  const shownError = error ?? localError;

  return (
    <View style={{ gap: spacing.xs }}>
      <AppText variant="caption" tone="secondary">
        {label}
        {required ? ' *' : ''}
      </AppText>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          borderWidth: 1,
          borderColor: shownError ? colors.danger : colors.borderStrong,
          borderRadius: radius.sm,
          backgroundColor: colors.surface,
          paddingHorizontal: spacing.md,
          minHeight: touchTarget,
        }}
      >
        <TextInput
          accessibilityLabel={label}
          value={text}
          onChangeText={handleChange}
          placeholder={placeholder}
          placeholderTextColor={colors.textMuted}
          keyboardType="decimal-pad"
          inputMode="decimal"
          style={[type.body, { flex: 1, color: colors.textPrimary, paddingVertical: 10 }]}
        />
        {unit ? (
          <AppText variant="caption" tone="muted">
            {unit}
          </AppText>
        ) : null}
      </View>
      {shownError ? (
        <AppText variant="micro" tone="danger" accessibilityLiveRegion="polite">
          {shownError}
        </AppText>
      ) : null}
    </View>
  );
}
