/** Walks welcome -> legal -> account setup -> create account in a real
 * browser and prints what each birthday field actually renders. Source
 * tests cannot catch a style that collapses text to zero width.
 *
 *   node scripts/probe-signup.mjs [baseUrl]
 *
 * Defaults to the live site. Set CHROME_PATH for a non-standard Chrome. */
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
await page.setViewport({ width: 430, height: 900, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
page.on('console', (m) => console.log(`[console.${m.type()}]`, m.text()));
page.on('pageerror', (e) => console.log('[pageerror]', e.message));

const log = (...a) => console.log(...a);

async function findByText(text, role) {
  return page.evaluateHandle(
    (t, r) => {
      const all = Array.from(document.querySelectorAll('*'));
      const hit = all.filter((el) => {
        if (r && el.getAttribute('role') !== r) return false;
        const own = Array.from(el.childNodes)
          .filter((n) => n.nodeType === 3)
          .map((n) => n.textContent.trim())
          .join('');
        return own === t || el.textContent.trim() === t;
      });
      return hit[hit.length - 1] ?? null;
    },
    text,
    role ?? null,
  );
}

async function clickText(text) {
  const handle = await findByText(text);
  const el = handle.asElement();
  if (!el) throw new Error(`no element with text: ${text}`);
  await el.evaluate((n) => n.scrollIntoView({ block: 'center' }));
  await el.click();
  await new Promise((r) => setTimeout(r, 600));
}

async function dumpFields(label) {
  const data = await page.evaluate(() => {
    const inputs = Array.from(document.querySelectorAll('input')).map((i) => ({
      label: i.getAttribute('aria-label'),
      value: i.value,
      placeholder: i.placeholder,
      type: i.type,
    }));
    const labelled = Array.from(document.querySelectorAll('[aria-label]'))
      .filter((el) => el.tagName !== 'INPUT')
      .map((el) => ({
        label: el.getAttribute('aria-label'),
        role: el.getAttribute('role'),
        text: el.textContent.trim().slice(0, 40),
      }));
    return {
      url: location.href,
      session: sessionStorage.getItem('macronaut-signup-draft'),
      title: document.body.innerText.split('\n').slice(0, 3),
      inputs,
      labelled,
    };
  });
  log(`\n===== ${label} =====`);
  log(JSON.stringify(data, null, 2));
  return data;
}

log('opening', BASE);
await page.goto(`${BASE}/?_t=${Date.now()}`, { waitUntil: 'networkidle2' });
await new Promise((r) => setTimeout(r, 2500));
await dumpFields('welcome');

await clickText('Create Account');
await new Promise((r) => setTimeout(r, 1200));
await dumpFields('legal');

const agree = await page.$('[aria-label="Agree to the Terms of Service and Privacy Policy"]');
await agree.click();
await new Promise((r) => setTimeout(r, 400));
await clickText('Save and continue');
await new Promise((r) => setTimeout(r, 1200));
await dumpFields('account setup');

// Month -> August
await clickText('January');
await new Promise((r) => setTimeout(r, 500));
await clickText('August');
await new Promise((r) => setTimeout(r, 500));

const dayInput = await page.$('input[aria-label="Day"]');
await dayInput.click();
await page.keyboard.type('4');
const yearInput = await page.$('input[aria-label="Year"]');
await yearInput.click();
await page.keyboard.type('1992');
await new Promise((r) => setTimeout(r, 500));
await dumpFields('account setup filled');

await clickText('Continue');
await new Promise((r) => setTimeout(r, 2000));
const after = await dumpFields('credentials');
await page.screenshot({ path: '/tmp/credentials.png', fullPage: true });
log('\nscreenshot: /tmp/credentials.png');

await browser.close();
