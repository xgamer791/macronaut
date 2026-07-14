import { create } from 'zustand';

/** Pages that already played their bar entrance this app session. */
interface BarEntranceState {
  played: Set<string>;
  markPlayed: (pageKey: string) => void;
}

export const useBarEntranceStore = create<BarEntranceState>((set) => ({
  played: new Set(),
  markPlayed: (pageKey) =>
    set((s) => {
      if (s.played.has(pageKey)) return s;
      const next = new Set(s.played);
      next.add(pageKey);
      return { played: next };
    }),
}));

/** Test helpers — clear / inspect session flags. */
export function resetBarEntranceForTests(): void {
  useBarEntranceStore.setState({ played: new Set() });
}

export function hasBarEntrancePlayedForTests(pageKey: string): boolean {
  return useBarEntranceStore.getState().played.has(pageKey);
}

export function markBarEntrancePlayedForTests(pageKey: string): void {
  useBarEntranceStore.getState().markPlayed(pageKey);
}
