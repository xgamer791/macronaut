import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { spacing } from '@/ui/theme/tokens';
import { LiquidGlassSurface } from './LiquidGlassSurface';

/** A floating navigation surface that stays above the screen's ScrollView. */
export function StickyGlassHeader({ children }: { children: React.ReactNode }) {
  const insets = useSafeAreaInsets();

  return (
    <View pointerEvents="box-none" style={[styles.layer, { top: insets.top + spacing.xs }]}>
      <View style={styles.frame}>
        <LiquidGlassSurface variant="header" contentStyle={styles.content}>
          {children}
        </LiquidGlassSurface>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  layer: {
    position: 'absolute',
    left: 0,
    right: 0,
    zIndex: 100,
    elevation: 30,
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
  },
  frame: {
    width: '100%',
    maxWidth: 720,
  },
  content: { paddingHorizontal: spacing.xs },
});
