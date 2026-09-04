#!/usr/bin/env node
/* Fold a v2 section page into one self-contained file. The artifact host
 * blocks external images, so the CSS goes inline and every asset becomes a
 * data URI. SVG travels as a data URI here rather than inlined markup because
 * nothing in section one carries a multiply blend — his cloud shadows are
 * drawn at 37% opacity, which composites correctly however it is wrapped. */
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..');
const SRC = process.argv[2] || 'build/v2/page.html';
const OUT = process.argv[3] || 'dist/highway19-v2.html';
const MIME = { '.svg':'image/svg+xml', '.webp':'image/webp', '.png':'image/png',
               '.jpg':'image/jpeg', '.woff2':'font/woff2' };

let html = fs.readFileSync(path.join(ROOT, SRC), 'utf8');
const base = path.dirname(path.join(ROOT, SRC));
let assets = 0, bytes = 0;

/* js — same reason as the css: the artifact host blocks external files */
html = html.replace(/<script src="(?!https?:)([^"]+)"[^>]*><\/script>/g, (m, src) => {
  const js = fs.readFileSync(path.resolve(base, src), 'utf8');
  assets++; bytes += js.length;
  return '<script>' + js + '</script>';
});

/* css */
html = html.replace(/<link rel="stylesheet" href="(?!https?:)([^"]+)">/g, (m, href) => {
  let css = fs.readFileSync(path.resolve(base, href), 'utf8');
  css = css.replace(/url\("([^"]+)"\)/g, (mm, u) => {
    if (/^data:|^https?:/.test(u)) return mm;
    const f = path.resolve(path.dirname(path.resolve(base, href)), u);
    const b = fs.readFileSync(f); assets++; bytes += b.length;
    return 'url("data:' + MIME[path.extname(f)] + ';base64,' + b.toString('base64') + '")';
  });
  return '<style>\n' + css + '\n</style>';
});

/* images */
html = html.replace(/src="(?!data:|https?:)([^"]+)"/g, (m, src) => {
  const f = path.resolve(base, src);
  const b = fs.readFileSync(f); assets++; bytes += b.length;
  return 'src="data:' + MIME[path.extname(f)] + ';base64,' + b.toString('base64') + '"';
});

/* an <image> inside an inline SVG, which is how his shield reaches the two
   signs that carry it. Anchored to a file extension we know, so `href="#id"`
   on a <use> and `href="#services"` on his button are both left alone. */
html = html.replace(/(xlink:href|href)="(?!data:|https?:|#)([^"]+\.(?:svg|webp|png|jpg))"/g,
  (m, attr, src) => {
    const f = path.resolve(base, src);
    const b = fs.readFileSync(f); assets++; bytes += b.length;
    return attr + '="data:' + MIME[path.extname(f)] + ';base64,' + b.toString('base64') + '"';
  });

fs.mkdirSync(path.join(ROOT, 'dist'), { recursive: true });
fs.writeFileSync(path.join(ROOT, OUT), html);
console.log(assets + ' assets inlined, ' + Math.round(bytes/1024) + ' KB raw');
console.log(OUT + '  ' + Math.round(fs.statSync(path.join(ROOT, OUT)).size/1024) + ' KB');
