import { create } from 'zustand';
import { COUNTRIES } from '@/data/countries';

/** In-memory create-account values. Account Setup writes birthday and
 * country; Create An Account reads them so date of birth can stay locked. */
export interface SignupDraft {
  monthIndex: number;
  day: string;
  year: string;
  country: string;
  setMonthIndex: (monthIndex: number) => void;
  setDay: (day: string) => void;
  setYear: (year: string) => void;
  setCountry: (country: string) => void;
}

export const SIGNUP_DRAFT_DEFAULTS = {
  monthIndex: 0,
  day: '',
  year: '',
  country: COUNTRIES[0],
} as const;

export const useSignupDraft = create<SignupDraft>((set) => ({
  ...SIGNUP_DRAFT_DEFAULTS,
  setMonthIndex: (monthIndex) => set({ monthIndex }),
  setDay: (day) => set({ day }),
  setYear: (year) => set({ year }),
  setCountry: (country) => set({ country }),
}));

export function resetSignupDraft() {
  useSignupDraft.setState({ ...SIGNUP_DRAFT_DEFAULTS });
}
