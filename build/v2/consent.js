/* ============================================================================
 * THE CONSENT BANNER
 * ----------------------------------------------------------------------------
 * There is nothing to consent to yet: no pixel, no analytics, no advertising
 * script anywhere on this site. This exists so that when there IS, the answer
 * to "did it load before he agreed?" is no - by construction rather than by
 * remembering to check.
 *
 * HOW IT WORKS. A tag is not written into the page. It is declared in TAGS
 * below, and nothing in that list is fetched until a visitor has said yes. A
 * declined visit never contacts those hosts at all: not loaded and switched
 * off, not fetched. That is the difference between a banner and a fig leaf,
 * and it is the only version worth shipping.
 *
 * WHILE THE LIST IS EMPTY THE BANNER NEVER APPEARS. A site with no cookies
 * asking permission to set cookies is a lie in the other direction, and it
 * trains people to click Accept without reading. Add the first tag and the
 * banner starts appearing on its own.
 *
 * WHERE THE ANSWER LIVES. localStorage, on the visitor's own machine. It never
 * leaves the browser and it is not a cookie, so the banner does not need to ask
 * permission to remember that you answered it.
 * ========================================================================= */
(function () {
  'use strict';

  /* ---- THE TAGS -----------------------------------------------------------
   * Add one entry per tool. `src` is fetched only after consent; `init` runs
   * after it loads. Keep the id stable - it is what a returning visitor's
   * stored answer is matched against, so adding a NEW tool re-asks rather than
   * quietly assuming last year's yes covered it.
   *
   *   { id:'meta', name:'Meta pixel',
   *     src:'https://connect.facebook.net/en_US/fbevents.js',
   *     init: function () { fbq('init','<PIXEL ID>'); fbq('track','PageView'); } }
   *
   * Anything added here also has to be listed on /cookies/ before it goes
   * live, and connect-src / script-src in tools/build_site.js has to be
   * widened to let it through - the content policy will block it otherwise,
   * which is the safety net working. */
  var TAGS = [
    /* GOOGLE ANALYTICS 4, AND NOT IN THE HEAD. Google's own instructions say to
       paste this immediately after <head> on every page, which would fetch it
       and set its cookies before a visitor has been asked anything - the exact
       thing this file exists to prevent, and the opposite of what /cookies/
       promises. Declared here instead, it is fetched on accept and never
       otherwise. The two gtag() calls below are Google's, run once the script
       has actually loaded rather than queued ahead of it. */
    { id: 'ga4', name: 'Google Analytics',
      src: 'https://www.googletagmanager.com/gtag/js?id=G-50PLEN6KSF',
      init: function () {
        window.dataLayer = window.dataLayer || [];
        function gtag(){ dataLayer.push(arguments); }
        window.gtag = gtag;
        gtag('js', new Date());
        gtag('config', 'G-50PLEN6KSF');
      } }
  ];

  var KEY = 'h19.consent.v1';
  var root = document.documentElement;

  function ids() { return TAGS.map(function (t) { return t.id; }).sort().join(','); }

  function saved() {
    try { return JSON.parse(localStorage.getItem(KEY) || 'null'); }
    catch (e) { return null; }                 /* private window, blocked storage */
  }
  function store(ok) {
    try { localStorage.setItem(KEY, JSON.stringify({ ok: ok, tags: ids(), at: Date.now() })); }
    catch (e) {}                               /* the answer still holds for this visit */
  }

  function load() {
    TAGS.forEach(function (t) {
      if (t.done) return;
      t.done = true;
      if (!t.src) { if (t.init) t.init(); return; }
      var s = document.createElement('script');
      s.async = true; s.src = t.src;
      s.onload = function () { if (t.init) try { t.init(); } catch (e) {} };
      document.head.appendChild(s);
    });
  }

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
      '<p class="consent__text">We would like to use Google Analytics to count '
    + 'visits and see which pages get read. Nothing is loaded unless you say yes, '
    + 'and the site works either way. <a href="/cookies/">What we would use</a>.</p>'
    + '<div class="consent__act">'
    + '<button type="button" class="consent__btn consent__btn--no">Decline</button>'
    + '<button type="button" class="consent__btn consent__btn--yes">Accept</button>'
    + '</div>';
    /* the two buttons are the same size and the same weight on purpose: a
       Decline made deliberately hard to find is not a choice */
    el.querySelector('.consent__btn--yes').addEventListener('click', function () { answer(true); });
    el.querySelector('.consent__btn--no').addEventListener('click', function () { answer(false); });
    document.body.appendChild(el);
    requestAnimationFrame(function () { el.classList.add('is-up'); });
  }

  function answer(ok) {
    store(ok);
    root.setAttribute('data-consent', ok ? 'yes' : 'no');
    var el = document.getElementById('h19-consent');
    if (el) { el.classList.remove('is-up');
              setTimeout(function () { el.remove(); }, 260); }
    if (ok) load();
  }

  /* ---- and the way back in ------------------------------------------------
   * Every page's footer carries a link to this, so a choice is never a one-way
   * door. It does nothing visible while there is nothing to consent to. */
  function reopen() {
    root.removeAttribute('data-consent');
    if (TAGS.length) show();
  }
  document.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('[data-consent-reopen]');
    if (!a) return;
    e.preventDefault();
    reopen();
  });

  var was = saved();
  if (was && was.ok && was.tags === ids()) { root.setAttribute('data-consent', 'yes'); load(); return; }
  if (was && !was.ok && was.tags === ids()) { root.setAttribute('data-consent', 'no'); return; }
  if (!TAGS.length) return;                    /* nothing to ask about yet */
  if (document.readyState === 'loading')
    document.addEventListener('DOMContentLoaded', show);
  else show();
})();
