/** Post-signup onboarding sequence and visual contract. Source-level. */
import fs from 'node:fs';
import path from 'node:path';

const appDir = path.join(__dirname, '..');
const read = (file: string) => fs.readFileSync(path.join(appDir, file), 'utf8');

describe('post-signup onboarding', () => {
  const onboarding = read('onboarding.tsx');

  it('starts immediately after either Apple Health choice', () => {
    const health = read('signup-health.tsx');
    expect(health).toContain("const continueToOnboarding = () => router.replace('/onboarding')");
    expect(health.match(/onPress={continueToOnboarding}/g)).toHaveLength(2);
  });

  it('starts with personalization and does not repeat collected account fields', () => {
    expect(onboarding).toContain("type Step = 'about' | 'goal' | 'activity' | 'review'");
    expect(onboarding).toContain("useState<Step>('about')");
    expect(onboarding).not.toContain("step === 'welcome'");
    expect(onboarding).not.toContain('What should we call you?');
    expect(onboarding).not.toContain("settings.set('displayName'");
    expect(onboarding).toContain('ageFromBirthdayIso(user?.birthday)');
  });

  it('matches the premium signup visual language', () => {
    expect(onboarding).toContain('WelcomeBackground');
    expect(onboarding).toContain('WelcomeCta');
    expect(onboarding).toContain('fonts.display');
    expect(onboarding).toContain('palette.accentDark');
    expect(onboarding).toContain('styles.progress');
    expect(onboarding).toContain('styles.panel');
    expect(onboarding).toContain('Personalized baseline');
  });

  it('finishes the signup state only after onboarding is saved', () => {
    expect(onboarding).toContain('setOnboardingComplete(true)');
    expect(onboarding).toContain('clearSignupComplete()');
    expect(onboarding.indexOf('setOnboardingComplete(true)')).toBeLessThan(
      onboarding.indexOf('clearSignupComplete()'),
    );
  });
});
