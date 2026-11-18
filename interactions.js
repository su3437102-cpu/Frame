// Object-bound connectors and palette drag/drop. R11 storage only.
let connecting=null,edgeSelected=null,paletteDrag=null,activeTool=null,placementStart=null;
const baseRender=render;
render=function(){baseRender();renderConnections();installHandles();};
const baseCamera=renderCamera;
renderCamera=function(){baseCamera();world.style.setProperty('--screen-pixel',1/state.camera.z+'px');world.style.setProperty('--control-scale',1/state.camera.z);renderConnections();};
function installHandles(){world.querySelectorAll('.object:not(.zone):not(.line)').forEach(el=>{let b=document.createElement('button');b.className='connect-handle';b.title='连接到另一个对象';b.setAttribute('aria-label','创建连接');b.innerHTML='<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M5 15 10 10 7 8 17 3 12 13 10 10 6 16Z"/></svg>';(el.querySelector('.board-symbol')||el).append(b)})}
function center(o){return {x:o.x+o.w/2,y:o.y+o.h/2}}
function boundary(o,t){const c=center(o),a=-(o.r||0)*Math.PI/180,dx=t.x-c.x,dy=t.y-c.y,lx=dx*Math.cos(a)-dy*Math.sin(a),ly=dx*Math.sin(a)+dy*Math.cos(a),k=1/Math.max(Math.abs(lx)/(o.w/2),Math.abs(ly)/(o.h/2),.00001);return {x:c.x+dx*k,y:c.y+dy*k}}
function geometry(edge){let a=state.objects.find(o=>o.id===edge.from),b=state.objects.find(o=>o.id===edge.to);if(!a||!b||(a.parentBoardId||null)!==(state.activeBoardId||null)||(b.parentBoardId||null)!==(state.activeBoardId||null))return null;let ca=center(a),cb=center(b),dx=cb.x-ca.x,dy=cb.y-ca.y,l=Math.hypot(dx,dy)||1,s=boundary(a,cb),t=boundary(b,ca),m={x:(s.x+t.x)/2-dy/l*(edge.bend??0),y:(s.y+t.y)/2+dx/l*(edge.bend??0)};return {s,t,m,d:Math.abs(edge.bend||0)<.001?`M${s.x},${s.y} L${t.x},${t.y}`:`M${s.x},${s.y} Q${m.x},${m.y} ${t.x},${t.y}`,mid:{x:(s.x+2*m.x+t.x)/4,y:(s.y+2*m.y+t.y)/4}}}

function renderConnections(){let layer=$('#connections');if(!layer){layer=document.createElementNS('http://www.w3.org/2000/svg','svg');layer.id='connections';desk.append(layer)}
const c=state.camera,screen=p=>({x:p.x*c.z+c.x,y:p.y*c.z+c.y});
let html='<defs><marker id="edge-arrow" markerWidth="8" markerHeight="8" refX="8" refY="4" orient="auto" markerUnits="userSpaceOnUse"><path d="M0 0L8 4L0 8Z" fill="currentColor" stroke="none"/></marker></defs>';
html+=(state.connections||[]).map(e=>{let g=geometry(e);if(!g)return '';let s=screen(g.s),t=screen(g.t),m=screen(g.m),mid=screen(g.mid),d=Math.abs(e.bend||0)<.001?`M${s.x},${s.y}L${t.x},${t.y}`:`M${s.x},${s.y}Q${m.x},${m.y} ${t.x},${t.y}`;return `<g data-edge="${esc(e.id)}" class="${e.id===edgeSelected?'edge-selected':''}"><path class="edge-hit" d="${d}"/><path class="edge-line" d="${d}" marker-end="url(#edge-arrow)"/><circle class="bend-handle" cx="${mid.x}" cy="${mid.y}" r="5"/></g>`}).join('');
if(connecting?.from){let a=state.objects.find(o=>o.id===connecting.from);if(a){let p=connecting.point||center(a),t=screen(p),s=screen(boundary(a,p));html+=`<path class="edge-preview" d="M${s.x},${s.y}L${t.x},${t.y}"/>`}}layer.innerHTML=html;}

