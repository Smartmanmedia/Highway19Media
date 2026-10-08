/* Highway 19 card intro - a road into the blue, the shield, then the card. Built by tools/card/build.js when card.json has "intro". */
(function () {
  if (!document.getElementById("intro")) return;

  var NS = 'http://www.w3.org/2000/svg', W = 390, H = 844;
  var sky = document.getElementById('sky'), tun = document.getElementById('tunnel'), road = document.getElementById('road');
  var logo = document.getElementById('logo'), glint = document.getElementById('glint'), acts = document.getElementById('intro-acts');
  var still = false;
  function el(tag, a) { var e = document.createElementNS(NS, tag); for (var k in a) e.setAttribute(k, a[k]); return e; }
  var clamp = function (v) { return v < 0 ? 0 : v > 1 ? 1 : v; };
  var ease = function (t) { return t * t * (3 - 2 * t); };
  var easeIn = function (t) { return t * t * t; };
  var easeOut = function (t) { return 1 - Math.pow(1 - t, 3); };
  var back = function (t) { var c = 1.6; return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); };
  var seg = function (t, a, b) { return clamp((t - a) / (b - a)); };

  /* THE ROAD, seen from the driver's seat. World: x across, z ahead. The road
     bends by x = curve * z^2; a point projects to the screen through the camera. */
  var F = 300, CAMH = .8, HALF = 1.6, ZN = 0.35, ZF = 70;
  function proj(x, z, hor, cx) { return [cx + x * F / z, hor + CAMH * F / z]; }
  var asph = el('path', { fill: 'url(#asphalt)' }), edgeL = el('path', { fill: 'none', stroke: '#fff', 'stroke-linejoin': 'round' }),
      edgeR = el('path', { fill: 'none', stroke: '#fff', 'stroke-linejoin': 'round' }), dashes = el('path', { fill: '#ffffff' });
  road.appendChild(asph); road.appendChild(edgeL); road.appendChild(edgeR); road.appendChild(dashes);
  /* the tunnel: his blue, a portal with a dark mouth the road runs into */
  var portal = el('path', { fill: 'url(#tun)' }), mouth = el('path', { fill: 'url(#tunIn)' }), lip = el('path', { fill: 'none', stroke: '#a4d4ff', 'stroke-opacity': '.6' });
  tun.appendChild(portal); tun.appendChild(mouth); tun.appendChild(lip);

  function drawRoad(o) {
    /* o: hor, cx, curve, zEnd (road stops where the tunnel is), travel (how far we have driven), alpha */
    var L = [], R = [], zs = [], z;
    for (z = ZN; z <= o.zEnd; z *= 1.045) zs.push(z);
    zs.push(o.zEnd);
    zs.forEach(function (z) { var xc = o.curve * z * z; L.push(proj(xc - HALF, z, o.hor, o.cx)); R.push(proj(xc + HALF, z, o.hor, o.cx)); });
    var d = 'M' + L.map(function (p) { return p[0].toFixed(1) + ' ' + p[1].toFixed(1); }).join('L') +
            'L' + R.reverse().map(function (p) { return p[0].toFixed(1) + ' ' + p[1].toFixed(1); }).join('L') + 'Z';
    R.reverse();
    asph.setAttribute('d', d);
    /* the edge lines, offset in from each side */
    var line = function (off) { return 'M' + zs.map(function (z) { var p = proj(o.curve * z * z + off, z, o.hor, o.cx); return p[0].toFixed(1) + ' ' + p[1].toFixed(1); }).join('L'); };
    edgeL.setAttribute('d', line(-HALF + .12)); edgeR.setAttribute('d', line(HALF - .12));
    edgeL.setAttribute('stroke-width', 2.6); edgeR.setAttribute('stroke-width', 2.6);
    /* the centre dashes: 1.2 long every 3, streaming at the camera */
    var dd = '', P = 3, DL = 1.3, ph = o.travel % P;
    for (var k = -1; k * P < o.zEnd + P; k++) {
      var z0 = k * P - ph + ZN + 0.4, z1 = z0 + DL;
      if (z1 < ZN || z0 > o.zEnd) continue;
      z0 = Math.max(z0, ZN); z1 = Math.min(z1, o.zEnd);
      var w = 0.07, a = proj(o.curve * z0 * z0 - w, z0, o.hor, o.cx), b = proj(o.curve * z0 * z0 + w, z0, o.hor, o.cx),
          c = proj(o.curve * z1 * z1 + w, z1, o.hor, o.cx), e = proj(o.curve * z1 * z1 - w, z1, o.hor, o.cx);
      dd += 'M' + a[0].toFixed(1) + ' ' + a[1].toFixed(1) + 'L' + b[0].toFixed(1) + ' ' + b[1].toFixed(1) +
            'L' + c[0].toFixed(1) + ' ' + c[1].toFixed(1) + 'L' + e[0].toFixed(1) + ' ' + e[1].toFixed(1) + 'Z';
    }
    dashes.setAttribute('d', dd);
    road.setAttribute('opacity', o.alpha);
  }
  function drawTunnel(o) {
    if (!o.show) { tun.setAttribute('opacity', 0); return; }
    tun.setAttribute('opacity', 1);
    /* a phone screen standing on the road: 3.4 wide, as tall as a screen is to its width */
    var z = o.z, s = F / z, xc = o.curve * z * z;
    var w = 3.4 * s, h = w * H / W, x = o.cx + xc * s - w / 2, y = o.hor + CAMH * s - h;
    /* and in its last moments it settles exactly onto the screen */
    var k = o.land; x += (0 - x) * k; y += (0 - y) * k; w += (W - w) * k; h += (H - h) * k;
    var r = w * .11;
    var rr = function (x, y, w, h, r) { return 'M' + (x + r) + ' ' + y + 'H' + (x + w - r) + 'Q' + (x + w) + ' ' + y + ' ' + (x + w) + ' ' + (y + r) + 'V' + (y + h - r) +
      'Q' + (x + w) + ' ' + (y + h) + ' ' + (x + w - r) + ' ' + (y + h) + 'H' + (x + r) + 'Q' + x + ' ' + (y + h) + ' ' + x + ' ' + (y + h - r) + 'V' + (y + r) + 'Q' + x + ' ' + y + ' ' + (x + r) + ' ' + y + 'Z'; };
    portal.setAttribute('d', rr(x, y, w, h, r * (1 - k)));
    /* a thin light edge, like a screen's glass */
    lip.setAttribute('d', rr(x + w * .02, y + w * .02, w * .96, h - w * .04, r * .9 * (1 - k)));
    lip.setAttribute('stroke-width', Math.max(.8, w * .006)); lip.setAttribute('opacity', 1 - k);
    mouth.setAttribute('d', '');
  }

  /* THE TIMELINE, 4.6 s */
  var T = 4.6, t0 = 0, raf = 0;
  function frame(now) {
    var t = (now - t0) / 1000; if (still) t = T;
    /* 1. the road, a third of the screen, curving right into his blue tunnel */
    var hor0 = H * 0.8;   /* the horizon: fixed for the whole film, the road in the bottom quarter */
    var aIn = ease(seg(t, 0, .35));
    var tun = easeIn(seg(t, .15, 2.55));                         /* the tunnel comes at us, slowly then all at once */
    var zT = 62 * Math.pow(.004, tun) ;                           /* 62 -> 0.25 */
    var bend = (.012 + .01 * ease(seg(t, 0, .8))) * (1 - ease(seg(t, .9, 2.75)));   /* the road bends right, then straightens into it */
    var travel = 18 * t + 26 * t * t;                              /* and the lines pick up speed */
    var blue = seg(t, 2.4, 2.45);                                  /* inside: the screen is his blue */
    sky.setAttribute('opacity', blue);
    var insideT = seg(t, 3.15, 3.95);
    /* ONE ROAD, start to finish: the same road runs into the tunnel and on under the
       shield - its horizon rises with the camera, its bend eases out as the shield lands */
    var horR = hor0;
    /* the road bends right; the moment the blue shows, it starts to straighten, and is straight as we enter */
    var curveR = (.012 + .01 * ease(seg(t, 0, .4))) * (1 - easeOut(seg(t, .6, .9)));
    /* the tunnel stands on the same road, on the same bend */
    drawTunnel({ show: t < 2.45, z: Math.max(zT, .3), curve: curveR, hor: hor0, cx: W / 2, land: ease(seg(t, 2.05, 2.45)) });
    drawRoad({ hor: horR, cx: W / 2, curve: curveR, zEnd: ZF, travel: travel, alpha: aIn });
    /* 3. the shield: from a point on the road's horizon to the screen */
    /* THE SLAP: in at once, a size too big, hits, overshoots small and settles */
    var lt = seg(t, 2.45, 3.05);
    /* it grows from nothing the moment we are inside, with a little overshoot */
    var sc = lt <= 0 ? 0 : back(lt);
    var size = 230 * sc, cy = H * 0.37;
    logo.setAttribute('opacity', lt > 0 ? 1 : 0);
    logo.setAttribute('transform', 'translate(' + (W / 2 - size / 2).toFixed(1) + ' ' + (cy - size / 2).toFixed(1) + ') scale(' + (size / 300).toFixed(4) + ')');
    /* a glint across it once it lands */
    var gt = ease(seg(t, 3.3, 4.0));
    glint.setAttribute('x', (-140 + 520 * gt).toFixed(1));
    acts.classList.toggle('on', t >= 3.35);
    if (t < T && !still) raf = requestAnimationFrame(frame);
  }
  function play() { cancelAnimationFrame(raf); t0 = performance.now(); raf = requestAnimationFrame(frame); }
  /* THE CARD'S INTRO: plays once on arrival (phones), then hands over to the card */
  var box = document.getElementById('intro'), done = false;
  function finish() { if (done) return; done = true; cancelAnimationFrame(raf); box.classList.add('out');
    setTimeout(function () { box.remove(); document.documentElement.classList.remove('intro-on'); }, 650); }
  var go = document.getElementById('intro-install');
  go.addEventListener('click', function (e) { e.stopPropagation(); var b = document.querySelector('[data-install-go]'); finish(); if (b) b.click(); });
  box.addEventListener('click', finish);
  if (matchMedia('(display-mode: standalone)').matches || navigator.standalone) go.hidden = true;
  play(); setTimeout(finish, 5000);

})();
