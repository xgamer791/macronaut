/** Welcome splash is a source-level check, same as loginOrder — no renderer. */
import fs from 'node:fs';
import path from 'node:path';

const appDir = path.join(__dirname, '..');
const read = (file: string) => fs.readFileSync(path.join(appDir, file), 'utf8');

const PHOTOS = ['01-lift.jpg', '02-jog.jpg', '03-meal.jpg', '04-yoga.jpg', '05-bench.jpg'];

describe('welcome splash', () => {
  it('registers welcome outside the signed-in tab group', () => {
    expect(fs.existsSync(path.join(appDir, 'welcome.tsx'))).toBe(true);
    expect(read('_layout.tsx')).toContain('name="welcome"');
    expect(fs.existsSync(path.join(appDir, '(tabs)', 'welcome.tsx'))).toBe(false);
  });

  it('sends signed-out tab visitors to the splash, and new accounts to the dashboard', () => {
    const tabs = read('(tabs)/_layout.tsx');
    expect(tabs).toContain('href="/welcome"');
    expect(tabs).toContain('if (!signedIn)');
    // A session straight out of create-account keeps the dashboard it was
    // promised instead of being sent to the goal wizard.
    expect(tabs).toContain('signupComplete');
    expect(tabs).not.toContain('href="/login"');
  });

  it('sends Create Account to the legal gate and Sign In to the password form', () => {
    const source = read('welcome.tsx');
    expect(source).toContain('Create Account');
    expect(source).toContain('Sign In');
    expect(source).toContain('More options');
    expect(source).toContain('href="/signup-legal"');
    expect(source).toContain('href="/login"');
    expect(source).not.toContain('/create-account');
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
    const web = fs.readFileSync(path.join(appDir, '../ui/WelcomeBackground.web.tsx'), 'utf8');
    const native = fs.readFileSync(path.join(appDir, '../ui/WelcomeBackground.tsx'), 'utf8');
    const slideshow = fs.readFileSync(path.join(appDir, '../ui/WelcomeSlideshow.tsx'), 'utf8');
    const videoDir = path.join(appDir, '../../assets/video');
    expect(welcome).toContain('WelcomeBackground');
    expect(welcome).toContain('WelcomeCta');
    expect(fs.existsSync(path.join(videoDir, 'welcome-loop.mp4'))).toBe(true);
    expect(fs.existsSync(path.join(videoDir, 'welcome-poster.jpg'))).toBe(true);
    // Poster is the first jog frame on the 1080×2340 phone canvas. A shorter
    // 9:16 plate left a black band under the runner once the splash opened
    // on that clip.
    const poster = fs.readFileSync(path.join(videoDir, 'welcome-poster.jpg'));
    expect(poster[0]).toBe(0xff);
    expect(poster[1]).toBe(0xd8);
    let i = 2;
    let posterW = 0;
    let posterH = 0;
    while (i < poster.length - 8) {
      if (poster[i] !== 0xff) {
        i += 1;
        continue;
      }
      const marker = poster[i + 1];
      if (marker === 0xc0 || marker === 0xc1 || marker === 0xc2) {
        posterH = poster.readUInt16BE(i + 5);
        posterW = poster.readUInt16BE(i + 7);
        break;
      }
      if (marker === 0xd8 || marker === 0xd9) {
        i += 2;
        continue;
      }
      i += 2 + poster.readUInt16BE(i + 2);
    }
    expect(posterW).toBe(1080);
    expect(posterH).toBe(2340);
    expect(web).toContain("createElement('video')");
    expect(web).toContain('video.muted = true');
    expect(web).toContain('video.loop = true');
    expect(web).toContain("pointerEvents: 'none'");
    expect(web).toContain('sharedVideo');
    expect(web).toContain('acquireWelcomeVideo');
    expect(web).toContain('claimHost');
    expect(web).toContain('useFocusEffect');
    expect(web).toContain('resumeWelcomeVideo');
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

  it('puts the video on each create-account screen and reuses one player', () => {
    expect(read('welcome.tsx')).toContain('WelcomeBackground');
    expect(read('signup-legal.tsx')).toContain('WelcomeBackground');
    expect(read('signup-account.tsx')).toContain('WelcomeBackground');
    expect(read('signup-credentials.tsx')).toContain('WelcomeBackground');
    expect(read('signup-health.tsx')).toContain('WelcomeBackground');
    expect(read('_layout.tsx')).not.toContain('PersistentWelcomeBackground');
    const web = fs.readFileSync(path.join(appDir, '../ui/WelcomeBackground.web.tsx'), 'utf8');
    expect(web).toContain('sharedVideo');
    expect(web).toContain('claimHost');
    expect(web).toContain('useFocusEffect');
    expect(web).toContain("addEventListener('pause'");
  });
});
