(function () {

/* the headline, letter by letter */
var n = 0;
document.querySelectorAll('[data-split]').forEach(function (el) {
  var t = el.textContent; el.setAttribute('data-text', t); el.textContent = '';
  t.split('').forEach(function (c) {
    if (c === ' ') { el.appendChild(document.createTextNode(' ')); return; }
    var s = document.createElement('span'); s.className = 'ch'; s.style.setProperty('--i', n++); s.textContent = c; el.appendChild(s);
  });
});
var stage = document.getElementById('stage');
function run() { stage.classList.remove('run'); void stage.offsetWidth; stage.classList.add('run'); window.__intro = performance.now(); }
run();

/* the glitter: his map dots, found in his own picture, twinkle; light streaks
   run right to left across the globe */
(function () {
  var img = document.getElementById('earth-img'), cv = document.getElementById('fx'), g = cv.getContext('2d');
  var still = matchMedia('(prefers-reduced-motion: reduce)').matches;
  var pts = [], streaks = [], W = 0, H = 0, dpr = Math.min(2, window.devicePixelRatio || 1);
  function size() { var r = cv.getBoundingClientRect(); W = r.width; H = r.height; cv.width = W * dpr; cv.height = H * dpr; g.setTransform(dpr, 0, 0, dpr, 0, 0); }
  function sample() {
    var c = document.createElement('canvas'), w = img.naturalWidth, h = img.naturalHeight; c.width = w; c.height = h;
    var x = c.getContext('2d'); x.drawImage(img, 0, 0); var d = x.getImageData(0, 0, w, h).data;
    for (var k = 0; k < 9000 && pts.length < 1400; k++) {
      var px = (Math.random() * w) | 0, py = (Math.random() * h) | 0, o = (py * w + px) * 4;
      if (d[o + 1] > 150 && d[o + 2] > 170) pts.push({ x: px / w, y: py / h, ph: Math.random() * 6.28, sp: .6 + Math.random() * 1.8, s: .6 + Math.random() * 1.4 });
    }
    for (var i = 0; i < 22; i++) streaks.push({ y: Math.random(), x: Math.random(), v: .04 + Math.random() * .08, l: .08 + Math.random() * .22, a: .15 + Math.random() * .35 });
  }
  function frame(t) {
    t /= 1000; g.clearRect(0, 0, W, H); g.globalCompositeOperation = 'lighter';
    /* the streaks grow to full length while the globe comes in */
    var gr0 = window.__intro ? Math.min(1, (performance.now() - window.__intro) / 1800) : 1; gr0 = gr0 * gr0 * (3 - 2 * gr0);
    for (var i = 0; i < streaks.length; i++) {
      var s = streaks[i]; s.x -= s.v / 60; if (s.x < -s.l) { s.x = 1; s.y = Math.random(); }
      var sl = s.l * gr0, gr = g.createLinearGradient(s.x * W, 0, (s.x + sl + .0001) * W, 0);
      gr.addColorStop(0, 'rgba(120,200,255,0)'); gr.addColorStop(.25, 'rgba(160,220,255,' + s.a + ')'); gr.addColorStop(1, 'rgba(120,200,255,0)');
      g.fillStyle = gr; g.fillRect(s.x * W, s.y * H, sl * W, 1.2);
    }
    for (var j = 0; j < pts.length; j++) {
      var p = pts[j], a = Math.max(0, Math.sin(t * p.sp + p.ph)); a = a * a * a * a;
      if (a < .05) continue;
      var k = Math.min(1, W / 900), x = p.x * W, y = p.y * H, r = p.s * k * (1 + a * 2.2);
      var rg = g.createRadialGradient(x, y, 0, x, y, r * 2.4);
      rg.addColorStop(0, 'rgba(235,250,255,' + a + ')'); rg.addColorStop(1, 'rgba(90,190,255,0)');
      g.fillStyle = rg; g.beginPath(); g.arc(x, y, r * 2.4, 0, 6.29); g.fill();
      if (a > .7) { g.fillStyle = 'rgba(255,255,255,' + (a - .7) * 2 + ')'; g.fillRect(x - r * 3, y - .4, r * 6, .8); g.fillRect(x - .4, y - r * 3, .8, r * 6); }
    }
    if (!still) requestAnimationFrame(frame);
  }
  function go() { size(); sample(); requestAnimationFrame(frame); }
  if (img.complete) go(); else img.addEventListener('load', go);
  addEventListener('resize', size);
})();


(function () {
  var sec = document.getElementById('wwd'), stage = document.getElementById('w-stage');
  var N = 5, ANG = [0, 90, 180, 270, 360];
  var bgs = [].slice.call(sec.querySelectorAll('.w-bg')), rings = [].slice.call(sec.querySelectorAll('.w-ring')),
      says = [].slice.call(sec.querySelectorAll('.w-say')), dial = document.getElementById('w-dial'), 
      hL = sec.querySelector('.w-h--light'), hD = sec.querySelector('.w-h--dark'),
      screens = ['scr-mon', 'scr-lap', 'scr-ph'].map(function (id) { return [].slice.call(document.getElementById(id).children); });
  var DARK = [0, 1, 1, 0, 0], lastLane = null;
  /* THE TYPING LINE. Types a line, holds it, deletes it, types the next - for
     as long as the page is open. On the desktop stage it changes to the new
     lane's people whenever the lane changes. */
  var SAYS = [["Landing Page",["I&rsquo;m just getting started.","I&rsquo;m a handyman.","I want to advertise my services on Highway 19.","I do car detailing.","I&rsquo;m a gardener.","I just need something simple.","I&rsquo;m a food truck.","I&rsquo;m a mobile notary.","I need a page for my ads.","I&rsquo;m a dog groomer.","I&rsquo;m a personal trainer."]],["Service Website",["I&rsquo;m a contractor.","I run a landscaping business.","I&rsquo;m a dentist.","I own an auto shop.","I&rsquo;m a plumber.","I run an A/C service.","I&rsquo;m a carpenter.","I&rsquo;m a roofer.","I own a cleaning company.","I&rsquo;m an electrician.","I run a law office."]],["Online Store",["I sell products.","I sell golf carts.","I own a furniture store.","I make candles.","I run a boutique.","I sell auto parts.","I bake custom cakes.","I print t-shirts.","I sell bait and tackle."]],["Artist &amp; Portfolio",["I&rsquo;m a musician.","I&rsquo;m a dancer.","I&rsquo;m a model.","I&rsquo;m a photographer.","I&rsquo;m a tattoo artist.","I paint.","I&rsquo;m a wedding DJ.","I&rsquo;m a videographer.","I write books."]],["Custom Route",["My business is unusual.","I&rsquo;m running for office.","I run a gym with memberships.","I need online bookings.","I own a restaurant.","I run a nonprofit.","I need a directory."]]];
  function dec(h) { var t = document.createElement('textarea'); t.innerHTML = h; return t.value; }
  function Typer(el) {
    var tt = el.querySelector('.tt'), lane = el.querySelector('.lane'), to = el.querySelector('.to'), list = [], i = 0, timer = 0;
    function type(str, n) { tt.textContent = str.slice(0, n); if (!n) to.classList.add('hide');   /* the lane shows once the line is said */
      if (n < str.length) timer = setTimeout(function () { type(str, n + 1); }, 22 + Math.random() * 26);
      else { to.classList.remove('hide'); timer = setTimeout(function () { to.classList.add('hide'); erase(str, n); }, 2000); } }
    function erase(str, n) { tt.textContent = str.slice(0, n);
      if (n > 0) timer = setTimeout(function () { erase(str, n - 1); }, 14);
      else { i = (i + 1) % list.length; timer = setTimeout(function () { type(dec(list[i]), 0); }, 350); } }
    /* on phones the line is sized so the lane's longest sentence still fits on one line */
    function size(k) { if (innerWidth >= 820) { el.style.removeProperty('--tq'); return; }
      var c = document.createElement('canvas').getContext('2d'), w = 0, lab = dec(SAYS[k][0]).toUpperCase();
      c.font = '300 75px "Be Vietnam Pro"'; var lw = c.measureText('- ' + lab).width;
      c.font = '200 100px "Be Vietnam Pro"'; SAYS[k][1].forEach(function (p) { w = Math.max(w, c.measureText('“' + dec(p) + '”').width); });
      var avail = (parseFloat(el.style.width) || innerWidth * .85) - 10;
      el.style.setProperty('--tq', Math.min(16, 100 * avail / (w + lw)).toFixed(2) + 'px'); }
    return { set: function (k) {
      size(k); clearTimeout(timer); list = SAYS[k][1]; i = 0; lane.textContent = dec(SAYS[k][0]); to.classList.add('hide');
      if (still) { tt.textContent = dec(list[0]); to.classList.remove('hide'); return; }
      tt.textContent = ''; timer = setTimeout(function () { type(dec(list[0]), 0); }, 300);
    } };
  }
  var deskType = Typer(document.getElementById('w-type'));
  var dotbar = sec.querySelector('.w-dots'), dots = [].slice.call(dotbar.children);
  var still = matchMedia('(prefers-reduced-motion: reduce)').matches;
  /* about half a screen of scrolling per lane */
  var narrowQ = matchMedia('(max-width:820px)');
  function sizeSec() { sec.style.height = (100 + (N - 0.5) * 55) + 'vh'; }
  sizeSec(); narrowQ.addEventListener && narrowQ.addEventListener('change', sizeSec);
  /* each page rolls exactly as far as it is long - never past its own bottom */
  function measure() {
    [].slice.call(sec.querySelectorAll('.w-site')).forEach(function (s) {
      var page = s.querySelector('.ws'), room = page.offsetHeight - (+s.getAttribute('data-h'));
      s.firstChild.style.setProperty('--rollby', -Math.max(0, room) + 'px');
    });
  }
  measure();
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(measure);   /* the type can change a page's length */
  addEventListener('load', measure);

  /* the laptop's screen is a tilted quad: map a flat 1280 x 800 page onto his corners */
  (function () {
    var q = [[1349.2, 391.5], [1580.2, 392.0], [1534.1, 586.6], [1301.4, 553.0]], w = 1280, h = 800;
    function adj(m) { return [m[4]*m[8]-m[5]*m[7], m[2]*m[7]-m[1]*m[8], m[1]*m[5]-m[2]*m[4], m[5]*m[6]-m[3]*m[8], m[0]*m[8]-m[2]*m[6], m[2]*m[3]-m[0]*m[5], m[3]*m[7]-m[4]*m[6], m[1]*m[6]-m[0]*m[7], m[0]*m[4]-m[1]*m[3]]; }
    function mul(a, b) { var c = []; for (var i = 0; i < 3; i++) for (var j = 0; j < 3; j++) { var s = 0; for (var k = 0; k < 3; k++) s += a[3*i+k] * b[3*k+j]; c[3*i+j] = s; } return c; }
    function mv(m, v) { return [m[0]*v[0]+m[1]*v[1]+m[2]*v[2], m[3]*v[0]+m[4]*v[1]+m[5]*v[2], m[6]*v[0]+m[7]*v[1]+m[8]*v[2]]; }
    function basis(p) { var m = [p[0][0], p[1][0], p[2][0], p[0][1], p[1][1], p[2][1], 1, 1, 1]; var v = mv(adj(m), [p[3][0], p[3][1], 1]);
      return mul(m, [v[0], 0, 0, 0, v[1], 0, 0, 0, v[2]]); }
    var s = basis([[0, 0], [w, 0], [0, h], [w, h]]), d = basis([q[0], q[1], q[3], q[2]]), t = mul(d, adj(s));
    for (var i = 0; i < 9; i++) t[i] /= t[8];
    var mx = 'matrix3d(' + [t[0], t[3], 0, t[6], t[1], t[4], 0, t[7], 0, 0, 1, 0, t[2], t[5], 0, t[8]].join(',') + ')';
    document.querySelectorAll('.lap-scr').forEach(function (e) { e.style.transform = mx; });
    var el = document.getElementById('scr-lap');
    el.style.transform = 'matrix3d(' + [t[0], t[3], 0, t[6], t[1], t[4], 0, t[7], 0, 0, 1, 0, t[2], t[5], 0, t[8]].join(',') + ')';
  })();

  var clamp = function (v) { return v < 0 ? 0 : v > 1 ? 1 : v; }, ease = function (t) { return t * t * (3 - 2 * t); };
  /* a phone: card on top, devices under it, scaled to the width */
  var devs = sec.querySelector('.w-devs'), cardg = sec.querySelector('.w-cardg'), heads = [].slice.call(sec.querySelectorAll('.w-h'));
  function fit() {
    var narrow = innerWidth < 820, W = innerWidth, H = innerHeight, wt = document.getElementById('w-type');
    if (narrow) {
      /* PHONES: the card stays on top at a size that reads; the devices change under it */
      /* his Mobile card is a 418 x 781 design: lay it out in those units, then scale it to the screen */
      H = sec.querySelector('.w-pin').clientHeight || H;   /* the pinned frame itself, not the window */
      var z = Math.min(W / 418, H / 781); W = W / z; H = H / z;
      stage.style.width = W + 'px'; stage.style.height = H + 'px'; stage.style.transform = 'translate(-50%,-50%) scale(' + z + ')';
      /* his Mobile card: the words from the top, laptop + phone in the room left, one button above the typing line */
      says.forEach(function (x, i) { var m = (bgs[i].getAttribute('style') || '').match(/linear-gradient(180deg,([^,]+),([^)]+))/); if (m) x.querySelector('.go').style.setProperty('--gob', 'linear-gradient(180deg,' + m[2] + ',' + m[1] + ')'); });
      var card = cardg.querySelector('.w-card'), ct = 44, ch = 0;   /* no dial on phones: the words start near the top */
      card.style.top = ct + 'px'; card.style.height = 'auto';
      /* the words keep their size unless they truly do not fit (a phone that enlarges text): then they shrink just enough */
      var tailH = 22 + 50 + 20 + 52, kFull = W * .93 / 555, maxCh = H - ct - 22 - 275 * kFull - tailH - 8;   /* the devices keep their full size; the words fit the rest */
      /* lane by lane: each lane's words shrink only as much as that lane needs */
      ch = 0;
      says.forEach(function (x) { x.style.setProperty('--cz', 1);
        var hh = function () { var last = x.querySelector('.meta'); return (last.getBoundingClientRect().bottom - x.getBoundingClientRect().top) / z; };
        for (var i = 0, h = hh(); i < 10 && h > maxCh; i++) { x.style.setProperty('--cz', (parseFloat(x.style.getPropertyValue('--cz')) * Math.max(.88, Math.pow(maxCh / h, .55))).toFixed(3)); h = hh(); }
        ch = Math.max(ch, Math.min(h, maxCh)); });
      devs.style.transformOrigin = '0 0';
      /* one stack, top to bottom: words, devices, button, typing line - nothing can overlap */
      var top0 = ct + ch + 22, tail = 22 + 50 + 20 + 52, kd = Math.max(Math.min(W * .93 / 555, (H - top0 - tail - 8) / 275), W * .8 / 555);
      
      kd = Math.max(.32, kd);
      /* the button and typing line sit at the foot; the devices are centred in the room between */
      var goY = H - tail + 22 - 8, devY = top0 + Math.max(0, (goY - 22 - top0 - 275 * kd) / 2);
      sec.style.setProperty('--goY', (goY - ct) + 'px'); card.style.height = (H - ct) + 'px';
      devs.style.transform = 'translate(' + ((W - 555 * kd) / 2 - 1100 * kd) + 'px,' + (devY - 385 * kd) + 'px) scale(' + kd + ')';
      heads.forEach(function (h) { h.style.fontSize = '26px'; h.style.top = '12px'; h.style.left = (W / 2 - h.offsetWidth / 2) + 'px'; });
      wt.style.left = (W * .075) + 'px'; wt.style.top = (goY + 50 + 20) + 'px'; wt.style.fontSize = '16px'; wt.style.whiteSpace = 'nowrap'; wt.style.flexWrap = 'nowrap'; wt.style.justifyContent = 'center'; wt.style.gap = '2px 10px'; wt.style.width = (W * .85) + 'px';
      return;
    }
    sec.classList.remove('w-tight'); stage.style.width = '1922px'; stage.style.height = '819px'; devs.style.transform = cardg.style.transform = '';
    var c0 = cardg.querySelector('.w-card'); c0.style.top = c0.style.height = '';
    heads.forEach(function (h) { h.style.left = h.style.top = h.style.fontSize = ''; });
    wt.style.left = wt.style.top = wt.style.fontSize = wt.style.whiteSpace = wt.style.flexWrap = wt.style.gap = wt.style.width = wt.style.justifyContent = '';
    var s = Math.min(innerWidth / 1922, innerHeight / 819) * .98;
    stage.style.transform = 'translate(-50%,-50%) scale(' + s + ')';
  }
  function frame() {
    var r = sec.getBoundingClientRect(), span = r.height - innerHeight;
    var p = span > 0 ? clamp(-r.top / span) * (N - 0.5) - 0.25 : 0, e = [];
    for (var k = 0; k < N - 1; k++) e.push(ease(clamp((p - k - .38) / .24)));
    /* the colour alone takes its time: it fades over most of the move */
    var eb = []; for (k = 0; k < N - 1; k++) eb.push(ease(clamp((p - k - .1) / .8)));
    var into = function (i) { return i ? e[i - 1] : 1; }, out = function (i) { return i < N - 1 ? e[i] : 0; };
    var ang = ANG[0], dark = 0;
    for (var i = 0; i < N; i++) {
      var a = into(i), b = out(i), wgt = Math.min(a, 1 - b);
      var ab = i ? eb[i - 1] : 1, bb = i < N - 1 ? eb[i] : 0;
      bgs[i].style.opacity = bb >= 1 ? 0 : ab;
      rings[i].style.opacity = b >= 1 ? 0 : a;
      if (i) ang += (ANG[i] - ANG[i - 1]) * a;
      dark += DARK[i] * wgt;
      /* the card's words: the old ones go in the first half of a change, the new in the second */
      var o = i && a < 1 ? (a - .5) * 2 : b > 0 ? 1 - b * 2 : 1;
      says[i].style.opacity = clamp(o);
      says[i].style.visibility = clamp(o) > 0 ? '' : 'hidden';
      /* every screen: the next site rises in over the last */
      screens.forEach(function (set) {
        var s = set[i]; s.style.opacity = b >= 1 ? 0 : a;
        s.style.translate = '0 ' + ((1 - a) * 10) + '%';
      });
    }
    dial.style.transform = 'rotate(' + ang + 'deg)';
    hD.style.opacity = dark; hL.style.opacity = 1 - dark;
    var cur = Math.max(0, Math.min(N - 1, Math.round(p)));
    /* a lane that has just arrived (or the scene, just come into view) starts its pages from the top */
    var seen = r.top < innerHeight && r.bottom > 0, lane = seen ? cur : -1;
    if (lane !== lastLane) {
      lastLane = lane;
      if (lane >= 0) deskType.set(lane);
      screens.forEach(function (set) { set.forEach(function (site, i) {
        var roll = site.firstChild; roll.classList.remove('go');
        if (i === lane) { void roll.offsetWidth; roll.classList.add('go'); }
      }); });
    }
    dots.forEach(function (d, i) { d.classList.toggle('on', i === cur); d.setAttribute('aria-current', i === cur ? 'true' : 'false'); });
    dotbar.classList.toggle('dark', dark > .5);
    document.getElementById('w-type').classList.toggle('dark', dark > .5);
  }
  /* ONE SCROLL, ONE LANE. While the scene is pinned, a wheel turn, a swipe or an
     arrow key moves exactly one lane and eases there; the rest of that gesture
     (a trackpad's long tail, a hard flick) is swallowed until the move lands,
     so nothing can rush through. Past the first or last lane the page scrolls
     on as normal. If the page ever comes to rest between lanes, it settles. */
  function span() { return sec.offsetHeight - innerHeight; }
  function lanePos(k) { return sec.offsetTop + span() * (k + .25) / (N - 0.5); }
  function laneNow() { var p = (scrollY - sec.offsetTop) / span() * (N - 0.5) - .25; return { p: p, k: Math.max(0, Math.min(N - 1, Math.round(p))) }; }
  function pinned() { var t = scrollY - sec.offsetTop; return t >= -2 && t <= span() + 2; }
  var busy = false, quiet = 0, idle = 0;
  /* the move is our own tween, so more wheel input cannot cancel it half way */
  var tween = 0, moving = false;
  function go(k) { glide(lanePos(k), 560); }
  function glide(to, dur) {
    busy = true; moving = true; cancelAnimationFrame(tween);
    var from = scrollY, t0 = performance.now(); if (still) dur = 1;
    (function tick(now) {
      var t = Math.min(1, (now - t0) / dur), e = t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
      window.scrollTo(0, from + (to - from) * e);
      if (t < 1) tween = requestAnimationFrame(tick);
      else { moving = false; clearTimeout(quiet); quiet = setTimeout(function () { busy = false; }, 220); }
    })(t0);
  }
  function step(dir, e) {
    /* from the hero, one scroll eases all the way into the first lane */
    if (dir > 0 && scrollY < sec.offsetTop - 2 && scrollY >= sec.offsetTop - innerHeight * 1.05) {
      if (e) e.preventDefault(); if (!busy) glide(lanePos(0), 900); return true;
    }
    if (!pinned()) return false;
    var n = laneNow(), to = n.k + dir;
    if (n.p < -.2 && dir > 0) to = 0;                      /* arriving from above */
    /* and back from the first lane, one scroll returns to the top of the hero */
    if (to < 0 && sec.offsetTop - innerHeight * 1.05 <= 0) { if (e) e.preventDefault(); if (!busy) glide(0, 900); return true; }
    if (to < 0 || to > N - 1) return false;                 /* off the end: scroll on */
    if (e) e.preventDefault();
    if (!busy) go(to);
    else if (!moving) { clearTimeout(quiet); quiet = setTimeout(function () { busy = false; }, 220); }   /* the tail of the same gesture */
    return true;
  }
  addEventListener('wheel', function (e) { if (Math.abs(e.deltaY) > 1) step(e.deltaY > 0 ? 1 : -1, e); }, { passive: false });
  addEventListener('keydown', function (e) {
    var d = { ArrowDown: 1, PageDown: 1, ' ': 1, ArrowUp: -1, PageUp: -1 }[e.key];
    if (d && !/input|textarea|select/i.test(e.target.tagName)) step(e.shiftKey && e.key === ' ' ? -1 : d, e);
  });
  var ty = null;
  addEventListener('touchstart', function (e) { ty = e.touches[0].clientY; }, { passive: true });
  addEventListener('touchmove', function (e) {
    if (ty === null) return;
    var dy = ty - e.touches[0].clientY;
    if (Math.abs(dy) > 24 && step(dy > 0 ? 1 : -1, e)) ty = null; else if (pinned() && busy) e.preventDefault();
  }, { passive: false });
  addEventListener('touchend', function () { ty = null; }, { passive: true });
  dots.forEach(function (d, i) { d.addEventListener('click', function () { go(i); }); });
  addEventListener('scroll', function () {
    requestAnimationFrame(frame);
    clearTimeout(idle); idle = setTimeout(function () {
      if (busy || !pinned()) return;
      var n = laneNow(); if (n.p > 0 && n.p < N - 1 && Math.abs(n.p - n.k) > .08) go(n.k);
    }, 160);
  }, { passive: true });
  addEventListener('resize', function () { fit(); frame(); });
  fit(); frame();
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { fit(); });
})();


