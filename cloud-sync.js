import {deskMediaSlots,digestMedia,forEachMedia,mediaReference,referenceDigest} from './desk-media.js';

let revision=0, ready=false, busy=false, conflict=false, dirty=false, expired=false;
let initialized=false, leaving=false, assetStorage=false, generation=0, storedGeneration=0;
let syncTimer, storageTimer, storageFailure=false;
let syncMessage='正在连接云端…';
const mediaCache=new Map();
const saveStatus=$('#saveState'),mobileBadge=$('#mobileSync');
const badge=document.createElement('button');
badge.type='button';
saveStatus.replaceChildren(badge);

function showStatus(message=syncMessage) {
  syncMessage=message;
  const text=storageFailure?`${message} · 设备保存失败，请导出备份`:message;
  if(badge.textContent!==text)badge.textContent=text;
  badge.title=text;
  if(mobileBadge.textContent!==text)mobileBadge.textContent=text;
}

async function storeDesk() {
  clearTimeout(storageTimer);
  const current=generation;
  try {
    await deviceStore.write({snapshot:snapshot(),revision,dirty});
    storedGeneration=Math.max(storedGeneration,current);
    storageFailure=false;
    if(syncMessage==='待同步 · 保存到此设备中…'&&generation===current)syncMessage='仅保存到此设备 · 等待同步';
    return true;
  } catch {
    storageFailure=true;
    return false;
  } finally {
    showStatus();
  }
}

async function fetchCloud(path, options={}) {
  const response=await fetch(path,{...options,redirect:'error',signal:AbortSignal.timeout(45000)});
  if(response.ok||response.status===304)return response;
  const result=await response.json().catch(()=>null);
  const error=new Error(result?.error||'云端暂不可用，请重试');
  error.status=response.status;
  throw error;
}

async function api(method='GET', body, cached=false) {
  const headers=method==='PUT'?{'Content-Type':'application/json'}:{};
  if(cached)headers['If-None-Match']=String(revision);
  const response=await fetchCloud('/api/desk',{method,headers,body:body?JSON.stringify(body):undefined});
  return response.status===304?null:response.json();
}

async function packedState(text) {
  const next=JSON.parse(text);
  if(!assetStorage)return next;
  const slots=deskMediaSlots(next).filter(slot=>slot.data.startsWith('data:'));
  const uploads=new Map();
  for(const {data} of slots)uploads.set(data,mediaCache.get(data));
  await forEachMedia(uploads.keys(),async value=>{
    if(uploads.get(value))return;
    const digest=await digestMedia(value);
    await fetchCloud('/api/desk-media/'+digest,{method:'PUT',headers:{'Content-Type':'text/plain'},body:value});
    uploads.set(value,digest);
    mediaCache.set(value,digest);
  });
  for(const {record,key,data} of slots)record[key]=mediaReference(uploads.get(data));
  for(const value of mediaCache.keys())if(!uploads.has(value))mediaCache.delete(value);
  return next;
}

async function unpackedState(wireState) {
  const existing=new Map([...mediaCache].map(([value,digest])=>[digest,value]));
  const slots=deskMediaSlots(wireState).flatMap(slot=>{
    const digest=referenceDigest(slot.data);
    return digest===null?[]:[{...slot,digest}];
  });
  const media=new Map();
  await forEachMedia(new Set(slots.map(slot=>slot.digest)),async digest=>{
    const value=existing.get(digest)??await (await fetchCloud('/api/desk-media/'+digest)).text();
    media.set(digest,value);
  });
  mediaCache.clear();
  for(const {record,key,digest} of slots){
    const value=media.get(digest);
    record[key]=value;
    mediaCache.set(value,digest);
  }
  return validate(wireState);
}

function scheduleSync(delay=1200) {
  clearTimeout(syncTimer);
  if(!expired&&!conflict&&!leaving)syncTimer=setTimeout(retrySync,delay);
}

saveCloud=function(){
  if(!initialized||leaving)return;
  dirty=true;
  generation++;
  clearTimeout(storageTimer);
  storageTimer=setTimeout(storeDesk,150);
  if(!conflict&&!expired)showStatus('待同步 · 保存到此设备中…');
  scheduleSync();
};

function markConflict() {
  conflict=true;
  showStatus('存在同步冲突 · 点击处理');
}

function onSyncError(error) {
  if(error.status===409){markConflict();return}
  if(error.status===401){
    expired=true;
    showStatus('登录已过期 · 点击重新登录');
    return;
  }
  showStatus(dirty?'待同步 · 点击重试':'云端暂不可用 · 点击重试');
  badge.title=(error.status?error.message:'无法连接云端，请检查网络。')+(storageFailure?' · 设备保存失败，请导出备份':'');
  if(error.status===413)showStatus(error.message+' · 点击重试');
}

