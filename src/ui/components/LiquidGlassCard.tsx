import React from 'react';
import { StyleProp, StyleSheet, ViewStyle } from 'react-native';
import { spacing } from '@/ui/theme/tokens';
import { LiquidGlassSurface } from './LiquidGlassSurface';

/** Black translucent liquid-glass surface — native GlassView on iOS 26+, CSS blur elsewhere. */
export function LiquidGlassCard({
  children,
  contentStyle,
}: {
  children: React.ReactNode;
  contentStyle?: StyleProp<ViewStyle>;
}) {
  return (
    <LiquidGlassSurface variant="card" contentStyle={[styles.inner, contentStyle]}>
      {children}
    </LiquidGlassSurface>
  );
}

const styles = StyleSheet.create({
  inner: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    paddingBottom: spacing.lg,
  },
});
