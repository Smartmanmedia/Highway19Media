#!/usr/bin/env node
/* THE CHROME AS TEXT, for a builder that is not Node.
 *
 * tools/qa/build.py writes the Q&A page in Python. It asks for the header and
 * the footer here rather than assembling a second copy of either, which is the
 * one thing tools/chrome.js exists to prevent - and build_site.js's chrome
 * check holds the result against every other page on the site.
 *
 *   node tools/chrome-emit.js head|scripts|header|footer|form|assets [root]
 *
 * Paths come out as the repository has them ('../../assets/...'); the caller
 * rewrites those for wherever its page will live, the same way page.html is
 * rewritten.
 */
const C = require('./chrome');
const fs = require('fs'), path = require('path');
const what = process.argv[2];
const root = process.argv[3] === undefined ? '/' : process.argv[3];
const OUT = {
  head:    () => C.head('build/v2/'),
  scripts: () => C.scripts('build/v2/'),
  /* no day/night switch: this page has no night to switch to, and the lockup
     goes to the home page rather than to the top of this one */
  header:  () => C.header(root, { modeSwitch: false, logo: '/' }),
  /* the footer carries {{ROOT}} too - build_site.js substitutes it after
     dropping the footer into its own pages, and a page assembled elsewhere
     has to do the same or it ships the token */
  footer:  () => C.footer().replace(/\{\{ROOT\}\}/g, root),
  form:    () => fs.readFileSync(path.join(__dirname, '..', 'build', 'v2',
                                           'form-card.html'), 'utf8'),
  assets:  () => JSON.stringify(C.ASSETS),
};
if (!OUT[what]) { console.error('head|scripts|header|footer|form|assets'); process.exit(1); }
process.stdout.write(OUT[what]());
