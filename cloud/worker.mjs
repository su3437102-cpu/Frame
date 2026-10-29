import assets from '../dist/assets.mjs';
import ownerHash from '../dist/owner.mjs';
const json=(value,status=200)=>Response.json(value,{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
export default {
  async fetch(request,env,ctx){
    // ctx.access is supplied by Cloudflare, never by client-controlled headers.
    // Assets are bundled deliberately: the Static Assets router does not forward ctx.access.
    if(!ctx.access) return json({error:'需要通过 Cloudflare Access 登录。'},403);
    if(!env.OWNER_EMAIL&&!ownerHash) return json({error:'个人登录配置尚未完成。'},503);
    let identity;try{identity=await ctx.access.getIdentity()}catch{return json({error:'登录验证失败。'},403)}
    const email=identity?.email?.trim().toLowerCase()||'';
    const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(email))),b=>b.toString(16).padStart(2,'0')).join('');
    if(!email||(env.OWNER_EMAIL?email!==env.OWNER_EMAIL.trim().toLowerCase():hash!==ownerHash))return json({error:'此工作空间仅限所有者访问。'},403);
    const url=new URL(request.url);
    if(url.pathname==='/api/me')return json({email:identity.email});
    if(url.pathname==='/api/desk'){
      if(!['GET','PUT'].includes(request.method))return json({error:'Method not allowed'},405);
      if(request.method==='PUT'&&(request.headers.get('Origin')!==url.origin||!request.headers.get('Content-Type')?.startsWith('application/json')))return json({error:'Invalid origin or content type'},403);
      return env.DESK.get(env.DESK.idFromName('owner')).fetch(request);
    }
    if(!['GET','HEAD'].includes(request.method))return json({error:'Method not allowed'},405);
    const asset=assets[url.pathname==='/'?'/index.html':url.pathname];
    if(!asset)return json({error:'Not found'},404);
    return new Response(request.method==='HEAD'?null:Uint8Array.from(atob(asset.body),c=>c.charCodeAt(0)),{headers:{'Content-Type':asset.type,'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'same-origin','X-Frame-Options':'DENY'}});
  }
};
export class PersonalDesk {
  constructor(ctx){this.storage=ctx.storage;}
  async fetch(request){
    if(request.method==='GET'){
      return this.storage.transaction(async tx=>{
        const meta=await tx.get('meta');if(!meta)return json({revision:0,state:null});
        if(request.headers.get('If-None-Match')===String(meta.revision))return new Response(null,{status:304,headers:{'Cache-Control':'no-store'}});
        const keys=Array.from({length:meta.parts},(_,i)=>'part-'+i),values=new Map();
        for(let i=0;i<keys.length;i+=100)for(const [k,v] of await tx.get(keys.slice(i,i+100)))values.set(k,v);
        return json({revision:meta.revision,state:JSON.parse(keys.map(k=>values.get(k)).join(''))});
      });
    }
    const limit=8*1024*1024;
    const reader=request.body?.getReader();if(!reader)return json({error:'Empty body'},400);
    let size=0,parts=[];
    for(;;){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>limit){await reader.cancel();return json({error:'桌面备份超过 8MB，请先减少图片或导出归档。'},413)}parts.push(value)}
    let data;try{data=JSON.parse(await new Blob(parts).text())}catch{return json({error:'Invalid JSON'},400)}
    if(!Number.isSafeInteger(data.revision)||data.revision<0||!data.state||data.state.version!==1||!Array.isArray(data.state.objects)||data.state.objects.length>2000||!Array.isArray(data.state.trash))return json({error:'Invalid snapshot'},400);
    const text=JSON.stringify(data.state);
    // 24K UTF-16 units stay below the 128KiB Durable Object value limit even for CJK text.
    const chunks=[];for(let i=0;i<text.length;i+=24000)chunks.push(text.slice(i,i+24000));
    return this.storage.transaction(async tx=>{
      const meta=await tx.get('meta')||{revision:0,parts:0};
      if(meta.revision!==data.revision)return json({error:'另一台设备已保存新版本。请先保留本机备份，再载入云端。',revision:meta.revision},409);
      for(let i=0;i<chunks.length;i++)await tx.put('part-'+i,chunks[i]);
      for(let i=chunks.length;i<meta.parts;i++)await tx.delete('part-'+i);
      const revision=meta.revision+1;await tx.put('meta',{revision,parts:chunks.length});return json({revision});
    });
  }
}
