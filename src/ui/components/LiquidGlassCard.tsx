import React from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { GlassView, isGlassEffectAPIAvailable } from 'expo-glass-effect';
import { spacing } from '@/ui/theme/tokens';

const GLASS_RADIUS = 24;

/** Black translucent liquid-glass surface — native GlassView on iOS 26+, CSS blur elsewhere. */
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
        tintColor="rgba(0, 0, 0, 0.55)"
        colorScheme="dark"
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
    borderColor: 'rgba(255, 255, 255, 0.18)',
  },
  glassWeb: {
    borderRadius: GLASS_RADIUS,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.16)',
    backgroundColor: 'rgba(8, 10, 14, 0.78)',
    shadowColor: '#000',
    shadowOpacity: 0.5,
    shadowRadius: 32,
    shadowOffset: { width: 0, height: 18 },
    elevation: 24,
  },
  glassFill: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0, 0, 0, 0.22)',
  },
  glassSheen: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
  },
  glassHighlight: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.28)',
  },
  inner: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    paddingBottom: spacing.lg,
  },
});
