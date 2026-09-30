/* ============================================================================
 * THE SERVICE PAGES' WORDS - one entry per page, rendered into
 * build/v2/service.html by tools/build_site.js.
 * ----------------------------------------------------------------------------
 * FACTS COME FROM HIS OWN COPY. The lead is his card text from the home page's
 * services section; every price, time and promise is one his Q&A page already
 * makes; the questions are the Q&A's own, looked up by their exact wording and
 * answered with the Q&A's own text at build time - so editing an answer there
 * changes it here, and the two pages can never disagree.
 *
 * `faq` names questions exactly as the Q&A page asks them. A name that is not
 * found fails the build rather than shipping a page with a missing answer.
 * ========================================================================= */
'use strict';

const AREA =
  'We are based in Spring Hill and work with businesses across Hernando County - ' +
  'Spring Hill, Brooksville and Weeki Wachee - and down the US-19 corridor through ' +
  'Hudson, Port Richey, New Port Richey and Holiday into Pinellas and the wider ' +
  'Tampa Bay area. We can meet face-to-face, visit your business, grab a coffee or ' +
  'meet by video, and you keep one local contact from start to finish.';

module.exports = [
  {
    slug: 'website-design',
    label: 'Website Design',
    color: '#009245',
    icon: 'icon-webdesign.webp',
    title: 'Website Design in Spring Hill, FL | Highway 19 Media',
    desc: 'Custom websites and landing pages for small businesses in Spring Hill, Brooksville and ' +
          'Tampa Bay. Landing pages from $699, full websites from about $2,000.',
    eyebrow: 'Website design &middot; Spring Hill &amp; Tampa Bay',
    h1: 'Website Design in Spring Hill, FL',
    lead: 'Your business, open 24/7. Custom websites, landing pages, e-commerce and ongoing ' +
          'updates for small businesses in Spring Hill, Brooksville and across Tampa Bay - built to ' +
          'make you look professional, get found, and turn visitors into customers.',
    cta: 'Let&rsquo;s build your site',
    ctaH: 'Ready to get online?',
    serviceType: 'Website design',
    offers: [['Landing page', 699], ['Full website', 2000]],
    incH: 'What we build',
    included: [
      ['Landing pages', 'A professional place online where customers can see what you do, contact you and find your social media. It starts at $699 and can be live in about a week.'],
      ['Full websites', 'Multi-page service and portfolio sites with custom design, strategy and the infrastructure set up for you - starting around $2,000.'],
      ['E-commerce', 'Online stores and product catalogues on Shopify, Magento and other platforms, for businesses ready to sell online.'],
      ['Found on Google and by AI', 'SEO and AEO foundations built in - the structure search engines and AI assistants read to understand what you do and where.'],
      ['The right platform', 'WordPress, Webflow, Shopify, Magento and more - custom, template-based or AI-assisted, connected to your CRM and business systems.'],
      ['Ongoing updates', 'Keep it current after launch, from new pages to fresh photos and offers, without chasing a developer.']
    ],
    facts: [
      ['From $699', 'Landing pages, live in about a week'],
      ['From about $2,000', 'Full websites, typically a few weeks to a month'],
      ['It&rsquo;s yours', 'Built on your own domain, control is returned to you once the project and warranty period are complete']
    ],
    steps: [
      ['Show us where you are', 'Send your current website, Facebook page, logo, photos - whatever you have. If you are starting from scratch, we can develop virtually everything.'],
      ['Map the route', 'We meet by video, face-to-face or over coffee and talk about your business, your goals and your budget.'],
      ['Design and build', 'We design the site around your customers, then build it on the platform that fits where your business is going.'],
      ['Launch and keep moving', 'Your site goes live with its SEO foundations in place, and we can keep it updated as your business grows.']
    ],
    faq: [
      'I’m a small business. Do I really need a website?',
      'When should I get my own website instead?',
      'How much does a full website cost?',
      'What platforms can you build on?',
      'How long does a website take?',
      'What do I need to provide?',
      'Who owns my website when it’s finished?'
    ]
  },
  {
    slug: 'social-media-marketing',
    label: 'Social Media &amp; Paid Ads',
    color: '#f7931e',
    icon: 'icon-social.webp',
    title: 'Social Media & Paid Ads in Spring Hill, FL | Highway 19 Media',
    desc: 'Social media management, content, Google Ads and Meta Ads for small businesses in ' +
          'Spring Hill, Brooksville and Tampa Bay - aimed at the right local customers.',
    eyebrow: 'Social media &amp; paid ads &middot; Spring Hill &amp; Tampa Bay',
    h1: 'Social Media Marketing &amp; Paid Ads in Spring Hill, FL',
    lead: 'Put some traffic behind it. Content, social media management, Google Ads, Meta Ads, ' +
          'targeting and campaign management - built to put your business in front of the right ' +
          'local customers in Spring Hill, Brooksville and across Tampa Bay.',
    cta: 'Let&rsquo;s build your campaign',
    ctaH: 'Ready for more traffic?',
    serviceType: 'Social media marketing and paid advertising',
    incH: 'What we run',
    included: [
      ['Social media management', 'We create content, design posts, organize messaging and manage your ongoing social media. Stay heavily involved, or let us handle more of it.'],
      ['Social video', 'We visit your business, capture what you do, record tips and turn one visit into many pieces of content - so you stay visible instead of going quiet.'],
      ['Google Ads', 'Pay-per-click campaigns that reach people when they search for what you sell, built from scratch or from what you already have.'],
      ['Meta Ads', 'Paid Facebook and Instagram campaigns aimed at the local customers most likely to need you.'],
      ['Audience first', 'Before anything launches we look at who you are trying to reach, your offer, your existing traffic and tracking, and what has run before.'],
      ['Refined as it runs', 'Traffic, engagement and inquiries show early movement; months of consistent marketing give us the data to keep improving the strategy.']
    ],
    facts: [
      ['Audience first', 'We start with who you need to reach, not with a budget to spend'],
      ['Ad spend is separate', 'Your ad spend goes to the platforms; our fee covers strategy, management and creative'],
      ['Any budget', 'Tell us what you are comfortable with and we will tell you what it can realistically do']
    ],
    steps: [
      ['Audience', 'Who is your customer, and where do they spend their time? Advertising to the wrong people is knocking on doors where nobody needs what you sell.'],
      ['Offer', 'What are we putting in front of them, and why would they act on it now?'],
      ['Tracking and data', 'We look at your existing traffic, tracking, past campaigns and customer data, so we can measure what works.'],
      ['Launch and refine', 'For a new business an awareness campaign often comes first, to learn who responds - then we build more targeted campaigns and retargeting from what it teaches us.']
    ],
    faq: [
      'Can you manage my social media?',
      'Can you create ongoing social media videos?',
      'Can you run my paid advertising?',
      'What do you look at before launching an advertising campaign?',
      'Should a new business start with awareness advertising?',
      'How quickly will advertising produce results?',
      'Is your management fee included in my advertising budget?',
      'What if I only have $500 for marketing?'
    ]
  },
  {
    slug: 'branding-and-print',
    label: 'Print &amp; Branding',
    color: '#d4145a',
    icon: 'icon-print.webp',
    title: 'Branding, Design & Print in Spring Hill, FL | Highway 19 Media',
    desc: 'Logos, brand identity, graphic design, business cards, signs, vehicle graphics and ' +
          'promotional products for businesses in Spring Hill, Brooksville and Tampa Bay.',
    eyebrow: 'Branding, design &amp; print &middot; Spring Hill &amp; Tampa Bay',
    h1: 'Branding, Graphic Design &amp; Print in Spring Hill, FL',
    lead: 'Look the part. Everywhere. Logos, business cards, flyers, catalogs, signage, vehicle ' +
          'graphics, branded merchandise and more - one consistent look wherever customers find you ' +
          'in Spring Hill, Brooksville and across Tampa Bay.',
    cta: 'Let&rsquo;s build your brand',
    ctaH: 'Does your brand look ready for the road?',
    serviceType: 'Branding, graphic design and print',
    incH: 'What we make',
    included: [
      ['Logo and brand identity', 'Your logo, colours, typography and visual language, with the professional vector files to reproduce them anywhere.'],
      ['Graphic design', 'Social posts, ads, flyers and marketing materials - as a single project, hourly, or on an ongoing design retainer.'],
      ['Print', 'Business cards, flyers, catalogs, posters, letterheads and every other printed piece your business hands out.'],
      ['Signs and vehicle graphics', 'Signage and vehicle graphics that carry the same look as your website and your social media.'],
      ['Promotional products', 'Shirts, mugs, pens, notebooks and more. We research vendors, compare pricing, prepare the artwork and manage production.'],
      ['Fully custom products', 'We work directly with manufacturers, including overseas, for custom merchandise, plush products and packaging beyond any catalogue.']
    ],
    facts: [
      ['Files you keep', 'Production-ready vector files for your brand, ready for any printer or sign shop'],
      ['One creative direction', 'The same look across your website, video, print and social media'],
      ['We handle suppliers', 'Sourcing, pricing, artwork and production - no calling printers yourself']
    ],
    steps: [
      ['Show us what you have', 'Your current logo, cards, signs and marketing materials - or nothing at all.'],
      ['Set the direction', 'We agree the look: colours, type and the feel you want customers to remember.'],
      ['Design the pieces', 'Your brand files first, then each item you need, all in the same visual language.'],
      ['Produce and deliver', 'We prepare the artwork and manage printing and production, so it arrives ready to use.']
    ],
    faq: [
      'Can you create or refresh my brand?',
      'Do you offer graphic design without a complete branding project?',
      'Why use one agency for all of it?',
      'What can you print?',
      'Can you help me find promotional products?',
      'Can you manufacture completely custom promotional products?'
    ]
  }
];

module.exports.AREA = AREA;
