import React, { createContext, useContext, useEffect } from 'react';
import {
  Easing,
  makeMutable,
  SharedValue,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useBarEntranceStore } from './barEntranceStore';

/** Constant 1.0 shared value when a screen has no entrance provider. */
const FULL = makeMutable(1);

const BarEntranceContext = createContext<SharedValue<number> | null>(null);

const ENTRANCE_MS = 900;
const ENTRANCE_EASING = Easing.out(Easing.cubic);

/**
 * Plays a 0→1 bar fill once per `pageKey` for the lifetime of the JS app
 * session. Remounts / revisits after the first play stay at full.
 */
export function useBarEntrance(pageKey: string): SharedValue<number> {
  const alreadyPlayed = useBarEntranceStore((s) => s.played.has(pageKey));
  const markPlayed = useBarEntranceStore((s) => s.markPlayed);
  const progress = useSharedValue(alreadyPlayed ? 1 : 0);

  useEffect(() => {
    if (alreadyPlayed) {
      progress.value = 1;
      return;
    }
    progress.value = 0;
    progress.value = withTiming(1, { duration: ENTRANCE_MS, easing: ENTRANCE_EASING });
    markPlayed(pageKey);
  }, [alreadyPlayed, markPlayed, pageKey, progress]);

  return progress;
}

/** Wrap a screen so ProgressRing / Macro* / BarChart animate together. */
export function BarEntranceProvider({
  pageKey,
  children,
}: {
  pageKey: string;
  children: React.ReactNode;
}) {
  const progress = useBarEntrance(pageKey);
  return <BarEntranceContext.Provider value={progress}>{children}</BarEntranceContext.Provider>;
}

/** Shared 0..1 entrance progress — 1 when outside a provider. */
export function useBarEntranceProgress(): SharedValue<number> {
  return useContext(BarEntranceContext) ?? FULL;
}

export {
  hasBarEntrancePlayedForTests,
  markBarEntrancePlayedForTests,
  resetBarEntranceForTests,
} from './barEntranceStore';
