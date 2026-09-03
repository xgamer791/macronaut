/** Sign-in CTA order for editorial mockup 5: Apple, then Google, then Email,
 * with create-account as the tertiary action. App Store review requires Sign
 * in with Apple wherever another third-party sign-in is offered, so the button
 * has to actually be on the screen. The labels come from one pure module the
 * login and create-account screens both render through, so the order is read
 * from there; the rest is read out of the source, matching the renderer-free
 * test setup. */
import fs from 'node:fs';
import path from 'node:path';
import { PROVIDER_ORDER, providerLabel } from '@/services/auth/providers';

const appDir = path.join(__dirname, '..');
const read = (file: string) => fs.readFileSync(path.join(appDir, file), 'utf8');

describe('sign-in actions', () => {
  it('offers Apple first, then Google, then Email, on both screens', () => {
    expect(PROVIDER_ORDER).toEqual(['apple', 'google', 'email']);
    expect(PROVIDER_ORDER.map((p) => providerLabel('signin', p))).toEqual([
      'Continue with Apple',
      'Continue with Google',
      'Continue with Email',
    ]);
    expect(PROVIDER_ORDER.map((p) => providerLabel('signup', p))).toEqual([
      'Sign up with Apple',
      'Sign up with Google',
      'Sign up with Email',
    ]);
  });

  it('renders the shared provider buttons on login and create-account', () => {
    for (const file of ['login.tsx', 'create-account.tsx']) {
      const source = read(file);
      expect(source).toContain('<ProviderButtons');
      expect(source).toContain('<EmailCodeFlow');
    }
    expect(read('login.tsx')).toContain('mode="signin"');
    expect(read('create-account.tsx')).toContain('mode="signup"');
  });

  it('keeps create-account as the tertiary action on login, and sign-in on create-account', () => {
    expect(read('login.tsx')).toContain('accessibilityLabel="Create Account"');
    expect(read('login.tsx')).toContain("router.push('/signup-legal')");
    expect(read('create-account.tsx')).toContain('accessibilityLabel="Sign in"');
    expect(read('create-account.tsx')).toContain("router.replace('/login')");
  });

  it('registers create-account outside the signed-in tab group', () => {
    expect(read('_layout.tsx')).toContain('name="create-account"');
    expect(fs.existsSync(path.join(appDir, '(tabs)', 'create-account.tsx'))).toBe(false);
  });

  it('shows the legal line at the point of sign-up', () => {
    const source = read('create-account.tsx');
    expect(source).toContain("router.push('/terms')");
    expect(source).toContain("router.push('/privacy')");
  });

  it('routes Apple through the native provider on iOS and the OAuth one elsewhere', () => {
    const hook = fs.readFileSync(
      path.join(appDir, '..', 'state', 'useProviderSignIn.ts'),
      'utf8',
    );
    expect(hook).toContain("signIn('apple-native'");
    expect(hook).toContain("browserSignIn('apple', 'Apple')");
    expect(hook).toContain("signIn('resend-otp'");
  });
});
