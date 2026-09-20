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
const WRITTEN = [];
const wr = (p, s) => { fs.mkdirSync(path.dirname(path.join(OUT, p)), { recursive: true });
                       fs.writeFileSync(path.join(OUT, p), s);
                       if (p.endsWith('.html')) WRITTEN.push(p); };

/* 1. the code the page actually links, at its own depth, byte for byte.
 *    The directory holds more than the page loads - tuner.js is a dev panel,
 *    drive.html and fireworks.html are the workbenches the drive was built on -
 *    and none of it should be sitting on his server. */
const pageSrc = rd('build/v2/page.html');
const code = [...pageSrc.matchAll(/(?:href|src)="(?!https?:|\.\.\/)([^"]+\.(?:css|js))"/g)]
  .map(m => m[1]);
if (!code.length) throw new Error('no local css/js found in page.html');
/* the legal pages have one stylesheet of their own, and the home page - which
 * is what the list above is read from - never links it */
if (!code.includes('legal.css')) code.push('legal.css');
/* ---------------------------------------------------------------------------
 * WHAT SHIPS IS THE CODE WITHOUT ITS PROSE. The sources are heavily commented
 * on purpose - that is where the reasoning lives - but a reader downloading the
 * site does not need any of it, and it is a third of the transfer: measured on
 * the 25 files the two pages load, gzip goes from 212K to 102K.
 *
 * DELIBERATELY CONSERVATIVE. Block comments, whole-line // comments, leading
 * indentation and blank lines - nothing else. An aggressive pass that also
 * collapsed the space around { } : ; , saved one further kilobyte over the
 * wire, which is not worth the chance of it walking into a url(), a content:
 * string or a regex. Comments are what compress badly; the punctuation between
 * them does not.
 *
 * THE ONE GUARD: a file with a template literal spanning lines keeps its
 * indentation, because inside those backticks the leading spaces are part of
 * the string rather than layout. sprite.js is the file that needs it. */
