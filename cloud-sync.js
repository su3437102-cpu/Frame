'use strict';
(()=>{
  const META=KEY+':sync';let revision=0,ready=false,busy=false,conflict=false,timer,dirty=false;
  try{const m=JSON.parse(localStorage.getItem(META)||'{}');revision=m.revision||0;dirty=!!m.dirty}catch{}
  const badge=document.createElement('button');badge.textContent='正在连接云端…';badge.style.cssText='font:inherit;border:0;background:transparent;color:inherit;cursor:pointer';$('#saveState').replaceWith(badge);badge.id='saveState';
  function meta(){try{localStorage.setItem(META,JSON.stringify({revision,dirty}))}catch{}}
  function status(text){badge.textContent=text}
  function persist(){try{localStorage.setItem(KEY,snapshot())}catch{status('本机存储已满，请导出备份')}meta()}
  async function api(method='GET',body){const r=await fetch('/api/desk',{method,redirect:'error',headers:{'Content-Type':'application/json',...(method==='GET'&&ready&&!dirty?{'If-None-Match':String(revision)}:{})},body:body?JSON.stringify(body):undefined});if(r.status===304)return null;let data;try{data=await r.json()}catch{throw Error('登录已失效，请刷新后重新登录')}if(!r.ok){const e=Error(data.error||'云端连接失败');e.status=r.status;throw e}return data}
  function apply(data){state=validate(data.state);revision=data.revision;dirty=false;selected.clear();undo=[];redo=[];render();persist();status('已与云端同步')}
  function showConflict(){conflict=true;status('存在同步冲突 · 点击处理');modal('保留两台设备的修改','<p class="dialogcopy">云端已有新版本。本机修改仍保留，请先下载本机备份，再载入云端；需要的内容可随后整理导入。</p><div class="dialogactions"><button id="cloudExport">导出本机备份</button><button id="cloudLoad" disabled>已备份，载入云端</button></div>');$('#cloudExport').onclick=()=>{exportBackup();$('#cloudLoad').disabled=false};$('#cloudLoad').onclick=async()=>{try{const data=await api();if(data?.state){apply(data);conflict=false;dialog.close()}}catch(e){toast(e.message)}}}
  async function push(){if(!ready||busy||conflict||!dirty)return;busy=true;const text=snapshot();status('正在同步…');try{const data=await api('PUT',{revision,state:JSON.parse(text)});revision=data.revision;dirty=snapshot()!==text;persist();status(dirty?'仍有待同步修改':'已与云端同步')}catch(e){if(e.status===409)showConflict();else status('待同步 · 点击重试：'+e.message)}finally{busy=false;if(dirty&&!conflict)timer=setTimeout(push,15000)}}
  save=function(){dirty=true;persist();status('修改已保留，等待同步…');clearTimeout(timer);timer=setTimeout(push,1200)};
  badge.onclick=()=>conflict?showConflict():push();
  actions.people=()=>modal('个人云端工作空间','<p class="dialogcopy">仅所有者可登录。照片与布局保存到云端，在你的设备间同步。云端桌面上限 8MB，照片使用应用压缩后的预览图；请单独保存原片。</p>');
  actions.share=()=>modal('个人备份','<p class="dialogcopy">本工作空间不提供公开分享。导出的备份包含照片与布局，请妥善保存。</p><div class="dialogactions">'+button('导出桌面备份','export')+button('导入备份','import')+'</div>');
  actions.help=actions.people;
  const oldMore=actions.more;actions.more=()=>{oldMore();$('#popover').insertAdjacentHTML('beforeend','<hr><button id="cloudLogout">退出登录</button>');$('#cloudLogout').onclick=()=>{if(dirty){toast('仍有未同步修改，请先同步或导出备份');return}window.cloudLoggingOut=true;localStorage.removeItem(KEY);localStorage.removeItem(META);location.href='/cdn-cgi/access/logout'}};
  window.addEventListener('beforeunload',e=>{if(dirty){e.preventDefault();e.returnValue=''}});
  window.addEventListener('online',push);
  // Read before writing: never overwrite an existing cloud desk with seeded demo content.
  async function start(){busy=true;try{const data=await api();if(data.state){if(dirty&&revision!==data.revision){ready=true;showConflict()}else if(dirty){ready=true}else apply(data)}else{revision=0;dirty=true}ready=true;meta()}catch(e){status('尚未连接云端：'+e.message)}finally{busy=false;if(ready&&dirty&&!conflict)push()}}
  start();
  setInterval(async()=>{if(!ready){start();return}if(document.hidden||busy||gesture||dialog.open||conflict)return;if(dirty){push();return}busy=true;try{const data=await api();if(data?.state){if(dirty)showConflict();else apply(data)}}catch(e){status('云端暂不可用 · 本机修改会保留')}finally{busy=false}},30000);
})();
