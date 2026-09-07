import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import Animated, {
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { SLIDE_DURATION_MS, SLIDE_EASING } from './slideTiming';

/** How far, and along which axis, a layer has been shoved aside. */
export type SlideOffset = { x?: number; y?: number };

type Layer = (offset: SlideOffset) => void;

/**
 * Anything that slides in pushes the page aside rather than covering it, and
 * pulls it back on the way out. The page and the panel travel as one strip.
 *
 * The layers live in one module-level stack rather than in React context,
 * because context cannot express what is needed here: a screen and the panel
 * that slides over it are *siblings* under the navigator, not ancestor and
 * descendant, so a panel looking upward through the tree never finds the page
 * it is covering. Mount order is navigation order, and overlays close in the
 * order they opened, so the top of this stack is always the layer directly
 * beneath whatever is opening.
 */
const layers: Layer[] = [];

function registerLayer(layer: Layer): () => void {
  layers.push(layer);
  return () => {
    const at = layers.indexOf(layer);
    if (at >= 0) layers.splice(at, 1);
  };
}

function topLayer(): Layer | null {
  return layers[layers.length - 1] ?? null;
}

/**
 * The layer to push, captured while rendering — before this panel's own layer
 * can register and make itself the answer. For a panel that hosts a layer of
 * its own; anything else wants {@link usePushWhileOpen}.
 */
export function useLayerBelow(): Layer | null {
  return useState(topLayer)[0];
}

/**
 * Pushes the page aside for as long as `open`, by `offset`, and releases it
 * after. The layer is resolved when the overlay opens rather than when it
 * mounts: a sheet inside a panel is mounted with the page, long before the
 * panel it belongs to has registered.
 */
export function usePushWhileOpen(open: boolean, offset: SlideOffset): void {
  const { x = 0, y = 0 } = offset;

  useEffect(() => {
    if (!open) return;
    const layer = topLayer();
    layer?.({ x, y });
    return () => layer?.({});
  }, [open, x, y]);
}

/**
 * Marks content that a slide-out should push aside. Every layer that can have
 * something open over it — the tab shell, and each panel, since panels open
 * panels — wraps itself in one of these.
 */
export function SlidePushLayer({ children }: { children: React.ReactNode }) {
  const [offset, setOffset] = useState<SlideOffset>({});
  // Stable, so registering does not churn as the page it wraps re-renders.
  const push = useCallback<Layer>((next) => setOffset(next), []);

  useEffect(() => registerLayer(push), [push]);

  const x = offset.x ?? 0;
  const y = offset.y ?? 0;

  return Platform.OS === 'web' ? (
    <PushedWeb x={x} y={y}>
      {children}
    </PushedWeb>
  ) : (
    <PushedNative x={x} y={y}>
      {children}
    </PushedNative>
  );
}

/** The web moves it with the same CSS transition the panel uses, so the page
 * and the panel are driven by one curve rather than two clocks. */
function PushedWeb({ x, y, children }: { x: number; y: number; children: React.ReactNode }) {
  return (
    <View
      // RN-web turns dataSet into data-* attributes for the CSS transition.
      {...{ dataSet: { slidepush: 'true' } }}
      style={[styles.layer, { transform: [{ translateX: x }, { translateY: y }] }]}
    >
      {children}
    </View>
  );
}

function PushedNative({ x, y, children }: { x: number; y: number; children: React.ReactNode }) {
  const shiftX = useSharedValue(x);
  const shiftY = useSharedValue(y);
  const timing = useMemo(
    () => ({
      duration: SLIDE_DURATION_MS,
      easing: SLIDE_EASING,
      reduceMotion: ReduceMotion.System,
    }),
    [],
  );

  // Only when the target actually moves. Assigning during render would restart
  // the timing on every unrelated re-render of the page being pushed.
  useEffect(() => {
    shiftX.value = withTiming(x, timing);
    shiftY.value = withTiming(y, timing);
  }, [x, y, shiftX, shiftY, timing]);

  const style = useAnimatedStyle(() => ({
    transform: [{ translateX: shiftX.value }, { translateY: shiftY.value }],
  }));

  return <Animated.View style={[styles.layer, style]}>{children}</Animated.View>;
}

const styles = StyleSheet.create({
  layer: {
    flex: 1,
    // The page leaves the screen entirely; without this the web grows a
    // scrollbar for the part that has gone.
    overflow: 'hidden',
  },
});
