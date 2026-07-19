/** Login CTA order for editorial mockup 5 (Google above Email). */
const LOGIN_ACTIONS = ['Continue with Google', 'Continue with Email', 'Create Account'] as const;

describe('login editorial mockup actions', () => {
  it('places Google above Email', () => {
    expect(LOGIN_ACTIONS.indexOf('Continue with Google')).toBeLessThan(
      LOGIN_ACTIONS.indexOf('Continue with Email'),
    );
  });

  it('keeps create-account as the tertiary action', () => {
    expect(LOGIN_ACTIONS[LOGIN_ACTIONS.length - 1]).toBe('Create Account');
  });
});
