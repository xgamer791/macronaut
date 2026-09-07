import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useHeaderGlassProgress } from '@/ui/motion/headerGlass';
import { spacing } from '@/ui/theme/tokens';

/** react-native-web drops className; the web shell styles [data-headerglass]. */
const HEADER_GLASS: object =
  Platform.OS === 'web' ? { dataSet: { headerglass: 'true' } } : {};

export interface GlassHeaderBarProps {
  children: React.ReactNode;
  /** Horizontal padding around the row, so a page keeps its own alignment. */
  inset?: number;
}

/**
 * A full-bleed navigation bar pinned above a `Screen`'s scroll layer.
 *
 * The glass is poured by scrolling. At the top of a page the bar is clear
 * chrome over the hero photo; the 2025–26 liquid-glass material fades in as
 * ordinary content starts running underneath.
 */
export function GlassHeaderBar({ children, inset = spacing.sm }: GlassHeaderBarProps) {
  const insets = useSafeAreaInsets();
  const progress = useHeaderGlassProgress();
  const pour = useAnimatedStyle(() => ({ opacity: progress.value }));

  return (
    <View style={styles.layer}>
      <Animated.View pointerEvents="none" style={[styles.material, pour]}>
        <GlassMaterial />
      </Animated.View>
      <View style={[styles.content, { paddingTop: insets.top + 2, paddingHorizontal: inset }]}>
        {children}
      </View>
    </View>
  );
}

/** Web uses the exact CSS recipe. Native approximates the same slab. */
function GlassMaterial() {
  if (Platform.OS === 'web') {
    return <View {...HEADER_GLASS} style={StyleSheet.absoluteFill} />;
  }

  return (
    <View style={[StyleSheet.absoluteFill, styles.solidGlass]}>
      <LinearGradient
        pointerEvents="none"
        colors={['rgba(10, 12, 20, 0.63)', 'rgba(10, 12, 20, 0.55)', 'rgba(10, 12, 20, 0.50)']}
        locations={[0, 0.45, 1]}
        style={StyleSheet.absoluteFill}
      />
      <View pointerEvents="none" style={styles.sheen} />
      <View pointerEvents="none" style={styles.rim} />
    </View>
  );
}

const styles = StyleSheet.create({
  layer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 20,
    elevation: 20,
  },
  material: {
    ...StyleSheet.absoluteFill,
    overflow: 'hidden',
  },
  content: {
    paddingBottom: spacing.xs,
  },
  /** Browsers without backdrop-filter — same fallback as the CSS recipe. */
  solidGlass: {
    backgroundColor: 'rgba(10, 12, 20, 1)',
  },
  sheen: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(255, 255, 255, 0.066)',
    opacity: 0.55,
  },
  rim: {
    ...StyleSheet.absoluteFill,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255, 255, 255, 0.07)',
    borderTopColor: 'rgba(255, 255, 255, 0.096)',
    borderBottomColor: 'rgba(255, 255, 255, 0.06)',
  },
});
