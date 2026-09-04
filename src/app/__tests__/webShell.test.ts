/** Web HTML shell — source-level, like the other route checks. */
import fs from 'node:fs';
import path from 'node:path';

const html = fs.readFileSync(path.join(__dirname, '..', '+html.tsx'), 'utf8');

describe('web html shell', () => {
  it('strips the autofill manila wash from every input', () => {
    expect(html).toContain(':-webkit-autofill');
    expect(html).toContain('background-color 99999s');
    expect(html).toContain('-webkit-text-fill-color: currentColor');
    expect(html).toContain('macronaut-dark-field');
    expect(html).toContain('-webkit-text-fill-color: #FFFFFF');
  });
});
