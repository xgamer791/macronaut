import React, { useEffect, useState } from 'react';
import { Animated, Easing, StyleSheet } from 'react-native';
import Svg, { Circle, Path, Rect } from 'react-native-svg';
import { palette } from '@/ui/theme/tokens';

const SIZE = 148;

/** Original watch mark — a slow breathe plus a sweeping tick on the face. */
export function WatchConnectMark() {
  const [breathe] = useState(() => new Animated.Value(0));
  const [sweep] = useState(() => new Animated.Value(0));
  const [pulse] = useState(() => new Animated.Value(0));

  useEffect(() => {
    const breatheLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(breathe, {
          toValue: 1,
          duration: 1800,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(breathe, {
          toValue: 0,
          duration: 1800,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
    );
    const sweepLoop = Animated.loop(
      Animated.timing(sweep, {
        toValue: 1,
        duration: 10000,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    );
    const pulseLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 900,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0,
          duration: 1400,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
    );
    breatheLoop.start();
    sweepLoop.start();
    pulseLoop.start();
    return () => {
      breatheLoop.stop();
      sweepLoop.stop();
      pulseLoop.stop();
    };
  }, [breathe, pulse, sweep]);

  const scale = breathe.interpolate({ inputRange: [0, 1], outputRange: [1, 1.04] });
  const rotate = sweep.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });
  const waveOpacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.35, 1] });

  return (
    <Animated.View
      style={[styles.stage, { transform: [{ scale }] }]}
      importantForAccessibility="no-hide-descendants"
    >
      <Svg width={SIZE} height={SIZE} viewBox="0 0 120 140">
        <Rect x="50" y="8" width="20" height="16" rx="3" fill="none" stroke="#FFFFFF" strokeWidth="2" />
        <Rect x="50" y="116" width="20" height="16" rx="3" fill="none" stroke="#FFFFFF" strokeWidth="2" />
        <Rect x="36" y="22" width="48" height="96" rx="16" fill="none" stroke="#FFFFFF" strokeWidth="2.2" />
        <Rect x="84" y="58" width="8" height="16" rx="2" fill="none" stroke="#FFFFFF" strokeWidth="2" />
        <Circle cx="60" cy="70" r="22" fill="none" stroke="rgba(255,255,255,0.35)" strokeWidth="1.5" />
      </Svg>
      <Animated.View
        pointerEvents="none"
        style={[styles.overlay, { transform: [{ rotate }] }]}
      >
        <Svg width={SIZE} height={SIZE} viewBox="0 0 120 140">
          <Circle
            cx="60"
            cy="70"
            r="22"
            fill="none"
            stroke={palette.accent}
            strokeWidth="2.6"
            strokeLinecap="round"
            strokeDasharray="18 200"
          />
        </Svg>
      </Animated.View>
      <Animated.View pointerEvents="none" style={[styles.overlay, { opacity: waveOpacity }]}>
        <Svg width={SIZE} height={SIZE} viewBox="0 0 120 140">
          <Path
            d="M44 70 H52 L56 58 L62 82 L66 70 H76"
            fill="none"
            stroke={palette.accent}
            strokeWidth="2.2"
            strokeLinecap="square"
            strokeLinejoin="miter"
          />
        </Svg>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  stage: {
    width: SIZE,
    height: SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  overlay: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
