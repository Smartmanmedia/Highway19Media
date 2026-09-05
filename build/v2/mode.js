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
 * AND THE WHOLE THING IS A STORYLINE NOW. The page opens black, comes up into
 * daylight the moment it is on - good morning - holds the day the whole way
 * down, and goes dark half way along the road so the last sign and the
 * fireworks are at night. The button is no longer what decides any of it; it
 * is the way OUT of it.
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

  /* ---- first light ------------------------------------------------------
     The black itself is CSS (.dawn in night.css) so it works with or without
     this file. What is here is the one thing script has to do: swap the
     palette from night to day UNDER it. That swap is a cut, not a fade - the
     night colours are custom properties inside `background`, and a gradient
     behind a changed variable snaps - so it is made at four tenths of a
     second, while the sheet is still solid, and what the eye
     gets is a room being lit.

     data-dawn is the drive's cue to leave the mode alone until this is done;
     the drive would otherwise write `day` on its first frame and there would
     be nothing to come up from. */
  if (root.dataset.dawn) {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) {
      root.dataset.mode = 'day';
      delete root.dataset.dawn;
    } else {
      setTimeout(function () { if (!root.dataset.modeLock) root.dataset.mode = 'day'; }, 470);
      setTimeout(function () { delete root.dataset.dawn; }, 2000);
    }
  }

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
    /* taking the wheel: the storyline stops here and stays stopped for the
       rest of the page load - the dawn cue goes too, or the drive would sit
       out the next second and a half of scrolling as well */
    root.dataset.modeLock = '1';
    delete root.dataset.dawn;
    root.dataset.mode = next;
    b.setAttribute('aria-label', next === 'night' ? 'Switch to day' : 'Switch to night');
  });
})();
