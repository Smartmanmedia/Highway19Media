/* Follow his road centreline on his own artboard SVG, with the layers he
   drew OVER the road (clouds, signs) hidden so the tarmac is unbroken. */
const {chromium}=require('playwright');const fs=require('fs');
(async()=>{const b=await chromium.launch({executablePath:process.env.CHROME_PATH});
const p=await b.newPage({viewport:{width:1200,height:800}});
p.on('console',m=>{if(m.type()==='error')console.log('  js:',m.text())});
const jobs=JSON.parse(process.argv[2]);
const out=fs.existsSync('follow.json')?JSON.parse(fs.readFileSync('follow.json')):{};
let curK=null;
for(const J of jobs){
 if(curK!==J.k){
   curK=J.k;
   await p.goto('http://localhost:8777/assets/scene/_trace.html?k='+J.k);
   await p.waitForFunction('window.__ready===true',{timeout:120000});
   const dim=await p.evaluate(()=>[window.__W,window.__H]);
   await p.setViewportSize({width:Math.min(dim[0],2200),height:900});
   const shot=(await p.screenshot({clip:{x:0,y:0,width:dim[0],height:dim[1]},
     fullPage:true})).toString('base64');
   await p.evaluate(async b64=>{
     const im=new Image(); im.src='data:image/png;base64,'+b64; await im.decode();
     const c=document.createElement('canvas'); c.width=window.__W; c.height=window.__H;
     const x=c.getContext('2d',{willReadFrequently:true});
     x.drawImage(im,0,0,window.__W,window.__H);
     window.__D=x.getImageData(0,0,window.__W,window.__H).data;
   },shot);
 }
 const r=await p.evaluate((J)=>{
  const D=window.__D, W=window.__W, H=window.__H;
  /* his tarmac is one flat fill per section; match that exact colour and
     nothing else, so railings, pylons, kerbs and verges end the cross-section
     where his road actually ends */
  const at=(px,py)=>{const q=((py|0)*W+(px|0))*4;return [D[q],D[q+1],D[q+2],D[q+3]];};
  /* his tarmac keeps its colour cast along a section even where he shades it
     from day into night, so a pixel is road when it carries the same cast as
     the sample and sits inside that shading range - and nothing else does */
  const seed = (J.cs||[[J.x,J.y]]).map(q=>at(q[0],q[1]));
  const dch = J.dch==null?3:J.dch, dl = J.dl==null?42:J.dl;
  const road=(px,py)=>{px=px|0;py=py|0;
    if(px<0||py<0||px>=W||py>=H)return false;
    const q=(py*W+px)*4;
    if(D[q+3]<40) return false;
    const r=D[q],g=D[q+1],b=D[q+2];
    const ca=r-g, cb=g-b, l=(r+g+b)/3;
    for(const s of seed){
      if(Math.abs(ca-(s[0]-s[1]))<=dch && Math.abs(cb-(s[1]-s[2]))<=dch &&
         Math.abs(l-(s[0]+s[1]+s[2])/3)<=dl) return true; }
    return false;};
  window.__seed=seed;
  const reach=(x,y,nx,ny,max)=>{let last=0,miss=0;
    for(let t=0.5;t<=max;t+=0.5){
      if(road(x+nx*t,y+ny*t)){last=t;miss=0;}
      else{miss+=0.5; if(miss>J.skip)break;}}
    return last;};
  let pts=[]; let x=J.x,y=J.y,dx=J.dx,dy=J.dy;
  const step=J.step||6,max=J.max||120,lim=J.n||4000;
  let width=null,note='ran out',blind=0;
  for(let i=0;i<lim;i++){
    const m=Math.hypot(dx,dy)||1; dx/=m; dy/=m;
    const nx=-dy,ny=dx;
    const a=reach(x,y,nx,ny,max), b2=reach(x,y,-nx,-ny,max);
    const w=a+b2;
    if(w<J.minw){
      /* he draws things across his road - a truss, a bridge deck, a rock line.
         Coast straight under them and pick the tarmac up on the far side. */
      blind+=step;
      if(blind>(J.blind||0)){note='left the tarmac at '+x.toFixed(0)+','+y.toFixed(0);break;}
      pts.push([+x.toFixed(1),+y.toFixed(1),1]); x+=dx*step; y+=dy*step;
      if(x<J.x0||x>J.x1||y<J.y0||y>J.y1){note='off canvas';break;}
      continue;
    }
    blind=0;
    if(w<=J.maxw){const sh=(a-b2)/2*(J.pull==null?0.45:J.pull); x+=nx*sh; y+=ny*sh; width=w;}
    pts.push([+x.toFixed(1),+y.toFixed(1),0]);
    x+=dx*step; y+=dy*step;
    if(pts.length>3){
      const q=pts[pts.length-1],q0=pts[pts.length-4];
      let tx=q[0]-q0[0],ty=q[1]-q0[1];const tm=Math.hypot(tx,ty);
      if(tm>1){tx/=tm;ty/=tm;dx=dx*(1-J.turn)+tx*J.turn;dy=dy*(1-J.turn)+ty*J.turn;}
    }
    if(x<J.x0||x>J.x1||y<J.y0||y>J.y1){note='off canvas';break;}
  }
  /* where he drew something right across his road the scan coasted blind;
     a straight run between the last and next sighting beats the swerve
     that re-acquiring the tarmac would otherwise put in */
  for(let i=0;i<pts.length;i++){
    if(!pts[i][2]) continue;
    let j=i; while(j<pts.length&&pts[j][2]) j++;
    const A=Math.max(0,i-1), B=Math.min(pts.length-1,j+5);
    for(let t=A+1;t<B;t++){
      const f=(t-A)/(B-A);
      pts[t]=[+(pts[A][0]+(pts[B][0]-pts[A][0])*f).toFixed(2),
              +(pts[A][1]+(pts[B][1]-pts[A][1])*f).toFixed(2),1];
    }
    i=B;
  }
  const ma=(a,w)=>a.map((q,i)=>{let sx=0,sy=0,n=0;
    for(let j=i-w;j<=i+w;j++){const t=a[Math.min(a.length-1,Math.max(0,j))];sx+=t[0];sy+=t[1];n++;}
    return [+(sx/n).toFixed(2),+(sy/n).toFixed(2),q[2]];});
  pts=ma(ma(pts,3),3);
  /* the walk lags on his tighter bends, so every point is then snapped onto
     the middle of the tarmac it actually sits on, a few times over */
  const mx=J.max||120;
  for(let it=0;it<5;it++){
    for(let i=1;i<pts.length-1;i++){
      if(pts[i][2]&&it<4) continue;
      const a2=pts[i-1],b3=pts[i+1];
      let ux=b3[0]-a2[0],uy=b3[1]-a2[1];const um=Math.hypot(ux,uy)||1;ux/=um;uy/=um;
      const nx2=-uy,ny2=ux;
      const r1=reach(pts[i][0],pts[i][1],nx2,ny2,mx);
      const r2=reach(pts[i][0],pts[i][1],-nx2,-ny2,mx);
      const w2=r1+r2; if(w2<J.minw||w2>J.maxw) continue;
      const sh2=(r1-r2)/2;
      pts[i]=[+(pts[i][0]+nx2*sh2).toFixed(2),+(pts[i][1]+ny2*sh2).toFixed(2),0];
    }
  }
  /* HIS STRAIGHTS ARE STRAIGHT. The scan wobbles a unit or two either way on
     dashes, pylons and shadows, and a lane that wobbles makes a car wiggle
     down it. Where the heading holds steady over a long window the points are
     put back on the line they belong to; a bend is left exactly as measured. */
  {
    const W=12, out2=pts.map(q=>q.slice());
    /* read the heading over a long enough baseline that a unit of scan noise
       does not read as a bend */
    const head=i=>{const a2=pts[Math.max(0,i-10)], b3=pts[Math.min(pts.length-1,i+10)];
      return Math.atan2(b3[1]-a2[1], b3[0]-a2[0]);};
    for(let i=0;i<pts.length;i++){
      const lo=Math.max(0,i-W), hi=Math.min(pts.length-1,i+W);
      if(hi-lo<W) continue;
      /* the NET turn across the window. Scan noise cancels over it; a bend
         does not - his tightest is 170 units of radius, which turns fifty
         degrees over this window against eight for the worst straight. */
      let turn=head(hi)-head(lo);
      while(turn>Math.PI)turn-=2*Math.PI; while(turn<-Math.PI)turn+=2*Math.PI;
      if(Math.abs(turn)>0.14) continue;
      let sx=0,sy=0,sxx=0,sxy=0,n=0;
      for(let j=lo;j<=hi;j++){sx+=pts[j][0];sy+=pts[j][1];n++;}
      const mx=sx/n,my=sy/n;
      for(let j=lo;j<=hi;j++){const dx=pts[j][0]-mx,dy=pts[j][1]-my;sxx+=dx*dx;sxy+=dx*dy;}
      /* project onto the best line through the window's own middle */
      const ux=Math.cos(head(i)), uy=Math.sin(head(i));
      const t=(pts[i][0]-mx)*ux+(pts[i][1]-my)*uy;
      out2[i]=[+(mx+ux*t).toFixed(2), +(my+uy*t).toFixed(2), pts[i][2]];
    }
    pts=out2;
  }
  pts=ma(ma(pts,2),2);
  return {pts,width,note,seed};
 },J);
 /* his road is straights and arcs; the scan wobbles on dashes, pylons and
    shadows, so the line is low-passed before it becomes a route */
 let pts=r.pts.slice(3,-5).map(p=>[p[0],p[1]]);
 /* run it out past his artboard so nothing starts or stops on the seam */
 const ext=(a,rev)=>{const p0=rev?a[a.length-1]:a[0], p1=rev?a[a.length-4]:a[3];
   let dx=p0[0]-p1[0],dy=p0[1]-p1[1];const m=Math.hypot(dx,dy)||1;dx/=m;dy/=m;
   return [+(p0[0]+dx*(J.ext||300)).toFixed(2),+(p0[1]+dy*(J.ext||300)).toFixed(2)];};
 if(J.ext!==0) pts=[ext(pts,false),...pts,ext(pts,true)];
 out[J.id]={k:J.k,pts,width:r.width,note:r.note};
 console.log(J.id,r.pts.length+'pts w='+(r.width||0).toFixed(1),r.note,
   'seed '+r.seed.map(q=>q.slice(0,3).join(',')).join(' / '),'| start',out[J.id].pts[0],'end',out[J.id].pts[out[J.id].pts.length-1]);
}
fs.writeFileSync('follow.json',JSON.stringify(out));
await b.close();})();
