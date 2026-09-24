#!/usr/bin/env python3
"""Builds faq.html out of HIS artboard.

   The page is not a reconstruction any more. Every band of scenery is a
   slice of QA part 3.svg with a viewBox over that band and everything that
   misses it removed — his paths, his gradients, his text, untouched. The
   only things this file draws are the Q&A cards, because they have to open
   and close, and his drawn ones were cut out of the slices to make room.

   Two kinds of band:
     rigid    his art at its own aspect ratio. Never stretched.
     stretch  the strip his cards stand on. It holds his art at his drawn
              height and, if the answers open past that, keeps going with a
              repeat of its own last inch — so the road and the ground carry
              on rather than the scenery squashing.

   Coordinates are HIS, in the 1441.5-wide page he drew. --u is one of his
   pixels on screen, so every number below is read straight off the artboard.
"""
import html, json, os, re, sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
OUT  = os.path.join(ROOT, "faq.html")

sys.path.insert(0, HERE)
_src = open(os.path.join(HERE, "build-faq.py")).read()
_ns  = {"__name__": "_content_only"}
exec(_src[_src.index("CONTENT = ["):_src.index("LOOK = {")], _ns)
CONTENT = _ns["CONTENT"]

BANDS = json.load(open(os.path.join(HERE, "bands.json")))

PAGE_W   = 1441.5      # the page he drew
ART_W    = 2077.52     # his whole artboard, so the scenery bleeds off a wide window
HDR_H    = 116.0       # his header, which the live one replaces

# ── His cards, measured off the artboard ────────────────────────────────────
#   x/w   where the column sits and how wide it is
#   ch    a shut card
#   gap   between two shut cards
#   face/edge/ink/sub/mark  what he paints them with
SEC = {
 "qa-general":     dict(head="00-general-head",     zone="00-general-cards",
                        x=416.1, w=840.0,  ch=64.5, gap=9.6,
                        face="#fff",    open_face="#deefff", edge="#00287e",
                        ink="#12161c",  sub="#454c57", mark="#00aa56", markink="#fff"),
 "qa-websites":    dict(head="01-websites-head",    zone="01-websites-cards",
                        x=561.7, w=551.8, ch=64.5, gap=9.6,
                        face="transparent", open_face="#0f1c28", edge="#cad9ea",
                        ink="#fff",     sub="#fff",    mark="#00aa56", markink="#fff"),
 "qa-video":       dict(head="02-video-head",       zone="02-video-cards",
                        x=413.2, w=833.5, ch=64.5, gap=18.3,
                        face="transparent", open_face="transparent", edge="#cad9ea",
                        ink="#fff",     sub="#fff",    mark="#00aa56", markink="#fff"),
 "qa-advertising": dict(head="03-advertising-head", zone="03-advertising-cards",
                        x=690.1, w=485.4, ch=64.5, gap=8.8,
                        face="#fff",    open_face="#fff",    edge="#00287e",
                        ink="#12161c",  sub="#454c57", mark="#ffaa00", markink="#fff"),
 "qa-branding":    dict(head="04-branding-head",    zone="04-branding-cards",
                        x=483.1, w=840.0, ch=64.5, gap=11.2,
                        face="#fff",    open_face="#fff",    edge="#cad9ea",
                        ink="#12161c",  sub="#454c57", mark="#00aa56", markink="#fff"),
 "qa-print":       dict(head="05-print-head",       zone="05-print-cards",
                        x=723.9, w=480.8, ch=64.5, gap=11.2,
                        face="#fff",    open_face="#fff",    edge="#dbe3ee",
                        ink="#12161c",  sub="#454c57", mark="#00aa56", markink="#fff"),
}
ORDER = ["qa-general", "qa-websites", "qa-video",
         "qa-advertising", "qa-branding", "qa-print"]

# How short a card strip may go. Only where his ground is solid ALL THE WAY
# ACROSS below the cards: flat black on the two night sections, open water
# under General once his turn has finished at 2103. The other three keep his
# full depth — the advertising strip has a turn in it, branding has the tree
# row and the road, and print has the port. Cropping those cut his port in
# half and chopped the trees mid-trunk.
FLOOR = {"qa-general": 560.0, "qa-websites": 150.0, "qa-video": 470.0}

# His own colour AT the line the crop falls on, sampled down his page margins.
# The base under a cropped strip holds his colour to that point and only then
# ramps to whatever the next band opens on, so the fade has nothing to show.
CROP_COL = {"qa-general": "#002a7e", "qa-websites": "#000000",
            "qa-video": "#1a1d2d"}
TAIL  = ["06-coast-head", "07-coast-tile"]

