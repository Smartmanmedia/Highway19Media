/* HIS HEADER GETS OUT OF THE WAY GOING DOWN AND COMES BACK GOING UP.
 *
 * The rule is the one every reader already knows: scrolling DOWN is reading,
 * and a bar over the top of what you are reading is in the way; scrolling UP
 * is looking for something, and the thing you are looking for is usually the
 * navigation. So it retracts on the way down and returns the moment you go
 * back up, wherever you are on the page.
 *
 * TWO GUARDS, both of which matter more than they look:
 *
 *   A DEAD ZONE. A trackpad and a phone both deliver a scroll as a stream of
 *   small deltas with the sign flipping about in the noise, so a bar that
 *   reacts to every one of them flickers. Nothing happens until the direction
 *   has held for 12 pixels.
 *
 *   AND THE TOP OF THE PAGE IS ALWAYS SHOWN. Below the bar's own height there
 *   is nothing to get out of the way of, and a header that hides at scrollY 40
 *   reads as a bug.
 *
 * It listens passively and does its work in a frame callback: a scroll handler
 * that touches the DOM directly is the classic way to make a page that scrolls
 * badly, and this page is one long scroll.
 */
(function () {
  var hdr = document.querySelector('.hdr');
  if (!hdr) return;
  var last = window.scrollY, acc = 0, hidden = false, queued = false;
  var DEAD = 12;

  function apply() {
    queued = false;
    var y = window.scrollY, d = y - last;
    last = y;
    /* always open at the top, and never hide over the last screen either -
       there is nowhere left to scroll to, so hiding it just loses it */
    if (y <= hdr.offsetHeight) { acc = 0; show(); return; }
    /* the sign flipped: start counting again from here */
    if ((d > 0) !== (acc > 0)) acc = 0;
    acc += d;
    if (acc > DEAD) { hide(); acc = 0; }
    else if (acc < -DEAD) { show(); acc = 0; }
  }
  function hide() { if (!hidden && !open) { hidden = true; hdr.dataset.hide = '1' } }
  function show() { if (hidden) { hidden = false; hdr.removeAttribute('data-hide') } }

  addEventListener('scroll', function () {
    if (!queued) { queued = true; requestAnimationFrame(apply); }
  }, { passive: true });

  /* a mouse that leaves the top of the window is on its way to the tab bar or
     the address bar, and a header that is already there when it arrives is the
     whole point of this */
  addEventListener('mouseout', function (e) {
    if (!e.relatedTarget && e.clientY <= 4) show();
  });

  /* ---- HIS STRIP, AND THE MENU IT PULLS DOWN ------------------------------
   * The phone's nav. Three items will not fit across 390 pixels beside his
   * lockup, and his own drawing does not try: there is a band under the bar
   * with three rules in it, and pressing it drops the menu.
   *
   * The state is `hidden` on the drawer and aria-expanded on the strip - one
   * fact, written where a screen reader and the stylesheet both read it - and
   * the ANIMATION is the stylesheet's business (see .hdr-menu, which tells
   * [hidden] not to take the element away so there is something to animate
   * from). Nothing here measures or sets a height.
   *
   * And the header does not retract while it is open: a drawer that slides up
   * off the screen because you scrolled a little is a drawer that ate the tap.
   */
  var strip = hdr.querySelector('.hdr-bar'),
      menu  = hdr.querySelector('.hdr-menu'),
      open  = false;

  function setOpen(v) {
    open = v;
    strip.setAttribute('aria-expanded', v ? 'true' : 'false');
    strip.setAttribute('aria-label', v ? 'Close the menu' : 'Open the menu');
    menu.classList.toggle('is-open', v);
    if (v) { menu.removeAttribute('hidden'); show(); }
    else {
      /* the attribute goes back on only once the drawer has finished closing,
         so the transition has something to run on */
      setTimeout(function () { if (!open) menu.setAttribute('hidden', '') }, 280);
    }
  }

  if (strip && menu) {
    strip.addEventListener('click', function () { setOpen(!open); });
    /* a link is a destination: close on the way out, so the drawer is not
       still sitting over the section it just scrolled to */
    menu.addEventListener('click', function (e) {
      if (e.target.closest('a')) setOpen(false);
    });
    addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && open) { setOpen(false); strip.focus(); }
    });
    /* anywhere else on the page closes it, which is what every reader expects
       and what stops the drawer from being a mode you can get stuck in */
    addEventListener('pointerdown', function (e) {
      if (open && !hdr.contains(e.target)) setOpen(false);
    }, true);
  }
})();