function adopt(next, nextRevision) {
  const previousBoard=boardFromLocation();
  const previousCamera=initialized&&previousBoard===(state.activeBoardId||null)?{...state.camera}:null;
  state=next;
  if(previousCamera){
    if(previousBoard===(state.activeBoardId||null))state.camera=previousCamera;
    else state.boardCameras={...state.boardCameras,[previousBoard||'root']:previousCamera};
  }
  revision=nextRevision;
  dirty=false;
  selected.clear();undo=[];redo=[];
  applyBoardLocation();
}

async function push() {
  if(!ready||busy||conflict||!dirty||leaving||expired)return;
  busy=true;
  const text=snapshot(), sending=generation;
  showStatus('正在同步…');
  try {
    const packed=await packedState(text);
    if(leaving)return;
    const data=await api('PUT',{revision,state:packed});
    revision=data.revision;
    dirty=generation!==sending;
    showStatus(dirty?'有新修改待同步':'已与云端同步');
    await storeDesk();
  } catch(error) { onSyncError(error); }
  finally {
    busy=false;
    if(dirty) scheduleSync(15000);
  }
}

async function refresh() {
  if(busy||conflict||leaving||expired)return;
  busy=true;
  try {
    const data=await api('GET',null,ready&&!dirty);
    if(!data){showStatus('已与云端同步');return}
    assetStorage=!!data.assetStorage;
    if(dirty&&revision!==data.revision){markConflict();return}
    if(!dirty&&data.state){
      const next=await unpackedState(data.state);
      if(dirty){if(revision!==data.revision)markConflict();return}
      if(gesture||inlineEdit||pikaSession||document.querySelector('dialog[open]'))return;
      adopt(next,data.revision);
      showStatus('已与云端同步');
      await storeDesk();
    } else if (!data.state&&!dirty) {
      applyBoardLocation();
      showStatus('云端工作空间 · 尚无已同步修改');
    }
    ready=true;
  } catch(error) { onSyncError(error); }
  finally {
    busy=false;
    if(!initialized){
      initialized=true;
      openWorkspace();
    }
    if(ready&&dirty)scheduleSync(0);
  }
}

function retrySync() {
  if(expired||conflict||leaving)return;
  if(ready&&dirty)push();
  else refresh();
}

function copyWorkspace(next, local) {
  if(next.objects.length+local.objects.length+1>2000)throw new Error('合并后超过工作台容量，请先导出备份再载入云端');
  const boardId=crypto.randomUUID();
  const entries=[...local.objects,...local.trash];
  const ids=new Map(entries.filter(object=>object&&typeof object.id==='string').map(object=>[object.id,crypto.randomUUID()]));
  const copy=object=>({...object,id:ids.get(object.id),parentBoardId:ids.get(object.parentBoardId)||boardId});
  const edges=local.connections.filter(edge=>ids.has(edge.from)&&ids.has(edge.to)).map(edge=>({...edge,id:crypto.randomUUID(),from:ids.get(edge.from),to:ids.get(edge.to)}));
  if(next.connections.length+edges.length>4000)throw new Error('合并后连线过多，请先导出备份再载入云端');
  const currentBoard=next.objects.find(object=>object.id===boardFromLocation()&&object.type==='board');
  const parentBoardId=currentBoard?.id||null;
  const cameraKey=parentBoardId||'root';
  const camera=parentBoardId===(next.activeBoardId||null)?next.camera:next.boardCameras?.[cameraKey]||initialCanvasCamera();
  const {x,y,z}=camera;
  const card={id:boardId,type:'board',name:'本机工作空间副本',parentBoardId,x:(desk.clientWidth*.48-x)/z,y:(desk.clientHeight*.22-y)/z,w:160,h:130,r:0,z:1};
  const projects=Object.fromEntries(Object.entries(local.pikadoProjects||{}).filter(([id])=>ids.has(id)).map(([id,project])=>[ids.get(id),project]));
  const localRoot=local.activeBoardId?(local.boardCameras?.root||initialCanvasCamera()):local.camera;
  const cameras=Object.fromEntries(Object.entries(local.boardCameras||{}).filter(([id])=>ids.has(id)).map(([id,value])=>[ids.get(id),value]));
  if(ids.has(local.activeBoardId))cameras[ids.get(local.activeBoardId)]=local.camera;
  next.objects.push(card,...local.objects.map(copy));
  next.trash.push(...local.trash.filter(object=>object&&ids.has(object.id)).map(copy));
  next.connections.push(...edges);
  next.pikadoProjects={...next.pikadoProjects,...projects};
  next.boardCameras={...next.boardCameras,...cameras,[boardId]:localRoot};
  return boardId;
}

