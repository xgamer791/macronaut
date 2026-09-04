/** First create-account step: consent frame over the welcome video, linking
 * the existing /terms and /privacy routes. Source-level, like the other
 * auth-route checks — no renderer. */
import fs from 'node:fs';
import path from 'node:path';

const appDir = path.join(__dirname, '..');
const read = (file: string) => fs.readFileSync(path.join(appDir, file), 'utf8');

describe('signup legal gate', () => {
  it('exports a signed-out route and registers it outside the tab group', () => {
    expect(fs.existsSync(path.join(appDir, 'signup-legal.tsx'))).toBe(true);
    expect(read('_layout.tsx')).toContain('name="signup-legal"');
    expect(fs.existsSync(path.join(appDir, '(tabs)', 'signup-legal.tsx'))).toBe(false);
  });

  it('is the first screen after Create Account on welcome', () => {
    expect(read('welcome.tsx')).toContain('href="/signup-legal"');
    expect(read('login.tsx')).not.toContain('/signup-legal');
  });

  it('links the existing Terms of Service and Privacy Policy pages', () => {
    const source = read('signup-legal.tsx');
    expect(source).toContain('href="/terms"');
    expect(source).toContain('href="/privacy"');
    expect(source).toContain('<Link href={href} asChild>');
    expect(source).toContain('Terms of Service');
    expect(source).toContain('Privacy Policy');
    expect(source).not.toContain('Oura');
    expect(source).not.toContain('Terms of Use');
  });

  it('reuses the welcome video, veil, fonts, and accent CTA', () => {
    const source = read('signup-legal.tsx');
    expect(source).toContain('WelcomeBackground');
    expect(source).toContain('WelcomeCta');
    expect(source).toContain('veilFilm');
    expect(source).toContain('rgba(0,0,0,0.50)');
    expect(source).toContain('fonts.display');
    expect(source).toContain('type.hero');
    expect(source).toContain('type.body');
    expect(source).toContain('palette.accent');
    expect(source).toContain('Save and continue');
    expect(source).not.toContain('/create-account');
  });

  it('keeps Save and continue disabled until the required toggle is on, then opens account setup', () => {
    const source = read('signup-legal.tsx');
    expect(source).toContain('disabled={!agreed}');
    expect(source).toContain('Agree to the Terms of Service and Privacy Policy');
    expect(source).toContain('href="/signup-account"');
    expect(source).not.toContain("router.push('/create-account')");
  });
});
