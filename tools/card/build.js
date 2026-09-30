/* DIGITAL BUSINESS CARDS - ONE TEMPLATE, ONE JSON FILE PER BUSINESS.
 *
 * Someone taps an NFC tag or scans a QR code and this is what opens: the
 * business, a button that puts it in their contacts, the ways to reach it, and
 * - once they add it to their home screen - an icon among their apps that we
 * can keep changing behind.
 *
 *   cards/<slug>/card.json    everything that differs between businesses
 *   cards/<slug>/art/         its pictures, cut by tools/card/make_art.js
 *   cards/template/           the code every card shares - css, js, worker
 *
 * Called by tools/build_site.js (step 4e). Each card is written to the path in
 * its card.json - Highway 19's own is /card/ - as a finished, self-contained
 * page: no site header or footer, because a card is a phone app and not a page
 * of this website, so like the community pages it is not held to the chrome
 * check.
 *
 * WHAT A CARD SHOWS IS WHAT ITS JSON HAS. An empty phone number is no Call
 * button, not a Call button that goes nowhere; a module set to null is not on
 * the page. Nothing here invents a detail a business did not give.
 *
 * What each card directory gets:
 *   index.html               the card
 *   <business>.vcf           Save to Contacts - a real file, so it works
 *                            offline and on every phone's own contacts app
 *   manifest.webmanifest     what makes it installable
 *   sw.js                    keeps it opening with no signal; always asks
 *                            the network first for the page itself, so an
 *                            edit reaches every installed copy on next open
 *   qr.svg                   the printable code, tagged ?s=qr
 *   card.css card.js art/    its code and pictures
 */
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const QR = require('./vendor/qrcode.js');
const { NETWORKS, sprite } = require('./icons');

