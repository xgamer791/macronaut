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

  it('collects name, email, and password with Macronaut type and the welcome CTA', () => {
    const source = read('signup-credentials.tsx');
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
    expect(source).toContain('palette.danger');
    expect(source).toContain('palette.accent');
    expect(source).toContain('label="Create Account"');
    expect(source).toContain('disabled={!ready}');
    expect(source).toContain('href="/signup-health"');
    expect(source).not.toContain('/create-account');
    expect(source).toContain("outlineStyle: 'none'");
    expect(source).toContain('macronaut-dark-field');
    expect(source).toContain("WebkitTextFillColor: '#FFFFFF'");
    expect(source).not.toContain('Modal');
    expect(source).not.toContain('animationType');
    expect(source).not.toContain('Garmin');
  });
});
