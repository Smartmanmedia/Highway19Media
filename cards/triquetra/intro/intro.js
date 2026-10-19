/* Triquetra Law Group card intro - the mark draws itself, the ring closes, the
   name rises, then the card. The film itself is CSS; this starts it, fits it
   to the screen, and gets out of the way. Built by tools/card/build.js when
   card.json has "intro". */
(function () {
  var box = document.getElementById('intro');
  if (!box) return;

  /* a tablet or a landscape phone: show the whole phone-shaped film centred
     rather than slicing it, or the mark and the name fall off the edges */
  var svg = document.getElementById('intro-svg');
  var acts = document.getElementById('intro-acts');
  function fit() {
    var wide = innerWidth / innerHeight > 0.62;
    svg.setAttribute('preserveAspectRatio', wide ? 'xMidYMid meet' : 'xMidYMid slice');
    box.classList.toggle('wide', wide);
    /* the button hangs under the film's last line wherever the slice put it -
       a fixed 80% landed on that line on an iPhone SE and a 13 in Safari */
    var m = svg.getScreenCTM(), p = svg.createSVGPoint();
    if (!m) return;
    p.x = 0; p.y = 656;
    acts.style.top = Math.min(p.matrixTransform(m).y, innerHeight - 74) + 'px';
  }
  fit(); addEventListener('resize', fit);

  var done = false;
  function finish() {
    if (done) return; done = true;
    box.classList.add('out');
    setTimeout(function () {
      box.remove();
      document.documentElement.classList.remove('intro-on');
    }, 650);
  }
  window.__introFinish = finish;

  /* a tap anywhere takes the reader past it - nobody should have to wait out
     a film to reach a phone number */
  box.addEventListener('click', finish);

  var go = document.getElementById('intro-install');
  /* opened from its own icon already: the button has nothing to install */
  var installed = matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
  if (installed) go.textContent = 'Open the card';
  go.addEventListener('click', function (e) {
    e.stopPropagation();
    var b = installed ? null : document.querySelector('[data-install-go]');
    finish();
    if (b) b.click();
  });

  /* start on the next frame so the first paint is the ink, not a half-drawn
     mark, and so the animations all begin from the same instant */
  requestAnimationFrame(function () { requestAnimationFrame(function () {
    box.classList.add('go');
    setTimeout(function () { document.getElementById('intro-acts').classList.add('on'); }, 2600);
    setTimeout(finish, 5200);     /* long enough to read, short enough to forgive */
  }); });

  setTimeout(finish, 9000);       /* and never longer than this, whatever happens */
})();
