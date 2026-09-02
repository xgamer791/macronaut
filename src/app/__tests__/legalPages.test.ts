/** The Privacy Policy and Terms pages are linked from Google's OAuth consent
 * screen, so Google fetches both URLs. If a route stops being exported the
 * consent screen fails verification and Google sign-in breaks — a failure that
 * shows up nowhere else in the suite. These checks read the source rather than
 * render it, matching the rest of the (renderer-free) test setup. */
import fs from 'node:fs';
import path from 'node:path';
import { CONTACT_EMAIL, LEGAL_LAST_UPDATED } from '@/utils/legal';

const appDir = path.join(__dirname, '..');
const read = (file: string) => fs.readFileSync(path.join(appDir, file), 'utf8');

describe('legal pages', () => {
  it('exports a route file for each URL Google is pointed at', () => {
    expect(fs.existsSync(path.join(appDir, 'privacy.tsx'))).toBe(true);
    expect(fs.existsSync(path.join(appDir, 'terms.tsx'))).toBe(true);
  });

  it('registers both routes outside the signed-in tab group', () => {
    // Anything under (tabs) redirects to /login when signed out, which would
    // serve Google a login screen instead of the policy.
    const layout = read('_layout.tsx');
    expect(layout).toContain('name="privacy"');
    expect(layout).toContain('name="terms"');
    expect(fs.existsSync(path.join(appDir, '(tabs)', 'privacy.tsx'))).toBe(false);
    expect(fs.existsSync(path.join(appDir, '(tabs)', 'terms.tsx'))).toBe(false);
  });

  it('gives both pages a reachable contact address', () => {
    expect(CONTACT_EMAIL).toMatch(/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/);
    for (const file of ['privacy.tsx', 'terms.tsx']) {
      expect(read(file)).toContain('CONTACT_EMAIL');
    }
  });

  it('dates both pages from one shared constant', () => {
    expect(LEGAL_LAST_UPDATED).toMatch(/^\d{1,2} \w+ \d{4}$/);
    for (const file of ['privacy.tsx', 'terms.tsx']) {
      expect(read(file)).toContain('LEGAL_LAST_UPDATED');
    }
  });

  it('covers the disclosures the consent screen is checked against', () => {
    const privacy = read('privacy.tsx');
    for (const heading of [
      'Your account and what it holds',
      'Signing in',
      'Searching for foods',
      'Camera and microphone',
      'What we never do',
      'Deleting your data',
      'Children',
      'Contact',
    ]) {
      expect(privacy).toContain(heading);
    }
  });

  it('keeps the medical disclaimer in the terms', () => {
    expect(read('terms.tsx')).toContain('Not medical advice');
  });

  it('cross-links the two pages', () => {
    expect(read('privacy.tsx')).toContain("router.push('/terms')");
    expect(read('terms.tsx')).toContain("router.push('/privacy')");
  });
});
