// FrameLab color workbenches keep the input photo separate from their output.
paths.ai='M4 4h16v16H4Z M7 15l3-6 3 6m-5-2h4 M16 9v6';
$('#tools').insertAdjacentHTML('beforeend',`<button class="palette-tool" data-tool="ai" title="拖到画布创建 AI 调色" aria-pressed="false"><i class="tool-glyph">${icon('ai')}</i><span>AI 调色</span></button>`);
function createAINode(p){checkpoint();const o={id:crypto.randomUUID(),type:'image',variant:'ai',name:'AI 调色',parentBoardId:state.activeBoardId||null,x:p?.x??100,y:p?.y??100,w:280,h:220,r:0,z:Math.max(0,...state.objects.map(o=>o.z||0))+1,src:'',aiStrength:.6,aiWorkbench:true};state.objects.push(o);selected=new Set([o.id]);update();return o}
const aiCreateTool=createTool;createTool=function(type,p){return type==='ai'?createAINode(p):aiCreateTool(type,p)};
const aiPalettePreview=palettePreview;palettePreview=function(type){return type==='ai'?{w:280,h:220,html:objectHTML({variant:'ai',src:''})}:aiPalettePreview(type)};
function aiInput(o){const edge=(state.connections||[]).filter(e=>e.to===o.id).at(-1);return state.objects.find(s=>s.id===edge?.from)}
function connectAI(fromId,toId){let from=state.objects.find(o=>o.id===fromId),to=state.objects.find(o=>o.id===toId);if(from?.variant!=='ai'&&to?.variant!=='ai')return false;
 if(from?.variant==='ai'&&to?.variant==='ps')return false;
 if(from?.variant==='ai'&&to?.variant!=='ai')[from,to]=[to,from];
 if(from?.type!=='image'||to?.variant!=='ai'||from.id===to.id){toast('请把照片连接到 AI 调色子台');return true}
 const stack=[to.id],seen=new Set();while(stack.length){const id=stack.pop();if(id===from.id){toast('不能连接成循环');return true}if(seen.has(id))continue;seen.add(id);(state.connections||[]).filter(e=>e.from===id).forEach(e=>stack.push(e.to))}
 checkpoint();state.connections=(state.connections||[]).filter(e=>e.to!==to.id);state.connections.push({id:crypto.randomUUID(),from:from.id,to:to.id,bend:0,kind:'ai-input'});update();return true}
