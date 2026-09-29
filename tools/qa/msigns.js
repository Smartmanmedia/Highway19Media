/* His service boards, lifted whole out of the desktop artboards so the mobile
   sections he has not drawn yet are built from his own art and not from a
   drawing of mine. One file per board, cropped to what he drew. */
const {chromium}=require('playwright');
const fs=require('fs'), path=require('path');
const ROOT='/home/user/highway19media';
/* which artboard carries which board, and the name it goes out under */
const WANT=[['03','website'],['04','video'],['05','social'],
            ['06','branding'],['07','print']];
(async()=>{
const b=await chromium.launch({executablePath:process.env.CHROME_PATH});
const p=await b.newPage({viewport:{width:1200,height:900}});
await p.goto('http://localhost:8777/assets/scene/');
const out={};
for(const [k,name] of WANT){
  const src=fs.readFileSync(`${ROOT}/assets/scene/sec-${k}.svg`,'utf8');
  const r=await p.evaluate(([src,k])=>{
    const doc=new DOMParser().parseFromString(src,'image/svg+xml');
    const svg=doc.documentElement;
    document.body.innerHTML=''; document.body.appendChild(svg);
    svg.setAttribute('width','2128');
    /* HIS GROUPS ARE SOMETIMES MIRRORED, and a mirrored matrix hands back the
       right-hand edge as x. Both corners are mapped and sorted, so a flipped
       board measures where it actually is rather than a plate-width away. */
    const abs=el=>{let bb;try{bb=el.getBBox()}catch(e){return null}
      const c=el.getCTM(); if(!c) return null;
      const P=(x,y)=>({x:c.a*x+c.c*y+c.e, y:c.b*x+c.d*y+c.f});
      const q=[P(bb.x,bb.y),P(bb.x+bb.width,bb.y),
               P(bb.x,bb.y+bb.height),P(bb.x+bb.width,bb.y+bb.height)];
      const xs=q.map(v=>v.x), ys=q.map(v=>v.y);
      const x=Math.min(...xs), y=Math.min(...ys);
      return {x, y, w:Math.max(...xs)-x, h:Math.max(...ys)-y};};
    /* the board with the most lettering on it is the one he meant */
    const signs=[...svg.querySelectorAll('[data-sign]')]
      .map(g=>({g,a:abs(g),t:(g.textContent||'').trim().length}))
      .filter(q=>q.a).sort((u,v)=>v.t-u.t || v.a.w*v.a.h-u.a.w*u.a.h);
    if(!signs.length) return null;
    const S=signs[0], a=S.a;
    /* the plate itself, not the gantry he ran off the artboard with */
    let px=1e9,py=1e9,pr=-1e9,pb=-1e9,hit=0;
    [...S.g.querySelectorAll('rect,path')].forEach(e=>{
      const f=(e.getAttribute('fill')||'').toLowerCase();
      if(f!=='#1c9022'&&f!=='#006802') return;
      const c=abs(e); if(!c||c.w<200) return;
      hit++; px=Math.min(px,c.x); py=Math.min(py,c.y);
      pr=Math.max(pr,c.x+c.w); pb=Math.max(pb,c.y+c.h);
    });
    const plate=hit?{x:px,y:py,w:pr-px,h:pb-py}:a;
    /* keep a little of his gantry either side, but not the whole run of it */
    const pad=Math.min(plate.h*0.55, 150);
    const box={x:Math.max(a.x,plate.x-pad), y:Math.max(a.y,plate.y-pad*0.5),
               w:0, h:0};
    box.w=Math.min(a.x+a.w, plate.x+plate.w+pad)-box.x;
    box.h=Math.min(a.y+a.h, plate.y+plate.h+pad*0.5)-box.y;
    const holder=doc.createElementNS('http://www.w3.org/2000/svg','svg');
    holder.setAttribute('xmlns','http://www.w3.org/2000/svg');
    holder.setAttribute('viewBox',[box.x,box.y,box.w,box.h].map(v=>+v.toFixed(2)).join(' '));
    const defs=svg.querySelector('defs');
    if(defs) holder.appendChild(defs.cloneNode(true));
    holder.appendChild(S.g.cloneNode(true));
    return {group:[+a.x.toFixed(1),+a.y.toFixed(1),+a.w.toFixed(1),+a.h.toFixed(1)],
            hits:hit,
            svg:new XMLSerializer().serializeToString(holder),
            box:[+box.x.toFixed(2),+box.y.toFixed(2),+box.w.toFixed(2),+box.h.toFixed(2)],
            plate:[+plate.x.toFixed(2),+plate.y.toFixed(2),+plate.w.toFixed(2),+plate.h.toFixed(2)],
            text:(S.g.textContent||'').replace(/\s+/g,' ').trim().slice(0,46)};
  },[src,k]);
  if(!r){ console.log('==',k,name,'no board'); continue; }
  fs.writeFileSync(`${ROOT}/assets/scene/msign-${name}.svg`, r.svg);
  out[name]={k, box:r.box, plate:r.plate};
  console.log('==',name,'from',k,'| group',r.group.join(','),'| plate(',r.hits,')',r.plate.join(','),'|',r.text);
}
fs.writeFileSync(path.join(__dirname,'msigns.json'),JSON.stringify(out,null,1));
await b.close();
})();
