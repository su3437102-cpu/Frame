// FrameLab keeps the input photo separate from its edited output.
paths.ai='M4 4h16v16H4Z M7 15l3-6 3 6m-5-2h4 M16 9v6';
paths.collage='M3 3h10v18H3zM16 3h5v8h-5zM16 14h5v7h-5z';
$('#tools').insertAdjacentHTML('beforeend',`<button class="palette-tool" data-tool="ai" title="拖到画布创建 AI 调色" aria-pressed="false"><i class="tool-glyph">${icon('ai')}</i><span>AI 调色</span></button>`);
$('#tools').insertAdjacentHTML('beforeend',`<button type="button" class="palette-tool" id="atelier-launch" aria-haspopup="dialog" title="打开抠图拼图工作台"><i class="tool-glyph">${icon('collage')}</i><span>抠图拼图</span></button>`);
$('#atelier-launch').addEventListener('click', () => openAI(null, 'collage'));

function newAINode(p) {
  return {
    id:crypto.randomUUID(), type:'image', variant:'ai', name:'AI 调色',
    parentBoardId:state.activeBoardId || null, x:p?.x ?? 100, y:p?.y ?? 100,
    w:280, h:220, r:0, z:Math.max(0,...state.objects.map(o => o.z || 0)) + 1, src:''
  };
}

function createAINode(p) {
  checkpoint();
  const node = newAINode(p);
  state.objects.push(node);
  selected = new Set([node.id]);
  update();
  return node;
}
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
function aiStatus(node) {
  return node.src ? '已完成' : aiInput(node)?.src ? '等待调色' : '等待连接';
}
const aiHTML = objectHTML;
objectHTML = function (node) {
  if (node.variant !== 'ai') return aiHTML(node);
  const output = node.src
    ? `<img src="${esc(node.src)}" alt="${node.aiEditor === 'collage' ? '拼贴结果' : '调色结果'}" draggable="false">`
    : '<div class="ps-empty">连接照片，或双击打开调色</div>';
  const title = node.aiEditor === 'collage' ? '拼图' : 'AI 调色';
  return `<div class="inner ps-node ai-node"><div class="ps-title">${title} <span>${aiStatus(node)}</span></div>${output}<small>双击调整</small></div>`;
};

function reconcileAI() {
  let cleared = false;
  for (const node of state.objects.filter(object => object.variant === 'ai')) {
    if (!node.src && !node.gradeEdit && !node.colorBoardEdit && !node.collageEdit) continue;
    const source = aiInput(node)?.src || '';
    const savedInput = node.aiInput || '';
    const sourceChanged = node.colorBoardEdit || node.collageEdit ? savedInput !== source : !source || (savedInput && savedInput !== source);
    if (!sourceChanged) continue;
    node.src = '';
    node.aiInput = '';
    delete node.gradeEdit;
    delete node.colorBoardEdit;
    delete node.collageEdit;
    delete node.aiEditor;
    cleared = true;
  }
  if (cleared) { save(); render(); }
}
const aiRender = render;
render = function () {
  aiRender();
  setTimeout(reconcileAI, 0);
};

const colorBoardProjectMime = 'application/x-colorboard';
const colorBoardProjectLimit = 3 * 1024 * 1024;
const colorBoardPreviewLimit = 2 * 1024 * 1024;
const colorBoardProjectPrefix = `data:${colorBoardProjectMime};base64,`;
let colorBoardSession = null;

const loadColorBoardTemplate = () => import('./ai-web/colorboard/template.mjs');
const loadColorBoardEngine = () => import('./ai-web/colorboard/app.mjs');
function warmColorBoard(event) {
  if (!event.target.closest('[data-context="ai-edit"],[data-context="to-ai"]')) return;
  void Promise.allSettled([loadColorBoardTemplate(), loadColorBoardEngine()]);
}
contextRail.addEventListener('pointerover', warmColorBoard);
contextRail.addEventListener('focusin', warmColorBoard);

function colorBoardSource(source) {
  if (!source || /^data:image\/(?:jpeg|png|webp|gif);base64,/i.test(source)) return source;
  const url = new URL(source, location.href);
  if (url.origin !== location.origin) throw new Error('无法读取这个照片来源');
  return url.href;
}

