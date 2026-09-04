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

/** The form's three fields as the one ISO `YYYY-MM-DD` the account stores. */
export function signupBirthdayIso(monthIndex: number, dayText: string, yearText: string): string {
  const month = String(monthIndex + 1).padStart(2, '0');
  const day = dayText.padStart(2, '0');
  return `${yearText}-${month}-${day}`;
}

/** A stored `YYYY-MM-DD` as "August 14, 1990". */
export function formatBirthdayIso(birthday: string): string {
  const [year, month, day] = birthday.split('-');
  const name = MONTHS[Number(month) - 1];
  if (!name || !year || !day) return birthday;
  return `${name} ${Number(day)}, ${year}`;
}

/** Age today from a stored `YYYY-MM-DD`, for screens that ask for an age the
 * account already knows. */
export function ageFromBirthdayIso(birthday: string | undefined, today = new Date()): number | undefined {
  if (!birthday || !/^\d{4}-\d{2}-\d{2}$/.test(birthday)) return undefined;
  const [year, month, day] = birthday.split('-').map(Number);
  let age = today.getFullYear() - year;
  const monthIndex = month - 1;
  if (
    today.getMonth() < monthIndex ||
    (today.getMonth() === monthIndex && today.getDate() < day)
  ) {
    age -= 1;
  }
  return age >= 0 ? age : undefined;
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
