#!/usr/bin/env node
/* Darken a piece of his art without redrawing it.
 *
 * A flat multiply on lightness just makes everything grey and MORE washed out,
 * which is the opposite of what he asked for - his note was that the rocks do
 * not look rocky. What reads as rock is CONTRAST between the lit face and the
 * shaded one, so this is a gamma on lightness rather than a scale: L^g pulls
 * the mid and low tones down hard and leaves the highlights nearly alone, so
 * the gap between them opens up. A small saturation lift stops the result
 * going muddy, which is what happens when you only take light away.
 *
 *   node tools/darken_art.js <file> [gamma] [darken] [saturate] [-o out]
 *
 * Works on an SVG by rewriting its fills, and on a raster by walking pixels -
 * his rock-cross is a WebP, so both are needed.
 */
const fs = require('fs');
const path = require('path');
const args = process.argv.slice(2).filter(a => a !== '-o');
const file = args[0];
const G = +(args[1] || 1.5), D = +(args[2] || 0.95), S = +(args[3] || 1.12);
const out = process.argv.includes('-o') ? process.argv[process.argv.indexOf('-o') + 1] : file;

function toHsl(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2;
  if (mx === mn) return [0, 0, l];
  const d = mx - mn, s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn);
  let h = mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [h / 6, s, l];
}
function toRgb(h, s, l) {
  if (!s) { const v = Math.round(l * 255); return [v, v, v]; }
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s, p = 2 * l - q;
  const f = t => { t = (t + 1) % 1;
    return t < 1/6 ? p + (q - p) * 6 * t : t < 1/2 ? q
         : t < 2/3 ? p + (q - p) * (2/3 - t) * 6 : p; };
  return [f(h + 1/3), f(h), f(h - 1/3)].map(v => Math.round(v * 255));
}
function shift(r, g, b) {
  let [h, s, l] = toHsl(r, g, b);
  l = Math.min(1, Math.pow(l, G) * D);
  s = Math.min(1, s * S);
  return toRgb(h, s, l);
}

if (/\.svg$/i.test(file)) {
  let n = 0;
  const src = fs.readFileSync(file, 'utf8');
  const done = src.replace(/#([0-9a-fA-F]{6})\b|#([0-9a-fA-F]{3})\b/g, (m, six, three) => {
    const hex = six || three.split('').map(c => c + c).join('');
    const [r, g, b] = [0, 2, 4].map(i => parseInt(hex.slice(i, i + 2), 16));
    n++;
    return '#' + shift(r, g, b).map(v => v.toString(16).padStart(2, '0')).join('');
  });
  fs.writeFileSync(out, done);
  console.error(path.basename(file) + ': ' + n + ' colours shifted  (gamma ' + G + ', darken ' + D + ', sat ' + S + ')');
} else {
  const { chromium } = require('/home/user/storyboard-app/node_modules/playwright');
  (async () => {
    const br = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
    const p = await br.newPage();
    await p.setContent('<body>');
    const b64 = fs.readFileSync(file).toString('base64');
    const mime = /\.webp$/i.test(file) ? 'image/webp' : 'image/png';
    const res = await p.evaluate(async ([d, m, G, D, S]) => {
      const img = await new Promise(r => { const i = new Image(); i.onload = () => r(i);
        i.src = 'data:' + m + ';base64,' + d; });
      const c = document.createElement('canvas');
      c.width = img.width; c.height = img.height;
      const x = c.getContext('2d');
      x.drawImage(img, 0, 0);
      const px = x.getImageData(0, 0, c.width, c.height);
      const a = px.data;
      const toHsl=(r,g,b)=>{r/=255;g/=255;b/=255;const mx=Math.max(r,g,b),mn=Math.min(r,g,b),l=(mx+mn)/2;
        if(mx===mn)return[0,0,l];const d=mx-mn,s=l>0.5?d/(2-mx-mn):d/(mx+mn);
        let h=mx===r?(g-b)/d+(g<b?6:0):mx===g?(b-r)/d+2:(r-g)/d+4;return[h/6,s,l];};
      const toRgb=(h,s,l)=>{if(!s){const v=Math.round(l*255);return[v,v,v];}
        const q=l<0.5?l*(1+s):l+s-l*s,p2=2*l-q;
        const f=t=>{t=(t+1)%1;return t<1/6?p2+(q-p2)*6*t:t<1/2?q:t<2/3?p2+(q-p2)*(2/3-t)*6:p2;};
        return[f(h+1/3),f(h),f(h-1/3)].map(v=>Math.round(v*255));};
      for (let i = 0; i < a.length; i += 4) {
        if (!a[i+3]) continue;
        let [h,s,l] = toHsl(a[i],a[i+1],a[i+2]);
        l = Math.min(1, Math.pow(l,G)*D); s = Math.min(1, s*S);
        const rgb = toRgb(h,s,l);
        a[i]=rgb[0]; a[i+1]=rgb[1]; a[i+2]=rgb[2];
      }
      x.putImageData(px, 0, 0);
      return { data: c.toDataURL('image/webp', 0.92).split(',')[1], w: c.width, h: c.height };
    }, [b64, mime, G, D, S]);
    fs.writeFileSync(out, Buffer.from(res.data, 'base64'));
    console.error(path.basename(file) + ': ' + res.w + 'x' + res.h + ' repainted  (gamma ' + G + ', darken ' + D + ', sat ' + S + ')');
    await br.close();
  })();
}
