#!/usr/bin/env python3
"""Builds faq.html from his eight artboards plus the card geometry lifted off them."""
import json, subprocess, base64, hashlib, os, re, html, statistics
ROOT='/home/user/highway19media'
HERE=os.path.dirname(os.path.abspath(__file__))
cards=json.load(open(f'{HERE}/cards.json',encoding='utf-8'))
mark=json.load(open(f'{HERE}/markers.json',encoding='utf-8'))
links=json.load(open(f'{HERE}/links.json',encoding='utf-8'))
flex=json.load(open(f'{HERE}/flex.json',encoding='utf-8'))

FAM={'Arial-BoldMT':"Arial,Arimo,Helvetica,sans-serif",
     'BeVietnamPro-Light':"'Be Vietnam Pro',sans-serif",
     'BeVietnamPro-Medium':"'Be Vietnam Pro',sans-serif",
     'BeVietnamPro-SemiBold':"'Be Vietnam Pro',sans-serif",
     'BeVietnamPro-ExtraBold':"'Be Vietnam Pro',sans-serif"}
WGT={'Arial-BoldMT':700,'BeVietnamPro-Light':300,'BeVietnamPro-Medium':500,
     'BeVietnamPro-SemiBold':600,'BeVietnamPro-ExtraBold':800}

