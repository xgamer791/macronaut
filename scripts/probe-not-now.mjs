/** Walk create-account to Apple Health, click Not now, report where you land. */
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

async function clickAria(label) {
  const el = await page.$(`[aria-label="${label}"]`);
  if (!el) throw new Error(`missing ${label}`);
  await el.evaluate((n) => n.scrollIntoView({ block: 'center' }));
  await el.click();
  await new Promise((r) => setTimeout(r, 500));
}

async function clickText(text) {
  const handle = await page.evaluateHandle((t) => {
    const all = Array.from(document.querySelectorAll('[role="button"], button, a'));
    const hits = all.filter((el) => el.textContent.trim() === t);
    return hits[hits.length - 1] ?? null;
  }, text);
  const el = handle.asElement();
  if (!el) throw new Error(`missing text ${text}`);
  await el.evaluate((n) => {
    n.scrollIntoView({ block: 'center' });
    n.click();
  });
  await new Promise((r) => setTimeout(r, 700));
}

async function typeAria(label, value) {
  const el = await page.$(`input[aria-label="${label}"]`);
  if (!el) throw new Error(`missing input ${label}`);
  await el.click({ clickCount: 3 });
  await page.keyboard.type(value, { delay: 20 });
}

console.log('opening', BASE);
await page.goto(`${BASE}/?_t=${Date.now()}`, { waitUntil: 'networkidle2' });
await new Promise((r) => setTimeout(r, 2500));

await clickText('Create Account');
await new Promise((r) => setTimeout(r, 800));
await clickAria('Agree to the Terms of Service and Privacy Policy');
await clickText('Save and continue');
await new Promise((r) => setTimeout(r, 800));

await clickAria('Month');
await clickText('August');
await typeAria('Day', '4');
await typeAria('Year', '1992');
await clickText('Continue');
await new Promise((r) => setTimeout(r, 1000));

await typeAria('Name', 'Christopher');
await typeAria('Email address', 'probe@example.com');
await typeAria('Confirm email address', 'probe@example.com');
await typeAria('Password', 'Probe1234');
await typeAria('Confirm password', 'Probe1234');
const creds = await page.evaluate(() => ({
  url: location.href,
  name: document.querySelector('input[aria-label="Name"]')?.value,
  email: document.querySelector('input[aria-label="Email address"]')?.value,
  password: document.querySelector('input[aria-label="Password"]')?.value,
  disabled: document.querySelector('[aria-label="Create Account"]')?.getAttribute('aria-disabled'),
}));
console.log('CREDS', JSON.stringify(creds));
await clickText('Create Account');
await new Promise((r) => setTimeout(r, 1500));

const onHealth = await page.evaluate(() => ({
  url: location.href,
  hasNotNow: !!document.querySelector('[aria-label="Not now"]'),
  text: document.body.innerText.slice(0, 180),
}));
console.log('HEALTH', JSON.stringify(onHealth, null, 2));
if (!onHealth.hasNotNow) {
  await page.screenshot({ path: '/tmp/not-now.png', fullPage: true });
  await browser.close();
  process.exit(1);
}

const skipInfo = await page.evaluate(() => {
  const el = document.querySelector('[aria-label="Not now"]');
  if (!el) return { missing: true };
  const r = el.getBoundingClientRect();
  el.scrollIntoView({ block: 'center' });
  el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
  return { w: r.width, h: r.height, text: el.textContent };
});
console.log('CLICK NOT NOW', JSON.stringify(skipInfo));
await new Promise((r) => setTimeout(r, 2500));

const after = await page.evaluate(() => ({
  url: location.href,
  text: document.body.innerText,
  entered: sessionStorage.getItem('macronaut-entered-app'),
}));
await page.screenshot({ path: '/tmp/not-now.png', fullPage: true });

const welcome = /Create Account/.test(after.text) && /Sign In/.test(after.text) && /More options/.test(after.text);
const dashboard = /Today/.test(after.text) && /Breakfast/.test(after.text);
console.log('AFTER', JSON.stringify({
  url: after.url,
  entered: after.entered,
  welcome,
  dashboard,
  snippet: after.text.split('\n').map((s) => s.trim()).filter(Boolean).slice(0, 24),
}, null, 2));

await browser.close();
if (welcome || /welcome/i.test(after.url) || !dashboard || after.entered !== '1') {
  console.log('FAIL');
  process.exit(1);
}
console.log('OK dashboard');
