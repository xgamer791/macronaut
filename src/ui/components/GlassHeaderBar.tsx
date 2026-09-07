import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/ui/theme/ThemeProvider';
import { spacing } from '@/ui/theme/tokens';
import { HEADER_PAD_TOP } from './todayHeroLayout';

export interface GlassHeaderBarProps {
  children: React.ReactNode;
  /** Horizontal padding around the row, so a page keeps its own alignment. */
  inset?: number;
}

/**
 * Full-bleed chrome above a `Screen`'s scroll layer. Same chrome fill and
 * hairline as the tab bar, in document flow so page content starts below it.
 */
export function GlassHeaderBar({ children, inset = spacing.sm }: GlassHeaderBarProps) {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();

  return (
    <View
      style={[
        styles.bar,
        {
          backgroundColor: colors.chrome,
          borderBottomColor: colors.border,
          paddingTop: insets.top + HEADER_PAD_TOP,
          paddingHorizontal: inset,
        },
      ]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingBottom: spacing.xs,
    zIndex: 20,
  },
});
