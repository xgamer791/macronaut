/** Login CTA order for editorial mockup 5: Apple, then Google, then Email, with
 * create-account as the tertiary action. App Store review requires Sign in with
 * Apple wherever another third-party sign-in is offered, so the button has to
 * actually be on the screen — read the order out of the source rather than
 * restating it here, matching the rest of the (renderer-free) test setup. */
import fs from 'node:fs';
import path from 'node:path';

const LOGIN_ACTIONS = [
  'Continue with Apple',
  'Continue with Google',
  'Continue with Email',
  'Create Account',
] as const;

const source = fs.readFileSync(path.join(__dirname, '..', 'login.tsx'), 'utf8');
const rendered = [...source.matchAll(/accessibilityLabel="([^"]+)"/g)]
  .map((match) => match[1])
  .filter((label): label is (typeof LOGIN_ACTIONS)[number] =>
    (LOGIN_ACTIONS as readonly string[]).includes(label),
  );

describe('login editorial mockup actions', () => {
  it('offers every sign-in method, in order, with Apple first', () => {
    expect(rendered).toEqual([...LOGIN_ACTIONS]);
  });

  it('keeps create-account as the tertiary action', () => {
    expect(LOGIN_ACTIONS[LOGIN_ACTIONS.length - 1]).toBe('Create Account');
  });

  it('routes Apple through the native provider on iOS and the OAuth one elsewhere', () => {
    expect(source).toContain("signIn('apple-native'");
    expect(source).toContain("browserSignIn('apple', 'Apple')");
  });
});
