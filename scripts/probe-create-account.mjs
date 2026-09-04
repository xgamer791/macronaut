/**
 * Drives create-account in a real browser against a real Convex deployment,
 * then signs out and signs back in with the same credentials.
 *
 * Usage:
 *   node scripts/probe-create-account.mjs [siteUrl]
 *
 * The site must be built with EXPO_PUBLIC_CONVEX_URL pointing at a deployment
 * that has this branch's functions. What it reports is where the browser landed
 * at each step; the account rows themselves are checked separately, straight
 * off the deployment.
 */
import { existsSync } from 'node:fs';
import puppeteer from 'puppeteer-core';

const BASE = process.argv[2] ?? 'http://127.0.0.1:8080';
const CHROME =
  process.env.CHROME_PATH ??
  ['/usr/local/bin/google-chrome', '/usr/bin/google-chrome', '/usr/bin/chromium'].find((p) =>
    existsSync(p),
  );
if (!CHROME) throw new Error('no Chrome found; set CHROME_PATH');

const stamp = Date.now();
const ACCOUNT = {
  name: 'Christopher Garcia',
  email: `probe+${stamp}@macronaut.test`,
  password: 'Probe1234',
  month: 'August',
  day: '4',
  year: '1992',
};
console.log('ACCOUNT', JSON.stringify({ ...ACCOUNT, password: '<redacted>' }));

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: 'new',
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--window-size=430,900'],
});
const page = await browser.newPage();
await page.setViewport({ width: 430, height: 900, isMobile: true, hasTouch: true });
const failures = [];
page.on('pageerror', (e) => {
  console.log('[pageerror]', e.message);
  failures.push(`pageerror: ${e.message}`);
});
page.on('console', (m) => {
  if (m.type() === 'error') console.log('[console.error]', m.text());
});

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

// Expo Router keeps the screens behind the top one mounted, so every label can
// match more than once. The last match is the screen on top.
async function topmost(selector) {
  const handle = await page.evaluateHandle((sel) => {
    const all = Array.from(document.querySelectorAll(sel));
    return all[all.length - 1] ?? null;
  }, selector);
  return handle.asElement();
}

async function clickAria(label) {
  const el = await topmost(`[aria-label="${label}"]`);
  if (!el) throw new Error(`missing control ${label}`);
  await el.evaluate((n) => {
    n.scrollIntoView({ block: 'center' });
    n.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
  });
  await wait(600);
}

async function clickText(text) {
  const handle = await page.evaluateHandle((t) => {
    const all = Array.from(document.querySelectorAll('[role="button"], [role="link"], button, a'));
    const hits = all.filter((el) => el.textContent.trim() === t);
    return hits[hits.length - 1] ?? null;
  }, text);
  const el = handle.asElement();
  if (!el) throw new Error(`missing control with text ${text}`);
  await el.evaluate((n) => {
    n.scrollIntoView({ block: 'center' });
    n.click();
  });
  await wait(700);
}

/** A row whose label runs on into a subtitle, so the text is not the whole of it. */
async function clickRowStartingWith(text) {
  const handle = await page.evaluateHandle((t) => {
    const all = Array.from(document.querySelectorAll('[role="button"], [role="link"], button, a'));
    const hits = all.filter((el) => el.textContent.trim().startsWith(t));
    return hits[hits.length - 1] ?? null;
  }, text);
  const el = handle.asElement();
  if (!el) throw new Error(`missing row starting with ${text}`);
  await el.evaluate((n) => {
    n.scrollIntoView({ block: 'center' });
    n.click();
  });
  await wait(800);
}

async function typeAria(label, value) {
  const el = await topmost(`input[aria-label="${label}"]`);
  if (!el) throw new Error(`missing input ${label}`);
  await el.click();
  await page.keyboard.down('Control');
  await page.keyboard.press('KeyA');
  await page.keyboard.up('Control');
  await page.keyboard.press('Backspace');
  await page.keyboard.type(value, { delay: 15 });
  const typed = await el.evaluate((n) => n.value);
  if (typed !== value) throw new Error(`${label} holds ${JSON.stringify(typed)}`);
}

function bodyText() {
  return page.evaluate(() => ({ url: location.href, text: document.body.innerText }));
}