def med(v): 
    v=sorted(v); return v[len(v)//2]

def esc(s): return html.escape(s,quote=False)
def U(n): return f'calc({n}*var(--u))'

def span(lab, sub):
    """x-range of a substring inside one of his kerned <text> runs"""
    if not lab.get('sp'): return lab['x'], lab['x']+lab['w']
    acc=''; x0=None; x1=None
    for u in lab['sp']:
        t=u['t']
        if not t.strip(): continue
        start=len(acc); acc+=t; end=len(acc)
        i=lab['t'].replace(' ','').find(sub.replace(' ','')) if False else None
    # walk again on the raw concatenation
    raw=''.join(u['t'] for u in lab['sp'])
    i=raw.find(sub)
    if i<0: return lab['x'], lab['x']+lab['w']
    j=i+len(sub); pos=0
    for u in lab['sp']:
        a=pos; b=pos+len(u['t']); pos=b
        if b<=i or a>=j: continue
        if x0 is None or u['x']<x0: x0=u['x']
        if x1 is None or u['x']+u['w']>x1: x1=u['x']+u['w']
    return (x0 if x0 is not None else lab['x']), (x1 if x1 is not None else lab['x']+lab['w'])

def hotspots(d):
    out=[]
    for spec in links.get(d['k'],[]):
        key=spec.get('in') or spec.get('text')
        lab=next((l for l in d['labels'] if l['t']==key), None)
        if lab is None:
            lab=next((l for l in d['labels'] if l['t'].startswith(key[:18])), None)
        if lab is None: continue
        if spec.get('find'):
            x0,x1=span(lab,spec['find']); y0,y1=lab['y'],lab['y']+lab['h']
        else:
            x0,x1,y0,y1=lab['x'],lab['x']+lab['w'],lab['y'],lab['y']+lab['h']
        px=spec.get('padx',14); py=spec.get('pady',10)
        out.append('<a class="hot" href="%s" aria-label="%s" style="left:calc(50%% - var(--half) + %s);top:%s;width:%s;height:%s"></a>'
                   %(spec['href'], esc(spec.get('label') or spec.get('find') or spec['text']),
                     U(round(x0-px,1)), U(round(y0-py,1)), U(round((x1-x0)+2*px,1)), U(round((y1-y0)+2*py,1))))
    return out

SEC=[]
for k in sorted(cards):
    S=cards[k]; cs=S['cards']
    d=dict(k=k,h=S['h'],cards=cs,labels=S.get('labels',[]),sign=S.get('sign'),
           cta=(S['panels'][-1] if S.get('panels') else None))
    if cs:
        shut=[c for c in cs if not c['open']]
        openc=[c for c in cs if c['open']][0]
        d['x']=med([c['x'] for c in cs]); d['w']=med([c['w'] for c in cs])
        d['y']=cs[0]['y']
        d['shut']=med([c['h'] for c in shut]) if shut else 64.5
        d['gap']=med([round(cs[i+1]['y']-cs[i]['y']-cs[i]['h'],2) for i in range(len(cs)-1)]) if len(cs)>1 else 9.6
        if d['gap']<0: d['gap']=9.6
        d['pad']=round(openc['qx']-openc['x'],2)
        d['qsize']=openc['qsize']; d['qfam']=openc['qfam']; d['qfill']=openc['qfill']
        d['bsize']=openc['bsize'] or 16; d['bfam']=openc['bfam'] or 'BeVietnamPro-SemiBold'
        d['bfill']=openc['bfill'] or '#454c57'
        d['blead']=openc['blead'] or 27.52
        d['bodytop']=round(openc['by']-openc['y'],2)
        d['qtop']=round(openc['qy']-openc['y'],2)
        bl=openc['blines'][-1]
        d['botpad']=round(openc['y']+openc['h']-(bl['y']+bl['h']),2)
        d['fill']=('none' if openc['fill'] in ('none',) else (shut[0]['fill'] if shut else openc['fill']))
        d['fillopen']=openc['fill']
        d['stroke']=openc['stroke'] or (shut[0]['stroke'] if shut else None)
        d['m']=mark[k]
    SEC.append(d)

# his mobile sections carry the same questions as his desktop ones, so the
# answers are looked up by the artboard they belong to
cardsrc={d['k']:d['cards'] for d in SEC}

# ---------- CSS ----------
css=["""/* Highway 19 Media — Q&A. His artboards, placed. Live cards only. */
@font-face{font-family:'Be Vietnam Pro';src:url(../fonts/bvp-300.woff2) format('woff2');font-weight:300;font-display:block}
@font-face{font-family:'Be Vietnam Pro';src:url(../fonts/bvp-500.woff2) format('woff2');font-weight:500;font-display:block}
@font-face{font-family:'Be Vietnam Pro';src:url(../fonts/bvp-600.woff2) format('woff2');font-weight:600;font-display:block}
@font-face{font-family:'Be Vietnam Pro';src:url(../fonts/bvp-800.woff2) format('woff2');font-weight:800;font-display:block}
@font-face{font-family:'Be Vietnam Pro';src:url(../fonts/bvp-900.woff2) format('woff2');font-weight:900;font-display:block}
@font-face{font-family:'Arimo';src:url(../fonts/arimo-700.woff2) format('woff2');font-weight:700;font-display:block}
/* his Illustrator PostScript names, so his own <text> resolves */
@font-face{font-family:'BeVietnamPro-Light';src:url(../fonts/bvp-300.woff2) format('woff2');font-display:block}
@font-face{font-family:'BeVietnamPro-Medium';src:url(../fonts/bvp-500.woff2) format('woff2');font-display:block}
@font-face{font-family:'BeVietnamPro-SemiBold';src:url(../fonts/bvp-600.woff2) format('woff2');font-display:block}
@font-face{font-family:'BeVietnamPro-ExtraBold';src:url(../fonts/bvp-800.woff2) format('woff2');font-display:block}
@font-face{font-family:'BeVietnamPro-Black';src:url(../fonts/bvp-900.woff2) format('woff2');font-display:block}
@font-face{font-family:'Arial-BoldMT';src:local('Arial Bold'),local('Arial-BoldMT'),url(../fonts/arimo-700.woff2) format('woff2');font-display:block}

/* one unit is one of his artboard pixels. Never larger than a screen pixel,
   so his art is only ever shown at his scale or smaller - never enlarged. */
:root{--u:min(1px, 100vw / 1960);--art:calc(2128*var(--u));--half:calc(1064*var(--u));
      --wide:calc(3088*var(--u));
/* THE HOME PAGE'S OWN TOKENS, copied off build/v2 rather than matched by eye,
   so every piece of chrome on this page - the panels, the buttons, the plus
   marks, the ink - is the same colour it is over there. Its body type is 450
   at 1.62, not 300: the light weight is what made these answers look thin. */
      --h19-blue-900:#062f5e; --h19-blue-700:#12569f;
      --h19-green-500:#059236; --h19-sign-green:#1c9022;
      --h19-yellow-500:#ffc72c;
      --h19-ink:#12161c; --h19-ink-soft:#454c57;
      --h19-font:"Be Vietnam Pro","Helvetica Neue",Helvetica,Arial,system-ui,sans-serif}

*{box-sizing:border-box}
/* ANDROID WAS GROWING HIS TYPE BEHIND OUR BACK. A WebView inflates text it
   decides is a block of reading, by a factor it works out from the box it is
   in - which is why the plus marks measured exactly the 24px they are set to
   while the button's lettering measured 23 where it is set to 14. Every
   question overflowed its card and every button wrapped, and no size set
   here could have fixed it: the bigger the type, the bigger the boost.
   Text is shown at the size it is set to. */
html{background:#00287e;-webkit-text-size-adjust:100%;text-size-adjust:100%}
body{margin:0;background:#00287e;overflow-x:hidden;-webkit-font-smoothing:antialiased}
#page{overflow:hidden}

.sec{position:relative;width:100%;height:var(--h);overflow:hidden}
/* HIS ARTBOARDS ARE FRACTIONAL HEIGHTS, so two of them stacked leave a
   sub-pixel row where the page shows through and his road grows a hairline.
   Each section is pulled up onto the one above by a pixel; the art runs
   straight across the join, so the pixel it covers is the same pixel. */
.sec + .sec{margin-top:-2px}
.art{position:absolute;top:0;left:50%;width:var(--wide);height:var(--h);margin-left:calc(0px - var(--wide)/2);z-index:1}
.art>svg{display:block;width:var(--wide);height:var(--h)}

/* the flanks: every row of his own edge carried outward on its own rhythm */
.bleed{position:absolute;top:0;height:var(--h);width:calc(50vw - var(--half) + 8*var(--u));z-index:0;
       pointer-events:none;background-repeat:repeat-x;
       background-size:calc(480*var(--u)) calc(var(--hraw)*var(--u))}
.bleed--l{right:calc(50% + var(--half) - 4*var(--u));background-position:right top}
.bleed--r{left:calc(50% + var(--half) - 4*var(--u));background-position:left top}
/* flex sections split their flank the same way they split his art */
.bleed--a{height:var(--seam);overflow:hidden}
.bleed--b{top:calc(var(--seam) + var(--flex,0px));height:calc(var(--hraw)*var(--u) - var(--seam));
          background-position-y:calc(0px - var(--seam))}
.bleed--b.bleed--l{background-position-x:right}
.bleed--b.bleed--r{background-position-x:left}

/* ---- HIS MOBILE ARTBOARDS -------------------------------------------
   The column he drew IS the page: it spans the window exactly, and the
   road and the gantry he ran out past it bleed off the sides, the same
   way his desktop bleed does. Every length is a ratio of his own numbers
   to that column, so it is his drawing at whatever width the phone is.

   Where he drew question cards into the art they have been lifted out and
   rebuilt as real ones - an answer has to open and shut - so the artboard
   is served in two strips with the cards standing between them, and the
   section takes whatever height the open answer needs. */
.msec{display:none;position:relative;width:100%;overflow:hidden;
      --mu:calc(100vw / var(--mbc))}
.msec + .msec{margin-top:-2px}
.mstrip{position:relative;width:100%;overflow:hidden;
        height:calc(var(--mbs) * var(--mu))}
.mstrip>svg{display:block;position:absolute;
            left:calc(0px - var(--mbx) * var(--mu));
            top:calc(0px - var(--mbo) * var(--mu));
            width:calc(var(--mbw) * var(--mu));height:auto}

/* his cards, at his width, on the ground he drew behind them */
.mcol{position:relative;width:100%;
      padding:0 calc((var(--mbc) - var(--cw) - var(--cx)) * var(--mu))
              0 calc(var(--cx) * var(--mu));
      background:linear-gradient(var(--cb1),var(--cb2))}
.mcol .qa{border-width:1px}
.mcol .qa:last-child{margin-bottom:0}

/* the sections he has not drawn yet: his road and his board at the top, then
   his heading, his cards and his panel, on the run of colour his desktop
   page makes between one artboard and the next */
/* HIS COLOUR, HELD, AND ONLY HANDED OVER AT THE FOOT. Running one of his
   ends straight into the other paints the middle of the section a mud
   halfway between them - sand into green comes out olive. His desert stays
   his desert and meets the green at the join, the way his desktop does. */
.msec--gen{background:linear-gradient(var(--bg1) 0, var(--body) 9%, var(--body) 78%, var(--bg2) 97% 100%)}
.mtop{position:relative;width:100%}
.mtop>svg{display:block;width:100%;height:auto}
.mhead{padding:var(--headgap) var(--headx) 0;color:var(--ink)}
.mhead h2{margin:0;font-family:var(--h19-font);font-weight:800;
          font-size:var(--hsize);line-height:var(--hlead);letter-spacing:-.022em}
.mhead p{margin:18px 0 0;font-family:var(--h19-font);
         font-weight:450;font-size:var(--lsize);line-height:var(--llead)}
/* ONE LINE DOWN THE SECTION. His cards ran on his own gutter and the panel
   under them on another, so the two stood 20px apart down the page. In the
   sections composed from his parts they share the one gutter. */
.mcol--gen{margin-top:var(--headgap);padding-left:var(--padx);padding-right:var(--padx)}
.mcta{padding:var(--ctagap) var(--padx) 0}
.mcta-p{border-radius:10px;background:var(--h19-blue-700);
        border:1px solid #fff;text-align:center;
        padding:var(--ctapadt) 20px var(--ctapadb)}
.mcta-p strong{display:block;font-family:var(--h19-font);font-weight:800;
               font-size:var(--ctat);line-height:1.18;color:#fff;letter-spacing:-.018em}
.mcta-p span{display:block;margin-top:10px;
             font-family:var(--h19-font);font-weight:450;
             font-size:var(--ctas);line-height:1.55;color:#fff}
/* THE BUTTON IS A BOX ITS WORDS SIT IN, not a line of a fixed height. Its
   line-height was the whole height of the button, so the moment the words
   went to two lines it opened to twice that with a chasm down the middle.
   It centres them instead, and grows only if it has to. */
.mbtn{display:flex;align-items:center;justify-content:center;
      margin:18px auto 0;width:100%;max-width:var(--btnw);
      min-height:var(--btnh);padding:12px 18px;border-radius:8px;
      background:var(--h19-yellow-500);border:2px solid var(--h19-ink);
      font-family:var(--h19-font);font-weight:800;font-style:normal;
      font-size:var(--btn);line-height:1.25;color:var(--h19-ink);
      letter-spacing:.035em;text-transform:uppercase;text-align:center}
.mtail{height:var(--tail)}

/* ---- THE SITE'S OWN CHROME, ON THIS PAGE -------------------------------
   HE DREW THE BAR INTO HIS ARTBOARD, so the real one stands exactly on top
   of it rather than pushing his page down. It was not a guess that the two
   line up: his band is 116 of his 2128 units, and the art is shown at
   100vw/1960 per unit, so his bar is 5.918vw tall - where header.css sets
   the real one to clamp(66px, 5.943vw, 124px). The same height to within
   half a percent at every width between the clamps, and taller than his
   outside them, so his drawing is covered and never peeps out below.
   Pushing the page down instead would have left his own bar showing under
   the real one, and his bleed strips - which are his edge columns, drawn
   before any of this - carry that band out to the sides whatever the page
   does. */
/* HIS PAGE'S HEADING IS A DRAWING - the blue board at the top of his first
   artboard - and a drawing is not a heading. This says the same words off
   screen, so a reader using a screen reader and a crawler building an outline
   both get the sentence a visitor sees. */
.qa-sr{position:absolute;width:1px;height:1px;margin:-1px;padding:0;overflow:hidden;
       clip:rect(0 0 0 0);clip-path:inset(50%);white-space:nowrap;border:0}
/* the question IS the heading; the button inside it keeps every measurement */
.qa-h{margin:0;padding:0;font:inherit;color:inherit;display:block}
#page{background:#002e79}
/* header.css pads the body by the bar's height so a page starts under it.
   Here that would stand the real bar on top of his drawn one and show both.
   Only above the phone breakpoint: his mobile artboards carry no bar, so
   there the site's own padding is exactly right. */
@media (min-width:901px){ body{padding-top:0} }

/* HIS CONTACT CARD, on his interstate blue. The bar's Contact button points
   at #contact on every page of this site; the card is the same file the home
   page and the holding page use, and only its colours are set here - the
   same values the holding page gives it, which are his. */
.qa-form{background:#00287e;scroll-margin-top:calc(var(--hh,66px) + 12px);
         padding:clamp(34px,6vw,78px) clamp(16px,4vw,40px) clamp(56px,9vw,120px)}
.qa-form .fcard{--fc-paper:#e9eaea;--fc-say-bg:#001328;--fc-say-ink:#fff;
  --fc-ink:#123a7a;--fc-ask-ink:#476698;--fc-ico:#3d5f9b;--fc-alt-ink:#4e6589;
  --fc-rule:#4266a4;--fc-rule-on:#12569f;--fc-edge:transparent;--fc-link:#123a7a;
  --fc-btn:#ffc72c;--fc-btn-ink:#12161c;--fc-btn-hi:#ffd45c;
  --fc-ok:#7ee0a4;--fc-err:#ff9aa1;--fc-cast:0 22px 50px rgba(0,0,0,.55);
  --fc-fs:clamp(.84rem,.92vw,.94rem)}

@media (max-width:900px){
  #page > .sec{display:none}
  .msec{display:block}
}

.col{position:absolute;z-index:2;top:var(--y);left:50%;width:var(--w);
     margin-left:calc(0px - var(--half) + var(--x))}

.qa{background:var(--fill);border-radius:var(--rad,10px);margin-bottom:var(--gap);
    border:1px solid var(--stroke);overflow:hidden;
    transition:background-color .28s ease}
.qa[data-nostroke]{border-color:transparent}
.qa.is-open{background:var(--fill-open)}

.qa-q{display:flex;align-items:center;width:100%;min-height:var(--shut);
      margin:0;background:none;border:0;cursor:pointer;text-align:left;
      /* A QUESTION THAT RUNS TO THREE LINES HAS TO HAVE ROOM ABOVE AND
         BELOW IT. There was none: the shut card was a fixed height with a
         centred line in it, so the moment the words outgrew that height they
         went straight to both edges and sat against the corners. The card
         takes its height from the words now and keeps its padding either
         way - his desktop cards are measured off his artboard, so the
         padding is nothing there unless it is asked for. */
      padding:var(--qpy,0px) var(--qpr) var(--qpy,0px) var(--pad);position:relative;
      font-family:var(--qfam);font-weight:var(--qwgt,700);font-size:var(--qsize);
      line-height:var(--qlead);color:var(--qfill);letter-spacing:var(--qls,0)}
.qa-q::-moz-focus-inner{border:0}
.qa-q:focus-visible{outline:2px solid #ffce00;outline-offset:-3px}

.qa.is-open .qa-q{min-height:0;align-items:flex-start;
      padding-top:var(--qtop);padding-bottom:0}
.qa-m{position:absolute;right:var(--minset);top:calc(var(--shut)/2);
      width:var(--mw);height:var(--mw);margin-top:calc(var(--mw)/-2);
      border-radius:50%;background:var(--mfill);border:var(--msw) solid var(--mstroke);
      pointer-events:none}
.qa-m::before,.qa-m::after{content:'';position:absolute;left:50%;top:50%;
      background:var(--gcol);transition:transform .28s ease,opacity .28s ease}
.qa-m::before{width:var(--gw);height:var(--gsw);margin:calc(var(--gsw)/-2) 0 0 calc(var(--gw)/-2)}
.qa-m::after{width:var(--gsw);height:var(--gw);margin:calc(var(--gw)/-2) 0 0 calc(var(--gsw)/-2)}
.qa.is-open .qa-m::after{transform:scaleY(0);opacity:0}

.qa-a{display:grid;grid-template-rows:0fr;transition:grid-template-rows .3s ease}
.qa.is-open .qa-a{grid-template-rows:1fr}
.qa-ai{overflow:hidden}
.qa-a p{margin:0;padding:0 var(--pad);
    font-family:var(--bfam);font-weight:var(--bwgt);font-size:var(--bsize);
    line-height:var(--blead);color:var(--bfill)}
.qa.is-open .qa-m{top:calc(var(--qtop) + var(--qlead)/2)}
.qa-a p:first-child{padding-top:var(--atop)}
.qa-a p:last-child{padding-bottom:var(--abot)}
.qa-a p+p{padding-top:var(--blead)}

.sec[data-flex]{height:calc(var(--h) + var(--flex,0px))}
.art-a{position:absolute;top:0;left:50%;width:var(--wide);margin-left:calc(0px - var(--wide)/2);overflow:hidden;z-index:1}
.art-b{position:absolute;left:50%;width:var(--wide);margin-left:calc(0px - var(--wide)/2);
       top:calc(var(--seam) + var(--flex,0px));z-index:1}
.art-a>svg{display:block;width:var(--wide);height:var(--seam)}
.art-b>svg{display:block;width:var(--wide);height:var(--tail)}
/* his traffic, his ship, his planes - his own artwork, set moving */
.run{transform-box:view-box;will-change:transform}
.run[data-axis="x"]{animation:h19x var(--dur) linear var(--dly) infinite}
.run[data-axis="y"]{animation:h19y var(--dur) linear var(--dly) infinite}
.run[data-axis="xy"]{animation:h19xy var(--dur) linear var(--dly) infinite}
.run--fade{animation-name:h19xy,h19fade;animation-duration:var(--dur),var(--dur)}
@keyframes h19x{from{transform:translateX(var(--a))}to{transform:translateX(var(--b))}}
@keyframes h19y{from{transform:translateY(var(--a))}to{transform:translateY(var(--b))}}
@keyframes h19xy{from{transform:translate(var(--ax),var(--ay))}
                 to{transform:translate(var(--bx),var(--by))}}
@keyframes h19fade{0%{opacity:0}8%{opacity:1}62%{opacity:1}88%{opacity:0}100%{opacity:0}}
@media (prefers-reduced-motion:reduce){.run{animation:none!important}}

.hot{position:absolute;z-index:3;display:block;border-radius:6px}
.hot:focus-visible{outline:2px solid #ffce00;outline-offset:2px}
"""]

for d in SEC:
    if not d['cards']: continue
    m=d['m']
    mw=m['disc'] or m['glyph']*1.9
    css.append(f""".col--{d['k']}{{
 --x:{U(d['x'])}; --y:{U(d['y'])}; --w:{U(d['w'])}; --gap:{U(d['gap'])}; --shut:{U(d['shut'])};
 --pad:{U(d['pad'])}; --qpr:{U(round(d['pad']+mw,2))};
 --qfam:{FAM[d['qfam']]}; --qsize:{U(d['qsize'])}; --qlead:{U(19)}; --qfill:{d['qfill']};
 --bfam:{FAM[d['bfam']]}; --bwgt:{WGT[d['bfam']]}; --bsize:{U(d['bsize'])};
 --blead:{U(d['blead'])}; --bfill:{d['bfill']};
 --qtop:{U(d['qtop'])}; --atop:{U(round(d['bodytop']-d['qtop']-19,2))}; --abot:{U(d['botpad'])};
 --fill:{d['fill']}; --fill-open:{d['fillopen']}; --stroke:{d['stroke'] or 'transparent'};
 --mw:{U(round(mw,2))}; --minset:{U(m['inset'])};
 --mfill:{m['discFill'] or 'transparent'}; --mstroke:{m['discStroke'] or 'transparent'};
 --msw:{U(m['discSW'])}; --gcol:{m['glyphCol']}; --gw:{U(m['glyph'])}; --gsw:{U(m['glyphSW'])};
}}""")
# HIS SECTIONS RUN INTO ONE ANOTHER. Each one is backed by the gradient
# between the colour his artboard above finishes on and the colour this one
# finishes on, so any sub-pixel row the browser leaves between two fractional
# heights shows his sky carrying on rather than the page behind it.
_EDGE=json.load(open(f'{HERE}/edgecols.json',encoding='utf-8')) \
      if os.path.exists(f'{HERE}/edgecols.json') else {}
_prev=None
for _d in SEC:
    _e=_EDGE.get(_d['k'])
    if not _e: continue
    css.append('.sec--%s{background:linear-gradient(%s,%s)}'%(_d['k'],_prev or _e[0],_e[1]))
    _prev=_e[1]
open(f'{ROOT}/assets/css/qa.css','w',encoding='utf-8').write('\n'.join(css))

# ---------- HTML ----------
BLEED=480          # units of his art shown either side of the artboard
# HIS MOBILE ARTBOARDS. He draws them trimmed to what is on them, so the blue
# column - the page itself - is a window inside the artboard and his roads and
# his gantry hang out past it. Those four numbers per section are measured off
# his own ocean shape: where the column starts, how wide it is, how tall it is,
# and how wide the whole artboard is around it.
MOB=[
 {'k':'m1','f':'m-sec-1.svg','w':1516.19,'h':2045.63,'cx':225.79,'cw':1073.60,'ch':1929.80,
  # THE SAME FAULT AS HIS DESKTOP HERO, drawn the same way: a vertical wash
  # over a horizontal sea, faded out going down, so the foot of his column is
  # the horizontal one and met the flat colour the next artboard starts on.
  'joinBelow':'#045dc3','joinFade':380},

 {'k':'m2','f':'m-sec-2.svg','w':1153.43,'h':4611.60,'cx':0.0,'cw':1089.60,'ch':4611.60,
  'src':'02','top':2719.95,'bot':3905.17,'bg':('#00287c','#002375'),
  'card':{'x':54.34,'fill':'#ffffff','open':'#f1f7ff','stroke':'#cfdcee',
          'q':'#12161c','a':'#454c57','cx':982.92}},

 {'k':'m4','f':'m-sec-4.svg','w':1122.01,'h':3362.80,'cx':0.0,'cw':1093.20,'ch':3362.80,
  'src':'03','top':1607.96,'bot':2793.17,'bg':('#000000','#000000'),
  'card':{'x':59.14,'fill':'#0e1a27','open':'#16283a','stroke':'#33475c',
          'q':'#ffffff','a':'#c7d3e0','cx':987.72}},
]

# HIS CARD, MEASURED OFF THE ONES HE DREW - with a floor under every length.
# He draws the mobile artboard at about two and a half times phone size, so
# taken at face value his card comes out at eleven pixels of type inside
# eighteen pixels of padding on a 390 phone, which is not readable. Each
# length is his own number in his own units OR the floor below, whichever is
# larger: on a wide phone his drawing wins, on a narrow one the floor does,
# and the card never shrinks under the size it can be read at.
# HIS CARD AT PHONE SIZE, not at his artboard's.
# His mobile artboard is drawn about two and a half times a phone, so every
# length on it taken literally gives 11px type inside 18px of padding. These
# are phone numbers, set against what the accordion pattern settles on - 48px
# is the floor for a tap target, 16-20px of padding, an icon of 16 to 20 -
# and against his own proportions, not instead of them.
#
# THE STEP BETWEEN QUESTION AND ANSWER IS SMALL, about 1.1. The two sit
# touching, so the weight and the colour separate them; a big jump in size
# reads as shouting. 600 on the question, not 700 - 700 is a headline weight
# and at sixteen pixels it screams.
#
# AND THEY ARE ROUNDED, NOT STADIUMS. A pill is a button. These are
# containers that grow to three lines, and a full round on a three-line box
# bows the sides in around the words. 12px, which is the roundness his own
# guide sign carries on the home page.
MCARD={'w':969.75,
 'shut':'54px','gap':'9px','pad':'16px','qpr':'50px','rad':'8px','qpy':'13px',
 'qsize':'clamp(14.5px,3.78vw,15.5px)','qlead':'calc(var(--qsize)*1.4)','qtop':'14px',
 'atop':'8px','abot':'16px',
 'bsize':'clamp(13.8px,3.55vw,14.5px)','blead':'calc(var(--bsize)*1.64)',
 'mw':'22px','gw':'9.5px','gsw':'1.7px','minset':'14px'}

def mcardvars(K=None):
    K=K or MCARD
    return (f'--shut:{K["shut"]};--gap:{K["gap"]};--pad:{K["pad"]};--qpr:{K["qpr"]};'
            f'--qsize:{K["qsize"]};--qlead:{K["qlead"]};--qtop:{K["qtop"]};'
            f'--atop:{K["atop"]};--abot:{K["abot"]};'
            f'--bsize:{K["bsize"]};--blead:{K["blead"]};'
            f'--mw:{K["mw"]};--gw:{K["gw"]};--gsw:{K["gsw"]};--minset:{K["minset"]};'
            f'--qpy:{K["qpy"]};'
            f'--rad:{K["rad"]};--msw:0px;--mstroke:transparent;'
            f'--qfam:var(--h19-font);--qwgt:600;--qls:-.006em;'
            f'--bfam:var(--h19-font);--bwgt:450;'
            f'--mfill:var(--h19-green-500);--gcol:#fff')

def msvg_of(m):
    s=open(f"{ROOT}/assets/scene/{m['f']}",encoding='utf-8').read()
    s=re.sub(r'^<\?xml[^>]*\?>\s*','',s)
    s=s.replace('id="Layer_2"',f"id=\"art-{m['k']}\"")
    ids=set(re.findall(r'\sid="([^"]+)"',s))
    for i in sorted(ids,key=len,reverse=True):
        if i==f"art-{m['k']}": continue
        s=s.replace(f'id="{i}"',f"id=\"{m['k']}_{i}\"")
        s=s.replace(f'url(#{i})',f"url(#{m['k']}_{i})")
        s=s.replace(f'xlink:href="#{i}"',f"xlink:href=\"#{m['k']}_{i}\"")
        s=s.replace(f'href="#{i}"',f"href=\"#{m['k']}_{i}\"")
    if m.get('joinBelow'):
        gid=f"{m['k']}_joinfade"
        y0=round(m['ch']-m['joinFade'],2)
        grad=(f'<linearGradient id="{gid}" gradientUnits="userSpaceOnUse"'
              f' x1="0" y1="{y0}" x2="0" y2="{m["ch"]}">'
              f'<stop offset="0" stop-color="{m["joinBelow"]}" stop-opacity="0"/>'
              f'<stop offset="1" stop-color="{m["joinBelow"]}" stop-opacity="1"/>'
              '</linearGradient>')
        s=s.replace('</defs>', grad+'</defs>', 1)
        # a copy of his own sea shape, so nothing but his water is touched
        mo=re.search(r'<polygon id="%s_ocean"[^>]*?points="([^"]*)"[^>]*>'%m['k'], s)
        last=re.search(r'<polygon id="%s_ocean-2"[^>]*?>'%m['k'], s) or mo
        if mo and last:
            veil=f'<polygon points="{mo.group(1)}" fill="url(#{gid})"/>'
            s=s[:last.end()]+veil+s[last.end():]
    # his own width/height attributes would fight the column fit
    s=re.sub(r'\swidth="[\d.]+"','',s,count=1)
    s=re.sub(r'\sheight="[\d.]+"','',s,count=1)
    return unembed(s)

# HIS RASTERS COME OUT OF THE MARKUP.
# Illustrator embeds a placed image as base64 inside the SVG. On this page the
# same 711x713 drawing was embedded three times, a fifth of a megabyte apiece,
# and base64 is the one thing on the page that does not compress - 618 KB of
# the document, and a browser cannot cache any of it separately from the page.
# Written out once, by the hash of its own bytes, and referred to by name: the
# three copies become one file a reader downloads once and never asks for
# again.
_EMB={}
def unembed(svg):
    def out(m):
        kind, b64 = m.group(1), m.group(2)
        raw = base64.b64decode(b64)
        h = hashlib.sha1(raw).hexdigest()[:10]
        ext = {'jpeg':'jpg','svg+xml':'svg'}.get(kind, kind)
        name = f'emb-{h}.{ext}'
        # tools/qa/embwebp.js turns these into webp once; when it has, that is
        # what the page asks for - a fifth of the bytes for the same drawing
        web = f'emb-{h}.webp'
        if os.path.exists(f'{ROOT}/assets/img/{web}'):
            return f'"assets/img/{web}"'
        if name not in _EMB:
            with open(f'{ROOT}/assets/img/{name}','wb') as f: f.write(raw)
            _EMB[name]=len(raw)
        return f'"assets/img/{name}"'
    return re.sub(r'"data:image/([a-z+]+);base64,([^"]+)"', out, svg)

def svg_of(k):
    s=open(f'{ROOT}/assets/scene/sec-{k}.svg',encoding='utf-8').read()
    s=re.sub(r'^<\?xml[^>]*\?>\s*','',s)
    s=s.replace('id="Layer_1"',f'id="art-{k}"')
    # namespace ids so eight inline svgs don't collide
    ids=set(re.findall(r'\sid="([^"]+)"',s))
    for i in sorted(ids,key=len,reverse=True):
        if i==f'art-{k}': continue
        s=s.replace(f'id="{i}"',f'id="{k}_{i}"')
        s=s.replace(f'url(#{i})',f'url(#{k}_{i})')
        s=s.replace(f'xlink:href="#{i}"',f'xlink:href="#{k}_{i}"')
        s=s.replace(f'href="#{i}"',f'href="#{k}_{i}"')
    return unembed(s)

# ---------- the chrome, from the one place it is built ----------
# tools/chrome.js assembles the header and the footer for every page on the
# site. This page is written in Python, so it asks for them through
# tools/chrome-emit.js rather than growing a second copy - and build_site.js
# holds what comes out against every other page before anything ships.
def chrome(part):
    out=subprocess.run(['node', f'{ROOT}/tools/chrome-emit.js', part, '/'],
                       capture_output=True, text=True, check=True).stdout
    # his files say ../../assets/ because they sit two deep; from here the
    # page is at the root, and build_site.js moves it on to /assets/
    return out.replace('../../assets/','assets/')

SITE='https://highway19media.com'
URL=SITE+'/q-a/'
TITLE='Q&amp;A: Websites, Video, Branding &amp; Print &mdash; Highway 19 Media'
DESC=('Straight answers about websites, video production, advertising, branding, '
      'print and working with Highway 19 Media - a creative marketing studio for '
      'businesses across Tampa Bay.')
OG=SITE+'/assets/v2/meta/og.jpg'

parts=[f"""<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>{TITLE}</title>
<meta name="description" content="{DESC}">
<link rel="canonical" href="{URL}">
<!-- WRITTEN TO BE READ BY A MACHINE AS WELL AS A PERSON. max-snippet:-1 and
     max-image-preview:large let a search result quote a whole answer and show
     his art; without them a rich FAQ result is capped at a line. -->
<meta name="robots" content="index,follow,max-snippet:-1,max-image-preview:large,max-video-preview:-1">
<meta property="og:type" content="website">
<meta property="og:site_name" content="Highway 19 Media">
<meta property="og:locale" content="en_US">
<meta property="og:title" content="{TITLE}">
<meta property="og:description" content="{DESC}">
<meta property="og:url" content="{URL}">
<meta property="og:image" content="{OG}">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="{TITLE}">
<meta name="twitter:description" content="{DESC}">
<meta name="twitter:image" content="{OG}">
<meta name="theme-color" content="#00287e">
<link rel="icon" type="image/png" sizes="32x32" href="assets/v2/meta/icon-32.png">
<link rel="apple-touch-icon" href="assets/v2/meta/icon-180.png">
{chrome('head')}
<link rel="stylesheet" href="build/v2/form-card.css">
<link rel="stylesheet" href="assets/css/qa.css">
</head>
<body>
{chrome('header')}
<main id="top">
<h1 class="qa-sr">Questions? We&rsquo;ve Got Answers. Highway 19 Media Q&amp;A.</h1>
<div id="page">"""
]

for d in SEC:
    k=d['k']
    fx=(' data-flex="1" style="--h:%s;--hraw:%s;--seam:%s;--tail:%s;--flex:0px"'
        %(U(d['h']),d['h'],U(flex[k]['seam']),U(round(d['h']-flex[k]['seam'],2)))) if k in flex \
       else (' style="--h:%s;--hraw:%s"'%(U(d['h']),d['h']))
    parts.append(f'<section class="sec sec--{k}" id="s{k}"{fx}>')
    art=svg_of(k)
    H0=d['h']
    art=re.sub(r'viewBox="0 0 2128 ([\d.]+)"',
               lambda m: f'viewBox="{-BLEED} 0 {2128+2*BLEED} {m.group(1)}"', art, count=1)
    if k in flex:
        seam=flex[k]['seam']; H=d['h']
        top=re.sub(r'viewBox="[^"]*"', f'viewBox="{-BLEED} 0 {2128+2*BLEED} {seam}"', art, count=1)
        top=re.sub(r'\sheight="[\d.]+"', f' height="{seam}"', top, count=1)
        bot=re.sub(r'viewBox="[^"]*"', f'viewBox="{-BLEED} {seam} {2128+2*BLEED} {round(H-seam,2)}"', art, count=1)
        bot=re.sub(r'\sheight="[\d.]+"', f' height="{round(H-seam,2)}"', bot, count=1)
        bot=bot.replace(f'id="art-{k}"', f'id="artb-{k}"')
        bot=re.sub(r'(\sid=")'+k+r'_', r'\g<1>'+k+'b_', bot)
        bot=bot.replace(f'url(#{k}_', f'url(#{k}b_').replace(f'href="#{k}_', f'href="#{k}b_')
        parts.append(f'<div class="art-a" style="height:{U(seam)}">{top}</div>')
        parts.append(f'<div class="art-b">{bot}</div>')
    else:
        parts.append(f'<div class="art">{art}</div>')
    for side in ('l','r'):
        bg=f'background-image:url(assets/img/bleed-{k}-{side}.webp)'
        if k in flex:
            parts.append(f'<div class="bleed bleed--{side} bleed--a" style="{bg}"></div>')
            parts.append(f'<div class="bleed bleed--{side} bleed--b" style="{bg}"></div>')
        else:
            parts.append(f'<div class="bleed bleed--{side}" style="{bg}"></div>')
    for h in hotspots(d):
        parts.append(h)
    if d['cards']:
        lastc=d['cards'][-1]
        room=round((d['cta']['y'] if d['cta'] else d['h']) - d['cards'][0]['y'] - 6,2)
        drawn=round(lastc['y']+lastc['h']-d['cards'][0]['y'],2)
        parts.append(f'<div class="col col--{k}" data-room="{room}" data-drawn="{drawn}">')
        for i,c in enumerate(d['cards']):
            ans=c['ans'] or []
            body=''.join(f'<p>{esc(p)}</p>' for p in ans)
            ns=' data-nostroke' if not d['stroke'] else ''
            parts.append(
              f'<div class="qa"{ns} data-i="{i}">'
              f'<h3 class="qa-h">'
              f'<button class="qa-q" type="button" aria-expanded="false" aria-controls="a{k}-{i}">'
              f'<span>{esc(c["q"])}</span><i class="qa-m" aria-hidden="true"></i></button>'
              f'</h3>'
              f'<div class="qa-a" id="a{k}-{i}" role="region"><div class="qa-ai">{body}</div></div>'
              f'</div>')
        parts.append('</div>')
    parts.append('</section>')

# ---- THE SECTIONS HE HAS NOT DRAWN YET ---------------------------------
# He asked for the rest on the concept he showed: his road in at the top, his
# board hanging over it, the heading and the line under it, his cards, his
# panel at the foot. Nothing here is drawn by me - his board comes out of the
# desktop artboard it lives on, his road out of the one mobile section he put
# one in, and the rhythm is measured off his own section four. Only the
# arrangement is mine.
MGEN=[
 {'k':'m5','src':'04','sid':'qa-video',      'sign':'video',   'bg':('#000000','#dbb09f')},
 {'k':'m6','src':'05','sid':'qa-advertising','sign':'social',  'bg':('#dbb09f','#1c9023')},
 {'k':'m7','src':'06','sid':'qa-branding',   'sign':'branding','bg':('#1c9023','#725841'),
  'body':'#297a2b'},   # his own ground around that board, so the green
                       # plate is not lost in the green field
 {'k':'m8','src':'07','sid':'qa-print',      'sign':'print',   'bg':('#725841','#457319')},
 {'k':'m9','src':'08','sid':'qa-working',    'sign':None,      'bg':('#457319','#386295')},
]
MCOL=1093.2          # his section four column, so they all read at one scale
MROAD=1000.0         # how far down his road runs before his heading starts
MSLOT=(108.85,370.59,910.02,292.18)   # where his board hangs in that strip

# his type, off his section four, with the same floor the cards have
# TWO GUTTERS, BOTH HIS. On the one mobile section he drew in full he set
# his cards 59.14 units in from the edge of the column and his panel 62.61 -
# the same line - and his heading further in again at 125.76. The panel here
# was on the heading's number, which is what put it 20px inside the cards it
# belongs to. It goes on the card's line, where he has it; the heading keeps
# its own. The panel's inside padding is its own, not a fraction of the
# page's.
MTYPE={'h':(108.55,31),'hlead':(112.9,34),'lead':(34.19,14.5),'leadlead':(58.75,23),
       'ctat':(57.23,20),'ctas':(29.08,13.5),'ctal':(34.9,17.5),'btn':(28.91,13.5),
       'padx':(59.14,20),'headx':(125.76,26),'headgap':(96,24),'ctagap':(86,24),'tail':(160,34),
       'ctapadt':(92,22),'ctapadb':(66,20),'btnh':(68.84,46),'btnw':(670.51,240)}

MSIGN=json.load(open(f'{HERE}/msigns.json')) if os.path.exists(f'{HERE}/msigns.json') else {}
MROADSVG=(open(f'{ROOT}/assets/scene/m-road.svg',encoding='utf-8').read()
          if os.path.exists(f'{ROOT}/assets/scene/m-road.svg') else '')
COPYBY={c['sid']:c for c in json.load(open(f'{HERE}/copy.json',encoding='utf-8'))}

def lum(hx):
    hx=hx.lstrip('#')
    r,g,b=(int(hx[i:i+2],16) for i in (0,2,4))
    return (0.299*r+0.587*g+0.114*b)/255

def mix(a,bq,t):
    a=a.lstrip('#'); bq=bq.lstrip('#')
    v=[round(int(a[i:i+2],16)+(int(bq[i:i+2],16)-int(a[i:i+2],16))*t) for i in (0,2,4)]
    return '#%02x%02x%02x'%tuple(v)

# his mobile sections, behind the same door his desktop ones are behind
def mstrip(m, art, o, hh, tag):
    # the strip is a window on his whole artboard: the svg keeps his own
    # viewBox and is slid up behind it. Rewriting the viewBox as well would
    # move it twice, and his CTA would be scrolled off the bottom of the page.
    a=art
    if tag:
        a=a.replace(f'id="art-{m["k"]}"', f'id="artb-{m["k"]}"')
        a=re.sub(r'(\sid=")'+m['k']+r'_', r'\g<1>'+m['k']+'b_', a)
        a=a.replace(f'url(#{m["k"]}_', f'url(#{m["k"]}b_').replace(f'href="#{m["k"]}_', f'href="#{m["k"]}b_')
    return (f'<div class="mstrip" style="--mbo:{o};--mbs:{round(hh,2)}">{a}</div>')

for m in MOB:
    C=m.get('card'); K=MCARD
    st=(f'--mbx:{m["cx"]};--mbc:{m["cw"]};--mbw:{m["w"]}')
    parts.append(f'<section class="msec msec--{m["k"]}" id="{m["k"]}" style="{st}">')
    art=msvg_of(m)
    if not C:
        parts.append(mstrip(m, art, 0, m['ch'], False))
    else:
        cards=cardsrc[m['src']]
        parts.append(mstrip(m, art, 0, m['top'], False))
        cst=(f'--cx:{C["x"]};--cw:{K["w"]};' + mcardvars(K) + ';'
             f'--fill:{C["fill"]};--fill-open:{C["open"]};--stroke:{C["stroke"]};'
             f'--qfill:{C["q"]};--bfill:{C["a"]};'
             f'--cb1:{m["bg"][0]};--cb2:{m["bg"][1]}')
        parts.append(f'<div class="mcol" style="{cst}">')
        for i,c in enumerate(cards):
            body=''.join(f'<p>{esc(x)}</p>' for x in (c['ans'] or []))
            parts.append(
              f'<div class="qa" data-i="{i}">'
              f'<h3 class="qa-h">'
              f'<button class="qa-q" type="button" aria-expanded="false" aria-controls="a{m["k"]}-{i}">'
              f'<span>{esc(c["q"])}</span><i class="qa-m" aria-hidden="true"></i></button>'
              f'</h3>'
              f'<div class="qa-a" id="a{m["k"]}-{i}" role="region"><div class="qa-ai">{body}</div></div>'
              f'</div>')
        parts.append('</div>')
        parts.append(mstrip(m, art, m['bot'], round(m['ch']-m['bot'],2), True))
    parts.append('</section>')

# his road, his board, his rhythm - the sections he has not drawn yet
def mgen_top(g):
    road=re.sub(r'^<\?xml[^>]*\?>\s*','',MROADSVG)
    road=re.sub(r'<svg[^>]*>','',road,count=1).replace('</svg>','')
    ids=set(re.findall(r'\sid="([^"]+)"',road))
    for i in sorted(ids,key=len,reverse=True):
        road=road.replace(f'id="{i}"',f'id="{g["k"]}r_{i}"')
        road=road.replace(f'url(#{i})',f'url(#{g["k"]}r_{i})')
        road=road.replace(f'xlink:href="#{i}"',f'xlink:href="#{g["k"]}r_{i}"')
    board=''
    if g['sign'] and g['sign'] in MSIGN:
        S=MSIGN[g['sign']]; pl=S['plate']
        sv=open(f"{ROOT}/assets/scene/msign-{g['sign']}.svg",encoding='utf-8').read()
        sv=re.sub(r'^<\?xml[^>]*\?>\s*','',sv)
        sv=re.sub(r'<svg[^>]*>','',sv,count=1).replace('</svg>','')
        ids=set(re.findall(r'\sid="([^"]+)"',sv))
        for i in sorted(ids,key=len,reverse=True):
            sv=sv.replace(f'id="{i}"',f'id="{g["k"]}s_{i}"')
            sv=sv.replace(f'url(#{i})',f'url(#{g["k"]}s_{i})')
            sv=sv.replace(f'xlink:href="#{i}"',f'xlink:href="#{g["k"]}s_{i}"')
        sc=MSLOT[2]/pl[2]
        tx=round(MSLOT[0]-pl[0]*sc,2); ty=round(MSLOT[1]-pl[1]*sc,2)
        board=f'<g transform="translate({tx} {ty}) scale({round(sc,5)})">{sv}</g>'
    return (f'<div class="mtop"><svg xmlns="http://www.w3.org/2000/svg" '
            f'viewBox="0 0 {MCOL} {MROAD}" aria-hidden="true">{road}{board}</svg></div>')

for g in MGEN:
    C=COPYBY[g['sid']]; cards=cardsrc[g['src']]; K=MCARD; T=MTYPE
    def F(key):
        u,f=T[key]; return f'max({f}px, calc({u}*var(--mu)))'
    # where his card block sits on the run of colour, so the card is the one
    # that can be read on it and the ground behind it is that colour
    # the body of the section is its own colour; only the foot blends into the
    # next one, so the card and the lettering answer to that colour and not to
    # a mud halfway between two of his
    night=lum(g['bg'][0])<0.22
    card=({'fill':'#0e1a27','open':'#16283a','stroke':'#33475c',
           'q':'#ffffff','a':'#c7d3e0'}
          if night else
          {'fill':'#ffffff','open':'#f1f7ff','stroke':'#cfdcee',
           'q':'#12161c','a':'#454c57'})
    ink='#fff' if lum(g['bg'][0])<0.55 else '#12161c'
    st=(f'--mbc:{MCOL};--mu:calc(100vw / {MCOL});'
        f'--bg1:{g["bg"][0]};--bg2:{g["bg"][1]};'
        f'--body:{g.get("body") or g["bg"][0]};--ink:{ink};'
        f'--padx:{F("padx")};--headx:{F("headx")};'
        f'--hsize:{F("h")};--hlead:{F("hlead")};'
        f'--lsize:{F("lead")};--llead:{F("leadlead")};'
        f'--headgap:{F("headgap")};--ctagap:{F("ctagap")};--tail:{F("tail")};'
        f'--ctat:{F("ctat")};--ctas:{F("ctas")};--ctal:{F("ctal")};--btn:{F("btn")};'
        f'--ctapadt:{F("ctapadt")};--ctapadb:{F("ctapadb")};'
        f'--btnh:{F("btnh")};--btnw:{F("btnw")}')
    parts.append(f'<section class="msec msec--gen" id="{g["k"]}" style="{st}">')
    parts.append(mgen_top(g))
    parts.append('<div class="mhead">'
                 f'<h2>{esc(C["heading"])}</h2><p>{esc(C["lead"])}</p></div>')
    cst=(f'--cx:59.14;--cw:{K["w"]};' + mcardvars(K) + ';'
         f'--fill:{card["fill"]};--fill-open:{card["open"]};--stroke:{card["stroke"]};'
         f'--qfill:{card["q"]};--bfill:{card["a"]}')
    parts.append(f'<div class="mcol mcol--gen" style="{cst}">')
    for i,c in enumerate(cards):
        body=''.join(f'<p>{esc(x)}</p>' for x in (c['ans'] or []))
        parts.append(
          f'<div class="qa" data-i="{i}">'
          f'<h3 class="qa-h">'
          f'<button class="qa-q" type="button" aria-expanded="false" aria-controls="a{g["k"]}-{i}">'
          f'<span>{esc(c["q"])}</span><i class="qa-m" aria-hidden="true"></i></button>'
          f'</h3>'
          f'<div class="qa-a" id="a{g["k"]}-{i}" role="region"><div class="qa-ai">{body}</div></div>'
          f'</div>')
    parts.append('</div>')
    cta=C.get('cta') or ['','','']
    parts.append('<div class="mcta"><div class="mcta-p">'
                 f'<strong>{esc(cta[0])}</strong><span>{esc(cta[1])}</span>'
                 f'<i class="mbtn">{esc(cta[2])}</i></div></div>')
    parts.append('<div class="mtail"></div>')
    parts.append('</section>')

# ---------- what a machine reads ----------
# THE ANSWERS ARE IN THE DOCUMENT, not fetched when a card opens - a shut
# card is a closed grid row, and every word of every answer is in the markup
# whether it is open or not. That is what makes this page worth a crawler's
# time, and it is why the schema below can be trusted: it says the same thing
# the page says.
QA=[c for d in SEC for c in d['cards'] if c.get('ans')]
ORG={"@type":"Organization","@id":SITE+"/#org","name":"Highway 19 Media",
     "url":SITE+"/","logo":SITE+"/assets/v2/meta/icon-180.png",
     "email":"highway19media@gmail.com",
     "sameAs":["https://www.facebook.com/Highway19Media"],
     "areaServed":{"@type":"Place","name":"Tampa Bay, Florida"},
     "description":("Creative marketing for Tampa Bay businesses - websites, "
                    "video production, branding, print, social media and "
                    "advertising.")}
LD={"@context":"https://schema.org","@graph":[
  ORG,
  {"@type":"WebSite","@id":SITE+"/#site","url":SITE+"/",
   "name":"Highway 19 Media","publisher":{"@id":SITE+"/#org"},
   "inLanguage":"en-US"},
  {"@type":"BreadcrumbList","@id":URL+"#breadcrumb","itemListElement":[
    {"@type":"ListItem","position":1,"name":"Home","item":SITE+"/"},
    {"@type":"ListItem","position":2,"name":"Q&A","item":URL}]},
  {"@type":"FAQPage","@id":URL+"#faq","url":URL,
   "name":"Questions & Answers",
   "description":html.unescape(DESC),
   "isPartOf":{"@id":SITE+"/#site"},
   "publisher":{"@id":SITE+"/#org"},
   "breadcrumb":{"@id":URL+"#breadcrumb"},
   "inLanguage":"en-US",
   "mainEntity":[
     {"@type":"Question","name":c['q'],
      "acceptedAnswer":{"@type":"Answer","text":' '.join(c['ans'] or [])}}
     for c in QA]},
]}
parts.append('</div>')                     # /#page
# HIS OWN CONTACT CARD, the same file the home page and the holding page use.
# The bar's Contact button points at #contact on every page of this site, so a
# page without the card is a page with a dead button in its header - and the
# build's chrome check is what would have caught it.
parts.append('<section id="contact" class="qa-form">')
parts.append(chrome('form'))
parts.append('</section>')
parts.append('</main>')
parts.append(chrome('footer'))
parts.append('<script type="application/ld+json">'+
             json.dumps(LD,ensure_ascii=False)+'</script>')
parts.append('<script src="assets/js/cars-sprite.js"></script>')
parts.append('<script src="assets/js/qa-lanes.js"></script>')
parts.append('<script src="assets/js/qa.js"></script>')
parts.append('<script src="assets/js/qa-traffic.js"></script>')
parts.append('<script src="build/v2/form.js" defer></script>')
parts.append(chrome('scripts'))
parts.append('</body>\n</html>')
open(f'{ROOT}/faq.html','w',encoding='utf-8').write('\n'.join(parts))
print('faq.html', round(os.path.getsize(f'{ROOT}/faq.html')/1024),'KB |',
      len(QA),'questions in the schema')
for d in SEC:
    if d['cards']:
        print(' ',d['k'],'x',d['x'],'w',d['w'],'y',d['y'],'gap',d['gap'],'shut',d['shut'],
              'pad',d['pad'],'atop',round(d['bodytop']-d['shut'],2),'abot',d['botpad'])