const MULTILINE_TEMPLATE = /`[^`]*\n[^`]*`/;
function minify(src, kind) {
  let s = src.replace(/\/\*(?!!)[\s\S]*?\*\//g, '');    /* block comments, but
                                                          never a /*! one: that
                                                          is how a licence
                                                          header is marked */
  if (kind === 'js') {
    if (MULTILINE_TEMPLATE.test(src)) return s;          /* indentation is data here */
    s = s.replace(/^[ \t]*\/\/.*$/gm, '');               /* whole-line // only: a
                                                          // inside a url is not
                                                          a comment */
  }
  return s.replace(/^[ \t]+/gm, '').replace(/\n{2,}/g, '\n').trim() + '\n';
}
/* the page keeps its doctype and its structure; only the comments and the
 * indentation between tags go */
function minifyHtml(src) {
  /* every page that goes out gets the share card's content hash - doing it
     here rather than per page is what stops a new page shipping the stale
     card, the same reason the chrome is built from one module */
  src = src.replace(/(https:\/\/[^"]*\/assets\/v2\/meta\/og\.jpg)"/g,
                    '$1?v=' + ogStamp + '"');
  return src.replace(/<!--(?!\[if)[\s\S]*?-->/g, '')
            .replace(/^[ \t]+/gm, '')
            .replace(/\n{2,}/g, '\n');
}

const stamp = {};                       /* file -> 8 hex of its own bytes */
code.forEach(f => { const src = minify(rd('build/v2/' + f),
                                       f.endsWith('.js') ? 'js' : 'css');
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

/* AND THE SHARE CARD CARRIES ITS CONTENT HASH TOO.
 * /assets/* is served immutable for a year, which is only true while a file's
 * contents do not change under its name - and the og card is the one asset
 * that does change. Facebook and WhatsApp cache it by URL as well, so without
 * this a redrawn card keeps showing the old one in every preview. The hash is
 * the same mechanism the stylesheets use; it moves only when the image does. */
const ogStamp = crypto.createHash('sha1')
  .update(fs.readFileSync(path.join(ROOT, 'assets/v2/meta/og.jpg'))).digest('hex').slice(0, 8);

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
wr('index.html', minifyHtml(page));

/* 4. the holding page every unbuilt link points at, and the 404 - the same
 *    page, because a mistyped URL and an unbuilt one need the same answer. */
/* THE HOLDING PAGE IS ASSEMBLED FROM THE SAME PARTS AS THE HOME PAGE - the
 * header, the form card and the footer are each one file, dropped in at a
 * marker, so neither page can drift away from the other. The header's two
 * tokens are what differ: from here a nav item has to reach across to the home
 * page, the lockup goes to the home page rather than to the top of this one,
 * and there is no night to switch to. */
/* THE SAME MODULE THE HOME PAGE USES - tools/chrome.js. Every page here
 * reaches the home page through '/', and none of them has a night to switch
 * to. Nothing in this file assembles a header or a footer of its own. */
const CHROME = require('./chrome');
const HEADER_FOR = root => CHROME.header(root, { modeSwitch: false, logo: '/' });
const FOOTER = CHROME.footer;

/* AND THE SAME CONTENT HASH THE HOME PAGE PUTS ON ITS CODE. Every page below
 * links /build/v2/x.css, and that directory is cached for a week, so without
 * the hash a change to header.css reaches the home page at once and the other
 * four pages up to seven days later - the header the same size on one page and
 * not the next, which is the one thing these pages must never do. */
const codeHref = f => '/build/v2/' + f + (stamp[f] ? '?v=' + stamp[f] : '');

const soon = rd('build/v2/soon.html')
  .replace('<!--HEADER-->', () => HEADER_FOR('/')
    /* this page's main landmark carries his own id, not #top */
    .replace('class="skip" href="#top"', 'class="skip" href="#h19-detour"'))
  .replace('<!--FOOTER-->', () => FOOTER())
  /* the card is one file for both pages - see build/v2/form-card.html */
  .replace('<!--FORM-CARD-->', () => rd('build/v2/form-card.html'))
  .replace(/(?:href|src)="((?:section-fonts|form-card|section-09|header|consent)\.css|(?:form|header|consent)\.js)"/g,
           (m, f) => m.replace('"' + f + '"', '"' + codeHref(f) + '"'))
  .replace(/\.\.\/\.\.\/assets\//g, '/assets/')
  /* and from here, the home page is one directory up */
  .replace(/\{\{ROOT\}\}/g, '/');
const soonOut = minifyHtml(soon);
wr('coming-soon/index.html', soonOut);
/* THE 404 IS THE SAME PAGE WITHOUT THE CANONICAL. The two were byte for byte
 * identical, which meant every 404 told a crawler "my canonical URL is
 * /coming-soon/" - a missing page claiming to be the holding page. A 404 has
 * no canonical URL; that is what makes it a 404. Search Console reads the
 * pair as a duplicate rather than as a not-found. */
wr('404.html', soonOut.replace(/<link rel="canonical"[^>]*>/i, ''));


/* 4b. THE LEGAL PAGES. One shell, three bodies, the same header and footer as
 *     everything else - so they cannot drift and they do not need their own
 *     anything. They are indexable on purpose: a site with no reachable privacy
 *     policy is a site an ad platform will not run, and a policy a crawler
 *     cannot see does not count as having one. */
const LEGAL = [
  { slug: 'privacy', title: 'Privacy Policy', eyebrow: 'How we handle your details',
    desc: 'What Highway 19 Media collects, why, who else sees it and how to have it deleted. No tracking, no analytics, no selling anything about you.' },
  { slug: 'terms', title: 'Terms & Conditions', eyebrow: 'Using this site',
    desc: 'The terms that cover highway19media.com - what the site is, what sending the contact form does and does not start, and whose law applies.' },
  { slug: 'cookies', title: 'Cookie Policy', eyebrow: 'What is stored on your device',
    desc: 'This site sets no cookies today. If advertising or analytics is ever added, a banner asks first and nothing loads until you accept.' },
];
const DATE = new Date().toLocaleDateString('en-US',
  { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' });
const shell = rd('build/v2/legal.html');
for (const L of LEGAL) {
  let page = shell
    .replace('<!--HEADER-->', () => HEADER_FOR('/'))
    .replace('<!--FOOTER-->', () => FOOTER())
    .replace('{{BODY}}', () => rd('build/v2/legal-' + L.slug + '.html').trimEnd())
    .replace(/\{\{TITLE\}\}/g, L.title.replace(/&/g, '&amp;'))
    .replace(/\{\{SLUG\}\}/g, L.slug)
    .replace(/\{\{DESC\}\}/g, L.desc)
    .replace(/\{\{EYEBROW\}\}/g, L.eyebrow)
    .replace(/\{\{DATE\}\}/g, DATE)
    .replace(/(?:href|src)="((?:section-fonts|header|section-09|legal|consent)\.css|(?:header|consent)\.js)"/g,
             (m, f) => m.replace('"' + f + '"', '"' + codeHref(f) + '"'))
    .replace(/\.\.\/\.\.\/assets\//g, '/assets/')
    .replace(/\{\{ROOT\}\}/g, '/');
  wr(L.slug + '/index.html', minifyHtml(page));
}

/* 4c. THE COMMUNITY PAGES. Landing pages built for local businesses, each
 *     one carrying its customer's branding and deliberately none of this
 *     site's - no header, no footer, no Highway 19 lockup. That is why they
 *     are copied verbatim instead of going through wr(): every page wr()
 *     writes is held against the chrome check below, and these are the one
 *     kind of page that must fail it.
 *
 *     Each is self-contained - its own css, js, fonts and art sit beside it -
 *     so a customer page can be added or pulled without touching anything
 *     else here. */
const COMMUNITY = path.join(ROOT, 'community');
if (fs.existsSync(COMMUNITY)) {
  let files = 0, cbytes = 0;
  (function walk(dir) {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const from = path.join(dir, e.name);
      if (e.isDirectory()) { walk(from); continue; }
      const rel = path.relative(ROOT, from).split(path.sep).join('/');
      const to = path.join(OUT, rel);
      fs.mkdirSync(path.dirname(to), { recursive: true });
      fs.copyFileSync(from, to);
      files++; cbytes += fs.statSync(from).size;
    }
  })(COMMUNITY);
  console.log('  community: ' + files + ' files, ' + Math.round(cbytes / 1024) + ' KB');
}

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
 *   script   self alone - GSAP is served from here now, not a CDN
 *   connect  self, and the form service the browser POSTs a lead to
 *   img      self only - there is not one data: URI in either page
 *   font     self only - both families are his files, served from here
 * 'unsafe-inline' is in there because both pages carry an inline <style> and
 * <script>; hashing those at build time is what would drop it, and is the next
 * thing to do here if this ever grows past two pages.
 * object-src none and base-uri self cost nothing and close two old holes. */
const CSP = [
  "default-src 'self'",
  /* GOOGLE ANALYTICS. Only the tag loader's own host - consent.js fetches
   * https://www.googletagmanager.com/gtag/js and nothing else runs scripts. */
  "script-src 'self' 'unsafe-inline' https://www.googletagmanager.com",
  "style-src 'self' 'unsafe-inline'",
  /* GA still falls back to a pixel on some browsers, and it is served from
   * the analytics hosts rather than from here. */
  "img-src 'self' https://*.google-analytics.com https://*.googletagmanager.com",
  "font-src 'self'",
  "connect-src 'self' https://api.web3forms.com https://*.google-analytics.com https://*.analytics.google.com https://*.googletagmanager.com",
  "form-action 'self' https://api.web3forms.com",
  "frame-ancestors 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "upgrade-insecure-requests"
].join('; ');

wr('_headers',
`/community/shared/fonts/*
  Cache-Control: public, max-age=31536000, immutable
/community/*/assets/*
  Cache-Control: public, max-age=31536000, immutable
/assets/*
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

/* URLs are case sensitive on a static host, and /Community/ is an easy
 * thing to type or to hand out. Send it to the real one rather than to the
 * 404, and keep the canonical lower case. */
wr('_redirects',
`/Community/* /community/:splat 301
`);

wr('robots.txt', STAGING
  ? 'User-agent: *\nDisallow: /\n'
  /* THE HOLDING PAGE IS NOT DISALLOWED, deliberately. It carries its own
   * noindex, and a page a crawler is forbidden to FETCH is a page whose
   * noindex is never read - so disallowing it is how a URL ends up listed as a
   * bare link with no title. Let it be crawled and let the noindex do the
   * work. */
  : 'User-agent: *\nAllow: /\n\nSitemap: ' + SITE + '/sitemap.xml\n');

/* the community pages that are meant to be found. A page carrying its own
 * noindex is left out - listing it tells the one crawler that reads the
 * sitemap before the meta tag to index a page we asked it not to. */
const COMMUNITY_URLS = (function () {
  if (!fs.existsSync(COMMUNITY)) return '';
  const out = [];
  (function walk(dir) {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const from = path.join(dir, e.name);
      if (e.isDirectory()) { walk(from); continue; }
      if (!/[.]html$/.test(e.name)) continue;
      /* comments out first: a page can carry a commented-out noindex as a
         note to whoever edits it next, and that is not a noindex */
      const html = fs.readFileSync(from, 'utf8').replace(/<!--[\s\S]*?-->/g, '');
      if (/<meta[^>]+name="robots"[^>]+noindex/i.test(html)) continue;
      const m = html.match(/<link rel="canonical" href="([^"]+)"/);
      if (m) out.push('  <url><loc>' + m[1] + '</loc><changefreq>monthly</changefreq><priority>0.7</priority></url>');
    }
  })(COMMUNITY);
  return out.join(String.fromCharCode(10));
})();

if (!STAGING) wr('sitemap.xml',
`<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>${SITE}/</loc><changefreq>monthly</changefreq><priority>1.0</priority></url>
${LEGAL.map(L => `  <url><loc>${SITE}/${L.slug}/</loc><changefreq>yearly</changefreq><priority>0.2</priority></url>`).join('\n')}
${COMMUNITY_URLS}
</urlset>
`);

/* 6. AND NOTHING SHIPS WITHOUT THE CHROME.
 *    Building the header and the footer from one module - tools/chrome.js -
 *    stops the copies drifting. It does not stop a NEW page being written that
 *    forgets to ask for them, or asks for the markup and not the stylesheet
 *    that sizes it. So every page written above is read back off disk and held
 *    against the same rules, and a failure here stops the build rather than
 *    letting a page reach his server wearing half a header. */
function verifyChrome() {
  /* a nav item reached from the home page is written '#services' and from
     anywhere else '/#services' - the same destination, so the leading slash
     comes off before two pages are compared. The lockup is the one link that
     is meant to differ: '#top' at home, '/' everywhere else. */
  const links = (html, open, close) => {
    const i = html.indexOf(open), j = html.indexOf(close);
    if (i < 0 || j < 0) return null;
    return [...html.slice(i, j).matchAll(/href="([^"]*)"/g)]
      .map(m => m[1].replace(/^\//, '') || '/')
      .filter(h => h !== '/' && h !== 'top' && h !== '#top')
      .join(' ');
  };
  let ref = null, refPage = null, bad = [];
  for (const p of WRITTEN) {
    const html = fs.readFileSync(path.join(OUT, p), 'utf8');
    const say = m => bad.push(p + ': ' + m);

    if (!/<header class="hdr"/.test(html))  say('no header');
    if (!/<footer class="sec9"/.test(html)) say('no footer');
    if (!/class="skip"/.test(html))         say('no skip link');
    for (const f of [...CHROME.ASSETS.css, ...CHROME.ASSETS.js])
      if (!html.includes('/build/v2/' + f) && !html.includes('"build/v2/' + f))
        say('does not load ' + f);
    if (/\{\{[A-Z-]+\}\}/.test(html)) say('unsubstituted token');

    const sig = (links(html, '<header class="hdr"', '</header>') || '?') + ' | ' +
                (links(html, '<footer class="sec9"', '</footer>') || '?');
    if (ref === null) { ref = sig; refPage = p; }
    else if (sig !== ref) say('header/footer links differ from ' + refPage +
                              '\n    this: ' + sig + '\n    that: ' + ref);
  }
  if (bad.length) {
    console.error('CHROME CHECK FAILED\n  ' + bad.join('\n  '));
    process.exit(1);
  }
  console.log('  chrome: header + footer + ' +
    (CHROME.ASSETS.css.length + CHROME.ASSETS.js.length) +
    ' assets identical on ' + WRITTEN.length + ' pages');
}

verifyChrome();

const du = d => fs.readdirSync(d, { withFileTypes: true }).reduce((n, e) =>
  n + (e.isDirectory() ? du(path.join(d, e.name)) : fs.statSync(path.join(d, e.name)).size), 0);
console.log((STAGING ? 'dist/stage' : 'dist/site') +
  '  ' + wanted.size + ' assets, ' +
  Math.round(fs.statSync(path.join(OUT, 'index.html')).size / 1024) + ' KB page, ' +
  Math.round(du(OUT) / 1024) + ' KB total');

