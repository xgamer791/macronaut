/** Browser regression harness for the real exported welcome screen.
 * Run npm run export:web, then node scripts/preview-welcome.mjs.
 * Open http://localhost:8787/__welcome-qa and choose Run layout checks.
 * Nothing here is included in dist or shipped to users. No account is needed.
 */
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, resolve, sep } from 'node:path';

const root = resolve('dist');
const types = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.jpg': 'image/jpeg',
  '.png': 'image/png',
  '.mp4': 'video/mp4',
  '.ttf': 'font/ttf',
  '.json': 'application/json',
};

const harness = `<!doctype html><html><head><title>Welcome layout regression checks</title>
<style>body{font:14px system-ui;margin:16px;background:#e7e9ec}button,select,input{padding:8px;margin:4px}iframe{display:block;border:0;background:white}pre{white-space:pre-wrap}#viewport{overflow:auto;max-width:100%}</style></head><body>
<h1>Welcome layout regression checks</h1>
<button id="run">Run layout checks</button>
<select id="size" aria-label="Viewport"><option value="430,742">Buyer phone · 430 × 742</option><option value="390,664">Phone · 390 × 664</option><option value="375,548">Short phone · 375 × 548</option><option value="320,480">Small phone · 320 × 480</option><option value="844,390">Landscape · 844 × 390</option><option value="768,1024">Tablet · 768 × 1024</option><option value="1366,768">Desktop · 1366 × 768</option></select>
<button id="play">Play video</button><button id="still">Freeze video</button><input id="time" aria-label="Video time" type="number" min="0" max="18" value="6" step="0.25"><button id="seek">Show frame</button><button id="fallback">Simulate media error</button>
<pre id="result">Ready.</pre><div id="viewport"><iframe id="app" title="Welcome preview" width="430" height="742" src="/welcome"></iframe></div>
<script>
const app = document.querySelector('#app');
const result = document.querySelector('#result');
const delay = ms => new Promise(r => setTimeout(r, ms));
function video() { return app.contentDocument.querySelector('video'); }
function resize(w,h) { app.width = w; app.height = h; }
document.querySelector('#size').onchange = event => resize(...event.target.value.split(',').map(Number));
document.querySelector('#play').onclick = () => { if (video()) { video().playbackRate = 1; video().play(); } };
// Playback deliberately resumes on pause; freezing the rate keeps the real
// lifecycle intact while a reviewer inspects any frame in the 19s loop.
document.querySelector('#still').onclick = () => { if (video()) video().playbackRate = 0; };
document.querySelector('#seek').onclick = () => { if (video()) { video().playbackRate = 0; video().currentTime = +document.querySelector('#time').value; } };
document.querySelector('#fallback').onclick = () => video()?.dispatchEvent(new Event('error'));
function check(ok, message) { if (!ok) throw Error(message); }
document.querySelector('#run').onclick = async () => {
  result.textContent = 'Running…';
  const lines = [];
  try {
    const cases = [[430,742],[390,664],[375,548],[320,480],[844,390],[768,1024],[1366,768],[430,620],[430,820]];
    for (const [w,h] of cases) {
      resize(w,h); await delay(350);
      const doc = app.contentDocument, win = app.contentWindow, v = video();
      check(v && v.videoWidth === 1080 && v.videoHeight === 2340, 'Real video metadata missing');
      const rect = v.getBoundingClientRect(), css = win.getComputedStyle(v);
      check(css.objectFit === 'cover' && css.objectPosition === '50% 0%', 'Incorrect video framing');
      check(rect.height >= h && rect.height >= rect.width * 1.5 - 1, 'Portrait canvas collapsed into a banner');
      check(rect.width <= 600 && rect.width <= w, 'Hero overflows width');
      check(Math.abs(rect.left - (w - rect.width) / 2) < 1, 'Hero not horizontally centered');
      const poster = [...doc.querySelectorAll('img')].find(img => img.src.includes('welcome-poster'));
      check(poster && win.getComputedStyle(poster).objectPosition === '50% 0%', 'Poster framing differs');
      const buttons = [...doc.querySelectorAll('[role="button"]')].filter(b => ['Create Account','Sign In'].includes(b.getAttribute('aria-label')));
      check(buttons.length === 2, 'Missing welcome actions');
      for (const b of buttons) {
        b.scrollIntoView({block:'nearest'}); await delay(80);
        const r = b.getBoundingClientRect();
        check(r.top >= -1 && r.bottom <= h + 1 && r.left >= 0 && r.right <= w + 1, 'Action is not reachable: ' + b.textContent);
        const hit = doc.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
        check(hit && b.contains(hit), 'Video or overlay intercepts action');
      }
      v.scrollIntoView({block:'start'});
      lines.push('PASS ' + w + ' × ' + h + ' — crop, poster, centering, scrolling, touch targets');
      result.textContent = lines.join('\\n');
    }
    resize(430,742); video().scrollIntoView({block:'start'});
    result.textContent += '\\nAll 9 viewport checks passed.';
  } catch (error) { result.textContent = lines.join('\\n') + '\\nFAIL: ' + error.message; }
};
</script></body></html>`;

createServer(async (req, res) => {
  try {
    const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    if (pathname === '/__welcome-qa') {
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(harness);
      return;
    }
    let file = resolve(root, '.' + pathname);
    if (file !== root && !file.startsWith(root + sep)) {
      res.writeHead(403).end();
      return;
    }
    if (!extname(file)) {
      try {
        if ((await stat(file + '.html')).isFile()) file += '.html';
      } catch {
        file = resolve(file, 'index.html');
      }
    }
    const data = await readFile(file);
    res.writeHead(200, {
      'Content-Type': types[extname(file)] ?? 'application/octet-stream',
      'Cache-Control': 'no-store',
    });
    res.end(data);
  } catch {
    res.writeHead(404).end('Not found');
  }
}).listen(8787, '0.0.0.0', () => console.log('Welcome checks: http://localhost:8787/__welcome-qa'));
