import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useState } from 'react';
import { Animated, Easing, Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { radius, spacing, touchTarget } from '@/ui/theme/tokens';
import { AppText } from './AppText';

const FRAME_RATIO = 0.72;

export interface ScannerOverlayProps {
  /** 'scanning' shows the animated line; 'detected' shows the loader;
   * 'success' plays the confirmation before navigation. */
  state: 'scanning' | 'detected' | 'success';
  torchSupported: boolean;
  torchOn: boolean;
  onToggleTorch: () => void;
  onCancel: () => void;
  hint?: string;
}

/** Production scan chrome: dimmed surround, rounded frame with corner
 * accents, sweeping scan line, flash + cancel controls, detection loader and
 * success animation. Rendered on top of the live ScannerView preview. */
export function ScannerOverlay({
  state,
  torchSupported,
  torchOn,
  onToggleTorch,
  onCancel,
  hint = 'Line the barcode up inside the frame',
}: ScannerOverlayProps) {
  const insets = useSafeAreaInsets();
  const [sweep] = useState(() => new Animated.Value(0));
  const [pop] = useState(() => new Animated.Value(0));

  useEffect(() => {
    if (state === 'scanning') {
      const loop = Animated.loop(
        Animated.sequence([
          Animated.timing(sweep, { toValue: 1, duration: 1600, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
          Animated.timing(sweep, { toValue: 0, duration: 1600, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        ]),
      );
      loop.start();
      return () => loop.stop();
    }
    if (state === 'success') {
      pop.setValue(0);
      Animated.spring(pop, { toValue: 1, friction: 5, tension: 120, useNativeDriver: true }).start();
    }
  }, [state, sweep, pop]);

  const accent = '#1FC98B';
  const corner = (rot: string, pos: object) => (
    <View
      key={rot}
      style={{
        position: 'absolute',
        width: 34,
        height: 34,
        borderColor: accent,
        borderTopWidth: 4,
        borderLeftWidth: 4,
        borderTopLeftRadius: radius.lg,
        transform: [{ rotate: rot }],
        ...pos,
      }}
    />
  );

  return (
    <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} pointerEvents="box-none">
      {/* Top bar */}
      <View
        style={{
          position: 'absolute',
          top: insets.top,
          left: 0,
          right: 0,
          flexDirection: 'row',
          justifyContent: 'space-between',
          paddingHorizontal: spacing.lg,
          zIndex: 3,
        }}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Cancel scanning"
          onPress={onCancel}
          style={{
            width: touchTarget,
            height: touchTarget,
            borderRadius: touchTarget / 2,
            backgroundColor: 'rgba(0,0,0,0.55)',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Ionicons name="close" size={24} color="#fff" />
        </Pressable>
        {torchSupported ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={torchOn ? 'Turn flash off' : 'Turn flash on'}
            accessibilityState={{ selected: torchOn }}
            onPress={onToggleTorch}
            style={{
              width: touchTarget,
              height: touchTarget,
              borderRadius: touchTarget / 2,
              backgroundColor: torchOn ? accent : 'rgba(0,0,0,0.55)',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Ionicons name={torchOn ? 'flash' : 'flash-outline'} size={22} color="#fff" />
          </Pressable>
        ) : (
          <View style={{ width: touchTarget }} />
        )}
      </View>

      {/* Scan frame */}
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }} pointerEvents="none">
        <View
          style={{
            width: `${FRAME_RATIO * 100}%`,
            aspectRatio: 1.45,
            borderRadius: radius.lg,
            overflow: 'hidden',
          }}
        >
          {corner('0deg', { top: 0, left: 0 })}
          {corner('90deg', { top: 0, right: 0 })}
          {corner('270deg', { bottom: 0, left: 0 })}
          {corner('180deg', { bottom: 0, right: 0 })}

          {state === 'scanning' ? (
            <Animated.View
              style={{
                position: 'absolute',
                left: 8,
                right: 8,
                height: 3,
                borderRadius: 2,
                backgroundColor: accent,
                shadowColor: accent,
                shadowOpacity: 0.9,
                shadowRadius: 6,
                transform: [
                  {
                    translateY: sweep.interpolate({
                      inputRange: [0, 1],
                      outputRange: [10, 190],
                    }),
                  },
                ],
              }}
            />
          ) : null}

          {state !== 'scanning' ? (
            <View
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: 'rgba(0,0,0,0.45)',
              }}
            >
              {state === 'detected' ? (
                <AppText variant="body" weight="600" style={{ color: '#fff' }}>
                  Looking up…
                </AppText>
              ) : (
                <Animated.View style={{ transform: [{ scale: pop }] }}>
                  <View
                    style={{
                      width: 64,
                      height: 64,
                      borderRadius: 32,
                      backgroundColor: accent,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Ionicons name="checkmark" size={40} color="#08130E" />
                  </View>
                </Animated.View>
              )}
            </View>
          ) : null}
        </View>
        <AppText variant="caption" style={{ color: '#fff', marginTop: spacing.lg }} align="center">
          {hint}
        </AppText>
      </View>
    </View>
  );
}
