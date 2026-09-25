const fs=require('fs');
const F=JSON.parse(fs.readFileSync('follow.json'));
const H={ '01':982.8,'02':1645.2,'03':1865.2,'04':1951.6,'05':1951.6,'06':1951.6,'07':2378.8,'08':2378.8 };
const PITCH={ '01a':40.5,'02a':40,'03a':40.5,'03b':40,'04a':40,'04b':42,'05b':40 };
const CHAINS=[['01:a','02:a'],['03:a','04:b'],['03:b','04:a']];
const up=new Set(CHAINS.map(c=>c[0].replace(':',''))), dn=new Set(CHAINS.map(c=>c[1].replace(':','')));

/* THE RUN-IN FOLLOWS HIS STRAIGHT, NOT THE LOCAL TANGENT. Read off the two
   points either side of an end that is already bending, the run-in leaves his
   road on a diagonal across the sand - which is exactly what it was doing at
   the mouth of his desert turn. Twenty points of lane is a straight. */
const tang=(p,q)=>{let dx=p[0]-q[0],dy=p[1]-q[1];const m=Math.hypot(dx,dy)||1;return [dx/m,dy/m];};
const cutAt=(pts,yv,keepBelow)=>{           /* keepBelow: keep y<=yv */
  const out=[];
  for(let i=0;i<pts.length;i++){
    const p=pts[i], ok = keepBelow ? p[1]<=yv : p[1]>=yv;
    if(ok) out.push(p);
    else if(out.length){                     /* crossed: land exactly on the seam */
      const q=pts[i-1]; if(!q) break;
      const f=(yv-q[1])/(p[1]-q[1]);
      out.push([+(q[0]+(p[0]-q[0])*f).toFixed(2), yv]);
      break;
    }
  }
  if(!keepBelow && out.length && out[0][1]>yv){
    const i=pts.indexOf(out[0]);
    if(i>0){ const q=pts[i-1],p=out[0];
      const f=(yv-q[1])/(p[1]-q[1]);
      out.unshift([+(q[0]+(p[0]-q[0])*f).toFixed(2), yv]); }
  }
  return out;
};
const routes={};
Object.entries(F).forEach(([id,v])=>{
  const k=v.k, key=id;
  let pts=v.pts.map(p=>[p[0],p[1]]);
  const isUp=up.has(key), isDn=dn.has(key);
  if(isUp) pts=cutAt(pts,H[k],true);
  if(isDn) pts=cutAt(pts,0,false);
  /* off-canvas run-in and run-out where his road simply leaves the picture */
  if(!isDn){ const t=tang(pts[0],pts[Math.min(20,pts.length-1)]);
    pts.unshift([+(pts[0][0]+t[0]*520).toFixed(2), +(pts[0][1]+t[1]*520).toFixed(2)]); }
  if(!isUp){ const n=pts.length-1, t=tang(pts[n],pts[Math.max(0,n-20)]);
    pts.push([+(pts[n][0]+t[0]*520).toFixed(2), +(pts[n][1]+t[1]*520).toFixed(2)]); }
  routes[key]={k,pts,pitch:PITCH[key]||40};
});
/* a chained pair must leave and arrive at the same place, or his cars jog at
   the seam; the last and first stretch are eased onto the shared x */
CHAINS.forEach(([a,b])=>{
  const A=routes[a.replace(':','')], B=routes[b.replace(':','')];
  if(!A||!B) return;
  const ax=A.pts[A.pts.length-1][0], bx=B.pts[0][0], mid=+( (ax+bx)/2 ).toFixed(2);
  const ease=(pts,from,rev)=>{
    const n=pts.length, span=Math.min(30,n-1);
    for(let i=0;i<=span;i++){
      const idx=rev? n-1-i : i;
      const f=1-i/span;                    /* full shift at the seam, none inland */
      pts[idx][0]=+(pts[idx][0]+(mid-from)*f).toFixed(2);
    }
  };
  ease(A.pts,ax,true); ease(B.pts,bx,false);
});
/* his straight roads, measured off his own lane lines rather than walked */
const STRAIGHT={
  '05a':{k:'05',d:[[-680,522.5],[2810,522.5]],pitch:45.5,lanes:2},
  '06a':{k:'06',d:[[123.4,-560],[123.4,2520]],pitch:104.5,lanes:2},
  '07a':{k:'07',d:[[-680,1981],[2810,1981]],pitch:25,lanes:6}
};
const out={};
const add=(k,id,pts,pitch,lanes)=>{
  (out[k]=out[k]||[]).push({id,d:'M'+pts.map(p=>p[0]+','+p[1]).join(' L'),
    lanes:lanes||2, pitch});
};
Object.entries(routes).forEach(([key,v])=>add(v.k,key.slice(2),v.pts,v.pitch,2));
Object.entries(STRAIGHT).forEach(([key,v])=>add(v.k,key.slice(2),v.d,v.pitch,v.lanes));
Object.keys(out).forEach(k=>out[k].sort((a,b)=>a.id<b.id?-1:1));
out._chains=CHAINS;
fs.writeFileSync('routes.new.json',JSON.stringify(out,null,1));
Object.entries(out).forEach(([k,v])=>{ if(k==='_chains')return;
  v.forEach(r=>console.log(k+':'+r.id, r.lanes+' lanes', 'pitch '+r.pitch,
    r.d.split(' L').length+' pts'));});
