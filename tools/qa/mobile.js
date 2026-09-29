/* His mobile artboards, taken apart the way his desktop ones are.

   He draws the question cards into the art, with the first one open and the
   rest shut - which is the design, not the page: an answer has to open and
   shut, and only one of them at a time. So his cards come out of the SVG and
   are rebuilt as real ones at the places he drew them, in the colours he
   drew them in, and the art is cut above and below the block so the section
   can grow and shrink with whatever is open. */
const {chromium}=require('playwright');
const fs=require('fs'), path=require('path');
const ROOT='/home/user/highway19media';
const KS=(process.argv[2]||'1,2,4').split(',');

(async()=>{
const b=await chromium.launch({executablePath:process.env.CHROME_PATH});
const p=await b.newPage({viewport:{width:1200,height:900}});
await p.goto('http://localhost:8777/assets/scene/');
const out={};
for(const k of KS){
  const src=fs.readFileSync(`${ROOT}/assets/scene/Mobile-QA-Section-${k}.svg`,'utf8');
  const r=await p.evaluate(([src])=>{
    const doc=new DOMParser().parseFromString(src,'image/svg+xml');
    const svg=doc.documentElement;
    document.body.innerHTML=''; document.body.appendChild(svg);
    const VB=svg.viewBox.baseVal;
    svg.setAttribute('width',String(VB.width));
    const abs=el=>{let bb;try{bb=el.getBBox()}catch(e){return null}
      const c=el.getCTM(); if(!c) return null;
      return {x:c.a*bb.x+c.c*bb.y+c.e, y:c.b*bb.x+c.d*bb.y+c.f,
              w:Math.abs(bb.width*c.a), h:Math.abs(bb.height*c.d)};};

    /* HIS CARD IS A PILL OF ONE WIDTH AND ONE RADIUS, every time */
    const pills=[...svg.querySelectorAll('rect')].filter(e=>{
      const rx=parseFloat(e.getAttribute('rx')||'0');
      const w=parseFloat(e.getAttribute('width')||'0');
      return rx>25&&rx<35&&w>900&&w<1010;
    }).map(e=>({e,a:abs(e)})).filter(q=>q.a).sort((u,v)=>u.a.y-v.a.y);
    if(!pills.length) return {cards:[]};

    const top=pills[0].a.y, bot=Math.max(...pills.map(q=>q.a.y+q.a.h));
    const inBlock=a=>a && a.y+a.h>top-4 && a.y<bot+4 && a.x>top*0-20 && a.x<1100;

    /* everything he drew inside that block is the block: the pills, his
       questions, his one open answer, his plus and minus */
    const doomed=new Set(), cards=[];
    pills.forEach(q=>{
      const a=q.a;
      const mine=[...svg.querySelectorAll('text,circle,path,rect,image')].filter(e=>{
        if(e===q.e) return false;
        const c=abs(e); if(!c) return false;
        const cx=c.x+c.w/2, cy=c.y+c.h/2;
        return cx>a.x-6 && cx<a.x+a.w+6 && cy>a.y-6 && cy<a.y+a.h+6 && c.h<a.h+8;
      });
      const texts=mine.filter(e=>e.tagName==='text')
        .map(e=>({e,a:abs(e),s:(e.textContent||'').replace(/\s+/g,' ').trim()}))
        .sort((u,v)=>u.a.y-v.a.y);
      const q0=texts[0];
      cards.push({x:+a.x.toFixed(2), y:+a.y.toFixed(2), w:+a.w.toFixed(2), h:+a.h.toFixed(2),
                  q:q0?q0.s:'', open:a.h>260,
                  fill:q.e.getAttribute('fill')||'', stroke:q.e.getAttribute('stroke')||'',
                  rx:+parseFloat(q.e.getAttribute('rx')).toFixed(2)});
      doomed.add(q.e); mine.forEach(e=>doomed.add(e));
    });
    doomed.forEach(e=>{ if(e.parentNode) e.parentNode.removeChild(e); });
    /* his wrappers, now holding nothing */
    let swept=1;
    while(swept){ swept=0;
      [...svg.querySelectorAll('g')].forEach(g=>{
        if(!g.children.length && !g.id){ g.parentNode&&g.parentNode.removeChild(g); swept++; }
      });
    }
    /* the question font he set, so the real cards read as his */
    const probe=cards.length?cards[0]:null;
    return {cards, top:+top.toFixed(2), bot:+bot.toFixed(2),
            vb:[VB.x,VB.y,VB.width,VB.height],
            svg:new XMLSerializer().serializeToString(svg)};
  },[src]);

  if(!r.cards.length){ fs.writeFileSync(`${ROOT}/assets/scene/m-sec-${k}.svg`,src);
    out[k]={cards:[]}; console.log('==',k,'no cards - his art straight through'); continue; }
  fs.writeFileSync(`${ROOT}/assets/scene/m-sec-${k}.svg`,r.svg);
  out[k]={top:r.top,bot:r.bot,cards:r.cards};
  console.log('==',k,r.cards.length,'of his cards lifted | block',r.top,'->',r.bot,
              '| open',r.cards.filter(c=>c.open).length);
  r.cards.forEach(c=>console.log('    ',c.open?'OPEN':'shut',
     `[${c.x},${c.y} ${c.w}x${c.h}]`, c.fill||'(none)','/',c.stroke, '"'+c.q.slice(0,52)+'"'));
}
fs.writeFileSync(path.join(__dirname,'mcards.json'),JSON.stringify(out,null,1));
await b.close();
})();
