// Task rows retain identity while editing; boards share one recoverable workspace snapshot.
function taskRows(o){
 if(!Array.isArray(o.taskItems))o.taskItems=(o.text?o.text.split('\n'):[]).map((text,i)=>({id:crypto.randomUUID(),text,html:o.richTextPlain===o.text?o.richTasks?.[i]:undefined,done:!!o.done?.includes(i)}));
 return o.taskItems;
}
function syncTaskFields(o){const rows=taskRows(o);o.text=rows.map(t=>t.text).join('\n');o.done=rows.flatMap((t,i)=>t.done?[i]:[]);delete o.richText;delete o.richTasks;delete o.richTextPlain}
function taskRowHTML(t){return `<div class="live-task${t.done?' is-done':''}" data-task-id="${esc(t.id)}" style="--indent:${t.indent||0}"><input type="checkbox" data-live-check aria-label="完成任务 ${esc(t.text)}" ${t.done?'checked':''}><div class="task-editor" contenteditable="true" role="textbox" aria-label="任务内容" data-placeholder="输入任务…">${t.html?safeNoteHTML(t.html):esc(t.text)}</div><button type="button" data-remove-task aria-label="删除此任务">×</button></div>`}
function todoHTML(o){return `<div class="inner todo-card live-todo">${o.todoTitle!==false?`<h3 contenteditable="true" role="textbox" aria-label="待办标题" data-todo-title>${esc(o.name)}</h3>`:''}<div class="live-task-list">${taskRows(o).map(taskRowHTML).join('')}</div><div class="live-task task-draft"><span class="draft-check"></span><div class="task-editor" contenteditable="true" role="textbox" aria-label="添加任务" data-placeholder="添加任务…" data-task-draft></div></div><div class="todo-footer">${o.todoTitle===false?'<button type="button" data-todo-add-title>添加标题</button>':''}<span class="todo-progress"></span></div></div>`}
const taskBaseHTML=objectHTML;objectHTML=function(o){return o.type==='todo'?todoHTML(o):taskBaseHTML(o)};
function fitTodo(card,o,animate=false){
 const inner=card.querySelector('.live-todo');if(!inner)return;const old=card.offsetHeight;
 const next=Math.max(74,Math.ceil(inner.scrollHeight));o.h=next;card.style.height=next+'px';
 const rows=taskRows(o),count=rows.filter(t=>t.done).length;inner.querySelector('.todo-progress').textContent=rows.length?`${count} / ${rows.length} 完成`:'';
 if(animate&&!RM&&old!==next)card.animate([{height:old+'px'},{height:next+'px'}],{duration:180,easing:'ease-out'});
}
function taskContext(target){const card=target.closest('.object.todo');const o=card&&state.objects.find(o=>o.id===card.dataset.id);return {card,o,row:target.closest('[data-task-id]')}}
function persistTaskInput(target){
 const {card,o,row}=taskContext(target);if(!o)return;
 if(target.matches('[data-todo-title]'))o.name=target.textContent.trim()||'待办事项';
 else if(row){const t=taskRows(o).find(t=>t.id===row.dataset.taskId);if(t){t.text=target.innerText.replace(/\n/g,' ');t.html=safeNoteHTML(target.innerHTML);row.querySelector('[data-live-check]').setAttribute('aria-label','完成任务 '+t.text);syncTaskFields(o)}}
 fitTodo(card,o);save();
}
function insertTask(o,card,afterId,text=''){
 const rows=taskRows(o),i=afterId?rows.findIndex(t=>t.id===afterId)+1:rows.length,t={id:crypto.randomUUID(),text,done:false};rows.splice(i,0,t);syncTaskFields(o);
 const list=card.querySelector('.live-task-list');const after=afterId&&list.querySelector(`[data-task-id="${CSS.escape(afterId)}"]`);
 if(after)after.insertAdjacentHTML('afterend',taskRowHTML(t));else list.insertAdjacentHTML('beforeend',taskRowHTML(t));
 const el=list.querySelector(`[data-task-id="${CSS.escape(t.id)}"]`);if(!RM)el.animate([{opacity:0,translate:'0 -4px'},{opacity:1,translate:'0 0'}],{duration:160,easing:'ease-out'});
 fitTodo(card,o,true);save();return el.querySelector('.task-editor');
}
function focusTask(el,end=false){el.focus();const range=document.createRange();range.selectNodeContents(el);range.collapse(!end);const sel=getSelection();sel.removeAllRanges();sel.addRange(range)}
function removeTask(target){const {card,o,row}=taskContext(target);if(!o||!row)return;checkpoint();const rows=taskRows(o),i=rows.findIndex(t=>t.id===row.dataset.taskId);rows.splice(i,1);syncTaskFields(o);row.remove();fitTodo(card,o,true);save();const next=card.querySelectorAll('.task-editor')[Math.max(0,i-1)];next?.focus()}
// Capture before legacy canvas handlers: editing or ticking never starts a canvas drag.
document.addEventListener('pointerdown',e=>{const {o}=taskContext(e.target);if(!o||!e.target.closest('.task-editor,input,button,[data-todo-title]'))return;
 if(inlineEdit)finishInline(false);if(!selected.has(o.id)){selected=new Set([o.id]);contextBackId=null;selectionUI()}e.stopPropagation();
},true);
document.addEventListener('dblclick',e=>{if(e.target.closest('.live-todo'))e.stopPropagation()},true);
document.addEventListener('focusin',e=>{if(e.target.closest('.live-todo')&&e.target.isContentEditable)checkpoint()});
document.addEventListener('input',e=>{
 const {card,o}=taskContext(e.target);if(!o||!e.target.isContentEditable)return;
 if(e.target.matches('[data-task-draft]')){const text=e.target.innerText;if(text.trim()&&!e.isComposing){e.target.textContent='';const el=insertTask(o,card,null,text);focusTask(el,true)}}else persistTaskInput(e.target);
});
document.addEventListener('compositionend',e=>{if(e.target.matches('[data-task-draft]'))e.target.dispatchEvent(new InputEvent('input',{bubbles:true}))});
document.addEventListener('change',e=>{if(!e.target.matches('[data-live-check]'))return;const {card,o,row}=taskContext(e.target);checkpoint();const t=taskRows(o).find(t=>t.id===row.dataset.taskId);t.done=e.target.checked;row.classList.toggle('is-done',t.done);syncTaskFields(o);fitTodo(card,o);save();if(!RM)e.target.animate([{scale:'.82'},{scale:'1.12'},{scale:'1'}],{duration:180})});
document.addEventListener('click',e=>{if(e.target.closest('[data-remove-task]'))removeTask(e.target);if(e.target.closest('[data-todo-add-title]')){const {o}=taskContext(e.target);checkpoint();o.todoTitle=true;update();world.querySelector(`[data-id="${CSS.escape(o.id)}"] [data-todo-title]`)?.focus()}});
document.addEventListener('keydown',e=>{
 const {card,o,row}=taskContext(e.target);if(!o||!e.target.isContentEditable)return;
 if(e.isComposing)return;
 if(e.key==='Enter'){e.preventDefault();if(e.target.matches('[data-todo-title]')){card.querySelector('.task-editor').focus();return}checkpoint();persistTaskInput(e.target);focusTask(insertTask(o,card,row?.dataset.taskId));}
 if(e.key==='Backspace'&&row&&!e.target.textContent){e.preventDefault();removeTask(e.target)}
 if(e.key==='Tab'&&row){e.preventDefault();checkpoint();const t=taskRows(o).find(t=>t.id===row.dataset.taskId);t.indent=Math.max(0,Math.min(3,(t.indent||0)+(e.shiftKey?-1:1)));row.style.setProperty('--indent',t.indent);save()}
 if(e.key==='Escape'){e.preventDefault();e.target.blur();desk.focus()}
},true);
document.addEventListener('paste',e=>{if(!e.target.closest('.live-todo')||!e.target.isContentEditable)return;e.preventDefault();const {card,o,row}=taskContext(e.target),lines=e.clipboardData.getData('text/plain').replace(/\r/g,'').split('\n');document.execCommand('insertText',false,lines.shift());persistTaskInput(e.target);let after=row?.dataset.taskId;for(const text of lines){const el=insertTask(o,card,after,text);after=el.closest('[data-task-id]').dataset.taskId;focusTask(el,true)}});
const taskBaseInline=startInline;startInline=function(o){if(o.type==='todo'){world.querySelector(`[data-id="${CSS.escape(o.id)}"] .task-editor`)?.focus();return}taskBaseInline(o)};

