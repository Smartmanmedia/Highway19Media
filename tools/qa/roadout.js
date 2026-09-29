/* HIS ROAD HAS TO TOUCH BOTH EDGES OF THE SCREEN.
   He drew his straight runs starting a little way in from the artboard's
   left, which on a phone leaves a notch of field at the screen edge - and,
   once the traffic runs, a place where a car would appear out of nothing.
   Those runs are straight and axis-aligned, so they are CARRIED OUT, not
   redrawn: his tarmac and his two white edges grow leftwards past the edge
   and his own dash pitch is continued into the new stretch. Nothing of his
   is moved, rescaled or drawn over.
   Idempotent: a run that already starts off the artboard is left alone. */
const BLEED = 120;

function carry(svg) {
  const head = svg.indexOf('</defs>');
  const pre = head < 0 ? '' : svg.slice(0, head + 7);
  let body = head < 0 ? svg : svg.slice(head + 7);

  const RE = /<rect\b[^>]*\/?>/g;
  const num = (t, k) => {
    const m = t.match(new RegExp('\\s' + k + '="([-\\d.]+)"'));
    return m ? parseFloat(m[1]) : NaN;
  };
  const all = body.match(RE) || [];
  const box = t => ({ x: num(t,'x'), y: num(t,'y'), w: num(t,'width'), h: num(t,'height') });

  /* his tarmac: the widest, tallest rect nearest the left edge */
  const tar = all.map(box).filter(q => q.w > 200 && q.h > 40 && q.x > 0 && q.x < 200)
                 .sort((a, b) => a.x - b.x)[0];
  if (!tar) return { svg, n: 0 };

  const set = (t, k, v) => t.replace(new RegExp('(\\s' + k + '=")[-\\d.]+(")'),
                                     '$1' + v.toFixed(2) + '$2');
  let grew = 0, added = 0, dashSrc = null, dashPitch = 0;

  /* the run and its two white edges, all sharing his left x */
  body = body.replace(RE, t => {
    const q = box(t);
    if (Math.abs(q.x - tar.x) < 0.6 && q.w > 200) {
      grew++;
      return set(set(t, 'width', q.w + tar.x + BLEED), 'x', -BLEED);
    }
    return t;
  });

  /* his centre dashes, continued at his own pitch */
  const inRun = (body.match(RE) || []).map(box).filter(q =>
    q.y > tar.y && q.y + q.h < tar.y + tar.h && q.w < 80 && q.h < 12 && q.x < tar.x + 320)
    .sort((a, b) => a.x - b.x);
  if (inRun.length > 1) {
    dashPitch = inRun[1].x - inRun[0].x;
    const first = (body.match(RE) || []).find(t => {
      const q = box(t);
      return Math.abs(q.x - inRun[0].x) < .01 && Math.abs(q.y - inRun[0].y) < .01;
    });
    if (first && dashPitch > 0) {
      dashSrc = first;
      let out = '';
      for (let x = inRun[0].x - dashPitch; x + inRun[0].w > -BLEED; x -= dashPitch) {
        out += set(first, 'x', x); added++;
      }
      body = body.replace(first, out + first);
    }
  }
  return { svg: pre + body, n: grew, dashes: added, from: tar.x };
}

module.exports = { carry, BLEED };

if (require.main === module) {
  const fs = require('fs');
  process.argv.slice(2).forEach(f => {
    const r = carry(fs.readFileSync(f, 'utf8'));
    if (!r.n) { console.log(f, '- no run to carry'); return; }
    fs.writeFileSync(f, r.svg);
    console.log(f, '- carried', r.n, 'rows out from', r.from, '+', r.dashes, 'dashes');
  });
}
