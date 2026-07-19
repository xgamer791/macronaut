/** Time-of-day greeting for the Today header. */
export function greetingForHour(hour: number = new Date().getHours()): string {
  if (hour >= 5 && hour < 12) return 'Good morning';
  if (hour >= 12 && hour < 17) return 'Good afternoon';
  if (hour >= 17 && hour < 22) return 'Good evening';
  return 'Good night';
}

/** First token of the display name, or null when unset (never a fake placeholder). */
export function displayFirstName(raw?: string | null): string | null {
  const trimmed = (raw ?? '').trim();
  if (!trimmed) return null;
  return trimmed.split(/\s+/)[0]!;
}
