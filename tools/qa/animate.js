/* Wraps the things in his art that should move - his lorries, his ship, his
   planes - into groups the page can drive, and lays extra lorries onto the
   lanes he drew but left empty. Nothing is redrawn: every vehicle on the page
   is his own artwork. */
const {chromium}=require('playwright');
const fs=require('fs'), path=require('path');
const ROOT='/home/user/highway19media';
const CFG=JSON.parse(fs.readFileSync(path.join(__dirname,'traffic.json'),'utf8'));
const ROUTES=JSON.parse(fs.readFileSync(path.join(__dirname,'routes.json'),'utf8'));
const BLEEDART=JSON.parse(fs.readFileSync(path.join(__dirname,'bleedart.json'),'utf8'));
const KS=['05','06','07','01','02','03','04','08'];  /* his vehicles first, so every road can borrow them */

(async()=>{
const b=await chromium.launch({executablePath:process.env.CHROME_PATH});
const p=await b.newPage({viewport:{width:1200,height:900}});
await p.goto('http://localhost:8777/assets/scene/_r.html');
const report={}; const sprites={}; const lanes={};
/* a first pass over the sections that carry his vehicles, so every road on
   the page can put his own artwork on it */
for(const k of KS){
  const cfg=CFG[k]; if(!cfg||!cfg.sprite) continue;
  const src=fs.readFileSync(`${ROOT}/assets/scene/sec-${k}.svg`,'utf8');
  const got=await p.evaluate(([src,cfg,k,routes,sprites])=>{
    const doc=new DOMParser().parseFromString(src,'image/svg+xml');
    const svg=doc.documentElement;
    document.body.innerHTML=''; document.body.appendChild(svg);
    svg.setAttribute('width','2128');
    const abs=el=>{let bb;try{bb=el.getBBox()}catch(e){return null}
      const c=el.getCTM(); if(!c) return null;
      return {x:c.a*bb.x+c.c*bb.y+c.e,y:c.b*bb.x+c.d*bb.y+c.f,
              w:Math.abs(bb.width*c.a),h:Math.abs(bb.height*c.d)};};
    const PAL=(cfg.palette||[]).map(s=>s.toLowerCase());
    const out=[]; const claimed=new Set();
    for(const seed of [...svg.querySelectorAll('[fill]')].filter(e=>
        PAL.includes((e.getAttribute('fill')||'').toLowerCase()))){
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
      const touches=(a,c)=>c&&c.x<a.x+a.w+pad&&c.x+c.w>a.x-pad&&c.y<a.y+a.h+pad&&
                     c.y+c.h>a.y-pad&&c.w<a.w+3*pad&&c.h<a.h+3*pad;
      let moved=true;
      while(moved){ moved=false;
        if(i0>0){const c=abs(kids[i0-1]); if(touches(cur,c)){cur=grow(cur,c);i0--;moved=true;}}
        if(i1<kids.length-1){const c=abs(kids[i1+1]); if(touches(cur,c)){cur=grow(cur,c);i1++;moved=true;}}
      }
      const g=doc.createElementNS('http://www.w3.org/2000/svg','g');
      host.insertBefore(g,kids[i0]);
      for(let i=i0;i<=i1;i++){ claimed.add(kids[i]); g.appendChild(kids[i]); }
      const a=abs(g);
      out.push({x:a.x,y:a.y,w:a.w,h:a.h,up:a.h>a.w,markup:g.innerHTML});
    }
    return out;
  },[src,cfg,k,[],{}]);
  got.forEach((s2,i)=>{ sprites[k+':'+i]={...s2,i}; });
  console.log('   sprite pass',k,got.length);
}
for(const k of KS){
  const file=`${ROOT}/assets/scene/sec-${k}.svg`;
  const src=fs.readFileSync(file,'utf8');
  const cfg=CFG[k]||{};
  cfg._sprites={};
  const routes=ROUTES[k]||[];
  const bleedart=BLEEDART[k]||[];
  const r=await p.evaluate(([src,cfg,k,routes,sprites,bleedart])=>{
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

    /* ---- past the edge of his artboard -----------------------------------
       His own pieces carried into the flank: the industrial strip on its own
       rhythm, and his tree clump scattered. Drawn first, so everything he
       actually drew still paints over it inside his artboard. */
    if(bleedart.length){
      const back=doc.createElementNS(NS,'g');
      back.setAttribute('data-bleedart','1');
      svg.insertBefore(back, svg.firstElementChild&&svg.firstElementChild.tagName==='defs'
        ? svg.firstElementChild.nextSibling : svg.firstChild);
      const put=(href,x,y,w,h,extra)=>{
        const im=doc.createElementNS(NS,'image');
        im.setAttribute('href','assets/img/'+href);
        im.setAttribute('x',x.toFixed(1)); im.setAttribute('y',y.toFixed(1));
        im.setAttribute('width',w.toFixed(1));
        if(h) im.setAttribute('height',h.toFixed(1));
        if(extra) im.setAttribute('transform',extra);
        back.appendChild(im);
      };
      const RATIO={'industrial.webp':909/4034,'trees.webp':454/269,
                   'treerow.webp':1699/299,'forestclump.webp':667/1446};
      bleedart.forEach(a=>{
        if(a.scatter){
          let sd=a.seed||1;
          const rnd=()=>{ sd=(sd*1103515245+12345)&0x7fffffff; return sd/0x7fffffff; };
          const [bx,by,bw,bh]=a.box;
          for(let i=0;i<a.n;i++){
            const w=a.w*(0.72+rnd()*0.6);
            const h=w*RATIO[a.scatter];
            put(a.scatter, bx+rnd()*(bw-w*0.4)-w*0.3, by+rnd()*(bh-h*0.4)-h*0.3, w, h,
                'rotate('+Math.round(rnd()*360)+' '+
                (bx+bw/2).toFixed(0)+' '+(by+bh/2).toFixed(0)+')');
          }
        } else {
          put(a.img, a.x, a.y, a.w, a.w*RATIO[a.img]);
        }
      });
    }

    /* ---- the slot his traffic drives in ----------------------------------
       Everything he drew OVER the road - his signs, his clouds, his rock
       lines, his forest - moves after it, so the cars run under them. */
    const slot=doc.createElementNS(NS,'g');
    slot.setAttribute('data-fleetslot','1');
    svg.appendChild(slot);
    const rank=e=> e.hasAttribute('data-sign') ? 0
                 : /^(Mountains|Forest|Grass_BG)/i.test(e.id||'') ? 1
                 : /^Cloud/i.test(e.id||'') ? 2 : -1;
    const above=[...svg.children].filter(e=>e!==slot && rank(e)>=0);
    above.sort((a,b)=>rank(a)-rank(b));
    above.forEach(e=>svg.appendChild(e));

    /* ---- his roads, measured into lanes ---------------------------------
       Each route is his road's centreline. The lanes are offset from it
       numerically so a curve carries its vehicles round it properly. The
       polylines go out to the runtime, which drives his own traffic engine
       along them. */
    const lanesOut=[];
    if(routes.length){
      const probe=doc.createElementNS(NS,'path'); svg.appendChild(probe);
      routes.forEach((R,ri)=>{
        const offs = R.lanes===2 ? [-R.w/4, R.w/4] : [0];
        offs.forEach((off,li)=>{
          probe.setAttribute('d',R.d);
          const L=probe.getTotalLength(), N=Math.max(24,Math.round(L/9));
          let pts=[];
          for(let i=0;i<=N;i++){
            const s2=L*i/N;
            const a2=probe.getPointAtLength(Math.max(0,s2-1.2));
            const c2=probe.getPointAtLength(Math.min(L,s2+1.2));
            const o2=probe.getPointAtLength(s2);
            const dx=c2.x-a2.x, dy=c2.y-a2.y, m=Math.hypot(dx,dy)||1;
            pts.push([+(o2.x-dy/m*off).toFixed(1), +(o2.y+dx/m*off).toFixed(1)]);
          }
          if(R.lanes===2 && li===0) pts=pts.reverse();
          lanesOut.push({w:R.w/(R.lanes||1), pts});
        });
      });
      probe.remove();
    }

    /* the lanes he drew and left empty */
    /* his aircraft, flown along a path off his own runway */
    const flightOut=[];
    (cfg.flights||[]).forEach(f=>{
      let best=null,bd=1e9;
      svg.querySelectorAll('g,path').forEach(el=>{
        const a=abs(el); if(!a) return;
        const dd=Math.abs(a.x-f.box[0])+Math.abs(a.y-f.box[1])+
                 Math.abs(a.w-f.box[2])+Math.abs(a.h-f.box[3]);
        if(dd<bd){bd=dd;best=el;}
      });
      if(!best||bd>14){flightOut.push(f.name+' MISS '+bd.toFixed(1));return}
      const a=abs(best);
      if(f.shadow){
        best.setAttribute('fill','#000'); best.setAttribute('opacity','0.26');
        best.querySelectorAll&&best.querySelectorAll('[fill]').forEach(e2=>e2.setAttribute('fill','#000'));
      }
      const outer=doc.createElementNS(NS,'g');
      const scaler=doc.createElementNS(NS,'g');
      const centre=doc.createElementNS(NS,'g');
      centre.setAttribute('transform','translate('+(-(a.x+a.w/2)).toFixed(2)+','+
        (-(a.y+a.h/2)).toFixed(2)+')');
      best.parentNode.insertBefore(outer,best);
      centre.appendChild(best); scaler.appendChild(centre); outer.appendChild(scaler);
      const mo=doc.createElementNS(NS,'animateMotion');
      mo.setAttribute('path',f.path); mo.setAttribute('dur',f.dur+'s');
      mo.setAttribute('repeatCount','indefinite'); mo.setAttribute('rotate','auto');
      outer.appendChild(mo);
      if(f.grow&&f.grow!==1){
        const sc=doc.createElementNS(NS,'animateTransform');
        sc.setAttribute('attributeName','transform'); sc.setAttribute('type','scale');
        sc.setAttribute('values','1;1;'+f.grow); sc.setAttribute('keyTimes','0;0.25;1');
        sc.setAttribute('dur',f.dur+'s'); sc.setAttribute('repeatCount','indefinite');
        scaler.appendChild(sc);
      }
      if(f.fade){
        const op=doc.createElementNS(NS,'animate');
        op.setAttribute('attributeName','opacity');
        op.setAttribute('values','0;1;1;0;0');
        const kt=f.fade.map(v=>(v/100).toFixed(3));
        op.setAttribute('keyTimes','0;'+kt[1]+';'+kt[2]+';'+kt[3]+';1');
        op.setAttribute('dur',f.dur+'s'); op.setAttribute('repeatCount','indefinite');
        outer.appendChild(op);
      }
      flightOut.push(f.name+' ok '+bd.toFixed(1));
    });

    /* his ship, his boat, his plane - each moved with its own shadow, and
       the shadow made a shadow: black, and see-through. */
    const moversOut=[];
    const findBox=box=>{
      let best=null,bd=1e9;
      svg.querySelectorAll('g,path').forEach(el=>{
        const a2=abs(el); if(!a2) return;
        const dd=Math.abs(a2.x-box[0])+Math.abs(a2.y-box[1])+
                 Math.abs(a2.w-box[2])+Math.abs(a2.h-box[3]);
        if(dd<bd){bd=dd;best=el;}
      });
      return {el:best,err:bd};
    };
    (cfg.movers||[]).forEach(mv=>{
      const parts=mv.parts.map(findBox);
      if(parts.some(q=>!q.el||q.err>18)){
        moversOut.push(mv.name+' MISS '+parts.map(q=>q.err.toFixed(0)).join('/')); return; }
      const a0=abs(parts[0].el);
      const outer=doc.createElementNS(NS,'g');
      const centre=doc.createElementNS(NS,'g');
      centre.setAttribute('transform','translate('+(-(a0.x+a0.w/2)).toFixed(2)+','+
        (-(a0.y+a0.h/2)).toFixed(2)+')');
      parts[0].el.parentNode.insertBefore(outer,parts[0].el);
      parts.forEach((q,qi)=>{
        if((mv.shadow||[]).includes(qi)){
          q.el.setAttribute('fill','#000');
          q.el.setAttribute('opacity','0.26');
          q.el.querySelectorAll('[fill]').forEach(e2=>{e2.setAttribute('fill','#000');});
        }
        centre.appendChild(q.el);
      });
      outer.appendChild(centre);
      const mo=doc.createElementNS(NS,'animateMotion');
      mo.setAttribute('path',mv.path); mo.setAttribute('dur',mv.dur+'s');
      mo.setAttribute('begin',(mv.dly||0)+'s');
      mo.setAttribute('repeatCount','indefinite');
      mo.setAttribute('calcMode','linear');
      outer.appendChild(mo);
      outer.setAttribute('data-mover',mv.name);
      moversOut.push(mv.name+' ok');
    });

    return {found, roadLanes:lanesOut, flights:flightOut, movers:moversOut,
            svg:new XMLSerializer().serializeToString(svg)};
  },[src,cfg,k,routes,sprites,bleedart]);
  fs.writeFileSync(file, r.svg);
  report[k]=r.found;

  lanes[k]=r.roadLanes||[];
  console.log('==',k,r.found.length,'his vehicles |',(r.roadLanes||[]).length,'lanes |',
    (r.flights||[]).join(', '),(r.movers||[]).join(', '));
}
fs.writeFileSync(path.join(__dirname,'vehicles.json'),JSON.stringify(report,null,1));
fs.writeFileSync(`${ROOT}/assets/js/qa-lanes.js`,
  'window.H19_QA_LANES='+JSON.stringify(lanes)+';');
console.log('lanes ->', Object.keys(lanes).map(k=>k+':'+lanes[k].length).join(' '));
await b.close();})();
