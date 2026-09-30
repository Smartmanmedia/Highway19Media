/* ============================================================================
 * THE BUSINESS, ONCE - who Highway 19 Media is, for search engines and AI.
 * ----------------------------------------------------------------------------
 * Every page used to describe the business in its own words: the home page
 * put it in Tampa, the Q&A called it an Organization with another id, the
 * contact and video pages said only "Tampa Bay". Google and the AI answer
 * engines read that data to decide where a business is and what it does, and
 * conflicting answers are the surest way to be believed about none of it.
 *
 * So this is the single record, and build_site.js puts it on every page -
 * replacing whatever a page carried - with the same @id, so each page's
 * WebPage / Service / FAQ nodes point at the one business.
 *
 * FACTS ONLY. Everything below is already said on the site (the Q&A, the
 * privacy page, the footer). No street address: it is a home-based service-
 * area business with no public premises (see /privacy/), so the address is
 * the town and the service area is listed. Add a phone number, opening hours
 * or a Google Business Profile URL here when they exist - one edit, every page.
 * ========================================================================= */
'use strict';
const SITE = 'https://highway19media.com';
const ID = SITE + '/#business';

const city = (name, county) => ({
  '@type': 'City', name,
  containedInPlace: { '@type': 'AdministrativeArea', name: county + ', Florida' }
});

const BUSINESS = {
  '@type': 'ProfessionalService',
  '@id': ID,
  name: 'Highway 19 Media',
  alternateName: ['Highway19 Media', 'HWY 19 Media'],
  description:
    'Highway 19 Media is a local marketing agency in Spring Hill, Florida. We design websites and ' +
    'landing pages, produce video, run social media and paid advertising, and create branding, ' +
    'graphic design and print for small businesses in Spring Hill, Brooksville and Hernando County, ' +
    'along the US-19 corridor and across Tampa Bay - one local point of contact for all of it.',
  slogan: 'Creative Marketing for Tampa Bay Businesses',
  url: SITE + '/',
  logo: SITE + '/assets/v2/meta/icon-180.png',
  image: SITE + '/assets/v2/meta/og.jpg',
  email: 'highway19media@gmail.com',
  priceRange: '$$',
  address: { '@type': 'PostalAddress', addressLocality: 'Spring Hill', addressRegion: 'FL',
             addressCountry: 'US' },
  geo: { '@type': 'GeoCoordinates', latitude: 28.4769, longitude: -82.5383 },
  areaServed: [
    city('Spring Hill', 'Hernando County'),
    city('Brooksville', 'Hernando County'),
    city('Weeki Wachee', 'Hernando County'),
    city('Hudson', 'Pasco County'),
    city('Port Richey', 'Pasco County'),
    city('New Port Richey', 'Pasco County'),
    city('Holiday', 'Pasco County'),
    city('Tarpon Springs', 'Pinellas County'),
    city('Homosassa', 'Citrus County'),
    city('Crystal River', 'Citrus County'),
    { '@type': 'AdministrativeArea', name: 'Hernando County, Florida' },
    { '@type': 'AdministrativeArea', name: 'Pasco County, Florida' },
    { '@type': 'AdministrativeArea', name: 'Tampa Bay Area, Florida' }
  ],
  knowsAbout: [
    'Small business marketing', 'Website design', 'Landing pages', 'Search engine optimization',
    'Video production', 'Commercial video', 'Podcast production', 'Social media marketing',
    'Social media management', 'Paid advertising', 'Pay-per-click advertising', 'Branding',
    'Logo design', 'Graphic design', 'Print design', 'Signage', 'Promotional products'
  ],
  hasOfferCatalog: {
    '@type': 'OfferCatalog', name: 'Marketing services',
    itemListElement: [
      ['Website Design', 'Custom websites and landing pages for small businesses, built on WordPress, Webflow, Shopify and other platforms, with SEO foundations.'],
      ['Video Production', 'Commercials, podcasts, interviews, testimonials, training and social video, on location or in our Spring Hill studio.', SITE + '/video-production/'],
      ['Social Media Marketing', 'Content, posting and management of your social media, from one post a week to a full calendar.'],
      ['Paid Advertising', 'Pay-per-click and paid social campaigns built around your audience, offer and budget.'],
      ['Branding & Graphic Design', 'Logos, brand identity, colours, type and production-ready files.'],
      ['Print & Promotional Products', 'Business cards, signs, vehicle graphics, shirts and custom promotional products.']
    ].map(([name, description, url]) => ({
      '@type': 'Offer',
      itemOffered: Object.assign({ '@type': 'Service', name, description, provider: { '@id': ID },
                                   areaServed: { '@type': 'AdministrativeArea', name: 'Tampa Bay Area, Florida' } },
                                 url ? { url } : {})
    }))
  },
  contactPoint: {
    '@type': 'ContactPoint', contactType: 'sales', email: 'highway19media@gmail.com',
    url: SITE + '/contact/', areaServed: 'US', availableLanguage: ['English']
  },
  parentOrganization: { '@type': 'Organization', name: 'Smart Man Media' },
  sameAs: ['https://www.facebook.com/Highway19Media']
};

const WEBSITE = {
  '@type': 'WebSite', '@id': SITE + '/#website', url: SITE + '/', name: 'Highway 19 Media',
  inLanguage: 'en-US', publisher: { '@id': ID }
};

/* ids other pages used for the same two things, and what they are now */
const ALIAS = {
  [SITE + '/#org']: ID, [SITE + '/#organization']: ID, [SITE + '/#business']: ID,
  [SITE + '/#site']: WEBSITE['@id']
};
const OURS = /^highway\s*19\s*media$/i;

/* Every ld+json block on a page: the page's own business / website nodes are
   dropped, every reference to them points at the one record, and the record
   and the website are added once. Anything else a page says - its WebPage,
   Service, FAQPage, BreadcrumbList - is left exactly as it was. */
function apply(html) {
  let added = false;
  return html.replace(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g, (m, body) => {
    let data;
    try { data = JSON.parse(body); } catch (e) { return m; }
    const nodes = Array.isArray(data['@graph']) ? data['@graph'] : [data];
    const ctx = data['@context'] || 'https://schema.org';
    const isUs = n => n && typeof n === 'object' && (
      ALIAS[n['@id']] === ID ||
      (/Organization|ProfessionalService|LocalBusiness/.test([].concat(n['@type'] || []).join(' ')) &&
       OURS.test(n.name || '') && !n.parentOrganization?.name?.match(OURS)));
    const isSite = n => n && n['@type'] === 'WebSite' && (ALIAS[n['@id']] || OURS.test(n.name || ''));
    const fix = v => {
      if (Array.isArray(v)) return v.map(fix);
      if (!v || typeof v !== 'object') return v;
      if (v['@id'] && ALIAS[v['@id']] && Object.keys(v).length === 1) return { '@id': ALIAS[v['@id']] };
      if (isUs(v)) return { '@id': ID };
      const o = {};
      for (const k in v) o[k] = fix(v[k]);
      return o;
    };
    const kept = nodes.filter(n => !isUs(n) && !isSite(n)).map(n => { const o = {}; for (const k in n) if (k !== '@context') o[k] = fix(n[k]); return o; });
    const graph = added ? kept : [BUSINESS, WEBSITE, ...kept];
    added = true;
    return '<script type="application/ld+json">' +
      JSON.stringify({ '@context': ctx, '@graph': graph }) + '</script>';
  });
}

module.exports = { BUSINESS, WEBSITE, ID, apply };
