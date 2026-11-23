// Object-bound connectors and palette drag/drop. R11 storage only.
let connecting=null,edgeSelected=null,paletteDrag=null,activeTool=null,placementStart=null;
const baseRender=render;
render=function(){baseRender();installHandles()};
const baseCamera=renderCamera;
function connectorScale(zoom){return Math.max(.45,Math.min(1,Math.sqrt(zoom)))}
renderCamera=function(){
 baseCamera();
 const zoom=state.camera.z;
 world.style.setProperty('--screen-pixel',1/zoom+'px');
 world.style.setProperty('--control-scale',1/zoom);
 world.style.setProperty('--connector-scale',connectorScale(zoom));
 renderConnections();
};
const connectableCard='.object:not(.zone):not(.line)';
function installHandles(){
 world.querySelectorAll(`${connectableCard}:not(.board)`).forEach(card=>{
  const button=document.createElement('button');
  button.className='connect-handle';
  button.title='连接到另一个对象';
  button.setAttribute('aria-label','创建连接');
  button.innerHTML='<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M5 15 10 10 7 8 17 3 12 13 10 10 6 16Z"/></svg>';
  card.append(button);
 });
}

function connectionShape(object){
 if(!object)return null;
 const angle=(object.r||0)*Math.PI/180;
 if(object.type!=='board')return {x:object.x+object.w/2,y:object.y+object.h/2,halfWidth:object.w/2,halfHeight:object.h/2,radius:0,angle};
 const card=canvasBoardCard(object.id),symbol=card?.querySelector('.board-symbol');
 if(!symbol)return null;
 const rect=symbol.getBoundingClientRect();
 if(!rect.width||!rect.height)return null;
 const origin=world.getBoundingClientRect(),zoom=state.camera.z;
 const center={x:(rect.left+rect.width/2-origin.left)/zoom,y:(rect.top+rect.height/2-origin.top)/zoom};
 const halfWidth=symbol.offsetWidth/2,halfHeight=symbol.offsetHeight/2;
 const localX=symbol.offsetLeft+halfWidth,localY=symbol.offsetTop+halfHeight;
 const captions=[...card.children].filter(element=>element!==symbol);
 const label=captions.length?{
  left:Math.min(...captions.map(el=>el.offsetLeft))-localX,
  right:Math.max(...captions.map(el=>el.offsetLeft+el.offsetWidth))-localX,
  top:Math.min(...captions.map(el=>el.offsetTop))-localY,
  bottom:Math.max(...captions.map(el=>el.offsetTop+el.offsetHeight))-localY,
 }:null;
 return {...center,halfWidth,halfHeight,label,radius:parseFloat(getComputedStyle(symbol).borderTopLeftRadius)||0,angle,board:true};
}

function connectionBoundary(shape,toward){
 const {x,y,halfWidth,halfHeight,radius,angle,label}=shape;
 const dx=toward.x-x,dy=toward.y-y,length=Math.hypot(dx,dy);
 if(!length)return {x,y};
 const cos=Math.cos(angle),sin=Math.sin(angle);
 const localX=(dx*cos+dy*sin)/length,localY=(dy*cos-dx*sin)/length;
 const ux=Math.abs(localX),uy=Math.abs(localY);
 let distance=1/Math.max(ux/halfWidth,uy/halfHeight);
 const cornerX=halfWidth-radius,cornerY=halfHeight-radius;
 if(radius&&distance*ux>cornerX&&distance*uy>cornerY){
  const projection=cornerX*ux+cornerY*uy;
  const cross=cornerX*uy-cornerY*ux;
  distance=projection+Math.sqrt(Math.max(0,radius*radius-cross*cross));
 }
 // Beneath a board, clear its title and count if the line would cross them.
 if(label&&localY>0){
  const enter=label.top/localY,exit=label.bottom/localY;
  const startX=enter*localX,endX=exit*localX;
  if(Math.min(startX,endX)<=label.right&&Math.max(startX,endX)>=label.left){
   const exitSide=localX===0?Infinity:(localX>0?label.right:label.left)/localX;
   distance=Math.max(distance,Math.min(exit,exitSide));
  }
 }
 return {x:x+dx/length*distance,y:y+dy/length*distance};
}

function connectionShapes(){
 const objects=new Map(visibleObjects().map(object=>[object.id,object]));
 const shapes=new Map();
 return id=>{
  if(!shapes.has(id))shapes.set(id,connectionShape(objects.get(id)));
  return shapes.get(id);
 };
}

