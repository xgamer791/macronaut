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

  it('opens once Create Account has made the account', () => {
    const credentials = read('signup-credentials.tsx');
    expect(credentials).toContain("router.replace('/signup-health')");
    expect(credentials).toContain('auth.createAccount');
    expect(credentials).toContain('disabled={!ready || auth.busy}');
  });

  it('exposes a temporary ungated preview so the ask can be opened without signing up', () => {
    expect(fs.existsSync(path.join(appDir, 'preview-signup-health.tsx'))).toBe(true);
    expect(read('_layout.tsx')).toContain('name="preview-signup-health"');
    expect(read('preview-signup-health.tsx')).toContain('SignupHealthView');
    expect(read('preview-signup-health.tsx')).not.toContain('useAuth');
    expect(read('preview-signup-health.tsx')).not.toContain('Redirect');
    const source = read('signup-health.tsx');
    expect(source).toContain('isSignupHealthPreview');
    expect(source).toContain("get('preview') === '1'");
    expect(source).toContain('if (preview) return <SignupHealthView />');
  });

  it('asks to connect Apple Health for Apple Watch without wiring HealthKit', () => {
    const source = read('signup-health.tsx');
    expect(source).toContain('Apple Health');
    expect(source).toContain('Apple Watch');
    expect(source).toContain('WelcomeBackground');
    expect(source).toContain('WelcomeCta');
    expect(source).toContain('label="Connect"');
    expect(source).toContain('onPress={() => {}}');
    expect(source).toContain('Not now');
    expect(source).toContain("router.replace('/')");
    // The session already exists by now, so the ask stays put instead of
    // redirecting the new account into the onboarding wizard.
    expect(source).toContain('signupComplete');
    expect(source).toContain('veilFilm');
    expect(source).toContain('rgba(0,0,0,0.50)');
    expect(source).toContain('fonts.display');
    expect(source).not.toContain('WatchConnectMark');
    expect(source).not.toContain('SignupHealthBackground');
    expect(source).not.toContain('signup-health-watch');
    expect(source).not.toContain('HealthKit');
    expect(source).not.toContain('requestAuthorization');
    expect(source).not.toContain('/create-account');
    expect(source).not.toContain('Garmin');
    expect(fs.existsSync(path.join(appDir, '../ui/WatchConnectMark.tsx'))).toBe(false);
  });
});
