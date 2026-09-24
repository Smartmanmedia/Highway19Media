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
      const bb=el.getBBox(); return bb.width>300&&bb.height>120;
    });
    if(plates.length){
      // the plate that carries his green face wins; else the first
      const face=plates.find(el=>/^#(1c9022|006802|007a29)$/i.test(el.getAttribute('fill')||''))||plates[0];
      let g=face.parentNode;
      while(g&&g.tagName==='g'&&g.parentNode&&g.parentNode.tagName==='g'&&g.children.length<3) g=g.parentNode;
      if(g&&g.tagName==='g'){ g.setAttribute('data-sign','1'); }
      else { face.setAttribute('data-sign','1'); }
      const a=abs(face); if(a) signBox={x:+a.x.toFixed(1),y:+a.y.toFixed(1),w:+Math.abs(a.w).toFixed(1),h:+Math.abs(a.h).toFixed(1)};
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
