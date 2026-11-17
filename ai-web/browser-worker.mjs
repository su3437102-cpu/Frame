import * as ort from './ort.wasm.min.mjs';
import {modelInput,applyLUT} from './color-math.mjs';
ort.env.wasm.numThreads=1;
ort.env.wasm.wasmPaths=new URL('./',import.meta.url).href;
let session;
self.onmessage=async({data})=>{
 try{
  if(!session){self.postMessage({status:'正在加载模型'});session=await ort.InferenceSession.create(new URL('./adaint.onnx',import.meta.url).href,{executionProviders:['wasm']})}
  self.postMessage({status:'正在调色'});
  const input=modelInput(data.pixels,data.width,data.height),result=await session.run({image:new ort.Tensor('float32',input,[1,3,256,256])});
  const pixels=applyLUT(data.pixels,result.lut.data,result.vertices.data,data.strength);
  self.postMessage({pixels,width:data.width,height:data.height},[pixels.buffer]);
 }catch(error){self.postMessage({error:error.message||'浏览器调色失败，请重试'})}
};