# ── His buttons and exits, so the art is clickable without being redrawn ────
#   Every box is his own, found by colour and size on the artboard.
BUTTON = {                                  # page x, y, w, h
 "qa-general":     (1034.4, 2509.9, 184.7, 59.6),
 "qa-websites":    ( 599.9, 4336.9, 288.5, 59.6),
 "qa-video":       ( 449.9, 5817.8, 306.9, 59.6),
 "qa-advertising": ( 732.6, 8034.0, 267.0, 59.6),
 "qa-branding":    ( 523.1, 9844.4, 258.0, 59.6),
 "qa-print":       ( 763.9,11712.5, 298.5, 59.6),
}
EXITS_PANEL = (207.6, 1148.4, 1061.0, 197.4)    # his six-cell grid
EXITS_ORDER = ["qa-websites", "qa-video", "qa-advertising",
               "qa-print", "qa-working", "qa-branding"]

CONTACT = "index.html#close"


def e(s):
    return html.escape(str(s), quote=True)


def slug(text, taken):
    s = re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-")[:48] or "q"
    s = "q-" + s
    n, base = 2, s
    while s in taken:
        s, n = f"{base}-{n}", n + 1
    taken.add(s)
    return s


def band(name):
    for b in BANDS:
        if b["name"] == name:
            return b
    raise KeyError(name)


def art(name, cls="qa-art"):
    """His band. A band whose own art tiles side to side is a div with that
       art repeated across the full width at his scale — which is what puts
       his industry, his highway and his trees out to both edges. Every other
       band is his artboard centred, with a strip off his page edge repeated
       behind it so the ground reaches the edges too."""
    b = band(name)
    h = round(b["y1"] - b["y0"], 2)
    if b.get("tile"):
        # The url() goes in the declaration itself, not through a custom
        # property: Chrome resolves a url() held in a custom property against
        # the STYLESHEET that reads it, not the document, so every one of
        # these 404'd as assets/css/assets/art/...
        return (f'      <div class="{cls} {cls}--tile" role="presentation" '
                f'style="--aw:{PAGE_W};--ah:{h};'
                f'background-image:url(assets/art/{name}.svg)"></div>\n')
    return (f'      <img class="{cls}" src="assets/art/{name}.svg" alt="" '
            f'width="{ART_W}" height="{h}" decoding="async">\n')


def base(name):
    """His ground colour down the MARGINS of his own page, sampled top and
       bottom of each band. It sits under the band as its base, so anything
       the edge strip misses falls back on his colour and not on the page
       background. Each band's bottom is the next band's top, so the chain
       is seamless."""
    b = band(name)
    if b.get("tile"):
        # A tiled band paints itself, but his forest floor runs out before
        # the band does — this is his own #275522 under it, not the page's.
        return "background:#275522;"
    if not b.get("top"):
        return ""
    return (f'background:linear-gradient(180deg,{b["top"]} 0%,{b["bot"]} 100%);')


def fill(name):
    b = band(name)
    if b.get("tile"):
        return ""
    return (f'      <span class="qa-fill qa-fill--l" aria-hidden="true" '
            f'style="background-image:url(assets/art/{name}-fillL.svg)"></span>\n'
            f'      <span class="qa-fill qa-fill--r" aria-hidden="true" '
            f'style="background-image:url(assets/art/{name}-fillR.svg)"></span>\n')


def hotspot(box, href, label, cls="qa-hot"):
    x, y, w, h = box
    return (f'      <a class="{cls}" href="{e(href)}" '
            f'style="--hx:{x};--hy:{y};--hw:{w};--hh:{h}">'
            f'<span class="vh">{e(label)}</span></a>\n')


def spots(b):
    """His buttons, each dropped into whichever band its own y lands in, so a
       band is emitted once and a button is never drawn twice."""
    got = []
    for sid, (bx, by, bw, bh) in BUTTON.items():
        if b["y0"] <= by < b["y1"]:
            label = next(c["cta"][2] for c in CONTENT if c["sid"] == sid)
            got.append(hotspot((bx, round(by - b["y0"], 1), bw, bh),
                               CONTACT, label))
    return got


