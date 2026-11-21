import test from 'node:test';
import assert from 'node:assert/strict';
import {gzipSync} from 'node:zlib';
import worker,{PersonalDesk} from './worker.mjs';
import {digestMedia,mediaReference} from '../desk-media.js';
class Store{
  values=new Map();queue=Promise.resolve();
  get(k){return Promise.resolve(Array.isArray(k)?new Map(k.map(x=>[x,this.values.get(x)])):this.values.get(k))}
  put(k,v){this.values.set(k,v);return Promise.resolve()}
  delete(k){this.values.delete(k);return Promise.resolve()}
  transaction(fn){const result=this.queue.then(()=>fn(this));this.queue=result.catch(()=>{});return result}
}
const ctx={access:{getIdentity:async()=>({email:'owner@example.com'})}};
const request=(method='GET',body,origin='https://frame.example')=>new Request('https://frame.example/api/desk',{method,headers:{Origin:origin,'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined});
const state={version:1,objects:[],trash:[],camera:{x:0,y:0,z:1}};

const makeEnv=bucket=>{
 const desk=new PersonalDesk({storage:new Store()},{DESK_MEDIA:bucket});
 return {LOGIN_KEY:'test-only-random-key-0123456789-ABCDEFGHIJKLMNOPQRSTUVWXYZ',DESK_MEDIA:bucket,DESK:{idFromName:()=>'',get:()=>desk}};
};
const login=(env,key=env.LOGIN_KEY,origin='https://frame.example')=>worker.fetch(new Request('https://frame.example/auth/login',{method:'POST',headers:{Origin:origin},body:JSON.stringify({key})}),env,{});

test('editor assets require login and allow only same-origin framing',async()=>{
 const env=makeEnv();let reads=0;env.EDITOR_ASSETS={fetch:async()=>{reads++;return new Response('editor')}};
 const url='https://frame.example/editor/index.html';
 const denied=await worker.fetch(new Request(url),env,{});assert.notEqual(denied.status,200);assert.equal(reads,0);
 const cookie=(await login(env)).headers.get('Set-Cookie');
 const allowed=await worker.fetch(new Request(url,{headers:{Cookie:cookie}}),env,{});
 assert.equal(await allowed.text(),'editor');assert.equal(allowed.headers.get('X-Frame-Options'),'SAMEORIGIN');assert.equal(allowed.headers.get('Cache-Control'),'private, no-store');
});
test('missing config fails closed and public login contains no app',async()=>{assert.equal((await worker.fetch(request(),{},{})).status,503);const r=await worker.fetch(new Request('https://frame.example/login'),{},{});assert.equal(r.status,200);assert.doesNotMatch(await r.text(),/cloud-sync.js/)});
test('authentication, forged cookie, csrf, logout and secret rotation',async()=>{
 const env=makeEnv();assert.equal((await worker.fetch(request(),env,{})).status,401);
 assert.equal((await login(env,'wrong')).status,401);assert.equal((await login(env,env.LOGIN_KEY,'https://evil.example')).status,403);
 const r=await login(env);assert.equal(r.status,200);const cookie=r.headers.get('Set-Cookie');assert.match(cookie,/HttpOnly; Secure; SameSite=Strict/);
 const authReq=(path,method='GET',origin='https://frame.example',c=cookie)=>new Request('https://frame.example'+path,{method,headers:{Cookie:c,Origin:origin,'Content-Type':'application/json'}});
 assert.equal((await worker.fetch(authReq('/'),env,{})).status,200);
 assert.equal((await worker.fetch(authReq('/api/desk','PUT','https://evil.example'),env,{})).status,403);
 assert.equal((await worker.fetch(authReq('/api/desk','GET',undefined,cookie.replace(/=./,'=0')),env,{})).status,401);
 for(const p of ['/qa/test-backup.json','/cloud/worker.mjs','/sw.js','/.git/config'])assert.equal((await worker.fetch(authReq(p),env,{})).status,404);
 assert.match((await worker.fetch(authReq('/auth/logout','POST'),env,{})).headers.get('Set-Cookie'),/Max-Age=0/);
 env.LOGIN_KEY+='rotated';assert.equal((await worker.fetch(authReq('/api/desk'),env,{})).status,401);
});
test('login attempt limit persists across requests',async()=>{const env=makeEnv();for(let i=0;i<30;i++)assert.equal((await login(env,'wrong')).status,401);assert.equal((await login(env)).status,429)});
test('initial state, save, read and stale revision rejection',async()=>{
  const desk=new PersonalDesk({storage:new Store()});assert.deepEqual(await (await desk.fetch(request())).json(),{revision:0,state:null});
  assert.equal((await desk.fetch(request('PUT',{revision:0,state}))).status,200);
  assert.deepEqual(await (await desk.fetch(request())).json(),{revision:1,state});
  assert.equal((await desk.fetch(request('PUT',{revision:0,state}))).status,409);
});
test('simultaneous updates cannot silently overwrite',async()=>{
  const desk=new PersonalDesk({storage:new Store()});const rs=await Promise.all([desk.fetch(request('PUT',{revision:0,state})),desk.fetch(request('PUT',{revision:0,state}))]);assert.deepEqual(rs.map(r=>r.status).sort(),[200,409]);
});
test('large multi-part snapshots round trip and shrink',async()=>{
  const desk=new PersonalDesk({storage:new Store()}),large={...state,text:'摄影😀'.repeat(500000)};
  assert.equal((await desk.fetch(request('PUT',{revision:0,state:large}))).status,200);assert.deepEqual((await(await desk.fetch(request())).json()).state,large);
  assert.equal((await desk.fetch(request('PUT',{revision:1,state}))).status,200);assert.deepEqual((await(await desk.fetch(request())).json()).state,state);
});
test('size limits and invalid state rejected',async()=>{
  const desk=new PersonalDesk({storage:new Store()});assert.equal((await desk.fetch(request('PUT',{revision:0,state:{}}))).status,400);assert.equal((await desk.fetch(request('PUT',{revision:0,state:{...state,text:'x'.repeat(9*1024*1024)}}))).status,413);
});

test('cloud media survives a legacy desk upgrade and requires a verified upload',async()=>{
 const objects=new Map();
 const bucket={
  async put(key,value){objects.set(key,value)},
  async get(key){return objects.has(key)?{body:objects.get(key)}:null},
 };
 const env=makeEnv(bucket);
 const cookie=(await login(env)).headers.get('Set-Cookie');
 const headers={Cookie:cookie,Origin:'https://frame.example'};
 const get=path=>worker.fetch(new Request('https://frame.example'+path,{headers}),env,{});
 const put=(path,value,type)=>worker.fetch(new Request('https://frame.example'+path,{method:'PUT',headers:{...headers,'Content-Type':type},body:value}),env,{});
 const save=(revision,state)=>put('/api/desk',JSON.stringify({revision,state}),'application/json');
 const image='data:image/png;base64,AAAA';
 const digest=await digestMedia(image);
 const path='/api/desk-media/'+digest;
 const legacy={...state,objects:[{id:'photo',src:image}]};
 assert.equal((await save(0,legacy)).status,200);
 assert.deepEqual((await (await get('/api/desk')).json()).state,legacy);
 const migrated={...state,objects:[{id:'photo',src:mediaReference(digest)}],trash:[{id:'deleted-photo',src:mediaReference(digest)}]};
 assert.equal((await save(1,migrated)).status,400);
 assert.equal((await put(path,'data:image/png;base64,BBBB','text/plain')).status,400);
 assert.equal((await put(path,image,'text/plain')).status,200);
 assert.equal((await save(1,migrated)).status,200);
 assert.deepEqual(await (await get('/api/desk')).json(),{revision:2,state:migrated,assetStorage:true});
 assert.equal(await (await get(path)).text(),image);
 assert.equal((await worker.fetch(new Request('https://frame.example'+path),env,{})).status,401);
 assert.equal(objects.size,1);
});

test('current and trashed ColorBoard projects round-trip as private workspace media',async()=>{
 const objects=new Map();
 const env=makeEnv({
  async put(key,value){objects.set(key,value)},
  async get(key){return objects.has(key)?{body:objects.get(key)}:null},
 });
 const cookie=(await login(env)).headers.get('Set-Cookie');
 const headers={Cookie:cookie,Origin:'https://frame.example'};
 const project='data:application/x-colorboard;base64,'+gzipSync(JSON.stringify({version:1,settings:{exposure:.25}})).toString('base64');
 const digest=await digestMedia(project),path='/api/desk-media/'+digest;
 const upload=await worker.fetch(new Request('https://frame.example'+path,{
  method:'PUT',headers:{...headers,'Content-Type':'text/plain'},body:project,
 }),env,{});
 assert.equal(upload.status,200);
 const ref=mediaReference(digest);
 const layout={...state,objects:[{id:'advanced',colorBoardEdit:ref}],trash:[{id:'trashed-advanced',colorBoardEdit:ref}]};
 const put=await worker.fetch(new Request('https://frame.example/api/desk',{
  method:'PUT',headers:{...headers,'Content-Type':'application/json'},body:JSON.stringify({revision:0,state:layout}),
 }),env,{});
 assert.equal(put.status,200);
 const read=path=>worker.fetch(new Request('https://frame.example'+path,{headers}),env,{});
 assert.deepEqual((await (await read('/api/desk')).json()).state,layout);
 assert.equal(await (await read(path)).text(),project);
 assert.equal((await worker.fetch(new Request('https://frame.example'+path),env,{})).status,401);
});
