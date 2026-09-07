import fs from 'node:fs';
import path from 'node:path';

const appDir = path.join(__dirname, '..');
const srcDir = path.join(appDir, '..');
const read = (file: string) => fs.readFileSync(path.join(appDir, file), 'utf8');

/** The profile page is reached from the header avatar and from a shared link,
 * so both entry points and the stack registration are pinned here. */
describe('profile routes', () => {
  it('registers the own page and the public page on the root stack', () => {
    expect(fs.existsSync(path.join(appDir, 'profile.tsx'))).toBe(true);
    expect(fs.existsSync(path.join(appDir, 'u', '[handle].tsx'))).toBe(true);
    const layout = read('_layout.tsx');
    expect(layout).toContain('name="profile"');
    expect(layout).toContain('name="u/[handle]"');
  });

  it('opens from the header avatar rather than settings', () => {
    const header = fs.readFileSync(
      path.join(srcDir, 'ui', 'components', 'AppHeader.tsx'),
      'utf8',
    );
    expect(header).toContain("router.push('/profile')");
    expect(header).toContain('Open your profile');
    // The gear inside the profile page is how settings is reached from there.
    expect(read('profile.tsx')).toContain("router.push('/settings')");
  });

  it('is also linked from Settings', () => {
    expect(read(path.join('(tabs)', 'settings.tsx'))).toContain("router.push('/profile')");
    expect(read(path.join('(tabs)', 'settings.tsx'))).toContain('Your profile page');
  });

  it('forces the dark theme on both profile pages', () => {
    for (const page of [read('profile.tsx'), read(path.join('u', '[handle].tsx'))]) {
      expect(page).toContain('initialMode="dark"');
    }
  });

  it('never hands the public page an editing affordance', () => {
    const publicPage = read(path.join('u', '[handle].tsx'));
    expect(publicPage).not.toContain('onPickAvatar');
    expect(publicPage).not.toContain('onPickBanner');
    expect(publicPage).not.toContain('pickImage');
  });

  it('shows followers, following and posts under the name, not the athlete row', () => {
    const header = fs.readFileSync(
      path.join(srcDir, 'ui', 'components', 'ProfileHeader.tsx'),
      'utf8',
    );
    expect(header).toContain('profileStatLine');
    expect(header).not.toContain('Athlete');
    expect(header).not.toContain('barbell');
    expect(read(path.join('u', '[handle].tsx'))).toContain('setFollow');
    expect(read(path.join('u', '[handle].tsx'))).toContain('Follow');
  });
});
