/* THE TRAFFIC TUNER — a temporary panel, like the day/night button beside it.
 *
 * Every number in traffic.js was picked by watching pixels and arguing about
 * them in prose. This lets him move them himself, live, and read back the one
 * line that says what he settled on. When he hands those numbers over they go
 * into traffic.js as the defaults and this file comes out; nothing downstream
 * knows it was ever here.
 *
 * IT ONLY MOVES THINGS THAT CAN MOVE LIVE. Density is a share of a fixed pool,
 * so the census in traffic.js gets there by attrition - cars leave at the end
 * of a lap and come back into a gap - which is the same behaviour night uses
 * and the reason a slider never makes a car appear on top of another one. Top
 * speed is a multiplier over each car's own speed, so the three-to-one spread
 * that makes the queueing survives being sped up.
 */
(function () {
  'use strict';
  var T = window.H19_TRAFFIC, TUNE = window.H19_TUNE;
  if (!T || !TUNE) return;

  var ROWS = [
    { k: 'coast',  label: 'Coast · 1–2', road: 0 },
    { k: 'desert', label: 'Desert · 3',      road: 1 },
    { k: 'forest', label: 'Forest · 4',      road: 2 }
  ].filter(function (r) { return T[r.road]; });

  var css = document.createElement('style');
  css.textContent =
    '.tune-btn{position:fixed;top:14px;right:74px;z-index:10000;width:52px;height:52px;' +
      'padding:0;border:0;border-radius:50%;background:rgba(0,0,0,.30);' +
      'backdrop-filter:blur(2px);cursor:pointer;display:grid;place-items:center;' +
      'box-shadow:0 2px 10px rgba(0,0,0,.35);transition:background .25s,transform .25s}' +
    '.tune-btn:hover{transform:scale(1.06)}' +
    '.tune-btn svg{width:22px;height:22px;fill:none;stroke:#fff;stroke-width:2.6;' +
      'stroke-linecap:round;stroke-linejoin:round;transition:rotate .25s}' +
    '.tune-btn[aria-expanded="true"] svg{rotate:180deg}' +
    '.tune{position:fixed;top:74px;right:14px;z-index:10001;width:290px;' +
      'max-height:70vh;overflow:auto;padding:14px 16px 12px;border-radius:14px;' +
      'background:rgba(8,14,26,.94);backdrop-filter:blur(6px);color:#fff;' +
      'box-shadow:0 10px 40px rgba(0,0,0,.5);' +
      'font:500 12px/1.4 "Be Vietnam Pro",system-ui,sans-serif}' +
    '.tune[hidden]{display:none}' +
    '.tune h4{margin:12px 0 6px;font-size:10px;font-weight:900;letter-spacing:.16em;' +
      'text-transform:uppercase;color:#ffc72c}' +
    '.tune h4:first-child{margin-top:0}' +
    '.tune label{display:flex;align-items:center;gap:8px;margin:0 0 7px}' +
    '.tune label span{flex:1;color:rgba(255,255,255,.8)}' +
    '.tune label b{width:44px;text-align:right;font-weight:800;font-variant-numeric:tabular-nums}' +
    '.tune input[type=range]{flex:0 0 118px;accent-color:#ffc72c;height:18px}' +
    '.tune .cap{margin:14px 0 5px;color:rgba(255,255,255,.5);font-size:10.5px}' +
    '.tune .out{margin:0;padding:8px 10px;border-radius:8px;' +
      'background:rgba(255,255,255,.07);color:#cfe0ff;font:600 11px/1.5 ui-monospace,' +
      'SFMono-Regular,Menlo,monospace;word-break:break-word;user-select:all}' +
    '.tune .rst{margin-top:9px;width:100%;padding:7px 0;border:0;border-radius:8px;' +
      'background:rgba(255,255,255,.12);color:#fff;font:800 11px/1 inherit;' +
      'letter-spacing:.1em;text-transform:uppercase;cursor:pointer}' +
    '.tune .rst:hover{background:rgba(255,255,255,.2)}' +
    '@media (max-width:900px){.tune-btn{top:10px;right:70px}' +
      '.tune{top:70px;right:10px;left:10px;width:auto}}';
  document.head.appendChild(css);

  var btn = document.createElement('button');
  btn.className = 'tune-btn'; btn.type = 'button';
  btn.setAttribute('aria-label', 'Traffic settings');
  btn.setAttribute('aria-expanded', 'false');
  btn.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 9l7 7 7-7"/></svg>';

  var box = document.createElement('div');
  box.className = 'tune'; box.hidden = true;

  /* the defaults are whatever traffic.js shipped with, read off it rather than
     written down here - so this panel can never disagree with the file */
  var DEF = { night: TUNE.nightKeep, headway: TUNE.headway, road: [] };
  ROWS.forEach(function (r) {
    DEF.road.push({ share: T[r.road].share, quick: T[r.road].quick });
  });

  var out = document.createElement('p'); out.className = 'out';

  function row(label, min, max, step, get, set, fmt) {
    var l = document.createElement('label');
    var s = document.createElement('span'); s.textContent = label;
    var i = document.createElement('input');
    i.type = 'range'; i.min = min; i.max = max; i.step = step; i.value = get();
    var b = document.createElement('b');
    function show() { b.textContent = fmt(+i.value); }
    i.addEventListener('input', function () { set(+i.value); show(); report(); });
    l.appendChild(s); l.appendChild(i); l.appendChild(b);
    box.appendChild(l); show();
    return { i: i, show: show, reset: function (v) { i.value = v; set(v); show(); } };
  }

  var ctl = [];
  ROWS.forEach(function (r, n) {
    var h = document.createElement('h4'); h.textContent = r.label; box.appendChild(h);
    var road = T[r.road];
    ctl.push(row('Cars', 0, 150, 5,
      function () { return Math.round(road.share * 100); },
      function (v) { road.share = v / 100; },
      function (v) { return v + '%'; }));
    ctl.push(row('Speed', 40, 200, 5,
      function () { return Math.round(road.quick * 100); },
      function (v) { road.quick = v / 100; },
      function (v) { return v + '%'; }));
  });

  var h2 = document.createElement('h4'); h2.textContent = 'Everywhere';
  box.appendChild(h2);
  ctl.push(row('Night keeps', 0, 100, 5,
    function () { return Math.round(TUNE.nightKeep * 100); },
    function (v) { TUNE.nightKeep = v / 100; },
    function (v) { return v + '%'; }));
  ctl.push(row('Headway', 15, 80, 1,
    function () { return Math.round(TUNE.headway * 10); },
    function (v) { TUNE.headway = v / 10; },
    function (v) { return (v / 10).toFixed(1) + 's'; }));

  var cap = document.createElement('p'); cap.className = 'cap';
  cap.textContent = '100% is what the site ships with today. Send me this line.';
  box.appendChild(cap);
  box.appendChild(out);
  var rst = document.createElement('button');
  rst.className = 'rst'; rst.type = 'button'; rst.textContent = 'Back to defaults';
  rst.addEventListener('click', function () {
    ROWS.forEach(function (r, n) {
      ctl[n * 2].reset(Math.round(DEF.road[n].share * 100));
      ctl[n * 2 + 1].reset(Math.round(DEF.road[n].quick * 100));
    });
    ctl[ROWS.length * 2].reset(Math.round(DEF.night * 100));
    ctl[ROWS.length * 2 + 1].reset(Math.round(DEF.headway * 10));
    report();
  });
  box.appendChild(rst);

  /* THE LINE HE READS BACK. Whatever he settles on, this is the sentence to
     send me - it is the whole configuration and nothing else. */
  function report() {
    var bits = ROWS.map(function (r) {
      var road = T[r.road];
      return r.k + ' ' + Math.round(road.share * 100) + '/' + Math.round(road.quick * 100);
    });
    bits.push('night ' + Math.round(TUNE.nightKeep * 100) + '%');
    bits.push('headway ' + TUNE.headway.toFixed(1) + 's');
    out.textContent = bits.join(' · ');
  }
  report();

  btn.addEventListener('click', function () {
    box.hidden = !box.hidden;
    btn.setAttribute('aria-expanded', String(!box.hidden));
  });
  document.body.appendChild(btn);
  document.body.appendChild(box);
})();
