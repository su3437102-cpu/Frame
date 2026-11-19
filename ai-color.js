// Browser AdaInt inference. Originals are never modified.
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
function aiStatus(o){const job=aiJobs.get(o.id);return job?.status||(!aiInput(o)?.src?'等待连接':o.src?'已完成':'等待调色')}
const aiHTML=objectHTML;objectHTML=function(o){if(o.variant!=='ai')return aiHTML(o);return `<div class="inner ps-node ai-node"><div class="ps-title">AI 调色 <span>${esc(aiStatus(o))}</span></div>${o.src?`<img src="${esc(o.src)}" alt="调色结果" draggable="false">`:`<div class="ps-empty">${esc(aiInput(o)?.src?(aiJobs.get(o.id)?.error||aiStatus(o)):'将照片连接到这里')}</div>`}<small>双击调整${o.aiWorkbench||o.gradeEdit?'':' · AdaInt · '+Math.round((o.aiStrength??.6)*100)+'%'}</small></div>`};
async function aiDataURL(src){const response=await fetch(src);if(!response.ok)throw new Error('无法读取输入照片');const blob=await response.blob();return new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=reject;reader.readAsDataURL(blob)})}
async function runAI(o){const source=aiInput(o)?.src;if(!source||aiBusy)return;const strength=o.aiStrength??.6,job={source,strength,status:'正在调色',controller:new AbortController()};aiJobs.set(o.id,job);aiBusy=true;render();
 try{const data=await enhanceInBrowser(source,strength,job.controller.signal,status=>{job.status=status;render()});
 if(!state.objects.includes(o)||aiInput(o)?.src!==source||(o.aiStrength??.6)!==strength||aiJobs.get(o.id)!==job||o.gradeEdit)return;
 o.src=data.src;o.aiInput=source;o.aiAppliedStrength=strength;o.h=(o.w-24)*data.height/data.width+80;job.status='已完成';save();
 }catch(error){job.status=error.name==='AbortError'?'已停止':'调色失败';job.error=error.name==='AbortError'?'已停止，可重新计算':error.message}
 finally{aiBusy=false;render()}
}
function reconcileAI() {
  let cleared = false;
  for (const node of state.objects.filter(object => object.variant === 'ai')) {
    const source = aiInput(node)?.src;
    if (!source || ((node.aiWorkbench || node.gradeEdit) && node.aiInput && node.aiInput !== source)) {
      if (node.src || node.gradeEdit) {
        node.src = '';
        node.aiInput = '';
        delete node.gradeEdit;
        cleared = true;
      }
      aiJobs.get(node.id)?.controller.abort();
      aiJobs.delete(node.id);
    }
    if (!source || node.aiWorkbench || node.gradeEdit) continue;
    const strength = node.aiStrength ?? .6;
    if (node.aiInput === source && node.aiAppliedStrength === strength) continue;
    const previous = aiJobs.get(node.id);
    if (!aiBusy && (previous?.source !== source || previous.strength !== strength)) runAI(node);
  }
  if (cleared) { save(); render(); }
}
const aiRender=render;render=function(){aiRender();setTimeout(reconcileAI,0)};
async function openAI(id) {
  const node = state.objects.find(object => object.id === id);
  if (!node) return;
  const input = aiInput(node);
  const source = input?.src;
  const previous = node.aiInput === source ? node.src : '';
  const job = aiJobs.get(id);
  if (job && ['正在调色','正在加载模型'].includes(job.status)) job.controller.abort();
  aiJobs.delete(id);
  node.aiWorkbench = true;
  try {
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
        const src = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result);
          reader.onerror = () => reject(new Error('无法保存调色结果'));
          reader.readAsDataURL(blob);
        });
        if (!state.objects.includes(node) || aiInput(node)?.src !== source) throw new Error('连接的照片已改变，请重新打开工作台');
        checkpoint();
        node.src = src;
        node.aiInput = source;
        node.gradeEdit = edit.base === 'legacy' ? {...edit,base:'auto'} : edit;
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
const aiOpen=openObject;openObject=function(id){if(state.objects.find(o=>o.id===id)?.variant==='ai')return openAI(id);aiOpen(id)};
const aiContext=handleContext;handleContext=function(action){const o=state.objects.find(o=>selected.has(o.id));if(action==='to-ai'&&o){const node=createAINode({x:o.x+o.w+80,y:o.y});connectAI(o.id,node.id);return}if(action==='ai-edit'&&o)return openAI(o.id);aiContext(action)};
render();
