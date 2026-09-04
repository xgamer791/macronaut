/** Apple Health ask after credentials. Source-level. */
import fs from 'node:fs';
import path from 'node:path';

const appDir = path.join(__dirname, '..');
const read = (file: string) => fs.readFileSync(path.join(appDir, file), 'utf8');

describe('signup apple health ask', () => {
  it('exports a signed-out route and registers it outside the tab group', () => {
    expect(fs.existsSync(path.join(appDir, 'signup-health.tsx'))).toBe(true);
    expect(read('_layout.tsx')).toContain('name="signup-health"');
    expect(fs.existsSync(path.join(appDir, '(tabs)', 'signup-health.tsx'))).toBe(false);
  });

  it('opens from Create Account on credentials', () => {
    expect(read('signup-credentials.tsx')).toContain('href="/signup-health"');
    expect(read('signup-credentials.tsx')).toContain('disabled={!ready}');
  });

  it('asks to connect Apple Health for Apple Watch without wiring HealthKit', () => {
    const source = read('signup-health.tsx');
    const mark = fs.readFileSync(path.join(appDir, '../ui/WatchConnectMark.tsx'), 'utf8');
    expect(source).toContain('Apple Health');
    expect(source).toContain('Apple Watch');
    expect(source).toContain('WatchConnectMark');
    expect(source).toContain('WelcomeBackground');
    expect(source).toContain('WelcomeCta');
    expect(source).toContain('label="Connect"');
    expect(source).toContain('onPress={() => {}}');
    expect(source).toContain('Not now');
    expect(source).toContain("router.replace('/')");
    expect(source).toContain('veilFilm');
    expect(source).toContain('rgba(0,0,0,0.50)');
    expect(source).toContain('fonts.display');
    expect(source).not.toContain('HealthKit');
    expect(source).not.toContain('requestAuthorization');
    expect(source).not.toContain('/create-account');
    expect(source).not.toContain('Garmin');
    expect(mark).toContain('Animated.loop');
    expect(mark).toContain('palette.accent');
    expect(mark).not.toContain('heart');
    expect(mark).not.toContain('HealthKit');
  });
});
