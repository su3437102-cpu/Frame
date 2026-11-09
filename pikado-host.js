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
 if(dialog.open)dialog.close();
 const panel=document.createElement('section');panel.id='pikadoPanel';panel.setAttribute('aria-label','Pikado 图像编辑器');
 if(rect)panel.style.transformOrigin=Math.max(0,Math.min(innerWidth,rect.x+rect.width/2))+'px '+Math.max(0,Math.min(innerHeight,rect.y+rect.height/2))+'px';
 panel.innerHTML='<header><strong>FrameLab / PS</strong><span role="status">正在加载编辑器…</span><button type="button">保存并返回画布</button></header><iframe title="Pikado 图层编辑器" src="editor/index.html" allow="clipboard-read; clipboard-write"></iframe>';
 document.body.append(panel);document.body.classList.add('pikado-editing');renderCamera();
 const frame=panel.querySelector('iframe'),status=panel.querySelector('[role=status]'),button=panel.querySelector('button');
 pikaSession={id,token:crypto.randomUUID(),panel,frame,status,src,ready:false,closing:false};
 pikaSession.initial={theme:state.theme,src:src?new URL(src,location.href).href:null,pkd:record?.pkd,sourceLayerId:record?.sourceLayerId,replaceSource:!!record&&record.inputSrc!==src,name:o.name};
 button.onclick=()=>{if(!pikaSession.ready){toast('编辑器仍在加载，请稍候');return}pikaSession.closing=true;status.textContent='正在保存工程…';frame.contentWindow.postMessage({channel:'framelab-pikado',type:'flush'},location.origin)};
}
window.addEventListener('message',e=>{
 const s=pikaSession,m=e.data;if(!s||e.origin!==location.origin||e.source!==s.frame.contentWindow||m?.channel!=='framelab-pikado')return;
 if(m.type==='ready'){s.frame.contentWindow.postMessage({channel:'framelab-pikado',type:'open',session:s.token,...s.initial},location.origin);return}
 if(m.session!==s.token)return;
 if(m.type==='opened'){s.panel.classList.add('editor-ready');s.ready=true;s.status.textContent='编辑会自动回传画布';return}
 if(m.type==='error'){s.closing=false;s.ready=true;s.status.textContent='未保存：'+String(m.message).slice(0,160);return}
 if(m.type==='result'){
  if(typeof m.preview!=='string'||!/^data:image\/png;base64,[a-z0-9+/=]+$/i.test(m.preview)||typeof m.pkd!=='string'||!/^data:application\/x-pikado;base64,[a-z0-9+/=]+$/i.test(m.pkd))return;
  const o=state.objects.find(o=>o.id===s.id);if(!o)return;
  // One undo checkpoint for this editing session, not one per brush move.
  if(!s.checkpointed){checkpoint();s.checkpointed=true}
  (state.pikadoProjects??={})[s.id]={pkd:m.pkd,preview:m.preview,inputSrc:s.src,sourceLayerId:m.sourceLayerId,width:m.width,height:m.height};
  if(o.variant==='ps')o.src=m.preview;
  update();s.status.textContent='已回传画布 · 工程随桌面保存';
 }
 if(m.type==='flushed'&&s.closing){s.panel.remove();document.body.classList.remove('pikado-editing');pikaSession=null;renderCamera()}
});
const pikaBaseOpen=openObject;
openObject=function(id){const o=state.objects.find(o=>o.id===id);if(o?.kind==='ps'){openPikado(id);return}if(o?.variant==='ps'&&o.src){modal('PS · 照片预览',`<img class="projectpreview" src="${esc(o.src)}" alt="PS 输出预览"><button class="primary" data-pikado="${esc(id)}">进入 Pikado 编辑</button>`);return}pikaBaseOpen(id)};
document.addEventListener('click',e=>{const b=e.target.closest('[data-pikado]');if(b)openPikado(b.dataset.pikado)});
const pikaBaseZone=zoneHTML;
zoneHTML=function(o){if(o.kind==='ps')return '<p>导入素材，在 Pikado 中进行图层编辑。</p><button data-pikado="zone-ps">打开 PS 母台</button><small>子台与母台使用同一个编辑器，各自保留工程。</small>';return pikaBaseZone(o)};
render();

new MutationObserver(()=>{if(pikaSession?.ready)pikaSession.frame.contentWindow.postMessage({channel:'framelab-pikado',type:'theme',theme:state.theme},location.origin)}).observe(document.body,{attributes:true,attributeFilter:['class']});
