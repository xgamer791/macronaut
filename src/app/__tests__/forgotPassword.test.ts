/** Forgot-password is a source-level check, same as sign-in — no renderer. */
import fs from 'node:fs';
import path from 'node:path';

const appDir = path.join(__dirname, '..');
const srcDir = path.join(appDir, '..');
const read = (file: string) => fs.readFileSync(path.join(appDir, file), 'utf8');

describe('forgot password', () => {
  it('is a signed-out route the login page opens', () => {
    expect(fs.existsSync(path.join(appDir, 'forgot-password.tsx'))).toBe(true);
    expect(read('_layout.tsx')).toContain('name="forgot-password"');
    expect(fs.existsSync(path.join(appDir, '(tabs)', 'forgot-password.tsx'))).toBe(false);
    expect(read('login.tsx')).toContain('accessibilityLabel="Forgot password"');
    expect(read('login.tsx')).toContain("pathname: '/forgot-password'");
    expect(read('login.tsx')).toContain('Forgot password?');
  });

  it('asks for an email, then a check-inbox step, and only shows passwords on the link', () => {
    const source = read('forgot-password.tsx');
    expect(source).toContain('Forgot password');
    expect(source).toContain('Reset password');
    expect(source).toContain('Email address');
    expect(source).toContain('Send reset link');
    expect(source).toContain('Send again');
    expect(source).toContain('we sent a reset link');
    expect(source).toContain('passwordResetFromParams');
    expect(source).toContain('New password');
    expect(source).toContain('Confirm new password');
    expect(source).toContain('Reset password');
    expect(source).toContain('Minimum password length is 8 characters');
    expect(source).toContain('requestPasswordReset');
    expect(source).toContain('confirmPasswordReset');
    expect(source).toContain('isValidSignupPassword');
    expect(source).toContain('passwordsMatch');
    expect(source).toContain('WelcomeBackground');
    expect(source).toContain('WelcomeCta');
    expect(source).toContain('OutlineInput');
    expect(source).toContain('useLocalSearchParams');
    expect(source).toContain("view === 'password'");
    expect(source).toContain('formPassword');
    expect(source).toContain('visualViewport');
    expect(source).toContain("router.replace('/')");
    expect(source).not.toContain('Reset code');
    expect(source).not.toContain('six-digit');
    expect(source).not.toContain('AuthShell');
    expect(source).not.toContain('Google');
    expect(source).not.toContain('Apple');
  });

  it('resets through the password provider on the deployment', () => {
    const hook = fs.readFileSync(path.join(srcDir, 'state/useAccountAuth.ts'), 'utf8');
    expect(hook).toContain("flow: 'reset'");
    expect(hook).toContain("flow: 'reset-verification'");
    expect(hook).toContain('newPassword');
    expect(hook).toContain('isUnknownPasswordAccount');
    expect(hook).toContain('requestPasswordReset');
    expect(hook).toContain('confirmPasswordReset');
  });

  it('does not let Convex Auth spend the reset token as a sign-in code', () => {
    const provider = fs.readFileSync(path.join(srcDir, 'state/AuthProvider.tsx'), 'utf8');
    expect(provider).toContain('shouldHandleCode');
    expect(provider).toContain('shouldHandleAuthCodeFromUrl');
  });
});
