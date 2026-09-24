/* Inlines each page into one self-contained file.
   Two outputs per page:
     dist/highway19-<page>.html          full standalone document — hand to
                                         WPVibe, email, or open off disk
     dist/highway19-<page>-artifact.html body-only, for publishing as an
                                         Artifact (the host supplies
                                         doctype/head/body)
   Source of truth stays the multi-file version; this is generated.

   PAGES is the only thing to touch when a page is added. Everything below it
   is per-page and reads the stylesheet and script lists OUT of that page, so
   a page with two stylesheets or a different script set needs no special
   case here. */
const fs = require('fs');
const path = require('path');
const R = __dirname;
const OUT = path.join(R, 'dist');
fs.mkdirSync(OUT, { recursive: true });   /* dist/ is gitignored, so a fresh
                                             clone starts without it */

const read = p => fs.readFileSync(path.join(R, p), 'utf8');

const PAGES = [
  { src: 'index.html', out: 'home', title: 'Highway 19 Media' },
  { src: 'faq.html',   out: 'faq',  title: 'Highway 19 Q&A' },
];

function build(page) {
let html = read(page.src);

/* Same reasoning as the script list below: read the stylesheets out of the
   page in load order rather than naming them here. faq.html loads two. */
const sheets = [...html.matchAll(/<link rel="stylesheet" href="(assets\/css\/[^"]+)">/gi)]
  .map(m => m[1]);
if (!sheets.length) throw new Error('no local stylesheets found in ' + page.src);
sheets.forEach(f => { if (!fs.existsSync(path.join(R, f))) throw new Error('missing stylesheet: ' + f); });
let css = sheets.map(f => '/* ==== ' + f + ' ==== */\n' + read(f)).join('\n');
/* Read the script list OUT of the page, in the order the page loads them,
   rather than keeping a second copy here. A hardcoded list silently drops any
   file added to index.html later: assets/js/scene.js was added, worked on the
   dev server, and was simply absent from every published build until this was
   found. A bundler that can omit a file without failing is worse than none. */
const scripts = [...html.matchAll(/<script src="(assets\/js\/[^"]+)"><\/script>/gi)]
  .map(m => m[1]);
if (!scripts.length) throw new Error('no local scripts found in ' + page.src);
scripts.forEach(f => { if (!fs.existsSync(path.join(R, f))) throw new Error('missing script: ' + f); });
let js = scripts.map(f => '/* ==== ' + f + ' ==== */\n' + read(f)).join('\n');
console.log(page.src + ' — scripts bundled: ' + scripts.length + '  (' + scripts.map(f => f.split('/').pop()).join(', ') + ')');

if (/<\/script>/i.test(js)) throw new Error('script payload contains </script>');

/* An unbalanced <div> does not throw either — it silently reparents whole
   sections, which is how the hero copy ended up outside its own grid. */
(() => {
  const bare = html.replace(/<!--[\s\S]*?-->/g, '');
  const open = (bare.match(/<div\b/g) || []).length;
  const close = (bare.match(/<\/div>/g) || []).length;
  if (open !== close) throw new Error(`HTML: ${open} <div> vs ${close} </div>`);
})();

/* A stray brace in the stylesheet does not throw — it silently swallows every
   rule after it, or leaks a media query's contents to all widths. Cheap to
   check, and it has already bitten once. */
(() => {
  const bare = css.replace(/\/\*[\s\S]*?\*\//g, '');
  let d = 0;
  for (const ch of bare) {
    if (ch === '{') d++;
    else if (ch === '}' && --d < 0) throw new Error('CSS: unbalanced brace (extra closing)');
  }
  if (d !== 0) throw new Error(`CSS: ${d} unclosed block(s)`);
  const opens = (bare.match(/@media[^{]*\{/g) || []).length;
  if (opens < 5) throw new Error(`CSS: only ${opens} media queries survived — expected the full set`);
})();

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

/* The same for anything the stylesheet or the engine reaches for. A url() in
   the CSS and a sprite path inside road.js are references too, and the hosted
   build has no files to fetch — his rock, his scrub and his trees were the
   first three to arrive as nothing at all. */
const dataURI = rel => {
  const file = path.join(R, rel.replace(/^\.\.\//, 'assets/'));
  if (!fs.existsSync(file)) throw new Error('missing asset referenced by ' + page.src + ': ' + rel);
  inlined++;
  return 'data:' + MIME[path.extname(rel).toLowerCase()] + ';base64,' +
         fs.readFileSync(file).toString('base64');
};
css = css.replace(/url\((["']?)((?!data:|https?:)[^"')]+\.(?:png|jpe?g|gif|webp|svg))\1\)/gi,
                  (m, q, rel) => 'url("' + dataURI(rel) + '")');
js = js.replace(/(["'])(assets\/[^"']+\.(?:png|jpe?g|gif|webp|svg))\1/gi,
                (m, q, rel) => q + dataURI(rel) + q);

/* A url() inside an HTML style attribute is a reference too — the bands of
   his artwork that tile are laid that way — and it was going out as a path
   to a file the hosted build does not carry. */
html = html.replace(/url\((["']?)((?!data:|https?:)[^"')]+\.(?:png|jpe?g|gif|webp|svg))\1\)/gi,
                    (m, q, rel) => 'url("' + dataURI(rel) + '")');

html = html.replace(/src="((?!data:|https?:)[^"]+\.(?:png|jpe?g|gif|webp|svg))"/gi, (m, rel) => {
  const file = path.join(R, rel);
  if (!fs.existsSync(file)) throw new Error('missing image referenced by ' + page.src + ': ' + rel);
  const mime = MIME[path.extname(rel).toLowerCase()];
  inlined++;
  return 'src="data:' + mime + ';base64,' + fs.readFileSync(file).toString('base64') + '"';
});

/* Unmask immediately, while the masked form is still confined to the image
   pass above. The restore used to sit at the very bottom of the file, after
   both outputs were written — so every published build shipped a NUL
   placeholder where each HTML comment used to be. Invisible in a browser,
   which is why it survived; not valid UTF-8 text, which is how it was found. */
html = html.replace(/\u0000C(\d+)\u0000/g, (m, i) => comments[+i]);
if (html.includes('\u0000')) throw new Error('NUL survived the comment unmask');

let first = true;
html = html
  .replace(/\n?\s*<link rel="stylesheet"[^>]*>/gi, () => {
    if (!first) return '';                 /* the rest are already in `css` */
    first = false;
    return '\n<style>\n' + css + '\n</style>';
  })
  .replace(/\n?\s*<script src="assets\/js\/[^"]*"><\/script>/gi, '')
  .replace(/(\n?<\/body>)/i, '\n<script>\n' + js + '\n</script>\n$1');

fs.writeFileSync(path.join(OUT, 'highway19-' + page.out + '.html'), html);

/* Artifact build: the host wraps the file in its own doctype/head/body, so
   ship only what belongs inside the body — plus the title and styles, which
   it hoists. Charset, viewport and the favicon come from the host. */
const body = html
  .slice(html.indexOf('<body>') + 6, html.lastIndexOf('</body>'))
  .trim();
/* The pages carry long SEO titles; a hosted preview wants the short name,
   which is what shows in the browser tab and the artifact gallery. */
const style = (html.match(/<style>[\s\S]*?<\/style>/i) || [''])[0];

fs.writeFileSync(path.join(OUT, 'highway19-' + page.out + '-artifact.html'),
  '<title>' + page.title.trim() + '</title>\n' + style + '\n' + body + '\n');

console.log(page.src + ' — images inlined:', inlined);
for (const f of ['dist/highway19-' + page.out + '.html',
                 'dist/highway19-' + page.out + '-artifact.html']) {
  console.log(' ', f, (fs.statSync(path.join(R, f)).size / 1024).toFixed(0) + ' KB');
}
}

PAGES.forEach(build);
