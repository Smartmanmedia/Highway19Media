#!/usr/bin/env node
/* THE PRINTED CARD - front and back, from the same card.json as the phone one.
 *
 *   TK=/path/to/node_modules node tools/card/make_print.js highway19
 *
 * A dev tool like make_art.js (needs opentype.js, wawoff2 and sharp); what it
 * writes is committed to cards/<slug>/print/:
 *
 *   front.svg  back.svg      print-ready: US card 3.5 x 2 in plus 1/8 in
 *                            bleed all round (3.75 x 2.25 in), every word
 *                            converted to outlines so no printer can swap
 *                            the font, photos embedded
 *   proof.png                both sides with the trim (solid) and safe
 *                            (dashed) lines drawn on - for checking, not
 *                            for sending
 *
 * Units are points: 72 to the inch. Trim is 9pt in from the edge, and
 * nothing that matters goes within 18pt of the edge (1/8 in inside trim).
 *
 * The QR code on the back is the card's own address tagged ?s=qr, so a scan
 * of the paper card is counted apart from a tap of the chip (?s=nfc).
 */
const fs = require('fs'), path = require('path');
const TK = process.env.TK || '';
const req = m => require(TK ? path.join(TK, m) : m);
const opentype = req('opentype.js'), wawoff2 = req('wawoff2'), sharp = req('sharp');
const QR = require('./vendor/qrcode.js');
const { ICONS } = require('./icons');

const ROOT = path.join(__dirname, '..', '..');
const slug = process.argv[2];
if (!slug) { console.error('usage: make_print.js <card slug>'); process.exit(1); }
const dir = path.join(ROOT, 'cards', slug);
const c = JSON.parse(fs.readFileSync(path.join(dir, 'card.json'), 'utf8'));
const OUT = path.join(dir, 'print');
fs.mkdirSync(OUT, { recursive: true });

const W = 270, H = 162, BLEED = 9, SAFE = 18;
const ACCENT = c.theme.accent, INK = '#111214', MUTED = '#a9a69f';
const SITE = 'https://highway19media.com';
const id = c.identity, k = c.contact;

/* ---- text as outlines -------------------------------------------------- */
const FONTS = {};
async function font(w) {
  if (FONTS[w]) return FONTS[w];
  const b = await wawoff2.decompress(fs.readFileSync(path.join(ROOT, 'assets/fonts/BeVietnamPro-' + w + '.woff2')));
  return (FONTS[w] = opentype.parse(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength)));
}
/* one run of text -> one <path>, with tracking (in em) and alignment */
function run(f, str, size, track = 0) {
  const s = size / f.unitsPerEm, glyphs = f.stringToGlyphs(str);
  let x = 0; const placed = [];
  glyphs.forEach((g, i) => {
    placed.push([g, x]);
    x += g.advanceWidth * s + track * size;
    if (glyphs[i + 1]) x += f.getKerningValue(g, glyphs[i + 1]) * s;
  });
  return { width: x - track * size, placed, s };
}
function text(f, str, { x, y, size, fill, track = 0, anchor = 'start' }) {
  const r = run(f, str, size, track);
  const x0 = anchor === 'end' ? x - r.width : anchor === 'middle' ? x - r.width / 2 : x;
  const d = r.placed.map(([g, gx]) => g.getPath(x0 + gx, y, size).toPathData(2)).join('');
  return { svg: `<path fill="${fill}" d="${d}"/>`, width: r.width, x0 };
}

const icon = (n, x, y, size, color) =>
  `<g transform="translate(${x} ${y}) scale(${size / 24})" fill="none" stroke="${color}" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">${ICONS[n].d}</g>`;
/* the contactless mark: three arcs, the shape every phone and terminal uses */
const tapMark = (x, y, s, color) =>
  `<g transform="translate(${x} ${y}) scale(${s / 24})" fill="none" stroke="${color}" stroke-width="2.2" stroke-linecap="round">` +
  '<path d="M6 7.5a6.5 6.5 0 0 1 0 9"/><path d="M10 4.5a11 11 0 0 1 0 15"/><path d="M14 1.8a15.5 15.5 0 0 1 0 20.4"/></g>';

