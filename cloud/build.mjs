import '../build-ai.mjs';
import {createHash} from 'node:crypto';
import {readFileSync,writeFileSync,mkdirSync,cpSync,readdirSync,statSync} from 'node:fs';
const files=['index.html','app.js','ai-color.js','ai-browser.js','style.css','grade-workbench.css','context-ui.js','task-board.js','image-layout.js','context-ui.css','interactions.js','cloud-sync.js','desk-media.js','device-store.js','ps-system.js','pikado-host.js','assets/fonts/latin.css','assets/fonts/geist-latin.woff2','assets/fonts/hedvig-letters-serif-latin.woff2','assets/fonts/Geist-OFL.txt','assets/fonts/Hedvig-Letters-Serif-OFL.txt',...Array.from({length:8},(_,i)=>`assets/photo-${i}.jpg`)];
const assets={};
for(const file of files){
  let bytes=readFileSync(new URL('../'+file,import.meta.url));
  if(file==='index.html') bytes=Buffer.from(bytes.toString().replace('<body ', '<body data-cloud ').replace('</body>','<script type="module" src="cloud-sync.js"></script></body>'));
  if(file==='app.js') bytes=Buffer.from(bytes.toString().replace("KEY='framelab:r11:v1:desk'","KEY='framelab:r11:cloud:v1:desk'").replace("if('serviceWorker' in navigator&&location.protocol!=='file:')navigator.serviceWorker.register('./sw.js').catch(()=>{});",''));
  assets['/'+file]={body:bytes.toString('base64'),type:file.endsWith('.woff2')?'font/woff2':file.endsWith('.png')?'image/png':file.endsWith('.svg')?'image/svg+xml':file.endsWith('.txt')?'text/plain; charset=utf-8':file.endsWith('.json')||file.endsWith('.webmanifest')?'application/json':file.endsWith('.jpg')?'image/jpeg':file.endsWith('.html')?'text/html; charset=utf-8':file.endsWith('.css')?'text/css; charset=utf-8':'text/javascript; charset=utf-8'};
}
const serialized=JSON.stringify(assets);
const fingerprint=createHash('sha256').update(serialized);
for(const file of ['grade-workbench.mjs','grade-worker.mjs','grade-recipes.mjs','grade-mask.mjs','magic-touch.tflite']){
  fingerprint.update(readFileSync(new URL('../ai-web/'+file,import.meta.url)));
}
const colorBoard=new URL('../ai-web/colorboard/',import.meta.url);
for(const name of readdirSync(colorBoard,{recursive:true}).map(path=>path.replaceAll('\\','/')).sort()){
  const file=new URL(name,colorBoard);
  if(statSync(file).isFile())fingerprint.update(name).update('\0').update(readFileSync(file));
}
const buildId=fingerprint.digest('hex').slice(0,16);
mkdirSync(new URL('../dist/',import.meta.url),{recursive:true});
writeFileSync(new URL('../dist/assets.mjs',import.meta.url),`export const buildId=${JSON.stringify(buildId)};\nexport default ${serialized};`);
console.log('Cloud build: '+files.length+' approved runtime files; no test data, credentials or R10 files.');

mkdirSync(new URL('../.cloud-assets/editor/',import.meta.url),{recursive:true});
cpSync(new URL('../editor/',import.meta.url),new URL('../.cloud-assets/editor/',import.meta.url),{recursive:true});

cpSync(new URL('../ai-web/',import.meta.url),new URL('../.cloud-assets/ai-web/',import.meta.url),{recursive:true});
