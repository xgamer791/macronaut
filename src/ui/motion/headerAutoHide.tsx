import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  type LayoutChangeEvent,
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
import { HEADER_HIDE_TOP, headerHideForScroll } from './headerAutoHideLogic';

/** Same curve as friends-feed / stack slides. */
export const HEADER_HIDE_DURATION_MS = SLIDE_DURATION_MS;
export {
  HEADER_HIDE_COMMIT,
  HEADER_HIDE_DELTA,
  HEADER_HIDE_TOP,
  headerHideForScroll,
} from './headerAutoHideLogic';

export function useHeaderScrollHide(enabled: boolean) {
  const [hidden, setHidden] = useState(false);
  const lastY = useRef(0);
  const hiddenRef = useRef(false);

  const onScroll = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      if (!enabled) return;
      const y = e.nativeEvent.contentOffset.y;
      // Rubber-band samples are not page scroll — leave lastY and hide state alone.
      if (y < HEADER_HIDE_TOP) return;
      const next = headerHideForScroll(y, lastY.current, hiddenRef.current);
      lastY.current = y;
      if (next === hiddenRef.current) return;
      hiddenRef.current = next;
      setHidden(next);
    },
    [enabled],
  );

  return { hidden, onScroll };
}

/**
 * One slab that floats over the scroll layer and only ever translates. It is
 * out of flow on purpose: collapsing chrome inside the layout resizes the
 * scroll view mid-gesture, and the browser and iOS then rewrite scrollTop
 * under the finger, which is what made the page jolt. The page reserves the
 * same space with fixed padding instead, so hiding the header never moves a
 * single pixel of content.
 */
export function AutoHideHeader({
  hidden,
  floating = true,
  onHeight,
  children,
}: {
  hidden: boolean;
  /**
   * Lift the slab out of flow. Pages leave this off until they know the
   * height, so the first frame is laid out by the slab itself rather than by
   * a reserved band that is still zero.
   */
  floating?: boolean;
  /** Reports the slab height so the page can reserve that space. */
  onHeight?: (height: number) => void;
  children: React.ReactNode;
}) {
  if (Platform.OS === 'web') {
    return (
      <AutoHideHeaderWeb hidden={hidden} floating={floating} onHeight={onHeight}>
        {children}
      </AutoHideHeaderWeb>
    );
  }
  return (
    <AutoHideHeaderNative hidden={hidden} floating={floating} onHeight={onHeight}>
      {children}
    </AutoHideHeaderNative>
  );
}

function useMeasuredHeight(onHeight?: (height: number) => void) {
  const [height, setHeight] = useState(0);
  const measured = useRef(0);

  const onLayout = useCallback(
    (e: LayoutChangeEvent) => {
      const next = Math.round(e.nativeEvent.layout.height);
      if (next <= 0 || next === measured.current) return;
      measured.current = next;
      setHeight(next);
      onHeight?.(next);
    },
    [onHeight],
  );

  return { height, onLayout };
}

function AutoHideHeaderWeb({
  hidden,
  floating,
  onHeight,
  children,
}: {
  hidden: boolean;
  floating: boolean;
  onHeight?: (height: number) => void;
  children: React.ReactNode;
}) {
  const { onLayout } = useMeasuredHeight(onHeight);

  return (
    <View
      {...{ dataSet: { headerhide: hidden ? 'out' : 'in' } }}
      pointerEvents={hidden ? 'none' : 'auto'}
      style={[styles.slab, floating ? styles.floating : null]}
      onLayout={onLayout}
    >
      {children}
    </View>
  );
}

function AutoHideHeaderNative({
  hidden,
  floating,
  onHeight,
  children,
}: {
  hidden: boolean;
  floating: boolean;
  onHeight?: (height: number) => void;
  children: React.ReactNode;
}) {
  const { height, onLayout } = useMeasuredHeight(onHeight);
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withTiming(hidden ? 1 : 0, {
      duration: HEADER_HIDE_DURATION_MS,
      easing: SLIDE_EASING,
      reduceMotion: ReduceMotion.System,
    });
  }, [hidden, progress]);

  const slabStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: -progress.value * (height || 0) }],
  }));

  return (
    <Animated.View
      style={[styles.slab, floating ? styles.floating : null, slabStyle]}
      pointerEvents={hidden ? 'none' : 'auto'}
      onLayout={onLayout}
    >
      {children}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  slab: {
    flexShrink: 0,
    zIndex: 20,
  },
  floating: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
  },
});