def render():
    taken, out, nav, faqjson = set(), [], [], []

    # the exits panel sits inside the first rigid band, so its links are
    # placed against that band's own top edge
    b0 = band(SEC["qa-general"]["head"])
    ex_x, ex_y, ex_w, ex_h = EXITS_PANEL
    cw, chh = ex_w / 3.0, ex_h / 2.0
    exits = []
    for i, sid in enumerate(EXITS_ORDER):
        col, row = i % 3, i // 3
        title = next(c["nav"] for c in CONTENT if c["sid"] == sid)
        exits.append(hotspot(
            (round(ex_x + col * cw, 1), round(ex_y - b0["y0"] + row * chh, 1),
             round(cw, 1), round(chh, 1)), "#" + sid, title))

    for sid in ORDER:
        c = next(x for x in CONTENT if x["sid"] == sid)
        nav.append((sid, c["nav"]))

        s = SEC[sid]
        hb, zb = band(s["head"]), band(s["zone"])
        out.append(f'  <section class="qa-sec" id="{sid}">\n')
        out.append(f'    <h2 class="vh">{e(c["heading"])}</h2>\n')
        hb0, hb1 = hb["y0"], hb["y1"]
        out.append(f'    <div class="qa-band" data-y0="{hb0}" data-y1="{hb1}" '
                   f'style="{base(s["head"])}">\n')
        out.append(fill(s["head"]))
        out.append(art(s["head"]))
        if sid == "qa-general":
            out += exits
        out += spots(hb)
        out.append('    </div>\n')

        zh = round(zb["y1"] - zb["y0"], 2)
        n = len(c["faqs"])
        zmin = round(max(FLOOR.get(sid, zh),
                         n * s["ch"] + (n - 1) * s["gap"] + 30), 1)
        crop = " qa-zone--crop" if sid in FLOOR else ""
        zbase = base(s["zone"])

        out.append(f'    <div class="qa-zone{crop}" data-y0="{zb["y0"]}" '
                   f'data-y1="{zb["y1"]}" style="--zh:{zh};--zmin:{zmin};'
                   f'--zx:{s["x"]};--zw:{s["w"]};--zgap:{s["gap"]};'
                   f'{zbase}">\n')
        out.append(fill(s["zone"]))
        out.append(art(s["zone"], "qa-zone__art"))
        out.append(cards(c, s, taken, faqjson))
        out.append('    </div>\n  </section>\n')

    for name in TAIL:
        tb = band(name)
        out.append(f'  <div class="qa-band qa-band--tail" data-y0="{tb["y0"]}" '
                   f'data-y1="{tb["y1"]}" style="{base(name)}">\n')
        out.append(fill(name))
        out.append(art(name))
        out += spots(band(name))
        out.append('  </div>\n')

    # He has an exit for Working With Us but never drew the section. Rather
    # than a bare block of cards after his page ends, it is set on his own
    # forest green in his own type, with his heading size, his card column
    # and a CTA panel built to the one he draws for every other section.
    c = next(x for x in CONTENT if x["sid"] == "qa-working")
    nav.append(("qa-working", c["nav"]))
    s = SEC["qa-branding"]          # his 840 column, centred like the others
    head, lead, btn = c["cta"]
    out.append('  <section class="qa-sec qa-sec--own" id="qa-working">\n')
    out.append('    <div class="qa-own">\n')
    out.append(f'      <p class="qa-own__eyebrow">{e(c["eyebrow"])}</p>\n')
    out.append(f'      <h2 class="qa-own__h">{e(c["heading"])}</h2>\n')
    out.append(f'      <p class="qa-own__lead">{e(c["lead"])}</p>\n')
    out.append(f'      <div class="qa-zone qa-zone--plain" style="--zh:0;'
               f'--zx:{s["x"]};--zw:{s["w"]};--zgap:{s["gap"]}">\n')
    out.append(cards(c, s, taken, faqjson))
    out.append('      </div>\n')
    out.append('      <div class="qa-own__cta">\n'
               f'        <div><h3>{e(head)}</h3><p>{e(lead)}</p></div>\n'
               f'        <a class="qa-own__btn" href="{e(CONTACT)}">{e(btn)}</a>\n'
               '      </div>\n')
    out.append('    </div>\n  </section>\n')

    return "".join(out), nav, faqjson


def cards(c, s, taken, faqjson):
    rows = ['      <ol class="qa-list">\n']
    for q, body in c["faqs"]:
        qid = slug(q, taken)
        paras = "".join(f"<p>{e(p)}</p>" for p in body)
        faqjson.append({"@type": "Question", "name": q,
                        "acceptedAnswer": {"@type": "Answer",
                                           "text": " ".join(body)}})
        rows.append(
            f'        <li class="qa-item" id="{qid}">\n'
            f'          <h3><button class="qa-q" type="button" id="{qid}-q" '
            f'aria-expanded="true" aria-controls="{qid}-a">'
            f'<span>{e(q)}</span>'
            f'<span class="qa-marker" aria-hidden="true"></span></button></h3>\n'
            f'          <div class="qa-panel" id="{qid}-a" role="region" '
            f'aria-labelledby="{qid}-q"><div><div class="qa-a">{paras}</div></div></div>\n'
            f'        </li>\n')
    rows.append('      </ol>\n')
    return "".join(rows)


SECTIONS, NAV, FAQ = render()

TEMPLATE = open(os.path.join(HERE, "page-template.html")).read()
navhtml = "".join(
    f'<li><a href="#{sid}">{e(t)}</a></li>' for sid, t in NAV)
jsonld = json.dumps({"@context": "https://schema.org",
                     "@type": "FAQPage", "mainEntity": FAQ},
                    ensure_ascii=False, separators=(",", ":"))

ROUTES = json.load(open(os.path.join(HERE, "routes.json")))
routes_js = ("window.H19_ROUTES=" +
             json.dumps(ROUTES, separators=(",", ":")) + ";")

doc = (TEMPLATE
       .replace("<!--ROUTES-->", routes_js)
       .replace("<!--SECTIONS-->", SECTIONS)
       .replace("<!--NAV-->", navhtml)
       .replace("<!--JSONLD-->", jsonld))
open(OUT, "w").write(doc)
qn = sum(len(c["faqs"]) for c in CONTENT if c["sid"] in ORDER + ["qa-working"])
print(f"wrote {OUT} — {qn} questions, "
      f"{len(BANDS)} bands of his art, {len(doc)} bytes")
