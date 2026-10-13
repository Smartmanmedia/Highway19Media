/* THE WHOLE PAGE AS ONE SVG.
 * ---------------------------------------------------------------------------
 * His eight artboards are already vector, and the question cards on top of
 * them are HTML. This takes the page as the browser finally has it - after
 * the build has cut his drawn header out and snapped his road pieces
 * together, and after qa.js has joined his seam signs, stacked his sky and
 * lifted his boards - and writes one SVG at his own scale: 2128 units wide,
 * which is his artboard, and as tall as the page is.
 *
 * WHY FROM THE BROWSER AND NOT FROM assets/scene/sec-0N.svg. Those are the
 * input, not the output. Half a dozen passes stand between them and what a
 * reader sees, and a file stitched from them is a page nobody ever gets.
 *
 * The cards are redrawn as real SVG - a rounded rect, his lettering as live
 * text, his plus mark - rather than wrapped in a foreignObject, because a
 * foreignObject is a blank rectangle in Illustrator.
 *
 *   node tools/qa/pagesvg.js [url] [out.svg]
 * defaults: http://127.0.0.1:8783/faq/  ->  dist/highway19-faq-page.svg
 */
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..', '..');
const URL = process.argv[2] || 'http://127.0.0.1:8783/faq/';
const OUT = process.argv[3] || path.join(ROOT, 'dist', 'highway19-faq-page.svg');

