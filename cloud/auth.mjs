const enc=new TextEncoder(),cookieName='__Host-frame_session';
const headers={'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','X-Frame-Options':'DENY','Referrer-Policy':'no-referrer'};
const json=(body,status=200,extra={})=>Response.json(body,{status,headers:{...headers,...extra}});
const hex=bytes=>Array.from(new Uint8Array(bytes),x=>x.toString(16).padStart(2,'0')).join('');
async function sign(key,value){const k=await crypto.subtle.importKey('raw',enc.encode(key),{name:'HMAC',hash:'SHA-256'},false,['sign']);return hex(await crypto.subtle.sign('HMAC',k,enc.encode(value)))}
async function equal(a,b){const x=new Uint8Array(await crypto.subtle.digest('SHA-256',enc.encode(a))),y=new Uint8Array(await crypto.subtle.digest('SHA-256',enc.encode(b)));let d=0;for(let i=0;i<x.length;i++)d|=x[i]^y[i];return d===0}
const cookie=(value,age)=>`${cookieName}=${value}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${age}`;
export const loginPage=`<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>登录 · FrameLab</title><style>
:root{--bg:#efefec;--surface:#fff;--ink:#282a2c;--muted:#62666a;--line:#c7c9c9;--error:#9b302c}*{box-sizing:border-box}body{margin:0;min-height:100svh;display:grid;place-items:center;padding:24px;background:var(--bg);color:var(--ink);font:15px/1.6 system-ui,sans-serif}main{width:min(100%,360px)}h1{font-size:26px;letter-spacing:-1px;margin:0}p{color:var(--muted);margin:8px 0 32px}label{display:block;margin-bottom:8px}input,button{width:100%;min-height:48px;border:1px solid var(--line);border-radius:4px;font:inherit}input{padding:10px 12px;background:var(--surface);color:var(--ink)}button{background:var(--ink);color:var(--surface);cursor:pointer;border-color:var(--ink)}button:disabled{opacity:.5;cursor:not-allowed}button:active{transform:translateY(1px)}input:focus-visible,button:focus-visible{outline:2px solid var(--ink);outline-offset:3px}@media(hover:hover){button:hover{filter:brightness(1.25)}}#message{min-height:48px;margin:10px 0;color:var(--error);font-size:13px}small{display:block;margin-top:24px;color:var(--muted)}
</style><main><h1>FrameLab</h1><p>你的私人摄影工作空间</p><form method="post" action="/auth/login"><label for="key">个人登录口令</label><input id="key" name="key" type="password" autocomplete="current-password" required maxlength="256" aria-describedby="message"><div id="message" role="status" aria-live="polite"></div><button>进入工作空间</button></form><small>仅限本人使用 · 登录状态保留 12 小时</small></main><script src="/auth/login.js"></script></html>`;
const script=`const f=document.querySelector('form'),m=document.querySelector('#message'),b=document.querySelector('button');f.addEventListener('submit',async e=>{e.preventDefault();b.disabled=true;b.textContent='正在验证…';m.textContent='';try{const r=await fetch('/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({key:f.elements.key.value})});const d=await r.json();if(!r.ok)throw Error(d.error);f.reset();location.replace('/')}catch(e){m.textContent=e.message||'网络连接失败，请重试。';b.disabled=false;b.textContent='进入工作空间'}});`;
export async function authenticate(request,env){
 const url=new URL(request.url),path=url.pathname;
 if(path==='/login'&&request.method==='GET')return new Response(loginPage,{headers:{...headers,'Content-Type':'text/html; charset=utf-8','Content-Security-Policy':"default-src 'none'; script-src 'self'; style-src 'unsafe-inline'; connect-src 'self'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'"}});
 if(path==='/auth/login.js'&&request.method==='GET')return new Response(script,{headers:{...headers,'Content-Type':'text/javascript; charset=utf-8'}});
 if(path.startsWith('/auth/')){
  if(request.method!=='POST')return json({error:'Method not allowed'},405);
  if(request.headers.get('Origin')!==url.origin)return json({error:'请求来源不匹配，请从登录页重试。'},403);
  if(path==='/auth/logout')return json({ok:true},200,{'Set-Cookie':cookie('',0)});
 }
 if(!env.LOGIN_KEY||env.LOGIN_KEY.length<32)return json({error:'个人登录尚未配置，请设置至少 32 位的随机 LOGIN_KEY。'},503);
 if(path==='/auth/login'){
  const rate=await (await env.DESK.get(env.DESK.idFromName('owner')).fetch(new Request('https://internal/internal/login-limit'))).json();
  if(!rate.allowed)return json({error:`尝试次数过多，请 ${rate.retry} 秒后重试。`},429,{'Retry-After':String(rate.retry)});
  const reader=request.body?.getReader();if(!reader)return json({error:'请输入登录口令。'},400);let chunks=[],size=0;
  for(;;){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>1024){await reader.cancel();return json({error:'输入过长。'},413)}chunks.push(value)}
  let data;try{data=JSON.parse(await new Blob(chunks).text())}catch{return json({error:'请求格式错误，请重试。'},400)}
  if(typeof data.key!=='string'||!await equal(data.key,env.LOGIN_KEY))return json({error:'口令不正确，请检查后重试。'},401);
  const payload=String(Date.now()+43200000)+'.'+hex(crypto.getRandomValues(new Uint8Array(16)));
  return json({ok:true},200,{'Set-Cookie':cookie(payload+'.'+await sign(env.LOGIN_KEY,payload),43200)});
 }
 const token=request.headers.get('Cookie')?.split(';').map(x=>x.trim()).find(x=>x.startsWith(cookieName+'='))?.slice(cookieName.length+1)||'';
 const parts=token.split('.');
 if(parts.length===3&&/^\d{13}$/.test(parts[0])&&/^[a-f0-9]{32}$/.test(parts[1])&&/^[a-f0-9]{64}$/.test(parts[2])&&Number(parts[0])>Date.now()&&Number(parts[0])<=Date.now()+43200000&&await equal(parts[2],await sign(env.LOGIN_KEY,parts.slice(0,2).join('.'))))return true;
 if(path.startsWith('/api/'))return json({error:'登录已过期，请重新打开网页登录。'},401);
 return new Response(null,{status:303,headers:{...headers,Location:'/login'}});
}
