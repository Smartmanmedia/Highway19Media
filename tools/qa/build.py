#!/usr/bin/env python3
"""Builds faq.html from his eight artboards plus the card geometry lifted off them."""
import json, os, re, html, statistics
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
      --wide:calc(3088*var(--u))}

*{box-sizing:border-box}
html{background:#00287e}
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
.mcol .qa{border-width:max(1px, calc(1.6 * var(--mu)))}
.mcol .qa:last-child{margin-bottom:0}

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
      padding:0 var(--qpr) 0 var(--pad);position:relative;
      font-family:var(--qfam);font-weight:700;font-size:var(--qsize);
      line-height:var(--qlead);color:var(--qfill);letter-spacing:0}
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
  'card':{'x':54.34,'fill':'#fff','open':'#deefff','stroke':'#00287e',
          'q':'#12161c','a':'#454c57','cx':982.92}},

 {'k':'m4','f':'m-sec-4.svg','w':1122.01,'h':3362.80,'cx':0.0,'cw':1093.20,'ch':3362.80,
  'src':'03','top':1607.96,'bot':2793.17,'bg':('#000000','#000000'),
  'card':{'x':59.14,'fill':'#000','open':'#0f1c28','stroke':'#cad9ea',
          'q':'#fff','a':'#fff','cx':987.72}},
]

# his card, measured off the ones he drew: one width, one radius, one set of
# paddings, the same in both artboards
MCARD={'w':969.75,'r':30.05,'shut':74.43,'gap':11.5,'pad':50.45,'qpr':75,
       'qsize':31.99,'qlead':38.39,'qtop':43,'atop':41.5,'abot':118,
       'bsize':33.93,'blead':56.23,'mw':33.6,'gw':13.33,'gsw':3}

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
    return s

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
    return s

parts=["""<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Questions &amp; Answers — Highway 19 Media</title>
<meta name="description" content="Straight answers about websites, video, advertising, branding, print and working with Highway 19 Media.">
<link rel="stylesheet" href="assets/css/qa.css">
</head>
<body>
<div id="page">"""]

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
              f'<button class="qa-q" type="button" aria-expanded="false" aria-controls="a{k}-{i}">'
              f'<span>{esc(c["q"])}</span><i class="qa-m" aria-hidden="true"></i></button>'
              f'<div class="qa-a" id="a{k}-{i}" role="region"><div class="qa-ai">{body}</div></div>'
              f'</div>')
        parts.append('</div>')
    parts.append('</section>')

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
        MU=lambda n: f'calc({n}*var(--mu))'
        cst=(f'--cx:{C["x"]};--cw:{K["w"]};'
             f'--rad:{MU(K["r"])};--shut:{MU(K["shut"])};--gap:{MU(K["gap"])};'
             f'--pad:{MU(K["pad"])};--qpr:{MU(K["qpr"])};'
             f'--qsize:{MU(K["qsize"])};--qlead:{MU(K["qlead"])};--qtop:{MU(K["qtop"])};'
             f'--atop:{MU(K["atop"])};--abot:{MU(K["abot"])};'
             f'--bsize:{MU(K["bsize"])};--blead:{MU(K["blead"])};'
             f'--mw:{MU(K["mw"])};--gw:{MU(K["gw"])};--gsw:{MU(K["gsw"])};'
             f'--msw:0px;--mstroke:transparent;'
             f'--minset:{MU(round(C["x"]+K["w"]-C["cx"]-K["mw"]/2,2))};'
             f'--qfam:Arial-BoldMT,Arial,sans-serif;'
             f"--bfam:'Be Vietnam Pro',sans-serif;--bwgt:300;"
             f'--fill:{C["fill"]};--fill-open:{C["open"]};--stroke:{C["stroke"]};'
             f'--qfill:{C["q"]};--bfill:{C["a"]};--mfill:#00aa56;--gcol:#fff;'
             f'--cb1:{m["bg"][0]};--cb2:{m["bg"][1]}')
        parts.append(f'<div class="mcol" style="{cst}">')
        for i,c in enumerate(cards):
            body=''.join(f'<p>{esc(x)}</p>' for x in (c['ans'] or []))
            parts.append(
              f'<div class="qa" data-i="{i}">'
              f'<button class="qa-q" type="button" aria-expanded="false" aria-controls="a{m["k"]}-{i}">'
              f'<span>{esc(c["q"])}</span><i class="qa-m" aria-hidden="true"></i></button>'
              f'<div class="qa-a" id="a{m["k"]}-{i}" role="region"><div class="qa-ai">{body}</div></div>'
              f'</div>')
        parts.append('</div>')
        parts.append(mstrip(m, art, m['bot'], round(m['ch']-m['bot'],2), True))
    parts.append('</section>')

ld={"@context":"https://schema.org","@type":"FAQPage","mainEntity":[
  {"@type":"Question","name":c['q'],
   "acceptedAnswer":{"@type":"Answer","text":' '.join(c['ans'] or [])}}
  for d in SEC for c in d['cards'] if c.get('ans')]}
parts.append('<script type="application/ld+json">'+json.dumps(ld,ensure_ascii=False)+'</script>')
parts.append('</div>')
parts.append('<script src="assets/js/cars-sprite.js"></script>')
parts.append('<script src="assets/js/qa-lanes.js"></script>')
parts.append('<script src="assets/js/qa.js"></script>')
parts.append('<script src="assets/js/qa-traffic.js"></script>')
parts.append('</body>\n</html>')
open(f'{ROOT}/faq.html','w',encoding='utf-8').write('\n'.join(parts))
print('faq.html', round(os.path.getsize(f'{ROOT}/faq.html')/1024),'KB')
for d in SEC:
    if d['cards']:
        print(' ',d['k'],'x',d['x'],'w',d['w'],'y',d['y'],'gap',d['gap'],'shut',d['shut'],
              'pad',d['pad'],'atop',round(d['bodytop']-d['shut'],2),'abot',d['botpad'])