function finishConnection(target){if(!connecting)return;let from=connecting.from;if(target&&target!==from){checkpoint();state.connections??=[];state.connections.push({id:crypto.randomUUID(),from,to:target,bend:0});update()}connecting=null;desk.classList.remove('connecting');renderConnections()}
function targetAt(e){return document.elementFromPoint(e.clientX,e.clientY)?.closest('.object:not(.zone):not(.line)')?.dataset.id}
desk.addEventListener('pointerdown',e=>{
 const handle=e.target.closest('.connect-handle'),edge=e.target.closest('[data-edge]');
 if(handle){e.stopImmediatePropagation();e.preventDefault();connecting={from:handle.closest('.object').dataset.id,point:point(e),drag:false};desk.classList.add('connecting');return}
 if(connecting){e.stopImmediatePropagation();e.preventDefault();let id=targetAt(e);if(connecting.from)finishConnection(id);else if(id)connecting={from:id,point:point(e)};return}
 if(edge){e.stopImmediatePropagation();e.preventDefault();selected.clear();selectionUI();edgeSelected=edge.dataset.edge;if(e.target.classList.contains('bend-handle')){checkpoint();connecting={bend:edgeSelected}}renderConnections();return}
 edgeSelected=null;renderConnections();
},true);
document.addEventListener('pointermove',e=>{if(connecting?.from){connecting.point=point(e);connecting.drag=true;renderConnections()}else if(connecting?.bend){let edge=state.connections.find(a=>a.id===connecting.bend),a=center(state.objects.find(o=>o.id===edge.from)),b=center(state.objects.find(o=>o.id===edge.to)),dx=b.x-a.x,dy=b.y-a.y,l=Math.hypot(dx,dy)||1,p=point(e);for(let i=0;i<12;i++){let g=geometry(edge),err=(p.x-g.mid.x)*(-dy/l)+(p.y-g.mid.y)*(dx/l);edge.bend+=2*err;if(Math.abs(err)<.01)break}renderConnections()}else if(gesture)renderConnections();});
document.addEventListener('pointerup',e=>{if(connecting?.bend){connecting=null;save()}else if(connecting?.drag)finishConnection(targetAt(e));});
function cancelConnection(){if(connecting?.bend)save();connecting=null;desk.classList.remove('connecting');renderConnections()}
document.addEventListener('pointercancel',()=>{cancelConnection();cancelPalette()});
window.addEventListener('blur',cancelConnection);
document.addEventListener('keydown',e=>{if(dialog.open||e.target.closest('input,textarea,select,[contenteditable="true"]'))return;if(e.key==='Escape'&&(connecting||edgeSelected||paletteDrag||activeTool)){e.preventDefault();e.stopImmediatePropagation();edgeSelected=null;cancelConnection();cancelPalette();chooseTool(null);return}if(edgeSelected&&(e.key==='Delete'||e.key==='Backspace')){e.preventDefault();e.stopImmediatePropagation();checkpoint();state.connections=(state.connections||[]).filter(a=>a.id!==edgeSelected);edgeSelected=null;update()}},true);
function chooseTool(type){activeTool=type;desk.classList.toggle('placing-tool',!!type);$('#boardEmpty').classList.toggle('is-placing',!!type);$$('.palette-tool').forEach(b=>{let active=b.dataset.tool===type;b.classList.toggle('tool-active',active);b.setAttribute('aria-pressed',String(active))})}
function createTool(type,p){if(type==='ps'){createPSNode(p);return}if(type==='templates'){actions.templates();return}if(type==='line'){connecting={from:null};desk.classList.add('connecting');toast('依次点击两个对象，或拖动照片右上角的连接手柄');return}if(type==='image'){actions.upload(p);return}let extra=p?{x:p.x,y:p.y}:{};if(type==='note')Object.assign(extra,{h:54,text:'Start typing…'});if(type==='board')Object.assign(extra,{w:140,h:120});if(type==='todo')Object.assign(extra,{w:260,h:96,text:'',taskItems:[],todoTitle:false});if(type==='comment'){type='note';Object.assign(extra,{variant:'comment',name:'Comment',text:'双击输入评论',w:240,h:80})}if(type==='table'){type='note';Object.assign(extra,{variant:'table',name:'Table',text:'标题  |  内容\n项目  |  待填写',w:280,h:120})}return add(type,extra)}
const palette=[['note','Note'],['todo','To-do'],['line','Line'],['board','Board'],['column','Column'],['ps','PS'],['templates','模板'],['image','Add image']];
actions.templates=()=>modal('从模板开始',zoneHTML({kind:'templates'}));
paths.ps='M4 3h16v18H4Z M8 16V8h4a3 3 0 0 1 0 6H8 M16 10h-2';paths.templates='M3 3h8v8H3Z M15 3h6v8h-6Z M3 15h8v6H3Z M15 15h6v6h-6Z';
paths.board='M5 5h4v4H5Z M15 5h4v4h-4Z M5 15h4v4H5Z M15 15h4v4h-4Z';paths.column='M3 3h18v18H3Z M3 8h18';paths.comment='M3 3h18v15h-8l-5 4v-4H3Z M7 7h10 M7 11h8';paths.table='M2 3h20v18H2Z M2 9h20 M2 15h20 M9 3v18 M16 3v18';
$('#tools').innerHTML=palette.map(([t,label])=>`<button class="palette-tool" data-tool="${t}" title="拖到桌面创建 ${label}" aria-pressed="false"><i class="tool-glyph glyph-${t}">${icon(t)}</i><span>${label}</span></button>`).join('');
function cancelPalette(){const p=paletteDrag;paletteDrag=null;$('#paletteGhost')?.remove();p?.button?.classList.remove('tool-dragging');if(p?.button?.hasPointerCapture(p.pointerId))p.button.releasePointerCapture(p.pointerId)}
function palettePreview(type){
 if(type==='line')return {w:180,h:40,html:'<svg viewBox="0 0 180 40"><path d="M8 30L166 10m-10-4 10 4-8 8"/><circle cx="87" cy="20" r="4"/></svg>'};
 if(type==='image')return {w:240,h:160,html:'<div class="ghost-upload">'+icon('image')+'<span>选择照片</span></div>'};
 const size=type==='note'?[230,54]:type==='board'?[140,120]:type==='column'?[230,300]:type==='ps'?[280,220]:type==='templates'?[340,275]:[240,166];
 const o={type:type==='ps'?'image':type==='templates'?'zone':type,variant:type==='ps'?'ps':undefined,kind:type==='templates'?'templates':undefined,name:({note:'新笔记',todo:'待办事项',board:'新画板',column:'新栏目',ps:'PS',templates:'模板'})[type],text:type==='note'?'':type==='todo'?'收集参考\n挑选照片\n整理思路':'',w:size[0],h:size[1],src:''};
 return {w:size[0],h:size[1],html:objectHTML(o)};
}
function placeTool(type,point,{animate=true}={}){
 const previous=new Set(state.objects.map(object=>object.id));
 chooseTool(null);
 createTool(type,point);
 const object=state.objects.find(item=>!previous.has(item.id));
 if(!object)return;
 const element=world.querySelector(`[data-id="${CSS.escape(object.id)}"]`);
 element?.classList.remove('entry-settle','entry-slide');
 if(element&&animate&&!RM)element.animate([{translate:'0 -3px',scale:'1.018'},{translate:'0 0',scale:'1'}],{duration:180,easing:'ease-out'});
 document.dispatchEvent(new CustomEvent('r11:palette-drop',{detail:{id:object.id}}));
 element?.focus({preventScroll:true});
}
$('#tools').addEventListener('pointerdown',event=>{
 const button=event.target.closest('[data-tool]');
 if(!button||event.button!==0||paletteDrag)return;
 paletteDrag={type:button.dataset.tool,x:event.clientX,y:event.clientY,moved:false,pointerId:event.pointerId,button};
 button.setPointerCapture(event.pointerId);
});
document.addEventListener('pointermove',event=>{
 const drag=paletteDrag;
 if(!drag||event.pointerId!==drag.pointerId)return;
 if(!drag.moved&&Math.hypot(event.clientX-drag.x,event.clientY-drag.y)<5)return;
 drag.moved=true;
 drag.button.classList.add('tool-dragging');
 let ghost=$('#paletteGhost');
 if(!ghost){
  const preview=palettePreview(drag.type);
  ghost=document.createElement('div');ghost.id='paletteGhost';
  ghost.className='object '+(drag.type==='ps'?'image':drag.type==='templates'?'zone':drag.type);
  ghost.innerHTML=preview.html;ghost.style.width=preview.w+'px';ghost.style.height=preview.h+'px';
  document.body.append(ghost);
  if(!RM)ghost.animate([{opacity:0,scale:'.88'},{opacity:1,scale:'1'}],{duration:140,easing:'ease-out'});
 }
 ghost.style.transform=`translate(${event.clientX-24}px,${event.clientY-20}px) scale(${state.camera.z})`;
});
let lastDraggedTool=null;
document.addEventListener('pointerup',event=>{
 const drag=paletteDrag;
 if(!drag||event.pointerId!==drag.pointerId)return;
 try{
  if(!drag.moved)return;
  lastDraggedTool=drag.button;
  setTimeout(()=>{if(lastDraggedTool===drag.button)lastDraggedTool=null},0);
  const bounds=desk.getBoundingClientRect();
  if(event.clientX<=bounds.left||event.clientX>=bounds.right||event.clientY<=bounds.top||event.clientY>=bounds.bottom)return;
  const at=point({clientX:event.clientX-24,clientY:event.clientY-20});
  if(drag.type==='templates'){chooseTool(null);add('zone',{...at,kind:'templates',name:'模板',w:340,h:275});return}
  placeTool(drag.type,at);
 }finally{cancelPalette()}
});
$('#tools').addEventListener('lostpointercapture',event=>{if(paletteDrag?.pointerId===event.pointerId)cancelPalette()});
window.addEventListener('blur',cancelPalette);
$('#tools').addEventListener('click',event=>{
 const button=event.target.closest('[data-tool]');
 if(!button||button===lastDraggedTool)return;
 const type=button.dataset.tool;
 if(connecting)cancelConnection();
 if(type==='line'||type==='templates'){placeTool(type);return}
 if(event.detail===0){
  const bounds=desk.getBoundingClientRect(),preview=palettePreview(type);
  const at=point({clientX:bounds.left+bounds.width/2,clientY:bounds.top+bounds.height/2});
  placeTool(type,{x:at.x-preview.w/2,y:at.y-preview.h/2});
  return;
 }
 chooseTool(activeTool===type?null:type);
 if(activeTool)toast('点击画布放置 '+button.textContent.trim()+'，Esc 取消');
});
desk.addEventListener('pointerdown',event=>{
 placementStart=activeTool&&event.button===0&&!space&&!event.target.closest('.object,button,[data-edge]')?{x:event.clientX,y:event.clientY}:null;
},true);
desk.addEventListener('click',event=>{
 const start=placementStart;placementStart=null;
 if(!activeTool||!start||event.target.closest('.object,button,[data-edge]'))return;
 if(Math.hypot(event.clientX-start.x,event.clientY-start.y)<5)placeTool(activeTool,point(event));
});
const baseObjectHTML=objectHTML;
objectHTML=function(o){if(o.type==='image')return `<div class="inner"><img src="${esc(o.src)}" alt="摄影项目" draggable="false"></div>`;if(o.type==='board')return `<div class="inner board-cutout"><span class="board-symbol"></span><h3>${esc(o.name)}</h3><small>${state.objects.filter(item=>item.parentBoardId===o.id).length} cards</small></div>`;if(o.type==='todo')return `<div class="inner todo-card"><h3>${esc(o.name)}</h3><div class="task-list">${(o.text||'收集参考\n挑选照片\n整理思路').split('\n').map((t,i)=>`<label class="task ${o.done?.includes(i)?'is-done':''}"><input type="checkbox" data-task="${i}" ${o.done?.includes(i)?'checked':''}><span>${esc(t)}</span></label>`).join('')}</div></div>`;if(o.variant==='table')return `<div class="inner"><table class="data-table">${(o.text||'').split('\n').map(row=>`<tr>${row.split('|').map(cell=>`<td>${esc(cell)}</td>`).join('')}</tr>`).join('')}</table></div>`;if(o.variant==='comment')return `<div class="inner"><p class="comment-card">${esc(o.text)}</p></div>`;return baseObjectHTML(o)};
desk.addEventListener('pointerdown',e=>{if(e.target.closest('.task'))e.stopImmediatePropagation()},true);
desk.addEventListener('dblclick',e=>{if(e.target.closest('.task'))e.stopImmediatePropagation()},true);
document.addEventListener('change',e=>{if(e.target.matches('[data-task]'))e.target.closest('.task').classList.toggle('is-done',e.target.checked)});
render();


