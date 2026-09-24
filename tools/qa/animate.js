/* Wraps the things in his art that should move - his lorries, his ship, his
   planes - into groups the page can drive, and lays extra lorries onto the
   lanes he drew but left empty. Nothing is redrawn: every vehicle on the page
   is his own artwork. */
const {chromium}=require('playwright');
const fs=require('fs'), path=require('path');
const ROOT='/home/user/highway19media';
const CFG=JSON.parse(fs.readFileSync(path.join(__dirname,'traffic.json'),'utf8'));
const KS=['01','02','03','04','05','06','07','08'];

(async()=>{
const b=await chromium.launch({executablePath:process.env.CHROME_PATH});
const p=await b.newPage({viewport:{width:1200,height:900}});
await p.goto('http://localhost:8777/assets/scene/_r.html');
const report={}; const sprites={};
/* first pass: lift the sprites other sections borrow (his own vehicles) */
for(const k of KS){
  const cfg=CFG[k]; if(!cfg||!cfg.palette) continue;
}
for(const k of KS){
  const file=`${ROOT}/assets/scene/sec-${k}.svg`;
  const src=fs.readFileSync(file,'utf8');
  const cfg=CFG[k]||{};
  cfg._sprites={};
  for(const L of (cfg.lanes||[])){
    const [sk,si]=L.src.split(':');
    if(!sprites[L.src]) throw new Error('sprite '+L.src+' not lifted yet (order sections so the source runs first)');
    cfg._sprites[L.src]=sprites[L.src];
  }
  const r=await p.evaluate(([src,cfg,k])=>{
    const doc=new DOMParser().parseFromString(src,'image/svg+xml');
    const svg=doc.documentElement;
    document.body.innerHTML=''; document.body.appendChild(svg);
    svg.setAttribute('width','2128');
    const abs=el=>{let bb;try{bb=el.getBBox()}catch(e){return null}
      const c=el.getCTM(); if(!c) return null;
      return {x:c.a*bb.x+c.c*bb.y+c.e, y:c.b*bb.x+c.d*bb.y+c.f,
              w:Math.abs(bb.width*c.a), h:Math.abs(bb.height*c.d)};};
    const PAL=(cfg.palette||['#854d26']).map(s=>s.toLowerCase());

    /* seed on his vehicle body colour, then take in every sibling that touches it */
    const seeds=[...svg.querySelectorAll('[fill]')].filter(e=>
      PAL.includes((e.getAttribute('fill')||'').toLowerCase()));
    const made=[];
    const claimed=new Set();
    for(const seed of seeds){
      if(claimed.has(seed)) continue;
      const host=seed.parentNode; if(!host||host.tagName==='defs') continue;
      const kids=[...host.children];
      let i0=kids.indexOf(seed), i1=i0;
      const box=abs(seed); if(!box) continue;
      const pad=cfg.pad==null?26:cfg.pad;
      const grow=(a,b2)=>({x:Math.min(a.x,b2.x),y:Math.min(a.y,b2.y),
        w:Math.max(a.x+a.w,b2.x+b2.w)-Math.min(a.x,b2.x),
        h:Math.max(a.y+a.h,b2.y+b2.h)-Math.min(a.y,b2.y)});
      let cur={...box};
      const touches=(a,c)=>c&&c.x<a.x+a.w+pad&&c.x+c.w>a.x-pad&&c.y<a.y+a.h+pad&&c.y+c.h>a.y-pad
                       &&c.w<a.w+3*pad&&c.h<a.h+3*pad;
      let moved=true;
      while(moved){ moved=false;
        if(i0>0){const c=abs(kids[i0-1]); if(touches(cur,c)){cur=grow(cur,c);i0--;moved=true;}}
        if(i1<kids.length-1){const c=abs(kids[i1+1]); if(touches(cur,c)){cur=grow(cur,c);i1++;moved=true;}}
      }
      const g=doc.createElementNS('http://www.w3.org/2000/svg','g');
      host.insertBefore(g,kids[i0]);
      for(let i=i0;i<=i1;i++){ claimed.add(kids[i]); g.appendChild(kids[i]); }
      const a=abs(g);
      made.push({g,a});
    }
    made.sort((u,v)=>u.a.y-v.a.y||u.a.x-v.a.x);
    const found=made.map((m,i)=>{
      m.g.setAttribute('data-veh',String(i));
      return {i,x:+m.a.x.toFixed(1),y:+m.a.y.toFixed(1),w:+m.a.w.toFixed(1),h:+m.a.h.toFixed(1)};
    });

    const NS='http://www.w3.org/2000/svg';
    /* put a group on a track: wrapper carries the offset, inner carries the run */
    const track=(g,axis,a,b,dur,delay)=>{
      const run=doc.createElementNS(NS,'g');
      run.setAttribute('class','run');
      run.setAttribute('style','--a:'+a+'px;--b:'+b+'px;--dur:'+dur+'s;--dly:'+delay+'s');
      run.setAttribute('data-axis',axis);
      g.parentNode.insertBefore(run,g);
      run.appendChild(g);
      return run;
    };

    /* his own vehicles, set running on the lane he drew them in */
    (cfg.drive||[]).forEach(d=>{
      const m=made[d.veh]; if(!m) return;
      const at = d.axis==='x' ? m.a.x : m.a.y;
      const a=d.from-at, b=d.to-at;
      const run=track(m.g,d.axis,a.toFixed(1),b.toFixed(1),d.dur,0);
      for(let c=1;c<=(d.clones||0);c++){
        const cp=run.cloneNode(true);
        cp.setAttribute('style','--a:'+a.toFixed(1)+'px;--b:'+b.toFixed(1)+'px;--dur:'+d.dur+'s;--dly:'+
          (-d.dur*c/(d.clones+1)).toFixed(2)+'s');
        run.parentNode.insertBefore(cp,run);
      }
    });

    /* the lanes he drew and left empty */
    const lanesOut=[];
    (cfg.lanes||[]).forEach((L,li)=>{
      const sp=(cfg._sprites||{})[L.src];
      if(!sp) { lanesOut.push('no sprite '+L.src); return; }
      const holder=doc.createElementNS(NS,'g');
      holder.setAttribute('data-lane',String(li));
      svg.appendChild(holder);
      for(let i=0;i<L.n;i++){
        const wrap=doc.createElementNS(NS,'g');
        wrap.innerHTML=sp.markup;
        const inner=doc.createElementNS(NS,'g');
        while(wrap.firstChild) inner.appendChild(wrap.firstChild);
        const off=doc.createElementNS(NS,'g');
        off.setAttribute('transform','translate(0 '+(L.y-sp.y).toFixed(2)+')');
        off.appendChild(inner);
        const run=doc.createElementNS(NS,'g');
        run.setAttribute('class','run'); run.setAttribute('data-axis','x');
        run.setAttribute('style','--a:'+(L.from-sp.x).toFixed(1)+'px;--b:'+(L.to-sp.x).toFixed(1)+
          'px;--dur:'+L.dur+'s;--dly:'+(-L.dur*i/L.n).toFixed(2)+'s');
        run.appendChild(off);
        holder.appendChild(run);
      }
      lanesOut.push('lane '+li+' x'+L.n);
    });

    /* his ship, his boat, his plane and its shadow */
    const moversOut=[];
    (cfg.movers||[]).forEach(mv=>{
      let best=null,bd=1e9;
      svg.querySelectorAll('g,path').forEach(el=>{
        const a=abs(el); if(!a) return;
        const dd=Math.abs(a.x-mv.box[0])+Math.abs(a.y-mv.box[1])+
                 Math.abs(a.w-mv.box[2])+Math.abs(a.h-mv.box[3]);
        if(dd<bd){bd=dd;best=el;}
      });
      if(!best||bd>18){moversOut.push(mv.name+' MISS '+bd.toFixed(1));return}
      const a=abs(best);
      best.setAttribute('data-mover',mv.name);
      const run=doc.createElementNS(NS,'g');
      run.setAttribute('class','run'+(mv.fade?' run--fade':''));
      run.setAttribute('data-axis',mv.axis);
      if(mv.axis==='xy'){
        run.setAttribute('style','--ax:'+mv.from[0]+'px;--ay:'+mv.from[1]+'px;--bx:'+mv.to[0]+
          'px;--by:'+mv.to[1]+'px;--dur:'+mv.dur+'s;--dly:'+(mv.dly||0)+'s');
      } else {
        const at = mv.axis==='x'? a.x : a.y;
        run.setAttribute('style','--a:'+(mv.from-at).toFixed(1)+'px;--b:'+(mv.to-at).toFixed(1)+
          'px;--dur:'+mv.dur+'s;--dly:'+(mv.dly||0)+'s');
      }
      best.parentNode.insertBefore(run,best); run.appendChild(best);
      moversOut.push(mv.name+' ok '+bd.toFixed(1));
    });

    const sprites=made.map((m,i)=>({i,x:m.a.x,y:m.a.y,w:m.a.w,h:m.a.h,markup:m.g.innerHTML}));
    return {found, sprites, lanes:lanesOut, movers:moversOut,
            svg:new XMLSerializer().serializeToString(svg)};
  },[src,cfg,k]);
  fs.writeFileSync(file, r.svg);
  report[k]=r.found;
  for(const s2 of (r.sprites||[])) sprites[k+':'+s2.i]=s2;
  console.log('==',k,r.found.length,'vehicles',(r.lanes||[]).join(', '),(r.movers||[]).join(', '));
}
fs.writeFileSync(path.join(__dirname,'vehicles.json'),JSON.stringify(report,null,1));
await b.close();})();
