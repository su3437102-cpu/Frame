import {spawn} from 'node:child_process';
import {createInterface} from 'node:readline';
import {homedir} from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
let worker, pending;
function start(){
 const python=process.env.R11_AI_PYTHON||path.join(homedir(),'.codex','envs','r11-ai','Scripts','python.exe');
 worker=spawn(python,[fileURLToPath(new URL('./ai-worker.py',import.meta.url))],{windowsHide:true,stdio:['pipe','pipe','pipe']});
 worker.stderr.on('data',()=>{});
 createInterface({input:worker.stdout}).on('line',line=>{if(!pending)return;try{const data=JSON.parse(line);pending.resolve(data)}catch{pending.reject(new Error('Invalid model response'))}pending=null});
 const fail=()=>{pending?.reject(new Error('本机模型未就绪，请检查 Python 环境和模型权重'));pending=null;worker=null};
 worker.on('error',fail);worker.on('exit',fail);
}
export async function handleAI(req,res){
 const reply=(status,data)=>{res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify(data))};
 if(req.method!=='POST')return reply(405,{error:'请使用 POST'});
 if(req.headers.origin&&req.headers.origin!==`http://${req.headers.host}`&&req.headers.origin!==`https://${req.headers.host}`)return reply(403,{error:'跨站请求已拒绝'});
 if(pending)return reply(429,{error:'调色服务忙，请稍后重试'});
 let size=0,chunks=[];
 try{
  for await(const chunk of req){size+=chunk.length;if(size>16000000)return reply(413,{error:'照片过大，请缩小后重试'});chunks.push(chunk)}
  const input=JSON.parse(Buffer.concat(chunks));
  if(typeof input.image!=='string'||!Number.isFinite(input.strength)||input.strength<0||input.strength>1)return reply(400,{error:'无效的图片或调色强度'});
  if(pending)return reply(429,{error:'调色服务忙，请稍后重试'});
  if(!worker)start();
  const result=await new Promise((resolve,reject)=>{const timer=setTimeout(()=>{worker?.kill();reject(new Error('调色超时，请重试'))},60000);pending={resolve:v=>{clearTimeout(timer);resolve(v)},reject:e=>{clearTimeout(timer);reject(e)}};worker.stdin.write(JSON.stringify(input)+'\n',e=>{if(e){pending?.reject(e);pending=null}})});
  reply(result.error?422:200,result);
 }catch(e){reply(503,{error:e.message})}
}
