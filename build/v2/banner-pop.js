/* THE MAIN BANNER, AS A POP-UP (Oct 28).
 *
 * The page opens on section one, the sign gantry. The banner - his headline
 * and the green form - waits off-screen and arrives once the reader has
 * scrolled past two sections: when the foot of section two rises past the
 * middle of the screen. Once per visit; closed with the X, Escape, or a click
 * on the dimmed page round it. section-00.css draws it.
 */
(function () {
  'use strict';

  var root = document.documentElement;
  var pop  = document.getElementById('bn-pop');
  var mark = document.querySelector('.sec2');   /* the second section */
  if (!pop) return;
  var x = pop.querySelector('.bn-x');

  var KEY = 'h19.bannerSeen';
  var seen = function () { try { return sessionStorage.getItem(KEY) === '1'; } catch (e) { return false; } };
  var note = function () { try { sessionStorage.setItem(KEY, '1'); } catch (e) {} };

  /* everything that is not the pop-up goes inert while it is up, so Tab
     cannot wander into the page behind it */
  var behind = function () {
    var out = [];
    [].forEach.call(document.body.children, function (el) {
      if (el.contains(pop)) {
        [].forEach.call(el.children, function (c) { if (c !== pop) out.push(c); });
      } else if (el.tagName !== 'SCRIPT') out.push(el);
    });
    return out;
  };

  var last = null;

  var open = function () {
    if (pop.classList.contains('is-open')) return;
    last = document.activeElement;
    note();
    pop.classList.add('is-open');
    root.classList.add('bn-open');
    behind().forEach(function (el) { el.inert = true; });
    /* the dialog itself, not the Name field: on a phone that would throw the
       keyboard up before the reader has seen what it is */
    pop.focus({ preventScroll: true });
  };

  var close = function () {
    if (!pop.classList.contains('is-open')) return;
    pop.classList.remove('is-open');
    root.classList.remove('bn-open');
    behind().forEach(function (el) { el.inert = false; });
    if (last && last.focus) last.focus({ preventScroll: true });
  };

  if (x) x.addEventListener('click', close);
  /* a click on the backdrop - the section itself, not the card on it */
  pop.addEventListener('click', function (e) { if (e.target === pop) close(); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') close(); });

  if (!mark || seen()) return;

  var check = function () {
    if (mark.getBoundingClientRect().bottom > innerHeight * 0.5) return;
    removeEventListener('scroll', check);
    open();
  };
  addEventListener('scroll', check, { passive: true });
})();
