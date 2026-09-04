import {
  ageFromBirthdayIso,
  daysInMonth,
  formatBirthdayIso,
  isValidSignupBirthday,
  MONTHS,
  signupBirthdayIso,
} from '@/domain/signupAccount';

describe('signup account birthday', () => {
  it('lists twelve months', () => {
    expect(MONTHS).toHaveLength(12);
    expect(MONTHS[0]).toBe('January');
    expect(MONTHS[11]).toBe('December');
  });

  it('counts days in month, including leap years', () => {
    expect(daysInMonth(1, 2024)).toBe(29);
    expect(daysInMonth(1, 2023)).toBe(28);
    expect(daysInMonth(0, 2024)).toBe(31);
  });

  it('rejects incomplete or impossible dates', () => {
    expect(isValidSignupBirthday(0, '', '1990')).toBe(false);
    expect(isValidSignupBirthday(0, '15', '90')).toBe(false);
    expect(isValidSignupBirthday(1, '31', '2000')).toBe(false);
    expect(isValidSignupBirthday(0, '1', '1899')).toBe(false);
  });

  it('rejects anyone under 13', () => {
    const now = new Date();
    const year = String(now.getFullYear() - 10);
    expect(isValidSignupBirthday(0, '1', year)).toBe(false);
  });

  it('accepts an adult birthday', () => {
    expect(isValidSignupBirthday(0, '15', '1990')).toBe(true);
  });
});

describe('the birthday the account stores', () => {
  it('is one zero-padded ISO date, whatever the three fields hold', () => {
    expect(signupBirthdayIso(7, '4', '1992')).toBe('1992-08-04');
    expect(signupBirthdayIso(0, '15', '1990')).toBe('1990-01-15');
    expect(signupBirthdayIso(11, '31', '2000')).toBe('2000-12-31');
  });

  it('reads back as an age, so nobody types theirs twice', () => {
    expect(ageFromBirthdayIso('1990-08-14', new Date(2026, 7, 13))).toBe(35);
    expect(ageFromBirthdayIso('1990-08-14', new Date(2026, 7, 14))).toBe(36);
    expect(ageFromBirthdayIso(undefined)).toBeUndefined();
    expect(ageFromBirthdayIso('not a date')).toBeUndefined();
  });

  it('reads back as a date a person recognises', () => {
    expect(formatBirthdayIso('1990-08-04')).toBe('August 4, 1990');
    expect(formatBirthdayIso('nonsense')).toBe('nonsense');
  });
});
