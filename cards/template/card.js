/* THE CARD'S BEHAVIOUR - the same file for every business's card.
 *
 * Everything here is an improvement on a page that already works: every
 * button is a real link, the contact is a real file, and a phone with this
 * script blocked still saves, calls and emails.
 *
 *   counting      data-track on anything worth knowing about, sent through
 *                 the site's own h19Track - which does nothing until a visitor
 *                 has said yes to analytics (build/v2/consent.js)
 *   where from    ?s=nfc | qr | app | share | desktop, kept for the visit
 *   share         the phone's own share sheet; a copied link where there is none
 *   lead form     POSTed to the form service; a mail draft if it has no key
 *   install       Android's own prompt when it offers one, otherwise the steps
 *                 for this phone - and nothing at all once it is installed
 */
(function () {
  'use strict';
  var doc = document, root = doc.documentElement;
  var card = doc.querySelector('.card');
  if (!card) return;
  var slug = card.getAttribute('data-card');

  /* ---- where this visit came from ---------------------------------------- */
  var standalone = matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
  var source = (function () {
    var s = new URLSearchParams(location.search).get('s');
    try {
      if (s) sessionStorage.setItem('card.src', s);
      else s = sessionStorage.getItem('card.src');
    } catch (e) {}
    return s || (standalone ? 'app' : 'direct');
  })();

  function track(name, extra) {
    var p = { card: slug, source: source };
    if (extra) p.label = extra;
    try { if (window.h19Track) window.h19Track(name, p); } catch (e) {}
  }
  doc.addEventListener('click', function (e) {
    var el = e.target.closest && e.target.closest('[data-track]');
    if (el) track(el.getAttribute('data-track'), el.getAttribute('data-track-label'));
  }, true);

  /* ---- small things ------------------------------------------------------ */
  var toastEl = doc.querySelector('.toast'), toastT;
  function toast(msg) {
    if (!toastEl) return;
    toastEl.textContent = msg; toastEl.classList.add('on');
    clearTimeout(toastT); toastT = setTimeout(function () { toastEl.classList.remove('on'); }, 2200);
  }
  function copy(text, msg) {
    var done = function () { toast(msg || 'Copied'); };
    if (navigator.clipboard && navigator.clipboard.writeText)
      navigator.clipboard.writeText(text).then(done, function () { prompt('Copy this:', text); });
    else prompt('Copy this:', text);
  }
  function open(id) {
    var d = doc.getElementById(id);
    if (!d) return;
    if (d.showModal) d.showModal(); else d.setAttribute('open', '');
  }
  /* a tap on the dimmed backdrop closes a sheet, as it does in every app */
  doc.querySelectorAll('dialog').forEach(function (d) {
    d.addEventListener('click', function (e) { if (e.target === d) d.close(); });
  });

  doc.addEventListener('click', function (e) {
    var t = e.target.closest && e.target.closest('[data-copy],[data-open],[data-share],[data-anyway]');
    if (!t) return;
    if (t.hasAttribute('data-copy')) copy(t.getAttribute('data-copy'),
      /^https?:/.test(t.getAttribute('data-copy')) ? 'Link copied' : 'Code copied');
    if (t.hasAttribute('data-open')) open(t.getAttribute('data-open'));
    if (t.hasAttribute('data-share')) share();
    if (t.hasAttribute('data-anyway')) {
      root.classList.add('anyway');
      try { sessionStorage.setItem('card.anyway', '1'); } catch (e2) {}
    }
  });
  try { if (sessionStorage.getItem('card.anyway')) root.classList.add('anyway'); } catch (e) {}

  /* ---- share ------------------------------------------------------------- */
  function share() {
    var url = doc.querySelector('link[rel=canonical]').href + '?s=share';
    var data = { title: doc.title, text: doc.querySelector('meta[name=description]').content, url: url };
    if (navigator.share) {
      navigator.share(data).then(function () { track('share_done'); }, function () {});
    } else copy(url, 'Link copied — paste it anywhere');
  }

  /* ---- the lead form ------------------------------------------------------ */
  var form = doc.querySelector('form.lead');
  if (form) form.addEventListener('submit', function (e) {
    e.preventDefault();
    var f = form.elements, err = form.querySelector('.lead-err');
    var name = f.name.value.trim(), phone = f.phone.value.trim(), email = f.email.value.trim();
    var msg = f.message.value.trim();
    var say = function (m) { err.textContent = m; err.hidden = !m; };
    if (!name) { say('Please add your name.'); f.name.focus(); return; }
    if (!phone && !email) { say('Add a phone number or an email so we can reach you.'); f.phone.focus(); return; }
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { say('That email doesn’t look right.'); f.email.focus(); return; }
    say('');

    var biz = form.getAttribute('data-business');
    var ok = function () {
      form.hidden = true;
      form.parentNode.querySelector('.lead-ok').hidden = false;
      track('generate_lead');
    };
    /* the honeypot: a person never sees it, a bot always fills it */
    if (f.botcheck.value) { ok(); return; }

    var key = form.getAttribute('data-key'), endpoint = form.getAttribute('data-endpoint');
    var lines = ['Name: ' + name, phone && 'Phone: ' + phone, email && 'Email: ' + email,
                 msg && 'Message: ' + msg, 'Came from: digital card (' + source + ')'].filter(Boolean);
    if (!key || !endpoint) {
      location.href = 'mailto:' + form.getAttribute('data-to') +
        '?subject=' + encodeURIComponent('Card lead - ' + name) +
        '&body=' + encodeURIComponent(lines.join('\n'));
      return;
    }
    var btn = form.querySelector('button[type=submit]');
    btn.disabled = true;
    fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        access_key: key,
        subject: 'Card lead - ' + name + ' (' + biz + ')',
        from_name: biz + ' digital card',
        replyto: email || undefined,
        name: name, email: email, phone: phone, message: msg,
        source: 'digital card - ' + source
      })
    }).then(function (r) { return r.json().catch(function () { return {}; }).then(function (j) {
      if (!r.ok || j.success === false) throw new Error(j.message || 'send failed');
      ok();
    }); }).catch(function () {
      btn.disabled = false;
      say('That didn’t send — check your signal and try again.');
    });
  });

  /* ---- keep it on the phone ---------------------------------------------- */
  var box = doc.querySelector('[data-install]');
  var ua = navigator.userAgent;
  var ios = /iPhone|iPad|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  var android = /Android/.test(ua);
  /* the apps that open links in their own browser - none of them can install */
  var inApp = /FBAN|FBAV|Instagram|Line\/|LinkedInApp|Snapchat|TikTok|musical_ly|Twitter|GSA\//.test(ua);
  var deferred = null;

  function how(which) {
    doc.querySelectorAll('#how [data-how]').forEach(function (el) {
      el.hidden = el.getAttribute('data-how') !== which;
    });
    open('how');
  }
  function showBox() { if (box && !standalone) box.hidden = false; }

  window.addEventListener('beforeinstallprompt', function (e) {
    e.preventDefault(); deferred = e; showBox();
  });
  window.addEventListener('appinstalled', function () {
    track('app_installed'); if (box) box.hidden = true; toast('Added to your Home Screen');
  });
  /* phones get the box straight away; a desktop browser only if it offers */
  if (ios || android) showBox();

  if (box) box.querySelector('[data-install-go]').addEventListener('click', function () {
    if (deferred) {
      deferred.prompt();
      deferred.userChoice.then(function (c) { track('install_' + c.outcome); deferred = null; });
      return;
    }
    how(inApp ? 'inapp' : ios ? 'ios' : 'android');
  });

  /* ---- a moving hero only for people who have not asked for stillness ---- */
  var v = doc.querySelector('video.hero-media');
  if (v) {
    var still = matchMedia('(prefers-reduced-motion: reduce)').matches ||
                (navigator.connection && navigator.connection.saveData);
    if (still) { v.removeAttribute('autoplay'); v.pause(); }
  }

  /* ---- the worker: what makes it open with no signal ---------------------- */
  if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost'))
    window.addEventListener('load', function () {
      navigator.serviceWorker.register('sw.js').catch(function () {});
    });
})();
