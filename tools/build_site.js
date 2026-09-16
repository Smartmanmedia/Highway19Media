#!/usr/bin/env node
/* THE SITE, AS A HOST SERVES IT.
 *
 * build_v2.js folds everything into one file because the artifact host blocks
 * external requests. A real host does not: one 3.8 MB document that has to be
 * downloaded whole, every visit, before anything paints is the wrong shape for
 * a website. Here the page is a page, and his art is files a browser caches
 * once and never asks for again.
 *
 *   node tools/build_site.js              dist/site   the live build
 *   node tools/build_site.js --staging    dist/stage  the same, noindex
 *
 * Layout, and why it is this shape: the CSS says url("../../assets/...") and
 * that has to keep resolving without rewriting every stylesheet, so the code
 * keeps its depth - /build/v2/x.css - and assets sit at /assets. The page
 * itself moves to the root, which is the only path that changes.
 */
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..');
const STAGING = process.argv.includes('--staging');
const OUT  = path.join(ROOT, 'dist', STAGING ? 'stage' : 'site');
const SITE = 'https://highway19media.com';

fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });

const crypto = require('crypto');
const rd = p => fs.readFileSync(path.join(ROOT, p), 'utf8');
const wr = (p, s) => { fs.mkdirSync(path.dirname(path.join(OUT, p)), { recursive: true });
                       fs.writeFileSync(path.join(OUT, p), s); };

/* 1. the code the page actually links, at its own depth, byte for byte.
 *    The directory holds more than the page loads - tuner.js is a dev panel,
 *    drive.html and fireworks.html are the workbenches the drive was built on -
 *    and none of it should be sitting on his server. */
const pageSrc = rd('build/v2/page.html');
const code = [...pageSrc.matchAll(/(?:href|src)="(?!https?:|\.\.\/)([^"]+\.(?:css|js))"/g)]
  .map(m => m[1]);
if (!code.length) throw new Error('no local css/js found in page.html');
const stamp = {};                       /* file -> 8 hex of its own bytes */
code.forEach(f => { const src = rd('build/v2/' + f);
  stamp[f] = crypto.createHash('sha1').update(src).digest('hex').slice(0, 8);
  wr('build/v2/' + f, src); });

/* 2. every asset any of it actually asks for. Walking the references rather
 *    than copying assets/ wholesale is the difference between shipping his art
 *    and shipping the working files, the intermediates and the 1.7 MB SVG that
 *    a webp replaced. */
