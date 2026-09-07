import { GlassView, isGlassEffectAPIAvailable } from 'expo-glass-effect';
import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import { Platform, StyleSheet, View, ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useHeaderGlassProgress } from '@/ui/motion/headerGlass';
import { spacing } from '@/ui/theme/tokens';

/** Soft shadow the glass edge casts onto the content passing beneath it. */
const EDGE_FADE = 10;

/** The material stays dark on every theme: the glyphs it carries are fixed
 * white, because they also have to survive a photo behind them. */
const TINT = 'rgba(8, 11, 16, 0.55)';

export interface GlassHeaderBarProps {
  children: React.ReactNode;
  /** Horizontal padding around the row, so a page keeps its own alignment. */
  inset?: number;
}

/**
 * A full-bleed navigation bar pinned above a `Screen`'s scroll layer.
 *
 * The glass is poured by scrolling. At the top of a page the bar is pure
 * chrome over the hero photo, exactly as if it were painted on it; the
 * material fades in over the first few dozen points of scroll, so the icons
 * keep their contrast once ordinary content starts running underneath.
 *
 * iOS 26 renders Apple's own liquid glass, the web gets a real backdrop blur,
 * and everywhere else falls back to the layered tint the app's other glass
 * surfaces already use.
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

      <Animated.View pointerEvents="none" style={[styles.edge, pour]}>
        <LinearGradient
          colors={['rgba(6, 9, 13, 0.34)', 'rgba(6, 9, 13, 0)']}
          style={StyleSheet.absoluteFill}
        />
      </Animated.View>

      <View style={[styles.content, { paddingTop: insets.top + 2, paddingHorizontal: inset }]}>
        {children}
      </View>
    </View>
  );
}

/** The glass itself: refracting substrate, then the light that plays on it. */
function GlassMaterial() {
  const sheen = (
    <>
      {/* Depth — light gathers along the top edge and drains to the bottom. */}
      <LinearGradient
        pointerEvents="none"
        colors={['rgba(255,255,255,0.10)', 'rgba(255,255,255,0.02)', 'rgba(0,0,0,0.08)']}
        locations={[0, 0.55, 1]}
        style={StyleSheet.absoluteFill}
      />
      {/* A single specular sweep raking across the pane. */}
      <LinearGradient
        pointerEvents="none"
        colors={['rgba(255,255,255,0.09)', 'rgba(255,255,255,0)']}
        locations={[0, 0.62]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      {/* The lit rim where the pane ends, brightest at its centre. */}
      <LinearGradient
        pointerEvents="none"
        colors={['rgba(255,255,255,0)', 'rgba(255,255,255,0.32)', 'rgba(255,255,255,0)']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={styles.rim}
      />
    </>
  );

  if (Platform.OS === 'ios' && isGlassEffectAPIAvailable()) {
    return (
      <GlassView
        glassEffectStyle="regular"
        tintColor={TINT}
        colorScheme="dark"
        style={StyleSheet.absoluteFill}
      >
        {sheen}
      </GlassView>
    );
  }

  return (
    <View
      style={[StyleSheet.absoluteFill, Platform.OS === 'web' ? styles.webGlass : styles.solidGlass]}
    >
      {sheen}
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
  edge: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: -EDGE_FADE,
    height: EDGE_FADE,
  },
  content: {
    paddingBottom: spacing.xs,
  },
  rim: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: StyleSheet.hairlineWidth,
  },
  /** Real refraction: the page behind the bar is blurred and enriched. */
  webGlass: {
    backgroundColor: TINT,
    backdropFilter: 'blur(28px) saturate(180%)',
    WebkitBackdropFilter: 'blur(28px) saturate(180%)',
  } as ViewStyle,
  /** No blur available — carry the same look on an opaque pane instead. */
  solidGlass: {
    backgroundColor: 'rgba(10, 13, 18, 0.88)',
  },
});
