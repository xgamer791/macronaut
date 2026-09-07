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
   * starts below it. Scrolls away on the way down and back in on the way up
   * unless `collapseHeader` is false.
   */
  stickyHeader?: React.ReactNode;
  /** When false, `stickyHeader` stays put instead of hiding on scroll. */
  collapseHeader?: boolean;
  /** Fixed content rendered above the scroll layer (for example a FAB). */
  floatingOverlay?: React.ReactNode;
}

export function Screen({
  children,
  scroll = true,
  padded = true,
  style,
  tabBarSpace = false,
  safeTop = true,
  stickyHeader,
  collapseHeader = true,
  floatingOverlay,
}: ScreenProps) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const hideOnScroll = Boolean(scroll && stickyHeader && collapseHeader);
  const hide = useHeaderScrollHide(hideOnScroll);
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
    hideOnScroll ? (
      <AutoHideHeader hidden={hide.hidden} collapsed={hide.collapsed}>
        {stickyHeader}
      </AutoHideHeader>
    ) : (
      stickyHeader
    )
  ) : null;

  if (!scroll) {
    if (!stickyHeader) {
      return (
        <View style={base}>
          <View style={[styles.fill, contentPad, style]}>{children}</View>
          {floatingOverlay}
        </View>
      );
    }
    return (
      <View style={base}>
        {header}
        <View style={[styles.fill, contentPad, style]}>{children}</View>
        {floatingOverlay}
      </View>
    );
  }

  const scrollProps = {
    contentContainerStyle: [contentPad, style],
    keyboardShouldPersistTaps: 'handled' as const,
    showsVerticalScrollIndicator: false,
    onScroll: hideOnScroll ? hide.onScroll : undefined,
    onScrollEndDrag: hideOnScroll ? hide.onScrollSettle : undefined,
    onMomentumScrollEnd: hideOnScroll ? hide.onScrollSettle : undefined,
    scrollEventThrottle: 16 as const,
    ...(hideOnScroll ? { dataSet: { screenscroll: '1' } } : null),
  };

  return (
    <View style={base}>
      {header}
      <ScrollView {...scrollProps}>{children}</ScrollView>
      {floatingOverlay}
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
});
