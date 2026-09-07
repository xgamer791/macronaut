import React, {
  createContext,
  useCallback,
  useContext,
  useLayoutEffect,
  useMemo,
  useState,
} from 'react';
import { Platform, StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, {
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { pushOffset, type SlideSide } from './slidePushLogic';
import { SLIDE_DURATION_MS, SLIDE_EASING } from './slideTokens';

export type { SlideSide } from './slidePushLogic';
export { pushOffset, slideLayerTranslate } from './slidePushLogic';

type PageLayer = { id: number; from: SlideSide; open: boolean };
export type DrawerPush = { width: number; open: boolean };

type Dispatch = {
  register: (id: number, from: SlideSide) => void;
  setOpen: (id: number, open: boolean) => void;
  unregister: (id: number) => void;
  setDrawer: (next: DrawerPush | null) => void;
};

const StateCtx = createContext<{ layers: PageLayer[]; drawer: DrawerPush | null }>({
  layers: [],
  drawer: null,
});
const DispatchCtx = createContext<Dispatch | null>(null);
const NestedCtx = createContext(false);

let nextLayerId = 1;

export function SlidePushProvider({ children }: { children: React.ReactNode }) {
  const [layers, setLayers] = useState<PageLayer[]>([]);
  const [drawer, setDrawer] = useState<DrawerPush | null>(null);
  const dispatch = useMemo<Dispatch>(
    () => ({
      register(id, from) {
        setLayers((prev) => [...prev, { id, from, open: false }]);
      },
      setOpen(id, open) {
        setLayers((prev) => prev.map((layer) => (layer.id === id ? { ...layer, open } : layer)));
      },
      unregister(id) {
        setLayers((prev) => prev.filter((layer) => layer.id !== id));
      },
      setDrawer,
    }),
    [],
  );

  return (
    <DispatchCtx.Provider value={dispatch}>
      <StateCtx.Provider value={{ layers, drawer }}>{children}</StateCtx.Provider>
    </DispatchCtx.Provider>
  );
}

export function useSlideLayer(from: SlideSide) {
  const dispatch = useContext(DispatchCtx);
  const { layers } = useContext(StateCtx);
  const [id] = useState(() => nextLayerId++);

  if (!dispatch) {
    throw new Error('useSlideLayer must be used inside SlidePushProvider');
  }

  useLayoutEffect(() => {
    dispatch.register(id, from);
    return () => dispatch.unregister(id);
  }, [dispatch, from, id]);

  const setOpen = useCallback(
    (open: boolean) => {
      dispatch.setOpen(id, open);
    },
    [dispatch, id],
  );

  const index = layers.findIndex((layer) => layer.id === id);
  const self = index >= 0 ? layers[index] : undefined;
  const above = index >= 0 ? (layers[index + 1] ?? null) : null;

  return { open: self?.open ?? false, above, setOpen };
}

const noopDrawer = (_next: DrawerPush | null) => {};

export function useSetDrawerPush() {
  const dispatch = useContext(DispatchCtx);
  return dispatch?.setDrawer ?? noopDrawer;
}

/** Ignore push-base wrappers inside a slide panel so the panel does not shove itself. */
export function SlidePushNested({ children }: { children: React.ReactNode }) {
  return <NestedCtx.Provider value={true}>{children}</NestedCtx.Provider>;
}

export function SlidePushable({ children }: { children: React.ReactNode }) {
  const nested = useContext(NestedCtx);
  if (nested) return <>{children}</>;
  return (
    <SlidePushNested>
      <SlidePushableView>{children}</SlidePushableView>
    </SlidePushNested>
  );
}

function SlidePushableView({ children }: { children: React.ReactNode }) {
  const { layers, drawer } = useContext(StateCtx);
  const { width } = useWindowDimensions();
  const screenW = width > 0 ? width : typeof window !== 'undefined' ? window.innerWidth : 390;
  const first = layers[0];
  const tx =
    drawer?.open ? drawer.width : first?.open ? pushOffset(first.from, screenW) : 0;

  if (Platform.OS === 'web') {
    return (
      <View
        {...{ dataSet: { slidebase: '' } }}
        style={[styles.base, { transform: [{ translateX: tx }] }]}
      >
        {children}
      </View>
    );
  }

  return <SlidePushableNative tx={tx}>{children}</SlidePushableNative>;
}

function SlidePushableNative({ tx, children }: { tx: number; children: React.ReactNode }) {
  const progress = useSharedValue(tx);

  useLayoutEffect(() => {
    progress.value = withTiming(tx, {
      duration: SLIDE_DURATION_MS,
      easing: SLIDE_EASING,
      reduceMotion: ReduceMotion.System,
    });
  }, [progress, tx]);

  const style = useAnimatedStyle(() => ({
    transform: [{ translateX: progress.value }],
  }));

  return <Animated.View style={[styles.base, style]}>{children}</Animated.View>;
}

const styles = StyleSheet.create({
  base: {
    flex: 1,
    overflow: 'hidden',
  },
});
