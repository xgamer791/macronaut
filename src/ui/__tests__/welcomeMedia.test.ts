import fs from 'node:fs';
import path from 'node:path';
import {
  getWelcomeLayout,
  WELCOME_IMAGE_POSITION,
  WELCOME_MAX_WIDTH,
  WELCOME_OBJECT_POSITION,
} from '../welcomeMedia';

const read = (file: string) => fs.readFileSync(path.join(__dirname, '..', file), 'utf8');

describe('welcome media framing', () => {
  it('anchors every media layer at the top, not at the portrait frame midpoint', () => {
    expect(WELCOME_OBJECT_POSITION).toBe('50% 0%');
    expect(WELCOME_IMAGE_POSITION).toEqual({ left: '50%', top: '0%' });
    const web = read('WelcomeBackground.web.tsx');
    expect(web).toContain('objectPosition: WELCOME_OBJECT_POSITION');
    expect(web).toContain('contentPosition={WELCOME_IMAGE_POSITION}');
    const stills = read('WelcomeSlideshow.tsx');
    expect(stills.match(/contentPosition=\{WELCOME_IMAGE_POSITION\}/g)).toHaveLength(2);
  });

  it('keeps full-screen media behind scrollable content instead of in a shallow band', () => {
    const welcome = read('../app/welcome.tsx');
    expect(welcome).toContain('getWelcomeLayout(width, height)');
    expect(welcome).toContain('minHeight: layout.minHeight');
    expect(welcome).not.toContain('styles.hero');
    expect(welcome).toContain('<ScrollView');
    expect(welcome).toContain('contentContainerStyle={styles.scrollContent}');
    expect(welcome).not.toMatch(/height:\s*['"]\d+%['"]/);
    expect(WELCOME_MAX_WIDTH).toBeLessThanOrEqual(600);
  });

  it.each([
    [320, 480],
    [375, 548],
    [390, 664],
    [430, 742],
    [430, 620],
    [430, 820],
    [844, 390],
    [768, 1024],
    [1366, 768],
  ])(
    'preserves the portrait composition at %i × %i without gaps',
    (viewportWidth, viewportHeight) => {
      const { width, minHeight: height } = getWelcomeLayout(viewportWidth, viewportHeight);
      const sourceWidth = 1080;
      const sourceHeight = 2340;
      const scale = Math.max(width / sourceWidth, height / sourceHeight);
      const visibleSourceHeight = height / scale;
      expect(visibleSourceHeight).toBeGreaterThanOrEqual(1620 - 0.001);
      expect(width).toBeLessThanOrEqual(Math.min(viewportWidth, WELCOME_MAX_WIDTH));
      expect(height).toBeGreaterThanOrEqual(viewportHeight);
      expect(sourceWidth * scale).toBeGreaterThanOrEqual(width);
      expect(sourceHeight * scale).toBeGreaterThanOrEqual(height);
    },
  );
});
