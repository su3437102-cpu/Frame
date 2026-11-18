import assets from '../dist/assets.mjs';
import {authenticate,loginPage} from './auth.mjs';
import {deskMediaSlots,digestMedia,mediaDigest,mediaTypes,referenceDigest} from '../desk-media.js';
const json=(value,status=200)=>Response.json(value,{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});

async function readBody(request, limit) {
  const reader = request.body?.getReader();
  if (!reader) return null;
  const parts = [];
  let size = 0;
  for (;;) {
    const {done, value} = await reader.read();
    if (done) return new Blob(parts);
    size += value.length;
    if (size > limit) { await reader.cancel(); return null; }
    parts.push(value);
  }
}

async function deskMedia(request, url, env) {
  const bucket = env.DESK_MEDIA;
  if (!bucket) return json({error:'云端媒体存储尚未配置'}, 503);
  const digest = url.pathname.slice('/api/desk-media/'.length);
  if (!mediaDigest.test(digest)) return json({error:'Invalid media reference'}, 400);
  const key = 'desk/' + digest;
  if (request.method === 'GET') {
    const media = await bucket.get(key);
    if (!media) return json({error:'找不到云端素材'}, 404);
    return new Response(media.body, {headers:{'Content-Type':'text/plain; charset=utf-8','Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}});
  }
  if (request.method !== 'PUT') return json({error:'Method not allowed'}, 405);
  if (request.headers.get('Origin') !== url.origin || !request.headers.get('Content-Type')?.startsWith('text/plain')) {
    return json({error:'Invalid origin or content type'}, 403);
  }
  const body = await readBody(request, 32 * 1024 * 1024);
  if (!body) return json({error:'单份素材超过 32 MiB 或为空，请先导出工程备份'}, 413);
  const value = await body.text();
  if (!mediaTypes.test(value) || await digestMedia(value) !== digest) return json({error:'素材校验失败'}, 400);
  await bucket.put(key, value, {onlyIf:{etagDoesNotMatch:'*'}});
  return env.DESK.get(env.DESK.idFromName('owner')).fetch(new Request('https://internal/internal/desk-media/'+digest,{method:'PUT'}));
}

function mediaReferences(state) {
  return new Set(deskMediaSlots(state).map(slot => referenceDigest(slot.data)).filter(value => value !== null));
}

async function readSnapshot(tx, meta) {
  const keys = Array.from({length:meta.parts}, (_, i) => 'part-' + i);
  const values = new Map();
  for (let i = 0; i < keys.length; i += 100) {
    for (const [key, value] of await tx.get(keys.slice(i, i + 100))) values.set(key, value);
  }
  return JSON.parse(keys.map(key => values.get(key)).join(''));
}
export default {
  async fetch(request,env,ctx){
    const url=new URL(request.url);
    const auth=await authenticate(request,env);
    if(auth instanceof Response)return auth;
    if(url.pathname==='/api/me')return json({email:'个人工作空间'});
    if(url.pathname.startsWith('/api/desk-media/'))return deskMedia(request,url,env);
    if(url.pathname==='/api/desk'){
      if(!['GET','PUT'].includes(request.method))return json({error:'Method not allowed'},405);
      if(request.method==='PUT'&&(request.headers.get('Origin')!==url.origin||!request.headers.get('Content-Type')?.startsWith('application/json')))return json({error:'Invalid origin or content type'},403);
      return env.DESK.get(env.DESK.idFromName('owner')).fetch(request);
    }
    if(!['GET','HEAD'].includes(request.method))return json({error:'Method not allowed'},405);
    if(url.pathname.startsWith('/editor/')||url.pathname.startsWith('/ai-web/')){
      if(!env.EDITOR_ASSETS)return json({error:'Editor assets unavailable'},503);
      const response=await env.EDITOR_ASSETS.fetch(request);
      const headers=new Headers(response.headers);headers.set('X-Frame-Options','SAMEORIGIN');headers.set('Cache-Control','private, no-store');headers.set('X-Content-Type-Options','nosniff');
      return new Response(response.body,{status:response.status,headers});
    }
    const asset=assets[url.pathname==='/'?'/index.html':url.pathname];
    if(!asset)return json({error:'Not found'},404);
    return new Response(request.method==='HEAD'?null:Uint8Array.from(atob(asset.body),c=>c.charCodeAt(0)),{headers:{'Content-Type':asset.type,'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'same-origin','X-Frame-Options':url.pathname.startsWith('/editor/')?'SAMEORIGIN':'DENY'}});
  }
};
export class PersonalDesk {
  constructor(ctx,env={}){this.storage=ctx.storage;this.media=env.DESK_MEDIA;}
  async fetch(request){
    const path=new URL(request.url).pathname;
    if(path.startsWith('/internal/desk-media/')&&request.method==='PUT'){
      const digest=path.slice('/internal/desk-media/'.length);
      if(!this.media||!mediaDigest.test(digest))return json({error:'Invalid media reference'},400);
      await this.storage.put('media-'+digest,true);
      return json({ok:true});
    }
    if(path==='/internal/login-limit'){
      return this.storage.transaction(async tx=>{
        const now=Date.now();let rate=await tx.get('login-rate');
        if(!rate||now>=rate.until)rate={count:0,until:now+600000};
        rate.count++;await tx.put('login-rate',rate);
        return json({allowed:rate.count<=30,retry:Math.ceil((rate.until-now)/1000)});
      });
    }
    if(request.method==='GET'){
      return this.storage.transaction(async tx=>{
        const capability=this.media?{assetStorage:true}:{};
        const meta=await tx.get('meta');if(!meta)return json({revision:0,state:null,...capability});
        if(meta.media&&!this.media)return json({error:'云端媒体存储暂不可用，请重试'},503);
        if(request.headers.get('If-None-Match')===String(meta.revision))return new Response(null,{status:304,headers:{'Cache-Control':'no-store'}});
        return json({revision:meta.revision,state:await readSnapshot(tx,meta),...capability});
      });
    }
    const limit=8*1024*1024;
    if(!request.body)return json({error:'Empty body'},400);
    const body=await readBody(request,limit);
    if(!body)return json({error:'同步数据超过 8 MiB，请先导出备份。'},413);
    let data;try{data=JSON.parse(await body.text())}catch{return json({error:'Invalid JSON'},400)}
    if(!Number.isSafeInteger(data.revision)||data.revision<0||!data.state||data.state.version!==1||!Array.isArray(data.state.objects)||data.state.objects.length>2000||!Array.isArray(data.state.trash))return json({error:'Invalid snapshot'},400);
    const references=mediaReferences(data.state);
    if([...references].some(digest=>!mediaDigest.test(digest)))return json({error:'Invalid media reference'},400);
    const text=JSON.stringify(data.state);
    // 24K UTF-16 units stay below the 128KiB Durable Object value limit even for CJK text.
    const chunks=[];for(let i=0;i<text.length;i+=24000)chunks.push(text.slice(i,i+24000));
    return this.storage.transaction(async tx=>{
      const meta=await tx.get('meta')||{revision:0,parts:0};
      if(meta.revision!==data.revision)return this.conflict(meta);
      if((meta.media||references.size)&&!this.media)return json({error:'云端媒体存储暂不可用，请重试'},503);
      const keys=[...references].map(digest=>'media-'+digest);
      for(let i=0;i<keys.length;i+=100){
        const batch=keys.slice(i,i+100),found=await tx.get(batch);
        if(batch.some(key=>found.get(key)!==true))return json({error:'部分素材尚未成功上传，请重试'},400);
      }
      for(let i=0;i<chunks.length;i++)await tx.put('part-'+i,chunks[i]);
      for(let i=chunks.length;i<meta.parts;i++)await tx.delete('part-'+i);
      const revision=meta.revision+1;await tx.put('meta',{revision,parts:chunks.length,media:references.size>0});return json({revision});
    });
  }
  conflict(meta){return json({error:'另一台设备已保存新版本。',revision:meta?.revision||0},409);}
}
