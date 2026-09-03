/* THE TEMPORARY DAY/NIGHT SWITCH.
 *
 * His sun and his moon, top right, so the two modes can be put side by side.
 * It writes data-mode on the root element - the third way into the palette in
 * night.css, alongside the system setting and an explicit theme - and
 * remembers the choice between visits.
 *
 * The button shows the mode it will take you TO, which is the way every other
 * switch of this kind works: a moon in daylight, a sun at night. Which of the
 * two icons is showing is decided in CSS by the same selectors that decide the
 * palette, so the button can never disagree with the page.
 *
 * TEMPORARY BY AGREEMENT. When he decides what really drives night - a toggle
 * he keeps, the hour, scroll depth - this file comes out and nothing else
 * changes, because everything downstream reads the variables, not this.
 */
(function () {
  'use strict';
  var root = document.documentElement;
  var KEY = 'h19-mode';

  try { var saved = localStorage.getItem(KEY);
        if (saved === 'day' || saved === 'night') root.dataset.mode = saved; } catch (e) {}

  var b = document.querySelector('.mode-switch');
  if (!b) return;

  /* what is on screen right now, however it got that way - the system setting
     counts, so the first click always flips what he can actually see */
  function isNight() {
    if (root.dataset.mode === 'night') return true;
    if (root.dataset.mode === 'day') return false;
    if (root.dataset.theme === 'dark') return true;
    if (root.dataset.theme === 'light') return false;
    return matchMedia('(prefers-color-scheme: dark)').matches;
  }

  b.addEventListener('click', function () {
    var next = isNight() ? 'day' : 'night';
    root.dataset.mode = next;
    try { localStorage.setItem(KEY, next); } catch (e) {}
    b.setAttribute('aria-label', next === 'night' ? 'Switch to day' : 'Switch to night');
  });
})();
