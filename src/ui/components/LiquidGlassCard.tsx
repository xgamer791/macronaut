import React from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { GlassView, isGlassEffectAPIAvailable } from 'expo-glass-effect';
import { spacing } from '@/ui/theme/tokens';

const GLASS_RADIUS = 24;

/** Light frosted surface — native GlassView on iOS 26+, CSS blur elsewhere. */
export function LiquidGlassCard({
  children,
  contentStyle,
}: {
  children: React.ReactNode;
  contentStyle?: object;
}) {
  const useNativeGlass = Platform.OS === 'ios' && isGlassEffectAPIAvailable();

  if (useNativeGlass) {
    return (
      <GlassView
        glassEffectStyle="regular"
        tintColor="rgba(255, 255, 255, 0.72)"
        colorScheme="light"
        style={styles.glassNative}
      >
        <View style={[styles.inner, contentStyle]}>{children}</View>
      </GlassView>
    );
  }

  return (
    <View
      style={[
        styles.glassWeb,
        {
          backdropFilter: 'blur(48px) saturate(165%)',
          WebkitBackdropFilter: 'blur(48px) saturate(165%)',
        } as object,
      ]}
    >
      <View pointerEvents="none" style={styles.glassFill} />
      <View pointerEvents="none" style={styles.glassSheen} />
      <View pointerEvents="none" style={styles.glassHighlight} />
      <View style={[styles.inner, contentStyle]}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  glassNative: {
    borderRadius: GLASS_RADIUS,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(20, 24, 29, 0.08)',
  },
  glassWeb: {
    borderRadius: GLASS_RADIUS,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(20, 24, 29, 0.08)',
    backgroundColor: 'rgba(255, 255, 255, 0.88)',
    shadowColor: '#14181D',
    shadowOpacity: 0.08,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 10 },
    elevation: 8,
  },
  glassFill: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(255, 255, 255, 0.55)',
  },
  glassSheen: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
  },
  glassHighlight: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.72)',
  },
  inner: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    paddingBottom: spacing.lg,
  },
});
