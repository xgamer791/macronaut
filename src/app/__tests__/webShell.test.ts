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
});