const workbenchPanels = {
  advanced:{panel:'container', editor:'editor', back:'framelab-back', title:'调色工作台'},
  collage:{panel:'collage', editor:'atelier', back:'atelier-back', title:'抠图拼图工作台'}
};

function openAI(id, mode, directInput) {
  const node = state.objects.find(object => object.id === id && object.variant === 'ai');
  if (colorBoardSession || (!node && mode !== 'collage')) return;
  const input = node ? aiInput(node) : directInput;
  const source = input?.src || '';
  const sameInput = node && (node.aiInput || '') === source;
  const project = sameInput && node.aiEditor !== 'basic' ? node.colorBoardEdit || null : null;
  const legacyPreview = sameInput && !project && node.aiEditor !== 'collage' ? node.src || '' : '';
  const collageProject = sameInput ? node.collageEdit || null : null;
  const savedPhoto = sameInput ? node.src || '' : '';

  const modal = document.createElement('dialog');
  modal.id = 'colorboard-workbench';
  modal.setAttribute('aria-label', '照片工作台');
  modal.innerHTML = `
    <div class="colorboard-state"><p role="status">正在打开工作台…</p><button type="button" data-colorboard-back>返回画布</button></div>
    <div class="colorboard-root" inert hidden></div>
    <div class="colorboard-root collage-root" inert hidden></div>`;
  const status = modal.querySelector('[role="status"]');
  const container = modal.querySelector('.colorboard-root');
  const collage = modal.querySelector('.collage-root');
  const initial = {source, name:input ? objectName(input) : '', theme:state.theme, project, legacyPreview};
  const session = {
    modal, container, collage, status, node, inputId:input?.id, source, savedPhoto, initial, collageProject,
    boardId:state.activeBoardId || null, returnFocus:document.activeElement,
    controller:new AbortController()
  };
  colorBoardSession = session;

  if (dialog.open) dialog.close();
  closeContextPopover();
  edgeSelected = null;
  cancelConnection();
  cancelPalette();
  chooseTool(null);
  modal.addEventListener('keydown', event => event.stopPropagation());
  modal.addEventListener('cancel', event => {
    event.preventDefault();
    if (session.saving || session.atelier?.isSaving()) return;
    if (session.loading || !session.mode) {
      if (confirmWorkbenchClose(session)) closeColorBoard(session);
      return;
    }
    const {panel, back} = workbenchPanels[session.mode];
    session[panel].shadowRoot?.getElementById(back)?.click();
  });
  modal.querySelector('[data-colorboard-back]').onclick = () => {
    if (confirmWorkbenchClose(session)) closeColorBoard(session);
  };
  document.body.append(modal);
  modal.showModal();
  void showPhotoWorkbench(session, mode || (collageProject && node.aiEditor === 'collage' ? 'collage' : 'advanced'));
}

function confirmWorkbenchClose(session, except) {
  const dirtyGrade = except !== 'advanced' && session.editor?.isDirty();
  const dirtyCollage = except !== 'collage' && session.atelier?.isDirty();
  if (!dirtyGrade && !dirtyCollage) return true;
  const label = dirtyGrade && dirtyCollage ? '调色和拼贴' : dirtyGrade ? '调色' : '拼贴';
  return window.confirm(label + '有未保存的调整，确定返回画布吗？');
}

function presentPhotoWorkbench(session, mode) {
  session.mode = mode;
  session.modal.setAttribute('aria-label', workbenchPanels[mode].title);
  session.status.parentElement.hidden = true;
  for (const [name, {panel}] of Object.entries(workbenchPanels)) {
    session[panel].hidden = name !== mode;
    session[panel].inert = name !== mode;
  }
  const {panel, back} = workbenchPanels[mode];
  session[panel].shadowRoot.getElementById(back).focus({preventScroll:true});
}

async function workbenchPhoto(session) {
  const photo = await session.editor?.photoForCollage();
  if (photo) return photo;
  const source = session.savedPhoto || session.source;
  if (!source) return null;
  const response = await fetch(colorBoardSource(source), {signal:session.controller.signal});
  if (!response.ok) throw new Error('无法读取连接的照片');
  return {name:session.initial.name, blob:await response.blob()};
}