const steps = [];
function step(name, ok, detail) {
  steps.push({ name, ok, ...(detail ? { detail } : {}) });
  console.log(ok ? 'OK  ' : 'FAIL', name, detail ? JSON.stringify(detail) : '');
  if (!ok) failures.push(name);
}

console.log('opening', BASE);
await page.goto(`${BASE}/?_t=${stamp}`, { waitUntil: 'networkidle2' });
await wait(2500);

// Welcome: two CTAs and no provider buttons at all.
{
  const { text } = await bodyText();
  step('welcome offers Create Account and Sign In', /Create Account/.test(text) && /Sign In/.test(text));
  step('welcome offers no Google or Apple sign-in', !/Google/i.test(text) && !/Continue with Apple/i.test(text), {
    google: /Google/i.test(text),
    apple: /Continue with Apple/i.test(text),
  });
}

await clickText('Create Account');
await wait(800);
{
  const { text } = await bodyText();
  step('legal gate opens', /Terms of Service/.test(text));
}
await clickAria('Agree to the Terms of Service and Privacy Policy');
await clickText('Save and continue');
await wait(900);

{
  const { text } = await bodyText();
  step('account setup opens', /Account Setup/.test(text));
}
await clickAria('Month');
await clickText(ACCOUNT.month);
await typeAria('Day', ACCOUNT.day);
await typeAria('Year', ACCOUNT.year);
await clickText('Continue');
await wait(1100);

{
  const { text } = await bodyText();
  step('create-account opens', /Create An Account/.test(text));
  step('create-account offers no Google or Apple', !/Google/i.test(text) && !/Continue with Apple/i.test(text));
}

// Date of birth arrives filled and locked from Account Setup.
{
  const dob = await page.evaluate(() => {
    const read = (label) => {
      const all = Array.from(document.querySelectorAll(`[aria-label="${label}"]`));
      const el = all[all.length - 1];
      if (!el) return null;
      return { text: el.textContent?.trim() ?? '', input: el.tagName === 'INPUT' };
    };
    return { month: read('Month'), day: read('Day'), year: read('Year') };
  });
  step(
    'date of birth is carried over and locked',
    dob.month?.text === ACCOUNT.month &&
      dob.day?.text === ACCOUNT.day &&
      dob.year?.text === ACCOUNT.year &&
      !dob.month?.input &&
      !dob.day?.input &&
      !dob.year?.input,
    dob,
  );
}

await typeAria('Name', ACCOUNT.name);
await typeAria('Email address', ACCOUNT.email);
await typeAria('Confirm email address', ACCOUNT.email);
await typeAria('Password', ACCOUNT.password);
await typeAria('Confirm password', ACCOUNT.password);

// Field text must be white on the dark video, autofill styling included.
{
  const colours = await page.evaluate(() =>
    ['Name', 'Email address', 'Password'].map((label) => {
      const all = Array.from(document.querySelectorAll(`input[aria-label="${label}"]`));
      const el = all[all.length - 1];
      if (!el) return { label, missing: true };
      const s = getComputedStyle(el);
      return { label, color: s.color, fill: s.webkitTextFillColor };
    }),
  );
  const white = colours.every(
    (c) => !c.missing && /rgb\(255,\s*255,\s*255\)/.test(c.fill ?? c.color),
  );
  step('field text is white', white, colours);
}

{
  const enabled = await page.evaluate(() => {
    const all = Array.from(document.querySelectorAll('[aria-label="Create Account"]'));
    return all[all.length - 1]?.getAttribute('aria-disabled');
  });
  step('Create Account is enabled once the form is valid', enabled !== 'true', { ariaDisabled: enabled });
}

await clickText('Create Account');
await wait(4000);

{
  const { url, text } = await bodyText();
  const hasNotNow = (await topmost('[aria-label="Not now"]')) !== null;
  step('account created, Apple Health ask opens', hasNotNow && /Apple Health/.test(text), {
    url,
    snippet: text.split('\n').map((s) => s.trim()).filter(Boolean).slice(0, 6),
  });
  if (!hasNotNow) {
    await page.screenshot({ path: '/tmp/probe-create-account-failed.png', fullPage: true });
  }
}

