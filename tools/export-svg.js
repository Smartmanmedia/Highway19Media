/* Exports the Q&A page as an editable SVG for Illustrator.
   ----------------------------------------------------------------------------
     node tools/export-svg.js  [url]  [out.svg]  [width]

   Walks the RENDERED page rather than the markup, so what comes out is what
   the browser actually laid out: real line breaks, real box geometry, the real
   road. Everything is a live object in Illustrator —

     * type is <text>, one <tspan> per rendered line, editable
     * boxes are <rect> with their own fill, stroke and corner radius
     * the road is his four stacked strokes, as paths
     * his SVG artwork is inlined as vectors, not pictures of vectors
     * raster (the shield, the social marks) is embedded base64

   Five top-level groups, which Illustrator reads as named layers:
     Background · Roads · Artwork · Boxes · Text

   Two deliberate choices:
     * every accordion is OPEN, so no copy is missing from the file
     * no vehicles. They are generated, they move, and they are not design.

   The real Be Vietnam Pro is loaded off assets/fonts/ before anything is
   measured — the page itself pulls it from Google Fonts, and measuring against
   a fallback would bake in the wrong line breaks.
*/
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const URL   = process.argv[2] || 'http://127.0.0.1:8777/faq.html';
const OUT   = process.argv[3] || path.join(__dirname, '..', 'dist', 'highway19-qa-artboard.svg');
const WIDTH = +(process.argv[4] || 1440);
const CHROME = process.env.CHROME_PATH || undefined;

const FACES = [
  ['BeVietnamPro-Light.woff2', 300], ['BeVietnamPro-Medium.woff2', 500],
  ['BeVietnamPro-Bold.woff2', 700], ['BeVietnamPro-ExtraBold.woff2', 800],
  ['BeVietnamPro-Black.woff2', 900],
];

