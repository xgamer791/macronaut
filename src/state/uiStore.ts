import { create } from 'zustand';
import { DayKey, todayKey } from '@/utils/date';

interface UiState {
  /** Date the Diary (and add flows) operate on. */
  selectedDate: DayKey;
  setSelectedDate: (date: DayKey) => void;
  /** Meal preselected when opening an add flow from a meal section. */
  targetMeal: string;
  setTargetMeal: (meal: string) => void;
  /** Multi-select state for diary bulk actions. */
  selectedEntryIds: Set<string>;
  toggleEntrySelected: (id: string) => void;
  clearSelection: () => void;
}

export const useUiStore = create<UiState>((set) => ({
  selectedDate: todayKey(),
  setSelectedDate: (date) => set({ selectedDate: date }),
  targetMeal: 'breakfast',
  setTargetMeal: (meal) => set({ targetMeal: meal }),
  selectedEntryIds: new Set<string>(),
  toggleEntrySelected: (id) =>
    set((s) => {
      const next = new Set(s.selectedEntryIds);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return { selectedEntryIds: next };
    }),
  clearSelection: () => set({ selectedEntryIds: new Set() }),
}));
