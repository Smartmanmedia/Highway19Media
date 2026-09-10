#!/usr/bin/env node
/* RE-ENCODE A WEBP AT A LOWER QUALITY, SAME PIXELS.
 *
 * Every one of his scene layers is inlined as a data URI, and base64 adds a
 * third on top of whatever the file weighs - so a heavy layer is heavy twice.
 * This decodes a webp and writes it back at the quality given, at exactly the
 * dimensions it already has: the picture is the same size on screen, it just
 * carries fewer bytes to get there.
 *
 *   node tools/reweigh.js <quality> <file> [file...]        (dry run)
 *   node tools/reweigh.js -w <quality> <file> [file...]     (write)
 */
const fs = require('fs'), path = require('path');
const { chromium } = require('/home/user/storyboard-app/node_modules/playwright');
const args = process.argv.slice(2);
const write = args[0] === '-w'; if (write) args.shift();
const q = parseFloat(args.shift());
(async () => {
  const br = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const p = await br.newPage();
  await p.goto('about:blank');
  let was = 0, now = 0;
  for (const f of args) {
    const src = fs.readFileSync(f);
    const out = await p.evaluate(async ({ d, q }) => {
      const i = new Image(); i.src = 'data:image/webp;base64,' + d; await i.decode();
      const c = document.createElement('canvas'); c.width = i.width; c.height = i.height;
      c.getContext('2d').drawImage(i, 0, 0);
      return { b: c.toDataURL('image/webp', q).split(',')[1], w: i.width, h: i.height };
    }, { d: src.toString('base64'), q });
    const buf = Buffer.from(out.b, 'base64');
    was += src.length; now += buf.length;
    console.log(('  ' + path.basename(f)).padEnd(34) + out.w + 'x' + out.h + '  ' +
      (src.length / 1024).toFixed(1) + 'K -> ' + (buf.length / 1024).toFixed(1) + 'K  (' +
      Math.round(100 - 100 * buf.length / src.length) + '% off)');
    if (write) fs.writeFileSync(f, buf);
  }
  console.log('  total  ' + (was / 1024).toFixed(0) + 'K -> ' + (now / 1024).toFixed(0) +
    'K   saves ' + ((was - now) / 1024).toFixed(0) + 'K raw, ' +
    ((was - now) * 4 / 3 / 1024).toFixed(0) + 'K in the page' + (write ? '' : '   (DRY RUN)'));
  await br.close();
})();
