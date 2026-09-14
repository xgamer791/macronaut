/** The 1080 × 2340 loop is full-screen portrait footage, not a banner.
 * Retain at least 1620 vertical source pixels so the moving subjects stay
 * in frame. Short screens scroll instead of squashing the video and CTAs;
 * wide screens show a centered portrait canvas instead of zooming into it.
 * Poster, playing video and native/error stills share the same top anchor. */
export const WELCOME_MAX_WIDTH = 600;
export const WELCOME_OBJECT_POSITION = '50% 0%';
export const WELCOME_IMAGE_POSITION = { left: '50%', top: '0%' } as const;
export const WELCOME_SCRIM = 'rgba(0,0,0,0.55)';

/** Only authentication screens use these colors; the signed-in app stays light. */
export const welcomeColors = {
  background: 'transparent',
  textPrimary: '#FFFFFF',
  textSecondary: '#F0F2F5',
  textMuted: '#D8DDE3',
  surface: 'rgba(15,22,28,0.65)',
  border: 'rgba(255,255,255,0.3)',
  borderStrong: 'rgba(255,255,255,0.65)',
};

export function getWelcomeLayout(viewportWidth: number, viewportHeight: number) {
  const width = Math.min(
    viewportWidth,
    WELCOME_MAX_WIDTH,
    viewportWidth > WELCOME_MAX_WIDTH ? viewportHeight * (2 / 3) : viewportWidth,
  );
  return { width, minHeight: Math.max(viewportHeight, width * 1.5, 520) };
}
