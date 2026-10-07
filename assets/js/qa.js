/* Highway 19 Media — Q&A behaviour.
   Answers are shut by default, one open at a time per section. His artboard is
   never redrawn: sections whose ground is flat between the cards and the CTA
   close or open that flat band as the column changes height; the rest keep his
   exact height and the column stays inside the room he drew for it. */
(function () {
  'use strict';

  /* his mobile columns answer to the same rules: shut by default, one open
     at a time. They stand in the flow and take the height they need, so
     there is no drawn room to fit them into and no flat band to open. */
  var cols = [].slice.call(document.querySelectorAll('.col, .mcol'));

  cols.forEach(function (col) {
    var mob   = col.classList.contains('mcol');
    var sec   = col.closest(mob ? '.msec' : '.sec');
    var items = [].slice.call(col.querySelectorAll('.qa'));
    var isFlex = !mob && sec.hasAttribute('data-flex');

    /* his drawn room: from the first card down to the top of his CTA panel,
       in his own artboard pixels - converted through the page unit */
    var room = parseFloat(col.dataset.room || '0');
    var drawn = parseFloat(col.dataset.drawn || '0');
    function unit() {
      var a = sec.querySelector('.art, .art-a');
      return a ? a.getBoundingClientRect().width / 3088 : 1;
    }

    function fit() {
      if (mob) return;
      var u = unit();
      var h = col.getBoundingClientRect().height / u;
      if (isFlex) {
        /* open or close his flat band so the CTA keeps the gap he drew */
        sec.style.setProperty('--flex', 'calc(' + (h - drawn).toFixed(1) + '*var(--u))');
        col.style.transform = '';
      } else if (room) {
        /* fixed height: never let the column reach his CTA */
        var over = h - room;
        col.style.transform = over > 0 ? 'translateY(' + (-over * u).toFixed(1) + 'px)' : '';
      }
    }

    items.forEach(function (qa) {
      var btn = qa.querySelector('.qa-q');
      btn.addEventListener('click', function () {
        var wasOpen = qa.classList.contains('is-open');
        items.forEach(function (o) {
          o.classList.remove('is-open');
          o.querySelector('.qa-q').setAttribute('aria-expanded', 'false');
        });
        if (!wasOpen) {
          qa.classList.add('is-open');
          btn.setAttribute('aria-expanded', 'true');
        }
        fit();
      });
    });

    /* the column's height animates as an answer opens, so follow it frame by
       frame rather than reading it once and landing on the stale number */
    if (window.ResizeObserver) new ResizeObserver(fit).observe(col);

    col.__fit = fit;
    fit();
  });

  addEventListener('resize', function () {
    cols.forEach(function (c) { if (c.__fit) c.__fit(); });
  });

  /* ---------- his signs, on parallax ----------
     Driven by where the sign itself is on screen, not by how far through his
     section we are: he drew one sign across the 05/06 seam, and two halves
     each riding their own section's progress tore it in half. */
  /* his signs, and his clouds above them. A cloud is the highest thing he
     drew, so it overtakes everything on the page; the shadow it throws is on
     his ground and stays there, which is what makes the pair read as height. */
  var SIGN_UP = 1.4;                       /* his green boards, 40% bigger */
  /* HIS BOARDS RIDE ON THE PHONE TOO. A board lifted into one of the mobile
     sections is his own art and carries his own tag; what it had no way of
     finding was a section to ride, because this only ever looked inside a
     .sec. It rides its .msec instead.
     IT DOES NOT SWELL THERE. The forty per cent is a desktop move, made so a
     board he drew for a 2128-wide artboard fills a wide window; on a phone it
     is already the width of the column and any growth walks it off the edge.
     And it travels less: the travel is in HIS units, and a mobile board's
     svg is 1093 units across where a desktop artboard is 2128, so the same
     number would be twice the move. */
  var signs = [].slice.call(document.querySelectorAll(
    '.sec [data-sign], .sec [data-para], .msec [data-sign], .msec [data-para]'));
  signs.forEach(function (g) {
    g.style.willChange = 'transform';
    g.__sec = g.closest('.sec, .msec');
    g.__mob = !!(g.__sec && g.__sec.classList.contains('msec'));
    g.__amt = g.__mob ? 190
            : g.getAttribute('data-para') === 'cloud' ? 760
            : parseFloat(g.getAttribute('data-sign-travel') || '520');
    /* HIS GREEN BOARDS, BIGGER. Which board is green is read off the paint
       he used: the fill that covers the most of the assembly. The board
       itself is what has to fit the window, not the gantry it hangs from,
       so the plate is measured on its own - the run of that same green. */
    g.__sc = 1; g.__up = 1;
    if (g.hasAttribute('data-sign') && !g.__mob) {
      var area = {}, top = '', best = 0, own = {};
      [].forEach.call(g.querySelectorAll('[fill]'), function (e) {
        var f = (e.getAttribute('fill') || '').toLowerCase(), bx;
        if (!f || f === 'none' || f.indexOf('url') === 0) return;
        try { bx = e.getBBox(); } catch (err) { return; }
        var a = bx.width * bx.height;
        if (!a) return;
        area[f] = (area[f] || 0) + a;
        var o = own[f] || (own[f] = [1e9, -1e9]);
        if (bx.x < o[0]) o[0] = bx.x;
        if (bx.x + bx.width > o[1]) o[1] = bx.x + bx.width;
        if (area[f] > best) { best = area[f]; top = f; }
      });
      if (top === '#1c9022' || top === '#006802') {
        g.__up = SIGN_UP; g.__plate = own[top];
      }
    }
    try {
      var bb = g.getBBox();
      g.__cx = (bb.x + bb.width / 2).toFixed(1);
      g.__cy = (bb.y + bb.height / 2).toFixed(1);
      var sr = g.__sec.getBoundingClientRect(), gr = g.getBoundingClientRect();
      /* its middle, as a fraction of his section, so it survives any resize */
      g.__frac = sr.height ? ((gr.top - sr.top) + gr.height / 2) / sr.height : 0.5;
    } catch (e) { g.__cx = 1064; g.__cy = 0; g.__frac = 0.5; }
    var sr2 = g.__sec.getBoundingClientRect();
    g.__secTop = sr2.top + scrollY;
    g.__secH = sr2.height || 1;
    g.__page = g.__secTop + g.__frac * g.__secH;     /* his sign on the page */
  });

  /* A CLOUD AND THE SHADOW HE DREW UNDER IT ARE ONE THING, and he names them
     so: Cloud5 and Cloud_5_shadow, Cloud3 and Cloud3_Shadow. Paired by the
     name rather than by how close they happen to fall, because a section can
     carry two of each and proximity pairs the wrong ones. */
  var byName = {};
  signs.forEach(function (g) {
    if (g.getAttribute('data-para') !== 'cloud') return;
    var key = (g.id || '').toLowerCase()
      .replace(/[-_]?shadows?/g, '').replace(/cloud[_-]?/, 'cloud').replace(/_/g, '');
    (byName[key] = byName[key] || []).push(g);
  });
  Object.keys(byName).forEach(function (k) {
    var list = byName[k];
    if (list.length < 2) return;
    for (var i = 1; i < list.length; i++) list[i].__leader = list[0];
  });

  /* HIS CLOUDS DO NOT STOP AT A JOIN. Each section clips its own art, so a
     cloud carried down by its own parallax was being sliced off flat along
     the seam. The same cloud is drawn in the section next door as well, one
     artboard away, on top of everything there - the highest thing he drew.
     A <use> renders the cloud with its own transform, so the copy takes the
     parallax from the original for free and never needs touching again.
     The offset is a ratio of two lengths that both scale with the window,
     so it is right at every width. */
  (function ghostAcrossSeams() {
    var arts = [].slice.call(document.querySelectorAll('.art > svg, .art-a > svg, .art-b > svg'));
    if (arts.length < 2) return;
    var tops = arts.map(function (s2) { return s2.getBoundingClientRect().top + scrollY; });
    signs.forEach(function (g) {
      /* CLOUDS ONLY. A sign he drew across a join is exported into BOTH
         artboards whole, each copy clipped to its own, and the two strips
         tile into the one sign. Draw either of them uncut and its green
         plate lands over the other one's lettering. His clouds are single
         objects and copy safely; his signs already carry their own join. */
      if (g.getAttribute('data-para') !== 'cloud' || !g.id) return;
      var own = g.ownerSVGElement, oi = arts.indexOf(own);
      if (oi < 0) return;
      var box = own.viewBox.baseVal, w = own.getBoundingClientRect().width;
      var u = box && box.width ? w / box.width : 1;        /* px per his unit */
      if (!u) return;
      [oi - 1, oi + 1].forEach(function (ni) {
        var nb = arts[ni];
        if (!nb) return;
        /* the two strips of one section already carry the same cloud each: a copy
           between them would draw it twice */
        if (nb.closest('section') === own.closest('section')) return;
        var use = document.createElementNS('http://www.w3.org/2000/svg', 'use');
        use.setAttribute('href', '#' + g.id);
        use.setAttributeNS('http://www.w3.org/1999/xlink', 'xlink:href', '#' + g.id);
        /* the two artboards can start at different heights of his drawing (a
           tail strip's viewBox begins where the seam strip ends), so the copy is
           moved by both: the gap between the two on the page, and the gap
           between where each one's drawing starts */
        var nvb = nb.viewBox.baseVal, oy = (box ? box.y : 0) - (nvb ? nvb.y : 0);
        use.setAttribute('transform', 'translate(0 ' + ((tops[oi] - tops[ni]) / u - oy).toFixed(2) + ')');
        use.setAttribute('aria-hidden', 'true');
        use.style.pointerEvents = 'none';
        /* A COPY GOES UNDER THAT SECTION'S OWN CLOUDS. Put at the very top of
           the stack, the shadow of the cloud next door was landing on top of
           the cloud drawn here. Copies sit above his ground and below his
           own sky, which is where the cloud they come from sits. */
        var anchor = null, kid = nb.firstChild;
        for (; kid; kid = kid.nextSibling)
          if (kid.getAttribute && kid.getAttribute('data-para') === 'cloud') { anchor = kid; break; }
        if (anchor) nb.insertBefore(use, anchor); else nb.appendChild(use);
      });
    });
  })();

  /* a sign he drew across a seam arrives as two halves in two sections; they
     share one anchor so they move as the single sign he drew. Only signs
     pair with signs: a cloud that happened to fall near one was being taken
     for its other half, and the sign then rode the cloud's travel. */
  var boards = signs.filter(function (g) {
    return g.getAttribute('data-para') !== 'cloud';
  }).sort(function (a, b) { return a.__page - b.__page; });
  boards.forEach(function (g, i, list) {
    var prev = list[i - 1];
    if (!prev || g.__page - prev.__page > 220) return;
    /* a phone board never has a half in another section, and below 900px
       every .sec is shut, so their pages all read zero and they would all
       pair with each other */
    if (prev.__mob !== g.__mob || g.__mob) return;
    var mid = (prev.__anchor || prev.__page + g.__page) / (prev.__anchor ? 1 : 2);
    prev.__anchor = mid; g.__anchor = mid;
    var cx = (parseFloat(prev.__cx) + parseFloat(g.__cx)) / 2;
    [prev, g].forEach(function (h) {
      h.__frac = (h.__anchor - h.__secTop) / h.__secH;
      /* both halves swell about the one point, or the scale slides them
         apart and his sign shows a step where he drew none */
      var a = h.__sec.querySelector('.art, .art-a');
      var u = a ? a.getBoundingClientRect().width / 3088 : 1;
      h.__cx = cx.toFixed(1);
      h.__cy = (u ? (h.__anchor - h.__secTop) / u : 0).toFixed(1);
    });
    g.__leader = prev.__leader || prev;
    g.__twin = prev; prev.__twin = g;
  });

  /* AS BIG AS THE WINDOW HAS ROOM FOR. Forty per cent on a board he drew
     hard against the edge of his artboard pushes it off the screen, and on
     a tablet there is no room to give it at all: the page shows a fixed
     1960 units of his 2128-wide artboard below that width, so the board
     ends up cut. The board grows as far as it can without passing the edge
     of what is on screen, up to the forty per cent - which is what a wide
     screen gives it and a narrow one does not. A board he drew across a
     join grows on the one measurement both halves share, or the halves
     come apart. */
  function fitSigns() {
    var seen = [];
    boards.forEach(function (g) {
      if (g.__up === 1 || !g.__plate) return;
      if (seen.indexOf(g) >= 0) return;
      var pair = g.__twin && g.__twin.__plate ? [g, g.__twin] : [g];
      pair.forEach(function (h) { seen.push(h); });
      var x0 = 1e9, x1 = -1e9;
      pair.forEach(function (h) {
        if (h.__plate[0] < x0) x0 = h.__plate[0];
        if (h.__plate[1] > x1) x1 = h.__plate[1];
      });
      var art = g.__sec.querySelector('.art, .art-a');
      var u = art ? art.getBoundingClientRect().width / 3088 : 1;
      var vw = document.documentElement.clientWidth || innerWidth;
      var vis = u ? vw / u : 1960;                  /* his units now on screen */
      /* a shade in from the edge, so the board reads as a board and not as
         something sliced off by the window */
      var L = 1064 - vis / 2 + 24, R = 1064 + vis / 2 - 24;
      var cx = parseFloat(g.__cx);
      var s = g.__up;
      if (x1 > cx) s = Math.min(s, (R - cx) / (x1 - cx));
      if (x0 < cx) s = Math.min(s, (cx - L) / (cx - x0));
      if (!(s > 1)) s = 1;                          /* never smaller than he drew */
      pair.forEach(function (h) { h.__sc = s; });
    });
  }
  fitSigns();
  addEventListener('resize', fitSigns);

  /* THE LETTERING IS ONLY IN ONE OF THE TWO HALVES. He set his board across
     the join, and Illustrator wrote the green plate into both artboards but
     his words into just the one - sitting, in that artboard, above its own
     top edge. So the top line of "BRANDING & GRAPHIC DESIGN" was cut off by
     the join and the strip above it was a bare plate.

     The half that carries his words is drawn again in the other half's
     section, over that bare plate, one artboard away. The two plates are
     the same plate in the same place, so nothing is covered that is not
     already identical - and the whole sign reads across the join. */
  (function joinBoards() {
    var arts = [].slice.call(document.querySelectorAll('.art > svg, .art-a > svg, .art-b > svg'));
    var tops = arts.map(function (s2) { return s2.getBoundingClientRect().top + scrollY; });
    var n = 0;
    boards.forEach(function (g) {
      var t = g.__twin;
      if (!t) return;
      var mine = (g.textContent || '').trim().length;
      var theirs = (t.textContent || '').trim().length;
      if (mine <= theirs) return;                 /* the other half is the master */
      var oi = arts.indexOf(g.ownerSVGElement), ni = arts.indexOf(t.ownerSVGElement);
      if (oi < 0 || ni < 0 || oi === ni) return;
      var box = g.ownerSVGElement.viewBox.baseVal;
      var u = box && box.width ? g.ownerSVGElement.getBoundingClientRect().width / box.width : 0;
      if (!u) return;
      if (!g.id) g.id = 'h19-board-' + (++n);
      var use = document.createElementNS('http://www.w3.org/2000/svg', 'use');
      use.setAttribute('href', '#' + g.id);
      use.setAttributeNS('http://www.w3.org/1999/xlink', 'xlink:href', '#' + g.id);
      use.setAttribute('transform', 'translate(0 ' + ((tops[oi] - tops[ni]) / u).toFixed(2) + ')');
      use.setAttribute('aria-hidden', 'true');
      use.style.pointerEvents = 'none';
      /* straight over the bare plate it belongs to, and nothing else */
      t.parentNode.insertBefore(use, t.nextSibling);
    });
  })();

  /* EVERY SHADOW UNDER EVERY CLOUD. His clouds and the shadows they throw
     are drawn last in each artboard, and a copy of a cloud from the section
     next door goes in with them - but a copy landing below that section's
     own cloud shadow was being painted over by it, and the grey band of
     that shadow ran straight across the cloud along the join. Sky is sky
     whichever artboard it was drawn in: all the shadows first, then all the
     clouds, in the section they are being drawn in. */
  (function stackSky() {
    [].forEach.call(document.querySelectorAll('.art > svg, .art-a > svg, .art-b > svg'),
      function (svg) {
        var shade = [], puff = [];
        [].forEach.call(svg.children, function (c) {
          var name = c.tagName === 'use' ? (c.getAttribute('href') || '')
                   : (c.getAttribute('data-para') === 'cloud' ? (c.id || '') : '');
          if (!/cloud/i.test(name)) return;
          (/shadows?\b|shadows?$|shadow/i.test(name) ? shade : puff).push(c);
        });
        shade.concat(puff).forEach(function (c) { svg.appendChild(c); });
      });
  })();

  var queued = false;
  function frame() {
    queued = false;
    var vh = innerHeight;
    for (var i = 0; i < signs.length; i++) {
      var g = signs[i], r = g.__sec.getBoundingClientRect();
      if (r.bottom < -700 || r.top > vh + 700) continue;
      var lead = g.__leader;
      var p;
      if (lead && lead.__p != null) { p = lead.__p; }
      else {
        var mid = r.top + r.height * g.__frac;      /* the sign's own middle */
        p = (vh - mid) / vh;                        /* 1 at the top, 0 at the foot */
        if (p < -0.4) p = -0.4; else if (p > 1.4) p = 1.4;
        g.__p = p;
      }
      /* the sign rides well above the ground it is bolted over, and leans in
         a little as it passes, so it reads as the nearest thing on the page */
      /* it starts below where he drew it, sits exactly on it halfway up the
         screen and carries on above it - and it TRAVELS. Nothing swells: a
         sign that grows reads as a zoom, not as something close by. */
      var off = (0.5 - p) * g.__amt;
      var t = 'translate(0 ' + off.toFixed(2) + ')';
      /* a board swells about its own middle - and a board he drew across a
         seam swells about the one middle both halves share, or his sign
         shows a step where he drew none */
      if (g.__sc !== 1) t += ' translate(' + g.__cx + ' ' + g.__cy + ') scale(' +
        g.__sc + ') translate(' + (-g.__cx) + ' ' + (-g.__cy) + ')';
      g.setAttribute('transform', t);
      /* AND IT STAYS IN ITS OWN SECTION. Each section cuts what passes its
         edges, so a board riding up past the top of its section was sliced
         flat along the join, brackets and all. A single board stops just
         inside instead; a board he drew across a seam is two halves that
         are meant to cross it, and is left to its pair. */
      if (!g.__twin) {
        var sb = g.getBoundingClientRect(), u = g.__u;
        if (!u) {
          var art = g.__sec.querySelector('.art, .art-a');
          u = g.__u = art ? art.getBoundingClientRect().width / 3088 : 0;
        }
        var fix = 0, M = 6;
        if (sb.top < r.top + M) fix = r.top + M - sb.top;
        else if (sb.bottom > r.bottom - M && sb.height < r.height - 2 * M) fix = r.bottom - M - sb.bottom;
        if (fix && u) {
          off += fix / u;
          t = t.replace(/^translate\(0 [-\d.]+\)/, 'translate(0 ' + off.toFixed(2) + ')');
          g.setAttribute('transform', t);
        }
      }
    }
  }
  function onScroll() { if (!queued) { queued = true; requestAnimationFrame(frame); } }

  if (signs.length && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
    addEventListener('scroll', onScroll, { passive: true });
    addEventListener('resize', onScroll);
    frame();
  }
})();

