import React, { useRef, useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import { AppText } from '@/ui/components/AppText';
import { fonts } from '@/ui/theme/tokens';
import { authColors } from './theme';

export const CODE_LENGTH = 6;

export interface CodeInputProps {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  autoFocus?: boolean;
}

/** Six digit boxes drawn over one invisible input, so the whole code is a
 * single value: typing fills boxes left to right, backspace empties them, and
 * a pasted or autofilled code (iOS reads it out of the email) lands in one go. */
export function CodeInput({ value, onChange, disabled, autoFocus }: CodeInputProps) {
  const inputRef = useRef<TextInput>(null);
  const [focused, setFocused] = useState(false);
  const digits = value.replace(/[^0-9]/g, '').slice(0, CODE_LENGTH);
  const activeIndex = Math.min(digits.length, CODE_LENGTH - 1);

  return (
    <Pressable
      onPress={() => inputRef.current?.focus()}
      accessible={false}
      style={styles.row}
    >
      {Array.from({ length: CODE_LENGTH }, (_, index) => {
        const digit = digits[index] ?? '';
        const active = focused && index === activeIndex && !disabled;
        return (
          <View
            key={index}
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
            style={[styles.box, active && styles.boxActive, digit !== '' && styles.boxFilled]}
          >
            <AppText style={styles.digit}>{digit}</AppText>
            {active && digit === '' ? <View style={styles.caret} /> : null}
          </View>
        );
      })}
      <TextInput
        ref={inputRef}
        accessibilityLabel="Six-digit code"
        value={digits}
        onChangeText={(next) => onChange(next.replace(/[^0-9]/g, '').slice(0, CODE_LENGTH))}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        editable={!disabled}
        autoFocus={autoFocus}
        keyboardType="number-pad"
        inputMode="numeric"
        textContentType="oneTimeCode"
        autoComplete="one-time-code"
        autoCapitalize="none"
        autoCorrect={false}
        maxLength={CODE_LENGTH}
        caretHidden
        style={styles.hidden}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
  },
  box: {
    flex: 1,
    aspectRatio: 0.85,
    maxWidth: 48,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: authColors.fieldBorder,
    backgroundColor: authColors.fieldBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  boxActive: {
    borderColor: authColors.navy,
    borderWidth: 2,
  },
  boxFilled: {
    borderColor: 'rgba(11, 31, 58, 0.35)',
  },
  digit: {
    fontFamily: fonts.display,
    fontSize: 24,
    lineHeight: 30,
    fontWeight: '700',
    color: authColors.navy,
  },
  caret: {
    position: 'absolute',
    width: 2,
    height: 22,
    borderRadius: 1,
    backgroundColor: authColors.navy,
  },
  hidden: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    opacity: 0,
    color: 'transparent',
  },
});
