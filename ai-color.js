// FrameLab keeps the input photo separate from its edited output.
paths.ai='M4 4h16v16H4Z M7 15l3-6 3 6m-5-2h4 M16 9v6';
paths.collage='M3 3h10v18H3zM16 3h5v8h-5zM16 14h5v7h-5z';
const photoWorkbenchNames = {ai:'AI 调色', collage:'抠图拼图'};
const photoWorkbenchSize = {w:280, h:220};
for (const [type, label] of Object.entries(photoWorkbenchNames)) {
  const id = type === 'collage' ? ' id="atelier-launch"' : '';
  $('#tools').insertAdjacentHTML('beforeend', `<button type="button" class="palette-tool"${id} data-tool="${type}" title="拖到画布创建 ${label}" aria-pressed="false"><i class="tool-glyph">${icon(type)}</i><span>${label}</span></button>`);
}

function isPhotoWorkbench(node) {
  return node?.variant === 'ai' || node?.variant === 'collage';
}

function photoInputEdge(from, to) {
  return {id:crypto.randomUUID(), from:from.id, to:to.id, bend:0, kind:to.variant + '-input'};
}

function createPhotoWorkbench(variant, point, input) {
  checkpoint();
  const node = {
    id:crypto.randomUUID(), type:'image', variant, name:photoWorkbenchNames[variant],
    parentBoardId:state.activeBoardId || null, x:point?.x ?? 100, y:point?.y ?? 100,
    ...photoWorkbenchSize, r:0, z:Math.max(0,...state.objects.map(o => o.z || 0)) + 1, src:''
  };
  state.objects.push(node);
  if (input) (state.connections ??= []).push(photoInputEdge(input, node));
  selected = new Set([node.id]);
  update();
  return node;
}

const createCanvasTool = createTool;
createTool = function (type, point) {
  return Object.hasOwn(photoWorkbenchNames,type) ? createPhotoWorkbench(type,point) : createCanvasTool(type,point);
};
const canvasPalettePreview = palettePreview;
palettePreview = function (type) {
  if (!Object.hasOwn(photoWorkbenchNames,type)) return canvasPalettePreview(type);
  return {...photoWorkbenchSize, html:objectHTML({type:'image',variant:type,src:''})};
};

let workbenchRenderGraph;
const canvasObjectHTML = objectHTML;
objectHTML = function (node) {
  if (!isPhotoWorkbench(node)) return canvasObjectHTML(node);
  const graph = workbenchRenderGraph || createWorkbenchGraph();
  const collage = node.variant === 'collage';
  const input = graph.input(node);
  const source = graph.source(node);
  const output = graph.output(node);
  const image = output || source;
  const status = output ? '已输出' : input && !source ? '等待上游输出'
    : source && (node.src || node.colorBoardEdit || node.collageEdit) ? '输入已更新'
    : source ? (collage ? '待编辑' : '等待调色') : '等待连接';
  const title = node.aiEditor === 'collage' && !collage ? '拼图' : photoWorkbenchNames[node.variant];
  const alt = output ? (collage || node.aiEditor === 'collage' ? '拼贴结果' : '调色结果') : '输入照片';
  const empty = input ? '上游成品回到画布后会传入' : collage ? '将照片连线到此处' : '连接照片，或双击打开调色';
  const body = image
    ? `<img src="${esc(image)}" alt="${alt}" draggable="false">`
    : `<div class="ps-empty">${empty}</div>`;
  return `<div class="inner ps-node ai-node"><div class="ps-title">${title} <span>${status}</span></div>${body}<small>${collage ? '双击打开' : '双击调整'}</small></div>`;
};

const aiRender = render;
render = function () {
  workbenchRenderGraph = createWorkbenchGraph();
  try {
    aiRender();
  } finally {
    workbenchRenderGraph = undefined;
  }
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

function openAI(id, mode) {
  const node = state.objects.find(object => object.id === id);
  if (colorBoardSession || !isPhotoWorkbench(node)) return;
  const graph = createWorkbenchGraph();
  const input = graph.input(node);
  const source = graph.source(node);
  if (input && !source) return toast('请先将上游工作台的成品保存到画布');
  const sameInput = (node.aiInput || '') === source;
  const project = sameInput && node.aiEditor !== 'basic' ? node.colorBoardEdit || null : null;
  const collageProject = sameInput ? node.collageEdit || null : null;
  const savedPhoto = graph.output(node);
  const legacyPreview = !project && node.aiEditor !== 'collage' ? savedPhoto : '';

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
  const initialMode = node.variant === 'collage' || node.aiEditor === 'collage' ? 'collage' : 'advanced';
  void showPhotoWorkbench(session, mode || initialMode);
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
  const source = session.node.variant === 'collage'
    ? session.source || session.savedPhoto
    : session.savedPhoto || session.source;
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
  focusCanvasObject(session.node.id);
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
  const graph = createWorkbenchGraph();
  if (colorBoardSession !== session || !state.objects.includes(session.node) ||
    graph.input(session.node)?.id !== session.inputId || graph.source(session.node) !== session.source) {
    throw new Error('连接的照片已改变，请重新打开工作台');
  }
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
    ensureColorBoardInput(session);
    const aspect = height / width;
    checkpoint();
    if ((session.node.aiInput || '') !== session.source) {
      delete session.node.gradeEdit;
      delete session.node.colorBoardEdit;
      delete session.node.collageEdit;
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

const canvasOpen = openObject;
openObject = function (id) {
  if (isPhotoWorkbench(state.objects.find(node => node.id === id))) return openAI(id);
  canvasOpen(id);
};

const canvasContext = handleContext;
handleContext = function (action) {
  const node = contextObject();
  if (node) {
    if (action === 'ai-edit') return openAI(node.id, 'advanced');
    if (action === 'open-atelier') return openAI(node.id, 'collage');
    if (action === 'to-ai' || action === 'to-atelier') {
      if (action === 'to-atelier' && !createWorkbenchGraph().output(node)) return toast('请先生成照片结果。');
      const variant = action === 'to-ai' ? 'ai' : 'collage';
      const output = createPhotoWorkbench(variant,{x:node.x + node.w + 80, y:node.y},node);
      if (variant === 'collage') return openAI(output.id);
      return;
    }
  }
  canvasContext(action);
};
render();
