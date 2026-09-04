/** Welcome splash is a source-level check, same as loginOrder — no renderer. */
import fs from 'node:fs';
import path from 'node:path';
import { welcomeFlowSegment } from '@/ui/welcomeFlow';

const appDir = path.join(__dirname, '..');
const read = (file: string) => fs.readFileSync(path.join(appDir, file), 'utf8');

const PHOTOS = ['01-lift.jpg', '02-jog.jpg', '03-meal.jpg', '04-yoga.jpg', '05-bench.jpg'];

describe('welcome splash', () => {
  it('registers welcome outside the signed-in tab group', () => {
    expect(fs.existsSync(path.join(appDir, 'welcome.tsx'))).toBe(true);
    expect(read('_layout.tsx')).toContain('name="welcome"');
    expect(fs.existsSync(path.join(appDir, '(tabs)', 'welcome.tsx'))).toBe(false);
  });

  it('sends signed-out tab visitors to the splash', () => {
    expect(read('(tabs)/_layout.tsx')).toContain('href="/welcome"');
    expect(read('(tabs)/_layout.tsx')).not.toContain('href="/login"');
  });

  it('sends Create Account to the legal gate and leaves Sign In inert', () => {
    const source = read('welcome.tsx');
    expect(source).toContain('Create Account');
    expect(source).toContain('Sign In');
    expect(source).toContain('More options');
    expect(source).toContain('href="/signup-legal"');
    expect(source).not.toContain('/login');
    expect(source).not.toContain('/create-account');
    expect(source).toContain('<WelcomeCta label="Sign In" onPress={() => {}} />');
  });

  it('ships five distinct athlete photos and opens on the jog, not the squat', () => {
    const dir = path.join(appDir, '../../assets/images/welcome');
    const files = fs
      .readdirSync(dir)
      .filter((f) => f.endsWith('.jpg'))
      .sort();
    expect(files).toEqual(PHOTOS);
    const source = fs.readFileSync(path.join(appDir, '../ui/welcomePhotos.ts'), 'utf8');
    for (const file of PHOTOS) {
      expect(source).toContain(file);
    }
    const order = [...source.matchAll(/welcome\/(\d{2}-[a-z]+)\.jpg/g)].map((m) => m[1]);
    expect(order[0]).toBe('02-jog');
    expect(order).toContain('01-lift');
    expect(order[0]).not.toBe('01-lift');
    expect(source).toContain('SESSION_WELCOME_INDEX = 0');
  });

  it('does not reuse Garmin branding or the login glass card', () => {
    const source = read('welcome.tsx');
    expect(source).not.toContain('AuthShell');
    expect(source).not.toContain('AuthBrand');
    expect(source).not.toContain('ProviderButtons');
    expect(source).not.toContain('backdropFilter');
  });

  it('plays a muted Seedance loop on web and keeps the stills as fallback', () => {
    const welcome = read('welcome.tsx');
    const layout = read('_layout.tsx');
    const flow = fs.readFileSync(path.join(appDir, '../ui/welcomeFlow.ts'), 'utf8');
    const web = fs.readFileSync(path.join(appDir, '../ui/WelcomeBackground.web.tsx'), 'utf8');
    const native = fs.readFileSync(path.join(appDir, '../ui/WelcomeBackground.tsx'), 'utf8');
    const slideshow = fs.readFileSync(path.join(appDir, '../ui/WelcomeSlideshow.tsx'), 'utf8');
    const videoDir = path.join(appDir, '../../assets/video');
    expect(layout).toContain('PersistentWelcomeBackground');
    expect(flow).toContain("'/welcome'");
    expect(flow).toContain("'/signup-legal'");
    expect(flow).toContain("'/signup-account'");
    expect(welcome).toContain('WelcomeCta');
    expect(fs.existsSync(path.join(videoDir, 'welcome-loop.mp4'))).toBe(true);
    expect(fs.existsSync(path.join(videoDir, 'welcome-poster.jpg'))).toBe(true);
    expect(web).toContain("createElement('video')");
    expect(web).toContain('video.muted = true');
    expect(web).toContain('video.loop = true');
    expect(web).toContain("pointerEvents: 'none'");
    expect(web).toContain('sharedVideo');
    expect(web).toContain('acquireWelcomeVideo');
    expect(web).not.toContain("removeAttribute('src')");
    expect(web).toContain('WelcomeSlideshow');
    expect(native).toContain('WelcomeSlideshow as WelcomeBackground');
    expect(welcome).toContain('veilFilm');
    expect(welcome).toContain('rgba(0,0,0,0.50)');
    const cta = fs.readFileSync(path.join(appDir, '../ui/WelcomeCta.tsx'), 'utf8');
    expect(cta).toContain('radius.md');
    expect(cta).toContain('palette.accent');
    expect(cta).toContain('fonts.display');
    expect(cta).toContain('fontSize: 17');
    expect(cta).toContain('router.push(href)');
    expect(slideshow).toContain('Animated.timing');
    expect(slideshow).toContain('WELCOME_PHOTO_FADE_MS');
    expect(slideshow).toContain('WELCOME_PHOTO_HOLD_MS');
  });

  it('keeps one welcome video across create-account screens', () => {
    expect(read('_layout.tsx')).toContain('PersistentWelcomeBackground');
    expect(read('welcome.tsx')).not.toContain('WelcomeBackground');
    expect(read('signup-legal.tsx')).not.toContain('WelcomeBackground');
    expect(read('signup-account.tsx')).not.toContain('WelcomeBackground');
    expect(welcomeFlowSegment('/welcome')).toBe('/welcome');
    expect(welcomeFlowSegment('/signup-legal')).toBe('/signup-legal');
    expect(welcomeFlowSegment('/signup-account')).toBe('/signup-account');
    expect(welcomeFlowSegment('/macronaut/signup-legal')).toBe('/signup-legal');
  });
});
