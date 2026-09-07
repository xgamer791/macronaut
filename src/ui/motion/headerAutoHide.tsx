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
import {
  HEADER_HIDE_COMMIT,
  HEADER_HIDE_TOP,
  HEADER_LAYOUT_SETTLE_MS,
  headerHideForScroll,
  headerLayoutHidden,
} from './headerAutoHideLogic';

/** Same curve as friends-feed / stack slides. */
export const HEADER_HIDE_DURATION_MS = SLIDE_DURATION_MS;
export {
  HEADER_HIDE_COMMIT,
  HEADER_HIDE_DELTA,
  HEADER_HIDE_TOP,
  HEADER_LAYOUT_SETTLE_MS,
  headerHideForScroll,
  headerLayoutHidden,
} from './headerAutoHideLogic';

export function useHeaderScrollHide(enabled: boolean) {
  const [hidden, setHidden] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const lastY = useRef(0);
  const hiddenRef = useRef(false);
  const collapsedRef = useRef(false);
  const yRef = useRef(0);
  const settleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearSettle = useCallback(() => {
    if (settleTimer.current != null) {
      clearTimeout(settleTimer.current);
      settleTimer.current = null;
    }
  }, []);

  const applyLayout = useCallback((y: number, visualHidden: boolean, settled: boolean) => {
    const next = headerLayoutHidden(y, visualHidden, collapsedRef.current, settled);
    if (next === collapsedRef.current) return;
    collapsedRef.current = next;
    setCollapsed(next);
  }, []);

  const settleAtTop = useCallback(() => {
    hiddenRef.current = false;
    lastY.current = Math.max(0, yRef.current);
    setHidden(false);
    applyLayout(yRef.current, false, true);
  }, [applyLayout]);

  const onScroll = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      if (!enabled) return;
      const y = e.nativeEvent.contentOffset.y;
      yRef.current = y;
      const next = headerHideForScroll(y, lastY.current, hiddenRef.current);
      lastY.current = Math.max(0, y);
      if (next !== hiddenRef.current) {
        hiddenRef.current = next;
        setHidden(next);
      }

      if (y <= HEADER_HIDE_TOP) {
        clearSettle();
        settleTimer.current = setTimeout(settleAtTop, HEADER_LAYOUT_SETTLE_MS);
        applyLayout(y, next, false);
        return;
      }

      clearSettle();
      if (y > HEADER_HIDE_COMMIT) applyLayout(y, next, false);
    },
    [applyLayout, clearSettle, enabled, settleAtTop],
  );

  const onScrollSettle = useCallback(() => {
    if (!enabled) return;
    clearSettle();
    const y = yRef.current;
    if (y <= HEADER_HIDE_TOP) {
      settleAtTop();
      return;
    }
    applyLayout(y, hiddenRef.current, true);
  }, [applyLayout, clearSettle, enabled, settleAtTop]);

  useEffect(() => () => clearSettle(), [clearSettle]);

  return { hidden, collapsed, onScroll, onScrollSettle };
}

/** One slab — bar fill and icons share a single translate. Negative margin
 * gives the page the space back without a second motion on the children.
 * Layout collapse is deferred near the top so iOS rubber-band is not fighting
 * a 294ms reflow. */
export function AutoHideHeader({
  hidden,
  collapsed = hidden,
  children,
}: {
  hidden: boolean;
  collapsed?: boolean;
  children: React.ReactNode;
}) {
  if (Platform.OS === 'web') {
    return (
      <AutoHideHeaderWeb hidden={hidden} collapsed={collapsed}>
        {children}
      </AutoHideHeaderWeb>
    );
  }
  return (
    <AutoHideHeaderNative hidden={hidden} collapsed={collapsed}>
      {children}
    </AutoHideHeaderNative>
  );
}

function AutoHideHeaderWeb({
  hidden,
  collapsed,
  children,
}: {
  hidden: boolean;
  collapsed: boolean;
  children: React.ReactNode;
}) {
  const [height, setHeight] = useState(0);

  return (
    <View
      {...{ dataSet: { headerhide: hidden ? 'out' : 'in' } }}
      pointerEvents={hidden ? 'none' : 'auto'}
      style={[styles.slab, height > 0 ? { marginBottom: collapsed ? -height : 0 } : null]}
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
  collapsed,
  children,
}: {
  hidden: boolean;
  collapsed: boolean;
  children: React.ReactNode;
}) {
  const [height, setHeight] = useState(0);
  const progress = useSharedValue(0);
  const layout = useSharedValue(0);

  useEffect(() => {
    progress.value = withTiming(hidden ? 1 : 0, {
      duration: HEADER_HIDE_DURATION_MS,
      easing: SLIDE_EASING,
      reduceMotion: ReduceMotion.System,
    });
  }, [hidden, progress]);

  useEffect(() => {
    layout.value = withTiming(collapsed ? 1 : 0, {
      duration: HEADER_HIDE_DURATION_MS,
      easing: SLIDE_EASING,
      reduceMotion: ReduceMotion.System,
    });
  }, [collapsed, layout]);

  const slabStyle = useAnimatedStyle(() => {
    const offset = -progress.value * (height || 0);
    const gap = -layout.value * (height || 0);
    return {
      transform: [{ translateY: offset }],
      marginBottom: gap,
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
