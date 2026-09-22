# -*- coding: utf-8 -*-
"""Generates faq.html for the Highway 19 Media site.

The point of generating rather than hand-writing it: the FAQPage JSON-LD and
the visible copy come from one source, so they cannot drift. Run it again after
editing CONTENT below; everything else in the file is a template at the bottom.
"""
import html, json, re, io, os

OUT = "/home/user/highway19media/faq.html"

# The four service icons are lifted verbatim from the home page's service
# cards, so a category reads as the same lane it does there.
ICONS = {
 "map": """<path d="M9 4.2 3.4 6.5v13.3L9 17.5l6 2.3 5.6-2.3V4.2L15 6.5 9 4.2Z"/>
              <path d="M9 4.2v13.3M15 6.5v13.3"/>""",
 "web": """<rect x="2.6" y="4.4" width="18.8" height="15.2" rx="2.2"/>
              <path d="M2.6 8.7h18.8"/>
              <circle class="solid" cx="5.4" cy="6.6" r=".85"/>
              <circle class="solid" cx="8.1" cy="6.6" r=".85"/>
              <circle class="solid" cx="10.8" cy="6.6" r=".85"/>
              <path d="M10 11.9L7.6 14.3l2.4 2.4M14 11.9l2.4 2.4-2.4 2.4M12.9 11.4l-1.8 5.8"/>""",
 "video": """<circle cx="7.7" cy="6" r="2.9"/>
              <circle cx="15.1" cy="6" r="2.9"/>
              <rect x="2.6" y="10.4" width="12.9" height="7" rx="1.6"/>
              <path d="M15.5 12.4l5.9-2.4v7.8l-5.9-2.4z"/>
              <path d="M7.3 17.4L5.6 21M10.8 17.4L12.5 21"/>""",
 "social": """<path d="M11.6 3.4H4.2a2.1 2.1 0 0 0-2.1 2.1v5.7a2.1 2.1 0 0 0 2.1 2.1h.6v3.3l3.4-3.3h3.4a2.1 2.1 0 0 0 2.1-2.1V5.5a2.1 2.1 0 0 0-2.1-2.1z"/>
              <path class="solid" d="M7.9 11c-1.6-1.1-3-2.2-3-3.4 0-1.3 1.5-1.8 2.4-.9l.6.6.6-.6c.9-.9 2.4-.4 2.4.9 0 1.2-1.4 2.3-3 3.4z"/>
              <path d="M16 10.6v9.9M16 12.3l2.1-3.4c1.1.3 1.6 1.2 1.4 2.3l-.3 1.5h2.2c1 0 1.7.9 1.5 1.9l-.8 4.1c-.2.9-1 1.6-2 1.6H16"/>""",
 "brand": """<path d="M19.6 12.6v5.9a2.2 2.2 0 0 1-2.2 2.2H5.6a2.2 2.2 0 0 1-2.2-2.2V6.7a2.2 2.2 0 0 1 2.2-2.2h6"/>
              <path d="M16.4 3.3l3.9 3.9-8 8-4.4.5.5-4.4z"/>""",
 "print": """<path d="M6.9 8.4V3.5h10.2v4.9"/>
              <path d="M4.6 8.4h14.8a1.8 1.8 0 0 1 1.8 1.8v4a1.8 1.8 0 0 1-1.8 1.8h-1.5"/>
              <path d="M6.9 16h-1.5a1.8 1.8 0 0 1-1.8-1.8v-4a1.8 1.8 0 0 1 1.8-1.8"/>
              <path d="M6.9 13.2h10.2v7.3H6.9z"/>
              <circle class="solid" cx="18" cy="11" r=".9"/>""",
 "wheel": """<circle cx="12" cy="12" r="8.8"/>
              <circle cx="12" cy="12" r="2.9"/>
              <path d="M12 3.2v5.9M4.5 16.3l5-2.9M19.5 16.3l-5-2.9"/>""",
}

CONTACT = "index.html#close"

