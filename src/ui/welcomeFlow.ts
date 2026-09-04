/** Last path segment so /macronaut/welcome and /welcome match the same screen. */
export function welcomeFlowSegment(pathname: string): string {
  const trimmed = pathname.replace(/\/+$/, '') || '/';
  const slash = trimmed.lastIndexOf('/');
  return trimmed.slice(slash);
}

/** Create-account screens that should show the video. */
export const WELCOME_VIDEO_SHOW = ['/welcome', '/signup-legal', '/signup-account'] as const;

/** Stay mounted (hidden) on the legal docs so a side trip does not restart it. */
export const WELCOME_VIDEO_KEEP = [...WELCOME_VIDEO_SHOW, '/terms', '/privacy'] as const;
