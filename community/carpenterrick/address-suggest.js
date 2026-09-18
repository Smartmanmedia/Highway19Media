/* =============================================================
   Carpenter Rick — address suggestions

   Rick builds in Spring Hill, Brooksville and Hudson, so the address
   field completes against the real streets in those three places.
   streets.json holds every named street inside each town's Census
   boundary — 2,676 of them — and is fetched the first time someone
   touches the field, so it costs nothing to anyone who only reads
   the page.

   No API, no key, no third-party host: the CSP's connect-src 'self'
   already covers the one request this makes.

   The field keeps autocomplete="street-address", so a phone can still
   fill in the visitor's own saved address in one tap. This only adds
   to that — it never blocks typing, and anything can still be entered.
   ============================================================= */
(() => {
  'use strict';

  var input = document.getElementById('lead-address');
  var list  = document.getElementById('lead-address-list');
  if (!input || !list) return;

  var TOWNS = ['Spring Hill', 'Brooksville', 'Hudson'];
  var MAX   = 6;        /* suggestions shown at once */
  var MIN   = 2;        /* characters of street name before we offer any */

  var streets = null;   /* [{ name, town, key }] once loaded */
  var pending = null;
  var shown   = [];
  var active  = -1;
  var quiet   = false;  /* set while we write the value ourselves */

  /* ---------- data ------------------------------------------------ */
  var load = function () {
    if (pending) return pending;
    pending = fetch('streets.json')
      .then(function (r) { return r.ok ? r.json() : Promise.reject(new Error(String(r.status))); })
      .then(function (data) {
        streets = [];
        TOWNS.forEach(function (town) {
          (data[town] || '').split('|').forEach(function (name) {
            if (name) streets.push({ name: name, town: town, key: name.toLowerCase() });
          });
        });
      })
      .catch(function () { streets = []; });   /* stay silent — the field still works */
    return pending;
  };

  /* ---------- reading what has been typed --------------------------
     "1234 spring hill dr, spring" splits into the house number, the
     street fragment, and whatever town has been started.
     ------------------------------------------------------------------ */
  var parse = function (value) {
    var parts = value.split(',');
    var head  = parts[0].trim();
    var num   = head.match(/^(\d+[a-z]?)\s+(.+)$/i);
    return {
      number: num ? num[1] : '',
      street: (num ? num[2] : head).trim().toLowerCase(),
      town:   parts.length > 1 ? parts[1].trim().toLowerCase() : ''
    };
  };

  /* A street matches when the fragment starts one of its words, so
     "hill" finds Spring Hill Drive and "spring h" finds it too. */
  var score = function (key, q) {
    if (key.indexOf(q) === 0) return 0;
    return key.indexOf(' ' + q) > -1 ? 1 : -1;
  };

  var match = function (typed) {
    var q = typed.street;
    if (q.length < MIN) return [];

    var towns = typed.town
      ? TOWNS.filter(function (t) { return t.toLowerCase().indexOf(typed.town) === 0; })
      : TOWNS;
    if (!towns.length) return [];

    var hits = [];
    for (var i = 0; i < streets.length; i++) {
      var s = streets[i];
      if (towns.indexOf(s.town) < 0) continue;
      var rank = score(s.key, q);
      if (rank < 0) continue;
      hits.push({ rank: rank, entry: s });
    }

    /* whole-word matches first, then the shortest — "Hill Road" before
       "Hillsborough Meadow Drive" when someone has typed "hill" */
    hits.sort(function (a, b) {
      return a.rank - b.rank ||
             a.entry.key.length - b.entry.key.length ||
             a.entry.key.localeCompare(b.entry.key);
    });

    return hits.slice(0, MAX).map(function (h) {
      return { number: typed.number, name: h.entry.name, town: h.entry.town };
    });
  };

  /* ---------- the list -------------------------------------------- */
  var full = function (s) {
    return (s.number ? s.number + ' ' : '') + s.name + ', ' + s.town + ', FL';
  };

  var close = function () {
    if (list.hidden) return;
    list.hidden = true;
    list.textContent = '';
    input.setAttribute('aria-expanded', 'false');
    input.removeAttribute('aria-activedescendant');
    shown = [];
    active = -1;
  };

  var highlight = function (i) {
    var options = list.children;
    for (var n = 0; n < options.length; n++) {
      options[n].setAttribute('aria-selected', String(n === i));
    }
    active = i;
    if (i < 0 || !options[i]) { input.removeAttribute('aria-activedescendant'); return; }
    input.setAttribute('aria-activedescendant', options[i].id);
    options[i].scrollIntoView({ block: 'nearest' });
  };

  var open = function (results) {
    if (!results.length) return close();
    list.textContent = '';
    results.forEach(function (s, i) {
      var li = document.createElement('li');
      li.id = 'lead-address-opt-' + i;
      li.setAttribute('role', 'option');
      li.setAttribute('aria-selected', 'false');

      var street = document.createElement('b');
      street.textContent = (s.number ? s.number + ' ' : '') + s.name;
      var town = document.createElement('span');
      town.textContent = s.town;

      li.appendChild(street);
      li.appendChild(town);
      list.appendChild(li);
    });
    shown = results;
    active = -1;
    list.hidden = false;
    input.setAttribute('aria-expanded', 'true');
    input.removeAttribute('aria-activedescendant');
  };

  var accept = function (i) {
    var pick = shown[i];
    if (!pick) return;
    input.value = full(pick);
    close();
    /* let the form's own validation clear any red state it had put on
       the field — quiet stops that event reopening the list */
    quiet = true;
    input.dispatchEvent(new Event('input', { bubbles: true }));
    quiet = false;
  };

  var refresh = function () {
    if (quiet) return;
    /* already finished, by us or by the browser's own autofill */
    if (/,\s*fl\b/i.test(input.value)) return close();

    var typed = parse(input.value);
    if (typed.street.length < MIN) return close();

    if (!streets) {
      load().then(function () {
        if (document.activeElement === input) refresh();
      });
      return;
    }
    open(match(typed));
  };

  /* ---------- wiring ----------------------------------------------- */
  input.addEventListener('focus', load, { once: true });
  input.addEventListener('input', refresh);

  input.addEventListener('keydown', function (event) {
    var key = event.key;

    if (key === 'Escape') { close(); return; }

    if (key === 'ArrowDown' || key === 'ArrowUp') {
      if (list.hidden) { refresh(); return; }
      event.preventDefault();
      var last = shown.length - 1;
      if (key === 'ArrowDown') highlight(active >= last ? 0 : active + 1);
      else                     highlight(active <= 0 ? last : active - 1);
      return;
    }

    if (key === 'Enter' && !list.hidden && active > -1) {
      event.preventDefault();       /* take the street; do not submit yet */
      accept(active);
      return;
    }

    if (key === 'Tab') close();
  });

  /* pointerdown rather than click: it fires before the field loses
     focus, so the choice is not cancelled by the blur underneath */
  list.addEventListener('pointerdown', function (event) {
    var li = event.target.closest('li');
    if (!li) return;
    event.preventDefault();
    accept([].indexOf.call(list.children, li));
    input.focus();
  });

  list.addEventListener('pointerover', function (event) {
    var li = event.target.closest('li');
    if (li) highlight([].indexOf.call(list.children, li));
  });

  input.addEventListener('blur', function () { setTimeout(close, 120); });
})();