CONTENT = [
 dict(sid="qa-general", nav="General", icon="map",
      layout="stacked", band="",
      eyebrow="General",
      heading="Start Here.",
      lead="The questions we get asked most — who we are, how we work, and what it "
           "takes to get your marketing pointed in one direction.",
      cta=("Let’s Find Your Road",
           "Tell us where your business is today and where you want it to go.",
           "Let’s Talk"),
      faqs=[
       ("What does Highway 19 Media do?",
        ["Highway 19 Media helps local Tampa Bay businesses with websites, video production, "
         "social media, paid advertising, graphic design, branding, print and promotional "
         "products. Instead of coordinating multiple vendors, you have one local point of "
         "contact who can manage as much or as little as you need while keeping your marketing "
         "moving in the same direction."]),
       ("Are you really local?",
        ["Yes. Highway 19 Media is based in Spring Hill and serves businesses throughout Tampa "
         "Bay and surrounding areas. We can meet face-to-face, visit your business, grab a "
         "coffee or meet by video. You work with a local contact who gets to know your business "
         "and stays involved throughout the work."]),
       ("What makes Highway 19 Media different from a freelancer or a large agency?",
        ["We sit somewhere in the middle. We’re small enough that you don’t get passed from desk "
         "to desk, but we bring more than 25 years of experience across graphic design, "
         "websites, video production, print, advertising, 3D, motion graphics, vector artwork, "
         "product sourcing and more. When your business reaches a new intersection, you don’t "
         "necessarily need to find another vendor."]),
       ("What if I don’t know exactly what marketing I need?",
        ["You don’t need to come to us with the whole route already mapped out. Show us what you "
         "currently have, including your website, Facebook page, logo, advertising, photos or "
         "videos. Tell us where you want the business to go and we’ll help identify what makes "
         "sense to work on next."]),
       ("Can you work with my budget?",
        ["Yes. There are many different roads to the same destination. Tell us the budget you’re "
         "comfortable with and we’ll explain what we can realistically accomplish with it. More "
         "budget opens additional options. A smaller budget means we prioritize what matters "
         "most first. The goal is to use what you have wisely and keep moving forward."]),
       ("Do I have to sign a long-term contract?",
        ["No. We can work together on an individual project, or you can choose an ongoing "
         "3-month, 6-month or 12-month commitment. Longer relationships allow us to develop "
         "assets, understand your customers, maintain a consistent brand, track results and "
         "continuously refine the strategy. The commitment goes both ways."]),
      ]),

 dict(sid="qa-websites", nav="Website Design", icon="web",
      layout="split", band="pale",
      eyebrow="Website Design & Development",
      heading="Your Business, Open 24/7.",
      lead="From a simple landing page to a full custom build — how local businesses get "
           "online, and how they keep growing once they are.",
      cta=("Ready to Get Online?",
           "From a simple landing page to a complete website, we’ll help you choose the right route.",
           "Let’s Build Your Site"),
      faqs=[
       ("I’m a small business. Do I really need a website?",
        ["Not necessarily a full website. Some local businesses simply need a professional place "
         "online where customers can see what they do, contact them and find their social media. "
         "That’s why we offer a Highway 19 Media landing-page option starting at $699. It gives "
         "your business an affordable entrance ramp to getting online."]),
       ("What comes with the $699 landing page?",
        ["A professionally designed landing page, typically three to four sections, customized "
         "around your business. It can include your services, contact information, social links, "
         "images, calls to action and a contact form."]),
       ("When should I get my own website instead?",
        ["If you’re planning to grow, compete heavily in search, advertise extensively, track "
         "visitors, display a larger portfolio or catalog, sell products online or continually "
         "expand your content, your own website gives you considerably more room to grow."]),
       ("How much does a full website cost?",
        ["Full website services generally start around $2,000 for a smaller service or portfolio "
         "website. That can include multiple pages, infrastructure setup, strategy, custom "
         "design, user experience and SEO/AEO foundations. E-commerce and highly customized "
         "websites cost more depending on functionality and complexity."]),
       ("What platforms can you build on?",
        ["We work with WordPress, Webflow, Shopify, Magento and other major website platforms. "
         "We can build custom, template-based and AI-assisted websites and connect them with "
         "CRMs and other business systems. The platform is the vehicle. We choose the one that "
         "makes sense for where your business is going."]),
       ("How long does a website take?",
        ["A landing page can generally be completed in about a week. A complete website may take "
         "several weeks to a month depending on complexity, content and client response time. "
         "Straightforward websites can sometimes be completed in around two weeks when there are "
         "no roadblocks."]),
       ("What do I need to provide?",
        ["Sometimes very little. If we’re starting from scratch, we can develop virtually "
         "everything. If you already have logos, photographs, videos, copy, brand files or an "
         "existing website, send them over so we can build on what you already have."]),
      ]),

 dict(sid="qa-video", nav="Video Production", icon="video",
      layout="stacked", band="deep",
      eyebrow="Video Production",
      heading="Put Your Business in Motion.",
      lead="Commercials, social content, interviews and everything between — produced at the "
           "scale your goals and your budget actually call for.",
      cta=("Ready to Be Seen?",
           "From one polished commercial to an ongoing stream of content, let’s put your business in motion.",
           "Plan Your Production"),
      faqs=[
       ("What kind of videos do you produce?",
        ["Everything from quick social content to professional commercial productions. We produce "
         "website hero videos, commercials, interviews, podcasts, testimonials, social media "
         "content, drone footage, educational videos and ongoing content series."]),
       ("Do I need an expensive video production?",
        ["Not always. If you’re producing one commercial that needs to represent your company for "
         "the next year, investing in professional production makes sense. If you need fresh "
         "social content every week, a lighter and more efficient production setup may be the "
         "smarter road."]),
       ("What happens when you produce a professional commercial?",
        ["We help develop the concept and script, plan the production and prepare you before "
         "filming. On production day we bring the appropriate cameras, microphones and equipment "
         "and direct you while filming. Then we edit the footage, incorporate B-roll and can add "
         "graphics, motion design, music and branded endings."]),
       ("Can you create ongoing social media videos?",
        ["Yes. We can visit your business, capture what you do, ask questions, record tips and "
         "turn that material into multiple pieces of social content. Instead of one big splash "
         "followed by silence, we help keep your business visible."]),
       ("Do you have a studio?",
        ["Yes. When appropriate, we can use a studio environment for interviews, podcasts and "
         "other controlled productions. Longer conversations can also be edited into multiple "
         "shorter pieces for social media."]),
      ]),

 dict(sid="qa-advertising", nav="Social Media & Paid Ads", icon="social",
      layout="split", band="",
      eyebrow="Social Media & Paid Advertising",
      heading="Send the Right Traffic Your Way.",
      lead="Content, campaigns and ad spend aimed at the people most likely to actually need "
           "what your business does.",
      cta=("Ready for More Traffic?",
           "Let’s make sure the right traffic is heading toward your business.",
           "Build My Campaign"),
      faqs=[
       ("Can you manage my social media?",
        ["Yes. We can create content, design posts, produce videos, organize messaging and manage "
         "ongoing social media activity. You can stay heavily involved or let us handle more of "
         "the work."]),
       ("Can you run my paid advertising?",
        ["Yes. We can manage PPC and paid social campaigns whether you already have advertising "
         "materials or need us to build the campaign from scratch."]),
       ("What do you look at before launching an advertising campaign?",
        ["Audience first. Advertising to the wrong people is like knocking on doors where nobody "
         "needs what you’re selling. Next we examine the offer and then your existing traffic, "
         "tracking, previous campaigns and customer data. From there we build a strategy "
         "specifically around your business."]),
       ("Should a new business start with awareness advertising?",
        ["Often, yes. For a business without much existing audience data, an awareness strategy "
         "can help us learn who responds, build audiences and gather information that can later "
         "support more targeted campaigns and retargeting."]),
       ("How quickly will advertising produce results?",
        ["You can often begin seeing movement relatively quickly through traffic, engagement, "
         "inquiries and other signals. Sustainable marketing usually builds over time. Several "
         "months of consistent marketing gives us considerably more information and opportunity "
         "to refine the strategy than a short burst."]),
       ("Is your management fee included in my advertising budget?",
        ["No. Ad spend and our management and creative fees are separate. Your ad spend is paid "
         "to the advertising platforms. Our fee covers the strategy, management, creative work "
         "and other services we provide."]),
       ("What if I only have $500 for marketing?",
        ["We’ll first look at what you already have. If you have good content and a strong offer, "
         "$500 may work as ad spend for a targeted campaign. If you have no content, weak "
         "branding or nowhere effective to send customers, it may make more sense to invest in "
         "building those assets first."]),
      ]),

 dict(sid="qa-branding", nav="Branding & Graphic Design", icon="brand",
      layout="stacked", band="pale",
      eyebrow="Branding & Graphic Design",
      heading="One Look, Every Road You Take.",
      lead="Logos, colours, type and production-ready files that keep your business "
           "recognisable everywhere it shows up.",
      cta=("Does Your Brand Look Ready for the Road?",
           "Let’s build a visual identity that stays consistent everywhere your business goes.",
           "Build Your Brand"),
      faqs=[
       ("Can you create or refresh my brand?",
        ["Yes. Branding can include your logo, colors, typography, visual language and "
         "professional vector files needed to reproduce your identity consistently across "
         "websites, video, social media, print, signs and advertising."]),
       ("Do you offer graphic design without a complete branding project?",
        ["Absolutely. You can hire us for individual graphic design projects, hourly work or an "
         "ongoing graphic-design retainer. This can include social posts, ads, flyers, digital "
         "graphics, signage, marketing materials and other creative work."]),
       ("Why use one agency for all of it?",
        ["Consistency. When the same creative direction runs through your website, advertising, "
         "video, print and social media, everything looks like one business rather than pieces "
         "created by unrelated vendors. One contact knows the roadmap and coordinates the work."]),
      ]),

 dict(sid="qa-print", nav="Print & Promotional Products", icon="print",
      layout="split", band="",
      eyebrow="Print, Signage & Promotional Products",
      heading="Brand You Can Hold.",
      lead="Business cards, signs, shirts, merchandise and fully custom products — sourced, "
           "printed and delivered without you chasing suppliers.",
      cta=("Take Your Brand Off-Screen.",
           "From business cards to signs, merchandise and custom products, let’s put your brand into your customers’ hands.",
           "Start a Print Project"),
      faqs=[
       ("What can you print?",
        ["Business cards, flyers, catalogs, posters, signs, letterheads, shirts, mugs, pens, "
         "mouse pads, notebooks, promotional products, vehicle graphics and many other branded "
         "materials."]),
       ("Can you help me find promotional products?",
        ["Yes. We can research vendors, compare pricing, prepare the artwork and manage "
         "production. You don’t have to spend your day calling printers and suppliers."]),
       ("Can you manufacture completely custom promotional products?",
        ["Yes. We have experience with international sourcing and can work directly with "
         "manufacturers, including manufacturers in China. This opens the door to completely "
         "custom promotional products, branded merchandise, custom plush products, packaging and "
         "products beyond standard promotional catalogs."]),
      ]),

 dict(sid="qa-working", nav="Working With Us", icon="wheel",
      layout="stacked", band="navy",
      eyebrow="Working With Highway 19 Media",
      heading="What It’s Actually Like.",
      lead="Who you’ll talk to, how involved you need to be, who owns what at the end, and how "
           "the first conversation goes.",
      cta=("Ready to Take the Next Turn?",
           "Show us what you have. Tell us where you want to go. We’ll help map the road ahead.",
           "Let’s Talk"),
      faqs=[
       ("Who will I actually talk to?",
        ["You’ll have one primary local contact who gets to know your business, coordinates your "
         "projects, schedules production and helps manage the different services you use. You "
         "shouldn’t have to explain your business from scratch every time you need something."]),
       ("How involved do I have to be?",
        ["As much or as little as you want. Some business owners want to make every turn with us. "
         "Others tell us where they want to go and let us handle the road ahead. Both approaches "
         "work."]),
       ("Who owns my website when it’s finished?",
        ["When we build on your own domain, once the project and applicable warranty period are "
         "complete, control of the website is returned to you, subject to the project agreement "
         "and any third-party licensing. Raw photography and video assets are handled differently "
         "and are generally licensed according to the individual project agreement."]),
       ("What’s the first step?",
        ["Show us where you are and tell us where you want to go. Send us your current website, "
         "Facebook page, logo, marketing materials, advertising or anything else you’re using. "
         "Then we can meet by video, face-to-face or even over coffee and talk about your "
         "business, goals and budget.",
         "The first conversation is about getting to know your business.",
         "The meeting is where we start mapping the road ahead."]),
      ]),
]

