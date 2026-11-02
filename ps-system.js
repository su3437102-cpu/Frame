// PS project shell. Editor integration is deliberately explicit, not simulated.
function psProjects(){return state.psProjects??={}}
function createPSNode(p){
 const inputs=state.objects.filter(o=>selected.has(o.id)&&o.type==='image');
 if(!inputs.length){toast('先选中一张或多张照片，再拖入 PS');return}
 checkpoint();const id=crypto.randomUUID(),first=inputs[0];
 const project={id,name:'PS 工程',version:1,revision:0,width:first.w,height:first.h,layers:inputs.map(o=>({id:crypto.randomUUID(),sourceId:o.id,src:o.src,name:o.name,visible:true,opacity:1,transform:{x:0,y:0,scale:1},mask:null})),preview:first.src,editorDocument:null};
 psProjects()[id]=project;
 const node={id:crypto.randomUUID(),type:'image',variant:'ps',projectId:id,name:'PS 子台',src:first.src,x:p?.x??first.x+first.w+80,y:p?.y??first.y,w:280,h:220,r:0,z:Math.max(0,...state.objects.map(o=>o.z||0))+1};
 state.objects.push(node);state.connections??=[];inputs.forEach(o=>state.connections.push({id:crypto.randomUUID(),from:o.id,to:node.id,bend:0,kind:'ps-input'}));selected=new Set([node.id]);update();composePS(project);
}
async function composePS(project){
 const revision=++project.revision;
 const layers=await Promise.all(project.layers.map(l=>new Promise(resolve=>{const img=new Image();img.onload=()=>resolve({l,img});img.onerror=()=>resolve(null);img.src=l.src})));
 if(psProjects()[project.id]!==project||project.revision!==revision||!layers[0])return;
 const canvas=document.createElement('canvas');canvas.width=Math.min(1200,layers[0].img.naturalWidth);canvas.height=Math.round(canvas.width*project.height/project.width);const ctx=canvas.getContext('2d');
 for(const item of layers){if(!item||!item.l.visible)continue;const {l,img}=item,scale=Math.min(canvas.width/img.width,canvas.height/img.height);ctx.globalAlpha=l.opacity;ctx.drawImage(img,(canvas.width-img.width*scale)/2,(canvas.height-img.height*scale)/2,img.width*scale,img.height*scale)}
 project.preview=canvas.toDataURL('image/png');state.objects.filter(o=>o.projectId===project.id).forEach(o=>o.src=project.preview);update();
}
const psBaseHTML=objectHTML;
objectHTML=function(o){if(o.variant==='ps'){const p=psProjects()[o.projectId];return `<div class="inner ps-node"><div class="ps-title">PS <span>${p?.layers.length||0} 个输入图层</span></div><img src="${esc(o.src)}" alt="PS 工程合成预览" draggable="false"><small>双击预览 · 进入编辑</small></div>`}return psBaseHTML(o)};
const psBaseOpen=openObject;
openObject=function(id){const o=state.objects.find(x=>x.id===id);if(o?.projectId){modal('PS 工程预览',`<img class="projectpreview" src="${esc(o.src)}" alt="合成结果"><button class="primary" data-ps-edit="${esc(o.projectId)}">进入编辑</button>`);return}if(o?.kind==='ps'){openPSLibrary();return}psBaseOpen(id)};
function openPSLibrary(){modal('PS 母台 · 工程库',`<p class="dialogcopy">各子台工程独立保存。选择照片后拖入侧栏 PS 创建工程。</p>${Object.values(psProjects()).map(p=>`<button class="listrow" data-ps-edit="${esc(p.id)}"><img src="${esc(p.preview)}" alt=""><span>${esc(p.name)}</span><small>${p.layers.length} 图层</small></button>`).join('')||'<p>暂无工程</p>'}`)}
function openPSEditor(id){const p=psProjects()[id];if(!p)return;if(dialog.open)dialog.close();document.querySelector('#psEditor')?.remove();const panel=document.createElement('aside');panel.id='psEditor';panel.setAttribute('aria-label','PS 编辑工作区');panel.innerHTML=`<header><strong>${esc(p.name)}</strong><button id="psClose" aria-label="关闭编辑工作区">×</button></header><img src="${esc(p.preview)}" alt="当前工程预览"><p>完整图像编辑器待接入</p><p class="ps-muted">工程与多图层输入已建立。图层、蒙版、钢笔等编辑工具将在接入开源编辑器后提供。</p><h3>输入图层</h3>${[...p.layers].reverse().map(l=>`<div class="ps-layer"><img src="${esc(l.src)}" alt=""><span>${esc(l.name)}</span></div>`).join('')}`;document.body.append(panel);document.body.classList.add('ps-editing');renderCamera();panel.querySelector('#psClose').onclick=()=>{panel.remove();document.body.classList.remove('ps-editing');renderCamera()};}
document.addEventListener('click',e=>{const b=e.target.closest('[data-ps-edit]');if(b)openPSEditor(b.dataset.psEdit)});
const psDelete=actions.delete;
actions.delete=()=>{const nodes=state.objects.filter(o=>selected.has(o.id)&&o.variant==='ps');if(!nodes.length)return psDelete();checkpoint();const frozen=new Set(nodes.map(o=>o.id));for(const o of nodes){delete o.variant;o.frozen=true;const p=psProjects()[o.projectId];if(p)p.layers.forEach(l=>{l.sourceId=null})}state.connections=(state.connections||[]).filter(e=>!frozen.has(e.to));const removed=state.objects.filter(o=>selected.has(o.id)&&!frozen.has(o.id));state.trash.push(...removed);state.objects=state.objects.filter(o=>!removed.includes(o));selected.clear();update();toast('子台已转为结果照片，工程仍保留在母台');};
// Adapter contract for a future editor: commit a rendered preview and its editable document.
window.FrameLabPS={commit(id,{preview,document:doc}){const p=psProjects()[id];if(!p)throw Error('工程不存在');if(!/^data:image\/(png|jpeg|webp);base64,/.test(preview))throw Error('预览格式不支持');checkpoint();p.editorDocument=doc;p.needsEditorRender=false;p.preview=preview;p.revision++;state.objects.filter(o=>o.projectId===id).forEach(o=>o.src=preview);update();},open:openPSEditor};
render();
// Copies own their editable project, rather than sharing another node's document.
const psDuplicate=actions.duplicate;
actions.duplicate=()=>{
 psDuplicate();
 for(const o of state.objects.filter(o=>selected.has(o.id)&&o.projectId)){
  const original=psProjects()[o.projectId];if(!original)continue;
  const p=structuredClone(original);p.id=crypto.randomUUID();p.name+=' 副本';p.revision=0;
  psProjects()[p.id]=p;o.projectId=p.id;
  if(o.variant==='ps')for(const l of p.layers)if(l.sourceId)(state.connections??=[]).push({id:crypto.randomUUID(),from:l.sourceId,to:o.id,bend:0,kind:'ps-input'});
 }
 update();
};
const psLibraryBase=openPSLibrary;
openPSLibrary=function(){
 psLibraryBase();const button=document.createElement('button');button.className='primary';button.textContent='导入图片建立工程';
 button.onclick=()=>{const input=document.createElement('input');input.type='file';input.accept='image/png,image/jpeg,image/webp';input.multiple=true;
 input.onchange=async()=>{try{
  const layers=await Promise.all([...input.files].map(file=>new Promise((resolve,reject)=>{const r=new FileReader();r.onerror=reject;r.onload=()=>resolve({id:crypto.randomUUID(),sourceId:null,src:r.result,name:file.name,visible:true,opacity:1,transform:{x:0,y:0,scale:1},mask:null});r.readAsDataURL(file)})));
  if(!layers.length)return;checkpoint();const id=crypto.randomUUID();const p={id,name:layers[0].name+' 工程',version:1,revision:0,width:1000,height:1000,layers,preview:layers[0].src,editorDocument:null};
  psProjects()[id]=p;save();openPSEditor(id);
 }catch{toast('导入失败，请重新选择图片')}};input.click()};document.querySelector('#dialogbody').append(button);
};
const psBaseUpdate=update;
update=function(){psBaseUpdate();for(const p of Object.values(psProjects())){let changed=false;for(const l of p.layers){const source=l.sourceId&&state.objects.find(o=>o.id===l.sourceId);if(source&&source.src!==l.src){l.src=source.src;changed=true}}if(changed){if(p.editorDocument){p.needsEditorRender=true;window.dispatchEvent(new CustomEvent('framelab:ps-input-change',{detail:{projectId:p.id,layers:structuredClone(p.layers)}}));save()}else composePS(p)}}};
