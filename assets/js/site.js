/* Highway 19 Media — page behaviour. Deliberately small; the road is the only
   thing on this page that needs real JavaScript. */
(function () {
  'use strict';

  /* -- Mobile nav ---------------------------------------------------------- */
  var toggle = document.getElementById('nav-toggle');
  var nav = document.getElementById('nav');
  if (toggle && nav) {
    toggle.addEventListener('click', function () {
      var open = nav.classList.toggle('is-open');
      toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
    nav.addEventListener('click', function (e) {
      if (e.target.tagName === 'A') {
        nav.classList.remove('is-open');
        toggle.setAttribute('aria-expanded', 'false');
      }
    });
  }

  /* -- Copyright year ------------------------------------------------------ */
  var y = document.getElementById('year');
  if (y) y.textContent = new Date().getFullYear();

  /* -- Booking links ------------------------------------------------------- */
  /* The booking tool is not chosen yet (Open Items #11). Set BOOKING_URL once
     it is and every "Book a free consult" link picks it up. */
  var BOOKING_URL = '';
  var bookings = document.querySelectorAll('[data-booking]');
  Array.prototype.forEach.call(bookings, function (a) {
    if (BOOKING_URL) { a.href = BOOKING_URL; a.target = '_blank'; a.rel = 'noopener'; }
    else a.addEventListener('click', function (e) {
      e.preventDefault();
      var s = document.getElementById('form-status');
      if (s) {
        s.style.color = 'var(--ink-soft)';
        s.textContent = 'Booking link not connected yet — use the form above and we’ll reply within 24 hours.';
      }
      var f = document.getElementById('f-name');
      if (f) f.focus();
    });
  });

  /* -- Hero sign parallax -------------------------------------------------
     Moved out. Every moving piece — the hero gantry, the section-seven sign,
     the clouds, the boat — now runs through one driver in assets/js/scene.js,
     and each one carries its own rate and direction in the markup. Two
     parallax implementations in two files is how they drift apart.
     ---------------------------------------------------------------------- */

  /* -- Contact form -------------------------------------------------------- */
  /* No endpoint is wired yet. Rather than pretending a submission succeeded,
     the form says plainly that it is not connected. Set data-endpoint on the
     <form> to the handler URL and this posts to it for real. */
  var form = document.getElementById('contact-form');
  var status = document.getElementById('form-status');
  if (form && status) {
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var endpoint = form.getAttribute('data-endpoint');

      if (!form.checkValidity()) {
        status.style.color = 'var(--red-600)';
        status.textContent = 'Please add your name and a valid email so we can reply.';
        var bad = form.querySelector(':invalid');
        if (bad) bad.focus();
        return;
      }

      if (!endpoint) {
        status.style.color = 'var(--red-600)';
        status.textContent = 'Form endpoint not connected yet — nothing was sent. ' +
          'Wire data-endpoint on #contact-form before launch.';
        return;
      }

      status.style.color = 'var(--ink-soft)';
      status.textContent = 'Sending…';

      fetch(endpoint, {
        method: 'POST',
        headers: { 'Accept': 'application/json' },
        body: new FormData(form)
      }).then(function (r) {
        if (!r.ok) throw new Error(r.status);
        form.reset();
        status.style.color = 'var(--green-700)';
        status.textContent = 'Got it. We’ll come back to you within 24 hours.';
      }).catch(function () {
        status.style.color = 'var(--red-600)';
        status.textContent = 'That didn’t go through. Email hello@highway19media.com and we’ll pick it up.';
      });
    });
  }
})();
