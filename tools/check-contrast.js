#!/usr/bin/env node
/* Measure the contrast of every visible piece of copy against what is ACTUALLY
 * painted behind it.
 *
 * The naive version of this — sample the section's background colour — lies in
 * both directions: it misses copy sitting on a card, and it misses artwork that
 * has been placed behind the text. So instead each element is screenshotted and
 * the most common colour in its own box is taken as the background. Glyphs
 * cover well under half of a line box, so the mode IS the ground the text sits
 * on, whatever is producing it.
 */
const { chromium } = require('/home/user/storyboard-app/node_modules/playwright');
const decode = require('/tmp/claude-0/-home-user-storyboard-app/1a554a96-134b-52ef-894a-d9448b97add1/scratchpad/png.js');
const http = require('http'), fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..');

const lum = c => { const f = v => { v /= 255; return v <= 0.03928 ? v/12.92 : Math.pow((v+0.055)/1.055, 2.4); };
  return 0.2126*f(c[0]) + 0.7152*f(c[1]) + 0.0722*f(c[2]); };
const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m); return (x+0.05)/(y+0.05); };
const parse = s => (s.match(/\d+/g) || [0,0,0]).slice(0,3).map(Number);
const sleep = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  const srv = http.createServer((q, s) => {
    const f = path.join(ROOT, decodeURIComponent(q.url.split('?')[0]));
    if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { s.writeHead(404); return s.end(); }
    const t = {'.html':'text/html','.js':'application/javascript','.css':'text/css',
               '.svg':'image/svg+xml','.webp':'image/webp','.png':'image/png'}[path.extname(f)] || 'application/octet-stream';
    s.writeHead(200, { 'Content-Type': t }); s.end(fs.readFileSync(f));
  });
  await new Promise(r => srv.listen(8991, r));

  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args: ['--no-proxy-server','--ignore-certificate-errors','--no-sandbox'] });
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
  const errs = []; page.on('pageerror', e => errs.push(e.message));
  await page.goto('http://127.0.0.1:8991/index.html', { waitUntil: 'load' });
  await sleep(2200);
  await page.evaluate(() => {                     /* hold the traffic still */
    const h = document.querySelector('.road-hit');
    h && h.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });
  await sleep(4000);

  const items = await page.evaluate(() => {
    const out = [];
    document.querySelectorAll('section.sec').forEach(sec => {
      if (sec.hasAttribute('hidden')) return;
      const band = [...sec.classList].find(c => c.startsWith('band-')) || sec.id;
      sec.querySelectorAll('h1,h2,h3,p,li,.sub,.sec__lead').forEach((el, i) => {
        const t = el.textContent.trim();
        if (!t || !el.offsetHeight || el.querySelector('h1,h2,h3,p')) return;
        el.setAttribute('data-cc', sec.id + '-' + i);
        const cs = getComputedStyle(el);
        out.push({ key: sec.id + '-' + i, sec: sec.id, band, tag: el.tagName.toLowerCase(),
                   color: cs.color, size: parseFloat(cs.fontSize), weight: +cs.fontWeight,
                   text: t.replace(/\s+/g,' ').slice(0, 32) });
      });
    });
    return out;
  });

  let bad = 0, skipped = 0;
  console.log('elements found: ' + items.length);
  console.log('contrast against what is actually painted behind each line');
  console.log('(WCAG: 4.5 for body, 3.0 for large or bold)\n');
  for (const it of items) {
    /* The page sets scroll-behavior:smooth, so scrollIntoView animates and any
       rect read straight after it is stale. Jump instantly, then settle. */
    await page.evaluate(k => {
      const el = document.querySelector('[data-cc="' + k + '"]');
      const top = el.getBoundingClientRect().top + window.pageYOffset;
      window.scrollTo({ top: Math.max(0, top - window.innerHeight / 2), behavior: 'instant' });
    }, it.key);
    await sleep(120);
    const box = await page.evaluate(k => {
      const el = document.querySelector('[data-cc="' + k + '"]');
      const r = el.getBoundingClientRect();
      /* Clamp into the viewport: a clip that runs off the edge is rejected
         outright rather than being trimmed for you. */
      const x = Math.max(0, Math.round(r.left)), y = Math.max(0, Math.round(r.top));
      const w = Math.min(900, Math.round(r.right) - x, window.innerWidth - x);
      const h = Math.min(120, Math.round(r.bottom) - y, window.innerHeight - y);
      return { x: x, y: y, width: w, height: h };
    }, it.key);
    if (box.width < 4 || box.height < 4) {
      skipped++;
      if (skipped < 4) console.log('  skip ' + it.sec + ' ' + it.tag + ' box=' + JSON.stringify(box) + ' "' + it.text + '"');
      continue;
    }
    await sleep(90);
    const img = decode(await page.screenshot({ clip: box }));
    const counts = {};
    for (let y = 0; y < img.h; y++) for (let x = 0; x < img.w; x++) {
      const k = img.at(x, y).join(','); counts[k] = (counts[k] || 0) + 1;
    }
    /* Mode = background holds for body copy, where glyphs cover a fraction of
       the line box. It fails for a big bold heading, whose letters can cover
       more than half of it — then the mode IS the text. So take the most
       common colour that is not the text colour. */
    const txt = parse(it.color);
    const ranked = Object.entries(counts).sort((a,b) => b[1]-a[1])
      .map(([k,n]) => [k.split(',').map(Number), n]);
    const hit = ranked.find(([c]) =>
      Math.abs(c[0]-txt[0]) + Math.abs(c[1]-txt[1]) + Math.abs(c[2]-txt[2]) > 40);
    const bg = hit ? hit[0] : ranked[0][0];
    const cr = ratio(parse(it.color), bg);
    const large = it.size >= 24 || (it.size >= 18.66 && it.weight >= 700);
    const need = large ? 3.0 : 4.5;
    const ok = cr >= need;
    if (!ok) bad++;
    console.log('  ' + (ok ? 'ok  ' : 'FAIL') + ' ' + it.sec.padEnd(10) + it.band.padEnd(12) +
      it.tag.padEnd(3) + cr.toFixed(2).padStart(7) + '/' + need.toFixed(1) +
      '  on rgb(' + bg.join(',') + ')  "' + it.text + '"');
  }
  console.log('\nfailures: ' + bad + '   skipped (no measurable box): ' + skipped);
  console.log('page errors: ' + (errs.length ? errs.join('; ') : 'none'));
  await browser.close(); srv.close();
  process.exit(bad ? 1 : 0);
})();
