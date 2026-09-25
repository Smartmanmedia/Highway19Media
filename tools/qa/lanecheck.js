/* Is every lane actually on his tarmac? Sampled against his own flat export. */
const {chromium}=require('playwright');const fs=require('fs');
(async()=>{const b=await chromium.launch({executablePath:process.env.CHROME_PATH});
const p=await b.newPage({viewport:{width:600,height:400}});
global.window={}; require('/home/user/highway19media/assets/js/qa-lanes.js');
const runs=window.H19_QA_RUNS;
const H={'01':982.8,'02':1645.2,'03':1865.2,'04':1951.6,'05':1951.6,'06':1951.6,'07':2378.8,'08':2378.8};
const CS={'01':[[1640,300]],'02':[[440,300],[440,60]],'03':[[900,60]],
          '04':[[355,300],[355,600],[355,700],[355,900],[1400,1650]],
          '05':[[600,510],[200,940]],'06':[[123,400]],'07':[[1000,2000]]};
const byK={};
runs.forEach((r,ri)=>r.forEach(s=>{ (byK[s.k]=byK[s.k]||[]).push({ri,pts:s.pts}); }));
for(const k of Object.keys(byK)){
  const b64=fs.readFileSync(`/home/user/highway19media/assets/scene/Highway19-QA-artboard-${k}.jpg`).toString('base64');
  const out=await p.evaluate(async([b64,lanes,cs,HH])=>{
    const im=new Image(); im.src='data:image/jpeg;base64,'+b64; await im.decode();
    const W=im.width,Ht=im.height;
    const c=document.createElement('canvas');c.width=W;c.height=Ht;
    const x=c.getContext('2d',{willReadFrequently:true});x.drawImage(im,0,0);
    const D=x.getImageData(0,0,W,Ht).data;
    const at=(px,py)=>{const q=((py|0)*W+(px|0))*4;return [D[q],D[q+1],D[q+2]];};
    const seeds=cs.map(q=>at(q[0],q[1]));
    const road=(px,py)=>{px=px|0;py=py|0;
      if(px<0||py<0||px>=W||py>=Ht) return null;        /* off canvas: not a fault */
      const q=(py*W+px)*4,r=D[q],g=D[q+1],b2=D[q+2];
      if(r>236&&g>236&&b2>236) return true;              /* his lane markings */
      const ca=r-g, cb=g-b2, l=(r+g+b2)/3;
      for(const s of seeds)
        if(Math.abs(ca-(s[0]-s[1]))<=4&&Math.abs(cb-(s[1]-s[2]))<=4&&
           Math.abs(l-(s[0]+s[1]+s[2])/3)<=42) return true;
      return false;};
    const res=[];
    lanes.forEach(L=>{
      let on=0,off=0,worst=0,worstAt=null;
      L.pts.forEach(q=>{
        const v=road(q[0],q[1]); if(v===null) return;
        if(v){on++;return}
        off++;
        /* how far to the nearest tarmac, perpendicular either way */
        let d=0; for(let t=1;t<=90;t++){
          if(road(q[0]+t,q[1])||road(q[0]-t,q[1])||road(q[0],q[1]+t)||road(q[0],q[1]-t)){d=t;break;}
          d=t;}
        if(d>worst){worst=d;worstAt=q;}
      });
      res.push({ri:L.ri,on,off,worst,worstAt});
    });
    return res;
  },[b64,byK[k],CS[k]||[[1000,1000]],H[k]]);
  out.forEach(o=>{
    const tot=o.on+o.off;
    if(o.off>2) console.log(k,'lane run',o.ri,'off-road',o.off+'/'+tot,
      'worst',o.worst,'at',o.worstAt&&o.worstAt.join(','));
  });
}
await b.close();})();
