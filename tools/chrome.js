/* ============================================================================
 * THE CHROME - the header and the footer, and the only place either is built.
 * ----------------------------------------------------------------------------
 * Every page on this site wears the same bar and the same footer. Before this
 * file there were THREE copies of the assembly - one in make_page.js for the
 * home page, two in build_site.js for the holding page and the legal pages -
 * and three copies of a thing is three chances for it to drift. A nav item
 * added to one, a stylesheet forgotten on another, and pages that are meant to
 * be the same site stop being it.
 *
 * So: one module, and anything that builds a page asks it. A new page needs
 * three things and nothing else -
 *
 *     const C = require('./chrome');
 *     C.head(root)     the <link>s and <script>s the chrome needs, as a string
 *     C.header(root)   the bar
 *     C.footer()       the footer
 *
 * where `root` is how that page reaches the home page: '' if it IS the home
 * page, '/' from anywhere else. That one argument is the only thing that
 * differs between pages, and it is why a nav item resolves to #services at
 * home and /#services from a subfolder.
 *
 * AND THE SIZES COME WITH IT. --hh, the bar's height, is a clamp on the
 * viewport width in header.css; the footer's measure is a clamp in
 * section-09.css. Both are in ASSETS below, so a page that asks for the chrome
 * cannot get the markup without the rules that scale it - which was the other
 * way these drifted: the right header at the wrong size.
 *
 * build_site.js checks all of this after the fact - see verifyChrome() - so a
 * page that skips a piece fails the build rather than shipping different.
 * ========================================================================= */
const fs = require('fs');
const path = require('path');
const DIR = path.join(__dirname, '..', 'build', 'v2');
const rd = f => fs.readFileSync(path.join(DIR, f), 'utf8');

/* every stylesheet and script the bar and the footer need, in load order.
 * A page may load more; it may not load fewer. */
const ASSETS = {
  css: ['section-fonts.css', 'header.css', 'section-09.css', 'consent.css'],
  js:  ['header.js', 'consent.js'],
};

/* the phone glyph is inlined because currentColor is the whole point of it and
 * an <img> cannot see the page */
const GLYPH = () =>
  fs.readFileSync(path.join(__dirname, '..', 'assets', 'v2', 'header',
                            'phone-glyph.svg'), 'utf8')
    .replace(/<\?xml[^>]*\?>|<!--[\s\S]*?-->/g, '')
    .replace(/\s+/g, ' ').trim()
    .replace('<svg ', '<svg class="hdr-cta-g" ');

/* the day/night switch, which only the home page has a night to switch to */
const SWITCH =
  '    <button class="mode-switch" type="button" aria-label="Switch to night">\n' +
  '      <img class="is-day" src="../../assets/v2/header/sun.svg" alt="">\n' +
  '      <img class="is-night" src="../../assets/v2/header/moon.svg" alt="">\n' +
  '    </button>\n';

function header(root, opts) {
  const o = opts || {};
  return rd('header.html')
    /* the file's own comment NAMES the tokens, so it goes before any of them is
       replaced - otherwise the first {{SWITCH}} found is the one being
       described, and the substitution is stripped out with it */
    .replace(/^<!--[\s\S]*?-->\n/, '')
    .replace('{{PHONE-GLYPH}}', GLYPH)
    .replace('{{SWITCH}}', o.modeSwitch ? SWITCH : '')
    .replace(/\{\{ROOT\}\}/g, root)
    .replace('{{LOGO}}', o.logo !== undefined ? o.logo : (root || '#top'));
}

const footer = () =>
  rd('section-09.html').match(/<(section|footer)\b[\s\S]*<\/\1>/)[0];

/* the head fragment, with hrefs written for where the page will live */
function head(prefix) {
  const p = prefix === undefined ? '' : prefix;
  return ASSETS.css.map(f => '<link rel="stylesheet" href="' + p + f + '">').join('\n');
}
const scripts = prefix => {
  const p = prefix === undefined ? '' : prefix;
  return ASSETS.js.map(f => '<script src="' + p + f + '" defer></script>').join('\n');
};

module.exports = { header, footer, head, scripts, ASSETS, SWITCH };
