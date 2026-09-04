/** Inspects the rendered create-account inputs: attributes that made it to
 * the DOM plus the computed colors that decide autofill text. */
import { existsSync } from 'node:fs';
import puppeteer from 'puppeteer-core';

const BASE = process.argv[2] ?? 'https://xgamer791.github.io/macronaut';
const CHROME =
  process.env.CHROME_PATH ??
  ['/usr/local/bin/google-chrome', '/usr/bin/google-chrome', '/usr/bin/chromium'].find((p) =>
    existsSync(p),
  );
if (!CHROME) throw new Error('no Chrome found; set CHROME_PATH');

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: 'new',
  args: ['--no-sandbox', '--disable-dev-shm-usage'],
});
const page = await browser.newPage();
await page.setViewport({ width: 430, height: 900, isMobile: true, hasTouch: true });
page.on('pageerror', (e) => console.log('[pageerror]', e.message));

const query = 'month=7&day=4&year=1992&country=United%20States';
// A static export served without rewrites only answers the .html path.
for (const path of ['/signup-credentials', '/signup-credentials.html']) {
  const res = await page.goto(`${BASE}${path}?${query}`, { waitUntil: 'networkidle2' });
  await new Promise((r) => setTimeout(r, 2500));
  if (res?.ok() && (await page.$('input[aria-label="Name"]'))) break;
}

const report = await page.evaluate(() => {
  const out = [];
  for (const label of ['Name', 'Email address', 'Password']) {
    const el = document.querySelector(`input[aria-label="${label}"]`);
    if (!el) {
      out.push({ label, missing: true });
      continue;
    }
    const cs = getComputedStyle(el);
    out.push({
      label,
      outerHTML: el.outerHTML.slice(0, 240),
      className: el.className,
      dataset: { ...el.dataset },
      color: cs.color,
      webkitTextFillColor: cs.webkitTextFillColor,
      caretColor: cs.caretColor,
      colorScheme: cs.colorScheme,
      parentDataset: { ...el.parentElement.dataset },
      parentClass: el.parentElement.className,
    });
  }
  const sheets = Array.from(document.styleSheets)
    .flatMap((s) => {
      try {
        return Array.from(s.cssRules).map((r) => r.cssText);
      } catch {
        return [];
      }
    })
    .filter((t) => /autofill|darkfield|macronaut-dark-field/i.test(t));
  return { fields: out, autofillRules: sheets };
});

console.log(JSON.stringify(report, null, 2));
await browser.close();