function bendGeometry(base,curve){
 const {center,tangent,normal,length}=base;
 const bend=Number.isFinite(curve.bend)?curve.bend:0;
 const offset=Number.isFinite(curve.bendAlong)?curve.bendAlong*length:0;
 const along=Number.isFinite(offset)?offset:0;
 const dx=tangent.x*along+normal.x*bend/2,dy=tangent.y*along+normal.y*bend/2;
 // The editable point lies on the curve at t=.5. Its control point is twice its offset.
 return {...base,
  m:{x:center.x+2*dx,y:center.y+2*dy},
  mid:{x:center.x+dx,y:center.y+dy},
  curved:Math.abs(bend)>=.001||Math.abs(along)>=.001
 };
}

function geometry(edge,shape=connectionShapes(),curve=edge){
 const from=shape(edge.from),to=shape(edge.to);
 if(!from||!to)return null;
 const s=connectionBoundary(from,to),t=connectionBoundary(to,from);
 const dx=to.x-from.x,dy=to.y-from.y,length=Math.hypot(dx,dy)||1;
 const tangent={x:dx/length,y:dy/length},normal={x:-tangent.y,y:tangent.x};
 const center=interpolatePoint(s,t,.5);
 return bendGeometry({s,t,center,tangent,normal,length,fromBoard:from.board,toBoard:to.board},curve);
}

function interpolatePoint(a,b,t){
 return {x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t};
}

function visibleConnectionPath({s,t,m=interpolatePoint(s,t,.5),curved,fromBoard,toBoard},camera){
 const {z,x,y}=camera;
 const gap=Math.max(2.5,Math.min(9,6.5*z))/z;
 // Trim only the displayed path, preserving the stored curve and the bend handle.
 const part=endpoint=>Math.min(.18,gap/Math.max(.001,2*Math.hypot(m.x-endpoint.x,m.y-endpoint.y)));
 const start=fromBoard?part(s):0,end=toBoard?1-part(t):1;
 const screen=p=>`${p.x*z+x},${p.y*z+y}`;
 if(!curved)return `M${screen(interpolatePoint(s,t,start))}L${screen(interpolatePoint(s,t,end))}`;
 const startControl=interpolatePoint(s,m,start),endControl=interpolatePoint(m,t,start);
 const first=interpolatePoint(startControl,endControl,start);
 const remaining=(end-start)/(1-start);
 const control=interpolatePoint(first,endControl,remaining);
 const last=interpolatePoint(control,interpolatePoint(endControl,t,remaining),remaining);
 return `M${screen(first)}Q${screen(control)} ${screen(last)}`;
}

function targetAt(event){
 // Ignore the transparent hit strip of any line crossing an otherwise visible card.
 const hit=document.elementsFromPoint(event.clientX,event.clientY).find(element=>!element.closest('#connections'));
 return hit?.closest('#desk')?hit.closest(connectableCard)?.dataset.id:null;
}