await clickAria('Not now');
await wait(3000);

{
  const { url, text } = await bodyText();
  const dashboard = /Today/.test(text) && /Breakfast/.test(text);
  step('Not now opens the dashboard', dashboard, {
    url,
    snippet: text.split('\n').map((s) => s.trim()).filter(Boolean).slice(0, 12),
  });
  step('dashboard greets the new account by name', /Christopher/.test(text));
  await page.screenshot({ path: '/tmp/probe-dashboard.png', fullPage: true });
}

// Settings shows how the account signs in, plus the date of birth and country.
await clickAria('Settings');
await wait(2500);
{
  const { text } = await bodyText();
  step('settings names the sign-in method', /email and password/i.test(text));
  step('settings shows the stored date of birth', /August 4, 1992/.test(text));
  step('settings shows the stored country', /United States/.test(text), {
    snippet: text.split('\n').map((s) => s.trim()).filter(Boolean).slice(0, 30),
  });
  await page.screenshot({ path: '/tmp/probe-settings.png', fullPage: true });
}

// Sign out, then back in with the same email and password.
await clickRowStartingWith('Sign out');
await wait(1000);
await clickText('Sign out');
await wait(3500);
{
  const { url, text } = await bodyText();
  step('signing out returns to welcome', /Create Account/.test(text) && /More options/.test(text), { url });
}

await clickText('Sign In');
await wait(1500);
{
  const { text } = await bodyText();
  step('sign-in screen opens', /Sign In/.test(text));
  step('sign-in offers no Google or Apple', !/Google/i.test(text) && !/Continue with Apple/i.test(text));
}

// Wrong password first: the account must not let anything through.
await typeAria('Email address', ACCOUNT.email);
await typeAria('Password', 'Wrong9999');
await clickAria('Sign In');
await wait(3500);
{
  const { text } = await bodyText();
  const stillOnSignIn = (await topmost('input[aria-label="Password"]')) !== null;
  step('the wrong password is refused, with a message', stillOnSignIn && /password/i.test(text), {
    snippet: text.split('\n').map((s) => s.trim()).filter(Boolean).slice(0, 10),
  });
}

await typeAria('Password', ACCOUNT.password);
await clickAria('Sign In');
await wait(4000);

// A returning account that never finished the goal wizard is taken to it, and
// the wizard already knows the name and the age the account was created with.
{
  const { url, text } = await bodyText();
  step('the right password signs the account back in', !/Sign In/.test(text), {
    url,
    snippet: text.split('\n').map((s) => s.trim()).filter(Boolean).slice(0, 6),
  });
  step('a returning account with no targets yet gets the goal wizard', /goal-setting|Macronaut/.test(text) && /\/onboarding$/.test(url), { url });
}

{
  const name = await page.evaluate(() => {
    const all = Array.from(document.querySelectorAll('input'));
    const el = all.find((n) => n.value === 'Christopher Garcia');
    return el?.value ?? null;
  });
  step('the wizard knows the name the account stored', name === 'Christopher Garcia', { name });
}

await clickText('Get started');
await wait(1200);
{
  const age = await page.evaluate(() => {
    const all = Array.from(document.querySelectorAll('input[aria-label="Age"]'));
    return all[all.length - 1]?.value ?? null;
  });
  step('the wizard knows the age the stored date of birth gives', age === '34', { age });
}

await clickText('Back');
await wait(900);
await clickText("Skip — I'll set my own targets");
await wait(4000);
{
  const { url, text } = await bodyText();
  const dashboard = /Today/.test(text) && /Breakfast/.test(text);
  step('skipping the wizard reaches the dashboard', dashboard, { url });
  step('the dashboard still greets the account by name', /Christopher/.test(text));
  await page.screenshot({ path: '/tmp/probe-signed-back-in.png', fullPage: true });
}

await browser.close();

console.log('\n=== SUMMARY ===');
for (const s of steps) console.log(`${s.ok ? 'OK  ' : 'FAIL'} ${s.name}`);
if (failures.length) {
  console.log(`\nFAIL (${failures.length}): ${failures.join('; ')}`);
  process.exit(1);
}
console.log(`\nOK all ${steps.length} steps. Account: ${ACCOUNT.email}`);
