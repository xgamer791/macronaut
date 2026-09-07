import React from 'react';
import { ScrollView, StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import Animated, { useAnimatedScrollHandler, useSharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { HEADER_GLASS_TRAVEL, HeaderGlassProvider } from '@/ui/motion/headerGlass';
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
   * Chrome pinned above the scrolling layer — a `GlassHeaderBar`. The screen
   * feeds it how far the page has scrolled, so the glass can pour in as
   * content rises behind it.
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
  const glass = useSharedValue(0);
  const onScroll = useAnimatedScrollHandler((e) => {
    const y = e.contentOffset.y;
    glass.value = y <= 0 ? 0 : y >= HEADER_GLASS_TRAVEL ? 1 : y / HEADER_GLASS_TRAVEL;
  });
  const base: StyleProp<ViewStyle> = [
    { flex: 1, backgroundColor: colors.background },
    { paddingTop: safeTop ? insets.top : 0 },
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
    // Nothing can scroll under a static page, so the glass stays poured.
    return (
      <View style={base}>
        <View style={[styles.fill, contentPad, style]}>{children}</View>
        {stickyHeader}
      </View>
    );
  }

  const scrollProps = {
    contentContainerStyle: [contentPad, style],
    keyboardShouldPersistTaps: 'handled' as const,
    showsVerticalScrollIndicator: false,
  };

  if (!stickyHeader) {
    return (
      <View style={base}>
        <ScrollView {...scrollProps}>{children}</ScrollView>
      </View>
    );
  }

  return (
    <View style={base}>
      <Animated.ScrollView {...scrollProps} onScroll={onScroll} scrollEventThrottle={16}>
        {children}
      </Animated.ScrollView>
      <HeaderGlassProvider progress={glass}>{stickyHeader}</HeaderGlassProvider>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
});
