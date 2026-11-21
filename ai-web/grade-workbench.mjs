import {presetGroups, presets, globalControls, colorControls, localControls, channels, gradeSettings} from './grade-recipes.mjs';

const glyphs = {
  back:'M20 12H4m7-7-7 7 7 7', undo:'m9 14-5-5 5-5M4 9h10a6 6 0 0 1 0 12h-2', redo:'m15 14 5-5-5-5m5 5H10a6 6 0 1 0 0 12h2',
  ai:'M3 3h18v18H3zM6.5 16l3.2-8h.6l3.2 8m-5.7-3h4.4M17 8v8', split:'M3 5h18v14H3zM12 5v14', expand:'M9 4H4v5m11-5h5v5M4 15v5h5m11-5h5v-5',
  check:'m5 12 4 4 10-10', arrows:'m9 8-4 4 4 4m6-8 4 4-4 4', mask:'M4 9V5h4m8 0h4v4M4 15v4h4m8 0h4v-4M8 17c0-4 8-4 8 0M14.3 10a2.3 2.3 0 1 1-4.6 0 2.3 2.3 0 1 1 4.6 0',
};
const icon = (id, className='') => `<svg viewBox="0 0 24 24" class="${className}" aria-hidden="true"><path d="${glyphs[id]}"/></svg>`;
const iconButton = (id, label) => `<button type="button" class="grade-icon" data-grade-action="${id}" aria-label="${label}" title="${label}">${icon(id)}</button>`;
const groups = [['global','全局'],['color','颜色'],['local','局部']];
const modes = [['original','原图'],['ai','AI 初稿'],['current','当前'],['split','对比']];
const format = (val, unit) => `${val > 0 && unit !== '%' ? '+' : ''}${unit===' EV' ? Number(val).toFixed(2) : val}${unit}`;
const loadImage = async src => {
  const response = await fetch(src);
  if (!response.ok) throw new Error('无法读取输入照片');
  return response.blob();
};
function client() {
  const worker = new Worker(new URL('./grade-worker.mjs', import.meta.url), {type:'module'});
  const pending = new Map();
  let next = 0, stopped = false;
  function fail(message) {
    stopped=true;
    worker.terminate();
    for (const {reject} of pending.values()) reject(new Error(message));
    pending.clear();
  }
  worker.onmessage = ({data:{id, value, error}}) => {
    const job = pending.get(id);
    if (!job) return;
    pending.delete(id);
    if (error) job.reject(new Error(error)); else job.resolve(value);
  };
  worker.onerror = () => fail('无法启动调色处理，请重新打开工作台');
  return {
    stop: () => fail('工作台已关闭'),
    send(type,payload,transfer=[]) {
      if (stopped) return Promise.reject(new Error('工作台已关闭'));
      return new Promise((resolve,reject) => {
        const id=++next;
        pending.set(id,{resolve,reject});
        worker.postMessage({id,type,payload},transfer);
      });
    },
  };
}
function markup() {
  return `<main class="grade-shell">
    <header class="grade-top"><button type="button" class="grade-return" data-grade-action="back" aria-label="返回画布">${icon('back')}<span>返回画布</span></button><span class="grade-brand">FrameLab</span><span class="grade-slash">/</span><h1 id="grade-title">AI 调色</h1><span class="grade-file"></span>
      <div class="grade-top-actions">${iconButton('undo','撤销')}${iconButton('redo','重做')}<button type="button" class="grade-outline" data-grade-action="export">导出</button><button type="button" class="grade-primary" data-grade-action="save">保存到画布</button></div>
    </header>
    <div class="grade-workspace">
      <section class="grade-center" aria-label="照片预览">
        <div class="grade-stage"><div class="grade-empty" role="status">正在读取照片…</div><figure class="grade-photo" data-view="current" hidden>
          <img data-photo="current" alt="当前调色预览" draggable="false"><img data-photo="original" alt="原图预览" draggable="false"><img data-photo="ai" alt="AI 初稿预览" draggable="false">
          <canvas class="grade-mask-overlay" hidden aria-hidden="true"></canvas><span class="grade-photo-caption grade-caption-original">原图</span><span class="grade-photo-caption grade-caption-current">当前</span><span class="grade-photo-handle"><span>${icon('arrows')}</span></span><input type="range" class="grade-photo-split" min="0" max="100" value="50" aria-label="原图与当前效果的分割位置"></figure></div>
        <div class="grade-center-foot">
          <div class="grade-preview-tools">
            <div class="grade-segment" role="group" aria-label="预览方式">${modes.map(([id,label])=>`<button type="button" data-view="${id}" aria-pressed="${id==='current'}"${id==='ai'?' disabled':''}>${id==='split'?icon('split'):''}${label}</button>`).join('')}</div>
            <button type="button" class="grade-zoom" data-grade-action="zoom" aria-pressed="false">${icon('expand')}<span>适合窗口</span></button>
          </div>
          <span class="grade-note" role="status" aria-live="polite"></span>
        </div>
      </section>
      <aside class="grade-inspector" aria-label="调色工具">
        <div class="grade-inspector-head">
          <div class="grade-quick-tools">
            <button type="button" class="grade-outline grade-auto" data-grade-action="auto">${icon('ai')}<span>AI 一键调色</span></button>
            <button type="button" class="grade-outline grade-auto-correction" data-grade-action="correct">自动校正</button>
          </div>
          <div class="grade-panel-switch" role="group" aria-label="调色面板">
            <button type="button" data-grade-panel="presets" aria-controls="grade-panel-presets" aria-pressed="true">模板</button>
            <button type="button" data-grade-panel="adjustments" aria-controls="grade-panel-adjustments" aria-pressed="false">调整</button>
          </div>
        </div>
        <section id="grade-panel-presets" class="grade-panel grade-left" aria-label="模板">
          <div class="grade-template-head"><button type="button" data-grade-action="clear-preset">移除模板</button></div>
          ${presetGroups.map(([group, keys])=>`<section class="grade-template-group"><h3>${group}</h3><div class="grade-template-grid">${keys.map(key=>`<button type="button" class="grade-preset" data-preset="${key}" aria-pressed="false"><img alt="">${icon('check','grade-preset-check')}<span>${presets[key].name}</span></button>`).join('')}</div></section>`).join('')}
          <div class="grade-subject-entry"><button type="button" data-grade-action="subject-panel">${icon('mask')}<span>主体突出</span>${icon('arrows')}</button></div>
        </section>
        <section id="grade-panel-adjustments" class="grade-panel grade-right" aria-label="调整" hidden>
          <div class="grade-adjust-head">
            <div class="grade-tabs" role="group" aria-label="调整类型">${groups.map(([id,label])=>`<button type="button" data-tab="${id}" aria-pressed="${id==='global'}">${label}</button>`).join('')}</div>
            <button type="button" data-grade-action="reset">重置</button>
          </div>
          <div class="grade-tab-body"></div>
        </section>
        <div class="grade-history"><strong>最近操作</strong><p>已打开照片</p></div>
      </aside>
    </div>
  </main>`;
}
let dialog, editorOpen=false;
export async function openGradeWorkbench({source, name, saved, savedPreview, legacyPreview, autoStrength, enhance, save, download}) {
  if (editorOpen) return;
  if (!dialog) {
    dialog = document.createElement('dialog');
    dialog.id='grade-workbench';
    dialog.setAttribute('aria-labelledby','grade-title');
    document.body.append(dialog);
  }
  dialog.innerHTML = markup();
  const $ = selector => dialog.querySelector(selector);
  const $$ = selector => [...dialog.querySelectorAll(selector)];
  const action = id => $(`[data-grade-action="${id}"]`);
  const photo = $('.grade-photo');
  const original = $('[data-photo="original"]');
  const overlay = $('.grade-mask-overlay');
  const status = $('.grade-center-foot [role="status"]');
  const pane = $('.grade-tab-body');
  $('.grade-file').textContent = name || '';
  const engine = client();
  let idea = gradeSettings(saved || {base:legacyPreview?'legacy':'original', aiStrength:autoStrength});
  let savedText=JSON.stringify(idea), compare = 'current', selectedTab = 'global', channel='orange';
  let loaded, originalBitmap, baseId, previewURL, aiURL, baseVersion=0, maskVersion=0, isClosed=false, workerRendered=false;
  let paintMode = '', showOverlay=false, sampling=false, busy=null, brushFrame=0, frame=0, renderToken=0, pointerStroke=null, latestOutput, lastMask, activeRange;
  let rendering=false, maskPending=false;
  const urls = new Set();
  const maskPool = new Map();
  const corrections = new Map();
  const aiDrafts = new Map();
  const undo = [], redo = [];
  const events = new AbortController();
  const urlFor = blob => {const url=URL.createObjectURL(blob);urls.add(url);return url;};
  const release = url => {if(url){URL.revokeObjectURL(url);urls.delete(url);}};
  const report = text => $('.grade-history p').textContent = text;
  const message = text => {if(!isClosed) status.textContent=text;};
  const setEnabled = () => {
    const ready=Boolean(loaded);
    action('undo').disabled=!undo.length || Boolean(busy);
    action('redo').disabled=!redo.length || Boolean(busy);
    action('save').disabled=!workerRendered || Boolean(busy);
    action('export').disabled=!workerRendered || Boolean(busy);
    action('auto').disabled=!ready;
    action('correct').disabled=!ready || Boolean(busy);
    action('correct').textContent=idea.base==='original'?'自动校正':'取消自动校正';
    action('clear-preset').disabled=!idea.preset;
    action('reset').disabled=!ready;
    action('subject-panel').disabled=!ready;
    action('zoom').disabled=!ready;
    for (const button of $$('[data-preset]')) {
      button.disabled=!ready;
      button.setAttribute('aria-pressed',button.dataset.preset===idea.preset);
    }
    for (const button of $$('.grade-segment button')) button.disabled=!ready || (button.dataset.view==='ai'&&!aiURL);
    action('auto').querySelector('span').textContent=busy?'停止调色':'AI 一键调色';
    for (const control of $$('[data-setting="ai-strength"],[data-grade-reset="ai-strength"]')) control.disabled=!ready||Boolean(busy);
  };
  function setView(view) {
    compare=view;
    photo.dataset.view=view;
    for(const button of $$('.grade-segment button')) button.setAttribute('aria-pressed',button.dataset.view===view);
    for (const image of photo.querySelectorAll('img')) image.setAttribute('aria-hidden',String(image.dataset.photo!==view && !(view==='split'&&image.dataset.photo!=='ai')));
  }
  const baseKey = edit => edit.base==='original' ? '' : `${edit.base}:${edit.aiStrength}`;
  const maskKey = edit => edit.point?.join(',') || '';
  const draftKey = edit => `${baseKey(edit)}:${JSON.stringify(edit.draft)}`;
  function syncDraft() {
    const draft = idea.base==='original' ? null : aiDrafts.get(draftKey(idea)) || aiDrafts.get(baseKey(idea));
    aiURL=draft;
    if(draft) $('[data-photo="ai"]').src=draft;
    if(!draft && compare==='ai')setView('current');
    setEnabled();
  }
  async function resolveBase(edit, signal, onStatus=()=>{}) {
    const key = baseKey(edit);
    if (!key) return null;
    if (!corrections.has(key)) {
      const result = edit.base==='legacy' && legacyPreview ? legacyPreview : (await enhance(edit.aiStrength, signal, onStatus)).src;
      const blob = await loadImage(result);
      corrections.set(key,blob);
      if (corrections.size>5) corrections.delete(corrections.keys().next().value);
    }
    return corrections.get(key);
  }
  async function prepareBase(edit, signal, onStatus) {
    const key=baseKey(edit);
    if (!key) return false;
    const version=++baseVersion;
    const blob=await resolveBase(edit,signal,onStatus);
    if (version!==baseVersion || isClosed) return false;
    if (baseId!==key) {await engine.send('base',blob);baseId=key;}
    return true;
  }
  function showMaskCanvas(canvas) {
    overlay.width=canvas.width;overlay.height=canvas.height;
    const ctx=overlay.getContext('2d');
    ctx.drawImage(canvas,0,0);
    ctx.globalCompositeOperation='source-in';
    ctx.fillStyle='#5073f677';ctx.fillRect(0,0,overlay.width,overlay.height);
    ctx.globalCompositeOperation='source-over';
    overlay.hidden=false;
  }
  function previewBrush() {
    cancelAnimationFrame(brushFrame);
    brushFrame=requestAnimationFrame(async()=>{
      const {drawMask}=await import('./grade-mask.mjs');
      if(!pointerStroke || isClosed)return;
      const scale=Math.min(1,600/Math.max(loaded.width,loaded.height));
      const canvas=drawMask(Math.round(loaded.width*scale),Math.round(loaded.height*scale),maskPool.get(maskKey(idea)),[...idea.strokes,pointerStroke],idea.local.feather);
      showMaskCanvas(canvas);
    });
  }
  async function buildMask(edit) {
    const version=++maskVersion;
    const key=maskKey(edit);
    const strokes=edit.strokes;
    const inputKey = JSON.stringify([key, strokes, edit.local.feather]);
    if(inputKey===lastMask) return;
    let mask = null;
    if (maskPool.has(key) || strokes.length) {
      const engineMask=await import('./grade-mask.mjs');
      const subject=key?maskPool.get(key):null;
      const canvas=engineMask.drawMask(loaded.width,loaded.height,subject,strokes,edit.local.feather);
      const image=canvas.getContext('2d').getImageData(0,0,loaded.width,loaded.height);
      mask = new Uint8Array(loaded.width*loaded.height);
      for(let i=0;i<mask.length;i++) mask[i]=image.data[i*4+3];
      if (version!==maskVersion || isClosed) return;
      if (showOverlay || paintMode) showMaskCanvas(canvas);
    } else overlay.getContext('2d').clearRect(0,0,overlay.width,overlay.height);
    lastMask=inputKey;
    overlay.hidden=!(mask&&(showOverlay||paintMode));
    await engine.send('mask',mask,mask?[mask.buffer]:[]);
  }
  function markRendering() {
    workerRendered=false;
    setEnabled();
  }
  function queueRender(refreshMask=false) {
    if (isClosed || !loaded) return;
    markRendering();
    renderToken++;
    maskPending ||= refreshMask;
    if(rendering) return;
    cancelAnimationFrame(frame);
    frame=requestAnimationFrame(renderFrame);
  }
  async function renderFrame() {
    const token=renderToken;
    const edit=gradeSettings(idea);
    const maskChanged=maskPending;
    maskPending=false;
    rendering=true;
    try {
      if (maskChanged) await buildMask(edit);
      if (token!==renderToken || isClosed) return;
      const useBase=edit.base!=='original' && baseId===baseKey(edit);
      if(edit.base!=='original'&&!useBase)return;
      const blob=await engine.send('render',{edit,useBase,quality:.94});
      if (token!==renderToken || isClosed) return;
      const old=previewURL;
      previewURL=urlFor(blob);
      $('[data-photo="current"]').src=previewURL;
      release(old);
      latestOutput=blob;workerRendered=true;
      setEnabled();
    }catch(error){message(error.message);}
    finally {
      rendering=false;
      if(token!==renderToken && !isClosed)queueRender();
    }
  }
  function checkpointPrevious(previous) {
    undo.push(previous);
    if(undo.length>40) undo.shift();
    redo.length=0;
  }
  function messageCurrent() {
    message(`${presets[idea.preset]?.name || (idea.base!=='original'?'自动校正':'手动调整')} · 原图已保留`);
  }
  function apply(next,label,{refresh=false}={}) {
    const updated=gradeSettings(next);
    if(JSON.stringify(updated)===JSON.stringify(idea)) return;
    checkpointPrevious(idea);
    idea=updated;
    report(label);
    if(compare==='original'||compare==='ai')setView('current');
    syncDraft();showTab();messageCurrent();queueRender(refresh);
  }
  function field(id,label,min,max,step,unit,value,disabled=false) {
    return `<div class="grade-control"><label for="grade-slider-${id}">${label}</label><button type="button" class="grade-value" aria-label="重置${label}" title="重置${label}" data-grade-reset="${id}"${disabled?' disabled':''}>${format(value,unit)}</button><input id="grade-slider-${id}" type="range" min="${min}" max="${max}" step="${step}" value="${value}" data-setting="${id}" data-unit="${unit}"${disabled?' disabled':''}></div>`;
  }
  const fieldset = (items, values, unavailable=false) => items.map(spec=>field(...spec, values?.[spec[0]]||0, unavailable)).join('');
  function showTab(animate=false) {
    for(const tab of $$('.grade-tabs [data-tab]'))tab.setAttribute('aria-pressed',tab.dataset.tab===selectedTab);
    delete pane.dataset.enter;
    if(selectedTab==='global')pane.innerHTML=`<div class="grade-strength">${field('strength','模板强度',0,100,1,'%',idea.strength,!idea.preset||!loaded)}${idea.base==='original'?'':field('ai-strength','调色强度',0,100,1,'%',Math.round(idea.aiStrength*100),!loaded||Boolean(busy))}</div><h3 class="grade-section-label">光线与色彩</h3>${fieldset(globalControls,idea.global,!loaded)}`;
    if(selectedTab==='color')pane.innerHTML=`<div class="grade-strength"><label class="grade-control">颜色范围<select data-grade-channel${loaded?'':' disabled'}>${channels.map(([id,label])=>`<option value="${id}"${id===channel?' selected':''}>${label}</option>`).join('')}</select></label></div><h3 class="grade-section-label">色相、饱和度与明度</h3>${fieldset(colorControls,idea.colors[channel],!loaded)}`;
    if(selectedTab==='local'){
      const hasMask=Boolean(idea.point||idea.strokes.length);
      pane.innerHTML=`<div class="grade-strength"><div class="grade-local-buttons"><button type="button" class="grade-outline" data-grade-action="mask" aria-pressed="${paintMode==='select'}">${icon('mask')} ${idea.point?'重新选择主体':'选择主体'}</button><button type="button" class="grade-outline" data-grade-action="mask-show" aria-pressed="${showOverlay}"${hasMask?'':' disabled'}>显示蒙版</button></div><div class="grade-local-buttons grade-brush-controls"><button type="button" class="grade-outline" data-grade-action="brush" aria-pressed="${paintMode==='brush'}">画笔</button><button type="button" class="grade-outline" data-grade-action="erase" aria-pressed="${paintMode==='erase'}"${hasMask?'':' disabled'}>擦除</button><button type="button" class="grade-outline" data-grade-action="mask-clear"${hasMask?'':' disabled'}>清除</button></div><p class="grade-info">${paintMode==='select'?'点选照片中的主体。':paintMode?'在照片上拖动来修正蒙版。':hasMask?'主体和背景可以分别调整。':'点选主体，或用画笔手动创建蒙版。'}</p></div><h3 class="grade-section-label">主体与背景</h3>${fieldset(localControls,idea.local,!hasMask)}`;
    }
    if(animate)pane.dataset.enter='';
  }
  function setTab(tab,animate) {
    if(tab!==selectedTab&&paintMode) setPaint('');
    if(tab!==selectedTab){selectedTab=tab;showTab(animate);}
  }
  function setPanel(panel) {
    if(panel==='presets'&&paintMode)setPaint('');
    for(const button of $$('[data-grade-panel]')){
      const active=button.dataset.gradePanel===panel;
      button.setAttribute('aria-pressed',String(active));
      document.getElementById(button.getAttribute('aria-controls')).hidden=!active;
    }
  }
  function setPaint(value) {
    paintMode=value;
    photo.dataset.paint=value;
    if(value){setView('current');photo.tabIndex=0;photo.setAttribute('aria-label','主体选区。可以按回车尝试选取画面中央。');}
    else{photo.removeAttribute('tabindex');photo.removeAttribute('aria-label');}
    showTab();
    if(value)photo.focus();
  }
  function coords(event) {
    const rect=photo.getBoundingClientRect();
    return [Math.min(1,Math.max(0,(event.clientX-rect.left)/rect.width)),Math.min(1,Math.max(0,(event.clientY-rect.top)/rect.height))];
  }
  async function getSubject(point) {
    const key=point.join(',');
    if(!maskPool.has(key)){
      const {subjectMask}=await import('./grade-mask.mjs');
      const mask=await subjectMask(originalBitmap,point);
      if(maskPool.size>=8)maskPool.delete(maskPool.keys().next().value);
      maskPool.set(key,mask);
    }
  }
  async function selectMask(point) {
    if(sampling || isClosed) return;
    sampling=true;message('正在识别主体…');
    try {
      await getSubject(point);
      if(isClosed||paintMode!=='select')return;
      showOverlay=true;lastMask=null;setPaint('');
      apply({...idea,point,local:{...idea.local,subject:idea.local.subject??.2,background:idea.local.background??-.15}},'已选择主体',{refresh:true});
      showTab();
    }catch(error){setPaint('');message(`${error.message || '无法识别主体'}，可使用画笔手动选择`);}
    finally{sampling=false;}
  }
  function maskVisibility() {
    showOverlay=!showOverlay;lastMask=null;showTab();
    if(!showOverlay)overlay.hidden=true;
    buildMask(idea).catch(error=>message(error.message));
  }
  async function restoreHistory(from,to,label) {
    if(!from.length || busy) return;
    to.push(idea); idea=from.pop();
    setPaint('');report(label);syncDraft();showTab();markRendering();
    try {
      if(idea.point)await getSubject(idea.point);
      if(await prepareBase(idea,events.signal))await prepareDraft(idea);
      syncDraft();
      lastMask=null;messageCurrent();queueRender(true);
    }catch(error){message(error.message);}
  }
  async function prepareDraft(edit) {
    const base = corrections.get(baseKey(edit));
    if(!base || isClosed) return;
    const key = draftKey(edit);
    if(aiDrafts.has(key))return;
    if(!edit.draft?.preset && !Object.keys(edit.draft?.global || {}).length){aiDrafts.set(key,urlFor(base));return;}
    const draft=await engine.send('render',{edit:edit.draft,useBase:true,quality:.9});
    if(!isClosed)aiDrafts.set(key,urlFor(draft));
  }
  async function runAuto(withTemplate) {
    if(busy){busy.abort();return;}
    busy=new AbortController();const signal=busy.signal;
    const planned=gradeSettings({...idea,base:'auto'});
    const offerValues=withTemplate && !undo.length && !idea.draft && !Object.keys(idea.global).length;
    const proposed=offerValues ? loaded.suggested.global : {};
    if(withTemplate){planned.preset=loaded.suggested.preset || idea.preset;planned.strength=planned.preset?55:idea.strength;}
    planned.draft={preset:withTemplate?planned.preset:'',strength:withTemplate?planned.strength:0,global:proposed};
    setEnabled();message('正在自动校正…');
    try {
      if(!await prepareBase(planned,signal,message) || signal.aborted || isClosed)return;
      await prepareDraft(planned);
      if(signal.aborted || isClosed)return;
      const current={...idea,base:planned.base,draft:planned.draft,global:{...proposed,...idea.global}};
      if(withTemplate){current.preset=planned.preset;current.strength=planned.strength;}
      apply(current,withTemplate?'AI 一键调色':'应用自动校正');
      syncDraft();messageCurrent();queueRender();
    }catch(error){message(error.name==='AbortError'?'已停止调色':error.message);}
    finally{busy=null;if(!isClosed)setEnabled();}
  }
  async function setCorrectionStrength(strength) {
    if(busy || idea.aiStrength===strength)return;
    const next=gradeSettings({...idea,base:'auto',aiStrength:strength});
    busy=new AbortController();const signal=busy.signal;
    setEnabled();
    try {
      if(!await prepareBase(next,signal,message) || signal.aborted || isClosed)return;
      await prepareDraft(next);
      if(!isClosed&&!signal.aborted)apply({...idea,base:next.base,aiStrength:strength},'调整调色强度');
    }catch(error){message(error.name==='AbortError'?'已停止调色':error.message);}
    finally {busy=null;if(!isClosed){showTab();setEnabled();}}
  }
  function closeRequest() {
    if(JSON.stringify(idea)!==savedText && !window.confirm('有尚未保存的调整，返回画布并放弃这些修改？'))return;
    dialog.close();
  }
  dialog.addEventListener('cancel',event=>{event.preventDefault();closeRequest();},{signal:events.signal});
  dialog.addEventListener('close',()=>{
    isClosed=true;editorOpen=false;busy?.abort();events.abort();cancelAnimationFrame(frame);cancelAnimationFrame(brushFrame);originalBitmap?.close();engine.stop();
    for(const url of urls)URL.revokeObjectURL(url);
  },{once:true});
  dialog.addEventListener('keydown',event=>{
    event.stopPropagation();
    if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='z'){
      event.preventDefault();event.shiftKey?restoreHistory(redo,undo,'已重做'):restoreHistory(undo,redo,'已撤销');
    }
    if(event.target===photo&&paintMode==='select'&&event.key==='Enter')selectMask([.5,.5]);
    if(event.target.matches('[data-setting]')&&/^(Arrow|Home|End|Page)/.test(event.key))activeRange=idea;
  },{signal:events.signal});
  dialog.addEventListener('click',async event=>{
    const button=event.target.closest('button');
    if(!button)return;
    const {preset,tab,view,gradeAction:id,gradeReset,gradePanel}=button.dataset;
    if(gradeReset){
      const slider=$(`[data-setting="${gradeReset}"]`);
      const value=gradeReset==='feather'?24:gradeReset==='strength'?70:gradeReset==='ai-strength'?60:0;
      slider.value=value;slider.dispatchEvent(new Event('input',{bubbles:true}));slider.dispatchEvent(new Event('change',{bubbles:true}));
      return;
    }
    if(preset){apply({...idea,preset},`应用「${presets[preset].name}」`);return;}
    if(gradePanel){setPanel(gradePanel);return;}
    if(tab){setTab(tab,event.detail>0);return;}
    if(view){if(paintMode)setPaint('');setView(view);return;}
    if(id==='back')closeRequest();
    if(id==='undo')restoreHistory(undo,redo,'已撤销');
    if(id==='redo')restoreHistory(redo,undo,'已重做');
    if(id==='subject-panel'){
      setPanel('adjustments');
      setTab('local',event.detail>0);
      $('[data-tab="local"]').focus({preventScroll:true});
    }
    if(id==='auto')runAuto(true);
    if(id==='correct'){
      if(idea.base==='original')runAuto(false);
      else apply({...idea,base:'original',draft:null},'取消自动校正');
    }
    if(id==='clear-preset')apply({...idea,preset:''},'移除模板');
    if(id==='mask')setPaint(paintMode==='select'?'':'select');
    if(id==='brush'||id==='erase')setPaint(paintMode===id?'':id);
    if(id==='mask-show')maskVisibility();
    if(id==='mask-clear'){setPaint('');apply({...idea,point:null,strokes:[],local:{}},'已清除蒙版',{refresh:true});}
    if(id==='reset'){
      if(selectedTab==='global')apply({...idea,global:{},strength:70},'重置全局调整');
      if(selectedTab==='color')apply({...idea,colors:{...idea.colors,[channel]:{}}},'重置当前颜色');
      if(selectedTab==='local')apply({...idea,local:{}},'重置局部调整',{refresh:true});
    }
    if(id==='zoom'){
      const enabled=photo.classList.toggle('grade-photo-zoomed');
      button.querySelector('span').textContent=enabled?'放大':'适合窗口';
      button.setAttribute('aria-pressed',enabled);
    }
    if(id==='export' && latestOutput)download(latestOutput);
    if(id==='save' && latestOutput && workerRendered){
      try {
        const edit=gradeSettings(idea);
        await save(edit,latestOutput,loaded);
        savedText=JSON.stringify(edit);
        if(!isClosed){report('已保存到画布');message('已保存到画布 · 原图已保留');}
      }catch(error){message(error.message);}
    }
  },{signal:events.signal});
  dialog.addEventListener('input',event=>{
    const input=event.target;
    if(input.matches('.grade-photo-split')) {photo.style.setProperty('--grade-split',`${input.value}%`);return;}
    const id=input.dataset.setting;
    if(!id)return;
    if(id==='ai-strength'){input.previousElementSibling.textContent=format(Number(input.value),'%');return;}
    activeRange??=idea;
    const value=Number(input.value);
    const values=selectedTab==='global'?{global:{...idea.global,[id]:value}}:selectedTab==='color'?{colors:{...idea.colors,[channel]:{...idea.colors[channel],[id]:value}}}:{local:{...idea.local,[id]:value}};
    idea=gradeSettings({...idea,...(id==='strength'?{strength:value}:values)});
    input.previousElementSibling.textContent=format(value,input.dataset.unit);
    if(compare==='ai'||compare==='original')setView('current');
    queueRender(id==='feather');
  },{signal:events.signal});
  dialog.addEventListener('change',event=>{
    const input=event.target;
    if(input.matches('[data-grade-channel]')) {channel=input.value;showTab();$('[data-grade-channel]').focus();return;}
    if(!input.dataset.setting)return;
    if(input.dataset.setting==='ai-strength'){activeRange=null;setCorrectionStrength(Number(input.value)/100);return;}
    if(activeRange && JSON.stringify(activeRange)!==JSON.stringify(idea))checkpointPrevious(activeRange);
    activeRange=null;setEnabled();
    report(`调整${input.parentElement.firstElementChild.textContent}`);
  },{signal:events.signal});
  photo.addEventListener('pointerdown',event=>{
    if(event.button!==0||!paintMode||sampling)return;
    event.preventDefault();
    if(paintMode==='select'){selectMask(coords(event));return;}
    if(idea.strokes.length>=80){message('画笔步数已达上限，请先清除部分蒙版');return;}
    pointerStroke={erase:paintMode==='erase',radius:.035,points:[coords(event)]};
    photo.setPointerCapture(event.pointerId);
    showOverlay=true;lastMask=null;
    previewBrush();
  },{signal:events.signal});
  photo.addEventListener('pointermove',event=>{
    if(!pointerStroke || pointerStroke.points.length>=160)return;
    const [x,y]=coords(event), [a,b]=pointerStroke.points.at(-1);
    if(Math.hypot(x-a,y-b)<.012)return;
    pointerStroke.points.push([x,y]);
    previewBrush();
  },{signal:events.signal});
  photo.addEventListener('pointerup',()=>{
    if(!pointerStroke)return;
    apply({...idea,strokes:[...idea.strokes,pointerStroke]},pointerStroke.erase?'擦除蒙版':'绘制蒙版',{refresh:true});
    pointerStroke=null;
  },{signal:events.signal});
  photo.addEventListener('pointercancel',()=>{
    if(pointerStroke){pointerStroke=null;lastMask=null;queueRender(true);}
  },{signal:events.signal});
  showTab();setEnabled();setView('current');
  dialog.showModal();editorOpen=true;
  if(!source){$('.grade-empty').textContent='将照片连接到这里';return;}
  try {
    const blob=await loadImage(source);
    loaded=await engine.send('open',blob);
    if(isClosed)return;
    original.src=urlFor(blob);
    photo.style.setProperty('--grade-ratio',`${loaded.width} / ${loaded.height}`);
    photo.style.setProperty('--grade-photo-aspect',loaded.width/loaded.height);
    photo.hidden=false;$('.grade-empty').hidden=true;
    originalBitmap=await createImageBitmap(blob,{resizeWidth:loaded.width,resizeHeight:loaded.height});
    if(isClosed){originalBitmap.close();return;}
    $('[data-photo="current"]').src=savedPreview||original.src;
    messageCurrent();setEnabled();showTab();
    engine.send('thumbnail').then(looks=>{if(!isClosed)for(const [key,preview] of looks)$(`[data-preset="${key}"] img`).src=urlFor(preview);}).catch(error=>message(error.message));
    if(idea.base!=='original'){
      try {
        if(await prepareBase(idea,events.signal,message))await prepareDraft(idea);
      }catch(error){message(error.message);}
      syncDraft();
    }
    if(idea.point){try{await getSubject(idea.point);}catch(error){message(error.message);}}
    if(!isClosed && (idea.base==='original' || baseId===baseKey(idea)))queueRender(true);
  }catch(error){if(!isClosed){$('.grade-empty').textContent=error.message;message(error.message);}}
}
