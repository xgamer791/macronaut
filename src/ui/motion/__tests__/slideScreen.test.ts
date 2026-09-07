import fs from 'node:fs';
import path from 'node:path';

const srcDir = path.join(__dirname, '..', '..', '..');
const appDir = path.join(srcDir, 'app');
const read = (...parts: string[]) => fs.readFileSync(path.join(...parts), 'utf8');

describe('directional slide navigation', () => {
  it('slides notifications and profiles in from the right', () => {
    const slide = read(srcDir, 'ui', 'motion', 'SlideScreen.tsx');
    expect(slide).toContain("from: Side");
    expect(slide).toContain('from === \'right\' ? width : -width');
    expect(slide).toContain('useSlideBack');
    expect(slide).toContain("presentation: 'transparentModal'");
    expect(slide).toContain("from './slideTokens'");
    expect(read(srcDir, 'ui', 'motion', 'slideTokens.ts')).toContain('SLIDE_DURATION_MS = 294');
    expect(slide).toContain("dataSet: { slidescreen: from }");
    expect(slide).toContain('slideLayerTranslate');
    expect(slide).toContain('useSlideLayer');
    expect(slide).toContain('SlidePushNested');
    expect(slide).toContain("Platform.OS === 'web'");

    expect(read(appDir, 'notifications.tsx')).toContain('<SlideScreen from="right">');
    expect(read(appDir, 'profile.tsx')).toContain('<SlideScreen from="right">');
    expect(read(appDir, 'u', '[handle].tsx')).toContain('<SlideScreen from="right">');
  });

  it('slides chats and the rest in from the left', () => {
    for (const file of ['chats.tsx', 'friends.tsx', 'groups.tsx', 'photos.tsx', 'goals.tsx']) {
      expect(read(appDir, file)).toContain('<SlideScreen from="left">');
    }
    expect(read(appDir, 'chat', '[id].tsx')).toContain('<SlideScreen from="left">');
    expect(read(appDir, 'meal', '[id].tsx')).toContain('<SlideScreen from="left">');
    expect(read(appDir, 'privacy.tsx')).toContain('<SlideScreen from="left">');
    expect(read(appDir, 'terms.tsx')).toContain('<SlideScreen from="left">');
    expect(read(appDir, 'apple-health.tsx')).toContain('<SlideScreen from="left">');
  });

  it('keeps the page underneath visible and pops along the same path', () => {
    const layout = read(appDir, '_layout.tsx');
    expect(layout).toContain('SlidePushProvider');
    expect(layout).toContain('SLIDE_OVER_OPTIONS');
    expect(layout).toContain('name="notifications" options={SLIDE_OVER_OPTIONS}');
    expect(layout).toContain('name="profile" options={SLIDE_OVER_OPTIONS}');
    expect(layout).toContain('name="chats" options={SLIDE_OVER_OPTIONS}');
    expect(layout).toContain('name="friends" options={SLIDE_OVER_OPTIONS}');
    expect(layout).toContain('name="u/[handle]" options={SLIDE_OVER_OPTIONS}');

    const header = read(srcDir, 'ui', 'components', 'ScreenHeader.tsx');
    expect(header).toContain('useSlideBack');
    expect(header).toContain('onBack ?? slideBack');

    expect(read(appDir, '(tabs)', '_layout.tsx')).toContain('<SlidePushable>');
    expect(read(srcDir, 'ui', 'components', 'Screen.tsx')).toContain('<SlidePushable>');
    expect(read(appDir, 'welcome.tsx')).toContain('<SlidePushable>');
    expect(read(appDir, 'signup-legal.tsx')).toContain('<SlidePushable>');
  });
});