# --------------------------------------------------------------------------
# Each category's ground and intro layout.
# --------------------------------------------------------------------------
LOOK = {
    "qa-general":     dict(band="band-white",   layout="centred"),
    "qa-websites":    dict(band="band-blue-lt", layout="split"),
    "qa-video":       dict(band="band-blue",    layout="centred"),
    "qa-advertising": dict(band="band-white",   layout="split"),
    "qa-branding":    dict(band="band-blue-lt", layout="centred"),
    "qa-print":       dict(band="band-white",   layout="split"),
    "qa-working":     dict(band="band-green",   layout="centred"),
}

# --------------------------------------------------------------------------
# THE ROUTE
# One road down the page, cut into routes wherever it leaves the screen —
# the break is already invisible there, and it keeps each rebuild short.
# road.js reads the data-road attributes; see section 6b in that file.
#
#   ("gap",  move, band)              a strip holding a turn and nothing else
#   ("sec",  id,   move [, track])    a section the road runs down beside
#   ("plain", id)                     a section with no road at all
#   track = (move, top px, height px) an independent stub in the OTHER margin,
#                                     anchored to the section's top at a fixed
#                                     height, so it never needs rebuilding
#
# Each route must start and end off canvas: arrive-* / rail-* off the top at
# the start, leave-* at the end.
# --------------------------------------------------------------------------
PAGE = [
    ("route", [
        ("gap", "arrive-left", "band-white"),
        ("sec", "qa-general",  "rail-left"),
        ("sec", "qa-websites", "rail-left"),
        ("gap", "leave-left",  "band-blue-lt"),
    ]),
    ("route", [
        ("gap", "arrive-left",  "band-blue"),
        ("sec", "qa-video",     "rail-left",  ("track-right", 96, 470)),
        ("gap", "cross-right",  "band-white"),
        ("sec", "qa-advertising", "rail-right", ("track-left", 130, 560)),
        ("sec", "qa-branding",  "rail-right"),
        ("gap", "leave-right",  "band-blue-lt"),
    ]),
    ("plain", "qa-print"),
    ("route", [
        ("gap", "arrive-left", "band-green"),
        ("sec", "qa-working",  "rail-left"),
        ("gap", "cross-right", "band-navy"),
        ("close", "rail-right"),
        ("gap", "leave-right", "band-navy"),
    ]),
]