function renderConnections(){
 let layer=$('#connections');
 if(!layer){
  layer=document.createElementNS('http://www.w3.org/2000/svg','svg');
  layer.id='connections';
  desk.append(layer);
 }
 const camera=state.camera;
 const scale=connectorScale(camera.z),stroke=Math.max(.7,1.25*scale),arrowSize=6.5*scale;
 layer.style.setProperty('--edge-stroke',stroke+'px');
 layer.style.setProperty('--edge-active-stroke',1.18*stroke+'px');
 layer.style.setProperty('--edge-preview-dashes',`${3*scale}px ${4*scale}px`);
 const screen=p=>({x:p.x*camera.z+camera.x,y:p.y*camera.z+camera.y});
 const shape=connectionShapes();
 let html=`<defs><marker id="edge-arrow" viewBox="0 0 8 8" markerWidth="${arrowSize}" markerHeight="${arrowSize}" refX="8" refY="4" orient="auto" markerUnits="userSpaceOnUse"><path d="M0 0L8 4L0 8Z" fill="currentColor" stroke="none"/></marker></defs>`;
 for(const edge of state.connections||[]){
  const curve=connecting?.bend===edge.id?connecting.draft||edge:edge;
  const g=geometry(edge,shape,curve);
  if(!g)continue;
  const active=edge.id===edgeSelected,d=visibleConnectionPath(g,camera);
  html+=`<g data-edge="${esc(edge.id)}" class="${active?'edge-selected':''}"><path class="edge-hit" d="${d}"/><path class="edge-line" d="${d}" marker-end="url(#edge-arrow)"/>`;
  if(active){
   const mid=screen(g.mid);
   html+=`<circle class="bend-handle" cx="${mid.x}" cy="${mid.y}" r="${3.4*scale}"/><circle class="bend-hit" cx="${mid.x}" cy="${mid.y}" r="7"/>`;
  }
  html+='</g>';
 }
 const from=connecting?.from&&shape(connecting.from);
 if(from&&connecting.cursor){
  const target=targetAt(connecting.cursor);
  const previewEdge=connecting.inputTarget?{from:target,to:connecting.inputTarget}:{from:connecting.from,to:target};
  const snapped=target&&target!==connecting.from?geometry(previewEdge,shape):null;
  const cursor=point(connecting.cursor);
  const d=visibleConnectionPath(snapped||{s:connectionBoundary(from,cursor),t:cursor,fromBoard:from.board},camera);
  html+=`<path class="edge-preview" d="${d}"${snapped?' marker-end="url(#edge-arrow)"':''}/>`;
  if(snapped){
   const anchor=screen(connecting.inputTarget?snapped.s:snapped.t);
   html+=`<circle class="edge-snap" cx="${anchor.x}" cy="${anchor.y}" r="${2.8*scale}"/>`;
  }
 }
 layer.innerHTML=html;
}

function finishConnection(target){
 if(!connecting)return;
 const from=connecting.from;
 connecting=null;
 desk.classList.remove('connecting');
 if(from&&target&&target!==from){
  checkpoint();
  state.connections??=[];
  state.connections.push({id:crypto.randomUUID(),from,to:target,bend:0});
  update();
 }else renderConnections();
}

function connectorCursor(event){return {clientX:event.clientX,clientY:event.clientY}}
function beginBend(event,id){
 const edge=state.connections.find(item=>item.id===id),g=edge&&geometry(edge);
 if(!g)return;
 const p=point(event);
 connecting={bend:id,pointerId:event.pointerId,start:connectorCursor(event),
  grabOffset:{x:p.x-g.mid.x,y:p.y-g.mid.y}};
}

function dragBend(event){
 const edit=connecting;
 const moved=Math.hypot(event.clientX-edit.start.clientX,event.clientY-edit.start.clientY);
 if(!edit.draft&&moved<3)return;
 const edge=state.connections.find(item=>item.id===edit.bend),g=edge&&geometry(edge);
 if(!g)return;
 if(!edit.draft){
  desk.setPointerCapture(event.pointerId);
  desk.classList.add('bending-connection');
 }
 const p=point(event);
 const dx=p.x-edit.grabOffset.x-g.center.x,dy=p.y-edit.grabOffset.y-g.center.y;
 edit.draft={
  bend:2*(dx*g.normal.x+dy*g.normal.y),
  bendAlong:(dx*g.tangent.x+dy*g.tangent.y)/g.length
 };
 // Keep the hit target and other paths mounted during the drag.
 const group=$(`#connections [data-edge="${CSS.escape(edge.id)}"]`);
 if(!group){renderConnections();return}
 const draft=bendGeometry(g,edit.draft),camera=state.camera;
 const path=visibleConnectionPath(draft,camera);
 group.querySelectorAll('path').forEach(node=>node.setAttribute('d',path));
 group.querySelectorAll('circle').forEach(node=>{
  node.setAttribute('cx',draft.mid.x*camera.z+camera.x);
  node.setAttribute('cy',draft.mid.y*camera.z+camera.y);
 });
}

function clearConnectionGesture(){
 const previous=connecting;
 connecting=null;
 desk.classList.remove('connecting','bending-connection');
 if(previous?.bend&&desk.hasPointerCapture(previous.pointerId))desk.releasePointerCapture(previous.pointerId);
}

function finishBend(){
 const {bend:id,draft}=connecting;
 clearConnectionGesture();
 if(!draft)return;
 const edge=state.connections.find(item=>item.id===id);
 if(edge&&(Math.abs((edge.bend||0)-draft.bend)>.001||Math.abs((edge.bendAlong||0)-draft.bendAlong)>.00001)){
  checkpoint();
  edge.bend=draft.bend;
  if(Math.abs(draft.bendAlong)>.00001)edge.bendAlong=draft.bendAlong;
  else delete edge.bendAlong;
  save();
 }
 renderConnections();
}

