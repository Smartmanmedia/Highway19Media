#!/usr/bin/env node
/* page.html was a hand-copy of both sections, so an edit to a section could
 * land in one file and not the other — which is exactly what happened to the
 * road join. It is now generated: the sections are the source, this is output.
 *
 *   node tools/make_page.js            rebuilds build/v2/page.html
 */
const fs = require('fs'), path = require('path');
const DIR = path.join(__dirname, '..', 'build', 'v2');

const files = fs.readdirSync(DIR).filter(f => /^section-\d\d\.html$/.test(f)).sort();

/* THE THREE THINGS THAT ARE NOT THE DESIGN, kept in one place because each of
 * them is repeated in four tags below and a half-changed one is worse than
 * none. SITE has no trailing slash - every URL built from it adds its own. */
const SITE  = 'https://highway19media.com';
const SOON  = '/coming-soon/';          /* everything not built yet lands here */
const TITLE = 'Highway 19 Media | Creative Marketing for Tampa Bay Businesses';
const DESC  = 'Websites, video, print, branding, social media and paid ads for '
            + 'Tampa Bay businesses. One team for the whole road \u2014 and an honest '
            + 'read on what you have now, back within 24 hours.';
/* STAGING IS THE SAME BUILD, TOLD NOT TO BE FOUND. A test site that Google
 * indexes competes with the real one for his own name.
 *   node tools/make_page.js --staging   */
const STAGING = process.argv.includes('--staging');
/* HIS HEADER, from assets/brand/Header.svg, as markup rather than as the
 * picture he drew it as. Links have to be links, the type has to reflow on a
 * phone, and his day/night switch lives in it now instead of floating over the
 * top right corner of whatever section happens to be under it. Every size is a
 * share of the bar's own height - see header.css. */
const HEADER =
  '<header class="hdr">\n' +
  '  <div class="hdr-in">\n' +
  '    <button class="mode-switch" type="button" aria-label="Switch to night">\n' +
  '      <img class="to-night" src="../../assets/v2/header/moon.svg" alt="">\n' +
  '      <img class="to-day" src="../../assets/v2/header/sun.svg" alt="">\n' +
  '    </button>\n' +
  '    <a class="hdr-logo" href="#top">\n' +
  '      <span class="hdr-lock">HIGHWAY<i>19</i>MEDIA</span>\n' +
  '      <span class="hdr-rule"></span>\n' +
  '      <span class="hdr-tag">Creative Marketing for Tampa Bay Businesses</span>\n' +
  '    </a>\n' +
  '    <img class="hdr-shield" src="../../assets/v2/ui-shield.webp" alt="Highway 19 Media">\n' +
  '    <nav class="hdr-nav">\n' +
  '      <a href="#services">Services</a>\n' +
  '      <a href="#roadmap">The Road Map</a>\n' +
  '      <a href="' + SOON + '">Q&amp;A</a>\n' +
  '    </nav>\n' +
  '    <a class="hdr-cta" href="#contact">\n' +
  '      <img src="../../assets/v2/header/phone.svg" alt="">\n' +
  '      Contact Us\n' +
  '    </a>\n' +
  '  </div>\n' +
  '</header>';

const parts = files.map(f => {

  const html = fs.readFileSync(path.join(DIR, f), 'utf8');
  const m = html.match(/<section\b[\s\S]*<\/section>/);
  if (!m) throw new Error(f + ': no <section> found');
  return m[0];
});

const out =
'<!doctype html>\n<html lang="en">\n<meta charset="utf-8">\n' +
'<meta name="viewport" content="width=device-width,initial-scale=1">\n' +
'<title>' + TITLE + '</title>\n' +
'<meta name="description" content="' + DESC + '">\n' +
'<link rel="canonical" href="' + SITE + '/">\n' +
(STAGING ? '<meta name="robots" content="noindex,nofollow">\n' : '') +
'<meta name="theme-color" content="#00287d">\n' +
/* the tab, the home screen, and the rectangle a shared link shows - all three
   drawn from his shield by tools/make_meta_art.js */
'<link rel="icon" type="image/png" sizes="32x32" href="../../assets/v2/meta/icon-32.png">\n' +
'<link rel="apple-touch-icon" href="../../assets/v2/meta/icon-180.png">\n' +
'<meta property="og:type" content="website">\n' +
'<meta property="og:site_name" content="Highway 19 Media">\n' +
'<meta property="og:title" content="' + TITLE + '">\n' +
'<meta property="og:description" content="' + DESC + '">\n' +
'<meta property="og:url" content="' + SITE + '/">\n' +
'<meta property="og:image" content="' + SITE + '/assets/v2/meta/og.jpg">\n' +
'<meta property="og:image:width" content="1200">\n' +
'<meta property="og:image:height" content="630">\n' +
'<meta name="twitter:card" content="summary_large_image">\n' +
'<meta name="twitter:title" content="' + TITLE + '">\n' +
'<meta name="twitter:description" content="' + DESC + '">\n' +
'<meta name="twitter:image" content="' + SITE + '/assets/v2/meta/og.jpg">\n' +
/* WHO HE IS, IN THE FORM A SEARCH ENGINE READS. Nothing here is a claim the
   page does not already make in words; it is the same facts, machine-legible,
   which is what puts a business in a map card rather than a blue link. No
   telephone - he is not taking calls, and a number nobody answers is worse
   than none. */
