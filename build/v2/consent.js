/* ============================================================================
 * THE CONSENT BANNER - LAYERED
 * ----------------------------------------------------------------------------
 * Two layers, two different defaults (changed Nov 12, 2026):
 *
 *   VISIT STATS (Google Analytics, analytics_storage)  ON for everyone.
 *     GA loads with the page so every visit is counted. Anyone can switch it
 *     off under Options or Cookie choices. Before this change GA was not even
 *     fetched until Accept, so most visits were never counted at all.
 *
 *   MARKETING (Meta pixel; ad_storage, ad_user_data, ad_personalization)
 *     OFF until the visitor clicks "Accept all" (or ticks it under Options).
 *     The pixel is not fetched before that.
 *
 * EU/EEA, UK AND SWITZERLAND: a second, region-scoped gtag consent default
 * keeps analytics_storage DENIED there too, so GA asks first in those places
 * (cookieless G100 pings until the visitor says yes to stats). Only an
 * explicit yes to stats (Accept all, or Save with Visit stats ticked) sends
 * analytics_storage 'granted' in an update; "No thanks" updates the marketing
 * signals only, so it never overrides the regional default.
 *
 * Buttons: Accept all / No thanks (declines marketing only) / Options (two
 * checkboxes, stats pre-ticked). Same size and weight, none hidden.
 *
 * OLD ANSWERS: a visitor who declined the old one-question banner
 * (h19.consent.v1, ok:false) is counted from now on, with marketing kept off,
 * and is not asked again. A browser sending Global Privacy Control is treated
 * as "No thanks": stats on, marketing off, no banner. Only someone who unticks
 * Visit stats under the NEW Options (stored with by:'options') stays out of
 * the stats. Cookie choices at the foot of every page reopens it for anyone.
 *
 * STATS OFF still loads the Google tag, with analytics_storage denied, so GA
 * gets only cookieless gcs=G100 pings: no cookies, no client id, not counted
 * as visitors. Marketing never loads fbevents.js until it is granted.
 *
 * The answer lives in localStorage (h19.consent.v2) on the visitor's machine.
 * ========================================================================= */
