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
TAIL  = "06-tail"

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
    b = band(name)
    h = round(b["y1"] - b["y0"], 2)
    return (f'      <img class="{cls}" src="assets/art/{name}.svg" alt="" '
            f'width="{ART_W}" height="{h}" decoding="async">\n')


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
        out.append('    <div class="qa-band">\n')
        out.append(art(s["head"]))
        if sid == "qa-general":
            out += exits
        out += spots(hb)
        out.append('    </div>\n')

        zh = round(zb["y1"] - zb["y0"], 2)
        out.append(f'    <div class="qa-zone" style="--zh:{zh};--zx:{s["x"]};'
                   f'--zw:{s["w"]};--zgap:{s["gap"]}">\n')
        out.append(art(s["zone"], "qa-zone__art"))
        out.append(cards(c, s, taken, faqjson))
        out.append('    </div>\n  </section>\n')

    out.append('  <div class="qa-band qa-band--tail">\n')
    out.append(art(TAIL))
    out += spots(band(TAIL))
    out.append('  </div>\n')

    # He has an exit for Working With Us but never drew the section, so it
    # goes after his page ends, on his own colours, rather than on art he
    # did not make.
    c = next(x for x in CONTENT if x["sid"] == "qa-working")
    nav.append(("qa-working", c["nav"]))
    s = SEC["qa-print"]
    out.append('  <section class="qa-sec" id="qa-working">\n')
    out.append(f'    <h2 class="vh">{e(c["heading"])}</h2>\n')
    out.append(f'    <div class="qa-zone qa-zone--plain" style="--zh:0;'
               f'--zx:{s["x"]};--zw:{s["w"]};--zgap:{s["gap"]}">\n')
    out.append(cards(c, s, taken, faqjson))
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

doc = (TEMPLATE
       .replace("<!--SECTIONS-->", SECTIONS)
       .replace("<!--NAV-->", navhtml)
       .replace("<!--JSONLD-->", jsonld))
open(OUT, "w").write(doc)
qn = sum(len(c["faqs"]) for c in CONTENT if c["sid"] in ORDER + ["qa-working"])
print(f"wrote {OUT} — {qn} questions, "
      f"{len(BANDS)} bands of his art, {len(doc)} bytes")
