/** Click Not now on the Apple Health ask and report where you land. */
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
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--window-size=430,900'],
});
const page = await browser.newPage();
await page.setViewport({ width: 430, height: 900, isMobile: true, hasTouch: true });
page.on('pageerror', (e) => console.log('[pageerror]', e.message));

const paths = ['/signup-health', '/signup-health.html'];
for (const path of paths) {
  const res = await page.goto(`${BASE}${path}?_t=${Date.now()}`, { waitUntil: 'networkidle2' });
  await new Promise((r) => setTimeout(r, 2500));
  if (res?.ok()) break;
}

const before = await page.evaluate(() => ({
  url: location.href,
  title: document.body.innerText.slice(0, 200),
}));
console.log('BEFORE', JSON.stringify(before, null, 2));

const skip = await page.$('[aria-label="Not now"]');
if (!skip) {
  console.log('FAIL no Not now button');
  await page.screenshot({ path: '/tmp/not-now.png', fullPage: true });
  await browser.close();
  process.exit(1);
}
await skip.click();
await new Promise((r) => setTimeout(r, 2500));

const after = await page.evaluate(() => ({
  url: location.href,
  text: document.body.innerText,
  entered: sessionStorage.getItem('macronaut-entered-app'),
}));
await page.screenshot({ path: '/tmp/not-now.png', fullPage: true });
console.log('AFTER', JSON.stringify({
  url: after.url,
  entered: after.entered,
  hasWelcome: /Create Account/.test(after.text) && /Sign In/.test(after.text),
  hasToday: /Today/.test(after.text),
  hasBreakfast: /Breakfast/.test(after.text),
  hasGood: /Good (morning|afternoon|evening|night)/.test(after.text),
  snippet: after.text.split('\n').filter(Boolean).slice(0, 20),
}, null, 2));

const ok =
  !/welcome/i.test(after.url) &&
  after.entered === '1' &&
  /Today/.test(after.text) &&
  !(/Create Account/.test(after.text) && /Sign In/.test(after.text) && /More options/.test(after.text));

await browser.close();
if (!ok) {
  console.log('FAIL landed on welcome or dashboard missing');
  process.exit(1);
}
console.log('OK dashboard');
