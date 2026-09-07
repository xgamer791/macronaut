import React from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { spacing } from '@/ui/theme/tokens';

export interface GlassHeaderBarProps {
  children: React.ReactNode;
  /** Horizontal padding around the row, so a page keeps its own alignment. */
  inset?: number;
}

/**
 * A full-bleed navigation bar pinned above a `Screen`'s scroll layer.
 *
 * The 2025–26 liquid-glass slab is always painted. Fading it with opacity
 * flattens backdrop-filter into a solid strip, which is why the previous
 * pour-in looked like a flat charcoal bar.
 */
export function GlassHeaderBar({ children, inset = spacing.sm }: GlassHeaderBarProps) {
  const insets = useSafeAreaInsets();

  return (
    <View style={styles.layer}>
      <View pointerEvents="none" style={styles.material}>
        <GlassMaterial />
      </View>
      <View style={[styles.content, { paddingTop: insets.top + 2, paddingHorizontal: inset }]}>
        {children}
      </View>
    </View>
  );
}

/** A real `div.glass` on web so the CSS recipe can attach. RN Views drop className. */
function GlassMaterial() {
  if (Platform.OS === 'web') {
    return React.createElement('div', {
      className: 'glass',
      'data-headerglass': 'true',
      style: {
        position: 'absolute',
        top: 0,
        right: 0,
        bottom: 0,
        left: 0,
      },
    });
  }

  return (
    <View style={[StyleSheet.absoluteFill, styles.nativeGlass]}>
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
  },
  content: {
    paddingBottom: spacing.xs,
  },
  nativeGlass: {
    borderRadius: 0,
    overflow: 'hidden',
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
  },
  sheen: {
    ...StyleSheet.absoluteFill,
    opacity: 0,
  },
  rim: {
    ...StyleSheet.absoluteFill,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'transparent',
    borderBottomColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 0,
  },
});
