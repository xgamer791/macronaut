import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  Platform,
  StyleSheet,
  View,
} from 'react-native';
import Animated, {
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { SLIDE_DURATION_MS, SLIDE_EASING } from './SlideScreen';
import { headerHideForScroll } from './headerAutoHideLogic';

/** Same curve as friends-feed / stack slides. */
export const HEADER_HIDE_DURATION_MS = SLIDE_DURATION_MS;
export { HEADER_HIDE_DELTA, HEADER_HIDE_TOP, headerHideForScroll } from './headerAutoHideLogic';

export function useHeaderScrollHide(enabled: boolean) {
  const [hidden, setHidden] = useState(false);
  const lastY = useRef(0);
  const hiddenRef = useRef(false);

  const onScroll = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      if (!enabled) return;
      const y = e.nativeEvent.contentOffset.y;
      const next = headerHideForScroll(y, lastY.current, hiddenRef.current);
      lastY.current = y;
      if (next === hiddenRef.current) return;
      hiddenRef.current = next;
      setHidden(next);
    },
    [enabled],
  );

  useEffect(() => {
    if (enabled) return;
    lastY.current = 0;
    if (!hiddenRef.current) return;
    hiddenRef.current = false;
    setHidden(false);
  }, [enabled]);

  return { hidden, onScroll };
}

/** One slab — bar fill and icons share a single translate. Negative margin
 * gives the page the space back without a second motion on the children. */
export function AutoHideHeader({
  hidden,
  children,
}: {
  hidden: boolean;
  children: React.ReactNode;
}) {
  if (Platform.OS === 'web') {
    return <AutoHideHeaderWeb hidden={hidden}>{children}</AutoHideHeaderWeb>;
  }
  return <AutoHideHeaderNative hidden={hidden}>{children}</AutoHideHeaderNative>;
}

function AutoHideHeaderWeb({
  hidden,
  children,
}: {
  hidden: boolean;
  children: React.ReactNode;
}) {
  const [height, setHeight] = useState(0);

  return (
    <View
      {...{ dataSet: { headerhide: hidden ? 'out' : 'in' } }}
      pointerEvents={hidden ? 'none' : 'auto'}
      style={[styles.slab, height > 0 ? { marginBottom: hidden ? -height : 0 } : null]}
    >
      <View
        onLayout={(e) => {
          const next = Math.round(e.nativeEvent.layout.height);
          if (next > 0) setHeight(next);
        }}
      >
        {children}
      </View>
    </View>
  );
}

function AutoHideHeaderNative({
  hidden,
  children,
}: {
  hidden: boolean;
  children: React.ReactNode;
}) {
  const [height, setHeight] = useState(0);
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withTiming(hidden ? 1 : 0, {
      duration: HEADER_HIDE_DURATION_MS,
      easing: SLIDE_EASING,
      reduceMotion: ReduceMotion.System,
    });
  }, [hidden, progress]);

  const slabStyle = useAnimatedStyle(() => {
    const offset = -progress.value * (height || 0);
    return {
      transform: [{ translateY: offset }],
      marginBottom: offset,
    };
  });

  return (
    <Animated.View style={[styles.slab, slabStyle]} pointerEvents={hidden ? 'none' : 'auto'}>
      <View
        onLayout={(e) => {
          const next = Math.round(e.nativeEvent.layout.height);
          if (next > 0) setHeight(next);
        }}
      >
        {children}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  slab: {
    flexShrink: 0,
    zIndex: 20,
  },
});
