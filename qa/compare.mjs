// Raw image comparison only. This does not award the document's fidelity score.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import pixelmatch from 'pixelmatch';
import {PNG} from 'pngjs';
const [ref,actual,out='comparison-output']=process.argv.slice(2);
if(!ref||!actual)throw new Error('Usage: node compare.mjs reference.png actual.png output-directory');
const rb=fs.readFileSync(ref),ab=fs.readFileSync(actual);
const a=PNG.sync.read(rb),b=PNG.sync.read(ab);
if(a.width!==b.width||a.height!==b.height)throw new Error('Viewport sizes differ. Refusing to resize or align the images.');
const {width:w,height:h}=a,diff=new PNG({width:w,height:h}),overlay=new PNG({width:w,height:h}),side=new PNG({width:w*2,height:h});
const mismatch=pixelmatch(a.data,b.data,diff.data,w,h,{threshold:0.10,includeAA:false});
for(let y=0;y<h;y++)for(let x=0;x<w;x++){
 const i=(y*w+x)*4;
 for(let c=0;c<4;c++){
  overlay.data[i+c]=c===3?255:Math.round((a.data[i+c]+b.data[i+c])/2);
  side.data[(y*w*2+x)*4+c]=a.data[i+c];side.data[(y*w*2+x+w)*4+c]=b.data[i+c];
 }
}
fs.mkdirSync(out,{recursive:true});
for(const [n,p]of [['diff',diff],['overlay',overlay],['side-by-side',side]])fs.writeFileSync(path.join(out,n+'.png'),PNG.sync.write(p));
const sha=x=>crypto.createHash('sha256').update(x).digest('hex');
const result={reference:ref,actual,width:w,height:h,referenceSHA256:sha(rb),actualSHA256:sha(ab),threshold:0.10,includeAA:false,diffPixels:mismatch,effectivePixels:w*h,p:mismatch/(w*h),status:'raw comparison only; use frozen per-region crops, probes and action evidence for scoring'};
fs.writeFileSync(path.join(out,'comparison.json'),JSON.stringify(result,null,2));console.log(result);
