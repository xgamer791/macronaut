import React from 'react';
import { Platform, StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import { GlassView, isGlassEffectAPIAvailable } from 'expo-glass-effect';
import { spacing } from '@/ui/theme/tokens';

const GLASS_RADIUS = 22;
/** Same stroke on every side — avoid hairline + top highlight stacking. */
const GLASS_BORDER = 1;
const GLASS_BORDER_COLOR = 'rgba(255, 255, 255, 0.14)';

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
 * Uniform 1px rim on all sides (no thicker top highlight).
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
        tintColor="rgba(12, 16, 20, 0.45)"
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
        {
          backdropFilter: 'blur(40px) saturate(180%)',
          WebkitBackdropFilter: 'blur(40px) saturate(180%)',
        } as object,
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
    borderTopWidth: GLASS_BORDER,
    borderRightWidth: GLASS_BORDER,
    borderBottomWidth: GLASS_BORDER,
    borderLeftWidth: GLASS_BORDER,
    borderColor: GLASS_BORDER_COLOR,
    backgroundColor: 'rgba(22, 28, 34, 0.42)',
    shadowColor: '#000',
    shadowOpacity: 0.28,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 10 },
    elevation: 12,
  },
  glassFill: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
  },
  inner: {
    position: 'relative',
    zIndex: 1,
  },
});
