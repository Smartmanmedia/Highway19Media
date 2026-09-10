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
  function hide() { if (!hidden) { hidden = true; hdr.dataset.hide = '1' } }
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
})();