const esc = s => String(s == null ? '' : s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const hash = buf => crypto.createHash('sha1').update(buf).digest('hex').slice(0, 8);
const slugify = s => String(s).toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

/* ---- colour: the whole theme is derived from one accent -------------------
 * The css mixes every surface and tint from --accent itself; the one thing CSS
 * cannot decide reliably is whether text ON the accent should be dark or
 * light, so that is worked out here from WCAG contrast and handed over. */
function rgb(hex) {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex);
  if (!m) throw new Error('card: theme.accent must be a #rrggbb colour, got ' + hex);
  const n = parseInt(m[1], 16);
  return [n >> 16, (n >> 8) & 255, n & 255];
}
function luminance(hex) {
  const [r, g, b] = rgb(hex).map(v => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
const contrast = (a, b) => { const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
const onAccent = acc => contrast(acc, '#111111') >= contrast(acc, '#ffffff') ? '#111111' : '#ffffff';

/* the base each mode is built on - the accent tints these, never replaces them */
const BASE = { dark: { bg: '#0e0f11' }, light: { bg: '#f4f2ed' } };

/* ---- QR -------------------------------------------------------------------- */
function qrSvg(text, { dark = '#111', light = '#fff', margin = 2, cls = '' } = {}) {
  const q = QR(0, 'M'); q.addData(text); q.make();
  const n = q.getModuleCount(), s = n + margin * 2;
  let d = '';
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++)
    if (q.isDark(y, x)) d += `M${x + margin} ${y + margin}h1v1h-1z`;
  return `<svg${cls ? ` class="${cls}"` : ''} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${s} ${s}" shape-rendering="crispEdges" role="img" aria-label="QR code"><rect width="${s}" height="${s}" fill="${light}"/><path d="${d}" fill="${dark}"/></svg>`;
}

/* ---- vCard 3.0 --------------------------------------------------------------
 * 3.0 rather than 4.0 because it is the one iOS Contacts, Android Contacts and
 * Outlook all read without argument. Lines are CRLF and folded at 75 octets,
 * which is what the photo needs - an unfolded base64 line is the most common
 * reason a .vcf imports without its picture. */
function vcard(c, cardUrl, photo) {
  const e = s => String(s || '').replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/,/g, '\\,').replace(/;/g, '\\;');
  const fold = l => { const out = []; while (l.length > 75) { out.push(l.slice(0, 75)); l = ' ' + l.slice(75); } out.push(l); return out.join('\r\n'); };
  const id = c.identity, k = c.contact, a = k.address || {};
  const L = ['BEGIN:VCARD', 'VERSION:3.0'];
  if (id.person) {
    const parts = id.person.trim().split(/\s+/), last = parts.length > 1 ? parts.pop() : '';
    L.push(`N:${e(last)};${e(parts.join(' '))};;;`, `FN:${e(id.person)}`);
    if (id.title) L.push(`TITLE:${e(id.title)}`);
  } else {
    /* a business with no person on it: filed under its own name, and iOS told
       to show it as a company rather than as someone called "Highway" */
    L.push(`N:${e(id.business)};;;;`, `FN:${e(id.business)}`, 'X-ABShowAs:COMPANY');
  }
  L.push(`ORG:${e(id.business)}`);
  /* one number for calls and texts is a mobile - filed as CELL, so the
     phone offers Message as well as Call */
  if (k.phone) L.push(`TEL;TYPE=${k.sms === k.phone ? 'CELL' : 'WORK'},VOICE:${k.phone}`);
  if (k.sms && k.sms !== k.phone) L.push(`TEL;TYPE=CELL:${k.sms}`);
  if (k.email) L.push(`EMAIL;TYPE=INTERNET,WORK:${k.email}`);
  if (k.website) L.push(`URL;TYPE=WORK:${k.website}`);
  L.push(`item1.URL:${cardUrl}`, 'item1.X-ABLabel:Digital card');
  if (a.city || a.street) L.push(`ADR;TYPE=WORK:;;${e(a.street)};${e(a.city)};${e(a.region)};${e(a.postcode)};${e(a.country)}`);
  for (const [net] of NETWORKS) if (c.social && c.social[net] && net !== 'whatsapp')
    L.push(`X-SOCIALPROFILE;TYPE=${net}:${c.social[net]}`);
  const note = [id.tagline, id.services, id.area].filter(Boolean).join(' — ');
  if (note) L.push(`NOTE:${e(note)}`);
  if (photo) L.push('PHOTO;ENCODING=b;TYPE=JPEG:' + photo.toString('base64'));
  L.push('END:VCARD');
  return L.map(fold).join('\r\n') + '\r\n';
}

/* ---- validation: a card that cannot work does not ship ----------------------- */
function check(c, file) {
  const bad = [];
  const need = (v, what) => { if (!v) bad.push(what + ' is required'); };
  need(c.path && /^\/[a-z0-9/-]+\/$/.test(c.path), 'path (like "/card/")');
  need(c.identity && c.identity.business, 'identity.business');
  need(c.theme && c.theme.accent, 'theme.accent');
  const k = c.contact || {};
  if (!k.phone && !k.email && !k.website) bad.push('contact needs at least one of phone, email, website');
  for (const f of ['phone', 'sms']) if (k[f] && !/^\+?[0-9]{7,15}$/.test(k[f]))
    bad.push(`contact.${f} must be digits only, with an optional leading + (got ${k[f]})`);
  const urls = [k.website, k.directions, k.book && k.book.url,
    ...Object.values(c.social || {})].filter(Boolean);
  for (const u of urls) if (!/^https:\/\//.test(u)) bad.push('not an https URL: ' + u);
  if (c.theme && c.theme.mode && !BASE[c.theme.mode]) bad.push('theme.mode must be dark or light');
  if (bad.length) throw new Error('card ' + file + ':\n  ' + bad.join('\n  '));
}

/* ---- the page -------------------------------------------------------------- */
function render(c, ctx) {
  const id = c.identity, k = c.contact, m = c.modules || {}, used = [];
  const ic = (n, cls = 'ic') => { used.push(n); return `<svg class="${cls}" aria-hidden="true"><use href="#i-${n}"/></svg>`; };
  const tr = (ev, extra) => ` data-track="${ev}"${extra ? ` data-track-label="${esc(extra)}"` : ''}`;
  const ext = ' target="_blank" rel="noopener"';

  /* identity: the photo (or loop) with the business laid over its foot */
  const hero = c.art && c.art.hero;
  const video = c.art && c.art.video;
  const media = video
    ? `<video class="hero-media" autoplay muted loop playsinline preload="metadata" poster="${esc(video.poster)}" aria-label="${esc(video.alt || '')}"><source src="${esc(video.src)}" type="video/mp4"></video>`
    : hero
      ? `<img class="hero-media" src="art/hero-720.webp" srcset="art/hero-720.webp 720w, art/hero-1080.webp 1080w" sizes="(max-width: 480px) 100vw, 440px" alt="${esc(hero.alt || '')}" fetchpriority="high" decoding="async">`
      : '';
  const identity = `
<header class="id${media ? '' : ' id--plain'}">
  ${media}
  <div class="id-body">
    ${id.logo === false ? '' : '<img class="id-logo" src="art/logo-160.webp" alt="" width="56" height="56">'}
    <h1 class="id-name">${esc(id.business)}</h1>
    ${id.person ? `<p class="id-person">${esc(id.person)}${id.title ? ` <span>· ${esc(id.title)}</span>` : ''}</p>` : ''}
    ${id.tagline ? `<p class="id-tag">${esc(id.tagline)}</p>` : ''}
    <p class="id-meta">${id.services ? `<span>${esc(id.services)}</span>` : ''}${id.area ? `<span class="id-area">${ic('pin', 'ic ic-s')}${esc(id.area)}</span>` : ''}</p>
  </div>
</header>`;

  const save = `
<a class="save" href="${esc(ctx.vcf)}"${tr('save_contact')}>
  ${ic('userAdd')}<span>Save to Contacts</span>
</a>
<p class="save-note">${[k.phone && 'Phone', k.email && 'email', k.website && 'website'].filter(Boolean).join(', ').replace(/^./, s => s.toUpperCase()).replace(/, ([^,]+)$/, ' and $1')} in one tap.</p>`;

  /* the quick actions, in the order a stranger reaches for them */
  const acts = [];
  if (k.phone) acts.push([`tel:${k.phone}`, 'phone', 'Call', 'call']);
  if (k.sms || k.phone) acts.push([`sms:${k.sms || k.phone}`, 'message', 'Text', 'text']);
  if (k.email) acts.push([`mailto:${k.email}`, 'mail', 'Email', 'email']);
  if (k.website) acts.push([k.website, 'globe', 'Website', 'website', true]);
  if (k.directions) acts.push([k.directions, 'pin', 'Directions', 'directions', true]);
  if (k.book && k.book.url) acts.push([k.book.url, 'calendar', k.book.label || 'Book', 'book', true]);
  const actions = acts.length ? `
<nav class="acts acts--${acts.length <= 4 ? acts.length : 3}" aria-label="Get in touch">
  ${acts.map(([h, i, l, ev, x]) => `<a class="act" href="${esc(h)}"${x ? ext : ''}${tr(ev)}>${ic(i)}<span>${esc(l)}</span></a>`).join('\n  ')}
</nav>` : '';

  /* socials: only the ones that exist. Two or fewer get a full row each, with
     the handle - a lone round icon on its own looks like something is missing */
  const nets = NETWORKS.filter(([n]) => c.social && c.social[n]);
  /* a WhatsApp link is a number, not a handle - shown the way it is dialled */
  const handle = u => /^https:\/\/wa\.me\//.test(u)
    ? u.replace(/^https:\/\/wa\.me\/1?(\d{3})(\d{3})(\d{4}).*$/, '$1-$2-$3')
    : decodeURIComponent(u.replace(/^https:\/\/(www\.)?[^/]+\//, '').replace(/\/$/, '')).replace(/^@?/, '@');
  const social = !nets.length ? '' : nets.length <= 2 ? `
<nav class="soc soc--rows" aria-label="Follow">
  ${nets.map(([n, label]) => `<a class="soc-row" href="${esc(c.social[n])}"${ext}${tr('social_click', n)}>${ic(n, 'ic ic-mark')}<span class="soc-name">${label}<small>${esc(handle(c.social[n]))}</small></span>${ic('chevron', 'ic ic-go')}</a>`).join('\n  ')}
</nav>` : `
<nav class="soc" aria-label="Follow">
  ${nets.map(([n, label]) => `<a class="soc-ic" href="${esc(c.social[n])}" aria-label="${label}"${ext}${tr('social_click', n)}>${ic(n, 'ic ic-mark')}</a>`).join('\n  ')}
</nav>`;

  const sec = (cls, title, body) => `
<section class="mod ${cls}">
  ${title ? `<h2 class="mod-h">${esc(title)}</h2>` : ''}
  ${body}
</section>`;

  const blocks = [];

  if (m.story) {
    const s = m.story, file = /\.mp4($|\?)/.test(s.video || '');
    blocks.push(sec('mod-story', s.title || 'Watch our story', file
      ? `<video class="story-v" controls playsinline preload="none" poster="${esc(s.poster || '')}"${tr('story_play')}><source src="${esc(s.video)}" type="video/mp4"></video>${s.line ? `<p class="mod-p">${esc(s.line)}</p>` : ''}`
      : `<a class="story-link" href="${esc(s.video)}"${ext}${tr('story_play')}>${s.poster ? `<img src="${esc(s.poster)}" alt="" loading="lazy">` : ''}${ic('play', 'ic ic-play')}</a>${s.line ? `<p class="mod-p">${esc(s.line)}</p>` : ''}`));
  }

  if (m.gallery && m.gallery.items && m.gallery.items.length) {
    blocks.push(sec('mod-gal', m.gallery.title || 'Our work', `<div class="gal" tabindex="0" aria-label="Gallery, scroll sideways">
    ${m.gallery.items.map(g => {
      const img = `<img src="${esc(g.src)}" alt="${esc(g.alt || '')}" loading="lazy" decoding="async">`;
      return g.url ? `<a class="gal-i" href="${esc(g.url)}"${ext}${tr('gallery_click', g.alt)}>${img}</a>` : `<figure class="gal-i">${img}</figure>`;
    }).join('\n    ')}
  </div>`));
  }

  if (m.services && m.services.items && m.services.items.length) {
    blocks.push(sec('mod-svc', m.services.title || 'Services', `<ul class="svc">
    ${m.services.items.map(s => `<li><a href="${esc(s.url || k.website)}"${ext}${tr('service_click', s.name)}><span><b>${esc(s.name)}</b>${s.line ? `<small>${esc(s.line)}</small>` : ''}</span>${ic('chevron', 'ic ic-go')}</a></li>`).join('\n    ')}
  </ul>`));
  }

  if (m.offer) {
    const o = m.offer;
    blocks.push(sec('mod-offer', '', `<div class="offer">${ic('tag', 'ic ic-offer')}<div><h2 class="offer-h">${esc(o.title)}</h2>${o.line ? `<p class="mod-p">${esc(o.line)}</p>` : ''}${o.until ? `<p class="offer-until">Until ${esc(o.until)}</p>` : ''}</div></div>
  ${o.code ? `<button class="offer-code" type="button" data-copy="${esc(o.code)}"${tr('offer_copy')}><span>${esc(o.code)}</span><small>Tap to copy</small></button>` : ''}
  ${o.url ? `<a class="btn btn--ghost" href="${esc(o.url)}"${ext}${tr('offer_click')}>${esc(o.cta || 'Claim offer')}</a>` : ''}`));
  }

  if (m.review && m.review.url) {
    blocks.push(sec('mod-review', '', `<a class="review" href="${esc(m.review.url)}"${ext}${tr('review_click')}>
    <span class="stars">${ic('star')}${ic('star')}${ic('star')}${ic('star')}${ic('star')}</span>
    <span class="review-t"><b>${esc(m.review.title || 'Leave us a review')}</b><small>${esc(m.review.line || 'It takes a minute and helps more than you know.')}</small></span>
    ${ic('chevron', 'ic ic-go')}
  </a>`));
  }

  if (m.lead) {
    const L = m.lead;
    blocks.push(sec('mod-lead', L.title || 'Send me your info', `${L.line ? `<p class="mod-p">${esc(L.line)}</p>` : ''}
  <form class="lead" novalidate data-to="${esc(L.to)}" data-endpoint="${esc(L.endpoint || '')}" data-key="${esc(L.key || '')}" data-business="${esc(id.business)}">
    <label><span>Name</span><input name="name" autocomplete="name" required enterkeyhint="next"></label>
    <label><span>Phone</span><input name="phone" type="tel" autocomplete="tel" inputmode="tel" enterkeyhint="next"></label>
    <label><span>Email</span><input name="email" type="email" autocomplete="email" inputmode="email" enterkeyhint="next"></label>
    <label><span>What can we help with? <i>optional</i></span><textarea name="message" rows="2" enterkeyhint="send"></textarea></label>
    <input class="hp" name="botcheck" tabindex="-1" autocomplete="off" aria-hidden="true">
    <p class="lead-err" role="alert" hidden></p>
    <button class="btn" type="submit">${ic('send')}<span>Send</span></button>
  </form>
  <div class="lead-ok" hidden role="status">${ic('check', 'ic ic-ok')}<p><b>Got it — thank you.</b><br>We’ll be in touch soon.</p></div>`));
  }

  if (m.share) {
    blocks.push(sec('mod-share', '', `<div class="duo">
    <button class="btn btn--ghost" type="button" data-share${tr('share')}>${ic('share')}<span>Share card</span></button>
    <button class="btn btn--ghost" type="button" data-open="qr"${tr('show_qr')}>${ic('qr')}<span>Show QR</span></button>
  </div>`));
  }

  if (m.install) {
    blocks.push(`
<section class="mod mod-install" data-install hidden>
  <img class="app-ic" src="art/apple-touch-icon.png" alt="" width="60" height="60">
  <h2 class="install-h">${esc(m.install.title || `Keep ${id.business} on your phone`)}</h2>
  <p class="mod-p">${esc(m.install.line || 'Add our app for one-tap access anytime.')}</p>
  <button class="btn" type="button" data-install-go${tr('install_click')}>${ic('plusApp')}<span>Add to Home Screen</span></button>
</section>`);
  }

  const promo = m.promo ? `
<a class="promo" href="${esc(m.promo.url)}"${ext}${tr('promo_click')}>
  <span><b>${esc(m.promo.title)}</b><small>${esc(m.promo.line)}</small></span>${ic('arrow', 'ic ic-go')}
</a>` : '';

  /* the sheets: QR to show someone across a table, and how to install where
     the browser will not offer to itself */
  const sheets = `
<dialog class="sheet" id="qr" aria-label="QR code for this card">
  <div class="sheet-in sheet-qr">
    ${qrSvg(ctx.url + '?s=share', { cls: 'qr' })}
    <p class="sheet-t">${esc(id.business)}</p>
    <p class="sheet-s">Point a phone camera here to open this card.</p>
    <form method="dialog"><button class="btn btn--ghost">Done</button></form>
  </div>
</dialog>
<dialog class="sheet" id="how" aria-label="Add to Home Screen">
  <div class="sheet-in">
    <h2 class="sheet-t">Add to your Home Screen</h2>
    <ol class="how" data-how="ios">
      <li>${ic('iosShare')}<span>Tap <b>Share</b> in the browser bar</span></li>
      <li>${ic('plusApp')}<span>Scroll and tap <b>Add to Home Screen</b></span></li>
      <li>${ic('check')}<span>Tap <b>Add</b> — ${esc(c.app && c.app.short || id.business)} is now with your apps</span></li>
    </ol>
    <ol class="how" data-how="android" hidden>
      <li>${ic('dots')}<span>Open the browser menu <b>⋮</b></span></li>
      <li>${ic('plusApp')}<span>Tap <b>Add to Home screen</b> or <b>Install app</b></span></li>
      <li>${ic('check')}<span>Confirm — ${esc(c.app && c.app.short || id.business)} is now with your apps</span></li>
    </ol>
    <div class="how" data-how="inapp" hidden>
      <p class="sheet-s">This is opening inside another app’s browser, which can’t add to your Home Screen. Open it in <b>Safari</b> or <b>Chrome</b> first — tap <b>⋯</b> and choose <b>Open in browser</b>, or copy the link.</p>
      <button class="btn btn--ghost" type="button" data-copy="${esc(ctx.url)}">${ic('share')}<span>Copy link</span></button>
    </div>
    <form method="dialog"><button class="btn">Got it</button></form>
  </div>
</dialog>
<div class="toast" role="status" aria-live="polite"></div>`;

  const desk = `
<aside class="desk">
  <div class="desk-in">
    ${qrSvg(ctx.url + '?s=desktop', { cls: 'qr' })}
    <div>
      <img src="art/logo-160.webp" alt="" width="64" height="64">
      <h1>${esc(id.business)}</h1>
      <p class="desk-lead">This experience was made for your phone.</p>
      <p class="desk-s">Scan to open it there — save the contact, get in touch, and keep it on your home screen.</p>
      <button class="desk-anyway" type="button" data-anyway>View it here anyway</button>
    </div>
  </div>
</aside>`;

  const footer = `
<footer class="foot">
  <p>${esc(id.business)}${id.area ? ` · ${esc(id.area)}` : ''}</p>
  ${ctx.privacy ? `<p><a href="${esc(ctx.privacy)}">Privacy</a></p>` : ''}
</footer>`;

  const body = [identity, save, actions, social, ...blocks, promo, footer].join('\n');
  const desc = [id.tagline, id.services, id.area].filter(Boolean).join(' ');
  const title = id.person ? `${id.person} · ${id.business}` : id.business;

  return `<!doctype html>
<html lang="en" data-theme="${ctx.mode}" style="--accent:${ctx.accent};--on-accent:${ctx.onAccent}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
<link rel="canonical" href="${esc(ctx.url)}">
${ctx.index ? '' : '<meta name="robots" content="noindex, follow">\n'}<meta name="theme-color" content="${ctx.bg}">
<meta name="color-scheme" content="${ctx.mode}">
<link rel="manifest" href="manifest.webmanifest">
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="${ctx.mode === 'dark' ? 'black-translucent' : 'default'}">
<meta name="apple-mobile-web-app-title" content="${esc(c.app && c.app.short || id.business)}">
<link rel="apple-touch-icon" href="art/apple-touch-icon.png">
<link rel="icon" type="image/png" sizes="32x32" href="art/icon-32.png">
<meta property="og:type" content="profile">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:url" content="${esc(ctx.url)}">
${ctx.og ? `<meta property="og:image" content="${esc(ctx.og)}">\n<meta name="twitter:card" content="summary_large_image">\n` : ''}<link rel="preload" as="image" href="art/hero-720.webp" imagesrcset="art/hero-720.webp 720w, art/hero-1080.webp 1080w" imagesizes="(max-width: 480px) 100vw, 440px">
${ctx.fonts.map(f => `<link rel="preload" as="font" type="font/woff2" href="${f}" crossorigin>`).join('\n')}
<link rel="stylesheet" href="card.css?v=${ctx.stamp.css}">
${ctx.consent ? ctx.consent + '\n' : ''}<script src="card.js?v=${ctx.stamp.js}" defer></script>
</head>
<body>
${sprite(used.concat(['close']))}
<main class="card" data-card="${esc(ctx.slug)}">
${body}
</main>
${sheets}
${desk}
</body>
</html>
`;
}

/* ---- everything for one card ----------------------------------------------- */
function buildCard(dir, o) {
  const file = path.join(dir, 'card.json');
  const c = JSON.parse(fs.readFileSync(file, 'utf8'));
  check(c, path.relative(o.ROOT, file));
  const slug = path.basename(dir);
  const T = path.join(o.ROOT, 'cards', 'template');
  const outDir = path.join(o.OUT, c.path);
  fs.mkdirSync(path.join(outDir, 'art'), { recursive: true });
  const url = o.SITE + c.path;
  const mode = (c.theme.mode || 'dark');
  const accent = c.theme.accent.toLowerCase();

  /* the art make_art.js cut - every file the page names has to be there */
  const artDir = path.join(dir, 'art');
  const art = fs.existsSync(artDir) ? fs.readdirSync(artDir) : [];
  for (const need of ['logo-160.webp', 'apple-touch-icon.png', 'icon-192.png', 'icon-512.png', 'icon-maskable-512.png', 'icon-32.png']
    .concat(c.art && c.art.hero ? ['hero-720.webp', 'hero-1080.webp'] : []))
    if (!art.includes(need)) throw new Error(`card ${slug}: art/${need} missing - run tools/card/make_art.js ${slug}`);
  for (const f of art) fs.copyFileSync(path.join(artDir, f), path.join(outDir, 'art', f));

  const css = fs.readFileSync(path.join(T, 'card.css'), 'utf8');
  const js = fs.readFileSync(path.join(T, 'card.js'), 'utf8');
  const stamp = { css: hash(css), js: hash(js) };
  fs.writeFileSync(path.join(outDir, 'card.css'), css);
  fs.writeFileSync(path.join(outDir, 'card.js'), js);

  /* the fonts are the site's own files at /assets/fonts - the card uses the
     same face as everything else, and they are already cached for a year */
  const fonts = [...css.matchAll(/url\("(\/assets\/fonts\/[^"]+\.woff2)"\)/g)].map(m => m[1]);
  for (const f of fonts) if (!fs.existsSync(path.join(o.OUT, f)))
    throw new Error(`card ${slug}: font ${f} is not in the build`);

  const vcfName = slugify(c.identity.person || c.identity.business) + '.vcf';
  const photo = art.includes('vcard-photo.jpg') ? fs.readFileSync(path.join(artDir, 'vcard-photo.jpg')) : null;
  fs.writeFileSync(path.join(outDir, vcfName), vcard(c, url, photo));
  fs.writeFileSync(path.join(outDir, 'qr.svg'), qrSvg(url + '?s=qr'));

  const html = render(c, {
    slug, url, mode, accent, onAccent: onAccent(accent), bg: BASE[mode].bg,
    index: !!c.index, vcf: vcfName, stamp, fonts: fonts.slice(0, 2),
    og: c.og || o.og, privacy: c.privacy === undefined ? o.privacy : c.privacy,
    consent: o.consent,
  });
  fs.writeFileSync(path.join(outDir, 'index.html'), html);

  const bg = BASE[mode].bg;
  fs.writeFileSync(path.join(outDir, 'manifest.webmanifest'), JSON.stringify({
    id: c.path,
    name: (c.app && c.app.name) || c.identity.business,
    short_name: (c.app && c.app.short) || c.identity.business,
    description: [c.identity.tagline, c.identity.services].filter(Boolean).join(' '),
    start_url: c.path + '?s=app',
    scope: c.path,
    display: 'standalone',
    orientation: 'portrait',
    background_color: bg,
    theme_color: bg,
    icons: [
      { src: 'art/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: 'art/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: 'art/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  }, null, 2));

  /* the worker is versioned by everything it caches, so any change to the
     card - text, art, code - is a new cache and the old one is cleared */
  const shell = ['./', vcfName, 'manifest.webmanifest', `card.css?v=${stamp.css}`, `card.js?v=${stamp.js}`,
    ...art.filter(f => f !== 'vcard-photo.jpg' && f !== 'hero-1080.webp').map(f => 'art/' + f), ...fonts];
  const version = hash(html + JSON.stringify(shell) + art.map(f => fs.statSync(path.join(artDir, f)).size).join());
  const sw = fs.readFileSync(path.join(T, 'sw.js'), 'utf8')
    .replace('__CACHE__', `card-${slug}-${version}`)
    .replace('__PREFIX__', `card-${slug}-`)
    .replace('__SHELL__', JSON.stringify(shell));
  fs.writeFileSync(path.join(outDir, 'sw.js'), sw);

  return { slug, path: c.path, url, vcf: vcfName, index: !!c.index,
           bytes: Buffer.byteLength(html) };
}

function buildAll(o) {
  const root = path.join(o.ROOT, 'cards');
  if (!fs.existsSync(root)) return [];
  const built = fs.readdirSync(root, { withFileTypes: true })
    .filter(e => e.isDirectory() && e.name !== 'template' && fs.existsSync(path.join(root, e.name, 'card.json')))
    .map(e => buildCard(path.join(root, e.name), o));
  const paths = built.map(b => b.path);
  if (new Set(paths).size !== paths.length) throw new Error('two cards share a path: ' + paths.join(' '));
  return built;
}

/* what the host needs told about a card: the contact file is a vCard, opened
   in place (iOS shows the contact sheet; a download would land in Files), and
   the worker must be re-read on every visit or an update never takes hold */
function headers(built) {
  return built.map(b => `${b.path}*.vcf
  Content-Type: text/vcard; charset=utf-8
  Content-Disposition: inline; filename="${b.vcf}"
${b.path}sw.js
  Cache-Control: no-cache
${b.path}manifest.webmanifest
  Content-Type: application/manifest+json
${b.path}art/*
  Cache-Control: public, max-age=604800
`).join('');
}

/* /hwy19/adambc and /hwy19/adambc/ are the same card - a tag written or a
   link typed without the last slash still lands on it */
function redirects(built) {
  return built.map(b => `${b.path.replace(/\/$/, '')} ${b.path} 301\n`).join('');
}

module.exports = { buildAll, headers, redirects, vcard, qrSvg, onAccent };