(function () {
  var sec = document.getElementById('jr'), pin = sec.querySelector('.jr-pin'), stage = document.getElementById('jr-stage'), N = 7, cur = -2;
  var narrowQ = matchMedia('(max-width:820px)'), still = matchMedia('(prefers-reduced-motion: reduce)').matches;
  var dotbar = sec.querySelector('.jr-dots'), dots = [].slice.call(dotbar.children), DARK = [0, 0, 1, 1, 1, 0, 0];
  var blocks = [].slice.call(sec.querySelectorAll('.jt'));
  function sizeSec() { sec.style.height = (100 + (N - 0.5) * 100) + 'vh'; }
  sizeSec(); narrowQ.addEventListener && narrowQ.addEventListener('change', sizeSec);
  var mts = [].slice.call(sec.querySelectorAll('.jmt')), FOCUS = [640, 1230, 620, 630, 690, 770, 1250];
  /* art over words, the pair centred on the screen's height: returns the art's offset, places the words */
  function centreY(k, sc, a0, a1) { var gap = 18, th = mts[k].offsetHeight, ah = (a1 - a0) * sc, top = Math.max(8, (innerHeight - ah - gap - th) / 2);
    mts[k].style.setProperty('top', (top + ah + gap).toFixed(1) + 'px', 'important'); return top - a0 * sc; }
  function textBottom(k) { var m = mts[k]; return m.offsetTop + m.offsetHeight; }
  function fit(keepStars) {
    var W = innerWidth, H = innerHeight, s, vl, vr, vt, vb;
    if (narrowQ.matches) {
      /* phones: the words take the top band; the stage fills the rest at full height, centred on this step */
      var tp = 0; mts.forEach(function (m, i) { if (i > 3) tp = Math.max(tp, m.offsetHeight); }); tp += 26;
      sec.style.setProperty('--tp', tp + 'px'); sec.style.setProperty('--H', H + 'px'); s = (H - tp) / 819; var fx = FOCUS[Math.max(0, cur)], tx = W / 2 - fx * s;
      var ty = tp;
      /* his Mobile 1 + 2: the bulb (glass 26% of the width), then the badge (37%), small and centred at the top */
      if (cur <= 0) { s = Math.min(W * 190 / 418, H * .3) / 281; tx = W / 2 - 672 * s; ty = centreY(0, s, 148, 620); }
      else if (cur === 1) { s = Math.min(W * 250 / 418, H * .36) / 476; tx = W / 2 - 1231 * s; ty = centreY(1, s, 184, 650); }
      /* his Mobile 3: the rocket's nose rising from the bottom right, 91% of the width */
      else if (cur === 2) { s = W * 381 / 418 / 1021; tx = W * 116 / 418 - 108.1 * s; ty = H * 357 / 781 + 351 * s; }
      /* his Mobile 4: the launch pad along the bottom, the rocket 22% of the width */
      else if (cur === 3) { var tb = textBottom(3); s = Math.min(W * .3 / 251, (H - tb - 16) / 799); tx = W * .45 - 631 * s; ty = H - 826 * s; }
      /* his Mobile 5: the rocket (18% of the width) rising out of the clouds, the crane to the right */
      else if (cur === 4) { var tb4 = textBottom(4); s = Math.min(W * .26 / 213.4, (H - tb4 - 16) / 789); tx = W / 2 - 680.8 * s; ty = H - 819 * s; }
      /* his Mobile 6: a small rocket, centred, its long jet down into the clouds */
      else if (cur === 5) { var tb5 = textBottom(5); s = Math.min(W * .2 / 88, (H - tb5 - 16) / 670); tx = W / 2 - 770 * s; ty = H - 900 * s; }
      /* his Mobile 7: rocket and moon on top, ending with the rocket 8% down */
      else if (cur >= 6) { /* the same rocket as lift-off, centred and closer: the camera rises with it */
        s = W * .17 / 88; tx = W / 2 - 770 * s; ty = H * .09 - 230 * s;
        var mn = sec.querySelector('.j-moon'), mk = W * .34 / (220 * s); mn.style.scale = mk.toFixed(3); mn.style.transformOrigin = '0 0';
        mn.style.left = ((W * .64 - tx) / s).toFixed(0) + 'px'; mn.style.top = ((H * .2 - ty) / s - 220 * mk).toFixed(0) + 'px'; }
      stage.style.transform = 'translate(' + tx.toFixed(1) + 'px,' + ty.toFixed(1) + 'px) scale(' + s + ')';
      /* the math board fills the whole screen behind the badge */
      var ch2 = sec.querySelector('.j-chalk'), bx = tx + 1231 * s, by = ty + 421 * s;
      var kb = cur === 1 ? Math.max(1.3, by / (421 * s) * 1.02) : 1;   /* his Mobile 1: the board across the top, at its own size */
      ch2.style.transformOrigin = '650px 421px'; ch2.style.transform = 'scale(' + Math.max(1, kb).toFixed(3) + ')';
      var c3 = sec.querySelector('.j-cl3b');
      if (cur === 2) { var L = (-296 / 418 * W - tx) / s, T3 = (-76 / 781 * H - ty) / s, k3 = (993 / 418 * W / s) / 1049;
        c3.style.transformOrigin = '0 0'; c3.style.transform = 'translate(' + (L - 832).toFixed(1) + 'px,' + (T3 - 79).toFixed(1) + 'px) scale(' + k3.toFixed(3) + ')'; }
      else if (c3.style.transform) { c3.style.transform = ''; c3.style.transformOrigin = ''; }
      vl = -tx / s; vr = (W - tx) / s; vt = -ty / s; vb = (H - ty) / s;
    } else {
      var mnd = sec.querySelector('.j-moon'); mnd.style.left = mnd.style.top = mnd.style.scale = ''; sec.querySelector('.j-chalk').style.transform = '';
      var c3d = sec.querySelector('.j-cl3b'); c3d.style.transform = c3d.style.transformOrigin = '';
      /* fill the screen; on narrower screens, crop the sides only so far */
      s = Math.max(W / 1922, Math.min(H / 819, W / 1400));
      stage.style.transform = 'translate(-50%,-50%) scale(' + s + ')';
      vl = 961 - W / 2 / s; vr = 961 + W / 2 / s; vt = 409.5 - H / 2 / s; vb = 409.5 + H / 2 / s;
    }
    stage.style.setProperty('--vl', vl.toFixed(1)); stage.style.setProperty('--vr', vr.toFixed(1));
    VIEW = [vl, vt, vr - vl, vb - vt];
    stage.style.setProperty('--vt', vt.toFixed(1)); stage.style.setProperty('--ip', (1 / s).toFixed(4));
    zoomEl.style.left = vl + 'px'; zoomEl.style.top = vt + 'px'; zoomEl.style.width = (vr - vl) + 'px'; zoomEl.style.height = (vb - vt) + 'px';
    /* and no words cut off at either edge */
    if (!narrowQ.matches) blocks.forEach(function (b) { b.style.translate = ''; var x = b.offsetLeft, w = Math.max(b.offsetWidth, b.scrollWidth), dx = 0;
      /* when the sides are cropped, the right-hand words come in toward the middle, as far as the art allows */
      var MINX = { 3: 1040, 4: 1040, 5: 880 }, k = +b.className.replace(/D+/g, ''); if (MINX[k] && vl > 0) dx = Math.max(MINX[k] - x, -vl * .8);
      if (x + dx + w > vr - 40 / s) dx = vr - 40 / s - x - w; if (x + dx < vl + 70 / s) dx = vl + 70 / s - x; b.style.translate = dx ? dx.toFixed(1) + 'px 0' : ''; });
    if (!keepStars) sizeStars();
  }

  /* the chalk: a few scribbles at a time light up, here and there */
  var chalk = sec.querySelector('.j-chalk'), eqs = [], spotT = 0;
  (function () { var best = null; chalk.querySelectorAll('.jcv g').forEach(function (g) { if (!best || g.children.length > best.children.length) best = g; });
    eqs = [].slice.call(best.children); eqs.forEach(function (g) { g.classList.add('eq'); }); })();
  function spark() {
    var g = eqs[Math.floor(Math.random() * eqs.length)]; if (g.classList.contains('lit')) return;
    g.classList.add('lit'); setTimeout(function () { g.classList.remove('lit'); }, 2400 + Math.random() * 2600);
  }
  function chalkOn(on) { clearTimeout(spotT); clearInterval(spotT); if (!on) { eqs.forEach(function (g) { g.classList.remove('lit'); }); return; }
    if (still) return; spotT = setTimeout(function () { spark(); spark(); spotT = setInterval(spark, 320); }, 2600); }

  /* the stars: faint at lift-off, all of them in space */
  var cv = sec.querySelector('.jr-stars'), cx = cv.getContext('2d'), stars = [], raf = 0, dpr = 1, last = 0, drift = 0;
  function sizeStars() { dpr = Math.min(2, devicePixelRatio || 1); cv.width = innerWidth * dpr; cv.height = innerHeight * dpr;
    stars = []; for (var i = 0; i < 230; i++) stars.push({ x: Math.random(), y: Math.random(), r: Math.random() * 1.3 + .25, p: Math.random() * 6.3, s: .6 + Math.random() * 2.2, g: Math.random() < .06 }); }
  function draw(t) {
    var dt = last ? Math.min(.05, (t - last) / 1000) : 0; last = t;
    cx.clearRect(0, 0, cv.width, cv.height);
    for (var j = 0; j < stars.length; j++) { var q = stars[j]; q.y += drift * dt * (.5 + q.r * .6); if (q.y > 1.02) { q.y -= 1.04; q.x = Math.random(); } }
    for (var i = 0; i < stars.length; i++) { var st = stars[i], a = .35 + .65 * (.5 + .5 * Math.sin(t / 1000 * st.s + st.p)), x = st.x * cv.width, y = st.y * cv.height, r = st.r * dpr;
      cx.globalAlpha = a; cx.fillStyle = '#fff'; cx.beginPath(); cx.arc(x, y, r, 0, 6.3); cx.fill();
      if (st.g) { cx.globalAlpha = a * .7; cx.fillRect(x - r * 6, y - .4 * dpr, r * 12, .8 * dpr); cx.fillRect(x - .4 * dpr, y - r * 6, .8 * dpr, r * 12); } }
    raf = requestAnimationFrame(draw);
  }
  function starsOn(on) { cancelAnimationFrame(raf); if (on) { if (still) { draw(0); cancelAnimationFrame(raf); } else raf = requestAnimationFrame(draw); } }

  /* the pull-back: camera from inside the glass (world point P on screen at F1) to his section 3 framing */
  var zoomEl = sec.querySelector('.j-zoom'), zglass = zoomEl.querySelector('.zglass'), rkTint = sec.querySelector('.rk-tint'), zr = 0, VIEW = [0, 0, 1922, 819];
  var P = [630, 238], F1 = [961, 410], F2 = [-1949.8 + 4.067 * 630, -460.8 + 4.067 * 238], S1 = 40, S2 = 4.067;
  function frameCam(sc, fx, fy) { var tx = fx - sc * P[0], ty = fy - sc * P[1];
    zoomEl.setAttribute('viewBox', [(VIEW[0] - tx) / sc, (VIEW[1] - ty) / sc, VIEW[2] / sc, VIEW[3] / sc].join(' ')); }
  function zoom(on) {
    cancelAnimationFrame(zr); pin.classList.remove('zooming'); zoomEl.style.opacity = 0; rkTint.style.transition = 'opacity .3s'; rkTint.style.opacity = 0;
    if (!on || still) return;
    pin.classList.add('zooming'); var t0 = performance.now(); F1 = [VIEW[0] + VIEW[2] / 2, VIEW[1] + VIEW[3] / 2];
    (function tick(now) {
      var t = (now - t0) / 1000, a = Math.min(1, Math.max(0, (t - .2) / .45)), u = Math.min(1, Math.max(0, (t - .35) / 2.2));
      var e = u < .5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2;
      var sc = S1 * Math.pow(S2 / S1, e);
      frameCam(sc, F1[0] + (F2[0] - F1[0]) * e, F1[1] + (F2[1] - F1[1]) * e);
      /* we are inside the window: the dark of the last scene IS the glass, and it stays dark as we pull out */
      zoomEl.style.opacity = 1; zglass.style.opacity = 1;
      if (u < 1) zr = requestAnimationFrame(tick); else { rkTint.style.transition = 'none'; rkTint.style.opacity = 1; void rkTint.offsetWidth; rkTint.style.transition = 'opacity 2.6s ease .6s'; rkTint.style.opacity = 0;
        pin.classList.add('snap'); pin.classList.remove('zooming'); requestAnimationFrame(function () { requestAnimationFrame(function () { zoomEl.style.opacity = 0; pin.classList.remove('snap'); }); }); }
    })(t0);
  }
  /* the bulb as a switch */
  var bulb = sec.querySelector('.j-bulb');
  function flip(e) { if (e.type === 'keydown' && e.key !== 'Enter') return; e.preventDefault(); e.stopPropagation();
    var off = !pin.classList.contains('dark-bulb'); pin.classList.toggle('dark-bulb', off); pin.classList.remove('relit');
    if (!off) { void pin.offsetWidth; pin.classList.add('relit'); } bulb.setAttribute('aria-pressed', off ? 'false' : 'true'); }
  bulb.addEventListener('click', flip); bulb.addEventListener('keydown', flip);
  function show(k) {
    if (k === cur) return;
    if (k > 1 || k < 0) { pin.classList.remove('dark-bulb', 'relit'); bulb.setAttribute('aria-pressed', 'true'); }
    /* skipping steps (a fast fling): the scene snaps to the step instead of replaying the moves between */
    if (Math.abs(k - cur) > 1 && cur !== -2) { pin.classList.add('jump'); requestAnimationFrame(function () { requestAnimationFrame(function () { pin.classList.remove('jump'); }); }); }
    var zooming = k === 2 && cur < 2 && cur >= -1;
    if (narrowQ.matches) { var prev = cur; cur = k; stage.style.transition = zooming ? 'none' : ''; fit(true); cur = prev; void stage.offsetWidth; stage.style.transition = ''; }
    zoom(zooming);
    pin.classList.toggle('rev', k < cur); cur = k; pin.setAttribute('data-at', k);
    chalkOn(k === 1); drift = k === 5 ? .006 : .011; last = 0; starsOn(k >= 5);
    blocks.forEach(function (b, i) { b.querySelectorAll('a').forEach(function (a) { if (i === k) a.removeAttribute('tabindex'); else a.setAttribute('tabindex', '-1'); }); });
    dots.forEach(function (d, i) { d.classList.toggle('on', i === k); d.setAttribute('aria-current', i === k ? 'true' : 'false'); });
    dotbar.classList.toggle('dark', k >= 0 && DARK[k] === 1);
  }
  function span() { return sec.offsetHeight - innerHeight; }
  function lanePos(k) { return sec.offsetTop + span() * (k + .25) / (N - 0.5); }
  function laneNow() { var p = (scrollY - sec.offsetTop) / span() * (N - 0.5) - .25; return { p: p, k: Math.max(0, Math.min(N - 1, Math.round(p))) }; }
  function pinned() { var t = scrollY - sec.offsetTop; return t >= -2 && t <= span() + 2; }
  function frame() {
    var t = scrollY - sec.offsetTop;
    show(t < -2 ? -1 : laneNow().k);
  }
  /* ONE SCROLL, ONE STEP - the same rules as What We Do, and handing back to it */
  var busy = false, quiet = 0, idle = 0, tween = 0, moving = false;
  function go(k) { glide(lanePos(k), 620); }
  function glide(to, dur) {
    busy = true; moving = true; cancelAnimationFrame(tween);
    var from = scrollY, t0 = performance.now(); if (still) dur = 1;
    (function tick(now) {
      var t = Math.min(1, (now - t0) / dur), e = t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
      window.scrollTo(0, from + (to - from) * e);
      if (t < 1) tween = requestAnimationFrame(tick);
      else { moving = false; clearTimeout(quiet); quiet = setTimeout(function () { busy = false; }, 220); }
    })(t0);
  }
  function step(dir, e) {
    if (e && e.defaultPrevented) return false;
    /* from the last lane of What We Do, one scroll carries straight into the first step */
    if (dir > 0 && scrollY < sec.offsetTop - 2 && scrollY >= sec.offsetTop - innerHeight * 1.4) {
      if (e) e.preventDefault(); if (!busy) glide(lanePos(0), 900); return true;
    }
    if (!pinned()) return false;
    var n = laneNow(), to = n.k + dir;
    if (n.p < -.2 && dir > 0) to = 0;
    if (to < 0) {   /* and back up, to What We Do's last lane */
      var w = document.getElementById('wwd'); if (!w) return false;
      if (e) e.preventDefault(); if (!busy) glide(w.offsetTop + (w.offsetHeight - innerHeight) * (4.25 / 4.5), 900); return true;
    }
    if (to > N - 1) return false;
    if (e) e.preventDefault();
    if (!busy) go(to);
    else if (!moving) { clearTimeout(quiet); quiet = setTimeout(function () { busy = false; }, 220); }
    return true;
  }
  addEventListener('wheel', function (e) { if (Math.abs(e.deltaY) > 1) step(e.deltaY > 0 ? 1 : -1, e); }, { passive: false });
  addEventListener('keydown', function (e) {
    var d = { ArrowDown: 1, PageDown: 1, ' ': 1, ArrowUp: -1, PageUp: -1 }[e.key];
    if (d && !/input|textarea|select/i.test(e.target.tagName)) step(e.shiftKey && e.key === ' ' ? -1 : d, e);
  });
  var ty = null;
  addEventListener('touchstart', function (e) { ty = e.touches[0].clientY; }, { passive: true });
  addEventListener('touchmove', function (e) {
    if (ty === null) return;
    var dy = ty - e.touches[0].clientY;
    if (Math.abs(dy) > 24 && step(dy > 0 ? 1 : -1, e)) ty = null; else if (pinned() && busy) e.preventDefault();
  }, { passive: false });
  addEventListener('touchend', function () { ty = null; }, { passive: true });
  dots.forEach(function (d, i) { d.addEventListener('click', function () { go(i); }); });
  addEventListener('scroll', function () {
    requestAnimationFrame(frame);
    clearTimeout(idle); idle = setTimeout(function () {
      if (busy || !pinned()) return;
      var n = laneNow(); if (n.p > 0 && n.p < N - 1 && Math.abs(n.p - n.k) > .08) go(n.k);
    }, 160);
  }, { passive: true });
  addEventListener('resize', function () { fit(); frame(); });
  fit(); frame();

  /* PHONE TYPE. 1) If the phone enlarges all text, scale it back (--tz). 2) Headings meant
     to sit on one line, and button labels, shrink to fit their line; the hero's two big
     lines grow or shrink to fill the column exactly. */
  function textZoom() {
    var t = document.createElement('span'); t.style.cssText = 'position:absolute;visibility:hidden;font-size:100px;line-height:1'; t.textContent = 'M';
    document.body.appendChild(t); var f = parseFloat(getComputedStyle(t).fontSize) / 100; t.remove();
    document.documentElement.style.setProperty('--tz', f > 1.02 ? (1 / f).toFixed(3) : '1');
  }
  function fitLine(el, grow, self) {
    el.style.fontSize = ''; var box = function () { return self ? el.clientWidth : el.parentElement.clientWidth; }, cw = box(), fs = parseFloat(getComputedStyle(el).fontSize), w = el.scrollWidth;
    if (!cw || !w) return;
    if (grow || w > cw) { fs = fs * cw / w; el.style.fontSize = fs.toFixed(1) + 'px';
      for (var i = 0; i < 20 && el.scrollWidth > box(); i++) el.style.fontSize = (fs -= .5).toFixed(1) + 'px'; }
  }
  function fitType() {
    if (!narrowQ.matches) { document.querySelectorAll('[data-fitted]').forEach(function (e) { e.style.fontSize = ''; e.removeAttribute('data-fitted'); }); return; }
    textZoom();
    document.querySelectorAll('.acts .btn,.w-say .go,.jmt .jt-go a').forEach(function (e) {
      e.setAttribute('data-fitted', ''); e.style.whiteSpace = 'nowrap'; fitLine(e, false, e.matches('a,.btn,.go,.inc')); });
    fit(); if (!fitType.busy) { fitType.busy = true; dispatchEvent(new Event('resize')); fitType.busy = false; }
  }
  fitType(); addEventListener('resize', function () { if (!fitType.busy) fitType(); });
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(fitType);
  /* the phone hero's glitter: points twinkling across the globe's lit face */
  (function () {
    var cv = document.querySelector('.m-fx'); if (!cv || still) return;
    var cx = cv.getContext('2d'), pts = [], raf = 0;
    function size() { var d = Math.min(2, devicePixelRatio || 1); cv.width = cv.offsetWidth * d; cv.height = cv.offsetHeight * d; pts = [];
      for (var i = 0; i < 90; i++) { var x = Math.random(), lim = .78 - 1.2 * Math.pow(x - .5, 2); pts.push({ x: x, y: Math.random() * lim, r: .6 + Math.random() * 1.6, p: Math.random() * 6.3, s: 1 + Math.random() * 3 }); } }
    function draw(t) {
      if (!narrowQ.matches) { raf = requestAnimationFrame(draw); return; }
      cx.clearRect(0, 0, cv.width, cv.height); var d = cv.width / cv.offsetWidth;
      pts.forEach(function (q) { var a = Math.pow(.5 + .5 * Math.sin(t / 1000 * q.s + q.p), 6); if (a < .02) return;
        var x = q.x * cv.width, y = q.y * cv.height, r = q.r * d; cx.globalAlpha = a; cx.fillStyle = '#bfe6ff';
        cx.beginPath(); cx.arc(x, y, r, 0, 6.3); cx.fill(); cx.globalAlpha = a * .6; cx.fillRect(x - r * 5, y - .4 * d, r * 10, .8 * d); cx.fillRect(x - .4 * d, y - r * 5, .8 * d, r * 10); });
      raf = requestAnimationFrame(draw); }
    size(); addEventListener('resize', size); raf = requestAnimationFrame(draw);
  })();
  /* phones: each section plays as it comes into view */
  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (es) { es.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }); }, { threshold: .3 });
    document.querySelectorAll('.jm-p').forEach(function (p) { io.observe(p); });
  } else document.querySelectorAll('.jm-p').forEach(function (p) { p.classList.add('in'); });
})();


document.querySelectorAll('.wq details').forEach(function (d) { d.addEventListener('toggle', function () {
  if (d.open && window.h19Track) window.h19Track('faq_open', { question: d.querySelector('summary').textContent.trim().slice(0, 90) }); }); });


})();
