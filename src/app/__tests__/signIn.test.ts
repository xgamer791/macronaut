/** One way in: the email and password the account was created with. Google,
 * Apple and the email-code card are gone, screens and helpers included.
 * Source-level, matching the renderer-free test setup. */
import fs from 'node:fs';
import path from 'node:path';

const appDir = path.join(__dirname, '..');
const srcDir = path.join(appDir, '..');
const read = (file: string) => fs.readFileSync(path.join(appDir, file), 'utf8');

describe('sign in', () => {
  it('asks for an email and a password, and nothing else', () => {
    const source = read('login.tsx');
    expect(source).toContain('Sign In');
    expect(source).toContain('Email address');
    expect(source).toContain('Password');
    expect(source).toContain('useAccountAuth');
    expect(source).toContain('auth.signIn');
    expect(source).toContain('isPlausibleEmail');
    expect(source).toContain('auth.error');
    // Same welcome loop and outlined fields as create-account, not the old
    // glass card.
    expect(source).toContain('WelcomeBackground');
    expect(source).toContain('WelcomeCta');
    expect(source).toContain('OutlineInput');
    expect(source).toContain('FieldLabel');
    // Same layout as Account Setup: fields then the tile in the form, not a
    // dock at the bottom of the screen.
    expect(source).toContain('ctaWrap');
    expect(source).toContain('paddingTop: 28');
    expect(source).toContain('rgba(0,0,0,0.50)');
    expect(source).not.toContain('styles.dock');
    expect(source).not.toContain('AuthShell');
    expect(source).not.toContain('backdropFilter');
  });

  it('offers no third-party sign-in', () => {
    const source = read('login.tsx');
    for (const gone of ['Apple', 'Google', 'ProviderButtons', 'EmailCodeFlow', 'resend-otp']) {
      expect(source).not.toContain(gone);
    }
  });

  it('sends people without an account into the create-account flow', () => {
    const source = read('login.tsx');
    expect(source).toContain('accessibilityLabel="Create Account"');
    expect(source).toContain("router.replace('/signup-legal')");
    expect(source).not.toContain('/create-account');
  });

  it('opens a working forgot-password reset from the password field', () => {
    const source = read('login.tsx');
    expect(source).toContain('accessibilityLabel="Forgot password"');
    expect(source).toContain("pathname: '/forgot-password'");
    expect(source).toContain('Forgot password?');
  });

  it('is what the welcome Sign In button opens', () => {
    expect(read('welcome.tsx')).toContain('<WelcomeCta label="Sign In" href="/login" />');
    expect(read('_layout.tsx')).toContain('name="login"');
    expect(fs.existsSync(path.join(appDir, '(tabs)', 'login.tsx'))).toBe(false);
  });

  it('leaves nothing of the Google and Apple surface behind', () => {
    for (const gone of [
      path.join(appDir, 'create-account.tsx'),
      path.join(srcDir, 'ui/components/auth'),
      path.join(srcDir, 'services/auth/apple.ts'),
      path.join(srcDir, 'services/auth/providers.ts'),
      path.join(srcDir, 'state/useProviderSignIn.ts'),
    ]) {
      expect(fs.existsSync(gone)).toBe(false);
    }
    expect(read('_layout.tsx')).not.toContain('name="create-account"');
  });

  it('signs in through the password provider on the deployment', () => {
    const hook = fs.readFileSync(path.join(srcDir, 'state/useAccountAuth.ts'), 'utf8');
    expect(hook).toContain("convexSignIn('password'");
    expect(hook).toContain("flow: 'signIn'");
    expect(hook).toContain("flow: 'signUp'");
    expect(hook).toContain("flow: 'reset'");
    expect(hook).toContain("flow: 'reset-verification'");
    expect(hook).toContain('normalizeEmail');
    expect(hook).not.toContain('google');
    expect(hook).not.toContain('apple');
  });
});
