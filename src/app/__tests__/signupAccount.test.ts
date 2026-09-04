/** Account setup (birthday + country) after the legal gate. Source-level. */
import fs from 'node:fs';
import path from 'node:path';

const appDir = path.join(__dirname, '..');
const read = (file: string) => fs.readFileSync(path.join(appDir, file), 'utf8');

describe('signup account setup', () => {
  it('exports a signed-out route and registers it outside the tab group', () => {
    expect(fs.existsSync(path.join(appDir, 'signup-account.tsx'))).toBe(true);
    expect(read('_layout.tsx')).toContain('name="signup-account"');
    expect(fs.existsSync(path.join(appDir, '(tabs)', 'signup-account.tsx'))).toBe(false);
  });

  it('opens from the legal Save and continue action', () => {
    expect(read('signup-legal.tsx')).toContain('href="/signup-account"');
    expect(read('signup-legal.tsx')).toContain('disabled={!agreed}');
  });

  it('collects birthday and country with Macronaut type and the welcome CTA', () => {
    const source = read('signup-account.tsx');
    expect(source).toContain('Account Setup');
    expect(source).toContain('Month');
    expect(source).toContain('Day');
    expect(source).toContain('Year');
    expect(source).toContain('Country/Region');
    expect(source).toContain('WelcomeBackground');
    expect(source).toContain('WelcomeCta');
    expect(source).toContain('fonts.display');
    expect(source).toContain('type.title');
    expect(source).toContain('type.body');
    expect(source).toContain('palette.accent');
    expect(source).toContain('label="Continue"');
    expect(source).toContain('disabled={!ready}');
    expect(source).toContain("pathname: '/signup-credentials'");
    expect(source).toContain('saveSignupDraftValues');
    expect(source).toContain('useSignupDraft');
    expect(source).not.toContain('/create-account');
  });

  it('expands month and country in the page instead of a slide-up overlay', () => {
    const account = read('signup-account.tsx');
    const legal = read('signup-legal.tsx');
    expect(account).toContain("outlineStyle: 'none'");
    expect(account).toContain('macronaut-dark-field');
    expect(account).toContain("WebkitTextFillColor: '#FFFFFF'");
    expect(account).toContain('inlineMenu');
    expect(account).not.toContain('Modal');
    expect(account).not.toContain('animationType');
    expect(account).not.toContain('sheetRoot');
    expect(account).not.toContain("from '@/ui/components/Sheet'");
    expect(legal).not.toContain('Modal');
    expect(legal).not.toContain('animationType');
    expect(legal).not.toContain("from '@/ui/components/Sheet'");
  });
});
