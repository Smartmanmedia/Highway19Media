#!/usr/bin/env node
/* Inline the scene study into one self-contained file.
   Artifact hosting blocks external images outright, so every asset has to
   travel as a data URI or it silently shows nothing. */
const fs = require('fs'), path = require('path');
const ROOT = __dirname + '/..';
let html = fs.readFileSync(ROOT + '/tools/scene-assembled.html', 'utf8');

const mime = { '.svg':'image/svg+xml', '.webp':'image/webp', '.png':'image/png' };
let n = 0;
html = html.replace(/src="\.\.\/([^"]+)"/g, (m, rel) => {
  const f = path.join(ROOT, rel);
  if (!fs.existsSync(f)) throw new Error('missing asset: ' + rel);
  n++;
  return 'src="data:' + mime[path.extname(f)] + ';base64,' +
         fs.readFileSync(f).toString('base64') + '"';
});

/* Fit the 2472-wide canvas to whatever window it opens in, and keep it
   centred, so the study reads on a laptop as well as a big monitor. */
html += `
<script>
(function () {
  var c = document.getElementById('c');
  function fit() {
    var s = Math.min(1, (window.innerWidth - 24) / 2472.32);
    c.style.transform = 'scale(' + s + ')';
    document.body.style.height = (5180.59 * s) + 'px';
    document.body.style.width = (2472.32 * s) + 'px';
    document.body.style.margin = '0 auto';
    if (window.__scene) window.__scene.recollect();
  }
  window.addEventListener('resize', fit);
  fit();
})();
</script>
<script>${fs.readFileSync(ROOT + '/assets/js/scene.js', 'utf8')}</script>`;

/* scene.js looks for #main; the study's canvas plays that part */
html = html.replace('<div class="canvas" id="c">', '<div class="canvas" id="c"><span id="main" hidden></span>');
html = html.replace("document.getElementById('main')", "document.getElementById('c')");

fs.mkdirSync(ROOT + '/dist', { recursive: true });
fs.writeFileSync(ROOT + '/dist/scene-study.html', html);
console.log('assets inlined: ' + n);
console.log('dist/scene-study.html ' + Math.round(html.length / 1024) + ' KB');
