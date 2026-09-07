/** Web HTML shell — source-level, like the other route checks. */
import fs from 'node:fs';
import path from 'node:path';

const html = fs.readFileSync(path.join(__dirname, '..', '+html.tsx'), 'utf8');

describe('web html shell', () => {
  it('strips the autofill manila wash from every input', () => {
    expect(html).toContain(':-webkit-autofill');
    expect(html).toContain('background-color 99999s');
  });

  it('pins the shell to the visible viewport so iOS Safari cannot lift it', () => {
    expect(html).toContain('position: fixed');
    expect(html).toContain('background-color: #101418');
    expect(html).toContain('overscroll-behavior: none');
    expect(html).not.toContain('#signup-health-root');
  });

  it('sizes the shell from visualViewport rather than dvh', () => {
    // dvh measures the URL-bar-collapsed viewport, which is taller than what
    // iOS Safari is showing on first load.
    expect(html).not.toContain('100dvh');
    expect(html).toContain('var(--app-viewport-height, 100%)');
    expect(html).toContain('top: var(--app-viewport-top, 0px)');
    expect(html).toContain('window.visualViewport');
    expect(html).toContain("vv.addEventListener('resize', sync)");
    expect(html).toContain("vv.addEventListener('scroll', sync)");
  });

  it('leaves the layout alone while a field is focused', () => {
    // Otherwise the soft keyboard shrinks the shell under the form.
    expect(html).toContain('if (typing()) return;');
    expect(html).toContain("tag === 'INPUT'");
    expect(html).toContain("document.addEventListener('focusout'");
  });

  it('forces white autofill text on fields that sit on the dark video', () => {
    // react-native-web drops className, so the fields carry a data attribute.
    expect(html).toContain('[data-darkfield]');
    expect(html).toContain('input[data-darkfield]:-webkit-autofill');
    expect(html).toContain('color-scheme: dark');
    expect(html).toContain('-webkit-text-fill-color: #FFFFFF !important');
    expect(html).not.toContain('-webkit-text-fill-color: currentColor');
  });

  it('paints the sticky header with the 2025–26 liquid-glass recipe', () => {
    expect(html).toContain('.glass');
    expect(html).toContain('[data-headerglass]');
    expect(html).toContain('radial-gradient(ellipse 130% 90% at 50% 0%');
    expect(html).toContain('blur(39px) saturate(135%)');
    expect(html).toContain('-webkit-backdrop-filter: blur(39px) saturate(135%)');
    expect(html).toContain('border-radius: 0');
    expect(html).toContain('border: none');
    expect(html).toContain('outline: none');
    expect(html).toContain('.glass::before');
    expect(html).toContain('.glass::after');
    expect(html).toContain('content: none');
    expect(html).toContain('rgba(0, 0, 0, 0.630)');
  });

  it('slides stack pages with a CSS transform so web actually animates', () => {
    expect(html).toContain('[data-slidescreen]');
    expect(html).toContain('[data-slidebase]');
    expect(html).toContain('transform 294ms cubic-bezier(0.22, 1, 0.36, 1)');
    expect(html).toContain('prefers-reduced-motion: reduce');
  });

  it('slides the hamburger drawer on the same 294ms curve', () => {
    expect(html).toContain('[data-headermenu]');
    expect(html).toContain('[data-headermenu] [data-menudrawer]');
    expect(html).toContain('[data-headermenu] [data-menuscrim]');
    expect(html).not.toContain('opacity 294ms');
  });

  it('slides the sticky header as one slab on the same 294ms curve', () => {
    expect(html).toContain('[data-headerhide]');
    expect(html).toContain('[data-headerhide="out"]');
    expect(html).toContain('translateY(-100%)');
    expect(html).toContain(
      'transform 294ms cubic-bezier(0.22, 1, 0.36, 1),\n    margin-bottom 294ms cubic-bezier(0.22, 1, 0.36, 1)',
    );
    expect(html).not.toContain('[data-headerhide="out"] > *');
    expect(html).not.toContain('height 840ms');
    expect(html).not.toContain('840ms');
  });
});
