import React from 'react';
import { ScrollView, StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/ui/theme/ThemeProvider';
import { spacing } from '@/ui/theme/tokens';

export interface ScreenProps {
  children: React.ReactNode;
  scroll?: boolean;
  padded?: boolean;
  style?: StyleProp<ViewStyle>;
  /** Extra bottom padding so content clears the tab bar. */
  tabBarSpace?: boolean;
  /** When false, content can draw under the status bar (full-bleed heroes). */
  safeTop?: boolean;
  /**
   * Chrome above the scrolling layer. Occupies layout space so the page
   * starts below it instead of drawing underneath.
   */
  stickyHeader?: React.ReactNode;
}

export function Screen({
  children,
  scroll = true,
  padded = true,
  style,
  tabBarSpace = false,
  safeTop = true,
  stickyHeader,
}: ScreenProps) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const base: StyleProp<ViewStyle> = [
    { flex: 1, backgroundColor: colors.background },
    { paddingTop: safeTop && !stickyHeader ? insets.top : 0 },
  ];
  const contentPad = {
    padding: padded ? spacing.lg : 0,
    paddingBottom: (padded ? spacing.lg : 0) + (tabBarSpace ? 72 : insets.bottom),
    gap: padded ? spacing.lg : 0,
  };

  if (!scroll) {
    if (!stickyHeader) {
      return <View style={[base, contentPad, style]}>{children}</View>;
    }
    return (
      <View style={base}>
        {stickyHeader}
        <View style={[styles.fill, contentPad, style]}>{children}</View>
      </View>
    );
  }

  const scrollProps = {
    contentContainerStyle: [contentPad, style],
    keyboardShouldPersistTaps: 'handled' as const,
    showsVerticalScrollIndicator: false,
  };

  return (
    <View style={base}>
      {stickyHeader}
      <ScrollView {...scrollProps}>{children}</ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
});