const aiFinish=finishConnection;finishConnection=function(target){if(connecting?.from&&target&&connectAI(connecting.from,target)){cancelConnection();return}aiFinish(target)};
const aiJobs=new Map();let aiBusy=false;
function aiStatus(o){const job=aiJobs.get(o.id);return job?.status||(o.src?'已完成':aiInput(o)?.src?'等待调色':'等待连接')}
const aiHTML=objectHTML;objectHTML=function(o){if(o.variant!=='ai')return aiHTML(o);return `<div class="inner ps-node ai-node"><div class="ps-title">AI 调色 <span>${esc(aiStatus(o))}</span></div>${o.src?`<img src="${esc(o.src)}" alt="调色结果" draggable="false">`:`<div class="ps-empty">${esc(aiInput(o)?.src?(aiJobs.get(o.id)?.error||aiStatus(o)):'连接照片，或双击打开调色')}</div>`}<small>双击调整${o.aiWorkbench||o.gradeEdit||o.colorBoardEdit?'':' · AdaInt · '+Math.round((o.aiStrength??.6)*100)+'%'}</small></div>`};
function aiBlobDataURL(blob){
  return new Promise((resolve,reject)=>{
    const reader=new FileReader();
    reader.onload=()=>resolve(reader.result);
    reader.onerror=()=>reject(new Error('无法读取调色结果'));
    reader.readAsDataURL(blob);
  });
}
async function runAI(o){const source=aiInput(o)?.src;if(!source||aiBusy)return;const strength=o.aiStrength??.6,job={source,strength,status:'正在调色',controller:new AbortController()};aiJobs.set(o.id,job);aiBusy=true;render();
 try{const data=await enhanceInBrowser(source,strength,job.controller.signal,status=>{job.status=status;render()});
 if(!state.objects.includes(o)||aiInput(o)?.src!==source||(o.aiStrength??.6)!==strength||aiJobs.get(o.id)!==job||o.gradeEdit||o.colorBoardEdit)return;
 o.src=data.src;o.aiInput=source;o.aiAppliedStrength=strength;o.h=(o.w-24)*data.height/data.width+80;job.status='已完成';save();
 }catch(error){job.status=error.name==='AbortError'?'已停止':'调色失败';job.error=error.name==='AbortError'?'已停止，可重新计算':error.message}
 finally{aiBusy=false;render()}
}
function reconcileAI() {
  let cleared = false;
  for (const node of state.objects.filter(object => object.variant === 'ai')) {
    const source = aiInput(node)?.src || '';
    const savedInput = node.aiInput || '';
    const sourceChanged = node.colorBoardEdit ? savedInput !== source : !source || ((node.aiWorkbench || node.gradeEdit) && savedInput && savedInput !== source);
    if (sourceChanged) {
      if (node.src || node.gradeEdit || node.colorBoardEdit) {
        node.src = '';
        node.aiInput = '';
        delete node.gradeEdit;
        delete node.colorBoardEdit;
        delete node.aiEditor;
        cleared = true;
      }
      aiJobs.get(node.id)?.controller.abort();
      aiJobs.delete(node.id);
    }
    if (!source || node.aiWorkbench || node.gradeEdit || node.colorBoardEdit) continue;
    const strength = node.aiStrength ?? .6;
    if (node.aiInput === source && node.aiAppliedStrength === strength) continue;
    const previous = aiJobs.get(node.id);
    if (!aiBusy && (previous?.source !== source || previous.strength !== strength)) runAI(node);
  }
  if (cleared) { save(); render(); }
}
const aiRender=render;render=function(){aiRender();setTimeout(reconcileAI,0)};
async function openAI(id, mode) {
  const node = state.objects.find(object => object.id === id);
  if (!node || colorBoardSession || $('#grade-workbench')?.open) return;
  const input = aiInput(node);
  const source = input?.src || '';
  const hasAdvanced = node.aiEditor==='advanced'||(node.colorBoardEdit&&node.aiEditor!=='basic');
  const useBasic = mode==='basic'||(mode!=='advanced'&&(node.aiEditor==='basic'||(!hasAdvanced&&node.gradeEdit)));
  const job = aiJobs.get(id);
  if (job && ['正在调色','正在加载模型'].includes(job.status)) job.controller.abort();
  aiJobs.delete(id);
  node.aiWorkbench = true;
  try {
    if(!useBasic){openColorBoard(node,input,source);return;}
    const previous = !hasAdvanced&&node.aiInput === source ? node.src : '';
    const {openGradeWorkbench} = await import('./ai-web/grade-workbench.mjs');
    await openGradeWorkbench({
      source,
      name: input && objectName(input),
      saved: node.gradeEdit,
      savedPreview: previous,
      legacyPreview: node.gradeEdit ? '' : previous,
      autoStrength: node.aiStrength,
      async enhance(strength, signal, onStatus) {
        if (aiBusy) throw new Error('另一张照片正在调色，请稍后重试');
        aiBusy = true;
        try { return await enhanceInBrowser(source, strength, signal, onStatus); }
        finally { aiBusy = false; setTimeout(reconcileAI, 0); }
      },
      async save(edit, blob, {width, height}) {
        const src = await aiBlobDataURL(blob);
        if (!state.objects.includes(node) || (aiInput(node)?.src || '') !== source) throw new Error('连接的照片已改变，请重新打开工作台');
        checkpoint();
        node.src = src;
        node.aiInput = source;
        node.gradeEdit = edit.base === 'legacy' ? {...edit,base:'auto'} : edit;
        node.aiEditor = 'basic';
        node.h = Math.max(80, (node.w - 24) * height / width + 70);
        update();
      },
      download(blob) {
        download(URL.createObjectURL(blob), `${input && objectName(input) || 'AI-color'}-调色.jpg`, true);
      },
    });
  } catch (error) {
    toast(error.message || '无法打开调色工作台');
  }
}
const colorBoardChannel = 'framelab-colorboard';
const colorBoardProjectMime = 'application/x-colorboard';
const colorBoardProjectLimit = 3 * 1024 * 1024;
const colorBoardPreviewLimit = 2 * 1024 * 1024;
const colorBoardProjectPrefix = `data:${colorBoardProjectMime};base64,`;
let colorBoardSession = null;

function colorBoardSource(source) {
  if (!source || /^data:image\/(?:jpeg|png|webp|gif);base64,/i.test(source)) return source;
  const url = new URL(source,location.href);
  if (url.origin !== location.origin) throw new Error('无法读取这个照片来源');
  return url.href;
}

function sendColorBoard(session, type, payload={}) {
  session.frame.contentWindow?.postMessage({channel:colorBoardChannel,type,session:session.token,...payload},location.origin);
}

function openColorBoard(node,input,source) {
  if(!/^https?:$/.test(location.protocol))throw new Error('请通过本地网站或公网打开调色工作台');
  const resolvedSource=colorBoardSource(source);
  const project=(node.aiInput||'')===source?node.colorBoardEdit||null:null;
  if(project && (typeof project!=='string'||!project.startsWith(colorBoardProjectPrefix)||project.length>colorBoardProjectPrefix.length+Math.ceil(colorBoardProjectLimit/3)*4)){
    throw new Error('无法读取已保存的进阶调色工程');
  }
  const modal=document.createElement('dialog');
  modal.id='colorboard-workbench';
  modal.setAttribute('aria-label','AI 调色工作台');
  modal.innerHTML=`<div class="colorboard-state"><p role="status">正在打开调色工作台…</p><div><button type="button" data-colorboard-back>返回画布</button><button type="button" data-colorboard-basic>基础调色</button></div></div><iframe class="colorboard-frame" title="进阶调色工作台" aria-hidden="true" tabindex="-1" inert></iframe>`;
  const frame=modal.querySelector('iframe'),loading=modal.querySelector('.colorboard-state'),status=loading.querySelector('[role="status"]');
  if(dialog.open)dialog.close();
  const session={modal,frame,loading,status,node,inputId:input?.id,source,token:crypto.randomUUID(),
    initial:{source:resolvedSource,name:input?objectName(input):'',project,theme:state.theme}};
  colorBoardSession=session;
  modal.addEventListener('keydown',event=>event.stopPropagation());
  modal.addEventListener('cancel',event=>{event.preventDefault();if(!session.opened)closeColorBoard(session);});
  modal.querySelector('[data-colorboard-back]').onclick=()=>closeColorBoard(session);
  modal.querySelector('[data-colorboard-basic]').onclick=()=>closeColorBoard(session,'basic');
  document.body.append(modal);
  modal.showModal();
  frame.src='ai-web/colorboard/index.html?framelab=1';
  session.loadTimer=setTimeout(()=>{if(colorBoardSession===session&&!session.opened)status.textContent='工作台尚在加载，可以返回画布后重试。';},20000);
}

