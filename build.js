/* Inlines the home page into one self-contained file.
   Two outputs:
     dist/highway19-home.html      full standalone document — hand to WPVibe,
                                   email, or open straight off disk
     dist/highway19-artifact.html  body-only, for publishing as an Artifact
                                   (the host supplies doctype/head/body)
   Source of truth stays the multi-file version; this is generated. */
const fs = require('fs');
const path = require('path');
const R = __dirname;
const OUT = path.join(R, 'dist');
fs.mkdirSync(OUT, { recursive: true });   /* dist/ is gitignored, so a fresh
                                             clone starts without it */

const read = p => fs.readFileSync(path.join(R, p), 'utf8');
let html = read('index.html');
const css = read('assets/css/highway19.css');
const js = ['assets/js/cars-sprite.js', 'assets/js/road.js', 'assets/js/site.js']
  .map(f => '/* ==== ' + f + ' ==== */\n' + read(f)).join('\n');

if (/<\/script>/i.test(js)) throw new Error('script payload contains </script>');

/* Inline every local image as a data URI. Both outputs have to stand alone:
   the single file is opened straight off disk, and the hosted preview's CSP
   blocks external images outright — an <img src="assets/..."> silently shows
   nothing there. WordPress keeps the real files; this is build-time only. */
const MIME = { '.png':'image/png', '.jpg':'image/jpeg', '.jpeg':'image/jpeg',
               '.gif':'image/gif', '.webp':'image/webp', '.svg':'image/svg+xml' };
let inlined = 0;

/* Mask HTML comments first: a commented-out example <img src="..."> is not a
   real reference, and treating it as one fails the build on a file that was
   never meant to exist yet. */
const comments = [];
html = html.replace(/<!--[\s\S]*?-->/g, m => `\u0000C${comments.push(m) - 1}\u0000`);

html = html.replace(/src="((?!data:|https?:)[^"]+\.(?:png|jpe?g|gif|webp|svg))"/gi, (m, rel) => {
  const file = path.join(R, rel);
  if (!fs.existsSync(file)) throw new Error('missing image referenced by index.html: ' + rel);
  const mime = MIME[path.extname(rel).toLowerCase()];
  inlined++;
  return 'src="data:' + mime + ';base64,' + fs.readFileSync(file).toString('base64') + '"';
});

html = html
  .replace(/\n?\s*<link rel="stylesheet"[^>]*>/i, '\n<style>\n' + css + '\n</style>')
  .replace(/\n?\s*<script src="assets\/js\/[^"]*"><\/script>/gi, '')
  .replace(/(\n?<\/body>)/i, '\n<script>\n' + js + '\n</script>\n$1');

fs.writeFileSync(path.join(OUT, 'highway19-home.html'), html);

/* Artifact build: the host wraps the file in its own doctype/head/body, so
   ship only what belongs inside the body — plus the title and styles, which
   it hoists. Charset, viewport and the favicon come from the host. */
const body = html
  .slice(html.indexOf('<body>') + 6, html.lastIndexOf('</body>'))
  .trim();
/* index.html carries the long SEO title; a hosted preview wants the short
   name, which is what shows in the browser tab and the artifact gallery. */
const title = 'Highway 19 Media';
const style = (html.match(/<style>[\s\S]*?<\/style>/i) || [''])[0];

fs.writeFileSync(path.join(OUT, 'highway19-artifact.html'),
  '<title>' + title.trim() + '</title>\n' + style + '\n' + body + '\n');

html = html.replace(/\u0000C(\d+)\u0000/g, (m, i) => comments[+i]);

console.log('images inlined:', inlined);
for (const f of ['dist/highway19-home.html', 'dist/highway19-artifact.html']) {
  console.log(f, (fs.statSync(path.join(R, f)).size / 1024).toFixed(0) + ' KB');
}