// Nested boards are independent views, not modal text fields. Root objects remain in state.
function boardPath(id){const path=[],seen=new Set();while(id&&!seen.has(id)){seen.add(id);const b=state.objects.find(o=>o.id===id&&o.type==='board');if(!b)break;path.unshift(b);id=b.parentBoardId}return path}
function renderBoardNav(){
 let nav=$('#boardNavigation');if(!nav){nav=document.createElement('nav');nav.id='boardNavigation';nav.setAttribute('aria-label','画板层级');$('.topbar h1').after(nav)}
 const path=boardPath(state.activeBoardId);$('.topbar h1').hidden=!!path.length;
 nav.hidden=!path.length;nav.innerHTML=path.length?'<button type="button" data-board-up aria-label="返回上级画板">←</button>'+path.map((b,i)=>`<button type="button" data-board-open="${esc(b.id)}" ${i===path.length-1?'aria-current="page"':''}>${esc(b.name)}</button>`).join('<span>/</span>'):'';
 desk.setAttribute('aria-label',path.length?path.at(-1).name+' · 子画布':'无限桌面');$('#minimap span').textContent=path.at(-1)?.name||'Visual Exploration';
}
function enterBoard(id){
 if(id&&!state.objects.some(o=>o.id===id&&o.type==='board'))return;
 const board=id&&state.objects.find(o=>o.id===id);
 if(board?.text&&!board.boardContentMigrated){checkpoint();state.objects.push({id:crypto.randomUUID(),type:'note',name:'画板原有内容',text:board.text,parentBoardId:id,x:70,y:70,w:260,h:160,z:1,r:0});board.boardContentMigrated=true}
 if(inlineEdit)finishInline(false);cancelAnimationFrame(viewFrame);cancelPalette();connecting=null;gesture=null;edgeSelected=null;desk.classList.remove('connecting');
 state.boardCameras??={};state.boardCameras[state.activeBoardId||'root']={...state.camera};state.activeBoardId=id||null;state.camera={...(state.boardCameras[id||'root']||{x:70,y:60,z:1})};
 selected.clear();contextBackId=null;contextKey='';closeContextPopover();if(dialog.open)dialog.close();render();save();
 if(!RM)world.animate([{opacity:0,translate:'0 8px'},{opacity:1,translate:'0 0'}],{duration:200,easing:'ease-out'});
}
const boardBaseOpen=openObject;openObject=function(id){const o=state.objects.find(o=>o.id===id);if(o?.type==='board'){enterBoard(id);return}if(o&&(o.parentBoardId||null)!==(state.activeBoardId||null))enterBoard(o.parentBoardId);boardBaseOpen(id)};
const boardBaseLocate=locate;locate=function(id){const o=state.objects.find(o=>o.id===id);if(o&&(o.parentBoardId||null)!==(state.activeBoardId||null))enterBoard(o.parentBoardId);boardBaseLocate(id)};
const boardBaseHome=actions.home;actions.home=function(){if(state.activeBoardId)enterBoard(null);else boardBaseHome()};
const boardBaseContext=handleContext;handleContext=function(action){const o=contextObject();if(action==='edit'&&o?.type==='board'){enterBoard(o.id);return}boardBaseContext(action)};
const taskBoardBaseEdit=actions.edit;actions.edit=function(){const o=contextObject();if(o?.type==='todo'){startInline(o);return}if(o?.type==='board'){enterBoard(o.id);return}taskBoardBaseEdit()};
document.addEventListener('click',e=>{const b=e.target.closest('[data-board-open],[data-board-up]');if(!b)return;if(b.hasAttribute('data-board-up')){const o=state.objects.find(o=>o.id===state.activeBoardId);enterBoard(o?.parentBoardId||null)}else enterBoard(b.dataset.boardOpen)});
const taskBoardBaseRender=render;render=function(){if(state.activeBoardId&&!state.objects.some(o=>o.id===state.activeBoardId&&o.type==='board'))state.activeBoardId=null;taskBoardBaseRender();world.querySelectorAll('.object.todo').forEach(card=>{const o=state.objects.find(o=>o.id===card.dataset.id);fitTodo(card,o)});renderBoardNav()};
function canvasRow(id,name,objects,isRoot=false){
 const photos=objects.filter(o=>o.type==='image'),cover=photos.find(o=>o.src);
 const parent=!isRoot&&state.objects.find(o=>o.id===state.objects.find(x=>x.id===id)?.parentBoardId);
 return `<button class="listrow canvas-row" ${isRoot?'data-canvas-root="true"':`data-canvas-id="${esc(id)}"`}>
 ${cover?`<img src="${esc(cover.src)}" alt="">`:'<span class="canvas-cover">▦</span>'}
 <span><strong>${esc(name)}</strong><small>${parent?`${esc(parent.name)} · `:''}${photos.length} 个照片项目 · ${objects.length} 个内容</small></span><small>画布 ›</small></button>`;
}
actions.boards=function(){
 const canvases=state.objects.filter(o=>o.type==='board');
 const rootPhotos=state.objects.filter(o=>(o.parentBoardId||null)===null);
 const root=canvasRow('root','Visual Exploration',rootPhotos,true);
 const rows=canvases.map(board=>canvasRow(board.id,board.name,state.objects.filter(o=>o.parentBoardId===board.id))).join('');
 modal('My boards',`<p class="dialogcopy">每个画布独立保存自己的照片项目和内容。选择画布进入桌面。</p><section class="canvas-list">${root}${rows||'<p class="canvas-empty">还没有子画布。新建一个画布来整理独立项目。</p>'}</section><div class="dialogactions"><button class="primary" data-create-canvas>＋ 新建画布</button></div>`);
};
document.addEventListener('click',e=>{
 const root=e.target.closest('[data-canvas-root]');if(root){e.preventDefault();enterBoard(null);return}
 const canvas=e.target.closest('[data-canvas-id]');if(canvas){enterBoard(canvas.dataset.canvasId);return}
 if(e.target.closest('[data-create-canvas]')){modal('新建画布',`<label class="field">画布名称<input id="canvasName" maxlength="80" value="新画布" autofocus></label><div class="dialogactions"><button class="primary" data-save-canvas>创建并进入</button></div>`);$('#canvasName').select();return}
 if(e.target.closest('[data-save-canvas]')){const name=$('#canvasName').value.trim()||'新画布';const board=add('board',{name,w:160,h:130});dialog.close();enterBoard(board.id)}
});
render();
