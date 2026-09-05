import { create } from 'zustand';
import { COUNTRIES } from '@/data/countries';
import { isValidSignupBirthday } from '@/domain/signupAccount';

/** In-memory + session create-account values. Account Setup commits
 * birthday and country on Continue; Create An Account reads them so date
 * of birth can stay filled and locked after a remount. */
export interface SignupDraftValues {
  monthIndex: number;
  day: string;
  year: string;
  country: string;
}

export interface SignupDraft extends SignupDraftValues {
  /** Set while a newly created account moves through Apple Health and
   * onboarding, so route guards keep that in-progress signup on its path. */
  signupComplete: boolean;
  setMonthIndex: (monthIndex: number) => void;
  setDay: (day: string) => void;
  setYear: (year: string) => void;
  setCountry: (country: string) => void;
}

export const SIGNUP_DRAFT_STORAGE_KEY = 'macronaut-signup-draft';
export const SIGNUP_COMPLETE_STORAGE_KEY = 'macronaut-signup-complete';

export const SIGNUP_DRAFT_DEFAULTS: SignupDraftValues = {
  monthIndex: 0,
  day: '',
  year: '',
  country: COUNTRIES[0],
};

function readSignupCompleteFlag(): boolean {
  try {
    return getStorage().getItem(SIGNUP_COMPLETE_STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

export type SignupDraftRouteParams = {
  month?: string | string[];
  day?: string | string[];
  year?: string | string[];
  country?: string | string[];
};

const memoryStorage = new Map<string, string>();

function firstParam(value?: string | string[]): string | undefined {
  if (Array.isArray(value)) return value[0];
  return value;
}

function getStorage(): {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
  removeItem: (key: string) => void;
} {
  try {
    if (typeof sessionStorage !== 'undefined') return sessionStorage;
  } catch {
    /* private mode */
  }
  return {
    getItem: (key) => memoryStorage.get(key) ?? null,
    setItem: (key, value) => {
      memoryStorage.set(key, value);
    },
    removeItem: (key) => {
      memoryStorage.delete(key);
    },
  };
}

export function valuesFromRoute(params: SignupDraftRouteParams): SignupDraftValues | null {
  const month = firstParam(params.month);
  const day = firstParam(params.day);
  const year = firstParam(params.year);
  const countryRaw = firstParam(params.country);
  if (month == null || day == null || year == null) return null;
  const monthIndex = Number(month);
  if (!Number.isInteger(monthIndex) || monthIndex < 0 || monthIndex > 11) return null;
  if (!/^\d{1,2}$/.test(day) || !/^\d{4}$/.test(year)) return null;
  const country =
    countryRaw && (COUNTRIES as readonly string[]).includes(countryRaw)
      ? countryRaw
      : COUNTRIES[0];
  return { monthIndex, day, year, country };
}

export function parseSignupDraftValues(input: unknown): SignupDraftValues | null {
  if (!input || typeof input !== 'object') return null;
  const rec = input as Record<string, unknown>;
  return valuesFromRoute({
    month: rec.monthIndex != null ? String(rec.monthIndex) : undefined,
    day: typeof rec.day === 'string' ? rec.day : undefined,
    year: typeof rec.year === 'string' ? rec.year : undefined,
    country: typeof rec.country === 'string' ? rec.country : undefined,
  });
}

function writeStoredDraft(values: SignupDraftValues) {
  getStorage().setItem(SIGNUP_DRAFT_STORAGE_KEY, JSON.stringify(values));
}

export function readStoredDraft(): SignupDraftValues | null {
  try {
    const raw = getStorage().getItem(SIGNUP_DRAFT_STORAGE_KEY);
    if (!raw) return null;
    const parsed = parseSignupDraftValues(JSON.parse(raw));
    if (!parsed) return null;
    if (!isValidSignupBirthday(parsed.monthIndex, parsed.day, parsed.year)) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function saveSignupDraftValues(values: SignupDraftValues) {
  useSignupDraft.setState(values);
  writeStoredDraft(values);
}

export function applySignupDraftFromRoute(params: SignupDraftRouteParams): boolean {
  const values = valuesFromRoute(params);
  if (!values || !isValidSignupBirthday(values.monthIndex, values.day, values.year)) {
    return false;
  }
  saveSignupDraftValues(values);
  return true;
}

export function hydrateSignupDraftFromStorage(): boolean {
  const stored = readStoredDraft();
  if (!stored) return false;
  useSignupDraft.setState(stored);
  return true;
}

function bootDraft(): SignupDraftValues {
  if (typeof window !== 'undefined') {
    try {
      const query = new URLSearchParams(window.location.search);
      const fromUrl = valuesFromRoute({
        month: query.get('month') ?? undefined,
        day: query.get('day') ?? undefined,
        year: query.get('year') ?? undefined,
        country: query.get('country') ?? undefined,
      });
      if (fromUrl && isValidSignupBirthday(fromUrl.monthIndex, fromUrl.day, fromUrl.year)) {
        writeStoredDraft(fromUrl);
        return fromUrl;
      }
    } catch {
      /* ignore */
    }
  }
  return readStoredDraft() ?? { ...SIGNUP_DRAFT_DEFAULTS };
}

/** Called before the account is created, so no render between the new session
 * arriving and the next screen can bounce the flow into onboarding. */
export function markSignupComplete() {
  getStorage().setItem(SIGNUP_COMPLETE_STORAGE_KEY, '1');
  useSignupDraft.setState({ signupComplete: true });
}

/** The account was not created after all. */
export function clearSignupComplete() {
  getStorage().removeItem(SIGNUP_COMPLETE_STORAGE_KEY);
  useSignupDraft.setState({ signupComplete: false });
}

export const useSignupDraft = create<SignupDraft>((set) => ({
  ...bootDraft(),
  signupComplete: readSignupCompleteFlag(),
  setMonthIndex: (monthIndex) =>
    set((state) => {
      const next = { ...pickValues(state), monthIndex };
      writeStoredDraft(next);
      return { monthIndex };
    }),
  setDay: (day) =>
    set((state) => {
      const next = { ...pickValues(state), day };
      writeStoredDraft(next);
      return { day };
    }),
  setYear: (year) =>
    set((state) => {
      const next = { ...pickValues(state), year };
      writeStoredDraft(next);
      return { year };
    }),
  setCountry: (country) =>
    set((state) => {
      const next = { ...pickValues(state), country };
      writeStoredDraft(next);
      return { country };
    }),
}));

function pickValues(state: SignupDraftValues): SignupDraftValues {
  return {
    monthIndex: state.monthIndex,
    day: state.day,
    year: state.year,
    country: state.country,
  };
}

export function resetSignupDraft() {
  memoryStorage.delete(SIGNUP_DRAFT_STORAGE_KEY);
  memoryStorage.delete(SIGNUP_COMPLETE_STORAGE_KEY);
  try {
    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.removeItem(SIGNUP_DRAFT_STORAGE_KEY);
      sessionStorage.removeItem(SIGNUP_COMPLETE_STORAGE_KEY);
    }
  } catch {
    /* ignore */
  }
  useSignupDraft.setState({ ...SIGNUP_DRAFT_DEFAULTS, signupComplete: false });
}