'<script type="application/ld+json">' + JSON.stringify({
  '@context':'https://schema.org', '@type':'ProfessionalService',
  name:'Highway 19 Media',
  description:DESC,
  url:SITE + '/',
  image:SITE + '/assets/v2/meta/og.jpg',
  email:'hello@highway19media.com',
  parentOrganization:{ '@type':'Organization', name:'Smart Man Media' },
  areaServed:{ '@type':'AdministrativeArea', name:'Tampa Bay, Florida' },
  address:{ '@type':'PostalAddress', addressRegion:'FL', addressCountry:'US' },
  knowsAbout:['Website Design','Video Production','Print and Branding',
              'Social Media Marketing','Paid Advertising'],
  hasOfferCatalog:{ '@type':'OfferCatalog', name:'Services', itemListElement:
    ['Website Design','Video Production','Print & Branding','Social Media & Paid Ads']
      .map(n => ({ '@type':'Offer', itemOffered:{ '@type':'Service', name:n } })) }
}) + '</script>\n' +
'<!-- GENERATED by tools/make_page.js from ' + files.join(', ') + ' - do not edit. -->\n' +
'<!-- Both families are his own files, self-hosted. No external font requests. -->\n' +
'<link rel="stylesheet" href="section-fonts.css">\n' +
files.map(f => '<link rel="stylesheet" href="' + f.replace('.html','.css') + '">').join('\n') +
'\n<link rel="stylesheet" href="parallax.css">\n'
  + '<link rel="stylesheet" href="night.css">\n' +
'<link rel="stylesheet" href="traffic.css">\n' +
'<link rel="stylesheet" href="sun.css">\n' +
'<link rel="stylesheet" href="header.css">\n' +
/* last, so a phone rule beats every desktop one it has to */
'<link rel="stylesheet" href="mobile.css">\n' +
'<style>body{margin:0;background:#04264f}\n' +
'/* the sections stack with nothing between them: each is a fixed ratio of the\n' +
'   same width, so the join is exact at every screen size */\n' +
'section{display:block}\n' +
'/* A HAIRLINE OF OVERLAP. Two boxes that share an edge land on a half device\n' +
'   pixel at some widths and zooms, and the row where they meet renders lighter\n' +
'   than either - a bright line straight across his ocean on his screen, though\n' +
'   not on mine at the same width. A pixel of overlap means no shared edge to\n' +
'   land badly. Sections that already ride up over the one above keep their own\n' +
'   margin: a class beats this. */\n' +
'section + section{ margin-top:-1px }</style>\n\n' +

  /* THE STORY STARTS AT NIGHT. Inline and first, because a deferred script
     runs after the first paint and the page would flash daylight before it
     got dark. data-dawn is the drive's cue to keep its hands off the mode
     until the sun is up. */
  '<!-- The page opens black and comes up into day - .dawn in night.css, the storyline in mode.js. -->\n' +
  '<script>var r=document.documentElement;r.dataset.mode=\'night\';r.dataset.dawn=\'1\'</script>\n' +
  '<div class="dawn" aria-hidden="true"></div>\n\n' +
  HEADER + '\n\n' +
parts.join('\n\n') +
  ''
  + '\n\n<script src="header.js" defer></script>\n'
  + '\n\n<script src="parallax.js" defer></script>\n'
  /* his vehicles and his road, then the traffic that drives on it - in that
     order, because traffic.js reads both at start-up */
  + '<script src="sprite.js" defer></script>\n'
  + '<script src="shades.js" defer></script>\n'
  + '<script src="paths.js" defer></script>\n'
  + '<script src="traffic.js" defer></script>\n'
  + '<script src="mode.js" defer></script>\n'
  /* the contact form - validation, and the route a lead takes to his inbox */
  + '<script src="form.js" defer></script>\n'
  /* the drive, last: it measures the section it lives in, so everything above
     it has to have laid out first */
  + '<script src="drive.js" defer></script>\n';

fs.writeFileSync(path.join(DIR, 'page.html'), out);
console.log('page.html <- ' + files.join(' + '));
