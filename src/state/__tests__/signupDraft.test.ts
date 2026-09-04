import { COUNTRIES } from '@/data/countries';
import {
  applySignupDraftFromRoute,
  readStoredDraft,
  resetSignupDraft,
  saveSignupDraftValues,
  useSignupDraft,
} from '@/state/signupDraft';

describe('signup draft', () => {
  afterEach(() => {
    resetSignupDraft();
  });

  it('starts with January, empty day and year, and United States', () => {
    const draft = useSignupDraft.getState();
    expect(draft.monthIndex).toBe(0);
    expect(draft.day).toBe('');
    expect(draft.year).toBe('');
    expect(draft.country).toBe(COUNTRIES[0]);
    expect(draft.country).toBe('United States');
  });

  it('keeps birthday and country so create-account can read them', () => {
    saveSignupDraftValues({
      monthIndex: 7,
      day: '4',
      year: '1992',
      country: 'Canada',
    });

    const draft = useSignupDraft.getState();
    expect(draft.monthIndex).toBe(7);
    expect(draft.day).toBe('4');
    expect(draft.year).toBe('1992');
    expect(draft.country).toBe('Canada');
    expect(readStoredDraft()).toEqual({
      monthIndex: 7,
      day: '4',
      year: '1992',
      country: 'Canada',
    });
  });

  it('applies a complete birthday from route params', () => {
    expect(
      applySignupDraftFromRoute({
        month: '7',
        day: '4',
        year: '1992',
        country: 'Canada',
      }),
    ).toBe(true);
    expect(useSignupDraft.getState().monthIndex).toBe(7);
    expect(useSignupDraft.getState().day).toBe('4');
    expect(useSignupDraft.getState().year).toBe('1992');
    expect(useSignupDraft.getState().country).toBe('Canada');
  });

  it('ignores incomplete route params so a stored birthday is kept', () => {
    saveSignupDraftValues({
      monthIndex: 7,
      day: '4',
      year: '1992',
      country: 'United States',
    });
    expect(applySignupDraftFromRoute({ month: '7', day: '', year: '' })).toBe(false);
    expect(useSignupDraft.getState().day).toBe('4');
    expect(useSignupDraft.getState().year).toBe('1992');
  });

  it('resets to the empty defaults', () => {
    saveSignupDraftValues({
      monthIndex: 7,
      day: '4',
      year: '1992',
      country: 'Canada',
    });
    resetSignupDraft();
    expect(useSignupDraft.getState().day).toBe('');
    expect(useSignupDraft.getState().country).toBe('United States');
    expect(readStoredDraft()).toBeNull();
  });
});
