import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import { Platform, StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, {
  ReduceMotion,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useRouter } from 'expo-router';

import { goBackOrHome } from '@/utils/navigation';
import { useTheme } from '@/ui/theme/ThemeProvider';
import { SlidePushLayer, useLayerBelow } from './SlidePush';
import { SLIDE_DURATION_MS, SLIDE_EASING } from './slideTiming';

type Side = 'left' | 'right';

const SlideDismissContext = createContext<(() => void) | null>(null);

export function useSlideDismiss() {
  return useContext(SlideDismissContext);
}

/** Back that plays the slide-out when this screen is wrapped, otherwise the ordinary pop. */
export function useSlideBack() {
  const router = useRouter();
  const dismiss = useSlideDismiss();
  return useCallback(() => {
    if (dismiss) dismiss();
    else goBackOrHome(router);
  }, [dismiss, router]);
}

export { SLIDE_DURATION_MS, SLIDE_EASING } from './slideTiming';

export const SLIDE_OVER_OPTIONS = {
  headerShown: false,
  animation: 'none',
  presentation: 'transparentModal',
  contentStyle: { backgroundColor: 'transparent' },
  gestureEnabled: false,
} as const;

function useSlideWidth() {
  const { width } = useWindowDimensions();
  if (width > 0) return width;
  if (typeof window !== 'undefined') return window.innerWidth;
  return 390;
}

export function SlideScreen({ from, children }: { from: Side; children: React.ReactNode }) {
  if (Platform.OS === 'web') {
    return <SlideScreenWeb from={from}>{children}</SlideScreenWeb>;
  }
  return <SlideScreenNative from={from}>{children}</SlideScreenNative>;
}

function SlideScreenWeb({ from, children }: { from: Side; children: React.ReactNode }) {
  const width = useSlideWidth();
  const router = useRouter();
  const { colors } = useTheme();
  const [open, setOpen] = useState(false);
  const leaving = useRef(false);
  const pushBelow = useLayerBelow();
  const dir = from === 'right' ? 1 : -1;

  useLayoutEffect(() => {
    let second = 0;
    const first = requestAnimationFrame(() => {
      second = requestAnimationFrame(() => {
        setOpen(true);
        // The page underneath leaves by exactly the width this panel takes,
        // on the same frame, so the pair reads as one strip rather than two
        // things that happen to move at once.
        pushBelow?.({ x: -dir * width });
      });
    });
    return () => {
      cancelAnimationFrame(first);
      cancelAnimationFrame(second);
    };
  }, [dir, pushBelow, width]);

  // Dismissing is not the only way out: browser back, a hardware back, or a
  // deep link all drop this panel without ever running `leave`, and the page
  // would stay shoved off to one side for good.
  useEffect(() => () => pushBelow?.({}), [pushBelow]);

  const leave = useCallback(() => {
    if (leaving.current) return;
    leaving.current = true;
    setOpen(false);
    pushBelow?.({});
    const reduce =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    window.setTimeout(() => goBackOrHome(router), reduce ? 0 : SLIDE_DURATION_MS);
  }, [pushBelow, router]);

  const translateX = open ? 0 : dir * width;

  return (
    <SlideDismissContext.Provider value={leave}>
      <View style={styles.clip}>
        <View
          // RN-web turns dataSet into data-* attributes for the CSS transition.
          {...{ dataSet: { slidescreen: from } }}
          style={[
            styles.panel,
            { backgroundColor: colors.background, transform: [{ translateX }] },
            from === 'right' ? styles.fromRight : styles.fromLeft,
          ]}
        >
          <SlidePushLayer>{children}</SlidePushLayer>
        </View>
      </View>
    </SlideDismissContext.Provider>
  );
}

function SlideScreenNative({ from, children }: { from: Side; children: React.ReactNode }) {
  const width = useSlideWidth();
  const router = useRouter();
  const { colors } = useTheme();
  const progress = useSharedValue(0);
  const leaving = useRef(false);
  const pushBelow = useLayerBelow();
  const dir = from === 'right' ? 1 : -1;

  useLayoutEffect(() => {
    progress.value = withTiming(1, {
      duration: SLIDE_DURATION_MS,
      easing: SLIDE_EASING,
      reduceMotion: ReduceMotion.System,
    });
    // Same distance, same curve, same moment as the panel's own entrance.
    pushBelow?.({ x: -dir * width });
  }, [dir, progress, pushBelow, width]);

  // As on the web: a back gesture or a hardware back unmounts this without
  // ever running `leave`, and the page must still be let go.
  useEffect(() => () => pushBelow?.({}), [pushBelow]);

  const finish = useCallback(() => {
    goBackOrHome(router);
  }, [router]);

  const leave = useCallback(() => {
    if (leaving.current) return;
    leaving.current = true;
    pushBelow?.({});
    // Reanimated shared values are mutated on purpose to drive the slide-out.
    // eslint-disable-next-line react-hooks/immutability -- SharedValue setter
    progress.value = withTiming(
      0,
      { duration: SLIDE_DURATION_MS, easing: SLIDE_EASING, reduceMotion: ReduceMotion.System },
      (finished) => {
        if (finished) runOnJS(finish)();
      },
    );
  }, [finish, progress, pushBelow]);

  const style = useAnimatedStyle(() => ({
    transform: [{ translateX: (1 - progress.value) * dir * width }],
  }));

  return (
    <SlideDismissContext.Provider value={leave}>
      <View style={styles.clip}>
        <Animated.View
          style={[
            styles.panel,
            { backgroundColor: colors.background },
            from === 'right' ? styles.fromRight : styles.fromLeft,
            style,
          ]}
        >
          <SlidePushLayer>{children}</SlidePushLayer>
        </Animated.View>
      </View>
    </SlideDismissContext.Provider>
  );
}

const styles = StyleSheet.create({
  clip: {
    flex: 1,
    overflow: 'hidden',
    backgroundColor: 'transparent',
  },
  panel: {
    flex: 1,
  },
  fromRight: {
    ...Platform.select({
      web: { boxShadow: '-12px 0 28px rgba(0,0,0,0.35)' } as object,
      default: {
        shadowColor: '#000',
        shadowOffset: { width: -10, height: 0 },
        shadowOpacity: 0.38,
        shadowRadius: 18,
        elevation: 16,
      },
    }),
  },
  fromLeft: {
    ...Platform.select({
      web: { boxShadow: '12px 0 28px rgba(0,0,0,0.35)' } as object,
      default: {
        shadowColor: '#000',
        shadowOffset: { width: 10, height: 0 },
        shadowOpacity: 0.38,
        shadowRadius: 18,
        elevation: 16,
      },
    }),
  },
});