const wanted = new Set();
const collect = txt => {
  for (const m of txt.matchAll(/\.\.\/\.\.\/(assets\/[^"')\s]+)/g)) wanted.add(m[1]);
};
code.forEach(f => collect(rd('build/v2/' + f)));
collect(rd('build/v2/page.html'));
collect(rd('build/v2/soon.html'));
/* the share card is named only in absolute og:image URLs, which the walk above
   cannot see - and a card that 404s is the blank rectangle it was drawn to
   replace. */
wanted.add('assets/v2/meta/og.jpg');

let bytes = 0;
for (const a of wanted) {
  const src = path.join(ROOT, a);
  if (!fs.existsSync(src)) throw new Error('missing asset: ' + a);
  fs.mkdirSync(path.dirname(path.join(OUT, a)), { recursive: true });
  fs.copyFileSync(src, path.join(OUT, a));
  bytes += fs.statSync(src).size;
}

/* 3. the page, at the root. Two rewrites and nothing else: its own stylesheets
 *    and scripts are a directory further down now, and its images a directory
 *    nearer. */
let page = rd('build/v2/page.html')
  .replace(/(<link rel="stylesheet" href=")(?!https?:|\/)/g, '$1build/v2/')
  .replace(/(<script src=")(?!https?:|\/)/g,               '$1build/v2/')
  .replace(/\.\.\/\.\.\/assets\//g, 'assets/')
  /* AND EVERY STYLESHEET AND SCRIPT CARRIES ITS OWN CONTENT HASH.
     Without this the page revalidates on every visit and the code does not:
     a reader who has been here before gets the new markup wearing last
     week's stylesheet, which is a broken page, not an old one. The hash
     changes only when the file does, so the long cache above stays true. */
  .replace(/(?:href|src)="build\/v2\/([^"?]+\.(?:css|js))"/g,
           (m, f) => stamp[f] ? m.slice(0, -1) + '?v=' + stamp[f] + '"' : m);
if (STAGING && !/name="robots"/.test(page))
  page = page.replace(/<link rel="canonical"[^>]*>\n/,
    m => m + '<meta name="robots" content="noindex,nofollow">\n');
wr('index.html', page);

/* 4. the holding page every unbuilt link points at, and the 404 - the same
 *    page, because a mistyped URL and an unbuilt one need the same answer. */
/* THE HOLDING PAGE IS ASSEMBLED FROM THE SAME PARTS AS THE HOME PAGE - the
 * header, the form card and the footer are each one file, dropped in at a
 * marker, so neither page can drift away from the other. The header's two
 * tokens are what differ: from here a nav item has to reach across to the home
 * page, the lockup goes to the home page rather than to the top of this one,
 * and there is no night to switch to. */
const soon = rd('build/v2/soon.html')
  .replace('<!--HEADER-->', () => rd('build/v2/header.html')
    .replace(/^<!--[\s\S]*?-->\n/, '')
    .replace('{{PHONE-GLYPH}}', () =>
      rd('assets/v2/header/phone-glyph.svg')
        .replace(/<\?xml[^>]*\?>|<!--[\s\S]*?-->/g, '')
        .replace(/\s+/g, ' ').trim()
        .replace('<svg ', '<svg class="hdr-cta-g" '))
    .replace('{{SWITCH}}', '')
    .replace(/\{\{ROOT\}\}/g, '/')
    .replace('{{LOGO}}', '/'))
  .replace('<!--FOOTER-->', () =>
    rd('build/v2/section-09.html').match(/<section\b[\s\S]*<\/section>/)[0])
  /* the card is one file for both pages - see build/v2/form-card.html */
  .replace('<!--FORM-CARD-->', () => rd('build/v2/form-card.html'))
  .replace(/(?:href|src)="((?:section-fonts|form-card|section-09|header)\.css|(?:form|header)\.js)"/g,
           (m, f) => m.replace('"' + f + '"', '"/build/v2/' + f + '"'))
  .replace(/\.\.\/\.\.\/assets\//g, '/assets/')
  /* and from here, the home page is one directory up */
  .replace(/\{\{ROOT\}\}/g, '/');
wr('coming-soon/index.html', soon);
wr('404.html', soon);

/* 5. what the host needs to be told.
 *    Cache-Control is the whole point of splitting the files up: the page is
 *    revalidated every visit, his art is not asked for twice. The fonts and
 *    art carry no hash in their names, so a year is only safe while their
 *    contents do not change under the same name - they are his finals. */
/* WHAT THE PAGE IS ALLOWED TO TALK TO.
 * A brochure site has a very short list, so the policy can be short too - and a
 * short one is worth having: it is what stops an injected <script src> pulling
 * from a host nobody chose, and stops anything at all being posted to a host
 * that is not the form service. Every entry is something the built pages
 * actually use, checked rather than guessed:
 *   script   self, and cdnjs for the holding page's GSAP
 *   connect  self, and the form service the browser POSTs a lead to
 *   img      self only - there is not one data: URI in either page
 *   font     self only - both families are his files, served from here
 * 'unsafe-inline' is in there because both pages carry an inline <style> and
 * <script>; hashing those at build time is what would drop it, and is the next
 * thing to do here if this ever grows past two pages.
 * object-src none and base-uri self cost nothing and close two old holes. */
const CSP = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' https://cdnjs.cloudflare.com",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self'",
  "font-src 'self'",
  "connect-src 'self' https://api.web3forms.com",
  "form-action 'self' https://api.web3forms.com",
  "frame-ancestors 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "upgrade-insecure-requests"
].join('; ');

wr('_headers',
`/assets/*
  Cache-Control: public, max-age=31536000, immutable
/build/v2/*
  Cache-Control: public, max-age=604800
/*
  Cache-Control: public, max-age=0, must-revalidate
  X-Content-Type-Options: nosniff
  Referrer-Policy: strict-origin-when-cross-origin
  X-Frame-Options: SAMEORIGIN
  Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=(), usb=()
  Cross-Origin-Opener-Policy: same-origin
  Strict-Transport-Security: max-age=31536000; includeSubDomains
  Content-Security-Policy: ` + CSP + `
`);

wr('robots.txt', STAGING
  ? 'User-agent: *\nDisallow: /\n'
  /* THE HOLDING PAGE IS NOT DISALLOWED, deliberately. It carries its own
   * noindex, and a page a crawler is forbidden to FETCH is a page whose
   * noindex is never read - so disallowing it is how a URL ends up listed as a
   * bare link with no title. Let it be crawled and let the noindex do the
   * work. */
  : 'User-agent: *\nAllow: /\n\nSitemap: ' + SITE + '/sitemap.xml\n');

if (!STAGING) wr('sitemap.xml',
`<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>${SITE}/</loc><changefreq>monthly</changefreq><priority>1.0</priority></url>
</urlset>
`);

const du = d => fs.readdirSync(d, { withFileTypes: true }).reduce((n, e) =>
  n + (e.isDirectory() ? du(path.join(d, e.name)) : fs.statSync(path.join(d, e.name)).size), 0);
console.log((STAGING ? 'dist/stage' : 'dist/site') +
  '  ' + wanted.size + ' assets, ' +
  Math.round(fs.statSync(path.join(OUT, 'index.html')).size / 1024) + ' KB page, ' +
  Math.round(du(OUT) / 1024) + ' KB total');