/* HIS RIDGE IS OVER HIS ROAD, SO IT IS OVER HIS TRAFFIC TOO. Where the road
   from the desert runs down into the green it passes under his rock ridge -
   he drew the rocks on top of the tarmac - but the traffic is painted in a
   layer above his whole artboard, so cars were driving across the rocks. A
   live copy of the ridge goes in just above the traffic: nothing new is
   drawn, the rocks look exactly as they did, and the cars go into the ridge
   and are gone until they come out of the other side.
   Each ridge is checked before it is copied - no road inside it, and his rock
   browns for most of its paint - so an artboard rebuilt with its groups in
   another order skips this rather than copying the wrong thing. */
(function () {
  'use strict';
  var ROCK = { '#97796a': 1, '#876b5f': 1, '#ba9483': 1, '#cfa694': 1, '#dcb09e': 1,
               '#ecbdaa': 1, '#c89f8c': 1, '#c39988': 1 };
  [['art-05', 22], ['art-06', 12]].forEach(function (spec) {
    var art = document.getElementById(spec[0]);
    var g = art && art.children[spec[1]];
    if (!g || g.tagName !== 'g' || g.querySelector('[id*="Stright"],[id*="Curve"],image')) return;
    var all = g.querySelectorAll('[fill]'), rock = 0;
    for (var i = 0; i < all.length; i++) if (ROCK[(all[i].getAttribute('fill') || '').toLowerCase()]) rock++;
    if (!all.length || rock / all.length < 0.7) return;
    var svg = g.ownerSVGElement, slot = svg && svg.querySelector('[data-fleetslot]');
    if (!slot || slot.parentNode !== svg) return;
    /* hidden below the breakpoint, where these desktop artboards are shut */
    var sc = svg.getCTM(), pc = g.parentNode.getCTM();
    if (!sc || !pc) return;
    if (!g.id) g.id = spec[0] + '-ridge';
    var m = sc.inverse().multiply(pc);
    var use = document.createElementNS('http://www.w3.org/2000/svg', 'use');
    use.setAttribute('href', '#' + g.id);
    use.setAttributeNS('http://www.w3.org/1999/xlink', 'xlink:href', '#' + g.id);
    use.setAttribute('transform', 'matrix(' + [m.a, m.b, m.c, m.d, m.e, m.f].map(function (v) {
      return +v.toFixed(5); }).join(' ') + ')');
    use.setAttribute('pointer-events', 'none');
    svg.insertBefore(use, slot.nextSibling);
  });
})();