(async () => {
  const browser = await chromium.launch({ executablePath: CHROME });
  const page = await browser.newPage({ viewport: { width: WIDTH, height: 1000 } });
  await page.goto(URL, { waitUntil: 'load' });

  /* His own font, off disk, before a single measurement. */
  const faces = FACES.map(([file, weight]) => {
    const b64 = fs.readFileSync(path.join(__dirname, '..', 'assets', 'fonts', file)).toString('base64');
    return `@font-face{font-family:"Be Vietnam Pro";font-weight:${weight};font-display:block;` +
           `src:url(data:font/woff2;base64,${b64}) format("woff2")}`;
  }).join('\n');
  await page.addStyleTag({ content: faces });
  await page.evaluate(() => document.fonts.ready);

  /* Every answer open, no vehicles, no motion. */
  await page.evaluate(() => {
    document.querySelectorAll('.qa-item').forEach(item => {
      item.classList.add('is-open');
      const p = item.querySelector('.qa-panel');
      if (p) p.hidden = false;
    });
  });
  await page.waitForTimeout(2200);          /* let the road re-fit to the new height */
  await page.evaluate(() => {
    document.querySelectorAll('.road-run__art').forEach(svg => {
      const fleet = svg.lastElementChild;
      if (fleet && fleet.tagName.toLowerCase() === 'g') fleet.remove();
    });
  });
  await page.waitForTimeout(300);

  /* ------------------------------------------------------------------------
     Everything below runs in the page.
     --------------------------------------------------------------------- */
  const doc = await page.evaluate(() => {
    const SY = () => window.scrollY;
    const R = n => Math.round(n * 100) / 100;
    const out = { bg: [], roads: [], art: [], boxes: [], text: [], defs: [], w: 0, h: 0 };
    out.w = document.documentElement.clientWidth;
    out.h = document.documentElement.scrollHeight;

    const metrics = {};
    const cv = document.createElement('canvas').getContext('2d');
    function fontBox(weight, size, family) {
      const key = weight + '|' + size + '|' + family;
      if (metrics[key]) return metrics[key];
      cv.font = `${weight} ${size}px ${family}`;
      const m = cv.measureText('Hxg');
      const v = { a: m.fontBoundingBoxAscent || size * 0.8,
                  d: m.fontBoundingBoxDescent || size * 0.2 };
      metrics[key] = v;
      return v;
    }

    function rgba(c) {
      if (!c || c === 'transparent') return null;
      const m = c.match(/rgba?\(([^)]+)\)/);
      if (!m) return null;
      const p = m[1].split(',').map(s => parseFloat(s));
      if (p.length > 3 && p[3] === 0) return null;
      const hex = '#' + p.slice(0, 3).map(n =>
        Math.round(n).toString(16).padStart(2, '0')).join('');
      return { hex, a: p.length > 3 ? p[3] : 1 };
    }

    /* A gradient background becomes a real gradient, not a flat guess. */
    let gradN = 0;
    function gradient(img, w, h) {
      const m = img.match(/linear-gradient\(([\s\S]+)\)$/);
      if (!m) return null;
      const body = m[1];
      const parts = [];
      let depth = 0, cur = '';
      for (const ch of body) {
        if (ch === '(') depth++;
        if (ch === ')') depth--;
        if (ch === ',' && depth === 0) { parts.push(cur.trim()); cur = ''; } else cur += ch;
      }
      parts.push(cur.trim());
      let angle = 180;
      if (/^-?[\d.]+deg$/.test(parts[0])) angle = parseFloat(parts.shift());
      else if (/^to /.test(parts[0])) {
        const to = parts.shift();
        angle = /right/.test(to) ? 90 : /left/.test(to) ? 270 : /top/.test(to) ? 0 : 180;
      }
      const stops = parts.map((p, i) => {
        const c = (p.match(/(rgba?\([^)]+\)|#[0-9a-f]{3,8})/i) || [])[1];
        const o = (p.match(/([\d.]+)%\s*$/) || [])[1];
        const col = rgba(c) || { hex: '#000000', a: 1 };
        return { col, off: o != null ? +o : (i / Math.max(1, parts.length - 1)) * 100 };
      }).filter(s => s.col);
      if (stops.length < 2) return null;
      const rad = (angle - 90) * Math.PI / 180;
      const id = 'grad' + (++gradN);
      out.defs.push({ id, x1: R(50 - Math.cos(rad) * 50), y1: R(50 - Math.sin(rad) * 50),
                      x2: R(50 + Math.cos(rad) * 50), y2: R(50 + Math.sin(rad) * 50), stops });
      return id;
    }

    /* ---- boxes ---------------------------------------------------------- */
    const SKIP = new Set(['SCRIPT', 'STYLE', 'HEAD', 'META', 'LINK', 'TITLE', 'BR', 'NOSCRIPT']);
    function visible(el) {
      const s = getComputedStyle(el);
      if (s.display === 'none' || s.visibility === 'hidden' || +s.opacity === 0) return false;
      const r = el.getBoundingClientRect();
      return r.width > 0.5 && r.height > 0.5;
    }

    function collectBoxes(el) {
      if (SKIP.has(el.tagName) || el.closest('.road-run__art')) return;
      if (!visible(el)) return;
      const s = getComputedStyle(el), r = el.getBoundingClientRect();
      const box = { x: R(r.left), y: R(r.top + SY()), w: R(r.width), h: R(r.height) };
      const fill = rgba(s.backgroundColor);
      const grad = s.backgroundImage.includes('linear-gradient')
        ? gradient(s.backgroundImage, r.width, r.height) : null;
      const bw = parseFloat(s.borderTopWidth) || 0;
      const bwB = parseFloat(s.borderBottomWidth) || 0;
      const stroke = bw > 0 ? rgba(s.borderTopColor) : null;
      const radius = parseFloat(s.borderTopLeftRadius) || 0;

      if (fill || grad || stroke) {
        const rec = Object.assign({}, box, {
          fill: grad ? 'url(#' + grad + ')' : (fill ? fill.hex : 'none'),
          op: fill && !grad ? fill.a : 1,
          rx: R(Math.min(radius, box.w / 2, box.h / 2)),
          stroke: stroke ? stroke.hex : null, sw: stroke ? R(bw) : 0,
          id: el.id || el.className.toString().split(' ')[0] || el.tagName.toLowerCase(),
        });
        /* Full-width grounds go behind everything; everything else is a box. */
        (box.w >= out.w - 2 && !el.classList.contains('qa-cta') ? out.bg : out.boxes).push(rec);
      }
      /* A heavy bottom edge on its own — the cards and the form both use one. */
      if (bwB > 0 && Math.abs(bwB - bw) > 0.5) {
        const c = rgba(s.borderBottomColor);
        if (c) out.boxes.push({ x: box.x, y: R(box.y + box.h - bwB), w: box.w, h: R(bwB),
                                fill: c.hex, op: c.a, rx: 0, stroke: null, sw: 0,
                                id: 'edge' });
      }
      for (const kid of el.children) collectBoxes(kid);
    }

    /* ---- type ------------------------------------------------------------ */
    function collectText(root) {
      const walk = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
        acceptNode(n) {
          if (!n.nodeValue.trim()) return NodeFilter.FILTER_REJECT;
          const p = n.parentElement;
          if (!p || SKIP.has(p.tagName) || p.closest('svg')) return NodeFilter.FILTER_REJECT;
          if (!visible(p)) return NodeFilter.FILTER_REJECT;
          return NodeFilter.FILTER_ACCEPT;
        }
      });
      const range = document.createRange();
      let n;
      while ((n = walk.nextNode())) {
        const p = n.parentElement, s = getComputedStyle(p);
        const size = parseFloat(s.fontSize);
        const weight = s.fontWeight === 'normal' ? 400 : s.fontWeight === 'bold' ? 700 : +s.fontWeight;
        const col = rgba(s.color) || { hex: '#000000', a: 1 };
        const fam = s.fontFamily;
        const fb = fontBox(weight, size, fam);
        const align = s.textAlign;
        const upper = s.textTransform === 'uppercase';
        const ls = parseFloat(s.letterSpacing) || 0;

        /* Split the node into the lines the browser actually made. */
        const txt = n.nodeValue;
        const lines = [];
        let start = -1, top = null;
        for (let i = 0; i < txt.length; i++) {
          range.setStart(n, i); range.setEnd(n, i + 1);
          const rc = range.getBoundingClientRect();
          if (rc.width === 0 && rc.height === 0) continue;       /* collapsed space */
          if (top === null || Math.abs(rc.top - top) > 1.5) {
            if (start >= 0) lines.push([start, i]);
            start = i; top = rc.top;
          }
        }
        if (start >= 0) lines.push([start, txt.length]);

        for (const [a, b] of lines) {
          range.setStart(n, a); range.setEnd(n, b);
          const rc = range.getBoundingClientRect();
          if (!rc.width) continue;
          let str = txt.slice(a, b).replace(/\s+/g, ' ').trim();
          if (!str) continue;
          if (upper) str = str.toUpperCase();
          const baseline = rc.top + (rc.height - (fb.a + fb.d)) / 2 + fb.a;
          const anchor = align === 'center' ? 'middle' : align === 'right' ? 'end' : 'start';
          const x = anchor === 'middle' ? rc.left + rc.width / 2
                  : anchor === 'end' ? rc.right : rc.left;
          out.text.push({
            x: R(x), y: R(baseline + SY()), s: str, size: R(size), weight,
            fill: col.hex, op: col.a, anchor, ls: R(ls),
            fam: fam.replace(/"/g, ''),
          });
        }
      }
    }

    /* ---- the road -------------------------------------------------------- */
    document.querySelectorAll('.road-run__art').forEach(svg => {
      const box = svg.getBoundingClientRect();
      const g = svg.firstElementChild;                 /* the four stacked strokes */
      if (!g) return;
      const paths = [...g.querySelectorAll('path')].map(p => ({
        d: p.getAttribute('d'),
        stroke: p.getAttribute('stroke'),
        sw: +p.getAttribute('stroke-width'),
        dash: p.getAttribute('stroke-dasharray') || null,
      }));
      out.roads.push({ x: R(box.left), y: R(box.top + SY()),
                       w: R(box.width), h: R(box.height), paths });
    });

    /* ---- his artwork ----------------------------------------------------
       One pass, in document order, so the stacking that the page has is the
       stacking the file gets. Collected separately the trusses came last and
       tiled straight over the sign they stand beside. */
    document.querySelectorAll('img, svg, .gantry__truss').forEach(el => {
      if (el.classList.contains('road-run__art')) return;
      if (el.tagName.toLowerCase() === 'svg' && el.closest('svg') !== el) return;
      if (!visible(el)) return;
      const r = el.getBoundingClientRect();
      if (r.width < 2 || r.height < 2) return;
      const s = getComputedStyle(el);
      const op = +s.opacity;                  /* the clouds are held right back */
      const base = { x: R(r.left), y: R(r.top + SY()), w: R(r.width), h: R(r.height), op };

      if (el.tagName.toLowerCase() === 'svg') {
        out.art.push(Object.assign({ kind: 'svg', markup: el.outerHTML,
                                     vb: el.getAttribute('viewBox') }, base));
      } else if (el.tagName.toLowerCase() === 'img') {
        out.art.push(Object.assign({ kind: 'img', src: el.currentSrc || el.src }, base));
      } else {
        const m = s.backgroundImage.match(/url\("?([^")]+)"?\)/);
        if (m) out.art.push(Object.assign({ kind: 'tile', src: m[1] }, base));
      }
    });

    collectBoxes(document.body);
    collectText(document.body);
    return out;
  });

  /* ------------------------------------------------------------------------
     Pull in the referenced artwork. SVG files are inlined as vectors; raster
     is embedded. A picture of a vector is no use to anyone in Illustrator.
     --------------------------------------------------------------------- */
  const cache = {};
  async function fetchAsset(src) {
    if (cache[src]) return cache[src];
    const rel = src.replace(/^https?:\/\/[^/]+\//, '');
    const file = path.join(__dirname, '..', decodeURIComponent(rel));
    let v = null;
    if (fs.existsSync(file)) {
      if (/\.svg$/i.test(file)) v = { type: 'svg', body: fs.readFileSync(file, 'utf8') };
      else v = { type: 'raster', b64: fs.readFileSync(file).toString('base64'),
                 mime: /\.png$/i.test(file) ? 'image/png'
                     : /\.jpe?g$/i.test(file) ? 'image/jpeg' : 'image/webp' };
    }
    cache[src] = v;
    return v;
  }

  const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const O = [];
  O.push(`<?xml version="1.0" encoding="UTF-8"?>`);
  O.push(`<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" ` +
         `width="${doc.w}" height="${doc.h}" viewBox="0 0 ${doc.w} ${doc.h}">`);
  O.push(`<title>Highway 19 Media — Questions &amp; Answers</title>`);

  if (doc.defs.length) {
    O.push('<defs>');
    for (const g of doc.defs) {
      O.push(`<linearGradient id="${g.id}" x1="${g.x1}%" y1="${g.y1}%" x2="${g.x2}%" y2="${g.y2}%">` +
        g.stops.map(s => `<stop offset="${s.off}%" stop-color="${s.col.hex}"` +
          (s.col.a < 1 ? ` stop-opacity="${s.col.a}"` : '') + `/>`).join('') +
        `</linearGradient>`);
    }
    O.push('</defs>');
  }

  const rect = b =>
    `<rect x="${b.x}" y="${b.y}" width="${b.w}" height="${b.h}"` +
    (b.rx ? ` rx="${b.rx}"` : '') +
    ` fill="${b.fill}"` + (b.op < 1 ? ` fill-opacity="${b.op}"` : '') +
    (b.stroke ? ` stroke="${b.stroke}" stroke-width="${b.sw}"` : '') + `/>`;

  O.push(`<g id="Background">`);
  doc.bg.forEach(b => O.push(rect(b)));
  O.push(`</g>`);

  O.push(`<g id="Roads" fill="none" stroke-linecap="butt">`);
  doc.roads.forEach(r => {
    O.push(`<g transform="translate(${r.x} ${r.y})">`);
    r.paths.forEach(p => O.push(
      `<path d="${p.d}" fill="none" stroke="${p.stroke}" stroke-width="${p.sw}"` +
      (p.dash ? ` stroke-dasharray="${p.dash}"` : '') + `/>`));
    O.push(`</g>`);
  });
  O.push(`</g>`);

  O.push(`<g id="Artwork">`);
  let clipN = 0;
  const clips = [];
  for (const a of doc.art) {
    const fade = a.op != null && a.op < 1 ? ` opacity="${a.op}"` : '';
    if (a.kind === 'svg') {
      const vb = (a.vb || '').split(/[ ,]+/).map(Number);
      const sx = vb.length === 4 && vb[2] ? a.w / vb[2] : 1;
      const sy = vb.length === 4 && vb[3] ? a.h / vb[3] : 1;
      const inner = a.markup.replace(/^<svg[^>]*>/i, '').replace(/<\/svg>\s*$/i, '');
      const off = vb.length === 4 ? ` translate(${-vb[0]} ${-vb[1]})` : '';
      O.push(`<g${fade} transform="translate(${a.x} ${a.y}) scale(${sx.toFixed(4)} ${sy.toFixed(4)})${off}">${inner}</g>`);
    } else {
      const asset = await fetchAsset(a.src);
      if (!asset) continue;
      if (asset.type === 'svg') {
        const vbm = asset.body.match(/viewBox="([^"]+)"/);
        const vb = vbm ? vbm[1].split(/[ ,]+/).map(Number) : null;
        const inner = asset.body
          .replace(/<\?xml[\s\S]*?\?>/i, '')
          .replace(/<!DOCTYPE[\s\S]*?>/i, '')
          .replace(/^[\s\S]*?<svg[^>]*>/i, '')
          .replace(/<\/svg>\s*$/i, '');
        if (a.kind === 'tile') {
          /* repeat-x, clipped to the element's own box — a tile that overruns
             is a tile drawn across whatever stands next to it. */
          const tw = vb ? (vb[2] / vb[3]) * a.h : a.h;
          const n = Math.ceil(a.w / tw);
          const cid = 'clip' + (++clipN);
          clips.push(`<clipPath id="${cid}"><rect x="0" y="0" width="${a.w}" height="${a.h}"/></clipPath>`);
          O.push(`<g${fade} clip-path="url(#${cid})" transform="translate(${a.x} ${a.y})">`);
          for (let i = 0; i < n; i++) {
            const s = vb ? a.h / vb[3] : 1;
            O.push(`<g transform="translate(${(i * tw).toFixed(2)} 0) scale(${s.toFixed(4)})` +
                   (vb ? ` translate(${-vb[0]} ${-vb[1]})` : '') + `">${inner}</g>`);
          }
          O.push(`</g>`);
        } else {
          const sx = vb ? a.w / vb[2] : 1, sy = vb ? a.h / vb[3] : 1;
          O.push(`<g${fade} transform="translate(${a.x} ${a.y}) scale(${sx.toFixed(4)} ${sy.toFixed(4)})` +
                 (vb ? ` translate(${-vb[0]} ${-vb[1]})` : '') + `">${inner}</g>`);
        }
      } else {
        O.push(`<image${fade} x="${a.x}" y="${a.y}" width="${a.w}" height="${a.h}" ` +
               `xlink:href="data:${asset.mime};base64,${asset.b64}"/>`);
      }
    }
  }
  O.push(`</g>`);
  if (clips.length) O.push(`<defs>${clips.join('')}</defs>`);

  O.push(`<g id="Boxes">`);
  doc.boxes.forEach(b => O.push(rect(b)));
  O.push(`</g>`);

  O.push(`<g id="Text">`);
  doc.text.forEach(t => O.push(
    `<text x="${t.x}" y="${t.y}" fill="${t.fill}"` + (t.op < 1 ? ` fill-opacity="${t.op}"` : '') +
    ` font-family="${esc(t.fam)}" font-size="${t.size}" font-weight="${t.weight}"` +
    (t.anchor !== 'start' ? ` text-anchor="${t.anchor}"` : '') +
    (t.ls ? ` letter-spacing="${t.ls}"` : '') +
    `>${esc(t.s)}</text>`));
  O.push(`</g>`);
  O.push(`</svg>`);

  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, O.join('\n'));
  const kb = (fs.statSync(OUT).size / 1024).toFixed(0);
  console.log(`${OUT}  ${doc.w}x${doc.h}  ${kb} KB`);
  console.log(`  text lines ${doc.text.length} · boxes ${doc.boxes.length} · ` +
              `grounds ${doc.bg.length} · roads ${doc.roads.length} · artwork ${doc.art.length}`);
  await browser.close();
})();
