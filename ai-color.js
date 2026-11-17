// Real local AdaInt inference. Originals are never modified.
paths.ai='M4 4h16v16H4Z M7 15l3-6 3 6m-5-2h4 M16 9v6';
$('#tools').insertAdjacentHTML('beforeend',`<button class="palette-tool" data-tool="ai" title="拖到画布创建 AI 调色" aria-pressed="false"><i class="tool-glyph">${icon('ai')}</i><span>AI 调色</span></button>`);
function createAINode(p){checkpoint();const o={id:crypto.randomUUID(),type:'image',variant:'ai',name:'AI 调色',parentBoardId:state.activeBoardId||null,x:p?.x??100,y:p?.y??100,w:280,h:220,r:0,z:Math.max(0,...state.objects.map(o=>o.z||0))+1,src:'',aiStrength:.6};state.objects.push(o);selected=new Set([o.id]);update();return o}
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
const aiHTML=objectHTML;objectHTML=function(o){if(o.variant!=='ai')return aiHTML(o);return `<div class="inner ps-node ai-node"><div class="ps-title">AI 调色 <span>${esc(aiStatus(o))}</span></div>${o.src?`<img src="${esc(o.src)}" alt="AdaInt 调色结果" draggable="false">`:'<div class="ps-empty">将照片连接到这里</div>'}<small>双击调整 · AdaInt · ${Math.round((o.aiStrength??.6)*100)}%</small></div>`};
async function aiDataURL(src){const response=await fetch(src);if(!response.ok)throw new Error('无法读取输入照片');const blob=await response.blob();return new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=reject;reader.readAsDataURL(blob)})}
async function runAI(o){const source=aiInput(o)?.src;if(!source||aiBusy)return;const strength=o.aiStrength??.6,job={source,strength,status:'正在调色',controller:new AbortController()};aiJobs.set(o.id,job);aiBusy=true;render();if(dialog.open&&dialog.dataset.aiId===o.id)openAI(o.id);
 try{if(!/^(localhost|127\.0\.0\.1|192\.168\.|10\.|172\.(1[6-9]|2\d|3[01])\.)/.test(location.hostname))throw new Error('当前版本在本机或局域网运行，请打开局域网工作台');
 const image=await aiDataURL(source);const response=await fetch('/api/ai-color',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({image,strength}),signal:job.controller.signal});const data=await response.json();if(!response.ok||!data.src)throw new Error(data.error||'调色失败，请重试');
 if(!state.objects.includes(o)||aiInput(o)?.src!==source||(o.aiStrength??.6)!==strength||aiJobs.get(o.id)!==job)return;
 o.src=data.src;o.aiInput=source;o.aiAppliedStrength=strength;o.h=(o.w-24)*data.height/data.width+80;job.status='已完成';save();
 }catch(error){job.status=error.name==='AbortError'?'已停止':'调色失败';job.error=error.name==='AbortError'?'已停止，可重新计算':error.message}
 finally{aiBusy=false;render();if(dialog.open&&dialog.dataset.aiId===o.id)openAI(o.id)}
}
function reconcileAI(){let cleared=false;for(const o of state.objects.filter(o=>o.variant==='ai')){const src=aiInput(o)?.src;if(!src){if(o.src){o.src='';o.aiInput='';cleared=true;save()}aiJobs.get(o.id)?.controller?.abort();aiJobs.delete(o.id);continue}if(o.aiInput===src&&o.aiAppliedStrength===(o.aiStrength??.6))continue;const previous=aiJobs.get(o.id);if(previous?.source===src&&previous.strength===(o.aiStrength??.6))continue;if(!aiBusy){runAI(o);break}}if(cleared)render()}
const aiRender=render;render=function(){aiRender();setTimeout(reconcileAI,0)};
function openAI(id){const o=state.objects.find(o=>o.id===id);if(!o)return;const source=aiInput(o)?.src,job=aiJobs.get(id),busy=job?.status==='正在调色';modal('AI 调色',`${o.src||source?`<img class="projectpreview" src="${esc(o.src||source)}" alt="调色预览">`:''}<p class="dialogcopy" role="status">${esc(job?.error||aiStatus(o))} · 本机处理 · 预览最长边 1600px</p><label class="field">调色强度 <output id="aiAmount">${Math.round((o.aiStrength??.6)*100)}%</output><input id="aiStrength" aria-label="调色强度" type="range" min="0" max="100" value="${Math.round((o.aiStrength??.6)*100)}"></label><div class="dialogactions"><button id="aiRun" class="primary" ${!source||aiBusy?'disabled':''}>重新计算</button><button id="aiCompare" ${!source?'disabled':''}>查看原图</button><button id="aiStop" ${!busy?'disabled':''}>停止</button><button id="aiDownload" ${!o.src?'disabled':''}>保存结果</button></div>`);dialog.dataset.aiId=id;
 $('#aiStrength').oninput=e=>$('#aiAmount').textContent=e.target.value+'%';$('#aiStrength').onchange=e=>{checkpoint();o.aiStrength=Number(e.target.value)/100;aiJobs.delete(id);update();openAI(id)};
 $('#aiRun').onclick=()=>{aiJobs.delete(id);runAI(o)};$('#aiStop').onclick=()=>job?.controller.abort();let original=false;$('#aiCompare').onclick=()=>{original=!original;dialog.querySelector('img').src=original?source:o.src||source;$('#aiCompare').textContent=original?'查看调色':'查看原图'};$('#aiDownload').onclick=()=>download(o.src,'AI-color.jpg')}
dialog.addEventListener('close',()=>delete dialog.dataset.aiId);
const aiOpen=openObject;openObject=function(id){if(state.objects.find(o=>o.id===id)?.variant==='ai')return openAI(id);aiOpen(id)};
const aiContext=handleContext;handleContext=function(action){const o=state.objects.find(o=>selected.has(o.id));if(action==='to-ai'&&o){const node=createAINode({x:o.x+o.w+80,y:o.y});connectAI(o.id,node.id);return}if(action==='ai-edit'&&o)return openAI(o.id);aiContext(action)};
render();