(function () {
  'use strict';

  var GA_ID = 'G-50PLEN6KSF';

  /* META PIXEL - ready, off. Paste the pixel ID here to switch it on. It loads
     only with marketing consent. Before it goes live: list it on /cookies/,
     and add https://connect.facebook.net to script-src and
     https://www.facebook.com to img-src and connect-src in build_site.js. */
  var META_PIXEL_ID = '';

  /* Cloudflare Web Analytics: cookieless, so it loads for everyone. LEAVE THIS
     EMPTY while Cloudflare injects the beacon itself (automatic setup is on
     for highway19media.com, token 0d6081fa..., checked Nov 12, 2026); both at
     once would count every visit twice. Fill it in only if that is turned off. */
  var CF_BEACON_TOKEN = '';

  /* EU 27 + Iceland, Liechtenstein, Norway (EEA) + UK + Switzerland */
  var ASK_FIRST = ['AT','BE','BG','HR','CY','CZ','DK','EE','FI','FR','DE','GR','HU',
    'IE','IT','LV','LT','LU','MT','NL','PL','PT','RO','SK','SI','ES','SE',
    'IS','LI','NO','GB','CH'];

  var KEY = 'h19.consent.v2', OLD = 'h19.consent.v1';
  var root = document.documentElement;

  window.dataLayer = window.dataLayer || [];
  function gtag(){ dataLayer.push(arguments); }

  /* ---- the stored answer -------------------------------------------------- */
  function read(k) {
    try { return JSON.parse(localStorage.getItem(k) || 'null'); }
    catch (e) { return null; }                 /* private window, blocked storage */
  }
  function store(c, by) {
    try { localStorage.setItem(KEY, JSON.stringify({ stats: c.stats, ads: c.ads, by: by, at: Date.now() })); }
    catch (e) {}                               /* the answer still holds for this visit */
  }

  /* answered: has the visitor (or their browser) already given an answer? */
  var choice = { stats: true, ads: false }, answered = false;
  var gpc = navigator.globalPrivacyControl === true;
  var was = read(KEY), old = read(OLD);
  /* A v2 record with no `by` was written by the first version of this file
     (Nov 12, 2026, live about an hour) when it moved an old decline across as
     stats-off. That was not this visitor's choice, so it counts as No thanks. */
  if (was && (was.by || was.stats !== false)) {
    choice = { stats: was.stats !== false, ads: was.ads === true, by: was.by }; answered = true;
  }
  else if (was || (old && old.ok === false)) { /* declined on the old banner */
    choice = { stats: true, ads: false }; answered = true; store(choice, 'old');
  }
  else if (gpc) { choice = { stats: true, ads: false }; answered = true; }

  function mark() {
    root.setAttribute('data-consent', choice.ads ? 'yes' : (choice.stats ? 'stats' : 'no'));
  }

  /* ---- Google Analytics ---------------------------------------------------
   * Consent defaults go in before the tag loads: stats as chosen (granted for
   * a new visitor), every advertising signal denied unless marketing is on. */
  var gaLoaded = false;
  /* stats were said yes to on purpose (this matters only where GA asks first) */
  function statsChosen() { return choice.by === 'accept' || choice.by === 'options'; }
  function consentState() {
    var ad = choice.ads ? 'granted' : 'denied';
    var s = { ad_storage: ad, ad_user_data: ad, ad_personalization: ad };
    if (!choice.stats) s.analytics_storage = 'denied';
    else if (statsChosen()) s.analytics_storage = 'granted';
    return s;
  }
  function startGA() {
    if (gaLoaded) return;
    gaLoaded = true;
    var ad = choice.ads ? 'granted' : 'denied';
    var stats = choice.stats ? 'granted' : 'denied';
    gtag('consent', 'default', { analytics_storage: stats,
      ad_storage: ad, ad_user_data: ad, ad_personalization: ad });
    gtag('consent', 'default', { analytics_storage: statsChosen() ? stats : 'denied',
      ad_storage: ad, ad_user_data: ad, ad_personalization: ad, region: ASK_FIRST });
    gtag('js', new Date());
    gtag('config', GA_ID);
    window.gtag = gtag;
    var s = document.createElement('script');
    s.async = true; s.src = 'https://www.googletagmanager.com/gtag/js?id=' + GA_ID;
    document.head.appendChild(s);
  }

  /* ---- Meta pixel (marketing only) --------------------------------------- */
  var metaLoaded = false;
  function startMeta() {
    if (metaLoaded || !META_PIXEL_ID || !choice.ads) return;
    metaLoaded = true;
    !function (f, b, e, v, n, t, s) {
      if (f.fbq) return; n = f.fbq = function () {
        n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments); };
      if (!f._fbq) f._fbq = n; n.push = n; n.loaded = !0; n.version = '2.0';
      n.queue = []; t = b.createElement(e); t.async = !0; t.src = v;
      s = b.getElementsByTagName(e)[0]; s.parentNode.insertBefore(t, s);
    }(window, document, 'script', 'https://connect.facebook.net/en_US/fbevents.js');
    fbq('init', META_PIXEL_ID);
    fbq('track', 'PageView');
  }

  /* Apply the current choice to whatever has already loaded, then load what
     the choice now allows. Switching something off mid-visit stops it. */
  function apply() {
    mark();
    if (gaLoaded) {
      gtag('consent', 'update', consentState());
    }
    if (window.fbq) try { fbq('consent', choice.ads ? 'grant' : 'revoke'); } catch (e) {}
    startGA();
    startMeta();
  }

  /* ---- Cloudflare Web Analytics beacon (no cookies, no consent needed) ---- */
  if (CF_BEACON_TOKEN) {
    var cf = document.createElement('script');
    cf.defer = true; cf.src = 'https://static.cloudflareinsights.com/beacon.min.js';
    cf.setAttribute('data-cf-beacon', JSON.stringify({ token: CF_BEACON_TOKEN }));
    document.head.appendChild(cf);
  }

  /* ---- WHERE DO PEOPLE LEAVE? ---------------------------------------------
   * section_view goes to GA once per section per page view, the first time at
   * least half of it is on screen (half of the screen, for a section taller
   * than the screen). A section is named by data-section, else by its id.
   * Consent is gtag's job: with stats off these are cookieless pings. The
   * URL is never touched. */
  var seen = {}, secs = [];
  function collect() {
    var all = document.querySelectorAll('[data-section], section[id]');
    for (var i = 0; i < all.length; i++) {
      var el = all[i], p = el.parentElement, nested = false;
      while (p) { if (p.matches && p.matches('[data-section], section[id]')) { nested = true; break; } p = p.parentElement; }
      if (!nested) secs.push(el);
    }
  }
  var ticking = false;
  function check() {
    ticking = false;
    var vh = window.innerHeight || document.documentElement.clientHeight;
    for (var i = 0; i < secs.length; i++) {
      var el = secs[i], name = el.getAttribute('data-section') || el.id;
      if (!name || seen[name]) continue;
      var r = el.getBoundingClientRect();
      if (!r.height || !r.width) continue;               /* hidden (phone/desktop twin) */
      if (getComputedStyle(el).visibility === 'hidden') continue;   /* a closed pop-up */
      var vis = Math.min(r.bottom, vh) - Math.max(r.top, 0);
      if (vis >= 0.5 * Math.min(r.height, vh)) {
        seen[name] = true;
        gtag('event', 'section_view', { section: name, page_path: location.pathname });
      }
    }
  }
  function onScroll() { if (!ticking) { ticking = true; requestAnimationFrame(check); } }
  function startSections() {
    collect();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll, { passive: true });
    setTimeout(check, 600);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', startSections);
  else startSections();

  /* ---- WHAT WE COUNT ------------------------------------------------------
   * Two moments. GA gets them unless visit stats are switched off; Meta only
   * with marketing consent (until then fbq does not exist):
   *   contact_click  any CONTACT US / Send Us Your Site link - to the contact
   *                  page or to a form on the page. Meta: Contact.
   *   generate_lead  the form actually sent (form.js calls h19Track after the
   *                  service says success). Meta: Lead. Mark this one as the
   *                  conversion in GA4 (Admin > Events > Mark as key event).
   * and, on the pages that have them (service.js), how far a reader goes:
   *   scene_step     the What We Do scene reached a state (step_name)
   *   faq_open       a question was opened (question)
   * Those reach Meta as custom events, never as a Contact or a Lead. */
  window.h19Track = function (name, params) {
    params = params || {};
    params.page_path = location.pathname;
    try { if (window.gtag) gtag('event', name, params); } catch (e) {}
    try {
      if (window.fbq) {
        if (name === 'generate_lead') fbq('track', 'Lead', params);
        else if (name === 'contact_click') fbq('track', 'Contact', params);
        else fbq('trackCustom', name, params);
      }
    } catch (e) {}
  };
  document.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('a[href]');
    if (!a) return;
    var h = a.getAttribute('href');
    if (h !== '#contact' && h !== '/#contact' && h !== '/contact/') return;
    /* where on the page the click came from: hero, the closing ask, header... */
    var at = a.closest('header,footer,nav,section');
    window.h19Track('contact_click', {
      link_text: (a.getAttribute('aria-label') || a.textContent || '').trim().slice(0, 60),
      link_url: h,
      link_location: at ? (at.className || at.tagName).toString().split(' ')[0].slice(0, 40) : 'page' });
  }, true);

  /* ---- the bar ----------------------------------------------------------- */
  function show() {
    if (document.getElementById('h19-consent')) return;
    var el = document.createElement('div');
    el.id = 'h19-consent';
    el.className = 'consent';
    el.setAttribute('role', 'dialog');
    el.setAttribute('aria-live', 'polite');
    el.setAttribute('aria-label', 'Cookie choice');
    el.innerHTML =
      '<p class="consent__text"><b>1. Counting visits:</b> we count how many people '
    + 'come in and where they get stuck, only to improve the site. It’s never sold '
    + 'to anyone (switch it off under Options).<br><b>2. Marketing:</b> may we use '
    + 'Google and Meta cookies to show you our ads elsewhere too? '
    + '<a href="/cookies/">Details</a></p>'
    + '<div class="consent__opts" hidden>'
    + '<label class="consent__opt"><input type="checkbox" name="stats"> Visit stats '
    + '<span>(Google Analytics: counts visits, never sold)</span></label>'
    + '<label class="consent__opt"><input type="checkbox" name="ads"> Marketing '
    + '<span>(Google and Meta ad cookies)</span></label>'
    + '</div>'
    + '<div class="consent__act">'
    + '<button type="button" class="consent__btn consent__btn--opt">Options</button>'
    + '<button type="button" class="consent__btn consent__btn--no">No thanks</button>'
    + '<button type="button" class="consent__btn consent__btn--yes">Accept all</button>'
    + '<button type="button" class="consent__btn consent__btn--save" hidden>Save choices</button>'
    + '</div>';
    /* the buttons are the same size and the same weight on purpose: a
       No thanks made deliberately hard to find is not a choice */
    var q = function (s) { return el.querySelector(s); };
    q('input[name=stats]').checked = choice.stats;
    q('input[name=ads]').checked = choice.ads;
    q('.consent__btn--yes').addEventListener('click', function () { answer({ stats: true, ads: true }, 'accept'); });
    q('.consent__btn--no').addEventListener('click', function () { answer({ stats: choice.stats, ads: false }, 'no'); });
    q('.consent__btn--opt').addEventListener('click', function () {
      q('.consent__opts').hidden = false;
      q('.consent__btn--opt').hidden = true;
      q('.consent__btn--save').hidden = false;
      el.classList.add('is-open');
    });
    q('.consent__btn--save').addEventListener('click', function () {
      answer({ stats: q('input[name=stats]').checked, ads: q('input[name=ads]').checked }, 'options');
    });
    document.body.appendChild(el);
    requestAnimationFrame(function () { el.classList.add('is-up'); });
  }

  function answer(c, by) {
    choice = c; choice.by = by; answered = true;
    store(c, by);
    apply();
    var el = document.getElementById('h19-consent');
    if (el) { el.classList.remove('is-up');
              setTimeout(function () { el.remove(); }, 260); }
  }

  /* ---- and the way back in ------------------------------------------------
   * Every page's footer carries a Cookie choices link to this, so a choice is
   * never a one-way door. It opens with the checkboxes showing. */
  document.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('[data-consent-reopen]');
    if (!a) return;
    e.preventDefault();
    answered = true;                           /* the late bar stays away */
    show();
    var b = document.querySelector('#h19-consent .consent__btn--opt');
    if (b) b.click();
  });

  /* Stats start straight away (for everyone who has not switched them off). */
  apply();
  if (answered) return;

  /* LET THEM SEE THE PAGE FIRST. The bar waits five seconds after the page is
     ready, so the first thing a visitor meets is the site, not a question.
     Marketing stays off in the meantime - waiting is the same as not yet
     saying yes. */
  /* A BUSINESS CARD waits four seconds, and its clock starts only once the
     card's intro film has gone. */
  var DELAY = root.hasAttribute('data-card') ? 4000 : 5000;
  function later() {
    var film = document.getElementById('intro');
    if (film && film.offsetWidth) { setTimeout(later, 250); return; }
    setTimeout(function () { if (!answered) show(); }, DELAY);
  }
  if (document.readyState === 'loading')
    document.addEventListener('DOMContentLoaded', later);
  else later();
})();