function showConflict() {
  modal('处理同步冲突',`<p class="dialogcopy">云端有较新的修改。你可以把设备上的内容保留为独立子画板，或先导出备份再载入云端。</p>
    <div class="dialogactions"><button class="primary" id="cloudCopy">保留为独立画板</button><button id="cloudReplace">导出备份并载入云端</button></div><p id="cloudConflictStatus" role="status"></p>`);
  const keep=$('#cloudCopy'), replace=$('#cloudReplace'), status=$('#cloudConflictStatus');
  async function resolveConflict(keepLocal) {
    if(!keepLocal)exportBackup();
    keep.disabled=replace.disabled=true;
    status.textContent='正在读取云端版本…';
    try {
      const data=await api();
      const next=await unpackedState(data.state||seed());
      const copy=keepLocal?copyWorkspace(next,validate(JSON.parse(snapshot()))):null;
      if(!dialog.open||!status.isConnected)return;
      assetStorage=!!data.assetStorage;
      ready=true;conflict=false;
      dialog.close();
      adopt(next,data.revision);
      if(copy){enterBoard(copy);save();await storeDesk()}
      else{showStatus('已与云端同步');await storeDesk()}
      toast(copy?'设备上的内容已保留为独立画板':'已载入云端版本');
    } catch(error) {
      if(error.status===401)onSyncError(error);
      status.textContent=error.message||'无法载入云端版本，请重试';
    } finally { keep.disabled=replace.disabled=false; }
  }
  keep.onclick=()=>resolveConflict(true);
  replace.onclick=()=>resolveConflict(false);
}

async function loginAgain() {
  const destination='/login'+location.hash;
  if(!dirty||await storeDesk()){location.assign(destination);return}
  modal('重新登录',`<p class="dialogcopy">设备保存失败，离开前请导出当前修改。</p><button class="primary" id="exportRelogin">导出备份并重新登录</button>`);
  $('#exportRelogin').onclick=()=>{exportBackup();location.assign(destination)};
}

badge.onclick=()=>{
  if(expired)loginAgain();
  else if(conflict)showConflict();
  else if(storageFailure&&!dirty)storeDesk();
  else retrySync();
};

function showLogout() {
  modal('退出登录',`<p class="dialogcopy">${dirty?'仍有未同步修改。退出前可以先导出一份完整备份。':'退出后会清除这台设备上的工作空间缓存。'}</p>
    <div class="dialogactions"><button class="primary" id="confirmLogout">${dirty?'导出备份后退出':'退出登录'}</button></div><p id="logoutStatus" role="status"></p>`);
  const button=$('#confirmLogout'), status=$('#logoutStatus');
  button.onclick=async()=>{
    if(dirty)exportBackup();
    leaving=true;
    button.disabled=true;
    status.textContent='正在退出…';
    clearTimeout(syncTimer);clearTimeout(storageTimer);
    try {
      await fetchCloud('/auth/logout',{method:'POST'});
    } catch {
      leaving=false;
      if(dirty)await storeDesk();
      status.textContent='退出未完成。请检查网络并重试。';
      button.disabled=false;
      return;
    }
    try{await deviceStore.clear()}catch{try{sessionStorage.setItem('frame-device-clear-pending','1')}catch{}}
    location.replace('/login');
  };
}

const localMore=actions.more;
actions.more=()=>{
  localMore();
  $('#popover').insertAdjacentHTML('beforeend','<hr><button id="cloudLogout">退出登录</button>');
  $('#cloudLogout').onclick=showLogout;
};
actions.people=()=>modal('个人云端工作空间',`<p class="dialogcopy">仅所有者可登录。布局、工作预览和可编辑工程可在个人设备间同步。上传照片会生成压缩工作预览，请单独保存原片。</p><p class="dialogcopy">${assetStorage?'云端素材与布局分开保存。':'当前云端使用整份桌面快照，单次同步上限 8 MiB。'}</p>`);
actions.help=actions.people;
actions.share=()=>modal('个人备份','<p class="dialogcopy">本工作空间不提供公开分享。导出的备份包含照片与布局，请妥善保存。</p><div class="dialogactions">'+button('导出桌面备份','export')+button('导入备份','import')+'</div>');

window.addEventListener('beforeunload',event=>{
  if(!leaving&&dirty&&(storageFailure||storedGeneration<generation)){
    event.preventDefault();event.returnValue='';
  }
});
window.addEventListener('online',retrySync);
setInterval(()=>{
  if(!document.hidden&&!gesture&&!inlineEdit&&!pikaSession&&!document.querySelector('dialog[open]'))retrySync();
},30000);
mobileBadge.hidden=false;mobileBadge.onclick=()=>badge.click();

try {
  if(sessionStorage.getItem('frame-device-clear-pending')){
    await deviceStore.clear();
    sessionStorage.removeItem('frame-device-clear-pending');
  }
  const record=await deviceStore.read();
  if(record){
    state=validate(JSON.parse(record.snapshot));
    revision=record.revision||0;dirty=!!record.dirty;
    applyBoardLocation({keepMissing:true});
    initialized=true;
    showStatus(dirty?'仅保存到此设备 · 等待同步':'正在核对云端版本…');
    openWorkspace();
    if(record.legacy)await storeDesk();
  }
} catch {
  storageFailure=true;
}
refresh();