desk.addEventListener('pointerdown',e=>{
 if(e.button!==0||space)return;
 const handle=e.target.closest('.connect-handle'),edge=e.target.closest('[data-edge]');
 if(connecting){
  e.stopImmediatePropagation();
  e.preventDefault();
  if(connecting.bend)return;
  const id=targetAt(e);
  if(connecting.from)finishConnection(id);
  else if(id){
   connecting={from:id,cursor:connectorCursor(e)};
   renderConnections();
  }
  return;
 }
 if(handle){
  e.stopImmediatePropagation();
  e.preventDefault();
  const cursor=connectorCursor(e);
  connecting={from:handle.closest('.object').dataset.id,cursor,start:cursor,pointerId:e.pointerId};
  desk.classList.add('connecting');
  return;
 }
 if(edge){
  e.stopImmediatePropagation();
  e.preventDefault();
  if(e.target.classList.contains('bend-hit')){
   beginBend(e,edge.dataset.edge);
   return;
  }
  selected.clear();
  selectionUI();
  edgeSelected=edge.dataset.edge;
  renderConnections();
  return;
 }
 edgeSelected=null;
 renderConnections();
},true);

document.addEventListener('pointermove',e=>{
 if(connecting?.pointerId!=null&&connecting.pointerId!==e.pointerId)return;
 if(connecting?.from){
  connecting.cursor=connectorCursor(e);
  if(connecting.start&&Math.hypot(e.clientX-connecting.start.clientX,e.clientY-connecting.start.clientY)>3)connecting.drag=true;
  renderConnections();
 }else if(connecting?.bend)dragBend(e);
 else if(gesture)renderConnections();
});
document.addEventListener('pointerup',e=>{
 if(!connecting||connecting.pointerId!==e.pointerId)return;
 if(connecting.bend)finishBend();
 else if(connecting.drag)finishConnection(targetAt(e));
 else{connecting.pointerId=null;connecting.start=null}
});
desk.addEventListener('dblclick',event=>{
 const handle=event.target.closest('.bend-hit');
 if(!handle)return;
 const id=handle.closest('[data-edge]').dataset.edge;
 const edge=state.connections.find(item=>item.id===id);
 if(!edge||(!edge.bend&&!edge.bendAlong))return;
 event.preventDefault();
 event.stopPropagation();
 checkpoint();
 edge.bend=0;
 delete edge.bendAlong;
 renderConnections();
 save();
});
function cancelConnection(){clearConnectionGesture();renderConnections()}
desk.addEventListener('lostpointercapture',event=>{
 if(connecting?.bend&&connecting.pointerId===event.pointerId)cancelConnection();
});
document.addEventListener('pointercancel',event=>{
 if(!connecting?.bend||connecting.pointerId===event.pointerId)cancelConnection();
 cancelPalette();
});
window.addEventListener('blur',cancelConnection);
document.addEventListener('keydown',e=>{
 if(dialog.open||e.target.closest('#colorboard-workbench,input,textarea,select,[contenteditable="true"]'))return;
 if(connecting?.bend&&(e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='z')cancelConnection();
 if(e.key==='Escape'&&(connecting||edgeSelected||paletteDrag||activeTool)){
  e.preventDefault();
  e.stopImmediatePropagation();
  edgeSelected=null;
  cancelConnection();
  cancelPalette();
  chooseTool(null);
  return;
 }
 if(edgeSelected&&(e.key==='Delete'||e.key==='Backspace')){
  e.preventDefault();
  e.stopImmediatePropagation();
  clearConnectionGesture();
  checkpoint();
  state.connections=(state.connections||[]).filter(edge=>edge.id!==edgeSelected);
  edgeSelected=null;
  update();
 }
},true);
function chooseTool(type){activeTool=type;desk.classList.toggle('placing-tool',!!type);$$('.palette-tool[data-tool]').forEach(b=>{let active=b.dataset.tool===type;b.classList.toggle('tool-active',active);b.setAttribute('aria-pressed',String(active))})}
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
  ghost.className='object '+(['ps','ai','collage'].includes(drag.type)?'image':drag.type==='templates'?'zone':drag.type);
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


