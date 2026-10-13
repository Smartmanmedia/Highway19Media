/* Carpenter Rick's intro - boards nailed up into a wall, then his badge slapped
   on like a signature, then the card. Built by tools/card/build.js from
   cards/carpenterrick/intro/ because card.json has "intro". */
(function () {
  var box = document.getElementById('intro');
  if (!box) return;
  var wall = document.getElementById('rk-wall'), dark = document.getElementById('rk-dark');
  var logo = document.getElementById('rk-logo'), ring = document.getElementById('rk-ring'), dust = document.getElementById('rk-dust');
  var acts = document.getElementById('intro-acts'), go = document.getElementById('intro-install');
  var done = false, timers = [];
  var later = function (f, ms) { timers.push(setTimeout(f, ms)); };
  var rnd = function (a, b) { return a + Math.random() * (b - a); };

  function finish() {
    if (done) return; done = true;
    timers.forEach(clearTimeout);
    box.classList.add('out');
    setTimeout(function () { box.remove(); document.documentElement.classList.remove('intro-on'); }, 650);
  }

  /* not shown at all (a desktop, or reduced motion): hand straight over */
  if (getComputedStyle(box).display === 'none') { finish(); return; }

  /* THE WALL: one board per row, warm pine to cedar, nailed bottom to top,
     each from the opposite side to the last */
  var tones = ['#b07a3f', '#c08a4a', '#a56f38', '#b9844a', '#9c6a35', '#c79352', '#a8743e'];
  var rows = Math.max(8, Math.min(14, Math.round(innerHeight / 70)));
  var boards = [];
  for (var i = 0; i < rows; i++) {
    var b = document.createElement('div'), left = i % 2 === 0;
    b.className = 'rk-b';
    b.style.setProperty('--c', tones[Math.floor(Math.random() * tones.length)]);
    b.style.setProperty('--a', rnd(84, 96).toFixed(1) + 'deg');
    b.style.setProperty('--from', (left ? '-115%' : '115%'));
    b.style.setProperty('--over', (left ? '1.6%' : '-1.6%'));
    b.style.setProperty('--k', rnd(15, 80).toFixed(0) + '%');
    b.style.setProperty('--ko', Math.random() < .55 ? '1' : '0');
    wall.appendChild(b); boards.push(b);
  }
  var step = Math.min(110, 1100 / rows);
  boards.forEach(function (b, n) { later(function () { b.classList.add('in'); }, 150 + n * step); });
  var built = 150 + rows * step + 380;

  /* THE SLAP */
  later(function () { dark.classList.add('on'); }, built - 150);
  later(function () { logo.classList.add('go'); }, built + 100);
  var impact = built + 100 + 280;   /* 45% of the slap is the hit */
  later(function () {
    box.classList.add('shake');
    ring.classList.add('go');
    for (var s = 0; s < 22; s++) {
      var p = document.createElement('i'), ang = rnd(0, Math.PI * 2), dist = rnd(110, 230);
      p.className = 'rk-s go';
      p.style.setProperty('--z', rnd(3, 8).toFixed(1) + 'px');
      p.style.setProperty('--dx', (Math.cos(ang) * dist).toFixed(0) + 'px');
      p.style.setProperty('--dy', (Math.sin(ang) * dist * .8).toFixed(0) + 'px');
      p.style.setProperty('--r', rnd(-200, 200).toFixed(0) + 'deg');
      p.style.animationDelay = rnd(0, 60).toFixed(0) + 'ms';
      dust.appendChild(p);
    }
    if (navigator.vibrate) try { navigator.vibrate(30); } catch (e) {}
  }, impact);

  /* the button, then the card */
  later(function () { acts.classList.add('on'); }, impact + 450);
  later(finish, impact + 2900);

  var installed = matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
  if (installed) go.textContent = 'Open My Card';
  go.addEventListener('click', function (e) {
    e.stopPropagation();
    var btn = installed ? null : document.querySelector('[data-install-go]');
    finish(); if (btn) btn.click();
  });
  box.addEventListener('click', finish);
  window.__introFinish = finish;
  setTimeout(finish, 9000);   /* never longer than this, whatever happens */
})();
