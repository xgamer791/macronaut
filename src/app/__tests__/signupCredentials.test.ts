/** Credentials (name, email, password) after account setup. Source-level. */
import fs from 'node:fs';
import path from 'node:path';

const appDir = path.join(__dirname, '..');
const read = (file: string) => fs.readFileSync(path.join(appDir, file), 'utf8');

describe('signup credentials', () => {
  it('exports a signed-out route and registers it outside the tab group', () => {
    expect(fs.existsSync(path.join(appDir, 'signup-credentials.tsx'))).toBe(true);
    expect(read('_layout.tsx')).toContain('name="signup-credentials"');
    expect(fs.existsSync(path.join(appDir, '(tabs)', 'signup-credentials.tsx'))).toBe(false);
  });

  it('opens from account setup Continue', () => {
    expect(read('signup-account.tsx')).toContain("pathname: '/signup-credentials'");
    expect(read('signup-account.tsx')).toContain('saveSignupDraftValues');
    expect(read('signup-account.tsx')).toContain('disabled={!ready}');
  });

  it('creates the account on the backend, then opens the Apple Health ask', () => {
    const source = read('signup-credentials.tsx');
    const hook = fs.readFileSync(path.join(appDir, '../state/useAccountAuth.ts'), 'utf8');
    expect(source).toContain('useAccountAuth');
    expect(source).toContain('auth.createAccount');
    expect(source).toContain('signupBirthdayIso(monthIndex, day, year)');
    expect(source).toContain('markSignupComplete');
    expect(source).toContain('clearSignupComplete');
    expect(source).toContain("router.replace('/signup-health')");
    expect(source).toContain('auth.error');
    // Name, date of birth and country go with the sign-up call, so the account
    // cannot exist without them.
    expect(hook).toContain("flow: 'signUp'");
    for (const field of ['email', 'password', 'name', 'birthday', 'country']) {
      expect(hook).toContain(`${field}:`);
    }
  });

  it('says so on the form when the two passwords differ', () => {
    const source = read('signup-credentials.tsx');
    const fields = fs.readFileSync(path.join(appDir, '../ui/DarkField.tsx'), 'utf8');
    expect(source).toContain('passwordsMatch');
    expect(source).toContain('confirmationSettled');
    expect(source).toContain('Passwords do not match.');
    expect(source).toContain('Passwords match.');
    expect(source).toContain('Email addresses do not match.');
    // The outline alone is not something everyone can see, so each one is
    // announced as well.
    expect(source).toContain('accessibilityRole="alert"');
    expect(source).toContain('invalid={passwordMismatch}');
    expect(source).toContain('invalid={emailMismatch}');
    expect(fields).toContain('invalid?: boolean');
    expect(fields).toContain('fieldStyles.fieldInvalid');
    expect(fields).toContain('borderColor: palette.danger');
  });

  it('checks the address against the backend as it is typed, and gates Continue on it', () => {
    const source = read('signup-credentials.tsx');
    const hook = fs.readFileSync(path.join(appDir, '../state/useEmailAvailability.ts'), 'utf8');
    const repo = fs.readFileSync(path.join(appDir, '../repositories/accountRepo.ts'), 'utf8');
    const backend = fs.readFileSync(path.join(appDir, '../../convex/account.ts'), 'utf8');
    expect(source).toContain('useEmailAvailability');
    expect(source).toContain('emailAllowsSignup(emailStatus)');
    expect(source).toContain('An account already uses this email address');
    expect(source).toContain('invalid={emailTaken}');
    // Grey while the answer is still coming, so the button is never wrong.
    expect(source).toContain('Checking this email address…');
    expect(source).toContain('disabled={!ready || auth.busy}');
    expect(hook).toContain('EMAIL_CHECK_DEBOUNCE_MS');
    expect(hook).toContain('account.emailTaken');
    // An offline Convex client queues the call instead of failing it, which
    // would leave Create Account disabled until the network came back.
    expect(hook).toContain('EMAIL_CHECK_TIMEOUT_MS');
    expect(hook).toContain('withTimeout(account.emailTaken');
    expect(repo).toContain('api.account.passwordAccountExists');
    expect(backend).toContain('passwordAccountExists');
    expect(backend).toContain("q.eq('provider', 'password')");
  });

  it('collects name, email, and password with Macronaut type and the welcome CTA', () => {
    const source = read('signup-credentials.tsx');
    const fields = fs.readFileSync(path.join(appDir, '../ui/DarkField.tsx'), 'utf8');
    expect(source).toContain('Create An Account');
    expect(source).toContain('Name');
    expect(source).toContain('Email address');
    expect(source).toContain('Confirm email address');
    expect(source).toContain('Password');
    expect(source).toContain('Confirm password');
    expect(source).toContain('Minimum password length is 8 characters');
    expect(source).toContain('Date of birth');
    expect(source).toContain('Month');
    expect(source).toContain('Day');
    expect(source).toContain('Year');
    expect(source).toContain('Country/Region');
    expect(source).toContain('Once set, it cannot be changed.');
    expect(source).toContain('useSignupDraft');
    expect(source).toContain('applySignupDraftFromRoute');
    expect(source).toContain('useLocalSearchParams');
    expect(source).toContain('fieldLocked');
    // `flex: 0` resolves to flex-basis 0 on web, which collapses the locked
    // day and year text to zero width.
    expect(source).not.toContain('flex: 0,');
    expect(source).toContain('disabled: true');
    expect(source).toContain("pointerEvents=\"none\"");
    expect(source).not.toContain("toggle('month')");
    expect(source).not.toContain('setMonthIndex');
    expect(source).toContain('inlineMenu');
    expect(source).toContain('isValidSignupBirthday');
    expect(source).toContain('WelcomeBackground');
    expect(source).toContain('WelcomeCta');
    expect(source).toContain('fonts.display');
    expect(source).toContain('type.title');
    expect(source).toContain('type.body');
    expect(source).toContain('palette.accent');
    expect(source).toContain('accessibilityLabel="Create Account"');
    expect(source).toContain('disabled={!ready || auth.busy}');
    expect(source).not.toContain('/create-account');
    expect(fields).toContain("outlineStyle: 'none'");
    expect(fields).toContain("dataSet: { darkfield: 'true' }");
    expect(fields).toContain("WebkitTextFillColor: '#FFFFFF'");
    expect(fields).toContain('palette.danger');
    expect(source).not.toContain('Modal');
    expect(source).not.toContain('animationType');
    expect(source).not.toContain('Garmin');
  });
});
