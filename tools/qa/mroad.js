/* His mobile road, taken out of the one mobile section he drew with one on
   it, so the sections he has not drawn yet carry his own tarmac rather than
   a drawing of mine. Two curves: in at the top, out at the foot. */
const {chromium}=require('playwright');
const fs=require('fs'), path=require('path');
const roadout=require('./roadout');
const ROOT='/home/user/highway19media';
(async()=>{
const b=await chromium.launch({executablePath:process.env.CHROME_PATH});
const p=await b.newPage({viewport:{width:1200,height:900}});
await p.goto('http://localhost:8777/assets/scene/');
const src=fs.readFileSync(`${ROOT}/assets/scene/m-sec-4.svg`,'utf8');
const r=await p.evaluate(([src])=>{
  const NS='http://www.w3.org/2000/svg';
  const doc=new DOMParser().parseFromString(src,'image/svg+xml');
  const svg=doc.documentElement;
  document.body.innerHTML=''; document.body.appendChild(svg);
  const keep=[...svg.querySelectorAll('[id^="Curve"]')];
  if(!keep.length) return null;
  const abs=el=>{const bb=el.getBBox(), c=el.getCTM();
    const P=(x,y)=>({x:c.a*x+c.c*y+c.e,y:c.b*x+c.d*y+c.f});
    const q=[P(bb.x,bb.y),P(bb.x+bb.width,bb.y),P(bb.x,bb.y+bb.height),P(bb.x+bb.width,bb.y+bb.height)];
    const xs=q.map(v=>v.x), ys=q.map(v=>v.y), x=Math.min(...xs), y=Math.min(...ys);
    return {x,y,w:Math.max(...xs)-x,h:Math.max(...ys)-y};};
  const boxes=keep.map(abs);
  const x0=Math.min(...boxes.map(q=>q.x)), y0=Math.min(...boxes.map(q=>q.y));
  const x1=Math.max(...boxes.map(q=>q.x+q.w)), y1=Math.max(...boxes.map(q=>q.y+q.h));
  const holder=doc.createElementNS(NS,'svg');
  holder.setAttribute('xmlns',NS);
  holder.setAttribute('viewBox',`0 0 ${(1093.2).toFixed(2)} ${(1000).toFixed(2)}`);
  const defs=svg.querySelector('defs');
  if(defs) holder.appendChild(defs.cloneNode(true));
  keep.forEach(g=>holder.appendChild(g.cloneNode(true)));

  return {svg:new XMLSerializer().serializeToString(holder),
          box:[x0,y0,x1-x0,y1-y0].map(v=>+v.toFixed(2)), n:keep.length};
},[src]);
if(!r){ console.log('no road found'); process.exit(1); }
/* his run carried out to the edge of the screen - see roadout.js */
const out=roadout.carry(r.svg);
fs.writeFileSync(`${ROOT}/assets/scene/m-road.svg`, out.svg);
console.log('his mobile road lifted:', r.n, 'curves | box', r.box.join(','));
await b.close();
})();
