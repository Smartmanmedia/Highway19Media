#!/usr/bin/env node
/* HIS SHADOWS COME OUT OF ILLUSTRATOR ON MULTIPLY, AND HIS SVG EXPORT DROPS IT.
 *
 * Every shadow in his artboards - under a building, a chimney, a tank, a rock,
 * a tree - is a flat light shape set to Multiply. His flattened JPG shows them
 * as shadows; his SVG shows them as pale slabs lying on the ground, because
 * the blend never made it into the file.
 *
 * Rather than guess which shapes those are, this asks his own two exports.
 * Each section is rendered from the SVG and held next to his JPG of the same
 * artboard. For every flat-filled shape, the points where the SVG render IS
 * that shape - so nothing is drawn over it - are compared with his JPG. Where
 * he is materially darker than the file, that shape was blending, and it is
 * repainted as what it always was: black, and see-through.
 */
const {chromium}=require('playwright');
const fs=require('fs'), path=require('path');
const ROOT=path.join(__dirname,'..','..');
const SEC=[['01',982.8],['02',1645.2],['03',1865.2],['04',1951.6],
           ['05',1951.6],['06',1951.6],['07',2378.8],['08',2378.8]];

(async()=>{
const b=await chromium.launch({executablePath:process.env.CHROME_PATH});
const p=await b.newPage({viewport:{width:2128,height:900}});
for(const [k,H] of SEC){
  const file=`${ROOT}/assets/scene/sec-${k}.svg`;
  const src=fs.readFileSync(file,'utf8');
  const jpg=fs.readFileSync(`${ROOT}/assets/scene/Highway19-QA-artboard-${k}.jpg`).toString('base64');

  await p.setContent('<!doctype html><meta charset=utf-8><style>html,body{margin:0;background:#fff}'
    +'#h svg{display:block}</style><div id=h></div>');
  await p.evaluate(([src,H])=>{
    document.getElementById('h').innerHTML=src;
    const svg=document.querySelector('#h svg');
    /* his own framing is put back before the file is written: this one is
       only borrowed to line the render up with his flat export */
    window.__keep=['viewBox','width','height'].map(k=>[k,svg.getAttribute(k)]);
    svg.setAttribute('viewBox','0 0 2128 '+H);
    svg.setAttribute('width','2128'); svg.setAttribute('height',String(Math.round(H)));
    svg.style.width='2128px'; svg.style.height=Math.round(H)+'px';
    /* the traffic slot is empty at build time; his card art is already out */
  },[src,H]);
  await p.waitForTimeout(250);
  const shot=(await p.screenshot({clip:{x:0,y:0,width:2128,height:Math.round(H)},
    fullPage:true})).toString('base64');

  const out=await p.evaluate(async([shot,jpg,H])=>{
    const load=(b64,m)=>new Promise(async r=>{const im=new Image();
      im.src='data:'+m+';base64,'+b64; await im.decode(); r(im);});
    const A=await load(shot,'image/png'), B=await load(jpg,'image/jpeg');
    const W=2128, HH=Math.round(H);
    const grab=im=>{const c=document.createElement('canvas');c.width=W;c.height=HH;
      const x=c.getContext('2d',{willReadFrequently:true});
      x.drawImage(im,0,0,W,HH); return x.getImageData(0,0,W,HH).data;};
    const DA=grab(A), DB=grab(B);
    const at=(D,x,y)=>{const q=((y|0)*W+(x|0))*4; return [D[q],D[q+1],D[q+2]];};

    const svg=document.querySelector('#h svg');
    const hit=[];
    svg.querySelectorAll('polygon,path,rect,circle,ellipse').forEach(e=>{
      const f=e.getAttribute('fill');
      if(!f||!/^#[0-9a-fA-F]{6}$/.test(f)) return;
      if(e.closest('defs')) return;
      const R=parseInt(f.slice(1,3),16),G=parseInt(f.slice(3,5),16),Bl=parseInt(f.slice(5,7),16);
      /* a shape that blends to nothing is not worth finding, and pure white
         and near-black never read as a shadow either way */
      const mx=Math.max(R,G,Bl);
      if(mx<40||mx>250) return;
      let bb; try{bb=e.getBBox()}catch(x){return}
      if(bb.width<6||bb.height<6) return;
      const c=e.getCTM(); if(!c) return;
      const x0=c.a*bb.x+c.c*bb.y+c.e, y0=c.b*bb.x+c.d*bb.y+c.f;
      const w=bb.width*c.a, h=bb.height*c.d;
      const X0=Math.min(x0,x0+w), Y0=Math.min(y0,y0+h);
      const WW=Math.abs(w), HH2=Math.abs(h);
      let seen=0, dark=0, sumR=0;
      /* a shadow is often a long diagonal band with a mostly empty bounding
         box, and half of it lies under the thing casting it - so sample it
         densely and settle for a handful of points that are really its own */
      const N=15;
      for(let iy=1;iy<=N;iy++) for(let ix=1;ix<=N;ix++){
        const px=Math.round(X0+WW*ix/(N+1)), py=Math.round(Y0+HH2*iy/(N+1));
        if(px<1||py<1||px>=W-1||py>=HH-1) continue;
        const a=at(DA,px,py);
        /* the shape has to BE what is on screen here, or something else is */
        if(Math.abs(a[0]-R)>4||Math.abs(a[1]-G)>4||Math.abs(a[2]-Bl)>4) continue;
        seen++;
        const b2=at(DB,px,py);
        const lum=(a[0]+a[1]+a[2])||1, lumB=(b2[0]+b2[1]+b2[2]);
        /* multiply darkens; it never lightens, and it never goes to nothing.
           A ratio outside that range is something else and not counted. */
        const ratio=lumB/lum;
        if(ratio<0.88&&ratio>0.25){ dark++; sumR+=ratio; }
      }
      if(dark>=8 && dark>=seen*0.45) hit.push({el:e, r:+(sumR/dark).toFixed(3)});
    });
    hit.forEach(q=>{ q.el.setAttribute('fill','#000'); q.el.setAttribute('opacity','0.3'); });
    (window.__keep||[]).forEach(([k,v])=>{
      if(v==null) svg.removeAttribute(k); else svg.setAttribute(k,v); });
    svg.style.width=''; svg.style.height='';
    return {n:hit.length,
            svg:new XMLSerializer().serializeToString(svg)};
  },[shot,jpg,H]);

  fs.writeFileSync(file,out.svg);
  console.log('   shadows',k,out.n);
}
await b.close();
})();
