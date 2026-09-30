#!/usr/bin/env node
/* THE PICTURES A CARD NEEDS, CUT FROM ITS OWN SOURCES.
 *
 *   SHARP=/path/to/node_modules/sharp node tools/card/make_art.js highway19
 *
 * A dev tool, like the rest of tools/: its outputs are committed to
 * cards/<slug>/art/, so the host's build never needs sharp or anything else
 * installed - tools/card/build.js only copies and templates.
 *
 * What it reads is cards/<slug>/card.json -> "art":
 *   hero   { src, crop:[left,top,width,height] }   the identity photo
 *   icon   { src, bg, scale }                      the home-screen icon
 * and what it writes is every size a phone asks for, named by what it is:
 *   hero-720.webp hero-1080.webp     the card's top photo, two densities
 *   icon-192.png icon-512.png        Android / Chrome install
 *   icon-maskable-512.png            Android adaptive icon (safe zone 80%)
 *   apple-touch-icon.png             iOS home screen - 180, no transparency
 *   icon-32.png                      the tab
 *   logo-160.webp                    the mark on the card itself
 *   vcard-photo.jpg                  the contact photo, small - it is base64
 *                                    inside the .vcf, so every KB counts twice
 */
const fs = require('fs'), path = require('path');
const sharp = require(process.env.SHARP || 'sharp');
const ROOT = path.join(__dirname, '..', '..');

const slug = process.argv[2];
if (!slug) { console.error('usage: make_art.js <card slug>'); process.exit(1); }
const dir = path.join(ROOT, 'cards', slug);
const card = JSON.parse(fs.readFileSync(path.join(dir, 'card.json'), 'utf8'));
const art = card.art || {};
const OUT = path.join(dir, 'art');
fs.mkdirSync(OUT, { recursive: true });
const src = p => path.join(ROOT, p);

(async () => {
  if (art.hero) {
    const [left, top, width, height] = art.hero.crop;
    for (const w of [720, 1080])
      await sharp(src(art.hero.src)).extract({ left, top, width, height })
        .resize(w).webp({ quality: 78 }).toFile(path.join(OUT, `hero-${w}.webp`));
  }

  if (art.icon) {
    const bg = art.icon.bg;
    /* the mark on a square of the card's own background, at `scale` of the
       side - so the icon among his other apps is the card, not a sticker */
    const tile = async (side, scale, file, fmt) => {
      const mark = await sharp(src(art.icon.src)).resize(Math.round(side * scale)).png().toBuffer();
      let img = sharp({ create: { width: side, height: side, channels: 4, background: bg } })
        .composite([{ input: mark, gravity: 'centre' }]);
      img = fmt === 'jpg' ? img.flatten({ background: bg }).jpeg({ quality: 82 }) : img.png();
      await img.toFile(path.join(OUT, file));
    };
    const s = art.icon.scale || 0.72;
    await tile(192, s, 'icon-192.png');
    await tile(512, s, 'icon-512.png');
    await tile(512, Math.min(s, 0.58), 'icon-maskable-512.png');   /* inside the 80% circle */
    await tile(180, s, 'apple-touch-icon.png');
    await tile(32, 0.9, 'icon-32.png');
    await tile(256, 0.74, 'vcard-photo.jpg', 'jpg');
    await sharp(src(art.icon.src)).resize(160).webp({ quality: 88 }).toFile(path.join(OUT, 'logo-160.webp'));
  }

  for (const f of fs.readdirSync(OUT).sort())
    console.log('  ' + f.padEnd(24) + Math.round(fs.statSync(path.join(OUT, f)).size / 1024) + ' KB');
})();
