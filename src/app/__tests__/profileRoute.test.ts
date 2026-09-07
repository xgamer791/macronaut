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

  it('opens Photos and Groups from the profile action row', () => {
    const own = read('profile.tsx');
    expect(own).toContain("router.push('/photos')");
    expect(own).toContain("router.push('/groups')");
    expect(own).toContain('label="Photos"');
    expect(own).toContain('label="Groups"');
    expect(own).not.toContain('label="Photo"');
    expect(own).not.toContain('label="Banner"');
    expect(fs.existsSync(path.join(appDir, 'photos.tsx'))).toBe(true);
    expect(fs.existsSync(path.join(appDir, 'groups.tsx'))).toBe(true);
    const layout = read('_layout.tsx');
    expect(layout).toContain('name="photos"');
    expect(layout).toContain('name="groups"');
  });

  it('opens a full-screen viewer with like, comment and share', () => {
    const wall = read('photos.tsx');
    expect(wall).toContain('PhotoViewer');
    expect(wall).toContain('useSetPhotoLike');
    expect(wall).toContain('useAddPhotoComment');
    expect(wall).toContain('photoShareUrl');
    expect(wall).not.toContain('<Sheet');
    const viewer = fs.readFileSync(path.join(srcDir, 'ui', 'components', 'PhotoViewer.tsx'), 'utf8');
    expect(viewer).toContain('contentFit="contain"');
    expect(viewer).toContain("justifyContent: 'center'");
    expect(viewer).toContain('Like photo');
    expect(viewer).toContain('Comment on photo');
    expect(viewer).toContain('Share photo');
    expect(viewer).toContain("animationType=\"slide\"");
    expect(viewer).toContain("backgroundColor: '#000000'");
  });

  it('adds wall photos from a select-only picker in tap order', () => {
    const wall = read('photos.tsx');
    expect(wall).toContain('pickImages');
    expect(wall).toContain('useAddPhotos');
    expect(wall).not.toContain("pickImage('post')");
    expect(wall).not.toContain('setOpen(picked');
    const native = fs.readFileSync(path.join(srcDir, 'services', 'media', 'pickImage.ts'), 'utf8');
    expect(native).toContain('GALLERY_PICKER_OPTIONS');
    expect(native).toContain('pickImages');
    const web = fs.readFileSync(path.join(srcDir, 'services', 'media', 'pickImage.web.ts'), 'utf8');
    expect(web).toContain('input.multiple = multiple');
    expect(web).toContain('Array.from(input.files');
  });
});
