import { daysInMonth, isValidSignupBirthday, MONTHS } from '@/domain/signupAccount';

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
