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
/* THE ONE BUSINESS RECORD (tools/entity.js) goes on every page this site
 * writes - not the community pages, which are copied verbatim and are their
 * customers' own businesses. */
const ENTITY = require('./entity');
/* a page's title and description, and the share card's copies of both */
function setMeta(html, title, desc) {
  const e = t => t.replace(/&(?![a-z]+;|#\d+;)/g, '&amp;').replace(/"/g, '&quot;');
  return html
    .replace(/<title>[\s\S]*?<\/title>/, '<title>' + e(title) + '</title>')
    .replace(/(<meta (?:name|property)="(?:description|og:description|twitter:description)" content=")[^"]*"/g, '$1' + e(desc) + '"')
    .replace(/(<meta (?:name|property)="(?:og:title|twitter:title)" content=")[^"]*"/g, '$1' + e(title) + '"');
}
const wr = (p, s) => { if (p.endsWith('.html')) s = ENTITY.apply(s);
                       fs.mkdirSync(path.dirname(path.join(OUT, p)), { recursive: true });
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
if (!code.includes('service.css')) code.push('service.css');
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
/* CONTACT US goes to the page's own form where there is one - the home page,
 * the holding page and the contact page - and to /contact/ from everywhere
 * else, so no button on the site points at a #contact that is not there. */
const HEADER_FOR = (root, contact) =>
  CHROME.header(root, { modeSwitch: false, logo: '/', contact: contact || '#contact' });
const FOOTER_FOR = contact => contact && contact !== '#contact'
  ? CHROME.footer().replace(/href="#contact"/g, 'href="' + contact + '"')
  : CHROME.footer();
const FOOTER = () => FOOTER_FOR('#contact');

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
/* 4a. THE CONTACT PAGE. The card and nothing else, between the same header and
 *     footer as every page - both pointing at its own form. */
const contactOut = minifyHtml(rd('build/v2/contact.html')
  .replace('<!--HEADER-->', () => HEADER_FOR('/', '#contact')
    .replace('class="skip" href="#top"', 'class="skip" href="#contact-main"'))
  .replace('<!--FOOTER-->', () => FOOTER())
  .replace('<!--FORM-CARD-->', () => rd('build/v2/form-card.html'))
  .replace(/(?:href|src)="((?:section-fonts|form-card|section-09|header|consent)\.css|(?:form|header|consent)\.js)"/g,
           (m, f) => m.replace('"' + f + '"', '"' + codeHref(f) + '"'))
  .replace(/\.\.\/\.\.\/assets\//g, '/assets/')
  .replace(/\{\{ROOT\}\}/g, '/'));
wr('contact/index.html', contactOut);

wr('404.html', soonOut.replace(/<link rel="canonical"[^>]*>/i, ''));


/* 4b. THE LEGAL PAGES. One shell, three bodies, the same header and footer as
 *     everything else - so they cannot drift and they do not need their own
 *     anything. They are indexable on purpose: a site with no reachable privacy
 *     policy is a site an ad platform will not run, and a policy a crawler
 *     cannot see does not count as having one. */
const LEGAL = [
  { slug: 'privacy', title: 'Privacy Policy', eyebrow: 'How we handle your details',
    desc: 'What Highway 19 Media collects, why, who else sees it and how to have it deleted. Analytics only if you say yes, no advertising cookies, nothing sold.' },
  { slug: 'terms', title: 'Terms & Conditions', eyebrow: 'Using this site',
    desc: 'The terms that cover highway19media.com - what the site is, what sending the contact form does and does not start, and whose law applies.' },
  { slug: 'cookies', title: 'Cookie Policy', eyebrow: 'What is stored on your device',
    desc: 'The one cookie-setting tool on this site is Google Analytics, and it loads only if you accept the banner. No advertising cookies. Change your mind any time.' },
];
const DATE = new Date().toLocaleDateString('en-US',
  { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' });
const shell = rd('build/v2/legal.html');
for (const L of LEGAL) {
  let page = shell
    .replace('<!--HEADER-->', () => HEADER_FOR('/', '/contact/'))
    .replace('<!--FOOTER-->', () => FOOTER_FOR('/contact/'))
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

/* 4b-i. THE SERVICE PAGES. One shell (build/v2/service.html), one entry per
 *       service (tools/services.js). Each question's answer is the Q&A page's
 *       own - read out of faq.html's FAQPage data by the question's wording -
 *       so the service page and the Q&A never say two different things. */
const SERVICES = require('./services');
{
  const faqSrc = fs.readFileSync(path.join(ROOT, 'faq.html'), 'utf8');
  const answers = {};
  for (const m of faqSrc.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)) {
    let d; try { d = JSON.parse(m[1]); } catch (e) { continue; }
    for (const n of (d['@graph'] || [d]))
      if (n['@type'] === 'FAQPage')
        for (const q of n.mainEntity) answers[q.name] = q.acceptedAnswer.text;
  }
  const esc = t => t.replace(/&(?![a-z]+;|#\d+;)/g, '&amp;').replace(/</g, '&lt;');
  const plain = t => t.replace(/&amp;/g, '&').replace(/&rsquo;/g, '\u2019').replace(/&middot;/g, '\u00b7')
                      .replace(/&[a-z]+;/g, '');
  const shell = rd('build/v2/service.html');
  for (const S of SERVICES) {
    const url = SITE + '/' + S.slug + '/';
    /* a question is the Q&A's own, by its wording - or { q, from, a }: shown
       as q, answered with a (paragraphs) or else with the Q&A's answer to from */
    const faq = S.faq.map(item => {
      const it = typeof item === 'string' ? { q: item } : item;
      const src = it.from || it.q;
      if (!it.a && !answers[src]) throw new Error(S.slug + ': the Q&A has no question "' + src + '"');
      return [it.q, it.a ? [].concat(it.a) : [answers[src]]];
    });
    const paras = v => [].concat(v).map(p => '<p>' + p + '</p>').join('');
    const ld = {
      '@context': 'https://schema.org',
      '@graph': [
        { '@type': 'WebPage', '@id': url + '#webpage', url, name: plain(S.title), description: S.desc,
          inLanguage: 'en-US', isPartOf: { '@id': SITE + '/#website' }, about: { '@id': url + '#service' },
          breadcrumb: { '@id': url + '#breadcrumb' } },
        Object.assign({ '@type': 'Service', '@id': url + '#service', name: plain(S.h1), serviceType: S.serviceType,
          description: plain([].concat(S.lead).join(' ')), url, provider: { '@id': SITE + '/#business' },
          areaServed: ENTITY.BUSINESS.areaServed },
          S.offers ? { offers: S.offers.map(([n, p]) => ({ '@type': 'Offer', name: n,
            priceSpecification: { '@type': 'PriceSpecification', minPrice: p, priceCurrency: 'USD' } })) } : {}),
        { '@type': 'BreadcrumbList', '@id': url + '#breadcrumb', itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Home', item: SITE + '/' },
          { '@type': 'ListItem', position: 2, name: plain(S.label), item: url }] },
        { '@type': 'FAQPage', '@id': url + '#faq', mainEntity: faq.map(([q, a]) => ({
          '@type': 'Question', name: plain(q), acceptedAnswer: { '@type': 'Answer', text: plain(a.join(' ')) } })) }
      ]
    };
    const others = SERVICES.filter(o => o !== S).map(o => ({ href: '/' + o.slug + '/', label: o.label, c: o.color }))
      .concat([{ href: '/video-production/', label: 'Video Production', c: '#662d91' },
               { href: '/faq/', label: 'FAQ', c: '#0b1f3f' }]);
    /* THE PAGE'S SECTIONS, IN THE PAGE'S ORDER. A service may list its own in
       tools/services.js (S.sections); without a list it gets the standard run.
       Kinds: cards, band, facts, steps, prose, area, faq. Prose takes a body
       of paragraphs (strings), { list: [...] }, { h3 } and { big } lines. */
    let sid = 0;
    const sec = (cls, h, inner, extra) => {
      const id = 'svc-s' + (++sid);
      return '  <section class="' + cls + '"' + (extra || '') + ' aria-labelledby="' + id + '">\n' +
             '    <div class="svc-in' + (/svc-prose|svc-faq/.test(cls) ? ' svc-narrow' : '') + '">\n' +
             '      <h2 id="' + id + '">' + h + '</h2>\n' + inner + '    </div>\n  </section>\n';
    };
    const KINDS = {
      cards: x => sec('svc-block', x.h, '      <ul class="svc-grid">\n' + x.items.map(([h, p]) =>
        '        <li><h3>' + h + '</h3>' + paras(p) + '</li>').join('\n') + '\n      </ul>\n'),
      band: () => S.band
        ? '  <section class="svc-band" aria-label="Experience">\n    <div class="svc-in">\n' +
          '      <div class="svc-band-n" aria-hidden="true">' + S.band.n + '</div>\n' +
          '      <div><h2><span class="svc-sr">' + S.band.n + ' </span>' + S.band.h + '</h2><p>' +
          S.band.p + '</p></div>\n    </div>\n  </section>\n' : '',
      facts: () => '  <section class="svc-facts" aria-label="At a glance">\n    <div class="svc-in">\n' +
        (S.factsH ? '      <h2>' + S.factsH + '</h2>\n' : '') + '      <ul class="svc-fact-row">\n' +
        S.facts.map(([b, t]) => '        <li><b>' + b + '</b><span>' + t + '</span></li>').join('\n') +
        '\n      </ul>\n    </div>\n  </section>\n',
      steps: x => sec('svc-block', x.h || 'How it works', '      <ol class="svc-steps">\n' +
        S.steps.map(([h, p]) => '        <li><h3>' + h + '</h3>' + paras(p) + '</li>').join('\n') +
        '\n      </ol>\n'),
      prose: x => sec('svc-prose svc-prose--' + (x.tone || 'white'), x.h, '      <div class="svc-prose-say">' +
        x.body.map(v => typeof v === 'string' ? '<p>' + v + '</p>'
          : v.list ? '<ul class="svc-lines">' + v.list.map(l => '<li>' + l + '</li>').join('') + '</ul>'
          : v.h3 ? '<h3>' + v.h3 + '</h3>'
          : v.big ? '<p class="svc-big">' + v.big + '</p>' : '').join('') + '</div>\n'),
      area: () => sec('svc-area', S.areaH || 'Local to Spring Hill. Working along US-19.',
        '      <div class="svc-area-say">' + (S.area ? paras(S.area)
          : '<p>' + SERVICES.AREA + ' <a href="/contact/">Tell us where you are.</a></p>') + '</div>\n'),
      faq: () => sec('svc-block svc-faq', 'Questions, answered.', faq.map(([q, a], i) =>
        '      <details class="qa-item"' + (i ? '' : ' open') + '><summary><h3>' + esc(q) +
        '</h3></summary>' + a.map(p => '<p>' + esc(p) + '</p>').join('') + '</details>').join('\n') +
        '\n      <p class="svc-more"><a href="/faq/">More answers on our FAQ page &rarr;</a></p>\n',
        ' id="questions"')
    };
    const order = S.sections || [
      { type: 'cards', h: S.incH, items: S.included }, { type: 'band' }, { type: 'facts' },
      { type: 'steps' }, { type: 'area' }, { type: 'faq' }];
    const sectionsHtml = order.map(x => {
      if (!KINDS[x.type]) throw new Error(S.slug + ': no section kind "' + x.type + '"');
      return KINDS[x.type](x);
    }).join('\n');
    let page = shell
      .replace('{{SECTIONS}}', () => sectionsHtml)
      .replace('<!--HEADER-->', () => HEADER_FOR('/', '/contact/')
        .replace('class="skip" href="#top"', 'class="skip" href="#svc-main"'))
      .replace('<!--FOOTER-->', () => FOOTER_FOR('/contact/'))
      .replace(/\{\{TITLE\}\}/g, esc(S.title))
      .replace(/\{\{DESC\}\}/g, esc(S.desc))
      .replace(/\{\{SLUG\}\}/g, S.slug)
      .replace('{{COLOR}}', S.color)
      .replace('{{ICON}}', S.icon)
      .replace('{{EYEBROW}}', S.eyebrow)
      .replace('{{H1}}', S.h1)
      .replace('{{TAG}}', S.tag ? '        <p class="svc-tag">' + S.tag + '</p>\n' : '')
      .replace('{{LEAD}}', paras(S.lead))
      .replace(/\{\{CTA\}\}/g, S.cta)
      .replace('{{CTA_H}}', S.ctaH)
      /* the closing words: the page's own, or the standard line */
      .replace('{{CTA_P}}', () => '      <div class="svc-cta-say">' +
        paras(S.ctaP || 'Show us where you are and tell us where you want to go. We reply within 24 hours.') + '</div>')
      .replace('{{NEXT}}', others.map(o =>
        '        <li><a href="' + o.href + '" style="--c:' + o.c + '">' + o.label + '</a></li>').join('\n'))
      .replace('{{LD}}', () => JSON.stringify(ld))
      .replace(/(?:href|src)="((?:section-fonts|section-09|header|consent|service)\.css|(?:header|consent)\.js)"/g,
               (m, f) => m.replace('"' + f + '"', '"' + codeHref(f) + '"'))
      .replace(/\.\.\/\.\.\/assets\//g, '/assets/')
      .replace(/\{\{ROOT\}\}/g, '/');
    if (/\{\{[A-Z_]+\}\}/.test(page)) throw new Error(S.slug + ': unfilled token');
    wr(S.slug + '/index.html', minifyHtml(page));
  }
  console.log('  services: ' + SERVICES.map(S => '/' + S.slug + '/').join(' '));
}

/* 4b-ii. THE Q&A PAGE. His eight artboards, his questions, the traffic - built
 *        by tools/qa/make.sh into faq.html at the root of the repository, with
 *        the site's own header, contact card and footer already in it (see
 *        tools/chrome-emit.js: it asks tools/chrome.js for them, so there is
 *        still only one header on this site). What is left to do here is what
 *        is done to the home page: move its code down a directory, its assets
 *        up one, and stamp every URL with the hash of what is behind it.
 *
 *        ITS OWN CSS AND JS LIVE UNDER /assets/, which is served immutable for
 *        a year - true only while a file's contents do not change under its
 *        name, and these change every time his page is rebuilt. So they carry
 *        the same content hash his stylesheets do. */
const QA_SRC = path.join(ROOT, 'faq.html');
if (fs.existsSync(QA_SRC)) {
  let qa = fs.readFileSync(QA_SRC, 'utf8');

  /* its own code, stamped and copied as it stands - qa.css and the four
     scripts are written by tools/qa/build.py and are already tight */
  const own = [...qa.matchAll(/(?:href|src)="(assets\/(?:css|js)\/[^"]+)"/g)]
    .map(m => m[1]);
  const ownStamp = {};
  for (const f of new Set(own)) {
    const src = fs.readFileSync(path.join(ROOT, f));
    ownStamp[f] = crypto.createHash('sha1').update(src).digest('hex').slice(0, 8);
    fs.mkdirSync(path.dirname(path.join(OUT, f)), { recursive: true });
    fs.writeFileSync(path.join(OUT, f), src);
  }

  /* every asset it or its stylesheet actually asks for */
  const qaWanted = new Set();
  for (const m of qa.matchAll(/(?:xlink:href|href|src)="(assets\/[^"]+)"/g)) qaWanted.add(m[1]);
  /* and the ones named only inside a style attribute - his bleed strips */
  for (const m of qa.matchAll(/url\(['"]?(assets\/[^)"']+)/g)) qaWanted.add(m[1]);
  for (const f of Object.keys(ownStamp)) {
    const txt = fs.readFileSync(path.join(ROOT, f), 'utf8');
    /* qa.css says url(../fonts/x.woff2) from assets/css/ */
    for (const m of txt.matchAll(/url\(\.\.\/([^)"']+)\)/g)) qaWanted.add('assets/' + m[1]);
    for (const m of txt.matchAll(/["'(](assets\/[^"')\s]+)/g)) qaWanted.add(m[1]);
  }
  let qaBytes = 0;
  for (const a of qaWanted) {
    if (ownStamp[a]) continue;                       /* written above */
    const src = path.join(ROOT, a);
    if (!fs.existsSync(src)) throw new Error('Q&A: missing asset ' + a);
    fs.mkdirSync(path.dirname(path.join(OUT, a)), { recursive: true });
    fs.copyFileSync(src, path.join(OUT, a));
    qaBytes += fs.statSync(src).size;
  }

  /* AND ITS CHROME IS TODAY'S, NOT THE ONE IT WAS BAKED WITH. faq.html carries
     the header and footer as they were when tools/qa/make.sh last ran - which
     can be older than the header itself (the smaller bar, the Services
     dropdown, CONTACT US to /contact/, the shield linking home). They are
     swapped for what tools/chrome.js says now, so the Q&A cannot fall out of
     step with every other page, and verifyChrome() holds it to them. The page
     has its own contact card, so the footer keeps #contact. */
  const qaSkip = (qa.match(/<a class="skip" href="([^"]+)"/) || [])[1] || '#top';
  const qaTree = s => s.replace(/\.\.\/\.\.\/assets\//g, 'assets/').replace(/\{\{ROOT\}\}/g, '/');
  if (!/<a class="skip"[\s\S]*?<\/header>/.test(qa)) throw new Error('Q&A: no header to replace');
  if (!/<footer class="sec9"[\s\S]*?<\/footer>/.test(qa)) throw new Error('Q&A: no footer to replace');
  qa = qa
    .replace(/<a class="skip"[\s\S]*?<\/header>/, () =>
      qaTree(HEADER_FOR('/').replace('class="skip" href="#top"', 'class="skip" href="' + qaSkip + '"')))
    .replace(/<footer class="sec9"[\s\S]*?<\/footer>/, () => qaTree(FOOTER()));

  /* AND HIS DRAWN BAR GOES. His first Q&A artboard has the header drawn into
     it - bar, shield, nav, button, sun - as one group opening on its
     2126.88 x 85.39 shadow rect. The old, taller live header hid it; the
     smaller one does not, and the two showed one under the other. The live
     header is the header, so the drawing of it comes out. */
  {
    const mk = '<rect x="1.12" y="4.27" width="2126.88" height="85.39"/>';
    const at = qa.indexOf(mk);
    if (at < 0) throw new Error('Q&A: drawn header group not found');
    const g0 = qa.lastIndexOf('<g>', at);
    const re = /<g[\s>]|<\/g>/g; re.lastIndex = g0;
    let depth = 0, m, g1 = -1;
    while ((m = re.exec(qa))) { depth += m[0] === '</g>' ? -1 : 1; if (!depth) { g1 = re.lastIndex; break; } }
    if (g1 < 0) throw new Error('Q&A: drawn header group not closed');
    qa = qa.slice(0, g0) + qa.slice(g1);
  }

  /* AND HIS ROAD PIECES MEET. Measured by tools/qa/roadsnap-measure.js: each
     _Stright / _Curve group moved straight across - never scaled - so its
     white edges land on the piece it joins. Offsets are in the group's
     parent's units and go in front of its own transform. */
  const SNAP = path.join(ROOT, 'tools', 'qa', 'roadsnap.json');
  if (fs.existsSync(SNAP)) {
    const snap = JSON.parse(fs.readFileSync(SNAP, 'utf8'));
    let moved = 0;
    for (const [id, [dx, dy]] of Object.entries(snap)) {
      const re = new RegExp('<g id="' + id.replace(/[-]/g, '\\-') + '"([^>]*)>');
      qa = qa.replace(re, (m, rest) => {
        moved++;
        const t = 'translate(' + dx + ' ' + dy + ')';
        return /\stransform="/.test(rest)
          ? m.replace(/\stransform="/, ' transform="' + t + ' ')
          : '<g id="' + id + '" transform="' + t + '"' + rest + '>';
      });
    }
    if (moved !== Object.keys(snap).length)
      throw new Error('Q&A: road snap matched ' + moved + ' of ' + Object.keys(snap).length + ' pieces');
  }

  qa = qa
    .replace(/(?:href|src)="build\/v2\/([^"?]+\.(?:css|js))"/g,
             (m, f) => m.replace('"build/v2/' + f + '"', '"' + codeHref(f) + '"'))
    .replace(/((?:xlink:href|href|src)=")assets\//g, '$1/assets/')
    /* his bleed strips are named inside style attributes - url(assets/...) -
       which no href/src rewrite can see, and a page at /q-a/ then asks for
       /q-a/assets/ and gets nothing */
    .replace(/url\((['"]?)assets\//g, 'url($1/assets/')
    .replace(/(?:href|src)="\/(assets\/(?:css|js)\/[^"?]+)"/g,
             (m, f) => ownStamp[f] ? m.slice(0, -1) + '?v=' + ownStamp[f] + '"' : m);
  if (STAGING) qa = qa.replace(/<meta name="robots"[^>]*>/,
                               '<meta name="robots" content="noindex,nofollow">');
  /* HIS SERVICE BUTTONS GO TO PAGES THAT EXIST. faq.html was generated
     pointing at a /services/... tree that was never built, and every one of
     those links was a 404. */
  const QA_LINKS = {
    '/services/website-design/': '/website-design/',
    '/services/video-production/': '/video-production/',
    '/services/social-paid-ads/': '/social-media-marketing/',
    '/services/print-branding/': '/branding-and-print/',
    '/services/': '/#services'
  };
  qa = qa.replace(/href="(\/services\/[^"]*)"/g, (m, h) => QA_LINKS[h] ? 'href="' + QA_LINKS[h] + '"' : m);
  /* its title and description, for the searches it can answer - set here
     because faq.html is generated elsewhere (tools/qa/build.py) */
  qa = setMeta(qa, 'Small Business Marketing FAQ | Highway 19 Media, Spring Hill FL',
    'Straight answers on website design, video production, social media, ads, branding and ' +
    'print for small businesses in Spring Hill, Brooksville and across Tampa Bay.');
  /* THE PAGE LIVES AT /faq/. It was /q-a/ until the menu was renamed FAQ;
     faq.html is regenerated rarely, so any /q-a/ address still inside it -
     canonical, og:url, its structured data - is moved here too. /q-a/
     redirects, below. */
  qa = qa.replace(/(https:\/\/highway19media\.com)\/q-a\//g, '$1/faq/');
  wr('faq/index.html', minifyHtml(qa));
  console.log('  faq: ' + Math.round(Buffer.byteLength(qa) / 1024) + ' KB page, ' +
    qaWanted.size + ' assets, ' + Math.round(qaBytes / 1024) + ' KB');
} else {
  throw new Error('faq.html is not built - run tools/qa/make.sh first');
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

/* 4d. THE SERVICE PAGES. Built elsewhere and dropped in whole - each folder
 *     is a finished page with its own css, js, fonts and art beside it
 *     (video-production/ comes out of the Video Page project's
 *     tools/build-release.js). Its art and code are copied as they are; the
 *     page itself goes through wr() like every other page of this site, so it
 *     wears THIS site's header and footer, and verifyChrome() holds it to them.
 *
 *     Three things give way to the chrome on the way in:
 *       - the page's own stand-in footer (.foot), for the site's footer
 *       - its own consent.js, for the site's - the chrome loads one, and two
 *         would each load GA4. Same stored answer (h19.consent.v1), same
 *         property, so nothing is lost; the Meta Pixel goes in
 *         build/v2/consent.js's TAGS like any other tool on the site
 *       - the skip link targets the page's first scene rather than #top
 *     The chrome's stylesheets load AFTER the page's, so the header's
 *     body{padding-top} wins over the page's own body reset. */
const SERVICE_PAGES = ['video-production'].filter(d => fs.existsSync(path.join(ROOT, d, 'index.html')));
for (const d of SERVICE_PAGES) {
  let files = 0, sbytes = 0;
  (function walk(dir) {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const from = path.join(dir, e.name);
      if (e.isDirectory()) { walk(from); continue; }
      const rel = path.relative(path.join(ROOT, d), from).split(path.sep).join('/');
      if (rel === 'index.html' || rel === 'assets/js/consent.js') continue;
      const to = path.join(OUT, d, rel);
      fs.mkdirSync(path.dirname(to), { recursive: true });
      fs.copyFileSync(from, to);
      files++; sbytes += fs.statSync(from).size;
    }
  })(path.join(ROOT, d));

  let page = rd(d + '/index.html');
  const swap = (re, to, what) => {
    if (!re.test(page)) throw new Error(d + '/index.html: could not find ' + what);
    page = page.replace(re, to);
  };
  const firstId = (page.match(/<body>\s*<div id="([^"]+)"/) || [])[1];
  if (!firstId) throw new Error(d + '/index.html: no first section id for the skip link');
  swap(/<footer class="foot">[\s\S]*?<\/footer>\s*/, '', 'its stand-in footer');
  swap(/<script src="assets\/js\/consent\.js" defer><\/script>\s*/, '', 'its consent.js');
  swap(/<\/head>/, () =>
    CHROME.ASSETS.css.map(f => '<link rel="stylesheet" href="' + codeHref(f) + '">').join('\n') + '\n' +
    CHROME.ASSETS.js.map(f => '<script src="' + codeHref(f) + '" defer></script>').join('\n') +
    '\n</head>', '</head>');
  swap(/<body>/, () => '<body>\n' +
    HEADER_FOR('/', '/contact/').replace('class="skip" href="#top"', 'class="skip" href="#' + firstId + '"'), '<body>');
  swap(/<script src="assets\/js\/[^"]+"><\/script>\s*<\/body>/,
       m => FOOTER_FOR('/contact/') + '\n' + m, 'the page script before </body>');
  /* and the page's own calls to action go to the contact page too */
  page = page.replace(/href="\/#contact"/g, 'href="/contact/"');
  page = page.replace(/\.\.\/\.\.\/assets\//g, '/assets/').replace(/\{\{ROOT\}\}/g, '/');
  wr(d + '/index.html', minifyHtml(page));
  console.log('  ' + d + ': page + ' + files + ' files, ' + Math.round(sbytes / 1024) + ' KB');
}

/* 4e. THE DIGITAL CARDS. cards/<slug>/card.json, one per business, through
 *     one template - see tools/card/build.js. What an NFC tag or a printed QR
 *     code opens: a phone app, not a page of this site, so like the community
 *     pages it wears no site header or footer and is not held to the chrome
 *     check. It does carry the site's consent banner and h19Track, so what a
 *     visitor taps is counted exactly when the rest of the site's is - after
 *     they have said yes, and never before. */
const CARD = require('./card/build');
const CARDS = CARD.buildAll({
  ROOT, OUT, SITE,
  og: SITE + '/assets/v2/meta/og.jpg?v=' + ogStamp,
  privacy: '/privacy/',
  consent: '<link rel="stylesheet" href="' + codeHref('consent.css') + '">\n' +
           '<script src="' + codeHref('consent.js') + '" defer></script>',
});
for (const c of CARDS)
  console.log('  card ' + c.path + ': ' + Math.round(c.bytes / 1024) + ' KB page, ' + c.vcf +
              '  (NFC: ' + c.url + '?s=nfc)');

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
` + SERVICE_PAGES.map(d => `/${d}/assets/img/*
  Cache-Control: public, max-age=31536000, immutable
/${d}/assets/fonts/*
  Cache-Control: public, max-age=31536000, immutable
`).join('') + CARD.headers(CARDS) + `/assets/*
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
/q-a /faq/ 301
/q-a/ /faq/ 301
/qa /faq/ 301
/qa/ /faq/ 301
/faq /faq/ 301
` + CARD.redirects(CARDS) + `/questions /faq/ 301
/questions/ /faq/ 301
`);

/* the plain-language fact sheet AI assistants look for at the root */
wr('llms.txt', rd('build/v2/llms.txt'));

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
  <url><loc>${SITE}/contact/</loc><changefreq>monthly</changefreq><priority>0.8</priority></url>
  <url><loc>${SITE}/faq/</loc><changefreq>monthly</changefreq><priority>0.8</priority></url>
${LEGAL.map(L => `  <url><loc>${SITE}/${L.slug}/</loc><changefreq>yearly</changefreq><priority>0.2</priority></url>`).join('\n')}
${SERVICE_PAGES.map(d => `  <url><loc>${SITE}/${d}/</loc><changefreq>monthly</changefreq><priority>0.8</priority></url>`).join('\n')}
${SERVICES.map(S => `  <url><loc>${SITE}/${S.slug}/</loc><changefreq>monthly</changefreq><priority>0.9</priority></url>`).join('\n')}
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
      /* the page's own form or the contact page - the same destination */
      .map(h => h === 'contact/' ? '#contact' : h)
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

