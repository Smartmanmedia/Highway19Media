/* ============================================================================
 * Highway 19 Media - tracking, only after consent
 * ----------------------------------------------------------------------------
 * The same consent bar as the rest of highway19media.com, and the same stored
 * answer (localStorage 'h19.consent.v1'), so a visitor who already chose on
 * the home page is not asked again here.
 *
 * Nothing below is fetched until a visitor presses Accept. A declined visit
 * never contacts Google or Meta at all.
 *
 * TO SWITCH A TOOL ON, fill in its ID below and upload this file again:
 *   - META_PIXEL_ID   Meta Events Manager > Data sources > your pixel > ID
 *   - GTM_ID          only if you move to Google Tag Manager (GTM-XXXXXXX);
 *                     if you do, remove GA4 here and fire it from GTM instead
 * Anything switched on here must also be listed on /cookies/.
 *
 * Adding a tool changes the list of tools, and a visitor's earlier answer
 * only covers the list they saw - so they are asked once more. That is
 * deliberate.
 * ========================================================================= */
(function () {
  'use strict';

  var GA4_ID        = 'G-50PLEN6KSF';   // the site's existing Google Analytics property
  var META_PIXEL_ID = '';               // e.g. '123456789012345'
  var GTM_ID        = '';               // e.g. 'GTM-ABC1234'

  var TAGS = [];

  if (GA4_ID) TAGS.push({
    id: 'ga4', name: 'Google Analytics',
    src: 'https://www.googletagmanager.com/gtag/js?id=' + GA4_ID,
    init: function () {
      window.dataLayer = window.dataLayer || [];
      function gtag() { dataLayer.push(arguments); }
      window.gtag = gtag;
      gtag('js', new Date());
      gtag('config', GA4_ID);
    }
  });

  if (META_PIXEL_ID) TAGS.push({
    id: 'meta', name: 'Meta Pixel',
    /* Meta's own base code, run on accept instead of in the head */
    init: function () {
      !function (f, b, e, v, n, t, s) {
        if (f.fbq) return; n = f.fbq = function () {
          n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments); };
        if (!f._fbq) f._fbq = n; n.push = n; n.loaded = !0; n.version = '2.0';
        n.queue = []; t = b.createElement(e); t.async = !0; t.src = v;
        s = b.getElementsByTagName(e)[0]; s.parentNode.insertBefore(t, s);
      }(window, document, 'script', 'https://connect.facebook.net/en_US/fbevents.js');
      fbq('init', META_PIXEL_ID);
      fbq('track', 'PageView');
      fbq('track', 'ViewContent', { content_name: 'Video Production', content_category: 'Service' });
    }
  });

  if (GTM_ID) TAGS.push({
    id: 'gtm', name: 'Google Tag Manager',
    src: 'https://www.googletagmanager.com/gtm.js?id=' + GTM_ID,
    init: function () {}
  });
  if (GTM_ID) {
    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push({ 'gtm.start': new Date().getTime(), event: 'gtm.js' });
  }

  /* Every "contact" button on this page is a lead signal. Once a tool is
     allowed, clicks are reported to whichever tools are running. */
  document.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('a[href="/#contact"]');
    if (!a) return;
    var label = (a.textContent || '').trim();
    if (window.gtag) gtag('event', 'contact_click', { link_text: label, page: 'video-production' });
    if (window.fbq) fbq('track', 'Contact', { content_name: label });
  });

  var KEY = 'h19.consent.v1';
  var root = document.documentElement;

  function ids() { return TAGS.map(function (t) { return t.id; }).sort().join(','); }
  function names() {
    var n = TAGS.map(function (t) { return t.name; });
    return n.length > 1 ? n.slice(0, -1).join(', ') + ' and ' + n[n.length - 1] : n[0];
  }

  function saved() {
    try { return JSON.parse(localStorage.getItem(KEY) || 'null'); }
    catch (e) { return null; }
  }
  function store(ok) {
    try { localStorage.setItem(KEY, JSON.stringify({ ok: ok, tags: ids(), at: Date.now() })); }
    catch (e) {}
  }

  function load() {
    TAGS.forEach(function (t) {
      if (t.done) return;
      t.done = true;
      if (!t.src) { if (t.init) try { t.init(); } catch (e) {} return; }
      var s = document.createElement('script');
      s.async = true; s.src = t.src;
      s.onload = function () { if (t.init) try { t.init(); } catch (e) {} };
      document.head.appendChild(s);
    });
  }

  function show() {
    if (document.getElementById('h19-consent')) return;
    var el = document.createElement('div');
    el.id = 'h19-consent';
    el.className = 'consent';
    el.setAttribute('role', 'dialog');
    el.setAttribute('aria-live', 'polite');
    el.setAttribute('aria-label', 'Cookie choice');
    el.innerHTML =
      '<p class="consent__text">We would like to use ' + names() + ' to count '
    + 'visits and see which pages get read. Nothing is loaded unless you say yes, '
    + 'and the site works either way. <a href="/cookies/">What we would use</a>.</p>'
    + '<div class="consent__act">'
    + '<button type="button" class="consent__btn consent__btn--no">Decline</button>'
    + '<button type="button" class="consent__btn consent__btn--yes">Accept</button>'
    + '</div>';
    el.querySelector('.consent__btn--yes').addEventListener('click', function () { answer(true); });
    el.querySelector('.consent__btn--no').addEventListener('click', function () { answer(false); });
    document.body.appendChild(el);
    requestAnimationFrame(function () { el.classList.add('is-up'); });
  }

  function answer(ok) {
    store(ok);
    root.setAttribute('data-consent', ok ? 'yes' : 'no');
    var el = document.getElementById('h19-consent');
    if (el) { el.classList.remove('is-up'); setTimeout(function () { el.remove(); }, 260); }
    if (ok) load();
  }

  /* the footer's "Cookie choices" link reopens the bar */
  document.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('[data-consent-reopen]');
    if (!a) return;
    e.preventDefault();
    root.removeAttribute('data-consent');
    if (TAGS.length) show();
  });

  var was = saved();
  if (was && was.ok && was.tags === ids()) { root.setAttribute('data-consent', 'yes'); load(); return; }
  if (was && !was.ok && was.tags === ids()) { root.setAttribute('data-consent', 'no'); return; }
  if (!TAGS.length) return;
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', show);
  else show();
})();
