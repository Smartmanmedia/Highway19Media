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
    /* HIS OWN COPY, as he wrote it for this page (Sept 30, 2026). */
    slug: 'website-design',
    label: 'Website Design',
    color: '#009245',
    icon: 'icon-webdesign.webp',
    title: 'Website Design in Spring Hill, FL | Highway 19 Media',
    desc: 'Landing pages, complete websites and online stores for local businesses in Spring Hill and ' +
          'across Tampa Bay. Landing pages from $699, full websites from about $2,000.',
    eyebrow: 'Website design &middot; Spring Hill &amp; Tampa Bay',
    h1: 'Website Design in Spring Hill, FL',
    tag: 'A better home for your business online.',
    lead: [
      'From a simple landing page to a complete website or online store, we build professional ' +
      'websites for local businesses in Spring Hill and across Tampa Bay.',
      'No one-size-fits-all package. We figure out what your business actually needs, build it on ' +
      'the right platform, and give you a site you&rsquo;re proud to send customers to.'
    ],
    cta: 'Let&rsquo;s Build Your Site',
    ctaH: 'Ready to get online?',
    serviceType: 'Website design',
    offers: [['Landing page', 699], ['Full website', 2000]],
    incH: 'What We Build',
    included: [
      ['Landing Pages', [
        'Sometimes you don&rsquo;t need a giant website.',
        'You need one professional place where people can see what you do, learn about your business, ' +
        'contact you and find everything else online.',
        'Landing pages start at $699 and can typically be live in about a week.']],
      ['Full Websites', [
        'Need more room?',
        'We build complete multi-page websites for service businesses, contractors, professionals, ' +
        'retailers and other local businesses.',
        'Custom design, mobile optimization, forms, integrations and the technical setup are handled for you.',
        'Full websites start around $2,000.']],
      ['E-Commerce', [
        'Ready to sell online?',
        'We build online stores and product catalogs using Shopify, Magento and other platforms, with ' +
        'the products, payments, shipping and integrations your business needs.']],
      ['Get Found on Google &mdash; and Understood by AI', [
        'A good website needs more than good looks.',
        'We build the technical SEO and AEO foundations into the site so search engines and AI-powered ' +
        'tools can better understand your business, your services and the areas you serve.']],
      ['The Right Platform', [
        'WordPress. Webflow. Shopify. Magento. Custom builds. Templates. AI-assisted development.',
        'We&rsquo;re not tied to one platform.',
        'We choose the tools based on what makes sense for your business, budget and what the website ' +
        'actually needs to do.']],
      ['Need Changes Later?', [
        'Your business isn&rsquo;t going to stay exactly the same.',
        'New service? New photos? Seasonal offer? Another page?',
        'We can continue managing and updating the site after launch, so you don&rsquo;t have to hunt ' +
        'down a developer every time something changes.']]
    ],
    band: { n: '25+', h: 'Years behind the screen.',
            p: 'Websites have changed a lot. Good design, clear communication and knowing how to sell a ' +
               'business haven&rsquo;t.' },
    factsH: 'Websites That Fit the Business',
    facts: [
      ['From $699', 'Landing pages, typically live in about a week.'],
      ['From about $2,000', 'Complete websites, typically a few weeks to a month depending on the project.'],
      ['The keys are yours', 'Your website is built for your business. After the project and warranty ' +
       'period are complete, you receive control of the site and its accounts.']
    ],
    steps: [
      ['Show Us What You Have', [
        'Send us your current website, Facebook page, logo, photos, videos &mdash; whatever exists.',
        'Starting from scratch? That&rsquo;s okay too. We can help create the pieces you&rsquo;re missing.']],
      ['Map the Route', [
        'We&rsquo;ll talk about your business, what you need the website to accomplish and what makes ' +
        'sense for your budget.',
        'We can meet by video, face-to-face or grab a coffee somewhere local.']],
      ['Design &amp; Build', [
        'We plan the site around the people you&rsquo;re trying to reach, then design and build it on ' +
        'the platform that makes sense for the job.',
        'And because we also handle branding, photography, video and marketing, you don&rsquo;t have to ' +
        'piece everything together between five different companies.']],
      ['Launch', [
        'We test it, connect everything, put the SEO foundations in place and get your new website on the road.',
        'Need us afterward? We can keep managing and updating it too.']]
    ],
    areaH: 'Local to Spring Hill. Working Along US-19.',
    area: [
      'Highway 19 Media is based in Spring Hill and works with businesses throughout Hernando County ' +
      'and down the US-19 corridor into the greater Tampa Bay area.',
      '<span class="svc-towns">Spring Hill. Brooksville. Weeki Wachee. Hudson. Port Richey. New Port ' +
      'Richey. Pinellas &mdash; and everywhere in between.</span>',
      'We can come to your business, meet over coffee or jump on a video call.',
      'And from the first conversation to the finished website, you have one local contact who knows ' +
      'your project.',
      '<a href="/contact/">Tell Us Where You Are &rarr;</a>'
    ],
    faq: [
      { q: 'I’m a small business. Do I really need a website?', a: [
        'Maybe. But you may not need a big website.',
        'For some local businesses, one well-designed page is enough — a professional place where ' +
        'customers can see what you do, contact you and find the rest of your business online.',
        'That’s why we created our landing-page option starting at $699.',
        'Think of it as your business’s entrance ramp to the web.'] },
      { q: 'When should I get a full website instead?', from: 'When should I get my own website instead?' },
      'How much does a full website cost?',
      'What platforms can you build on?',
      'How long does a website take?',
      'What do I need to provide?',
      'Who owns my website when it’s finished?'
    ]
  },
  {
    /* HIS OWN COPY, as he wrote it for this page (Sept 30, 2026). No pricing
       strip here: his page talks about budget in words instead. */
    slug: 'social-media-marketing',
    label: 'Social Media &amp; Paid Ads',
    color: '#f7931e',
    icon: 'icon-social.webp',
    title: 'Social Media & Paid Ads in Spring Hill, FL | Highway 19 Media',
    desc: 'Social media content, video, Google Ads and Facebook & Instagram ads for local businesses ' +
          'in Spring Hill and Tampa Bay - strategy, creative, targeting and management.',
    eyebrow: 'Social media &amp; paid ads &middot; Spring Hill &amp; Tampa Bay',
    h1: 'Social Media Marketing &amp; Paid Ads in <span class="svc-h1-at">Spring Hill, FL</span>',
    /* HIS HERO (social-media-marketing.svg, Sept 30): the likes, hearts and
       platform icons in three layers that drift at their own pace, in place
       of the lane's sign */
    hero: 'icons',
    tag: 'Put some traffic behind it.',
    lead: [
      'Having a great business isn&rsquo;t enough if the right people don&rsquo;t know you&rsquo;re there.',
      'We help local businesses get seen with social media content, video, Google Ads, Facebook and ' +
      'Instagram advertising &mdash; including the strategy, creative, targeting and campaign management ' +
      'behind it.',
      'Need the ad itself? We create that too.'
    ],
    cta: 'Let&rsquo;s Build Your Campaign',
    ctaH: 'Ready for more traffic?',
    serviceType: 'Social media marketing and paid advertising',
    steps: [
      ['Who Are We Talking To?', [
        'We define the customer, location and audience we&rsquo;re trying to reach.',
        'Advertising to the wrong people is just paying for traffic going the wrong direction.']],
      ['What Are We Saying?', [
        'We develop the offer and message.',
        'What are we showing them? Why should they care? What do we want them to do next?']],
      ['What Happens After They Click?', [
        'A good ad can still fail if it sends people somewhere confusing.',
        'We look at the website, landing page, contact process and tracking behind the campaign.',
        'If something is missing, we can build it.']],
      ['Launch. Learn. Refine.', [
        'Then the campaign goes live.',
        'For businesses without much existing traffic or advertising data, we may begin by building ' +
        'awareness and learning which audiences and messages get a response.',
        'As useful data develops, we can refine the targeting, test different creative, build ' +
        'retargeting audiences and put more attention behind what is working.']]
    ],
    areaH: 'Local to Spring Hill. Working Along US-19.',
    area: [
      'Highway 19 Media is based in Spring Hill and works with businesses throughout Hernando County ' +
      'and down the US-19 corridor into the greater Tampa Bay area.',
      '<span class="svc-towns">Spring Hill. Brooksville. Weeki Wachee. Hudson. Port Richey. New Port ' +
      'Richey. Pinellas &mdash; and everywhere in between.</span>',
      'Need content? We come to you.',
      'Want to talk strategy? We can meet at your business, grab a coffee or meet by video.',
      'And from the first conversation through the campaign, you have one local contact who knows ' +
      'your business and what we&rsquo;re trying to accomplish.',
      '<a href="/contact/">Tell Us Where You Are &rarr;</a>'
    ],
    sections: [
      /* WHAT WE DO, AS HE DREW IT: four full-screen panels that hold in place
         while the next one slides up over them. His order - Google Ads on the
         light panel, then advertising in AI on the black. Art is his, cut from the SVG; each piece is [kind, file, width, height,
         left, top (his pixels, from the card's corner), and for a phone its shadow centre,
         the middle of its body in the picture, and its tilt in degrees - all three phones
         are one handset in his file, so the page can turn one into the next. */
      { type: 'showcase', h: 'What We Do', items: [
        { key: 'smm', h: 'Social Media Management', p: [
          'Your social media shouldn&rsquo;t look like you disappeared six months ago.',
          'We help keep your business active with professionally designed posts, photos, videos, ' +
          'promotions and ongoing content.',
          'Stay involved as much as you want, or let us take more of it off your plate.'],
          art: [['phone', 'phone-smm-v2.webp', 485, 675, 542, 5, 836, 272, 369.8, 6.78]] },
        { key: 'video', h: 'Social Video', p: [
          'One visit can give your business weeks of content.',
          'We come to you, film your business, capture what you do, record tips or customer questions and ' +
          'turn the footage into short videos for Facebook, Instagram and other platforms.',
          'No stock footage pretending to be your business.',
          'Your people. Your location. Your work.'],
          art: [['phone', 'phone-video-v2.webp', 623, 654, 487, 25, 836, 318.7, 343, -15.49]] },
        { key: 'meta', h: '<span class="wwd-fb">Facebook</span> &amp; <span class="wwd-ig">Instagram</span> Ads', p: [
          'Not everyone is searching for you yet.',
          'Meta advertising lets us introduce your business, product or offer to people in your market and ' +
          'build an audience around the people who respond.',
          'We handle the audience, campaign setup, creative, messaging and ongoing management.'],
          art: [['glyph', 'glyph-facebook-v1.svg', 300, 300, 330, -70], ['glyph', 'glyph-instagram-v1.webp', 569, 569, 748, 48],
                ['phone', 'phone-meta-v2.webp', 984, 676, 395, 3, 837, 420.1, 371.7, 6.78]] },
        { key: 'google', h: 'Google Ads', p: [
          'When someone searches for the service or product you offer, Google Ads can put your business in ' +
          'front of them at exactly that moment.',
          'We research the searches, locations and opportunities that make sense, build the campaign, create ' +
          'the ads, set up tracking and manage it as the data comes in.',
          'Already running Google Ads? We can review what you have before starting over.'],
          art: [['logo', 'google-ads-v1.webp', 749, 673, 861, 153], 
                /* his chart in its parts, so the gears can turn and the glass can look around */
                ['chart', 'chart-disc-v1.webp', 646, 646, -212, 88],
                ['chart wwd-gear wwd-gear1', 'chart-gear-1-v1.webp', 91, 91, 185, 225],
                ['chart wwd-gear wwd-gear2', 'chart-gear-2-v1.webp', 77, 78, 261, 349],
                ['chart wwd-gear wwd-gear3', 'chart-gear-3-v1.webp', 54, 55, 128, 215],
                ['chart wwd-gear wwd-gear4', 'chart-gear-4-v1.webp', 55, 55, 257, 290],
                ['chart', 'chart-screen-v1.webp', 646, 646, -212, 88],
                ['chart wwd-glass', 'chart-magnifier-v1.webp', 187, 243, -99, 402]] },
        /* his last panel (Sept 30, evening): advertising inside the AI answers */
        { key: 'ai', h: 'Advertising is<br>Entering<br>the Conversation', p: [
          'People are using AI to research, compare, and decide what to buy and who to hire. We can help ' +
          'position your business for this new advertising space with the right message, creative, landing ' +
          'page, and campaign.'],
          art: [['glyph', 'glyph-openai-v1.webp', 860, 872, 276, -24],
                ['phone', 'phone-ai-v1.webp', 347, 613, 532, 105, 727, 173.6, 306.8, -8.04, 720]] }
      ] },
      { type: 'prose', tone: 'dark', h: 'We Don&rsquo;t Just Run Ads. We Create Them.', body: [
        'This is an important difference.',
        'An advertising campaign may need more than somebody managing a dashboard.',
        { list: ['It may need a better photo.', 'A professional video.', 'New graphics.', 'A stronger offer.',
                 'A landing page built specifically for the campaign.',
                 'Or a complete change in how the business is being presented.'] },
        'We can handle all of it.',
        'Highway 19 Media combines advertising with website design, video production, photography, ' +
        'graphic design and branding &mdash; so the ad, the message and where the customer lands can all ' +
        'work together.',
        { big: 'One campaign. One direction. One local contact.' }
      ] },
      { type: 'cards', h: 'Before We Spend Your Money', items: [
        ['Audience First', [
          'Who actually needs what you sell?',
          'We look at your customer, location, service area, offer, existing website traffic, previous ' +
          'advertising and any useful customer data you already have.',
          'Because showing a great ad to the wrong person is still wasting money.']],
        ['Then the Offer', [
          'Why should someone stop scrolling, click or call?',
          'Sometimes the problem isn&rsquo;t the advertising.',
          'It&rsquo;s the offer.',
          'We&rsquo;ll look at what you&rsquo;re putting in front of the customer before putting money behind it.']],
        ['Then the Creative', [
          'What are they actually going to see?',
          'Depending on the campaign, we can create the photography, video, graphics, copy and landing page ' +
          'needed to support it.']],
        ['Then We Run It', [
          'Once the pieces are in place, we launch, track what happens and start learning from real traffic.']]
      ] },
      { type: 'prose', tone: 'tint', h: 'What Does a Marketing Budget Actually Mean?', body: [
        { big: 'Your ad spend and our fee are separate.' },
        'Ad spend is the money paid directly to platforms such as Google, Facebook and Instagram to show ' +
        'your advertising.',
        'Our fee covers the work behind the campaign &mdash; strategy, setup, management and the creative ' +
        'services included in your plan.',
        { h3: 'What if I only have $500?' },
        'Tell us.',
        'If you mean $500 in monthly ad spend, we&rsquo;ll look at your business, market and goals and tell ' +
        'you what we think that budget can realistically support.',
        'If you mean $500 total for everything, tell us that too.',
        'We would rather help you choose something useful within your budget than sell you a campaign that ' +
        'doesn&rsquo;t have enough behind it to make sense.',
        { big: 'No mystery budget. No automatic package. We talk about the numbers before we start.' }
      ] },
      { type: 'steps' },
      { type: 'prose', tone: 'white', h: 'How Fast Does Advertising Work?', body: [
        'There isn&rsquo;t one honest answer.',
        'Some campaigns can generate activity quickly. Others need time, testing and enough traffic before ' +
        'there&rsquo;s useful data to work with.',
        'Clicks and views are easy to count.',
        'What matters is whether the advertising is helping produce the actions your business actually needs ' +
        '&mdash; calls, forms, visits, appointments, purchases or qualified inquiries.',
        'That&rsquo;s what we want to measure.',
        { big: 'We don&rsquo;t promise a magic number of customers.' },
        'We build the campaign, track what happens and make decisions from real data.'
      ] },
      { type: 'prose', tone: 'tint', h: 'Social Media + Advertising Works Better When It Connects', body: [
        'Your social media doesn&rsquo;t have to live in one box while your advertising, website and video ' +
        'live somewhere else.',
        'A video we shoot for your business can become:',
        { list: ['Social content.', 'A Facebook or Instagram ad.', 'Website content.', 'A landing-page video.',
                 'Short vertical clips.', 'Retargeting creative.'] },
        'One piece of production can keep working in different places.',
        { big: 'That&rsquo;s how we help smaller businesses get more out of the marketing they&rsquo;re already paying for.' }
      ] },
      { type: 'area' },
      { type: 'faq' }
    ],
    faq: [
      { q: 'Can you manage my social media?', a: [
        'Yes. We can create the content, design posts, produce videos, organize your messaging and manage ' +
        'your ongoing social media presence.',
        'You can stay closely involved or let us handle more of the day-to-day work.'] },
      { q: 'Can you create ongoing social media videos?', a: [
        'Yes. We can visit your business and capture enough material to create multiple pieces of content ' +
        'from one production session.'] },
      { q: 'Can you run my paid advertising?', a: [
        'Yes. We manage Google Ads and paid Facebook and Instagram campaigns, including campaign strategy, ' +
        'setup, targeting, creative and ongoing management.'] },
      { q: 'What do you look at before launching an advertising campaign?', a: [
        'Your audience, location, offer, website, existing traffic, tracking, previous campaigns and ' +
        'available customer data.',
        'We want to understand what we’re working with before spending your money.'] },
      { q: 'Should a new business start with awareness advertising?', a: [
        'Sometimes.',
        'If there isn’t much traffic or customer data yet, an awareness campaign can help introduce the ' +
        'business and begin building useful information about who responds.',
        'But we don’t automatically run the same campaign for every business.'] },
      { q: 'How quickly will advertising produce results?', a: [
        'It depends on the business, market, offer, budget, competition and campaign.',
        'Some campaigns show activity quickly. Others need enough traffic and testing before we can make ' +
        'useful decisions.',
        'We won’t invent a timeline just to make the sale.'] },
      { q: 'Is your management fee included in my advertising budget?', a: [
        'No.',
        'Your ad spend is paid to the advertising platform. Highway 19 Media’s fee covers the strategy, ' +
        'campaign management and agreed creative services.',
        'You’ll know both numbers before anything launches.'] },
      { q: 'What if I only have $500 for marketing?', a: [
        'Tell us exactly what you’re comfortable spending.',
        'We’ll look at what you’re trying to accomplish and tell you what we believe makes sense within that ' +
        'budget — whether that’s advertising, creating better content first, improving the page you’re ' +
        'sending people to, or starting smaller.',
        'Sometimes the smartest first move isn’t buying more ads.'] }
    ]
  },
  {
    /* HIS OWN COPY, as he wrote it for this page (Sept 30, 2026). */
    slug: 'branding-and-print',
    label: 'Print &amp; Branding',
    color: '#d4145a',
    icon: 'icon-print.webp',
    title: 'Branding, Design & Print in Spring Hill, FL | Highway 19 Media',
    desc: 'Logos, graphic design, printing, signs, vehicle graphics, promotional products and custom ' +
          'merchandise for local businesses in Spring Hill and across Tampa Bay.',
    eyebrow: 'Branding, design &amp; print &middot; Spring Hill &amp; Tampa Bay',
    h1: 'Branding, Graphic Design &amp; Print in Spring Hill, FL',
    tag: 'Look the part. Everywhere.',
    lead: [
      'Your website. Your truck. Your business card. Your sign. Your social media.',
      'It should all look like the same company.',
      'From logos and everyday graphic design to printing, signage, vehicle graphics, branded merchandise ' +
      'and completely custom products, we help local businesses build a professional look and carry it ' +
      'everywhere customers see them.'
    ],
    cta: 'Let&rsquo;s Build Your Brand',
    ctaH: 'Does Your Brand Look Ready for the Road?',
    ctaP: [
      'Maybe you&rsquo;re starting from scratch.',
      'Maybe your logo is fine but everything around it feels disconnected.',
      'Maybe you know your business needs to look better, but you&rsquo;re not sure what needs fixing first.',
      'Show us what you have. We&rsquo;ll help you figure out the next move.',
      'We reply within 24 hours.'
    ],
    serviceType: 'Branding, graphic design and print',
    factsH: 'More Than a Logo',
    facts: [
      ['Files you keep', 'Professional, production-ready brand files you can take to a printer, sign shop or other vendor.'],
      ['One creative direction', 'Website. Video. Social media. Advertising. Print. Signs. Vehicles. One consistent look across your business.'],
      ['We handle the suppliers', 'Need it produced? We can handle sourcing, pricing, artwork and production instead of handing you a file and sending you on your way.']
    ],
    steps: [
      ['Show Us What You Have', [
        'Your logo, business cards, website, signs, vehicle, packaging or marketing materials.',
        'Starting with nothing? That&rsquo;s fine too.']],
      ['Set the Direction', [
        'We establish the look &mdash; colors, typography, style and the impression you want your business to make.']],
      ['Design the Pieces', [
        'Then we build what you actually need.',
        'Logo files. Business cards. Signs. Vehicle graphics. Social media. Advertising. Packaging. Whatever ' +
        'the project calls for &mdash; all from the same visual direction.']],
      ['Produce &amp; Deliver', [
        'Need the finished product too?',
        'We can prepare the artwork, work with printers and manufacturers, coordinate specifications and ' +
        'manage production through delivery.',
        'You approve it. We help get it made.']]
    ],
    areaH: 'Local to Spring Hill. Working Along US-19.',
    area: [
      'Highway 19 Media is based in Spring Hill and works with businesses throughout Hernando County ' +
      'and down the US-19 corridor into the greater Tampa Bay area.',
      '<span class="svc-towns">Spring Hill. Brooksville. Weeki Wachee. Hudson. Port Richey. New Port ' +
      'Richey. Holiday. Pinellas &mdash; and everywhere in between.</span>',
      'We can visit your business, look at the space, photograph the vehicle, bring samples, grab a coffee ' +
      'or meet by video.',
      'From the first idea through the finished product, you have one local contact who knows your business.',
      '<a href="/contact/">Tell Us Where You Are &rarr;</a>'
    ],
    sections: [
      { type: 'cards', h: 'What We Make', items: [
        ['Logo &amp; Brand Identity', [
          'Starting something new? We can build your visual identity from the ground up.',
          'Already have a logo? We can refine what you have and build the colors, typography and visual ' +
          'direction around it &mdash; with professional vector files you can use anywhere.']],
        ['Graphic Design', [
          'Need something designed without a complete branding project? Absolutely.',
          'Social posts, ads, flyers, brochures, catalogs, presentations and marketing materials &mdash; as a ' +
          'single project or ongoing design work.']],
        ['Print', [
          'Business cards, flyers, brochures, catalogs, posters, postcards, letterheads and more.',
          'We can handle the design, prepare the files and manage printing, so you don&rsquo;t have to figure ' +
          'out production yourself.']],
        ['Signs &amp; Vehicle Graphics', [
          'Take your brand outside.',
          'We design signs, banners, window graphics and vehicle graphics that carry the same professional ' +
          'look as the rest of your business.',
          'Already have a sign or wrap company? We can work with them too.']],
        ['Promotional Products', [
          'Shirts, hats, mugs, pens, notebooks, bags, giveaways and more.',
          'Tell us what you&rsquo;re looking for. We&rsquo;ll research vendors, compare options, prepare the ' +
          'artwork and help manage production.']],
        ['Completely Custom Products', [
          'Have an idea you can&rsquo;t find in a catalog?',
          'We have years of experience working directly with manufacturers, including overseas suppliers, to ' +
          'develop completely custom merchandise, promotional products, plush products, packaging and more.',
          'From the initial idea and prototype to revisions, production and shipping, we can help manage the process.',
          'If you can imagine it, ask us if we can make it.']]
      ] },
      { type: 'facts' },
      { type: 'prose', tone: 'tint', h: 'Already Have a Brand? Bring It.', body: [
        'You don&rsquo;t have to start over.',
        'If you already have a logo, colors or materials your customers recognize, we&rsquo;ll look at what ' +
        'you have and help decide what should stay and what could use some attention.',
        'Sometimes you need a new identity.',
        'Sometimes you just need the one you already have to look better everywhere.',
        { big: 'Keep what works. Improve what doesn&rsquo;t. Make it consistent.' }
      ] },
      { type: 'steps' },
      { type: 'prose', tone: 'dark', h: 'One Place for the Whole Brand', body: [
        'This is where Highway 19 Media is different.',
        'We&rsquo;re not only a logo designer or a print shop.',
        'We handle branding, graphic design, websites, photography, video, advertising, print and production.',
        'That means the person designing your business card can understand what&rsquo;s happening on your ' +
        'website. Your vehicle can match your advertising. Your social media can look like the company on ' +
        'your sign.',
        'And when you need something new, you don&rsquo;t have to explain your business all over again.',
        { big: 'One business. One direction. One local contact.' }
      ] },
      { type: 'area' },
      { type: 'faq' }
    ],
    faq: [
      { q: 'Can you create or refresh my brand?', a: [
        'Yes. We can create a completely new identity or work with what you already have.',
        'Branding can include your logo, colors, typography, visual direction and professional files needed ' +
        'to keep everything consistent across your website, video, social media, advertising, print, signs ' +
        'and vehicles.'] },
      { q: 'Do I have to redesign my existing logo?', a: [
        'No. If your existing logo works, we can keep it.',
        'Sometimes cleaning up the artwork, creating proper vector files and building a consistent visual ' +
        'system around it is all that’s needed.'] },
      { q: 'Do you offer graphic design without a complete branding project?', a: [
        'Yes. You can come to us for a single flyer, ad, catalog, sign, social graphic or other design ' +
        'project without purchasing a complete branding package.'] },
      { q: 'Why use one agency for all of it?', a: [
        'Consistency — and fewer people for you to coordinate.',
        'We can carry the same creative direction through your website, video, advertising, social media, ' +
        'print, signs and other marketing materials.'] },
      { q: 'What can you print?', a: [
        'Business cards, flyers, brochures, catalogs, posters, postcards, stationery, folders and many other ' +
        'business and marketing materials.',
        'Looking for something unusual? Ask us.'] },
      { q: 'Can you help me find promotional products?', a: [
        'Yes. Give us an idea of what you’re looking for, the quantity and your budget. We can research ' +
        'products and vendors, compare options, prepare the artwork and coordinate production.'] },
      { q: 'Can you manufacture completely custom promotional products?', a: [
        'Yes. We’re not limited to what’s available in a promotional-products catalog.',
        'For the right project, we can work directly with manufacturers to develop custom merchandise, ' +
        'packaging and specialty products — including prototypes and custom manufacturing.'] }
    ]
  }
];

module.exports.AREA = AREA;