async function showPhotoWorkbench(session, mode) {
  const signal = session.controller.signal;
  if (signal.aborted || session.loading || session.saving || session.atelier?.isSaving()) return;
  const workbench = workbenchPanels[mode];
  if (session[workbench.editor]) {
    presentPhotoWorkbench(session, mode);
    return;
  }
  session.loading = true;
  for (const {panel} of Object.values(workbenchPanels)) session[panel].inert = true;
  session.status.parentElement.hidden = false;
  session.status.textContent = '正在打开' + workbench.title + '…';
  session.loadTimer = setTimeout(() => {
    session.status.textContent = '工作台尚在加载，可以返回画布后重试。';
  }, 20000);
  try {
    if (mode === 'collage') {
      const [{mountAtelier}, source] = await Promise.all([
        import('./ai-web/colorboard/atelier/mount.mjs'),
        session.collageProject ? null : workbenchPhoto(session)
      ]);
      signal.throwIfAborted();
      session.collage.hidden = false;
      session.atelier = await mountAtelier(session.collage, {
        source, project:session.collageProject, theme:session.initial.theme, signal,
        onClose:() => { if (confirmWorkbenchClose(session)) closeColorBoard(session); },
        onGrade:session.editor ? () => void showPhotoWorkbench(session,'advanced') : null,
        linkedSource:(session.source || session.savedPhoto || session.editor?.hasPhoto())
          ? () => workbenchPhoto(session) : null,
        onSave:result => saveColorBoard(session,result,'collage')
      });
    } else {
      const initial = session.initial;
      const project = initial.project;
      if (project && (typeof project !== 'string' || !project.startsWith(colorBoardProjectPrefix) ||
        project.length > colorBoardProjectPrefix.length + Math.ceil(colorBoardProjectLimit / 3) * 4)) {
        throw new Error('无法读取已保存的调色工程');
      }
      const templateReady = loadColorBoardTemplate().then(async ({mountColorBoardTemplate}) => {
        signal.throwIfAborted();
        session.container.hidden = false;
        const template = mountColorBoardTemplate(session.container, {theme:initial.theme});
        await template.ready;
        return template.root;
      });
      const [root, {mountColorBoard}] = await Promise.all([templateReady, loadColorBoardEngine()]);
      signal.throwIfAborted();
      session.editor = mountColorBoard(root, {
        ...initial, source:colorBoardSource(initial.source), legacyPreview:colorBoardSource(initial.legacyPreview),
        signal,
        onSave:result => saveColorBoard(session,result),
        onClose:() => { if (confirmWorkbenchClose(session,'advanced')) closeColorBoard(session); },
        onCollage:() => void showPhotoWorkbench(session,'collage')
      });
      await session.editor.ready;
    }
    signal.throwIfAborted();
    presentPhotoWorkbench(session,mode);
  } catch (error) {
    if (signal.aborted) return;
    const panelKey = workbench.panel;
    delete session[workbench.editor];
    const panel = session[panelKey];
    if (panel.shadowRoot) {
      const replacement = panel.cloneNode(false);
      replacement.hidden = true;
      panel.replaceWith(replacement);
      session[panelKey] = replacement;
    }
    if (session.mode) {
      presentPhotoWorkbench(session,session.mode);
      toast(error.message || '暂时无法切换工作台，可返回画布后重试。');
    } else {
      session.status.textContent = error.message || '无法打开工作台';
    }
  } finally {
    session.loading = false;
    clearTimeout(session.loadTimer);
  }
}

function closeColorBoard(session) {
  if (colorBoardSession !== session || session.saving) return;
  clearTimeout(session.loadTimer);
  colorBoardSession = null;
  session.controller.abort();
  session.editor?.dispose();
  session.modal.close();
  session.modal.remove();
  const id = session.node?.id || session.inputId;
  if (id) focusCanvasObject(id);
  else if (session.returnFocus?.isConnected) session.returnFocus.focus({preventScroll:true});
}

function aiBlobDataURL(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('无法读取调色结果'));
    reader.readAsDataURL(blob);
  });
}