function closeColorBoard(session,mode) {
  if(colorBoardSession!==session)return;
  clearTimeout(session.loadTimer);
  colorBoardSession=null;
  session.modal.close();
  session.modal.remove();
  if(mode==='basic')openAI(session.node.id,'basic');
  else focusCanvasObject(session.node.id);
}

async function saveColorBoard(session, {preview,project,width,height}) {
  if(session.saving)return;
  if(!(preview instanceof Blob)||preview.type!=='image/jpeg'||!preview.size||preview.size>colorBoardPreviewLimit||
    !(project instanceof Blob)||project.type!==colorBoardProjectMime||!project.size||project.size>colorBoardProjectLimit||
    ![width,height].every(size=>Number.isInteger(size)&&size>0&&size<=1400)){
    sendColorBoard(session,'error',{message:'未能保存，工作台传回了不支持的结果。'});return;
  }
  session.saving=true;
  try {
    const input=aiInput(session.node);
    if(!state.objects.includes(session.node)||input?.id!==session.inputId||(input?.src||'')!==session.source){
      throw new Error('连接的照片已改变，请重新打开工作台');
    }
    const bytes=new Uint8Array(await project.slice(0,2).arrayBuffer());
    if(bytes[0]!==0x1f||bytes[1]!==0x8b)throw new Error('无法读取调色工程数据');
    const image=await createImageBitmap(preview);
    const correctSize=image.width===width&&image.height===height;
    image.close();
    if(!correctSize)throw new Error('未能保存，预览尺寸与调色结果不一致');
    const [src,edit]=await Promise.all([aiBlobDataURL(preview),aiBlobDataURL(project)]);
    if(colorBoardSession!==session)return;
    const current=aiInput(session.node);
    if(!state.objects.includes(session.node)||current?.id!==session.inputId||(current?.src||'')!==session.source){
      throw new Error('连接的照片已改变，请重新打开工作台');
    }
    checkpoint();
    Object.assign(session.node,{src,colorBoardEdit:edit,aiEditor:'advanced',aiInput:session.source,
      h:Math.max(80,(session.node.w-24)*height/width+80)});
    update();
    sendColorBoard(session,'saved');
    closeColorBoard(session);
    toast('调色已保存到画布');
  } catch(error) {
    if(colorBoardSession===session)sendColorBoard(session,'error',{message:error.message||'无法保存调色结果'});
  } finally {session.saving=false;}
}

window.addEventListener('message',event=>{
  const session=colorBoardSession,message=event.data;
  if(!session||event.origin!==location.origin||event.source!==session.frame.contentWindow||message?.channel!==colorBoardChannel)return;
  if(message.type==='ready'&&!session.sent){
    session.sent=true;
    sendColorBoard(session,'open',session.initial);
    return;
  }
  if(message.session!==session.token)return;
  if(message.type==='opened'){
    clearTimeout(session.loadTimer);
    session.opened=true;
    session.loading.hidden=true;
    session.frame.inert=false;
    session.frame.removeAttribute('aria-hidden');
    session.frame.removeAttribute('tabindex');
    session.frame.focus();
  }
  if(message.type==='error'&&!session.opened){
    clearTimeout(session.loadTimer);
    session.status.textContent=typeof message.message==='string'?message.message.slice(0,160):'无法打开调色工作台';
  }
  if(!session.opened||session.saving)return;
  if(message.type==='save')void saveColorBoard(session,message);
  if(message.type==='close')closeColorBoard(session);
  if(message.type==='basic')closeColorBoard(session,'basic');
});

const aiOpen=openObject;openObject=function(id){if(state.objects.find(o=>o.id===id)?.variant==='ai')return openAI(id);aiOpen(id)};
const aiContext=handleContext;handleContext=function(action){const o=state.objects.find(o=>selected.has(o.id));if(action==='to-ai'&&o){const node=createAINode({x:o.x+o.w+80,y:o.y});connectAI(o.id,node.id);return}if(action==='ai-edit'&&o)return openAI(o.id);if(action==='ai-basic'&&o)return openAI(o.id,'basic');if(action==='ai-advanced'&&o)return openAI(o.id,'advanced');aiContext(action)};
render();
