/** Welcome splash is a source-level check, same as loginOrder — no renderer. */
import fs from 'node:fs';
import path from 'node:path';

const appDir = path.join(__dirname, '..');
const read = (file: string) => fs.readFileSync(path.join(appDir, file), 'utf8');

const PHOTOS = [
  '01-run.jpg',
  '02-lift.jpg',
  '03-climb.jpg',
  '04-trail.jpg',
  '05-box.jpg',
  '06-row.jpg',
];

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

  it('clones the Garmin action stack without wiring routes', () => {
    const source = read('welcome.tsx');
    expect(source).toContain('Create Account');
    expect(source).toContain('Sign In');
    expect(source).toContain('More options');
    expect(source).not.toContain('useRouter');
    expect(source).not.toContain('router.push');
    expect(source).not.toContain('router.replace');
    expect(source).not.toContain('/login');
    expect(source).not.toContain('/create-account');
  });

  it('ships six distinct athlete photos', () => {
    const dir = path.join(appDir, '../../assets/images/welcome');
    const files = fs.readdirSync(dir).filter((f) => f.endsWith('.jpg')).sort();
    expect(files).toEqual(PHOTOS);
    const source = fs.readFileSync(path.join(appDir, '../ui/welcomePhotos.ts'), 'utf8');
    for (const file of PHOTOS) {
      expect(source).toContain(file);
    }
  });

  it('does not reuse Garmin branding or the login glass card', () => {
    const source = read('welcome.tsx');
    expect(source).not.toContain('AuthShell');
    expect(source).not.toContain('AuthBrand');
    expect(source).not.toContain('ProviderButtons');
    expect(source).not.toContain('backdropFilter');
  });

  it('crossfades the stills under a dark veil', () => {
    const welcome = read('welcome.tsx');
    const slideshow = fs.readFileSync(path.join(appDir, '../ui/WelcomeSlideshow.tsx'), 'utf8');
    expect(welcome).toContain('WelcomeSlideshow');
    expect(welcome).toContain('veilFilm');
    expect(welcome).toContain("rgba(0,0,0,0.30)");
    expect(slideshow).toContain('Animated.timing');
    expect(slideshow).toContain('WELCOME_PHOTO_FADE_MS');
    expect(slideshow).toContain('WELCOME_PHOTO_HOLD_MS');
  });
});