function ensureColorBoardInput(session) {
  const input = session.node ? aiInput(session.node) : state.objects.find(object => object.id === session.inputId);
  if (colorBoardSession !== session || (session.node && !state.objects.includes(session.node)) ||
    input?.id !== session.inputId || (input?.src || '') !== session.source) {
    throw new Error('连接的照片已改变，请重新打开工作台');
  }
  if (!session.node && !input && session.boardId &&
    !state.objects.some(object => object.id === session.boardId && object.type === 'board')) {
    throw new Error('原画板已移除，请导出作品或返回画布。');
  }
  return input;
}

async function saveColorBoard(session, {preview, project, width, height}, mode = 'advanced') {
  if (session.saving) return;
  if (!confirmWorkbenchClose(session,mode)) throw new Error('已取消保存，可以继续编辑。');
  if (!(preview instanceof Blob) || preview.type !== 'image/jpeg' || !preview.size || preview.size > colorBoardPreviewLimit ||
    !(project instanceof Blob) || project.type !== colorBoardProjectMime || !project.size || project.size > colorBoardProjectLimit ||
    ![width, height].every(size => Number.isInteger(size) && size > 0 && size <= 1400)) {
    throw new Error('未能保存，工作台传回了不支持的结果。');
  }
  session.saving = true;
  try {
    ensureColorBoardInput(session);
    const bytes = new Uint8Array(await project.slice(0, 2).arrayBuffer());
    if (bytes[0] !== 0x1f || bytes[1] !== 0x8b) throw new Error('无法读取调色工程数据');
    const image = await createImageBitmap(preview);
    const correctSize = image.width === width && image.height === height;
    image.close();
    if (!correctSize) throw new Error('未能保存，预览尺寸与调色结果不一致');
    const [src, edit] = await Promise.all([aiBlobDataURL(preview), aiBlobDataURL(project)]);
    const input = ensureColorBoardInput(session);
    const aspect = height / width;
    checkpoint();
    if (!session.node) {
      const node = newAINode(input ? {x:input.x + input.w + 80, y:input.y} : null);
      node.name = '拼图';
      node.parentBoardId = input ? input.parentBoardId || null : session.boardId;
      if (input) {
        (state.connections ??= []).push({
          id:crypto.randomUUID(), from:input.id, to:node.id, bend:0, kind:'ai-input'
        });
      } else {
        const bounds = desk.getBoundingClientRect();
        if (bounds.width && bounds.height && (state.activeBoardId || null) === session.boardId) {
          const center = point({clientX:bounds.left + bounds.width / 2, clientY:bounds.top + bounds.height / 2});
          node.x = center.x - node.w / 2;
          node.y = center.y - ((node.w - 24) * aspect + 80) / 2;
        }
      }
      state.objects.push(node);
      session.node = node;
      selected = new Set([node.id]);
    }
    Object.assign(session.node, {
      src, [mode === 'collage' ? 'collageEdit' : 'colorBoardEdit']:edit, aiEditor:mode, aiInput:session.source,
      h: Math.max(80, (session.node.w - 24) * aspect + 80),
    });
    update();
    setTimeout(() => closeColorBoard(session), 0);
    toast(mode === 'collage' ? '拼贴已保存到画布' : '调色已保存到画布');
  } finally {
    session.saving = false;
  }
}

const aiOpen = openObject;
openObject = function (id) {
  if (state.objects.find(node => node.id === id)?.variant === 'ai') return openAI(id);
  aiOpen(id);
};
const aiContext = handleContext;
handleContext = function (action) {
  const node = contextObject();
  if (action === 'to-ai' && node) {
    const editorNode = createAINode({x: node.x + node.w + 80, y: node.y});
    connectAI(node.id, editorNode.id);
    return;
  }
  if (action === 'ai-edit' && node) return openAI(node.id, 'advanced');
  if (action === 'open-atelier' && node) {
    if (node.variant === 'ai') return openAI(node.id, 'collage');
    if (!node.src) return toast('请先选中一张照片。');
    return openAI(null, 'collage', node);
  }
  aiContext(action);
};
render();
