// Pikado is bundled locally; only this frame may return a project to its owner.
let pikaSession=null;
function pikaRecord(id){return (state.pikadoProjects??={})[id]}
function openPikado(id){
 if(pikaSession){toast('请先保存并关闭当前编辑器');return}
 const o=state.objects.find(o=>o.id===id);if(!o)return;
 if(o.variant==='ps'&&!o.src){toast('请先将照片连接到 PS 模块');return}
 const record=pikaRecord(id),src=o.variant==='ps'?(o.psInputSrc||o.src):null;
 const source=[...document.querySelectorAll('[data-id]')].find(el=>el.dataset.id===id);
 const rect=source?.getBoundingClientRect();
 const preview=o.src||src;
 if(dialog.open)dialog.close();
 const panel=document.createElement('section');panel.id='pikadoPanel';panel.setAttribute('role','dialog');panel.setAttribute('aria-modal','true');panel.setAttribute('aria-label','Pikado 图像编辑器');
 if(rect)panel.style.transformOrigin=Math.max(0,Math.min(innerWidth,rect.x+rect.width/2))+'px '+Math.max(0,Math.min(innerHeight,rect.y+rect.height/2))+'px';
 panel.innerHTML=`<header tabindex="-1"><strong>Pikado</strong><span role="status">正在准备编辑器…</span><button type="button" data-editor-cancel>返回画布</button><button type="button" data-editor-save disabled>保存并返回画布</button></header><div class="editor-placeholder" aria-hidden="true">${preview?`<img src="${esc(preview)}" alt="">`:''}</div><iframe title="Pikado 图层编辑器" src="editor/index.html" allow="clipboard-read; clipboard-write" tabindex="-1"></iframe>`;
 document.body.append(panel);document.body.classList.add('pikado-editing');
 $$('[data-workspace-region]').forEach(element=>element.inert=true);
 panel.querySelector('header').focus({preventScroll:true});renderCamera();
 const frame=panel.querySelector('iframe'),status=panel.querySelector('[role=status]'),button=panel.querySelector('[data-editor-save]'),cancel=panel.querySelector('[data-editor-cancel]');
 frame.inert=true;
 const session=pikaSession={id,token:crypto.randomUUID(),panel,frame,status,button,cancel,src,ready:false,closing:false};
 session.loadTimer=setTimeout(()=>{if(pikaSession===session&&!session.ready)status.textContent='编辑器暂未就绪，返回后可重新打开'},20000);
 cancel.onclick=()=>{if(!session.ready)closePikado(session)};
 panel.addEventListener('keydown',event=>{if(event.key==='Escape'&&!session.ready)cancel.click()});
 pikaSession.initial={theme:state.theme,src:src?new URL(src,location.href).href:null,pkd:record?.pkd,sourceLayerId:record?.sourceLayerId,replaceSource:!!record&&record.inputSrc!==src,name:o.name};
 button.onclick=()=>{if(!session.ready||session.closing)return;session.closing=true;button.disabled=true;status.textContent='正在保存工程…';frame.contentWindow.postMessage({channel:'framelab-pikado',type:'flush'},location.origin);session.flushTimer=setTimeout(()=>{session.closing=false;button.disabled=false;status.textContent='工程尚未回传，请重试保存'},20000)};
}
window.addEventListener('message',e=>{
 const s=pikaSession,m=e.data;if(!s||e.origin!==location.origin||e.source!==s.frame.contentWindow||m?.channel!=='framelab-pikado')return;
 if(m.type==='ready'){s.frame.contentWindow.postMessage({channel:'framelab-pikado',type:'open',session:s.token,...s.initial},location.origin);return}
 if(m.session!==s.token)return;
 if(m.type==='opened'){clearTimeout(s.loadTimer);s.panel.classList.add('editor-ready');s.ready=true;s.cancel.hidden=true;s.button.disabled=false;s.frame.inert=false;s.frame.removeAttribute('tabindex');s.status.textContent='编辑会自动回传画布';return}
 if(m.type==='error'){clearTimeout(s.loadTimer);clearTimeout(s.flushTimer);s.closing=false;s.button.disabled=!s.ready;s.status.textContent=(s.ready?'未保存：':'无法打开工程：')+String(m.message).slice(0,160);return}
 if(m.type==='result'){
  if(typeof m.preview!=='string'||!/^data:image\/png;base64,[a-z0-9+/=]+$/i.test(m.preview)||typeof m.pkd!=='string'||!/^data:application\/x-pikado;base64,[a-z0-9+/=]+$/i.test(m.pkd))return;
  const o=state.objects.find(o=>o.id===s.id);if(!o)return;
  // One undo checkpoint for this editing session, not one per brush move.
  if(!s.checkpointed){checkpoint();s.checkpointed=true}
  (state.pikadoProjects??={})[s.id]={pkd:m.pkd,preview:m.preview,inputSrc:s.src,sourceLayerId:m.sourceLayerId,width:m.width,height:m.height};
  if(o.variant==='ps')o.src=m.preview;
  update();s.status.textContent='已回传画布 · 工程随桌面保存';
 }
 if(m.type==='flushed'&&s.closing)closePikado(s);
});
function closePikado(session){
 if(session.exiting)return;
 session.exiting=true;
 clearTimeout(session.loadTimer);clearTimeout(session.flushTimer);
 function finish(){
  if(pikaSession!==session)return;
  session.panel.remove();document.body.classList.remove('pikado-editing');pikaSession=null;
  $$('[data-workspace-region]').forEach(element=>element.inert=false);
  renderCamera();focusCanvasObject(session.id);
 }
 if(window.matchMedia('(prefers-reduced-motion: reduce)').matches){finish();return}
 session.panel.classList.add('editor-exiting');
 session.panel.addEventListener('animationend',event=>{if(event.target===session.panel&&event.animationName==='ps-workspace-exit')finish()});
 setTimeout(finish,260);
}
const pikaBaseOpen=openObject;
openObject=function(id){const o=state.objects.find(o=>o.id===id);if(o?.kind==='ps'){openPikado(id);return}if(o?.variant==='ps'&&o.src){modal('PS · 照片预览',`<img class="projectpreview" src="${esc(o.src)}" alt="PS 输出预览"><button class="primary" data-pikado="${esc(id)}">进入 Pikado 编辑</button>`);return}pikaBaseOpen(id)};
document.addEventListener('click',e=>{const b=e.target.closest('[data-pikado]');if(b)openPikado(b.dataset.pikado)});
const pikaBaseZone=zoneHTML;
zoneHTML=function(o){if(o.kind==='ps')return '<p>导入素材，在 Pikado 中进行图层编辑。</p><button data-pikado="zone-ps">打开 Pikado 工作台</button><small>可保存独立工程，也可以从照片连接 PS 子台。</small>';return pikaBaseZone(o)};
render();

new MutationObserver(()=>{if(pikaSession?.ready)pikaSession.frame.contentWindow.postMessage({channel:'framelab-pikado',type:'theme',theme:state.theme},location.origin)}).observe(document.body,{attributes:true,attributeFilter:['class']});
