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
 * SCROLL DEPTH DRIVES IT NOW. He has decided: the light goes half way down
 * the road, where the last board comes over the horizon and the fireworks
 * start, and the page ends at night. That lives in the drive, which is the
 * only thing that knows how far through the road you are.
 *
 * So this is an OVERRIDE, not the driver. A click writes data-modeLock and
 * the drive stops touching the mode for the rest of the page load - otherwise
 * the next scroll frame would undo the click before he saw it. Nothing is
 * remembered between visits any more: a saved choice would fight the road on
 * every reload, and the road is the story.
 */
(function () {
  'use strict';
  var root = document.documentElement;

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
    root.dataset.modeLock = '1';
    root.dataset.mode = next;
    b.setAttribute('aria-label', next === 'night' ? 'Switch to day' : 'Switch to night');
  });
})();
