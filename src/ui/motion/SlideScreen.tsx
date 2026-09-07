import React, { createContext, useCallback, useContext, useLayoutEffect, useRef, useState } from 'react';
import { Platform, StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, {
  Easing,
  ReduceMotion,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useRouter } from 'expo-router';

import { goBackOrHome } from '@/utils/navigation';
import { useTheme } from '@/ui/theme/ThemeProvider';

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

export const SLIDE_EASING = Easing.bezier(0.22, 1, 0.36, 1);
export const SLIDE_DURATION_MS = 420;

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

export function SlideScreen({
  from,
  children,
}: {
  from: Side;
  children: React.ReactNode;
}) {
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

  useLayoutEffect(() => {
    let second = 0;
    const first = requestAnimationFrame(() => {
      second = requestAnimationFrame(() => setOpen(true));
    });
    return () => {
      cancelAnimationFrame(first);
      cancelAnimationFrame(second);
    };
  }, []);

  const leave = useCallback(() => {
    if (leaving.current) return;
    leaving.current = true;
    setOpen(false);
    const reduce =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    window.setTimeout(() => goBackOrHome(router), reduce ? 0 : SLIDE_DURATION_MS);
  }, [router]);

  const dir = from === 'right' ? 1 : -1;
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
          {children}
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

  useLayoutEffect(() => {
    progress.value = withTiming(1, {
      duration: SLIDE_DURATION_MS,
      easing: SLIDE_EASING,
      reduceMotion: ReduceMotion.System,
    });
  }, [progress]);

  const finish = useCallback(() => {
    goBackOrHome(router);
  }, [router]);

  const leave = useCallback(() => {
    if (leaving.current) return;
    leaving.current = true;
    // Reanimated shared values are mutated on purpose to drive the slide-out.
    // eslint-disable-next-line react-hooks/immutability -- SharedValue setter
    progress.value = withTiming(
      0,
      { duration: SLIDE_DURATION_MS, easing: SLIDE_EASING, reduceMotion: ReduceMotion.System },
      (finished) => {
        if (finished) runOnJS(finish)();
      },
    );
  }, [finish, progress]);

  const style = useAnimatedStyle(() => {
    const dir = from === 'right' ? 1 : -1;
    return {
      transform: [{ translateX: (1 - progress.value) * dir * width }],
    };
  });

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
          {children}
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
