// Context rail: create → object tools → inline text tools. Uses the existing R11 snapshot.
const contextRail=document.createElement('div');contextRail.id='contextRail';contextRail.hidden=true;
$('.toolbar').append(contextRail);
const contextPopover=document.createElement('section');contextPopover.id='contextPopover';contextPopover.hidden=true;
contextPopover.setAttribute('aria-label','对象工具选项');document.body.append(contextPopover);
let inlineEdit=null,contextKey='',contextBackId=null,textRange=null;
const contextPaths={back:'M15 5 8 12l7 7 M8 12h13',color:'M4 4h16v16H4Z M4 8h16',tag:'M3 3h9l9 9-9 9-9-9Z M7 7h.01',reaction:'M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0 M8 14q4 5 8 0 M8 9h.01 M16 9h.01',comment:'M4 4h16v13h-8l-5 4v-4H4Z M7 8h10 M7 12h6',more:'M5 12h.01 M12 12h.01 M19 12h.01',edit:'m5 16 11-11 3 3-11 11-4 1Z',text:'M4 5h16 M12 5v15 M8 20h8',bold:'M7 4h6a4 4 0 0 1 0 8H7V4 M7 12h7a4 4 0 0 1 0 8H7v-8',italic:'M11 4h8 M5 20h8 M15 4 9 20',strike:'M17 6q-8-6-10 1c-1 3 11 5 10 9-1 5-10 5-12 1 M3 12h18',underline:'M6 4v8a6 6 0 0 0 12 0V4 M4 21h16',bullets:'M4 6h.01 M4 12h.01 M4 18h.01 M9 6h12 M9 12h12 M9 18h12',ordered:'M3 4h1v5 M3 13q4-1 0 4v2h3 M9 6h12 M9 12h12 M9 18h12',align:'M3 5h18 M6 10h12 M3 15h18 M6 20h12',code:'m8 6-6 6 6 6 m8-12 6 6-6 6 M14 3l-4 18',size:'M4 9V4h5 M15 4h5v5 M20 15v5h-5 M9 20H4v-5',download:'M12 3v12 M7 10l5 5 5-5 M4 17v4h16v-4',replace:'M4 9a8 8 0 0 1 14-4l2 2 M20 3v4h-4 M20 15a8 8 0 0 1-14 4l-2-2 M4 21v-4h4',unlink:'M9 15l-2 2a4 4 0 0 1-5-5l4-4 M15 9l2-2a4 4 0 0 1 5 5l-4 4 M3 3l18 18',eye:'M2 12q10-14 20 0-10 14-20 0 M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0'};
function contextIcon(name){return contextPaths[name]?`<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${contextPaths[name]}"/></svg>`:icon(name)}
function contextButton(action,label,glyph=action,compact=false){return `<button type="button" class="context-tool${compact?' compact':''}" data-context="${action}" title="${esc(label)}" aria-label="${esc(label)}"><i>${contextIcon(glyph)}</i>${compact?'':`<span>${esc(label)}</span>`}</button>`}
function contextObject(){return selected.size===1?state.objects.find(o=>selected.has(o.id)):null}
function closeContextPopover(){contextPopover.hidden=true;contextPopover.replaceChildren()}
function syncContextRail(){
 const o=contextObject();if(inlineEdit&&(!o||o.id!==inlineEdit.id))finishInline(false);
 if(contextBackId&&contextBackId!==o?.id)contextBackId=null;
 const mode=inlineEdit?'text':o&&contextBackId!==o.id?'object':'create';
 const key=mode+':'+(o?.id||'');if(key===contextKey)return;contextKey=key;closeContextPopover();
 $('#tools').hidden=mode!=='create';$('.toolbottom').hidden=mode!=='create';contextRail.hidden=mode==='create';
 if(mode==='create'){contextRail.replaceChildren();return}
 let html=contextButton('back',mode==='text'?'返回对象工具':'返回创建工具','back');
 if(mode==='text'){
  html+=contextButton('text-style','文字样式','text');
  for(const [command,label,glyph] of [['bold','粗体','bold'],['italic','斜体','italic'],['strikeThrough','删除线','strike'],['underline','下划线','underline'],['insertUnorderedList','项目列表','bullets'],['insertOrderedList','编号列表','ordered'],['align','对齐','align'],['code','代码块','code'],['link','文字链接','link']])html+=contextButton(command,label,glyph,true);
 }else{
  if(o.variant==='ps')html+=contextButton('ps-edit','进入编辑','ps')+contextButton('source','输入照片','image')+contextButton('connect','重新连接','line')+contextButton('disconnect','断开输入','unlink')+contextButton('download','保存输出','download');
  else if(o.type==='image')html+=contextButton('preview','大图预览','eye')+contextButton('replace','替换照片','replace')+contextButton('size','尺寸','size')+contextButton('to-ps','连接 PS','ps')+contextButton('download','下载','download');
  else if(o.type==='zone')html+=contextButton('open-zone','打开功能','edit');
  else html+=contextButton('edit','编辑内容','edit');
  html+=contextButton('color',o.type==='image'?'色条':'颜色','color')+contextButton('labels','标签','tag')+contextButton('reactions','反应','reaction')+contextButton('comments','评论','comment')+contextButton('more','更多','more');
 }
 contextRail.innerHTML=html;contextRail.dataset.level=mode==='text'?'3':'2';
 if(!RM)contextRail.animate([{opacity:.2,translate:'-5px 0'},{opacity:1,translate:'0 0'}],{duration:160,easing:'ease-out'});
}
// Only a small, explicit rich-text vocabulary may enter the saved document.
function safeNoteHTML(html){
 const template=document.createElement('template');template.innerHTML=String(html||'');
 const tags=new Set(['DIV','P','BR','B','STRONG','I','EM','U','S','STRIKE','UL','OL','LI','H1','H2','H3','BLOCKQUOTE','PRE','CODE','SPAN','A','FONT']);
 const safeColor=v=>/^(#[\da-f]{3,8}|rgba?\([\d.,%\s]+\))$/i.test(v);
 function clean(node){if(node.nodeType===3)return document.createTextNode(node.textContent);if(node.nodeType!==1)return document.createTextNode('');if(['SCRIPT','STYLE','IFRAME','OBJECT','IMG','SVG'].includes(node.tagName))return document.createTextNode('');
  const out=document.createElement(tags.has(node.tagName)?(node.tagName==='FONT'?'span':node.tagName.toLowerCase()):'span');
  if(out.tagName==='A'){const href=node.getAttribute('href')||'';if(/^https?:\/\//i.test(href)){out.setAttribute('href',href);out.setAttribute('rel','noopener noreferrer');out.setAttribute('target','_blank')}}
  for(const prop of ['color','backgroundColor']){const value=node.style[prop]||(prop==='color'?node.getAttribute('color'):'');if(value&&safeColor(value))out.style[prop]=value}
  if(['left','center','right'].includes(node.style.textAlign))out.style.textAlign=node.style.textAlign;
  if(['12px','14px','18px','24px','32px'].includes(node.style.fontSize))out.style.fontSize=node.style.fontSize;
  for(const child of node.childNodes)out.append(clean(child));return out;
 }
 const result=document.createElement('div');for(const child of template.content.childNodes)result.append(clean(child));return result.innerHTML;
}
const contextBaseHTML=objectHTML;
objectHTML=function(o){
 let html=o.type==='note'?`<div class="inner"><div class="note-text" data-placeholder="开始输入…">${o.richText&&o.richTextPlain===o.text?safeNoteHTML(o.richText):esc(o.text==='Start typing…'?'':o.text||'').replace(/\n/g,'<br>')}</div></div>`:contextBaseHTML(o);
 if(o.type==='column'&&o.richText&&o.richTextPlain===o.text)html=`<div class="inner"><h3>${esc(o.name)}</h3><div class="columnline"></div><div class="note-text">${safeNoteHTML(o.richText)}</div></div>`;
 if(o.type==='todo'&&Array.isArray(o.richTasks)&&o.richTextPlain===o.text)html=`<div class="inner todo-card"><h3>${esc(o.name)}</h3><div class="task-list">${o.richTasks.map((line,i)=>`<label class="task ${o.done?.includes(i)?'is-done':''}"><input type="checkbox" data-task="${i}" ${o.done?.includes(i)?'checked':''}><span>${safeNoteHTML(line)}</span></label>`).join('')}</div></div>`;
 return html;
};
function applyContextDecorations(){
 for(const o of state.objects){const el=world.querySelector(`[data-id="${CSS.escape(o.id)}"]`);if(!el)continue;const inner=el.querySelector('.inner')||el;
  if(/^#[\da-f]{6}$/i.test(o.cardColor||'')||o.cardColor==='transparent'){inner.style.background=o.cardColor;if(o.cardColor!=='transparent')inner.style.color=o.cardColor==='#24282c'?'#f5f5f5':'#24282c'}
  if(/^#[\da-f]{6}$/i.test(o.colorStrip||'')){const strip=document.createElement('div');strip.className='object-color-strip';strip.style.background=o.colorStrip;el.append(strip)}
  if(o.type==='board'&&/^#[\da-f]{6}$/i.test(o.cardColor||'')){inner.style.background='transparent';el.querySelector('.board-symbol').style.background=o.cardColor}
  const labels=Array.isArray(o.labels)?o.labels:[],comments=Array.isArray(o.comments)?o.comments:[];
  if(labels.length||o.reaction||comments.length){const meta=document.createElement('div');meta.className='object-meta';meta.innerHTML=labels.map(s=>`<span>${esc(String(s).slice(0,40))}</span>`).join('')+(o.reaction?`<span>${esc(o.reaction)} 1</span>`:'')+(comments.length?`<button type="button" data-object-comments="${esc(o.id)}" aria-label="查看 ${comments.length} 条评论">${contextIcon('comment')}${comments.length}</button>`:'');inner.append(meta)}
  if(['note','todo','column'].includes(o.type)&&inner.scrollHeight>o.h){o.h=Math.min(10000,inner.scrollHeight+2);el.style.height=o.h+'px'}
 }
}
const contextBaseRender=render;render=function(){if(inlineEdit)finishInline(false);contextBaseRender();applyContextDecorations();syncContextRail()};
const contextBaseSelection=selectionUI;selectionUI=function(){contextBaseSelection();syncContextRail()};
function rememberTextSelection(){if(!inlineEdit)return;const sel=getSelection();if(sel.rangeCount&&inlineEdit.el.contains(sel.anchorNode)&&inlineEdit.el.contains(sel.focusNode))textRange=sel.getRangeAt(0).cloneRange()}
document.addEventListener('selectionchange',rememberTextSelection);
function storeInline(){if(!inlineEdit)return;const o=state.objects.find(o=>o.id===inlineEdit.id);if(!o)return;
 o.text=inlineEdit.el.innerText.replace(/\r/g,'');o.richText=safeNoteHTML(inlineEdit.el.innerHTML);o.richTextPlain=o.text;
 if(o.type==='todo'){const box=document.createElement('div');box.innerHTML=o.richText;const rows=[...box.querySelectorAll('li')];o.richTasks=rows.length?rows.map(row=>row.innerHTML):o.text.split('\n').map((line,i)=>{const blocks=[...box.children];return blocks.length===o.text.split('\n').length?blocks[i].innerHTML:esc(line)});}
 const el=inlineEdit.el.closest('.object');const needed=Math.ceil(el.querySelector('.inner').scrollHeight);if(needed>o.h){o.h=Math.min(10000,needed+2);el.style.height=o.h+'px'}save();
}
function startInline(o){
 if(inlineEdit?.id===o.id)return;if(inlineEdit)finishInline(false);checkpoint();selected=new Set([o.id]);contextBackId=null;
 const card=world.querySelector(`[data-id="${CSS.escape(o.id)}"]`);let el=card.querySelector('.note-text');
 if(!el){el=document.createElement('div');el.className='note-text';if(o.richText&&o.richTextPlain===o.text)el.innerHTML=safeNoteHTML(o.richText);else el.textContent=o.text||'';const inner=card.querySelector('.inner');if(o.type==='column'){inner.querySelectorAll('.sample').forEach(n=>n.remove());inner.append(el)}else inner.replaceChildren(el)}
 el.contentEditable='true';el.setAttribute('role','textbox');el.setAttribute('aria-label','编辑'+o.name);el.setAttribute('aria-multiline','true');el.setAttribute('spellcheck','false');card.classList.add('inline-editing');
 inlineEdit={id:o.id,el};el.addEventListener('input',storeInline);el.addEventListener('paste',e=>{e.preventDefault();document.execCommand('insertText',false,e.clipboardData.getData('text/plain'))});
 el.addEventListener('keydown',e=>{if(e.key==='Escape'){e.preventDefault();e.stopPropagation();finishInline(true)}if(e.key==='Tab'){e.preventDefault();document.execCommand(e.shiftKey?'outdent':'indent');storeInline()}});
 selectionUI();el.focus();const range=document.createRange();range.selectNodeContents(el);range.collapse(false);getSelection().removeAllRanges();getSelection().addRange(range);rememberTextSelection();
}
function finishInline(redraw=true){if(!inlineEdit)return;storeInline();inlineEdit.el.contentEditable='false';inlineEdit.el.closest('.object')?.classList.remove('inline-editing');inlineEdit=null;textRange=null;contextKey='';if(redraw)render()}
desk.addEventListener('pointerdown',e=>{if(e.target.closest('[contenteditable="true"]')){e.stopImmediatePropagation();return}if(inlineEdit)finishInline(false)},true);
desk.addEventListener('dblclick',e=>{const el=e.target.closest('.object'),o=el&&state.objects.find(x=>x.id===el.dataset.id);if(o&&['note','todo','column'].includes(o.type)&&!e.target.closest('button,input')){e.preventDefault();e.stopImmediatePropagation();startInline(o)}},true);
document.addEventListener('keydown',e=>{const o=contextObject();if(inlineEdit||dialog.open||e.target.closest('input,textarea,[contenteditable="true"]'))return;if(o&&['note','todo','column'].includes(o.type)&&!e.ctrlKey&&!e.metaKey&&!e.altKey&&e.key.length===1){e.preventDefault();e.stopImmediatePropagation();startInline(o);document.execCommand('insertText',false,e.key);storeInline()}},true);
function formatText(command,value){if(!inlineEdit)return;inlineEdit.el.focus();if(textRange){getSelection().removeAllRanges();getSelection().addRange(textRange)}document.execCommand(command,false,value);storeInline();rememberTextSelection();for(const b of contextRail.querySelectorAll('[data-context]')){const c=b.dataset.context;if(['bold','italic','underline','strikeThrough','insertUnorderedList','insertOrderedList'].includes(c))b.setAttribute('aria-pressed',String(document.queryCommandState(c)))}}
function changeObject(mutator){const o=contextObject();if(!o)return;checkpoint();mutator(o);update()}
function showContextPopover(title,content){contextPopover.innerHTML=`<header><strong>${esc(title)}</strong><button type="button" data-context="close-pop" aria-label="关闭选项">×</button></header>${content}`;contextPopover.hidden=false}
const contextColors=['#ffffff','#e9edef','#f6dfe3','#f5d8bb','#f8edb7','#cfe7b7','#c6e1dc','#c9dced','#d9cdef','#24282c'];
function swatchGrid(action){return `<div class="context-colors">${contextColors.map(c=>`<button type="button" data-${action}="${c}" style="background:${c}" aria-label="颜色 ${c}"></button>`).join('')}</div>`}
function downloadObject(o){if(!o?.src)return toast('连接照片后才有可保存的输出');const ext=o.src.startsWith('data:image/png')?'png':'jpg';download(o.src,(o.variant==='ps'?'PS-output':o.name)+'.'+ext)}
function handleContext(action){
 const o=contextObject();if(action==='close-pop'){closeContextPopover();return}if(action==='back'){if(inlineEdit){finishInline(true);return}contextBackId=o?.id;syncContextRail();return}if(!o)return;
 if(['bold','italic','strikeThrough','underline','insertUnorderedList','insertOrderedList'].includes(action)){formatText(action);return}
 if(action==='code'){formatText('formatBlock','pre');return}
 if(action==='text-style'){showContextPopover('文字样式',`<div class="context-options">${[['p','正文'],['h1','大标题'],['h2','标题'],['blockquote','引用'],['pre','代码块']].map(([tag,label])=>`<button data-block="${tag}">${label}</button>`).join('')}</div><p>文字颜色</p>${swatchGrid('text-color')}<p>高亮</p>${swatchGrid('highlight')}`);return}
 if(action==='align'){showContextPopover('对齐',`<div class="context-options"><button data-format="justifyLeft">左对齐</button><button data-format="justifyCenter">居中</button><button data-format="justifyRight">右对齐</button></div>`);return}
 if(action==='link'){showContextPopover('文字链接','<label>网址<input id="contextUrl" type="url" placeholder="https://"></label><button data-context="apply-link">应用链接</button><button data-format="unlink">移除链接</button>');return}
 if(action==='apply-link'){const value=$('#contextUrl').value.trim();if(!/^https?:\/\//i.test(value))return toast('请输入 http 或 https 网址');formatText('createLink',value);closeContextPopover();return}
 if(action==='edit'){if(['note','todo','column'].includes(o.type))startInline(o);else editObject();return}
 if(action==='color'){showContextPopover('颜色',`<label>应用到<select id="colorTarget"><option value="${o.type==='image'?'colorStrip':'cardColor'}">${o.type==='image'?'顶部色条':'背景'}</option>${o.type==='image'?'':'<option value="colorStrip">顶部色条</option>'}</select></label>${swatchGrid('object-color')}<button data-object-color="transparent">透明 / 移除</button><button data-object-color="default">恢复默认</button><label>自定义<input type="color" id="customObjectColor" value="#cfe7b7"></label><button data-context="custom-color">应用自定义颜色</button>`);return}
 if(action==='custom-color'){applyObjectColor($('#customObjectColor').value);return}
 if(action==='labels'){showContextPopover('标签',`<div class="context-tags">${(o.labels||[]).map((label,i)=>`<button data-remove-label="${i}">${esc(label)} ×</button>`).join('')}</div><label>新标签<input id="contextLabel" maxlength="40" placeholder="输入标签"></label><button data-context="add-label">添加标签</button>`);return}
 if(action==='add-label'){const value=$('#contextLabel').value.trim();if(value)changeObject(o=>{o.labels=[...new Set([...(o.labels||[]),value])].slice(0,20)});handleContext('labels');return}
 if(action==='reactions'){showContextPopover('反应','<div class="context-reactions">'+['👍','❤️','😊','✨','👀'].map(r=>`<button data-reaction="${r}" aria-label="${r}">${r}</button>`).join('')+'</div><button data-reaction="">移除反应</button>');return}
 if(action==='comments'){showContextPopover('评论 · 本地保存',`<div class="context-comments">${(o.comments||[]).map((c,i)=>`<p>${esc(c.text)}<button data-remove-comment="${i}" aria-label="删除评论">×</button></p>`).join('')||'<p class="context-muted">暂无评论</p>'}</div><label>添加评论<textarea id="contextComment" maxlength="2000" rows="3"></textarea></label><button data-context="add-comment">保存评论</button>`);return}
 if(action==='add-comment'){const text=$('#contextComment').value.trim();if(text)changeObject(o=>{(o.comments??=[]).push({text,createdAt:new Date().toISOString()})});handleContext('comments');return}
 if(action==='more'){showContextPopover('更多',`<div class="context-options"><button data-context="rename">重命名</button><button data-context="duplicate">复制</button><button data-context="front">置顶</button><button data-context="delete">移到回收站</button></div>`);return}
 if(['duplicate','front','delete'].includes(action)){closeContextPopover();actions[action]();return}
 if(action==='rename'){showContextPopover('重命名',`<label>名称<input id="contextName" value="${esc(o.name)}" maxlength="120"></label><button data-context="save-name">保存</button>`);return}
 if(action==='save-name'){const name=$('#contextName').value.trim();if(name)changeObject(o=>o.name=name);closeContextPopover();return}
 if(action==='preview'){openObject(o.id);return}
 if(action==='replace'){actions.replace();return}
 if(action==='download'){downloadObject(o);return}
 if(action==='size'){showContextPopover('照片尺寸',`<p class="context-muted">保持照片比例</p><label>画布宽度<input id="contextWidth" type="number" min="80" max="5000" value="${Math.round(o.w)}"></label><button data-context="apply-size">应用</button>`);return}
 if(action==='apply-size'){const w=Number($('#contextWidth').value);if(w>=80&&w<=5000)changeObject(o=>{o.h=w*o.h/o.w;o.w=w});closeContextPopover();return}
 if(action==='ps-edit'){if(!o.src)return toast('请先连接一张照片');openPikado(o.id);return}
 if(action==='source'){const edge=(state.connections||[]).filter(e=>e.to===o.id).at(-1);if(edge)locate(edge.from);else toast('还没有连接输入照片');return}
 if(action==='disconnect'){changeObject(o=>{state.connections=(state.connections||[]).filter(e=>e.to!==o.id)});return}
 if(action==='connect'){connecting={from:o.id};desk.classList.add('connecting');toast('点击一张照片作为输入');return}
 if(action==='to-ps'){const sourceId=o.id;createPSNode({x:o.x+o.w+80,y:o.y});connectPS(sourceId,[...selected][0]);return}
 if(action==='open-zone'){if(o.kind==='ps')openPikado(o.id);else modal(o.name,zoneHTML(o));return}
}
function applyObjectColor(value){const key=$('#colorTarget')?.value||'cardColor';changeObject(o=>{if(value==='default'||(key==='colorStrip'&&value==='transparent'))delete o[key];else o[key]=value})}
for(const root of [contextRail,contextPopover]){
 root.addEventListener('pointerdown',e=>{e.stopPropagation();if(e.target.closest('button')){rememberTextSelection();e.preventDefault()}},true);
 root.addEventListener('click',e=>{e.stopPropagation();const b=e.target.closest('button');if(!b)return;
  if(b.dataset.context){handleContext(b.dataset.context);return}
  if(b.dataset.block){formatText('formatBlock',b.dataset.block);return}
  if(b.dataset.format){formatText(b.dataset.format);return}
  if(b.dataset.textColor){formatText('foreColor',b.dataset.textColor);return}
  if(b.dataset.highlight){formatText('hiliteColor',b.dataset.highlight);return}
  if(b.dataset.objectColor){applyObjectColor(b.dataset.objectColor);return}
  if('reaction' in b.dataset){changeObject(o=>{o.reaction=b.dataset.reaction});return}
  if('removeLabel' in b.dataset){changeObject(o=>o.labels.splice(Number(b.dataset.removeLabel),1));handleContext('labels');return}
  if('removeComment' in b.dataset){changeObject(o=>o.comments.splice(Number(b.dataset.removeComment),1));handleContext('comments')}
 });
}
document.addEventListener('pointerdown',e=>{if(!e.target.closest('#contextRail,#contextPopover'))closeContextPopover()},true);
document.addEventListener('click',e=>{const b=e.target.closest('[data-object-comments]');if(b){selected=new Set([b.dataset.objectComments]);selectionUI();handleContext('comments')}});
document.addEventListener('r11:palette-drop',()=>{contextBackId=null;contextKey='';syncContextRail()});
render();