(async () => {
const b = await chromium.launch({ executablePath: process.env.CHROME_PATH });
/* 1960, WHERE ONE PIXEL IS ONE OF HIS UNITS. The page's unit is
   min(1px, 100vw/1960), and past 1960 qa.css overrides that to
   calc(100vw/1960) so the whole design grows with the window: there is no
   width at which it stops scaling, and at 2128 every number would come off
   the page 8.57% large. At exactly 1960 the unit is 1px and nothing has to
   be divided back out.
   This is also the page's own width. His artboard is 2128, so 84 units at
   each edge are bleed the reader never sees at any window size, and what
   the file holds is the page, not the artboard. */
const p = await b.newPage({ viewport: { width: 1960, height: 1200 } });
await p.goto(URL, { waitUntil: 'load' });
await p.waitForTimeout(3500);          /* his fonts, and the traffic settling */

/* HIS TRAFFIC IS ONLY DRAWN WHERE IT CAN BE SEEN. The engine keeps nodes
 * for the cars inside the window and a little either side, and frees the
 * rest - so reading the whole page in one go from the top gives a file with
 * cars on his first road and empty tarmac on all the others. Each section is
 * brought on screen and left a moment for the traffic to fill before it is
 * read. */
const SECS = await p.evaluate(() =>
  [...document.querySelectorAll('#page > .sec')].map(s => s.id));
for (const id of SECS) {
  await p.evaluate(id => {
    const s = document.getElementById(id);
    window.scrollTo({ top: s.getBoundingClientRect().top + window.scrollY - 200,
                      left: 0, behavior: 'instant' });
  }, id);
  await p.waitForTimeout(900);
  await p.evaluate(id => {
    const s = document.getElementById(id);
    /* HIS SIGNS GO BACK WHERE HE DREW THEM. A board and the clouds above it
       ride the scroll: qa.js moves them by (0.5 - p) * travel, so they sit
       on his own artboard only at the moment their middle crosses the
       middle of the window and are above or below it everywhere else. A
       file cannot hold a scroll position, and a sign frozen mid-travel is a
       sign in a place he never put it, so the ride is zeroed and only the
       swell - the forty per cent his green boards carry at every scroll -
       is kept. */
    s.querySelectorAll('[data-sign], [data-para]').forEach(g => {
      const t = g.getAttribute('transform');
      if (t) g.setAttribute('transform',
        t.replace(/^translate\(0 [-\d.]+\)/, 'translate(0 0)'));
    });
    (window.__grab = window.__grab || {})[id] =
      [...s.querySelectorAll('.art, .art-a, .art-b')].map(a => a.querySelector('svg').innerHTML);
  }, id);
}
await p.evaluate(() => window.scrollTo({ top: 0, left: 0, behavior: 'instant' }));
await p.waitForTimeout(600);

const data = await p.evaluate(() => {
  const page = document.getElementById('page');
  const pr = page.getBoundingClientRect();
  const ART = pr.width;          /* the page as it stands, measured */
  const cv = document.createElement('canvas').getContext('2d');

  /* where a line of text sits on its baseline, from the font's own metrics */
  const baseline = (rect, fontCss) => {
    cv.font = fontCss;
    const m = cv.measureText('Hxy');
    const asc = m.fontBoundingBoxAscent, desc = m.fontBoundingBoxDescent;
    if (!asc) return rect.top + rect.height * 0.78;
    return rect.top + (rect.height - (asc + desc)) / 2 + asc;
  };
  /* one entry per visual line: its text, its box - walked a character at a
     time, because a wrapped question has no element to measure per line */
  const lines = node => {
    const t = node.firstChild;
    if (!t || t.nodeType !== 3) return [];
    const s = t.nodeValue, out = [];
    let cur = null;
    for (let i = 0; i < s.length; i++) {
      const r = document.createRange();
      r.setStart(t, i); r.setEnd(t, i + 1);
      const b = r.getBoundingClientRect();
      if (!b.width && !b.height) { if (cur) cur.text += s[i]; continue; }
      if (!cur || Math.abs(b.top - cur.top) > 2) {
        cur = { text: s[i], top: b.top, bottom: b.bottom, left: b.left };
        out.push(cur);
      } else { cur.text += s[i]; cur.bottom = Math.max(cur.bottom, b.bottom); }
    }
    return out.map(l => ({ text: l.text.replace(/\s+$/, ''), top: l.top,
                           height: l.bottom - l.top, left: l.left }));
  };

  /* THE FRAME IS THE PAGE, NOT THE ARTBOARD. Two different things are
     anchored two different ways: his art is a 3088-unit box centred on the
     window, and the cards are laid out from the window's left edge. Measure
     either one against the other and the file is right only at the one
     window width where they happen to agree. Measure both against the page
     and the file is a picture of the page, which is what it is for. */

  const secs = [];
  document.querySelectorAll('#page > .sec').forEach(sec => {
    const sr = sec.getBoundingClientRect();
    const y0 = sr.top - pr.top;
    const X0 = pr.left;                        /* the page's left edge */
    const parts = [...sec.querySelectorAll('.art, .art-a, .art-b')].map(a => {
      const svg = a.querySelector('svg');
      const vb = (svg.getAttribute('viewBox') || '').split(/[\s,]+/).map(Number);
      const ar = a.getBoundingClientRect(), vr = svg.getBoundingClientRect();
      /* what the reader is actually shown: the drawing's own viewport, cut
         again by the box it sits in where that box clips. */
      const top = Math.max(ar.top, vr.top) - sr.top;
      const bot = Math.min(ar.bottom, vr.bottom) - sr.top;
      /* the drawing's own scale, and where its viewBox origin lands on the
         page - measured, so a board drawn at any size still comes out right */
      const k = vb[3] ? vr.height / vb[3] : 1;
      return { top, h: bot - top, scale: k,
               tx: (vr.left - X0) - (vb[0] || 0) * k,
               ty: (vr.top - sr.top) - (vb[1] || 0) * k,
               svg: svg.innerHTML };
    });
    /* the copy taken while this section was on screen, traffic and all */
    const grabbed = (window.__grab || {})[sec.id];
    if (grabbed) grabbed.forEach((html, i) => { if (parts[i]) parts[i].svg = html; });

    /* his cards, as they stand on the page: shut, one rounded box each */
    const cards = [];
    sec.querySelectorAll('.qa').forEach(c => {
      const cr = c.getBoundingClientRect(), cs = getComputedStyle(c);
      const btn = c.querySelector('.qa-q'), span = btn.querySelector('span');
      const bs = getComputedStyle(btn);
      const font = bs.fontStyle + ' ' + bs.fontWeight + ' ' + bs.fontSize + ' ' + bs.fontFamily;
      const mark = c.querySelector('.qa-m');
      const mr = mark ? mark.getBoundingClientRect() : null;
      const ms = mark ? getComputedStyle(mark) : null;
      const bar = mark ? getComputedStyle(mark, '::before').getPropertyValue('width') : null;
      const thick = mark ? getComputedStyle(mark, '::before').getPropertyValue('height') : null;
      cards.push({
        x: cr.left - X0, y: cr.top - sr.top, w: cr.width, h: cr.height,
        rx: parseFloat(cs.borderTopLeftRadius) || 0,
        fill: cs.backgroundColor, stroke: cs.borderTopColor,
        sw: parseFloat(cs.borderTopWidth) || 0,
        qFamily: bs.fontFamily, qSize: parseFloat(bs.fontSize),
        qWeight: bs.fontWeight, qFill: bs.color,
        qLetter: bs.letterSpacing === 'normal' ? 0 : parseFloat(bs.letterSpacing),
        lines: lines(span).map(l => ({
          text: l.text, x: l.left - X0, y: baseline(l, font) - sr.top })),
        mark: mr ? { cx: mr.left - X0 + mr.width / 2, cy: mr.top - sr.top + mr.height / 2,
                     r: mr.width / 2, fill: ms.backgroundColor,
                     bar: parseFloat(bar) || 0, thick: parseFloat(thick) || 0,
                     barFill: getComputedStyle(mark, '::before').backgroundColor } : null
      });
    });
    secs.push({ id: sec.id, y: y0, h: sr.height, parts, cards });
  });

  /* the vehicle sprites every <use> in the art points at */
  const host = [...document.querySelectorAll('body > svg')]
    .find(s => (s.getAttribute('style') || '').includes('width:0'));
  return { secs, sprites: host ? host.innerHTML : '',
           w: ART, h: pr.height };
});
await b.close();

/* HIS TYPE TRAVELS WITH IT. His artboards set text with Illustrator's
 * PostScript names and a glyph-by-glyph x position, so with the font missing
 * the letters keep their places and the shapes change under them - his
 * headline comes out visibly mis-spaced. A page gets the faces from the
 * site's stylesheet; a file on its own has to carry them, so the three the
 * art and the cards actually ask for go in as base64 under every name that
 * names them. About seventy kilobytes, and the file is then correct opened
 * anywhere, by anyone, offline. */
const FONTS = [
  { file: 'bvp-600.woff2',  as: ['BeVietnamPro-SemiBold'], weight: 600 },
  { file: 'bvp-800.woff2',  as: ['BeVietnamPro-ExtraBold'], weight: 800 },
  { file: 'arimo-700.woff2', as: ['Arial-BoldMT'], weight: 700 },
];
function fontCss() {
  const css = [];
  for (const f of FONTS) {
    const at = path.join(ROOT, 'assets', 'fonts', f.file);
    if (!fs.existsSync(at)) { console.warn('  (missing font ' + f.file + ')'); continue; }
    const b64 = fs.readFileSync(at).toString('base64');
    const src = "url(data:font/woff2;base64," + b64 + ") format('woff2')";
    /* under its own PostScript name, at any weight - the name IS the weight */
    for (const name of f.as)
      css.push("@font-face{font-family:'" + name + "';src:" + src + "}");
    /* and under the family the fallback list names, at its own weight */
    css.push("@font-face{font-family:'Be Vietnam Pro';font-weight:" + f.weight +
             ";src:" + src + "}");
    css.push("@font-face{font-family:'Arimo';font-weight:" + f.weight + ";src:" + src + "}");
  }
  return css.join('\n');
}

/* a file's own pixel size, off its header - the symbol's viewBox is in the
   image's own units, so the <use> that replaces an <image> scales it the
   same way the <image> did */
function pngOrWebpSize(buf, ext) {
  try {
    if (ext === 'png' && buf.readUInt32BE(12) === 0x49484452)
      return [buf.readUInt32BE(16), buf.readUInt32BE(20)];
    if (ext === 'webp' && buf.toString('ascii', 8, 12) === 'WEBP') {
      const c = buf.toString('ascii', 12, 16);
      if (c === 'VP8X') return [(buf.readUIntLE(24, 3) & 0xffffff) + 1,
                                (buf.readUIntLE(27, 3) & 0xffffff) + 1];
      if (c === 'VP8 ') return [buf.readUInt16LE(26) & 0x3fff, buf.readUInt16LE(28) & 0x3fff];
      if (c === 'VP8L') { const b = buf.readUInt32LE(21);
        return [(b & 0x3fff) + 1, ((b >> 14) & 0x3fff) + 1]; }
    }
    if ((ext === 'jpg' || ext === 'jpeg')) {
      let i = 2;
      while (i < buf.length) {
        if (buf[i] !== 0xff) { i++; continue; }
        const m = buf[i + 1];
        if (m >= 0xc0 && m <= 0xcf && m !== 0xc4 && m !== 0xc8 && m !== 0xcc)
          return [buf.readUInt16BE(i + 7), buf.readUInt16BE(i + 5)];
        i += 2 + buf.readUInt16BE(i + 2);
      }
    }
  } catch (e) {}
  return null;
}

const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const n = v => (Math.round(v * 100) / 100);
const out = [];
out.push('<?xml version="1.0" encoding="UTF-8"?>');
out.push('<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"' +
  ' viewBox="0 0 ' + n(data.w) + ' ' + n(data.h) + '" width="' + n(data.w) + '" height="' + n(data.h) + '">');
out.push('<title>Highway 19 Media - Questions &amp; Answers</title>');
out.push('<style type="text/css"><![CDATA[\n' + fontCss() + '\n]]></style>');
if (data.sprites) out.push('<defs id="vehicles">' + data.sprites + '</defs>');

data.secs.forEach((s, i) => {
  out.push('<g id="' + s.id + '" transform="translate(0 ' + n(s.y) + ')">');
  /* EVERY PART IS CUT TO ITS OWN BOX, not just the ones the page sets to
     clip. An <svg> element is a viewport: anything his artboard draws above
     or below the viewBox is simply not painted. Lifting the drawing out of
     it and into a <g> throws that away, and his night sky - which section
     three carries from y=-1645 up - then paints straight over the section
     before it. A rect the size of the part puts the viewport back. */
  s.parts.forEach((a, j) => {
    const id = s.id + '-art' + (s.parts.length > 1 ? String.fromCharCode(97 + j) : '');
    out.push('<clipPath id="clip-' + id + '"><rect x="0" y="' + n(a.top) +
             '" width="' + n(data.w) + '" height="' + n(a.h) + '"/></clipPath>');
    out.push('<g clip-path="url(#clip-' + id + ')">');
    out.push('<g id="' + id + '" transform="translate(' + n(a.tx) + ' ' + n(a.ty) + ')' +
             (Math.abs(a.scale - 1) > 1e-4 ? ' scale(' + n(a.scale) + ')' : '') + '">');
    out.push(a.svg);
    out.push('</g>');
    out.push('</g>');
  });
  if (s.cards.length) {
    out.push('<g id="' + s.id + '-cards">');
    s.cards.forEach((c, k) => {
      out.push('<g id="' + s.id + '-card' + (k + 1) + '">');
      out.push('<rect x="' + n(c.x) + '" y="' + n(c.y) + '" width="' + n(c.w) +
        '" height="' + n(c.h) + '" rx="' + n(c.rx) + '" ry="' + n(c.rx) +
        '" fill="' + c.fill + '"' +
        (c.sw ? ' stroke="' + c.stroke + '" stroke-width="' + n(c.sw) + '"' : '') + '/>');
      c.lines.forEach(l => {
        out.push('<text x="' + n(l.x) + '" y="' + n(l.y) + '" fill="' + c.qFill +
          '" font-family="' + esc(c.qFamily) + '" font-size="' + n(c.qSize) +
          '" font-weight="' + c.qWeight + '"' +
          (c.qLetter ? ' letter-spacing="' + n(c.qLetter) + '"' : '') +
          ' xml:space="preserve">' + esc(l.text) + '</text>');
      });
      if (c.mark) {
        const m = c.mark;
        out.push('<circle cx="' + n(m.cx) + '" cy="' + n(m.cy) + '" r="' + n(m.r) +
                 '" fill="' + m.fill + '"/>');
        out.push('<rect x="' + n(m.cx - m.bar / 2) + '" y="' + n(m.cy - m.thick / 2) +
                 '" width="' + n(m.bar) + '" height="' + n(m.thick) + '" fill="' + m.barFill + '"/>');
        out.push('<rect x="' + n(m.cx - m.thick / 2) + '" y="' + n(m.cy - m.bar / 2) +
                 '" width="' + n(m.thick) + '" height="' + n(m.bar) + '" fill="' + m.barFill + '"/>');
      }
      out.push('</g>');
    });
    out.push('</g>');
  }
  out.push('</g>');
});
out.push('</svg>');

/* HIS RASTERS TRAVEL WITH IT TOO. The art points at eight files under
 * /assets/img - his trees, his forest, his industrial block - by URL, which
 * resolves on the site and nowhere else: opened as a file they are eight
 * holes in the picture. Each one goes in once, as a symbol, and every
 * reference to it becomes a <use> of that symbol. Once, because his tree is
 * placed sixty-eight times and his forest tile nine, and inlining the bytes
 * at each would make a file of two hundred megabytes.
 * A <use> of a <symbol> takes the x, y, width and height the <image> had,
 * and the symbol's viewBox is the file's own pixels, so nothing moves. None
 * of his images sets preserveAspectRatio, and the default is the same on
 * both, so nothing stretches either. */
let svg = out.join('\n');
{
  const TYPE = { webp: 'image/webp', png: 'image/png', jpg: 'image/jpeg',
                 jpeg: 'image/jpeg', gif: 'image/gif', svg: 'image/svg+xml' };
  const urls = [...new Set([...svg.matchAll(/(?:xlink:)?href="(\/assets\/[^"]+)"/g)]
    .map(m => m[1]))];
  const syms = [];
  let inlined = 0, bytes = 0;
  for (const u of urls) {
    const file = path.join(ROOT, u.replace(/^\//, ''));
    if (!fs.existsSync(file)) { console.warn('  (missing ' + u + ')'); continue; }
    const ext = (u.match(/\.(\w+)$/) || [,''])[1].toLowerCase();
    const id = 'img-' + path.basename(u).replace(/\.\w+$/, '').replace(/[^\w-]/g, '');
    const buf = fs.readFileSync(file);
    const dim = pngOrWebpSize(buf, ext);
    syms.push('<symbol id="' + id + '"' +
      (dim ? ' viewBox="0 0 ' + dim[0] + ' ' + dim[1] + '"' : '') + '>' +
      '<image width="' + (dim ? dim[0] : 1) + '" height="' + (dim ? dim[1] : 1) +
      '" href="data:' + (TYPE[ext] || 'image/png') + ';base64,' + buf.toString('base64') +
      '"/></symbol>');
    /* every <image> that pointed at it becomes a <use> of the symbol -
       the WHOLE element, closing tag and all. An <image> serialises as a
       pair, <image ...></image>, so swapping only the opening tag leaves a
       </image> with no opening and the file does not parse at all. */
    const q = u.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const re = new RegExp('<image\\b([^>]*?)(?:xlink:)?href="' + q +
                          '"([^>]*?)\\s*/?>(?:\\s*</image>)?', 'g');
    svg = svg.replace(re, (m, a, b) =>
      '<use' + a + 'href="#' + id + '"' + b + '/>');
    inlined++; bytes += buf.length;
  }
  if (syms.length)
    svg = svg.replace('<defs id="vehicles">',
      '<defs id="art-images">' + syms.join('') + '</defs>\n<defs id="vehicles">');
  console.log('  ' + inlined + ' rasters inlined, ' + Math.round(bytes / 1024) + ' KB of art');
}

/* AND IT HAS TO PARSE. A malformed SVG does not degrade - a browser shows
 * an error page and Illustrator refuses it - and the way to find out is to
 * hand it to a parser here rather than to him. */
{
  const bad = [];
  const tags = svg.match(/<\/?([a-zA-Z][\w:-]*)\b[^>]*>/g) || [];
  const stack = [];
  for (const t of tags) {
    if (/^<\?|^<!/.test(t)) continue;
    const name = t.match(/^<\/?([a-zA-Z][\w:-]*)/)[1];
    if (t.startsWith('</')) {
      if (stack.pop() !== name) { bad.push('mismatched </' + name + '>'); break; }
    } else if (!t.endsWith('/>')) stack.push(name);
  }
  if (stack.length) bad.push('unclosed <' + stack[stack.length - 1] + '>');
  if (bad.length) { console.error('NOT WELL FORMED: ' + bad.join('; ')); process.exit(1); }
}

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, svg);
console.log(path.relative(ROOT, OUT) + '  ' + n(data.w) + ' x ' + n(data.h) + ' units, ' +
  data.secs.length + ' sections, ' +
  data.secs.reduce((t, s) => t + s.cards.length, 0) + ' questions, ' +
  Math.round(fs.statSync(OUT).size / 1024) + ' KB');
})();
