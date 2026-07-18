import React from 'react';
import { Platform, StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import { GlassView, isGlassEffectAPIAvailable } from 'expo-glass-effect';
import { spacing } from '@/ui/theme/tokens';

const GLASS_RADIUS = 22;
/** Uniform stroke — same width/color on every side. */
const GLASS_BORDER = 1;
const GLASS_BORDER_COLOR = 'rgba(255, 255, 255, 0.18)';

export interface LiquidGlassCardProps {
  children: React.ReactNode;
  /** Styles for the outer glass shell (border radius, margins, etc.). */
  style?: StyleProp<ViewStyle>;
  /** Styles for the inner content wrapper (gap, flexDirection, etc.). */
  contentStyle?: StyleProp<ViewStyle>;
  padded?: boolean;
}

/**
 * Clean liquid-glass surface — native GlassView on iOS 26+, CSS blur elsewhere.
 * Frosted enough to read as glass on black (not a solid grey card), with a
 * uniform 1px rim on all sides.
 */
export function LiquidGlassCard({
  children,
  style,
  contentStyle,
  padded = true,
}: LiquidGlassCardProps) {
  const useNativeGlass = Platform.OS === 'ios' && isGlassEffectAPIAvailable();
  const pad = padded
    ? {
        paddingHorizontal: spacing.lg,
        paddingTop: spacing.lg,
        paddingBottom: spacing.lg,
      }
    : undefined;

  if (useNativeGlass) {
    return (
      <GlassView
        glassEffectStyle="regular"
        tintColor="rgba(255, 255, 255, 0.08)"
        colorScheme="dark"
        style={[styles.glassNative, style]}
      >
        <View style={[styles.inner, pad, contentStyle]}>{children}</View>
      </GlassView>
    );
  }

  return (
    <View
      style={[
        styles.glassWeb,
        Platform.OS === 'web'
          ? ({
              backdropFilter: 'blur(48px) saturate(190%)',
              WebkitBackdropFilter: 'blur(48px) saturate(190%)',
              // Soft frost wash — even across the card, not a thicker top edge.
              backgroundImage:
                'linear-gradient(180deg, rgba(255,255,255,0.09) 0%, rgba(255,255,255,0.05) 100%)',
            } as object)
          : null,
        style,
      ]}
    >
      <View pointerEvents="none" style={styles.glassFill} />
      <View style={[styles.inner, pad, contentStyle]}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  glassNative: {
    borderRadius: GLASS_RADIUS,
    overflow: 'hidden',
    borderWidth: GLASS_BORDER,
    borderColor: GLASS_BORDER_COLOR,
  },
  glassWeb: {
    borderRadius: GLASS_RADIUS,
    overflow: 'hidden',
    borderWidth: GLASS_BORDER,
    borderColor: GLASS_BORDER_COLOR,
    // Lighter translucent frost so it doesn’t collapse to solid #171B20 on black.
    backgroundColor: 'rgba(255, 255, 255, 0.07)',
    shadowColor: '#000',
    shadowOpacity: 0.35,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 12 },
    elevation: 14,
  },
  glassFill: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(28, 34, 42, 0.35)',
  },
  inner: {
    position: 'relative',
    zIndex: 1,
  },
});
