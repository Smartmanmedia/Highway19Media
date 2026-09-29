/* HIS BOARD, ON ITS OWN, IN THE ARTBOARDS HE DREW FOR THE PHONE.
   The desktop artboards were tagged by extract.js, so a board lifted out of
   one of them arrives carrying data-sign and rides the parallax for free.
   The mobile artboards were never through that pass: the board is there, but
   as loose siblings with no group around them, so there is nothing for the
   parallax to take hold of.
   The plate is found by his paint - the one run of sign green - and
   everything whose box falls inside that plate, grown out to take in the
   posts, the lamps and the gantry arm he hangs it from, is moved into one
   group in the plate's own place in the paint order. Nothing is redrawn and
   nothing changes places relative to anything else. */
const {chromium}=require('playwright');
const fs=require('fs');
const ROOT='/home/user/highway19media';
const GREEN=['#1c9022','#006802','#1c9023'];
const FILES=process.argv.slice(2);
(async()=>{
const b=await chromium.launch({executablePath:process.env.CHROME_PATH});
const p=await b.newPage({viewport:{width:1200,height:900}});
await p.goto('http://127.0.0.1:8777/assets/scene/');
for(const f of FILES){
  const src=fs.readFileSync(`${ROOT}/assets/scene/${f}`,'utf8');
  if(/data-sign/.test(src)){ console.log(f,'- already tagged'); continue; }
  const r=await p.evaluate(([src,GREEN])=>{
    const NS='http://www.w3.org/2000/svg';
    const doc=new DOMParser().parseFromString(src,'image/svg+xml');
    const svg=doc.documentElement;
    document.body.innerHTML=''; document.body.appendChild(svg);
    const abs=el=>{let bb; try{bb=el.getBBox()}catch(e){return null}
      const c=el.getCTM(); if(!c||!bb.width||!bb.height) return null;
      const P=(x,y)=>({x:c.a*x+c.c*y+c.e,y:c.b*x+c.d*y+c.f});
      const q=[P(bb.x,bb.y),P(bb.x+bb.width,bb.y),
               P(bb.x,bb.y+bb.height),P(bb.x+bb.width,bb.y+bb.height)];
      const xs=q.map(v=>v.x), ys=q.map(v=>v.y), x=Math.min(...xs), y=Math.min(...ys);
      return {x,y,w:Math.max(...xs)-x,h:Math.max(...ys)-y};};
    const plateEl=[...svg.querySelectorAll('[fill]')].find(e=>
      GREEN.indexOf((e.getAttribute('fill')||'').toLowerCase())>=0);
    if(!plateEl) return null;
    const pl=abs(plateEl); if(!pl) return null;
    /* out to the posts above and below, and along the arm to both sides */
    const M=Math.max(60, pl.h*0.34);
    const L=pl.x-pl.w, R=pl.x+pl.w*2, T=pl.y-M, B=pl.y+pl.h+M;
    /* HIS ROAD IS NOT PART OF HIS BOARD. It runs right through the band the
       board hangs in, and a piece of tarmac swallowed into the sign would
       ride the parallax and tear his road in half. His curves are named, so
       they are named out. */
    const leaf=[...svg.querySelectorAll('path,rect,circle,ellipse,polygon,polyline,line,text,image,use')]
      .filter(e=>!e.closest('[id^="Curve"]'));
    const take=[];
    leaf.forEach(e=>{ const q=abs(e); if(!q) return;
      if(q.x>=L && q.x+q.w<=R && q.y>=T && q.y+q.h<=B) take.push(e); });
    if(!take.length) return null;
    /* one group, put where the plate itself sits in the paint order */
    const g=doc.createElementNS(NS,'g');
    g.setAttribute('data-sign','1');
    plateEl.parentNode.insertBefore(g, plateEl);
    take.forEach(e=>g.appendChild(e));
    /* any group his elements have just left, if it is now empty */
    [...svg.querySelectorAll('g')].reverse().forEach(x=>{
      if(x!==g && !x.children.length && x.parentNode) x.parentNode.removeChild(x); });
    const q=abs(g);
    return {svg:new XMLSerializer().serializeToString(svg), n:take.length,
            box:[q.x,q.y,q.w,q.h].map(v=>+v.toFixed(2))};
  },[src,GREEN]);
  if(!r){ console.log(f,'- no green plate found'); continue; }
  fs.writeFileSync(`${ROOT}/assets/scene/${f}`, r.svg);
  console.log(f,'- board tagged:', r.n, 'pieces | box', r.box.join(','));
}
await b.close();
})();
