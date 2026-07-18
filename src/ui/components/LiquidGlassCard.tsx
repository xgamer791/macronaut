import React from 'react';
import { Platform, StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import { GlassView, isGlassEffectAPIAvailable } from 'expo-glass-effect';
import { spacing } from '@/ui/theme/tokens';

const GLASS_RADIUS = 22;

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
 * Light fill, thin rim, soft top specular — no muddy overlays.
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
      {/* Soft depth fill */}
      <View pointerEvents="none" style={styles.glassFill} />
      {/* Top specular — liquid glass highlight */}
      <View pointerEvents="none" style={styles.glassHighlight} />
      {/* Gentle bottom fade for depth without mud */}
      <View pointerEvents="none" style={styles.glassDepth} />
      <View style={[styles.inner, pad, contentStyle]}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  glassNative: {
    borderRadius: GLASS_RADIUS,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  glassWeb: {
    borderRadius: GLASS_RADIUS,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255, 255, 255, 0.14)',
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
  glassHighlight: {
    position: 'absolute',
    top: 0,
    left: 12,
    right: 12,
    height: StyleSheet.hairlineWidth * 2,
    borderRadius: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.35)',
  },
  glassDepth: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: '45%',
    backgroundColor: 'rgba(0, 0, 0, 0.12)',
  },
  inner: {
    position: 'relative',
    zIndex: 1,
  },
});
