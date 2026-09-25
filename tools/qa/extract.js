/* His artboards are the source of truth.
   Lifts the drawn Q&A cards out, writes clean section SVGs + the geometry and
   the question/answer text to rebuild them live. */
const {chromium}=require('playwright');
const fs=require('fs'), path=require('path');
const ROOT='/home/user/highway19media';
const SEC=[['01',982.8],['02',1645.2],['03',1865.2],['04',1951.6],
           ['05',1951.6],['06',1951.6],['07',2378.8],['08',2378.8]];
const imgmap=JSON.parse(fs.readFileSync(path.join(__dirname,'imgmap.json'),'utf8'));

(async()=>{
const b=await chromium.launch({executablePath:process.env.CHROME_PATH});
const p=await b.newPage({viewport:{width:1200,height:900}});
await p.goto('http://localhost:8777/_r.html');
const out={};
for(const [k,H] of SEC){
  const src=fs.readFileSync(`${ROOT}/assets/scene/Highway19-QA-artboard-${k}.svg`,'utf8');
  const r=await p.evaluate(([src,imgmap,H])=>{
    const doc=new DOMParser().parseFromString(src,'image/svg+xml');
    const svg=doc.documentElement;
    document.body.innerHTML=''; document.body.appendChild(svg);
    svg.setAttribute('width','2128'); svg.setAttribute('height',String(H));
    const abs=el=>{ let bb; try{bb=el.getBBox()}catch(e){return null}
      const c=el.getCTM(); if(!c) return null;
      return {x:c.a*bb.x+c.c*bb.y+c.e, y:c.b*bb.x+c.d*bb.y+c.f, w:bb.width*c.a, h:bb.height*c.d}; };
    /* some of his groups come through flipped, so abs() can hand back a
       negative width or height; work from a box that is always the right
       way up */
    const nbox=el=>{ const a2=abs(el); if(!a2) return null;
      return {x:Math.min(a2.x,a2.x+a2.w), y:Math.min(a2.y,a2.y+a2.h),
              w:Math.abs(a2.w), h:Math.abs(a2.h)}; };
    const fam=el=>(el.getAttribute('font-family')||'').split(',')[0];

    /* externalise the embedded rasters */
    const imgs=[];
    svg.querySelectorAll('image').forEach(im=>{
      const href=im.getAttribute('xlink:href')||im.getAttribute('href')||'';
      const m=href.match(/base64,(.{0,64})/); if(!m) return;
      const key=Object.keys(imgmap).find(q=>imgmap[q].head===m[1]); if(!key) return;
      const tr=im.getAttribute('transform')||'';
      const sc=parseFloat((tr.match(/scale\(([\d.]+)\)/)||[0,1])[1]);
      im.setAttribute('width',(parseFloat(im.getAttribute('width'))*sc).toFixed(3));
      im.setAttribute('height',(parseFloat(im.getAttribute('height'))*sc).toFixed(3));
      im.setAttribute('transform',tr.replace(/\s*scale\([\d.]+\)/,''));
      im.removeAttribute('xlink:href');
      im.setAttribute('href','assets/img/'+imgmap[key].file);
      imgs.push(imgmap[key].file);
    });

    /* his wide strip elements (the forest) are tiles: carry them past his
       artboard on his own pitch so the page can run full width */
    const strips=[...svg.querySelectorAll('image')].filter(im=>parseFloat(im.getAttribute('width'))>1500);
    if(strips.length>=2){
      const xs=strips.map(im=>{
        const t=(im.getAttribute('transform')||'').match(/translate\(([-\d.]+)[ ,]+([-\d.]+)\)/);
        return t?{x:parseFloat(t[1]),y:parseFloat(t[2])}:null;}).filter(Boolean);
      const pitch=Math.abs(xs[1].x-xs[0].x)||1;
      const wid=parseFloat(strips[0].getAttribute('width'));
      const host=strips[0].closest('g')?strips[0].closest('g').parentNode:svg;
      const first=strips[0].closest('g')||strips[0];
      const add=[];
      for(let i=1;i<=Math.ceil((480+pitch)/pitch);i++){
        add.push({im:strips[0],x:xs[0].x-i*pitch,y:xs[0].y});
        add.push({im:strips[1],x:xs[1].x+i*pitch,y:xs[1].y});
      }
      for(const a of add){
        if(a.x+wid < -520 || a.x > 2128+520) continue;
        const c=a.im.cloneNode(false);
        c.setAttribute('transform','translate('+a.x.toFixed(2)+' '+a.y.toFixed(2)+')');
        c.setAttribute('data-tile','1');
        host.insertBefore(c, first);          /* behind his own copies */
      }
    }

    const texts=[...svg.querySelectorAll('text')].map(el=>({el,a:abs(el),f:fam(el),
      s:parseFloat(el.getAttribute('font-size')||0)}));
    const rects=[...svg.querySelectorAll('rect')].map(el=>({el,a:abs(el),
      rx:parseFloat(el.getAttribute('rx')||0)}))
      .filter(r=>r.a&&Math.abs(r.rx-10)<0.8&&r.a.w>400&&r.a.w<1000&&r.a.h>40);
    const inside=(a,t,pad=7)=>t.a&&t.a.x>a.x-pad&&t.a.y>a.y-pad&&
      t.a.x+t.a.w<a.x+a.w+pad&&t.a.y+t.a.h<a.y+a.h+pad;

    const kill=new Set(), cards=[], panels=[];
    for(const r of rects){
      const ts=texts.filter(t=>inside(r.a,t));
      const qs=ts.filter(t=>t.f.indexOf('Arial')>=0&&t.s>14&&t.s<20);
      if(!qs.length){ panels.push({x:+r.a.x.toFixed(2),y:+r.a.y.toFixed(2),
        w:+r.a.w.toFixed(2),h:+r.a.h.toFixed(2),
        fill:r.el.getAttribute('fill')||getComputedStyle(r.el).fill,
        txt:ts.map(t=>t.el.textContent.trim()).slice(0,3)}); continue; }
      qs.sort((x,y)=>(Math.abs(x.a.y-y.a.y)<6? x.a.x-y.a.x : x.a.y-y.a.y));
      const body=ts.filter(t=>!qs.includes(t));
      body.sort((x,y)=>x.a.y-y.a.y||x.a.x-y.a.x);
      let disc=null;
      svg.querySelectorAll('circle,ellipse').forEach(el=>{
        const c=abs(el); if(!c) return;
        if(c.x>r.a.x+r.a.w*0.6&&c.y>r.a.y-4&&c.y+c.h<r.a.y+r.a.h+4&&c.w>10&&c.w<50){
          disc={x:+c.x.toFixed(2),y:+c.y.toFixed(2),d:+c.w.toFixed(2),
                fill:el.getAttribute('fill')||getComputedStyle(el).fill,
                stroke:el.getAttribute('stroke')||null};
          kill.add(el);
        }
      });
      svg.querySelectorAll('path,line,rect,circle,ellipse').forEach(el=>{
        if(el===r.el) return;
        const c=abs(el); if(!c) return;
        if(c.w>52||c.h>52) return;
        if(c.x>r.a.x+r.a.w*0.55&&c.x+c.w<r.a.x+r.a.w+4&&c.y>r.a.y-4&&c.y+c.h<r.a.y+r.a.h+4) kill.add(el);
      });
      const q0=qs[0], b0=body[0];
      cards.push({
        x:+r.a.x.toFixed(2), y:+r.a.y.toFixed(2), w:+r.a.w.toFixed(2), h:+r.a.h.toFixed(2),
        rx:r.el.getAttribute('rx'),
        fill:r.el.getAttribute('fill')||getComputedStyle(r.el).fill,
        stroke:r.el.getAttribute('stroke')||null,
        sw:r.el.getAttribute('stroke-width')||null,
        open: body.length>0,
        q: qs.map(t=>t.el.textContent.trim()).join(' ').replace(/\s+/g,' '),
        qn: qs.length,
        a: body.map(t=>t.el.textContent.trim()),
        qfam:q0.f, qsize:q0.s, qfill:q0.el.getAttribute('fill'),
        qx:+q0.a.x.toFixed(2), qy:+q0.a.y.toFixed(2), qbh:+q0.a.h.toFixed(2),
        qlead: qs.length>1&&Math.abs(qs[1].a.y-q0.a.y)>6 ? +(qs[1].a.y-q0.a.y).toFixed(2):null,
        bfam:b0?b0.f:null, bsize:b0?b0.s:null, bfill:b0?b0.el.getAttribute('fill'):null,
        blines: body.map(t=>({y:+t.a.y.toFixed(2),h:+t.a.h.toFixed(2),n:t.el.querySelectorAll('tspan').length})),
        bx:b0?+b0.a.x.toFixed(2):null, by:b0?+b0.a.y.toFixed(2):null,
        blead: body.length>1?+(body[1].a.y-b0.a.y).toFixed(2):null,
        disc
      });
      kill.add(r.el); ts.forEach(t=>kill.add(t.el));
    }
    /* tag his sign assembly so it can be given parallax */
    let signBox=null;
    const plates=[...svg.querySelectorAll('rect')].filter(el=>{
      const rx=parseFloat(el.getAttribute('rx')||0);
      if(rx<15||rx>22) return false;
      /* the shadow he throws off a rounded board is a rounded board too;
         the face is the solid one */
      for(let a=el; a && a!==svg; a=a.parentNode)
        if(parseFloat(a.getAttribute('opacity')||'1')<0.7) return false;
      const bb=el.getBBox(); if(bb.width<=300) return false;
      if(bb.height>120) return true;
      /* a sign he drew across a seam arrives as a short clipped strip at the
         top or the foot of the artboard; that strip is a sign too */
      const a2=nbox(el); if(!a2) return false;
      return bb.height>26 && (a2.y<26 || a2.y+a2.h>H-26);
    });
    const faces=[];
    if(plates.length){
      // the plate that carries his green face wins; else the first
      /* the face he painted, not the panel behind it: his green if there is
         one, else the biggest plate that actually carries a fill */
      const area=el=>{const b=el.getBBox();return b.width*b.height;};
      const byArea=[...plates].sort((a,b)=>area(b)-area(a));
      const first=plates.find(el=>/^#(1c9022|006802|007a29)$/i.test(el.getAttribute('fill')||''))
              || byArea.find(el=>el.getAttribute('fill'))
              || byArea[0];
      faces.push({el:first,seam:false});
      /* plus any seam strip that is a different sign from the one above */
      byArea.forEach(el=>{
        if(faces.some(f=>f.el===el)) return;
        const a2=nbox(el); if(!a2) return;
        if(!(a2.y<26 || a2.y+a2.h>H-26)) return;
        if(faces.some(f=>{const b3=nbox(f.el); return b3 &&
          Math.min(b3.y+b3.h,a2.y+a2.h)-Math.max(b3.y,a2.y) > -2; })) return;
        faces.push({el,seam:true});
      });
    }
    for(const F of faces){
      const face=F.el;
      let g=face.parentNode;
      while(g&&g.tagName==='g'&&g.parentNode&&g.parentNode.tagName==='g'&&g.children.length<3) g=g.parentNode;
      let plate=g&&g.tagName==='g'?g:face;
      /* if that group is only the face itself, its bolts and hangers are one
         level further out; a board that lifts off its own bolts reads broken */
      const fb=nbox(face), pb0=nbox(plate);
      if(fb&&pb0&&Math.abs(pb0.w-fb.w)<fb.w*0.06&&Math.abs(pb0.h-fb.h)<fb.h*0.06&&
         plate.parentNode&&plate.parentNode!==svg&&plate.parentNode.tagName==='g'&&
         plate.parentNode.parentNode&&plate.parentNode.parentNode!==svg){
        const up=nbox(plate.parentNode);
        /* only if that level is still a sign, not half his artboard */
        if(up&&up.w<fb.w*2.6&&up.h<fb.h*2.2) plate=plate.parentNode;
      }
      /* the whole assembly moves together - the plate, its bolts, the truss it
         hangs off and the shadow it throws. A plate that floats off its own
         gantry reads as broken, not as parallax. */
      const pa=nbox(plate);
      const host2=plate.parentNode;
      const wrap=doc.createElementNS('http://www.w3.org/2000/svg','g');
      wrap.setAttribute('data-sign','1');
      host2.insertBefore(wrap,plate);
      /* his road, his sea, his ground and his sky never travel with a sign,
         however much they overlap it - a stretch of his road lifted onto the
         sign layer paints over the traffic driving along it */
      const NOTSIGN=/^(\d\d_)?(Stright|Curve|ocean|Grass|Mountains|Forest|Cloud)/i;
      /* his sign's own cast shadow stays on the ground, and so does anything
         else he drew see-through in that band - his container ship among them.
         The plate riding over a shadow that stays put is what makes it read
         as the nearest thing on the page. */
      const seeThrough=e=>{
        if(parseFloat(e.getAttribute('opacity')||'1')<0.7) return true;
        const shapes=[...e.querySelectorAll(
          'path,rect,polygon,circle,ellipse,line,polyline,image,text')];
        if(!shapes.length) return false;
        /* see-through only when everything it actually paints is */
        return shapes.every(q=>{
          let o=1;
          for(let a=q; a && a!==e.parentNode; a=a.parentNode)
            o*=parseFloat(a.getAttribute('opacity')||'1');
          return o<0.7;
        });
      };
      /* A see-through piece drawn square over the plate is the light his
         fittings throw ON the sign, and it travels with it. One that is
         offset off the plate is the shadow the sign throws on the ground,
         and that stays where it lands. */
      const offPlate=e=>{
        const b3=nbox(e); if(!b3||!pa) return true;
        /* light lands INSIDE the board - his fittings throw a wedge down the
           face of it. A shadow is the board's own shape pushed off the board.
           So anything see-through that stays within the plate travels with it,
           and anything that hangs outside stays on the ground. */
        const m=6;
        return b3.x<pa.x-m || b3.y<pa.y-m ||
               b3.x+b3.w>pa.x+pa.w+m || b3.y+b3.h>pa.y+pa.h+m;
      };
      const band=F.seam?[]:[...host2.children].filter(e=>{
        if(e===wrap) return false;
        if(e!==plate&&seeThrough(e)&&offPlate(e)) return false;
        if(NOTSIGN.test(e.id||'')) return false;
        if(e.querySelector&&[...e.querySelectorAll('[id]')].some(q=>NOTSIGN.test(q.id))) return false;
        const b2=nbox(e); if(!b2||!pa) return false;
        /* only what hangs with the sign: no taller than the plate and inside
           its band. A road that merely crosses the band is not part of it. */
        if(b2.w>pa.w*1.8) return false;
        if(b2.h>pa.h*1.1) return false;
        if(b2.y<pa.y-pa.h*0.6||b2.y+b2.h>pa.y+pa.h*1.7) return false;
        const ov=Math.min(pa.y+pa.h,b2.y+b2.h)-Math.max(pa.y,b2.y);
        return ov>Math.min(pa.h,b2.h)*0.45;
      });
      band.forEach(e=>wrap.appendChild(e));
      /* his bolts and hangers sit a few groups deeper than the plate, so the
         sibling sweep misses them and the board lifts off its own fixings */
      if(pa&&!F.seam){
        const hang=[];
        const inWrap=n=>{ for(let a=n; a; a=a.parentNode) if(a===wrap) return true; return false; };
        svg.querySelectorAll('g,rect,path,polygon').forEach(e=>{
          if(inWrap(e)||e===wrap||e.contains(wrap)) return;
          /* his rocks and his treeline are never a sign's fixings, however
             close they happen to fall to the plate */
          for(let a=e; a && a!==svg; a=a.parentNode)
            if(NOTSIGN.test(a.id||'')) return;
          if(hang.some(h=>h.contains(e))) return;
          const b2=nbox(e); if(!b2) return;
          if(b2.w<3||b2.h<3) return;
          if(b2.w>pa.w*0.15||b2.h>pa.h*0.25) return;
          if(b2.x<pa.x-15||b2.x+b2.w>pa.x+pa.w+15) return;
          if(b2.y<pa.y-26||b2.y+b2.h>pa.y+pa.h+46) return;
          if(seeThrough(e)&&offPlate(e)) return;
          hang.push(e);
        });
        hang.forEach(e=>wrap.appendChild(e));
      }
      if(!wrap.children.length) wrap.appendChild(plate);
      /* A SEAM STRIP CARRIES NOTHING BUT ITS OWN BOARD. His exporter drops
         whatever else he drew near the sign into the same group, and those
         fragments then ride over the face. Earth and foliage are not signage. */
      /* EARTH AND FOLIAGE ARE NOT SIGNAGE. Rocks and treetops he drew near a
         board land inside its box, get swept up with its fixings and then
         paint over the face. His own signage colours - the green, the gold
         banner, white, black, the blue badge - all stay. */
      {
        const SIGNGREEN=/^#(1c9022|006802|007a29)$/i;
        const scenery=f=>{
          if(!f||f.indexOf('url(')===0) return false;
          const m=/^#([0-9a-fA-F]{6})$/.exec(f); if(!m) return false;
          if(SIGNGREEN.test(f)) return false;
          const r=parseInt(m[1].slice(0,2),16),g=parseInt(m[1].slice(2,4),16),
                b2=parseInt(m[1].slice(4,6),16);
          if(r>b2+18&&b2>=100) return true;                 /* rock, sand, stone */
          if(r>b2+30&&r<200&&g<r&&g>b2) return true;        /* timber, dirt */
          if(g>r+18&&g>b2+18) return true;                  /* leaves */
          return false;
        };
        [...wrap.querySelectorAll('[fill]')].forEach(q=>{
          if(scenery(q.getAttribute('fill'))&&q.parentNode) q.parentNode.removeChild(q);
        });
        [...wrap.children].forEach(q=>{
          if(!q.querySelector||q.querySelector('*')||q.getAttribute('fill')) return;
        });
      }
      /* keeps the half honest: nothing outside the board it belongs to. His exporter puts the
         whole sign into both artboards and lets each viewBox cut it; the half
         in the section above comes with fragments of whatever else he drew
         near it, which then ride over the sign. Clipped to the board itself. */
      if(F.seam&&pa){
        let defs2=svg.querySelector('defs');
        if(!defs2){ defs2=doc.createElementNS('http://www.w3.org/2000/svg','defs');
          svg.insertBefore(defs2,svg.firstChild); }
        const cid='signclip-'+Math.round(pa.x)+'-'+Math.round(pa.y);
        const cp=doc.createElementNS('http://www.w3.org/2000/svg','clipPath');
        cp.setAttribute('id',cid);
        const rr=doc.createElementNS('http://www.w3.org/2000/svg','rect');
        rr.setAttribute('x',(pa.x-10).toFixed(1)); rr.setAttribute('y',(pa.y-10).toFixed(1));
        rr.setAttribute('width',(pa.w+20).toFixed(1)); rr.setAttribute('height',(pa.h+20).toFixed(1));
        cp.appendChild(rr); defs2.appendChild(cp);
        wrap.setAttribute('clip-path','url(#'+cid+')');
      }
      const a=abs(face);
      if(a&&!signBox) signBox={x:+a.x.toFixed(1),y:+a.y.toFixed(1),w:+Math.abs(a.w).toFixed(1),h:+Math.abs(a.h).toFixed(1)};
    }
    /* every remaining label, so link hotspots can be dropped on his buttons */
    const labels=[...svg.querySelectorAll('text')].filter(t=>!kill.has(t)).map(t=>{
      const a=abs(t); if(!a) return null;
      return {t:t.textContent.trim().replace(/\s+/g,' '),f:fam(t),
        s:parseFloat(t.getAttribute('font-size')||0),
        x:+a.x.toFixed(1),y:+a.y.toFixed(1),w:+Math.abs(a.w).toFixed(1),h:+Math.abs(a.h).toFixed(1),
        sp:[...t.querySelectorAll('tspan')].map(u=>{const b2=abs(u);return b2?
          {t:u.textContent,x:+b2.x.toFixed(1),y:+b2.y.toFixed(1),w:+Math.abs(b2.w).toFixed(1),h:+Math.abs(b2.h).toFixed(1)}:null;}).filter(Boolean)};
    }).filter(Boolean);
    cards.sort((a,b)=>a.y-b.y);
    kill.forEach(el=>{ const g=el.parentNode; el.remove();
      if(g&&g.tagName==='g'&&!g.children.length&&g.parentNode) g.remove(); });
    return {cards,panels,imgs,signBox,labels,svg:new XMLSerializer().serializeToString(svg)};
  },[src,imgmap,H]);

  fs.writeFileSync(`${ROOT}/assets/scene/sec-${k}.svg`, r.svg);
  out[k]={h:H, cards:r.cards, panels:r.panels, sign:r.signBox, labels:r.labels};
  console.log(k,'cards',r.cards.length,'open',r.cards.filter(c=>c.open).length,
    Math.round(r.svg.length/1024)+'KB');
  r.cards.forEach(c=>console.log('    ',c.open?'OPEN':'shut',c.q.slice(0,58)));
}
fs.writeFileSync(path.join(__dirname,'cards.json'), JSON.stringify(out,null,1));
await b.close();})();
