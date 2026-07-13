import React from 'react';
import { Pressable, View } from 'react-native';
import { useTheme } from '@/ui/theme/ThemeProvider';
import { radius } from '@/ui/theme/tokens';
import { AppText } from './AppText';

export interface SegmentedControlProps<T extends string> {
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
}

export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
}: SegmentedControlProps<T>) {
  const { colors } = useTheme();
  return (
    <View
      style={{
        flexDirection: 'row',
        backgroundColor: colors.track,
        borderRadius: radius.sm,
        padding: 3,
      }}
      accessibilityRole="tablist"
    >
      {options.map((opt) => {
        const selected = opt.value === value;
        return (
          <Pressable
            key={opt.value}
            accessibilityRole="tab"
            accessibilityLabel={opt.label}
            accessibilityState={{ selected }}
            onPress={() => onChange(opt.value)}
            style={{
              flex: 1,
              minHeight: 34,
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: radius.sm - 2,
              backgroundColor: selected ? colors.surface : 'transparent',
              borderWidth: selected ? 1 : 0,
              borderColor: colors.border,
            }}
          >
            <AppText
              variant="caption"
              weight={selected ? '600' : '400'}
              tone={selected ? 'primary' : 'secondary'}
            >
              {opt.label}
            </AppText>
          </Pressable>
        );
      })}
    </View>
  );
}