CLOSING = '''  <section id="qa-close" class="sec band-navy" data-section="qa-09-close"%s>
    <div class="sec__inner">
      <div class="sec__body">
        <div class="headline">
          <svg class="sign" viewBox="0 0 52 64" aria-hidden="true" focusable="false"><use href="#sg-ahead"/></svg>
          <div>
            <h2>Still Have a Question?</h2>
            <p class="sub">Ask us directly &mdash; no obligation, no pressure.</p>
          </div>
        </div>
        <p class="body-copy">
          Send us your website, your Facebook page or whatever you&rsquo;re working with,
          and we&rsquo;ll come back within 24 hours.
        </p>
        <div class="sec__cta">
          <a class="btn btn--primary" href="index.html#close"><svg class="btn__sign" viewBox="0 0 64 60" aria-hidden="true" focusable="false"><use href="#sg-warning"/></svg>Ask Us Directly</a>
          <a class="btn btn--ghost" href="index.html#services">See What We Do</a>
        </div>
      </div>
    </div>
  </section>
'''

# --------------------------------------------------------------------------
# rendering
# --------------------------------------------------------------------------

def e(s):
    return html.escape(s, quote=True)

def slug(text, taken):
    s = re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-")
    s = "-".join(s.split("-")[:7])[:52].strip("-")
    base, n = s, 2
    while s in taken:
        s, n = "%s-%d" % (base, n), n + 1
    taken.add(s)
    return s

