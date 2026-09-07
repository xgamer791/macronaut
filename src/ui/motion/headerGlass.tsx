import React, { createContext, useContext } from 'react';
import { makeMutable, SharedValue } from 'react-native-reanimated';

/** Constant 1.0 shared value — a glass header outside a scrolling Screen is
 * always fully materialised, because nothing can ever scroll under it. */
const SETTLED = makeMutable(1);

const HeaderGlassContext = createContext<SharedValue<number> | null>(null);

/**
 * How far the page scrolls, in points, before the header glass is fully
 * poured. Short enough that a flick lands on solid glass, long enough that
 * the first few points of a drag read as a fade rather than a switch.
 */
export const HEADER_GLASS_TRAVEL = 64;

/** Publishes a screen's scroll progress to the glass header floating over it. */
export function HeaderGlassProvider({
  progress,
  children,
}: {
  progress: SharedValue<number>;
  children: React.ReactNode;
}) {
  return <HeaderGlassContext.Provider value={progress}>{children}</HeaderGlassContext.Provider>;
}

/** Shared 0..1 header glass progress — 1 when outside a provider. */
export function useHeaderGlassProgress(): SharedValue<number> {
  return useContext(HeaderGlassContext) ?? SETTLED;
}
