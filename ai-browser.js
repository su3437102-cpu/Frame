// Model execution stays on the user's device. All runtime assets are same-origin.
let aiBrowserWorker=null;
async function enhanceInBrowser(src,strength,signal,onStatus){
 const response=await fetch(src,{signal});if(!response.ok)throw new Error('无法读取输入照片');
 const bitmap=await createImageBitmap(await response.blob());
 const scale=Math.min(1,1600/Math.max(bitmap.width,bitmap.height)),width=Math.max(1,Math.round(bitmap.width*scale)),height=Math.max(1,Math.round(bitmap.height*scale));
 const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;const context=canvas.getContext('2d',{willReadFrequently:true});context.fillStyle='#fff';context.fillRect(0,0,width,height);context.drawImage(bitmap,0,0,width,height);bitmap.close();
 if(signal.aborted)throw new DOMException('已停止','AbortError');
 const pixels=context.getImageData(0,0,width,height).data;
 const result=await new Promise((resolve,reject)=>{
  const worker=aiBrowserWorker??=new Worker('/ai-web/browser-worker.mjs',{type:'module'});
  const clear=()=>{signal.removeEventListener('abort',stop);clearTimeout(timer);worker.onmessage=null;worker.onerror=null};
  const fail=error=>{clear();worker.terminate();if(aiBrowserWorker===worker)aiBrowserWorker=null;reject(error)};
  const stop=()=>fail(new DOMException('已停止','AbortError'));
  const timer=setTimeout(()=>fail(new Error('模型加载或调色超时，请检查网络后重试')),120000);
  signal.addEventListener('abort',stop,{once:true});
  worker.onmessage=({data})=>{if(data.status){onStatus(data.status);return}if(data.error){fail(new Error(data.error));return}clear();resolve(data)};
  worker.onerror=()=>fail(new Error('无法加载调色模型，请刷新网页后重试'));
  worker.postMessage({pixels,width,height,strength},[pixels.buffer]);
 });
 context.putImageData(new ImageData(result.pixels,width,height),0,0);
 return {src:canvas.toDataURL('image/jpeg',.94),width,height};
}
