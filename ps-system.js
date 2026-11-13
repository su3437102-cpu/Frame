// Canvas-only PS prototype; existing project records remain untouched.
function createPSNode(p){checkpoint();const o={id:crypto.randomUUID(),type:'image',parentBoardId:state.activeBoardId||null,variant:'ps',name:'PS',src:'',x:p?.x??100,y:p?.y??100,w:280,h:220,r:0,z:Math.max(0,...state.objects.map(o=>o.z||0))+1};state.objects.push(o);selected=new Set([o.id]);update()}
function syncPSPreviews(){
 const byId=new Map(state.objects.map(o=>[o.id,o])),visited=new Set(),active=new Set();
 function visit(o){if(visited.has(o.id))return o.src||'';if(active.has(o.id))return '';active.add(o.id);const edge=(state.connections||[]).filter(e=>e.to===o.id&&byId.get(e.from)?.type==='image').at(-1),source=edge&&byId.get(edge.from);o.src=source?(source.variant==='ps'?visit(source):source.src||''):'';o.psInputSrc=o.src;const edit=state.pikadoProjects?.[o.id];if(edit&&o.psInputSrc)o.src=edit.preview;active.delete(o.id);visited.add(o.id);return o.src}
 state.objects.filter(o=>o.variant==='ps').forEach(visit);
}
function connectPS(fromId,toId){
 let from=state.objects.find(o=>o.id===fromId),to=state.objects.find(o=>o.id===toId);
 if(from?.variant!=='ps'&&to?.variant!=='ps')return false;
 if(from?.variant==='ps'&&to?.type==='image'&&to.variant!=='ps')[from,to]=[to,from];
 if(!from||!to||from.type!=='image'||to.variant!=='ps'||from.id===to.id){toast('请将照片连接到 PS 模块');return true}
 const edges=state.connections||[],seen=new Set(),stack=[to.id];
 while(stack.length){const id=stack.pop();if(id===from.id){toast('不能连接成循环');return true}if(seen.has(id))continue;seen.add(id);edges.filter(e=>e.from===id).forEach(e=>stack.push(e.to))}
 checkpoint();state.connections=edges.filter(e=>e.to!==to.id);state.connections.push({id:crypto.randomUUID(),from:from.id,to:to.id,bend:0,kind:'ps-input'});update();return true;
}
const psFinishConnection=finishConnection;
finishConnection=function(target){if(connecting?.from&&target&&connectPS(connecting.from,target)){connecting=null;desk.classList.remove('connecting');renderConnections();return}psFinishConnection(target)};
const psBaseHTML=objectHTML;
objectHTML=function(o){if(o.variant!=='ps')return psBaseHTML(o);return `<div class="inner ps-node"><div class="ps-title">PS <span>${o.src?(state.pikadoProjects?.[o.id]&&state.pikadoProjects[o.id].inputSrc!==o.psInputSrc?'输入已更新 · 进入编辑同步':'已连接照片'):'等待连接'}</span></div>${o.src?`<img src="${esc(o.src)}" alt="连接照片的预览" draggable="false">`:'<div class="ps-empty">将照片连线到此处</div>'}<small>${o.src?'双击查看照片':'先拖入模块，再连接照片'}</small></div>`};
const psBaseOpen=openObject;
openObject=function(id){const o=state.objects.find(o=>o.id===id);if(o?.variant==='ps'){if(o.src)modal('PS · 照片预览',`<img class="projectpreview" src="${esc(o.src)}" alt="连接照片的预览">`);else toast('将照片连线到 PS 模块，即可显示照片');return}psBaseOpen(id)};
const psBaseDelete=actions.delete;
actions.delete=function(){if(!state.objects.some(o=>selected.has(o.id)&&o.variant==='ps'))return psBaseDelete();checkpoint();const removed=state.objects.filter(o=>selected.has(o.id));state.trash.push(...removed);state.objects=state.objects.filter(o=>!selected.has(o.id));state.connections=(state.connections||[]).filter(e=>!selected.has(e.from)&&!selected.has(e.to));selected.clear();update();toast('已移到回收站，可撤销或恢复')};
const psBaseRender=render;
render=function(){syncPSPreviews();psBaseRender()};render();
