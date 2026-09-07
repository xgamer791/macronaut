/** "Just now", "4h", "3d" — the timestamp under a profile post. Pure so the
 * boundaries are testable; anything older than a week falls back to a date,
 * because "63d" tells nobody anything. */
export function relativeTime(iso: string, now: Date = new Date()): string {
  const then = new Date(iso);
  const ms = then.getTime();
  if (Number.isNaN(ms)) return '';

  const seconds = Math.floor((now.getTime() - ms) / 1000);
  if (seconds < 60) return 'Just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;

  const sameYear = then.getFullYear() === now.getFullYear();
  return then.toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    ...(sameYear ? {} : { year: 'numeric' }),
  });
}

/** "Jun 2" — the date on a photo overlay. Always the calendar day, not a
 * relative phrase, so a shared screenshot stays readable later. */
export function shortDate(iso: string): string {
  const then = new Date(iso);
  if (Number.isNaN(then.getTime())) return '';
  return then.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}
