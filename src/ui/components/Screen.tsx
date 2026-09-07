import React from 'react';
import { ScrollView, StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AutoHideHeader, useHeaderScrollHide } from '@/ui/motion/headerAutoHide';
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
   * starts below it. Scrolls away on the way down and back in on the way up,
   * at the same speed as the stack-page slide.
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
  const hide = useHeaderScrollHide(Boolean(scroll && stickyHeader));
  const base: StyleProp<ViewStyle> = [
    { flex: 1, backgroundColor: colors.background },
    { paddingTop: safeTop && !stickyHeader ? insets.top : 0 },
  ];
  const contentPad = {
    padding: padded ? spacing.lg : 0,
    paddingBottom: (padded ? spacing.lg : 0) + (tabBarSpace ? 72 : insets.bottom),
    gap: padded ? spacing.lg : 0,
  };

  const header = stickyHeader ? (
    <AutoHideHeader hidden={hide.hidden}>{stickyHeader}</AutoHideHeader>
  ) : null;

  if (!scroll) {
    if (!stickyHeader) {
      return <View style={[base, contentPad, style]}>{children}</View>;
    }
    return (
      <View style={base}>
        {header}
        <View style={[styles.fill, contentPad, style]}>{children}</View>
      </View>
    );
  }

  const scrollProps = {
    contentContainerStyle: [contentPad, style],
    keyboardShouldPersistTaps: 'handled' as const,
    showsVerticalScrollIndicator: false,
    onScroll: stickyHeader ? hide.onScroll : undefined,
    scrollEventThrottle: 16 as const,
  };

  return (
    <View style={base}>
      {header}
      <ScrollView {...scrollProps}>{children}</ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
});
