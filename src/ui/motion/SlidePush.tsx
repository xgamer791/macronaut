import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import Animated, {
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { SLIDE_DURATION_MS, SLIDE_EASING } from './slideTiming';

/**
 * A slide-out does not cover the page, it pushes it: the two travel together
 * like one filmstrip, and the page is pulled back as the panel leaves.
 *
 * Every layer that can have something slide over it — the tab shell, and each
 * panel, since panels open panels — offers a push slot to whatever mounts
 * above it. `SlideScreen` drives the slot it finds and provides a fresh one to
 * its own children, so the shove travels down the stack one layer at a time
 * and nothing has to know how deep it is.
 */
const SlidePushContext = createContext<((px: number) => void) | null>(null);

/** The layer below this one, to be pushed aside. Null at the very bottom. */
export function useSlidePush(): ((px: number) => void) | null {
  return useContext(SlidePushContext);
}

/**
 * Marks content that a slide-out should push aside, and offers the push slot
 * the panel above it will drive. Layers nest: the panel's own children get a
 * new slot of their own.
 */
export function SlidePushLayer({ children }: { children: React.ReactNode }) {
  const [offset, setOffset] = useState(0);
  // Stable, so a panel's effect does not re-run and re-push on every render
  // of the layer it is shoving.
  const push = useCallback((px: number) => setOffset(px), []);

  return (
    <SlidePushContext.Provider value={push}>
      {Platform.OS === 'web' ? (
        <PushedWeb offset={offset}>{children}</PushedWeb>
      ) : (
        <PushedNative offset={offset}>{children}</PushedNative>
      )}
    </SlidePushContext.Provider>
  );
}

/** The web moves it with the same CSS transition the panel uses, so the page
 * and the panel are driven by one curve rather than two clocks. */
function PushedWeb({ offset, children }: { offset: number; children: React.ReactNode }) {
  return (
    <View
      // RN-web turns dataSet into data-* attributes for the CSS transition.
      {...{ dataSet: { slidepush: 'true' } }}
      style={[styles.layer, { transform: [{ translateX: offset }] }]}
    >
      {children}
    </View>
  );
}

function PushedNative({ offset, children }: { offset: number; children: React.ReactNode }) {
  const shift = useSharedValue(offset);

  // Only when the target actually moves. Assigning during render would restart
  // the timing on every unrelated re-render of the page being pushed.
  useEffect(() => {
    shift.value = withTiming(offset, {
      duration: SLIDE_DURATION_MS,
      easing: SLIDE_EASING,
      reduceMotion: ReduceMotion.System,
    });
  }, [offset, shift]);

  const style = useAnimatedStyle(() => ({ transform: [{ translateX: shift.value }] }));

  return <Animated.View style={[styles.layer, style]}>{children}</Animated.View>;
}

const styles = StyleSheet.create({
  layer: {
    flex: 1,
    // The page leaves the screen entirely; without this the web grows a
    // horizontal scrollbar for the part that has gone.
    overflow: 'hidden',
  },
});