def render():
    out = io.StringIO()
    w = out.write
    taken = set()
    schema = []

    by_id = dict((c["sid"], c) for c in CONTENT)

    def section(sid, road=None, track=None):
        sec = by_id[sid]
        m = LOOK[sid]
        classes = ["sec", "qa-sec", "qa-sec--" + m["layout"], m["band"]]
        b = []
        b.append('\n  <!-- ======================================================================\n')
        b.append('       %s\n' % sec["eyebrow"].upper())
        b.append('       ==================================================================== -->\n')
        b.append('  <section id="%s" class="%s" data-section="%s" aria-labelledby="%s-h"%s>\n'
                 % (sid, " ".join(classes), sid, sid,
                    '' if not road else ' data-road="%s"' % road))
        if track:
            kind, top, high = track
            side = kind.split("-")[1]
            b.append('    <!-- A track of its own in the far margin: in off the edge, down,\n'
                     '         back out. Fixed height, anchored here, so opening an answer\n'
                     '         below it never touches it. -->\n')
            b.append('    <div class="road-run road-track road-track--%s" data-road-run '
                     'data-road="%s" style="--t:%dpx;--h:%dpx" aria-hidden="true"></div>\n'
                     % (side, kind, top, high))
        b.append('    <div class="sec__inner">\n      <div class="sec__body">\n')

        split = m["layout"] == "split"
        if split:
            b.append('      <div class="qa-sec__grid">\n')

        b.append('''      <div class="qa-sec__head">
        <span class="qa-disc" aria-hidden="true">
          <svg viewBox="0 0 24 24">
            %s
          </svg>
        </span>
        <span class="eyebrow">%s</span>
        <h2 id="%s-h">%s</h2>
        <p class="body-copy">%s</p>
      </div>\n''' % (ICONS[sec["icon"]].strip(), e(sec["eyebrow"]),
                       sid, e(sec["heading"]), e(sec["lead"])))

        b.append('\n      <div class="qa-faq">\n        <div class="qa-list">\n')
        for q, paras in sec["faqs"]:
            qid = "q-" + slug(q, taken)
            schema.append((q, " ".join(paras)))
            b.append('''
          <div class="qa-item" id="%s">
            <h3>
              <button class="qa-q" type="button" id="%s-q" aria-expanded="true" aria-controls="%s-a">
                <span>%s</span>
                <span class="qa-marker" aria-hidden="true">
                  <svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>
                </span>
              </button>
            </h3>
            <div class="qa-panel" id="%s-a" role="region" aria-labelledby="%s-q">
              <div>
                <div class="qa-a">
%s
                </div>
              </div>
            </div>
          </div>\n''' % (qid, qid, qid, e(q), qid, qid,
                           "\n".join("                  <p>%s</p>" % e(pp) for pp in paras)))
        b.append('\n        </div>\n')

        h, copy, button = sec["cta"]
        b.append('''
        <div class="qa-cta">
          <div class="qa-cta__text">
            <h3>%s</h3>
            <p>%s</p>
          </div>
          <a class="btn btn--primary" href="%s"><svg class="btn__sign" viewBox="0 0 64 60" aria-hidden="true" focusable="false"><use href="#sg-warning"/></svg>%s</a>
        </div>
      </div>\n''' % (e(h), e(copy), CONTACT, e(button)))

        if split:
            b.append('      </div>\n')
        b.append('      </div>\n    </div>\n  </section>\n')
        return "".join(b)

    for kind, payload in PAGE:
        if kind == "plain":
            w(section(payload))
            continue
        w('\n  <div class="road-run" data-road-run>\n')
        for item in payload:
            if item[0] == "gap":
                w('    <div class="road-gap %s" data-road="%s" aria-hidden="true"></div>\n'
                  % (item[2], item[1]))
            elif item[0] == "close":
                w(CLOSING % (' data-road="%s"' % item[1]))
            else:
                w(section(item[1], item[2], item[3] if len(item) > 3 else None))
        w('  </div>\n')

    nav = "\n".join(
        '          <li><a class="qa-exits__link" href="#%s" style="--lane:var(%s)">'
        '<span class="qa-exits__chip" aria-hidden="true"></span>%s</a></li>'
        % (s["sid"], LANE_VAR[s["sid"]], e(s["nav"])) for s in CONTENT)

    ld = {
        "@context": "https://schema.org",
        "@type": "FAQPage",
        "mainEntity": [
            {"@type": "Question", "name": q,
             "acceptedAnswer": {"@type": "Answer", "text": a}}
            for q, a in schema
        ],
    }
    return out.getvalue(), nav, json.dumps(ld, ensure_ascii=False, indent=2)

# Nav chips echo the lane colour each section sets on itself.
LANE_VAR = {
    "qa-general": "--blue-700",
    "qa-websites": "--svc-web",
    "qa-video": "--svc-video",
    "qa-advertising": "--svc-social",
    "qa-branding": "--svc-print",
    "qa-print": "--red-600",
    "qa-working": "--green-700",
}

SECTIONS, NAV, JSONLD = render()

TEMPLATE = open(os.path.join(os.path.dirname(os.path.abspath(__file__)),
                             "faq-template.html"), encoding="utf-8").read()

page = (TEMPLATE
        .replace("<!--SECTIONS-->", SECTIONS)
        .replace("<!--NAV-->", NAV)
        .replace("<!--JSONLD-->", JSONLD))

with open(OUT, "w", encoding="utf-8") as f:
    f.write(page)

print("wrote %s — %d questions, %d bytes" % (OUT, len(json.loads(JSONLD)["mainEntity"]), len(page)))
