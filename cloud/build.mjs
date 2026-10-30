import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
const files=['index.html','app.js','style.css','interactions.js','cloud-sync.js',...Array.from({length:8},(_,i)=>`assets/photo-${i}.jpg`)];
const assets={};
for(const file of files){
  let bytes=readFileSync(new URL('../'+file,import.meta.url));
  if(file==='index.html') bytes=Buffer.from(bytes.toString().replace('</body>','<script src="cloud-sync.js"></script></body>'));
  if(file==='app.js') bytes=Buffer.from(bytes.toString().replace("KEY='framelab:r11:v1:desk'","KEY='framelab:r11:cloud:v1:desk'").replace("if('serviceWorker' in navigator&&location.protocol!=='file:')navigator.serviceWorker.register('./sw.js').catch(()=>{});",''));
  if(file==='app.js')bytes=Buffer.from(bytes.toString().replaceAll('localStorage.setItem(KEY,snapshot())','if(!window.cloudLoggingOut)localStorage.setItem(KEY,snapshot())'));
  assets['/'+file]={body:bytes.toString('base64'),type:file.endsWith('.jpg')?'image/jpeg':file.endsWith('.html')?'text/html; charset=utf-8':file.endsWith('.css')?'text/css; charset=utf-8':'text/javascript; charset=utf-8'};
}
mkdirSync(new URL('../dist/',import.meta.url),{recursive:true});
writeFileSync(new URL('../dist/assets.mjs',import.meta.url),'export default '+JSON.stringify(assets)+';');
console.log('Cloud build: '+files.length+' approved runtime files; no test data, credentials or R10 files.');
