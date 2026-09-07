import React, { useState } from 'react';
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
   * Chrome above the scrolling layer. The page starts below it. Scrolls away
   * on the way down and back in on the way up unless `collapseHeader` is
   * false.
   */
  stickyHeader?: React.ReactNode;
  /**
   * Paint the page under a collapsing sticky header. Today uses this so the
   * gym hero meets the hairline instead of sitting on a reserved band.
   */
  overlayHeader?: boolean;
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
  overlayHeader = false,
  collapseHeader = true,
  floatingOverlay,
}: ScreenProps) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const hideOnScroll = Boolean(scroll && stickyHeader && collapseHeader);
  const overlay = Boolean(hideOnScroll && overlayHeader);
  const hide = useHeaderScrollHide(hideOnScroll);
  // A collapsing header floats over the page, so the space it would have
  // taken is reserved here and never changes. Anything that resized the
  // scroll layer as the header left would drag the content with it.
  const [headerHeight, setHeaderHeight] = useState(0);
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
      <AutoHideHeader
        hidden={hide.hidden}
        floating={overlay || headerHeight > 0}
        onHeight={setHeaderHeight}
      >
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

  // Last, so the reserved band always matches the slab covering it.
  // Overlay pages skip the band: the first child tucks under the slab.
  const headerPad = hideOnScroll && !overlay ? { paddingTop: headerHeight } : null;

  const scrollProps = {
    contentContainerStyle: [contentPad, style, headerPad],
    keyboardShouldPersistTaps: 'handled' as const,
    showsVerticalScrollIndicator: false,
    onScroll: hideOnScroll ? hide.onScroll : undefined,
    scrollEventThrottle: 16 as const,
    ...(hideOnScroll ? { dataSet: { screenscroll: '1' } } : null),
  };

  // Once floating, the slab paints over the scroll layer, so it is mounted
  // after it. Before that it is still in flow and has to come first.
  if (hideOnScroll && (overlay || headerHeight > 0)) {
    return (
      <View style={base}>
        <ScrollView {...scrollProps}>{children}</ScrollView>
        {header}
        {floatingOverlay}
      </View>
    );
  }

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
