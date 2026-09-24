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
        out.append('<a class="hot" href="%s" aria-label="%s" style="left:calc(50%% - 1064px + %.1fpx);top:%.1fpx;width:%.1fpx;height:%.1fpx"></a>'
                   %(spec['href'], esc(spec.get('label') or spec.get('find') or spec['text']),
                     x0-px, y0-py, (x1-x0)+2*px, (y1-y0)+2*py))
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

*{box-sizing:border-box}
html{background:#00287e}
body{margin:0;background:#00287e;-webkit-font-smoothing:antialiased}
#page{overflow:hidden}

.sec{position:relative;width:100%;height:var(--h);overflow:hidden}
.art{position:absolute;top:0;left:50%;width:2128px;height:var(--h);margin-left:-1064px}
.art>svg{display:block;width:2128px;height:var(--h)}

.col{position:absolute;top:var(--y);left:50%;width:var(--w);
     margin-left:calc(-1064px + var(--x))}

.qa{background:var(--fill);border-radius:10px;margin-bottom:var(--gap);
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

.sec[data-flex]{height:calc(var(--h) + var(--flex,0px));transition:height .3s ease}
.art-a{position:absolute;top:0;left:50%;width:2128px;margin-left:-1064px;overflow:hidden}
.art-b{position:absolute;left:50%;width:2128px;margin-left:-1064px;
       top:calc(var(--seam) + var(--flex,0px));transition:top .3s ease}
.art-a>svg,.art-b>svg{display:block;width:2128px}
.hot{position:absolute;display:block;border-radius:6px}
.hot:focus-visible{outline:2px solid #ffce00;outline-offset:2px}
"""]

for d in SEC:
    if not d['cards']: continue
    m=d['m']
    mw=m['disc'] or m['glyph']*1.9
    css.append(f""".col--{d['k']}{{
 --x:{d['x']}px; --y:{d['y']}px; --w:{d['w']}px; --gap:{d['gap']}px; --shut:{d['shut']}px;
 --pad:{d['pad']}px; --qpr:{round(d['pad']+mw,2)}px;
 --qfam:{FAM[d['qfam']]}; --qsize:{d['qsize']}px; --qlead:19px; --qfill:{d['qfill']};
 --bfam:{FAM[d['bfam']]}; --bwgt:{WGT[d['bfam']]}; --bsize:{d['bsize']}px;
 --blead:{d['blead']}px; --bfill:{d['bfill']};
 --qtop:{d['qtop']}px; --atop:{round(d['bodytop']-d['qtop']-19,2)}px; --abot:{d['botpad']}px;
 --fill:{d['fill']}; --fill-open:{d['fillopen']}; --stroke:{d['stroke'] or 'transparent'};
 --mw:{round(mw,2)}px; --minset:{m['inset']}px;
 --mfill:{m['discFill'] or 'transparent'}; --mstroke:{m['discStroke'] or 'transparent'};
 --msw:{m['discSW']}px; --gcol:{m['glyphCol']}; --gw:{m['glyph']}px; --gsw:{m['glyphSW']}px;
}}""")
open(f'{ROOT}/assets/css/qa.css','w',encoding='utf-8').write('\n'.join(css))

# ---------- HTML ----------
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
    fx=(' data-flex="1" style="--h:%spx;--seam:%spx;--flex:0px"'%(d['h'],flex[k]['seam'])) if k in flex \
       else (' style="--h:%spx"'%d['h'])
    parts.append(f'<section class="sec sec--{k}" id="s{k}"{fx}>')
    art=svg_of(k)
    if k in flex:
        seam=flex[k]['seam']; H=d['h']
        top=re.sub(r'viewBox="[^"]*"', f'viewBox="0 0 2128 {seam}"', art, count=1)
        top=re.sub(r'\sheight="[\d.]+"', f' height="{seam}"', top, count=1)
        bot=re.sub(r'viewBox="[^"]*"', f'viewBox="0 {seam} 2128 {round(H-seam,2)}"', art, count=1)
        bot=re.sub(r'\sheight="[\d.]+"', f' height="{round(H-seam,2)}"', bot, count=1)
        bot=bot.replace(f'id="art-{k}"', f'id="artb-{k}"')
        bot=re.sub(r'(\sid=")'+k+r'_', r'\g<1>'+k+'b_', bot)
        bot=bot.replace(f'url(#{k}_', f'url(#{k}b_').replace(f'href="#{k}_', f'href="#{k}b_')
        parts.append(f'<div class="art-a" style="height:{seam}px">{top}</div>')
        parts.append(f'<div class="art-b">{bot}</div>')
    else:
        parts.append(f'<div class="art">{art}</div>')
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

parts.append('</div>\n<script src="assets/js/qa.js"></script>\n</body>\n</html>')
open(f'{ROOT}/faq.html','w',encoding='utf-8').write('\n'.join(parts))
print('faq.html', round(os.path.getsize(f'{ROOT}/faq.html')/1024),'KB')
for d in SEC:
    if d['cards']:
        print(' ',d['k'],'x',d['x'],'w',d['w'],'y',d['y'],'gap',d['gap'],'shut',d['shut'],
              'pad',d['pad'],'atop',round(d['bodytop']-d['shut'],2),'abot',d['botpad'])