function qr(text, x, y, size) {
  const q = QR(0, 'Q'); q.addData(text); q.make();
  const n = q.getModuleCount(), m = size / n;
  let d = '';
  for (let r = 0; r < n; r++) for (let col = 0; col < n; col++)
    if (q.isDark(r, col)) d += `M${(x + col * m).toFixed(3)} ${(y + r * m).toFixed(3)}h${m.toFixed(3)}v${m.toFixed(3)}h-${m.toFixed(3)}z`;
  return { svg: `<path fill="#000" d="${d}"/>`, modules: n, mm: m / 72 * 25.4 };
}

const b64 = async (img) => 'data:image/' + (img.info ? 'png' : 'jpeg') + ';base64,' + img.toString('base64');
const svgDoc = body => `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="3.75in" height="2.25in" viewBox="0 0 ${W} ${H}">
<!-- ${id.business} business card. US 3.5 x 2 in trim + 0.125 in bleed (3.75 x 2.25 in).
     Units are points. Trim box: ${BLEED},${BLEED} - ${W - BLEED},${H - BLEED}. Text is outlined. -->
${body}
</svg>
`;

(async () => {
  const XB = await font('ExtraBold'), B = await font('Bold'), M = await font('Medium');

  /* ---- FRONT: the road at night, his sign on the pole, the name of the firm */
  const P = c.print || {};
  const photo = P.photo || { src: 'assets/brand/HWY19-Banner-image-night.jpg', crop: [0, 560, 1884, 1130] };
  const [pl, pt, pw, ph] = photo.crop;
  const jpg = await sharp(path.join(ROOT, photo.src)).extract({ left: pl, top: pt, width: pw, height: ph })
    .resize(1800).jpeg({ quality: 88 }).toBuffer();

  const wm = 13.5, wy = H - SAFE - 14;
  /* the lockup, as the site sets it: HIGHWAY 19 MEDIA, the number in colour */
  const parts = [['HIGHWAY ', '#fff'], ['19', ACCENT], [' MEDIA', '#fff']];
  const total = parts.reduce((n, [t]) => n + run(XB, t, wm, 0.04).width, 0) + 2 * 0.04 * wm;
  let wx = W - SAFE - total, lock = '';
  for (const [t, fill] of parts) { const r = text(XB, t, { x: wx, y: wy, size: wm, fill, track: 0.04 }); lock += r.svg; wx += r.width + 0.04 * wm; }
  const tag = text(M, id.tagline, { x: W - SAFE, y: wy + 11, size: 7.2, fill: 'rgba(255,255,255,.86)', anchor: 'end' });
  const tapLbl = text(B, 'TAP', { x: W - SAFE, y: SAFE + 6.2, size: 6.2, fill: ACCENT, track: 0.16, anchor: 'end' });

  const front = svgDoc(`<defs>
  <linearGradient id="fade" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0.38" stop-color="#000" stop-opacity="0"/>
    <stop offset="0.72" stop-color="#000" stop-opacity=".55"/>
    <stop offset="1" stop-color="#000" stop-opacity=".9"/>
  </linearGradient>
</defs>
<image x="0" y="0" width="${W}" height="${H}" preserveAspectRatio="xMidYMid slice" xlink:href="${await b64(jpg)}"/>
<rect width="${W}" height="${H}" fill="url(#fade)"/>
${lock}
${tag.svg}
${tapLbl.svg}
${tapMark(tapLbl.x0 - 12, SAFE - 3.4, 11, ACCENT)}`);

  /* ---- BACK: who, how to reach him, and the way onto his phone ----------- */
  const shield = await sharp(path.join(ROOT, 'assets/v2/ui-shield.webp')).resize(240).png().toBuffer();
  const L = SAFE + 2;
  const name = text(XB, id.person || id.business, { x: L, y: 58, size: 17, fill: '#fff', track: -0.01 });
  const title = text(B, (id.title || '').toUpperCase(), { x: L, y: 70, size: 6.4, fill: ACCENT, track: 0.14 });
  const firm = text(M, id.business, { x: L, y: 80, size: 7, fill: MUTED });
  const phone = (k.phone || '').replace(/^\+1(\d{3})(\d{3})(\d{4})$/, '$1.$2.$3');
  const rows = [['phone', phone], ['mail', k.email], ['globe', (k.website || '').replace(/^https:\/\/(www\.)?|\/$/g, '')], ['pin', id.area]]
    .filter(r => r[1]);
  let ry = 101, rowSvg = '';
  for (const [ic, t] of rows) {
    rowSvg += icon(ic, L, ry - 6.3, 7.4, ACCENT) + text(M, t, { x: L + 12, y: ry, size: 7.3, fill: '#f4f2ee' }).svg;
    ry += 11.4;
  }
  const QS = 72, qx = W - SAFE - QS - 4, qy = 26;
  const code = qr(SITE + c.path + '?s=qr', qx + 4, qy + 4, QS - 8);
  const cap1 = text(B, 'Scan or tap', { x: qx + QS / 2, y: qy + QS + 13, size: 7.4, fill: ACCENT, anchor: 'middle' });
  const cap2 = text(M, 'to save my contact', { x: qx + QS / 2, y: qy + QS + 22.5, size: 6.6, fill: MUTED, anchor: 'middle' });

  const back = svgDoc(`<rect width="${W}" height="${H}" fill="${INK}"/>
<image x="${L - 1}" y="${SAFE}" width="26" height="26" xlink:href="data:image/png;base64,${shield.toString('base64')}"/>
${name.svg}
${title.svg}
${firm.svg}
<rect x="${L}" y="87" width="26" height="0.8" fill="${ACCENT}"/>
${rowSvg}
<rect x="${qx}" y="${qy}" width="${QS}" height="${QS}" rx="7" fill="#fff"/>
${code.svg}
${cap1.svg}
${cap2.svg}`);

  fs.writeFileSync(path.join(OUT, 'front.svg'), front);
  fs.writeFileSync(path.join(OUT, 'back.svg'), back);

  /* ---- the proof: both sides, trim and safe lines on, never sent to print */
  const guides = `<rect x="${BLEED}" y="${BLEED}" width="${W - 2 * BLEED}" height="${H - 2 * BLEED}" fill="none" stroke="#ff2d55" stroke-width=".6"/>` +
    `<rect x="${SAFE}" y="${SAFE}" width="${W - 2 * SAFE}" height="${H - 2 * SAFE}" fill="none" stroke="#2dd4ff" stroke-width=".5" stroke-dasharray="3 2"/>`;
  const withGuides = s => s.replace('</svg>', guides + '\n</svg>');
  const px = 1200, ph2 = Math.round(px * H / W);
  const f = await sharp(Buffer.from(withGuides(front)), { density: 340 }).resize(px).png().toBuffer();
  const bk = await sharp(Buffer.from(withGuides(back)), { density: 340 }).resize(px).png().toBuffer();
  await sharp({ create: { width: px, height: ph2 * 2 + 40, channels: 3, background: '#d9d6cf' } })
    .composite([{ input: f, left: 0, top: 0 }, { input: bk, left: 0, top: ph2 + 40 }]).png().toFile(path.join(OUT, 'proof.png'));

  for (const n of ['front.svg', 'back.svg', 'proof.png'])
    console.log('  ' + n.padEnd(10) + Math.round(fs.statSync(path.join(OUT, n)).size / 1024) + ' KB');
  console.log('  QR: ' + code.modules + ' modules, ' + code.mm.toFixed(2) + ' mm each -> ' + SITE + c.path + '?s=qr');
})();
