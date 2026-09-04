/**
 * Creating an account swaps the session under a mounted screen. Anything above
 * <Stack> that unmounts on that change throws the navigation state away with
 * it, so `router.replace('/signup-health')` lands and is then undone — the
 * browser walks from /signup-health to whatever the router falls back to, and
 * the new account never sees the Apple Health ask. Source-level.
 */
import fs from 'node:fs';
import path from 'node:path';

const appDir = path.join(__dirname, '..');
const read = (file: string) => fs.readFileSync(path.join(appDir, file), 'utf8');

describe('the navigator survives signing in', () => {
  const source = read('_layout.tsx');

  it('does not remount the tree when the account changes', () => {
    expect(source).toContain('<AppProvider>');
    expect(source).not.toMatch(/<AppProvider\s+key=/);
    expect(source).not.toContain("key={userId ?? 'signed-out'}");
  });

  it('does not blank the tree while the session or its settings load', () => {
    expect(source).not.toContain('if (loading) return null');
    expect(source).not.toContain('if (signedIn && appearance.isLoading) return null');
  });

  it('leaves each screen to wait for the session itself', () => {
    for (const screen of [
      'welcome.tsx',
      'login.tsx',
      'signup-credentials.tsx',
      'signup-health.tsx',
      'onboarding.tsx',
    ]) {
      expect(read(screen)).toMatch(/if \(.*[Ll]oading/);
    }
    expect(read(path.join('(tabs)', '_layout.tsx'))).toMatch(/if \(loading/);
  });

  it('picks up the account appearance once it arrives instead', () => {
    const theme = fs.readFileSync(path.join(appDir, '../ui/theme/ThemeProvider.tsx'), 'utf8');
    expect(theme).toContain('seededWith');
    expect(theme).toContain('setModeState(initialMode)');
  });

  it('fills the goal wizard from the account when the account lands', () => {
    const onboarding = read('onboarding.tsx');
    // Seeding useState directly would capture the render before the viewer
    // resolved, leaving the name and the age blank for a new account.
    expect(onboarding).not.toContain('useState(() => displayNameFromUser(user)');
    expect(onboarding).not.toContain('useState<number | undefined>(() => ageFromBirthdayIso');
    expect(onboarding).toContain('user.id !== filledFor');
    expect(onboarding).toContain('setAge(ageFromBirthdayIso(user.birthday))');
  });
});
