export const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
] as const;

export function daysInMonth(monthIndex: number, year: number): number {
  return new Date(year, monthIndex + 1, 0).getDate();
}

/** Privacy policy: not directed at children under 13. */
export function isValidSignupBirthday(
  monthIndex: number,
  dayText: string,
  yearText: string,
): boolean {
  if (!Number.isInteger(monthIndex) || monthIndex < 0 || monthIndex > 11) return false;
  if (!/^\d{1,2}$/.test(dayText) || !/^\d{4}$/.test(yearText)) return false;
  const day = Number(dayText);
  const year = Number(yearText);
  if (year < 1900) return false;
  const dim = daysInMonth(monthIndex, year);
  if (day < 1 || day > dim) return false;

  const today = new Date();
  let age = today.getFullYear() - year;
  if (today.getMonth() < monthIndex || (today.getMonth() === monthIndex && today.getDate() < day)) {
    age -= 1;
  }
  return age >= 13;
}
