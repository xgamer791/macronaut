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
    expect(html).toContain('100dvh');
    expect(html).toContain('position: fixed');
    expect(html).toContain('background-color: #101418');
    expect(html).toContain('overscroll-behavior: none');
  });

  it('pins the Apple Health ask to the visible viewport on the first paint', () => {
    expect(html).toContain('#signup-health-root');
    expect(html).toContain('#signup-health-frame');
    expect(html).toContain('#signup-health-lower');
    expect(html).toContain('env(safe-area-inset-top, 0px)');
    expect(html).toContain('env(safe-area-inset-bottom, 0px)');
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
