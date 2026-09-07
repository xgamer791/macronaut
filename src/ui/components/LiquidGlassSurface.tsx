import { GlassView, isGlassEffectAPIAvailable } from 'expo-glass-effect';
import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import { Platform, StyleProp, StyleSheet, View, ViewStyle } from 'react-native';

export type LiquidGlassVariant = 'card' | 'header';

export interface LiquidGlassSurfaceProps {
  children: React.ReactNode;
  variant?: LiquidGlassVariant;
  style?: StyleProp<ViewStyle>;
  contentStyle?: StyleProp<ViewStyle>;
}

/**
 * The shared glass material used throughout the app. iOS 26+ gets Apple's
 * native liquid-glass rendering; web gets real backdrop blur; other platforms
 * retain the same layered tint, highlights and depth.
 */
export function LiquidGlassSurface({
  children,
  variant = 'card',
  style,
  contentStyle,
}: LiquidGlassSurfaceProps) {
  const nativeGlass = Platform.OS === 'ios' && isGlassEffectAPIAvailable();
  const shellStyle = variant === 'header' ? styles.headerShell : styles.cardShell;
  const tint = variant === 'header' ? 'rgba(8, 11, 15, 0.54)' : 'rgba(8, 10, 14, 0.64)';

  const content = (
    <>
      <LinearGradient
        pointerEvents="none"
        colors={[
          'rgba(255,255,255,0.16)',
          'rgba(255,255,255,0.035)',
          'rgba(0,0,0,0.10)',
        ]}
        locations={[0, 0.38, 1]}
        style={StyleSheet.absoluteFill}
      />
      <View pointerEvents="none" style={styles.bloomLeft} />
      <View pointerEvents="none" style={styles.bloomRight} />
      <View pointerEvents="none" style={styles.topHighlight} />
      <View pointerEvents="none" style={styles.bottomShade} />
      <View style={contentStyle}>{children}</View>
    </>
  );

  if (nativeGlass) {
    return (
      <GlassView
        glassEffectStyle="regular"
        tintColor={tint}
        colorScheme="dark"
        style={[styles.shell, shellStyle, style]}
      >
        {content}
      </GlassView>
    );
  }

  return (
    <View
      style={[
        styles.shell,
        shellStyle,
        styles.fallback,
        variant === 'header' ? styles.headerFallback : styles.cardFallback,
        Platform.OS === 'web' ? styles.webBlur : null,
        style,
      ]}
    >
      {content}
    </View>
  );
}

const styles = StyleSheet.create({
  shell: {
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.24)',
  },
  cardShell: { borderRadius: 24 },
  headerShell: { borderRadius: 28 },
  fallback: {
    backgroundColor: 'rgba(9,12,17,0.72)',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 14 },
  },
  cardFallback: {
    shadowOpacity: 0.42,
    shadowRadius: 30,
    elevation: 22,
  },
  headerFallback: {
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 18,
  },
  webBlur: {
    backdropFilter: 'blur(34px) saturate(180%) contrast(108%)',
    WebkitBackdropFilter: 'blur(34px) saturate(180%) contrast(108%)',
  } as ViewStyle,
  bloomLeft: {
    position: 'absolute',
    width: 150,
    height: 90,
    borderRadius: 75,
    left: -72,
    top: -58,
    backgroundColor: 'rgba(180,222,255,0.13)',
    transform: [{ rotate: '-12deg' }],
  },
  bloomRight: {
    position: 'absolute',
    width: 130,
    height: 78,
    borderRadius: 65,
    right: -56,
    bottom: -58,
    backgroundColor: 'rgba(166,255,209,0.07)',
    transform: [{ rotate: '10deg' }],
  },
  topHighlight: {
    position: 'absolute',
    top: 0,
    left: 22,
    right: 22,
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(255,255,255,0.62)',
  },
  bottomShade: {
    position: 'absolute',
    left: 18,
    right: 18,
    bottom: 0,
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
});
