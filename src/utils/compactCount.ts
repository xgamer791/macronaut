/** "1.1K followers" — the compact form used on a profile page. Pure so the
 * breakpoints (999 → 1K, 1.1K, 1M) can be tested without a screen. */
export function compactCount(n: number): string {
  if (!Number.isFinite(n) || n < 0) return '0';
  const value = Math.floor(n);
  if (value < 1000) return String(value);
  if (value < 1_000_000) return trimOneDecimal(value / 1000) + 'K';
  return trimOneDecimal(value / 1_000_000) + 'M';
}

function trimOneDecimal(n: number): string {
  const rounded = n >= 10 ? Math.round(n) : Math.round(n * 10) / 10;
  return String(rounded).replace(/\.0$/, '');
}

export function followerLabel(n: number): string {
  return `${compactCount(n)} ${n === 1 ? 'follower' : 'followers'}`;
}

export function followingLabel(n: number): string {
  return `${compactCount(n)} following`;
}

export function postLabel(n: number): string {
  return `${compactCount(n)} ${n === 1 ? 'post' : 'posts'}`;
}

/** The three stats under a profile name, joined the way the reference does. */
export function profileStatLine(followers: number, following: number, posts: number): string {
  return `${followerLabel(followers)} · ${followingLabel(following)} · ${postLabel(posts)}`;
}
