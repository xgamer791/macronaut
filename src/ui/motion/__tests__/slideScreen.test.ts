import fs from 'node:fs';
import path from 'node:path';

const srcDir = path.join(__dirname, '..', '..', '..');
const appDir = path.join(srcDir, 'app');
const read = (...parts: string[]) => fs.readFileSync(path.join(...parts), 'utf8');

describe('directional slide navigation', () => {
  it('slides notifications and profiles in from the right', () => {
    const slide = read(srcDir, 'ui', 'motion', 'SlideScreen.tsx');
    expect(slide).toContain('from: Side');
    expect(slide).toContain("from === 'right' ? 1 : -1");
    expect(slide).toContain('useSlideBack');
    expect(slide).toContain("presentation: 'transparentModal'");
    // One curve and duration, shared by the panel and the page it pushes.
    expect(read(srcDir, 'ui', 'motion', 'slideTiming.ts')).toContain('SLIDE_DURATION_MS = 294');
    expect(slide).toContain('dataSet: { slidescreen: from }');
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
    expect(layout).toContain('SLIDE_OVER_OPTIONS');
    expect(layout).toContain('name="notifications" options={SLIDE_OVER_OPTIONS}');
    expect(layout).toContain('name="profile" options={SLIDE_OVER_OPTIONS}');
    expect(layout).toContain('name="chats" options={SLIDE_OVER_OPTIONS}');
    expect(layout).toContain('name="friends" options={SLIDE_OVER_OPTIONS}');
    expect(layout).toContain('name="u/[handle]" options={SLIDE_OVER_OPTIONS}');

    const header = read(srcDir, 'ui', 'components', 'ScreenHeader.tsx');
    expect(header).toContain('useSlideBack');
    expect(header).toContain('onBack ?? slideBack');
  });

  /** A slide-out pushes the page aside and pulls it back, rather than
   * covering it: the panel and the page travel as one strip. */
  it('pushes the layer below by the panel width, and releases it on the way out', () => {
    const slide = read(srcDir, 'ui', 'motion', 'SlideScreen.tsx');
    // Both platform paths shove the layer below, by the width the panel takes.
    expect(slide.match(/pushBelow\?\.\(-dir \* width\)/g)).toHaveLength(2);
    // ...and let it come back as the panel leaves, not after it has gone.
    expect(slide.match(/pushBelow\?\.\(0\)/g)).toHaveLength(2);

    const push = read(srcDir, 'ui', 'motion', 'SlidePush.tsx');
    expect(push).toContain('SLIDE_DURATION_MS');
    expect(push).toContain('SLIDE_EASING');
    // The page leaving must not give the web a horizontal scrollbar.
    expect(push).toContain("overflow: 'hidden'");
  });

  it('offers a push slot at every depth, since panels open panels', () => {
    const slide = read(srcDir, 'ui', 'motion', 'SlideScreen.tsx');
    // A panel hosts a layer of its own, so a panel opened from a panel pushes
    // the one beneath it rather than the tab shell.
    expect(slide.match(/<SlidePushLayer>\{children\}<\/SlidePushLayer>/g)).toHaveLength(2);

    // The tab shell is wrapped whole — tab bar included, or the bar would sit
    // still while the page it belongs to slid away.
    const tabs = read(appDir, '(tabs)', '_layout.tsx');
    expect(tabs).toContain('<SlidePushLayer>');
    expect(tabs.indexOf('<SlidePushLayer>')).toBeLessThan(tabs.indexOf('<Tabs'));

    // The one slide-out host outside the tabs: legal pages while signed out.
    expect(read(appDir, 'signup-legal.tsx')).toContain('<SlidePushLayer>');
  });

  it('moves the pushed page on the same web curve as the panel', () => {
    const html = read(appDir, '+html.tsx');
    expect(html).toContain('[data-slidepush]');
    expect(html).toContain('transition: transform 294ms cubic-bezier(0.22, 1, 0.36, 1)');
    // Reduced motion turns off the page's travel as well as the panel's.
    expect(html).toMatch(/\[data-slidescreen\],\n  \[data-slidepush\] \{\n    transition: none;/);
  });
});
