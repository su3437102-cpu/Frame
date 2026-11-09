import {app} from './core/app.js';
import {openImageBlob} from './io/open.js';
import {savePKD,loadPKD} from './io/pkd.js';
import {getComposite} from './render/compositor.js';
import {decodeImage} from './io/decode.js';

document.documentElement.dataset.framelabTheme = 'light';
// Private, same-origin FrameLab protocol. The standalone editor is unaffected.
if(parent!==window){
 let session=null,loading=false,timer,serial=Promise.resolve(),sourceLayerId=null;
 const send=(type,data={})=>parent.postMessage({channel:'framelab-pikado',type,session,...data},location.origin);
 const dataURL=blob=>new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(r.result);r.onerror=reject;r.readAsDataURL(blob)});
 async function snapshot(){
  const doc=app.activeDoc;if(loading||!session||!doc)return;
  const preview=getComposite(doc).toDataURL('image/png');
  const pkd=await dataURL(await savePKD(doc));
  send('result',{preview,pkd,sourceLayerId,width:doc.width,height:doc.height});
 }
 function queue(){clearTimeout(timer);timer=setTimeout(()=>{serial=serial.then(snapshot).catch(e=>send('error',{message:e.message}))},450)}
 for(const event of ['doc-change','doc-structure','history-change','doc-resize','active-doc'])app.on(event,queue);
 window.addEventListener('message',e=>{
  const m=e.data;if(e.origin!==location.origin||e.source!==parent||m?.channel!=='framelab-pikado')return;
  if(m.type==='theme'){document.documentElement.dataset.framelabTheme=m.theme==='dark'?'dark':'light';return}
  if(m.type==='flush'){clearTimeout(timer);serial=serial.then(snapshot).then(()=>send('flushed')).catch(err=>send('error',{message:err.message}));return}
  if(m.type!=='open'||typeof m.session!=='string')return;
  serial=serial.then(async()=>{
   loading=true;session=m.session;
   document.documentElement.dataset.framelabTheme=m.theme==='dark'?'dark':'light';
   try{
    for(const doc of [...app.docs])app.closeDocument(doc);
    let doc;sourceLayerId=m.sourceLayerId||null;
    if(m.pkd){doc=await loadPKD(await (await fetch(m.pkd)).arrayBuffer());app.addDocument(doc)}
    else if(m.src){doc=await openImageBlob(await (await fetch(m.src)).blob(),m.name||'FrameLab')}
    if(doc){
     sourceLayerId??=doc.flatLayers()[0]?.id;
     if(m.pkd&&m.replaceSource&&m.src){
      const layer=doc.flatLayers().find(l=>l.id===sourceLayerId);
      if(!layer)throw Error('原始输入图层已删除；保留现有编辑，请手动导入新来源。');
      const image=await decodeImage(await (await fetch(m.src)).blob());
      const canvas=document.createElement('canvas');canvas.width=doc.width;canvas.height=doc.height;
      const scale=Math.min(doc.width/image.width,doc.height/image.height);
      canvas.getContext('2d').drawImage(image,(doc.width-image.width*scale)/2,(doc.height-image.height*scale)/2,image.width*scale,image.height*scale);
      layer.canvas=canvas;layer.thumbDirty=true;doc.invalidate();doc.emit('change',{reason:'FrameLab source'});
     }
     app.fitView();app.requestRender();
    }
    loading=false;send('opened');if(doc)queue();
   }catch(err){loading=false;send('error',{message:err.message})}
  });
 });
 if(app.ready)send('ready');else app.on('ready',()=>send('ready'));
}
