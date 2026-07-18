/** Time-of-day greeting for the Today header. */
export function greetingForHour(hour: number = new Date().getHours()): string {
  if (hour >= 5 && hour < 12) return 'Good morning';
  if (hour >= 12 && hour < 17) return 'Good afternoon';
  if (hour >= 17 && hour < 22) return 'Good evening';
  return 'Good night';
}

export function displayFirstName(raw?: string | null): string {
  const trimmed = (raw ?? '').trim();
  if (!trimmed) return 'Athlete';
  return trimmed.split(/\s+/)[0]!;
}
