import { COUNTRIES } from '@/data/countries';
import { resetSignupDraft, useSignupDraft } from '@/state/signupDraft';

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
    const { setMonthIndex, setDay, setYear, setCountry } = useSignupDraft.getState();
    setMonthIndex(5);
    setDay('15');
    setYear('1990');
    setCountry('Canada');

    const draft = useSignupDraft.getState();
    expect(draft.monthIndex).toBe(5);
    expect(draft.day).toBe('15');
    expect(draft.year).toBe('1990');
    expect(draft.country).toBe('Canada');
  });

  it('resets to the empty defaults', () => {
    useSignupDraft.getState().setDay('9');
    resetSignupDraft();
    expect(useSignupDraft.getState().day).toBe('');
    expect(useSignupDraft.getState().country).toBe('United States');
  });
});
