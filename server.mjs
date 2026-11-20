import {handleAI} from './ai-service.mjs';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.dirname(fileURLToPath(import.meta.url)),host=process.argv.includes('--lan')?'0.0.0.0':'127.0.0.1',port=Number(process.env.R11_PORT||4311);
const mime={'.mjs':'text/javascript; charset=utf-8','.wasm':'application/wasm','.woff2':'font/woff2','.onnx':'application/octet-stream','.svg':'image/svg+xml','.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.jpg':'image/jpeg','.png':'image/png','.json':'application/json; charset=utf-8'};
http.createServer((req,res)=>{if(req.url==='/api/ai-color'){handleAI(req,res);return}try{let pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);let file=path.resolve(root,'.'+(pathname==='/'?'/index.html':pathname));if(!file.startsWith(root+path.sep)||!fs.existsSync(file)||!fs.statSync(file).isFile()){res.writeHead(404);res.end('Not found');return}res.writeHead(200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream','Cache-Control':'no-cache','X-Content-Type-Options':'nosniff'});fs.createReadStream(file).pipe(res)}catch{res.writeHead(400);res.end('Bad request')}}).listen(port,host,()=>console.log(`FrameLab R11: http://${host==='0.0.0.0'?'YOUR-PC-LAN-IP':host}:${port}`));
