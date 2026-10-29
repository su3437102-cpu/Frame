import test from 'node:test';
import assert from 'node:assert/strict';
import worker,{PersonalDesk} from './worker.mjs';
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
test('anonymous and spoofed headers cannot load the application',async()=>{
  const r=await worker.fetch(new Request('https://frame.example/',{headers:{'Cf-Access-Authenticated-User-Email':'owner@example.com'}}),{OWNER_EMAIL:'owner@example.com'},{});assert.equal(r.status,403);
});
test('unapproved identity and wrong runtime owner fail closed',async()=>{assert.equal((await worker.fetch(request(),{},ctx)).status,403);assert.equal((await worker.fetch(request(),{OWNER_EMAIL:'other@example.com'},ctx)).status,403)});
test('cross origin writes rejected before storage',async()=>{assert.equal((await worker.fetch(request('PUT',{},'https://evil.example'),{OWNER_EMAIL:'owner@example.com'},ctx)).status,403)});
test('runtime assets only; no service worker or source test exposure',async()=>{
  for(const p of ['qa/test-backup.json','cloud/worker.mjs','sw.js','.git/config'])assert.equal((await worker.fetch(new Request('https://frame.example/'+p),{OWNER_EMAIL:'owner@example.com'},ctx)).status,404);
  const r=await worker.fetch(new Request('https://frame.example/'),{OWNER_EMAIL:'owner@example.com'},ctx);assert.equal(r.status,200);assert.match(await r.text(),/cloud-sync.js/);
});
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
