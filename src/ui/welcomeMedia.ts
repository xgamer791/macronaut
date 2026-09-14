/** The 1080 × 2340 loop is full-screen portrait footage, not a banner.
 * Retain at least 1620 vertical source pixels so the moving subjects stay
 * in frame. Short screens scroll instead of squashing the video and CTAs;
 * wide screens show a centered portrait canvas instead of zooming into it.
 * Poster, playing video and native/error stills share the same top anchor. */
export const WELCOME_MAX_WIDTH = 600;
export const WELCOME_OBJECT_POSITION = '50% 0%';
export const WELCOME_IMAGE_POSITION = { left: '50%', top: '0%' } as const;

export function getWelcomeLayout(viewportWidth: number, viewportHeight: number) {
  const width = Math.min(
    viewportWidth,
    WELCOME_MAX_WIDTH,
    viewportWidth > WELCOME_MAX_WIDTH ? viewportHeight * (2 / 3) : viewportWidth,
  );
  return { width, minHeight: Math.max(viewportHeight, width * 1.5, 520) };
}
