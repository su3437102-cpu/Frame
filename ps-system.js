// The PS card can show an input preview before an edited output is available.
function createPSNode(p){checkpoint();const o={id:crypto.randomUUID(),type:'image',parentBoardId:state.activeBoardId||null,variant:'ps',name:'PS',src:'',x:p?.x??100,y:p?.y??100,w:280,h:220,r:0,z:Math.max(0,...state.objects.map(o=>o.z||0))+1};state.objects.push(o);selected=new Set([o.id]);update()}
function connectPS(fromId,toId){return connectWorkbenchInput(fromId,toId)}
function syncPSPreviews(){
 const graph=createWorkbenchGraph();
 for(const node of state.objects){
  if(node.variant!=='ps')continue;
  node.psInputSrc=graph.source(node);
  node.src=graph.output(node)||node.psInputSrc;
 }
}
const psBaseHTML=objectHTML;
objectHTML=function(o){
 if(o.variant!=='ps')return psBaseHTML(o);
 const project=state.pikadoProjects?.[o.id];
 const hasOutput=Boolean(project?.preview&&o.psInputSrc&&project.inputSrc===o.psInputSrc);
 const waiting=!o.psInputSrc&&Boolean(createWorkbenchGraph().input(o));
 const status=hasOutput?'已输出':o.psInputSrc?(project?'输入已更新 · 进入编辑同步':'已连接照片'):(waiting?'等待上游输出':'等待连接');
 const preview=o.src?`<img src="${esc(o.src)}" alt="${hasOutput?'PS 输出预览':'输入照片预览'}" draggable="false">`:
  `<div class="ps-empty">${waiting?'上一级保存后将在此显示':'将照片连线到此处'}</div>`;
 return `<div class="inner ps-node"><div class="ps-title">PS <span>${status}</span></div>${preview}<small>${o.src?'双击查看照片':'连接照片后进入编辑'}</small></div>`;
};
const psBaseDelete=actions.delete;
actions.delete=function(){if(!state.objects.some(o=>selected.has(o.id)&&o.variant==='ps'))return psBaseDelete();checkpoint();const removed=state.objects.filter(o=>selected.has(o.id));state.trash.push(...removed);state.objects=state.objects.filter(o=>!selected.has(o.id));state.connections=(state.connections||[]).filter(e=>!selected.has(e.from)&&!selected.has(e.to));selected.clear();update();toast('已移到回收站，可撤销或恢复')};
const psBaseRender=render;
render=function(){syncPSPreviews();psBaseRender()};render();
