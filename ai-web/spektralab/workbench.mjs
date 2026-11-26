import {loadCatalog} from './engine.mjs';
import {listPhotos,savePhoto} from './workspace-store.mjs';
import {decodeProject,encodeProject,maxPhotoBytes,photoType,rgbaTiff} from './frame-tools.mjs';

const $ = id => document.getElementById(id);
const photos = [];
const preview = $('preview'), original = $('original'), files = $('files'), stage = $('stage');
const nativeDefault = 'kodak_supra_endura';
const stockOrder = new Intl.Collator('zh-CN', {numeric:true});
let catalog, film, paper, photo, worker, current, pending, sequence = 0, timer;
let comparison = null, scale = 'fit', viewTurn = 0, busy = false, channel = null;
let referenceUrl, developmentStarted = false, previewFresh = false, previewTimerPending = false;
let mode = 'develop', descending = true, copiedSettings, libraryUnavailable = false;
const values = {};
const updater = [];
const appearanceDefaults = {
  aspect:'original',turn:0,flip:false,straighten:0,zoom:1,border:'none',
  imprint:'',imprintEnabled:false,corner:'right',stripLayer:false,
  rawTemperature:0,rawTint:1,outputSize:2048
};
let appearance = {...appearanceDefaults};
const channels = ['rgb','red','green','blue'];
const hues = ['red','orange','yellow','green','blue','purple'];
const curves = Object.fromEntries(channels.map(key => [key,0]));
const hsl = Object.fromEntries(hues.map(key => [key,{hue:0,saturation:0,luminance:0}]));
const controls = [
  ['develop','胶片曝光',[
    ['exposure','胶片曝光',-3,3,.05,0],
    ['gamma','显影反差',.5,1.5,.01,1], ['couplers','层间扩散',0,2,.05,1]
  ]],
  ['develop','颗粒与光晕',[
    ['grain','颗粒',0,2,.05,1], ['halation','光晕',0,3,.05,1],
    ['scatter','片基散射',0,3,.05,1], ['haloSize','光晕范围',.25,3,.05,1]
  ]],
  ['develop','印放与扫描',[
    ['printExposure','相纸曝光',-2,2,.05,0], ['magenta','品红滤镜',-40,40,1,0],
    ['yellow','黄色滤镜',-40,40,1,0], ['preflash','预曝光',0,.1,.005,0],
    ['glare','相纸眩光',0,.15,.005,.03]
  ]],
  ['edit','白平衡与色调',[
    ['temperature','色温',-100,100,1,0], ['tint','色调',-100,100,1,0],
    ['contrast','反差',-100,100,1,0], ['highlights','高光',-100,100,1,0],
    ['shadows','阴影',-100,100,1,0], ['whites','白色色阶',-100,100,1,0],
    ['blacks','黑色色阶',-100,100,1,0], ['saturation','饱和度',-100,100,1,0],
    ['vibrance','自然饱和度',-100,100,1,0]
  ]],
  ['edit','细节',[
    ['clarity','清晰度',-100,100,1,0], ['sharpen','锐化',0,100,1,0],
    ['dehaze','去雾',-100,100,1,0], ['vignette','暗角',0,100,1,0]
  ]],
  ['edit','RAW 解码',[
    ['rawTemperature','色温 K（0 为拍摄值）',0,12000,100,0],
    ['rawTint','RAW 色偏',.25,4,.01,1]
  ]]
];

function node(tag, text, props = {}) {
  return Object.assign(document.createElement(tag), {textContent:text}, props);
}
function pressed(element, value) { element.setAttribute('aria-pressed', String(value)); }
function status(text) { $('status').textContent = text; }

for (const [mode, title, entries] of controls) {
  const group = node('details','',{open:true});
  group.append(node('summary',title));
  for (const [key,label,min,max,step,initial] of entries) {
    values[key] = initial;
    const labelNode = node('label','',{className:'control'});
    const input = node('input','',{type:'range',min,max,step,value:initial,id:'value-'+key});
    const output = node('output',String(initial));
    updater.push(() => {input.value=values[key];output.value=input.value;});
    input.setAttribute('aria-label',label);
    input.addEventListener('input', () => {
      values[key] = input.valueAsNumber;
      output.value = input.value;
      schedule();
    });
    labelNode.append(node('span',label),input,output);
    group.append(labelNode);
  }
  const reset = node('button','重置'+title,{type:'button'});
  reset.addEventListener('click', () => {
    for (const [key,,,,,initial] of entries) {
      const input = $('value-'+key);
      input.value = initial;
      input.dispatchEvent(new Event('input'));
    }
  });
  group.append(reset);
  $(mode).append(group);
}

function channelControls(title, options, sliders) {
  const group = node('details','');
  group.append(node('summary',title));
  const menu = node('select','',{ariaLabel:title+'通道'});
  for (const [id,name] of options) menu.add(new Option(name,id));
  group.append(menu);
  const fields = sliders.map(({label,min,max,read,write}) => {
    const row = node('label','',{className:'control'});
    const input = node('input','',{type:'range',min,max,step:1,ariaLabel:label});
    const output = node('output','0');
    const refresh = () => {input.value = read(menu.value); output.value = input.value;};
    input.oninput = () => {write(menu.value,input.valueAsNumber); output.value=input.value; schedule();};
    row.append(node('span',label),input,output);
    group.append(row);
    return refresh;
  });
  menu.onchange = () => fields.forEach(refresh => refresh());
  updater.push(menu.onchange);
  menu.onchange();
  $('edit').append(group);
}
channelControls('RGB 曲线',channels.map((id,i) => [id,['主曲线','红','绿','蓝'][i]]),[
  {label:'中间调曲线',min:-45,max:45,read:id=>curves[id],write:(id,value)=>{curves[id]=value;}}
]);
channelControls('HSL 颜色混合',hues.map((id,i) => [id,['红','橙','黄','绿','蓝','紫'][i]]),
  [['hue','色相'],['saturation','饱和度'],['luminance','明度']].map(([key,label]) =>
    ({label,min:-100,max:100,read:id=>hsl[id][key],write:(id,value)=>{hsl[id][key]=value;}})));

function stockCategory(item) {
  if (item.bw) return '黑白';
  if (item.positive) return '反转片';
  if (/(vision|cinestill|eterna|exr)/i.test(item.id)) return '电影胶片';
  return '彩色负片';
}
function renderStocks() {
  if (!catalog) return;
  const category = $('category').value;
  const matches = catalog.profiles.filter(item => !item.paper && (!category || stockCategory(item) === category));
  const buttons = matches.sort((a,b) => stockOrder.compare(a.name,b.name)).map(item => {
    const button = node('button',item.name,{type:'button',title:item.name});
    button.dataset.stock = stockCategory(item);
    pressed(button, item.id === film.id);
    button.addEventListener('click', () => {
      if (film.positive && !item.positive) $('direct').checked = false;
      film = item;
      renderStocks();
      renderPapers();
      schedule();
    });
    return button;
  });
  $('film').replaceChildren(...buttons);
}
function renderPapers() {
  $('direct').checked ||= film.positive;
  $('direct').disabled = film.positive;
  const choices = catalog.profiles.filter(item => item.paper && item.bw === film.bw);
  paper = choices.find(item => item.id === paper?.id)
    || choices.find(item => item.id === nativeDefault) || choices[0];
  const options = [{name:'不印放',id:''},...choices];
  $('paper-cards').replaceChildren(...options.map(item => {
    const button=node('button',item.name,{type:'button',title:item.name,disabled:film.positive && !!item.id});
    button.dataset.stock = item.id ? '相纸' : '不印放';
    pressed(button,item.id ? !$('direct').checked && paper?.id === item.id : $('direct').checked);
    button.onclick = () => {
      $('direct').checked = !item.id;
      if (item.id) paper = item;
      renderPapers();
      schedule();
    };
    return button;
  }));
  $('stock-info').textContent = film.name + ($('direct').checked ? ' · 直接扫描' : ' · '+(paper?.name || ''));
}
$('category').append(...['','彩色负片','电影胶片','反转片','黑白'].map(name => node('option',name || '全部',{value:name})));
$('category').onchange = renderStocks;
function showMode(next) {
  mode = next;
  for (const item of ['gallery','develop','edit']) {
    $(item).hidden = item !== mode;
    pressed($(item+'-tab'), item === mode);
  }
  pressed($('toggle-grid'),mode === 'gallery');
  $('viewer-tools').hidden = mode === 'gallery';
  if (mode === 'gallery') setCropPanel(false);
  syncPreview();
}
for (const next of ['gallery','develop','edit']) $(next+'-tab').onclick = () => showMode(next);

const formats = [['110','13 × 17',17],['APS','16.7 × 30',30],['135','24 × 36',35],['120','56 × 56',56]];
// Material pairings based on https://spektralab.app/#films, mapped to the browser catalog.
// The two finishing controls were tuned against actual renders using photo-quality-grade v1.3.
const presetDefinitions = [
  ['日光人像','kodak_portra_160','kodak_portra_endura',56,{shadows:2,blacks:2}],
  ['街头纪实','kodak_portra_400','kodak_supra_endura',35,{shadows:0,blacks:3}],
  ['城市暮色','fujifilm_pro_400h','fujifilm_crystal_archive_typeii',35,{shadows:2,blacks:0}],
  ['夜景电影','kodak_vision3_500t','kodak_2383',35,{shadows:2,blacks:3}],
  ['黑白建筑','fujifilm_acros_100_ii','ilford_mgrc_deluxe_grade2',35,{shadows:0,blacks:3}],
  ['反转片风景','fujifilm_velvia_100',null,35,{shadows:0,blacks:4}]
];
const developPresets = new Map();
const presetMenu = $('develop-preset');
const applyPreset = $('apply-preset');
const presetMaterials = $('preset-materials');

function loadPresets() {
  const profiles = new Map(catalog.profiles.map(item => [item.id,item]));
  for (const [label,filmId,paperId,format,tone] of presetDefinitions) {
    const negative = profiles.get(filmId);
    const print = profiles.get(paperId);
    if (!negative || (paperId && !print)) continue;
    developPresets.set(filmId,{negative,print,format,tone});
    presetMenu.add(new Option(label,filmId));
  }
}

function refreshPreset() {
  const choice = developPresets.get(presetMenu.value);
  applyPreset.disabled = presetMenu.disabled || !choice;
  presetMaterials.hidden = !choice;
  if (choice) {
    const [formatName] = formats.find(([, , value]) => value === choice.format);
    presetMaterials.textContent = [choice.negative.name,choice.print?.name || '直接扫描',formatName].join(' · ');
  }
}

presetMenu.onchange = refreshPreset;
applyPreset.onclick = () => {
  const choice = developPresets.get(presetMenu.value);
  film = choice.negative;
  paper = choice.print;
  Object.assign(values,choice.tone,{format:choice.format});
  $('direct').checked = !choice.print;
  const category = $('category');
  if (category.value && category.value !== stockCategory(film)) category.value = stockCategory(film);
  renderStocks();
  renderPapers();
  updater.forEach(refresh => refresh());
  updateAppearance();
  schedule();
};

values.format = 35;
for (const [name,size,value] of formats) {
  const button = node('button','',{type:'button'});
  button.dataset.format = value;
  button.append(node('strong',name),node('small',size));
  button.onclick = () => {values.format=value;updateAppearance();schedule();};
  $('formats').append(button);
}

const appearanceInputs = {
  aspect:['aspect','value'],zoom:['crop-zoom','valueAsNumber'],straighten:['straighten','valueAsNumber'],
  border:['border','value'],imprint:['imprint','value'],imprintEnabled:['imprint-on','checked'],
  corner:['corner','value'],stripLayer:['strip-layer','checked']
};
const outputSizes = [...$('output-size').options].map(option => Number(option.value));
$('export-size').append(...[...$('output-size').options].map(option => option.cloneNode(true)));
function updateAppearance() {
  for (const [key,[id,prop]] of Object.entries(appearanceInputs)) $(id)[prop] = appearance[key];
  pressed($('flip'),appearance.flip);
  $('turn-value').value = appearance.turn*90+'°';
  $('output-size').value = $('export-size').value = appearance.outputSize;
  for (const button of $('formats').children) pressed(button,Number(button.dataset.format) === values.format);
}
for (const [key,[id,prop]] of Object.entries(appearanceInputs)) $(id).oninput = () => {
  appearance[key] = $(id)[prop];schedule();
};
for (const [id,delta] of [['turn-left',-1],['turn',1]]) $(id).onclick = () => {
  appearance.turn=(appearance.turn+delta+4)%4;
  updateAppearance();
  schedule();
};
for (const id of ['output-size','export-size']) $(id).onchange = event => {
  appearance.outputSize = Number(event.target.value);
  updateAppearance();
  if (photo && catalog) {
    photo.recipe = snapshotRecipe();
    persist(photo);
  }
};
$('flip').onclick = () => {appearance.flip=!appearance.flip;updateAppearance();schedule();};
updateAppearance();

const defaults = {...values};
function snapshotRecipe() {
  return {film:film.id,paper:paper?.id,scan:$('direct').checked,
    values:{...values},curves:{...curves},hsl:structuredClone(hsl),appearance:{...appearance}};
}
function restoreRecipe(recipe = {}) {
  const findStock = id => catalog.profiles.find(item => item.id === id);
  film = catalog.profiles.find(item => !item.paper && item.id === recipe.film) || findStock('kodak_portra_400');
  paper = catalog.profiles.find(item => item.paper && item.id === recipe.paper) || findStock(nativeDefault);
  $('direct').checked = recipe.scan === true;
  Object.assign(values,defaults);
  for (const [,,entries] of controls) for (const [key,,min,max] of entries) {
    const requested = recipe.values?.[key];
    if (Number.isFinite(requested)) values[key]=Math.min(max,Math.max(min,requested));
  }
  if (formats.some(([, , value]) => value === recipe.values?.format)) values.format=recipe.values.format;
  for (const key of channels) curves[key]=bounded(recipe.curves?.[key],-45,45,0);
  for (const hue of hues) for (const key of Object.keys(hsl[hue])) hsl[hue][key]=bounded(recipe.hsl?.[hue]?.[key],-100,100,0);
  const input = recipe.appearance || {};
  appearance = {...appearanceDefaults,
    aspect:['original','1:1','4:5','3:2','16:9'].includes(input.aspect) ? input.aspect : 'original',
    border:['none','135','120','paper'].includes(input.border) ? input.border : 'none',
    turn:Math.round(bounded(input.turn,0,3,0)),straighten:bounded(input.straighten,-20,20,0),
    zoom:bounded(input.zoom,.3,1,1),flip:input.flip===true,imprintEnabled:input.imprintEnabled===true,
    imprint:typeof input.imprint==='string' ? input.imprint.slice(0,32) : '',
    corner:input.corner==='left' ? 'left' : 'right',stripLayer:input.stripLayer===true,
    outputSize:outputSizes.includes(input.outputSize) ? input.outputSize : appearanceDefaults.outputSize
  };
  updater.forEach(refresh => refresh());
  updateAppearance();
  renderStocks();
  renderPapers();
}
function bounded(value,min,max,fallback) {
  return Number.isFinite(value) ? Math.min(max,Math.max(min,value)) : fallback;
}

function settings() {
  const params = structuredClone(catalog.defaults);
  Object.assign(params.camera,{auto_exposure:false, exposure_compensation_ev:values.exposure, film_format_mm:values.format});
  const neg = params.film_render;
  neg.density_curves_morph.active = values.gamma !== 1;
  neg.density_curves_morph.gamma_factor = values.gamma;
  neg.dir_couplers.active = values.couplers > 0;
  neg.dir_couplers.amount = values.couplers;
  neg.grain.active = values.grain > 0;
  const stockNoise = film.grain?.rms_granularity;
  if (stockNoise?.length) neg.grain.rms_granularity = stockNoise.map(amount => amount * values.grain);
  neg.halation.active = values.halation > 0 || values.scatter > 0;
  neg.halation.halation_amount = values.halation*(appearance.stripLayer ? 2 : 1);
  neg.halation.scatter_amount = values.scatter;
  neg.halation.halation_spatial_scale = values.haloSize;
  params.enlarger.print_exposure = 2 ** values.printExposure;
  params.enlarger.m_filter_shift = values.magenta;
  params.enlarger.y_filter_shift = values.yellow;
  params.enlarger.preflash_exposure = values.preflash;
  params.print_render.glare.active = values.glare > 0;
  params.print_render.glare.percent = values.glare;
  params.io.scan_film = $('direct').checked;
  const grade = Object.fromEntries(controls.filter(group => group[0] === 'edit' && group[1] !== 'RAW 解码')
    .flatMap(group => group[2].map(([key]) => [key,values[key]])));
  if (Object.values(curves).some(Boolean)) grade.curve = Object.fromEntries(channels.map(key =>
    [key,[[0,0],[.5,.5+curves[key]/100],[1,1]]]));
  if (Object.values(hsl).some(values => Object.values(values).some(Boolean))) grade.hsl = structuredClone(hsl);
  return {params,grade,film:film.id,paper:paper?.id || nativeDefault,appearance:{
    ...appearance,imprint:appearance.imprintEnabled ? appearance.imprint : '',
    rawTemperature:values.rawTemperature ? Math.max(2000,values.rawTemperature) : 0,rawTint:values.rawTint
  }};
}

function schedule() {
  if (!photo || !catalog) return;
  photo.recipe=snapshotRecipe();
  persist(photo);
  layoutViewport();
  if (!developmentStarted) return;
  clearTimeout(timer);
  pending = null;
  sequence++;
  previewFresh = false;
  previewTimerPending = true;
  refreshActions();
  timer = setTimeout(() => {
    previewTimerPending = false;
    submit('preview');
  },180);
}
function submit(kind) {
  const edge = kind === 'original' ? 1440 : kind === 'preview' ? 960 : kind === 'publish' ? 1680 : Number($('export-size').value);
  const recipe = kind === 'original' ? {params:catalog.defaults} : settings();
  const job = {id:++sequence,source:photo,...recipe,kind,edge,format:$('export-format').value,
    quality:Number($('export-quality').value)/100};
  pending = job;
  refreshActions();
  runNext();
}
function getWorker() {
  if (worker) return worker;
  worker = new Worker(new URL('./render-worker.mjs',import.meta.url),{type:'module'});
  worker.addEventListener('message', ({data}) => {
    if (data.id !== current?.id) return;
    const job = current;
    current = null;
    if (job.id === sequence) {
      if (data.error) status((job.kind === 'original' ? '原图解码失败：' : '渲染失败：') + data.error);
      else if (job.kind === 'original') paintOriginal(job.source,data.frame);
      else if (job.kind === 'preview') paint(data.frame);
      else void finishFrame(data.frame, job);
    }
    runNext();
  });
  worker.addEventListener('error', () => {
    worker.terminate();
    worker = current = pending = null;
    status('渲染引擎未能启动。请刷新页面后重试。');
    refreshActions();
  });
  return worker;
}
function runNext() {
  if (current || !pending) { refreshActions(); return; }
  current = pending;
  pending = null;
  status(current.kind === 'original' ? '正在解码原图…' : current.kind === 'preview' ? '正在冲洗预览…' : '正在渲染输出…');
  getWorker().postMessage(current);
  refreshActions();
}
function paint(frame) {
  preview.dataset.ready = 'yes';
  previewFresh = true;
  preview.width = frame.width;
  preview.height = frame.height;
  preview.getContext('2d').putImageData(new ImageData(new Uint8ClampedArray(frame.rgba),frame.width,frame.height),0,0);
  photo.dimensions = frame.sourceSize;
  drawHistogram(frame.rgba);
  $('backend').textContent = frame.backend;
  status(frame.width+' × '+frame.height+' · '+Math.round(frame.elapsedMs)+' ms');
  syncPreview();
}
function paintOriginal(item,frame) {
  item.dimensions=frame.sourceSize;
  if (item.thumbnail) URL.revokeObjectURL(item.thumbnail);
  item.thumbnail=URL.createObjectURL(frame.original);
  original.src=item.thumbnail;
  renderPhotos();
  describeOriginal();
  syncPreview();
}
function describeOriginal() {
  if (!photo || developmentStarted) return;
  const size=photo.dimensions;
  status(size ? '原图 · '+size.join(' × ')+' · 未冲洗' : '原图 · 未冲洗');
}
function drawExposure(rgba) {
  const canvas=$('exposure-meter'),ctx=canvas.getContext('2d');
  const bins=new Uint32Array(96);
  const linear=value=>value <= 10 ? value/3294.6 : ((value/255+.055)/1.055)**2.4;
  for (let i=0;i<rgba.length;i+=16) {
    const light=.2126*linear(rgba[i])+.7152*linear(rgba[i+1])+.0722*linear(rgba[i+2]);
    const ev=Math.log2(Math.max(light,.0007)/.18);
    bins[Math.min(95,Math.max(0,Math.floor((ev+8)*6)))]++;
  }
  ctx.clearRect(0,0,canvas.width,canvas.height);
  const peak=Math.max(1,...bins), step=canvas.width/bins.length;
  ctx.fillStyle='#bf9560';
  for (let i=0;i<bins.length;i++) {
    const height=Math.sqrt(bins[i]/peak)*canvas.height;
    ctx.fillRect(i*step,canvas.height-height,step,height);
  }
}
function drawHistogram(rgba) {
  const cvs = $('histogram'), ctx = cvs.getContext('2d'), {width,height} = cvs;
  const counts = Array.from({length:3},() => new Float32Array(128));
  for (let i=0; i<rgba.length; i+=16) {
    for (let c=0; c<3; c++) counts[c][rgba[i+c]>>1]++;
  }
  const peak = Math.max(1,...counts.flatMap(bins => Array.from(bins)));
  ctx.clearRect(0,0,width,height);
  ctx.globalCompositeOperation = 'screen';
  counts.forEach((bins,c) => {
    ctx.fillStyle = ['#8c4448','#527d52','#425e95'][c];
    for (let i=0; i<bins.length; i++) {
      const h = Math.sqrt(bins[i]/peak)*(height-6);
      ctx.fillRect(i*width/bins.length,height-h,width/bins.length+1,h);
    }
  });
  ctx.globalCompositeOperation = 'source-over';
}
const panes = ['single-pane','left-pane','right-pane'].map($);
const surface = pane => pane.firstElementChild;
const reference = $('reference');
function dimensions(visual) {
  return visual instanceof HTMLImageElement ? [visual.naturalWidth,visual.naturalHeight] : [visual.width,visual.height];
}
function layoutViewport() {
  const active = panes.flatMap(pane => {
    if (!pane.clientWidth || !pane.clientHeight) return [];
    const visual = [...surface(pane).children].find(child => !child.hidden);
    return visual ? [{pane,visual,size:dimensions(visual)}] : [];
  }).filter(item => item.size.every(Boolean));
  if (!active.length) return;
  // Before development the original can show the selected orientation in
  // place. After development the output already includes the recipe rotation.
  const displayedTurn = (viewTurn + (preview.dataset.ready ? 0 : appearance.turn)) % 4;
  const swapped = displayedTurn%2 !== 0;
  const edgeAtFit = Math.min(...active.map(({pane,size:[w,h]}) => {
    const [fitW,fitH] = swapped ? [h,w] : [w,h];
    return Math.min(Math.max(1,pane.clientWidth-12)/fitW,Math.max(1,pane.clientHeight-12)/fitH)*Math.max(w,h);
  }));
  const sourceEdge = Math.max(...(photo?.dimensions ?? dimensions(original)));
  for (const {pane,visual,size:[w,h]} of active) {
    const oldX = (pane.scrollLeft+pane.clientWidth/2)/Math.max(1,pane.scrollWidth);
    const oldY = (pane.scrollTop+pane.clientHeight/2)/Math.max(1,pane.scrollHeight);
    const baseEdge = sourceEdge || Math.max(w,h);
    const factor = (scale === 'fit' ? edgeAtFit : baseEdge*scale)/Math.max(w,h);
    const width = Math.max(1,Math.round(w*factor)), height = Math.max(1,Math.round(h*factor));
    Object.assign(surface(pane).style,{width:(swapped?height:width)+'px',height:(swapped?width:height)+'px'});
    Object.assign(visual.style,{width:width+'px',height:height+'px'});
    visual.style.setProperty('--view-rotation',displayedTurn*90+'deg');
    pane.scrollLeft = oldX*pane.scrollWidth-pane.clientWidth/2;
    pane.scrollTop = oldY*pane.scrollHeight-pane.clientHeight/2;
  }
}
const viewportObserver = new ResizeObserver(layoutViewport);
for (const pane of panes) viewportObserver.observe(pane);
function setScale(value) {
  scale = value;
  $('zoom-value').value = value === 'fit' ? '适合' : Math.round(value*100)+'%';
  for (const choice of document.querySelectorAll('[data-scale]')) pressed(choice,choice.dataset.scale === String(value));
  layoutViewport();
  refreshActions();
}
function stepZoom(direction) {
  const stops = [.025,.05,.075,.125,.25,.33,.5,.67,1,1.5,2,3,4];
  const visual = !preview.hidden ? preview : original;
  const size = dimensions(visual);
  const sourceEdge = Math.max(...(photo?.dimensions ?? size));
  const displayEdge = Math.max(Number.parseFloat(visual.style.width),Number.parseFloat(visual.style.height));
  const fitted = sourceEdge && Number.isFinite(displayEdge) ? displayEdge/sourceEdge : 1;
  const currentScale = scale === 'fit' ? fitted : scale;
  const next = direction>0 ? stops.find(stop=>stop>currentScale+.015) : stops.findLast(stop=>stop<currentScale-.015);
  if (next) setScale(next);
}
function syncPreview() {
  $('empty').hidden = !!photo;
  const grid=mode === 'gallery' && photos.length>0;
  $('gallery-grid').hidden=!grid;
  const paired = !grid && comparison && !!preview.dataset.ready;
  $('pair').hidden = !paired;
  $('single-pane').hidden = grid || !photo || !!paired;
  const place = (visual,pane) => {
    if (visual.parentElement !== surface(pane)) surface(pane).append(visual);
  };
  place(original,paired && comparison === 'original' ? panes[1] : panes[0]);
  place(preview,paired ? panes[2] : panes[0]);
  original.hidden = grid || !original.getAttribute('src') || (paired ? comparison!=='original' : !!preview.dataset.ready);
  preview.hidden = grid || !photo || !preview.dataset.ready;
  reference.hidden = !paired || comparison!=='windows';
  $('left-caption').textContent = comparison==='windows' ? 'Windows SpektraLab' : '原图';
  $('right-caption').textContent = comparison==='windows' ? 'FrameLab 浏览器版' : '冲洗成片';
  pressed($('compare'),paired && comparison==='original');
  layoutViewport();
}
function refreshActions() {
  const hasOriginal = original.complete && original.naturalWidth>0;
  $('compare').disabled = !preview.dataset.ready || !hasOriginal;
  $('reference-button').disabled = !preview.dataset.ready;
  const waiting = !!current || !!pending || busy || previewTimerPending;
  $('develop-photo').disabled = !photo || !catalog || waiting;
  $('develop-photo').textContent = developmentStarted ? '重新冲洗' : '开始冲洗';
  for (const id of ['zoom-out','zoom-in','zoom-fit','rotate-left','rotate-right']) {
    $(id).disabled = !hasOriginal && !preview.dataset.ready;
  }
  $('zoom-in').disabled ||= scale === 4;
  $('zoom-out').disabled ||= scale === .025;
  $('download').disabled = !previewFresh || waiting;
  $('publish').disabled = $('download').disabled;
  $('menu-export').disabled = $('download').disabled;
  for (const id of ['save-project','copy-settings','reset-settings','crop-button']) $(id).disabled=!photo || !catalog;
  $('paste-settings').disabled=!photo || !catalog || !copiedSettings;
  $('previous').disabled=$('next').disabled=photos.length<2;
  presetMenu.disabled = !photo || !developPresets.size;
  applyPreset.disabled = presetMenu.disabled || !presetMenu.value;
}
function select(item, enter = false) {
  clearTimeout(timer);
  previewTimerPending = false;
  pending = null;
  sequence++;
  photo = item;
  presetMenu.value = '';
  refreshPreset();
  preview.dataset.ready = '';
  developmentStarted = previewFresh = false;
  comparison = null;
  viewTurn = 0;
  for (const pane of panes) pane.scrollTo(0,0);
  if (item.thumbnail || item.url) original.src=item.thumbnail || item.url;
  else original.removeAttribute('src');
  setScale('fit');
  $('backend').textContent = '';
  drawHistogram([]);
  drawExposure([]);
  status('原图 · 未冲洗');
  if (enter) showMode('develop');
  syncPreview();
  for (const button of document.querySelectorAll('[data-photo-id]')) pressed(button,button.dataset.photoId === item.id);
  if (catalog) {
    restoreRecipe(item.recipe);
    layoutViewport();
    if (!item.thumbnail && !item.url) submit('original');
  }
  setCropPanel(false);
  refreshActions();
  if (original.complete && original.naturalWidth) original.onload();
}
function persist(item) {
  if (libraryUnavailable) return;
  const {id,name,blob,recipe,rating,added} = item;
  void savePhoto({id,name,blob,recipe,rating,added}).catch(() => {
    libraryUnavailable=true;
    status('浏览器图库空间不足，未保存本次更改。可从「文件」导出冲洗工程。');
  });
}
function makeId() {
  return crypto.randomUUID?.() || Array.from(crypto.getRandomValues(new Uint8Array(16)),x=>x.toString(16).padStart(2,'0')).join('');
}
function addPhoto(record) {
  const known=photos.find(item=>item.id === record.id);
  if (known) return known;
  const item={rating:0,added:Date.now(),...record};
  if (/^image\/(?:jpeg|png|webp)$/.test(item.blob.type)) item.url=URL.createObjectURL(item.blob);
  photos.push(item);
  return item;
}
function sortedPhotos() {
  const method=$('sort').value, sign=descending ? -1 : 1;
  return [...photos].sort((a,b)=>sign*(method==='name' ? stockOrder.compare(a.name,b.name) :
    method==='rating' ? a.rating-b.rating || a.added-b.added : a.added-b.added));
}
function renderPhotos() {
  const items=sortedPhotos();
  for (const id of ['photos','gallery-grid']) $(id).replaceChildren(...items.map(item => {
    const card=node('button','',{type:'button',title:item.name,ariaLabel:item.name});
    card.dataset.photoId=item.id;
    pressed(card,photo?.id===item.id);
    if (item.thumbnail || item.url) card.append(node('img','',{src:item.thumbnail || item.url,alt:'',loading:'lazy'}));
    else card.append(node('span','RAW / TIFF',{className:'raw-thumb'}));
    card.append(node('span',item.name));
    if (item.rating) card.append(node('small','★'.repeat(item.rating),{className:'rating'}));
    card.onclick=()=>select(item);
    card.ondblclick=()=>select(item,true);
    return card;
  }));
  $('photos-empty').hidden=items.length>0;
  $('count').textContent = items.length+' 张照片';
}
function addFiles(list) {
  let first;
  for (const blob of list) {
    if (!photoType(blob) || !blob.size || blob.size > maxPhotoBytes) continue;
    const item=addPhoto({blob,name:blob.name || 'FrameLab 照片',id:makeId()});
    persist(item);
    first ??= item;
  }
  renderPhotos();
  if (first) select(first,mode !== 'gallery');
  else status('未找到可解码的照片。单张限制为 128 MB。');
}
function downloadFile(blob,name) {
  const url=URL.createObjectURL(blob);
  node('a','',{href:url,download:name}).click();
  setTimeout(()=>URL.revokeObjectURL(url),60000);
}
async function finishFrame(frame, job) {
  busy = true;
  refreshActions();
  try {
    const canvas = document.createElement('canvas');
    canvas.width = frame.width;
    canvas.height = frame.height;
    canvas.getContext('2d').putImageData(new ImageData(new Uint8ClampedArray(frame.rgba),frame.width,frame.height),0,0);
    const format=job.kind === 'publish' ? 'jpeg' : job.format;
    const blob = format === 'tiff' ? rgbaTiff(frame.width,frame.height,frame.rgba)
      : await new Promise(resolve => canvas.toBlob(resolve,'image/'+format,job.quality));
    if (!blob) throw new Error('无法生成图像文件');
    if (job.id !== sequence) return;
    if (job.kind === 'publish') {
      parent.postMessage({type:'spektralab:publish',channel,blob,width:frame.width,height:frame.height,name:job.source.name}, location.origin);
      status('正在将结果发布到 FrameLab…');
    } else {
      downloadFile(blob,'SpektraLab-'+job.source.name.replace(/\.[^.]+$/,'')+'.'+(format==='jpeg'?'jpg':format));
      status('已导出 '+format.toUpperCase()+' · '+frame.width+' × '+frame.height);
    }
  } catch (error) {status(error.message);}
  finally {busy = false; refreshActions();}
}

$('open').onclick = $('empty-open').onclick = () => files.click();
$('open-folder').onclick = () => $('folder').click();
for (const input of [files,$('folder')]) input.onchange = () => {addFiles(input.files);input.value='';};
$('open-project').onclick = () => $('project-file').click();
$('project-file').onchange=async event => {
  const file=event.target.files[0];
  event.target.value='';
  if (!file) return;
  try {
    const record=await decodeProject(file);
    const item=addPhoto({...record,id:makeId()});
    persist(item);
    renderPhotos();
    select(item,true);
  } catch (error) {status(error.message);}
};
$('save-project').onclick=() => {
  if (photo && catalog) downloadFile(encodeProject(photo,snapshotRecipe()),photo.name+'.spektraframe');
};
$('copy-settings').onclick=() => {
  if (photo && catalog) {copiedSettings=snapshotRecipe();refreshActions();status('已复制冲洗设置');}
};
$('paste-settings').onclick=() => {if (photo && copiedSettings) {restoreRecipe(copiedSettings);schedule();}};
$('reset-settings').onclick=() => {if (photo && catalog) {restoreRecipe();schedule();}};
$('sort').onchange=renderPhotos;
$('sort-direction').onclick=() => {descending=!descending;$('sort-direction').textContent=descending?'↓':'↑';renderPhotos();};
$('histogram-mode').onchange=() => {$('histogram').hidden=$('histogram-mode').value==='exposure';};
function stepPhoto(delta) {
  const list=sortedPhotos();
  if (list.length>1) select(list[(list.indexOf(photo)+delta+list.length)%list.length]);
}
$('previous').onclick=()=>stepPhoto(-1);
$('next').onclick=()=>stepPhoto(1);
for (const [id,flag] of [['toggle-left','hide-rail'],['toggle-browser','hide-browser']]) $(id).onclick=() => {
  pressed($(id),!document.querySelector('.workspace').classList.toggle(flag));
};
const workspace=document.querySelector('.workspace');
for (const [id,side,cssVar] of [['rail-divider','left','--rail-width'],['browser-divider','right','--browser-width']]) {
  const handle=$(id);
  const adjust=desired=>{
    const other=workspace.querySelector(side==='left'?'.photos':'.rail').getBoundingClientRect().width;
    const width=bounded(desired,190,Math.max(190,workspace.clientWidth-other-320),240);
    workspace.style.setProperty(cssVar,width+'px');
  };
  handle.onpointerdown=event=>handle.setPointerCapture(event.pointerId);
  handle.onpointermove=event=>{
    if (!handle.hasPointerCapture(event.pointerId)) return;
    const {left,right}=workspace.getBoundingClientRect();
    adjust(side==='left'?event.clientX-left:right-event.clientX);
  };
  handle.onkeydown=event=>{
    if (!['ArrowLeft','ArrowRight'].includes(event.key)) return;
    event.preventDefault();
    const delta=(event.key==='ArrowRight'?1:-1)*(side==='left'?1:-1);
    adjust(handle.parentElement.getBoundingClientRect().width+delta*12);
  };
  handle.ondblclick=()=>workspace.style.removeProperty(cssVar);
}
$('toggle-grid').onclick=()=>showMode(mode==='gallery'?'develop':'gallery');
function setCropPanel(open) {
  $('crop-panel').hidden=!open;
  $('crop-button').setAttribute('aria-expanded',String(open));
}
$('crop-button').onclick=()=>{
  if (mode==='gallery') showMode('edit');
  setCropPanel($('crop-panel').hidden);
};
for (const button of document.querySelectorAll('[data-command]')) {
  button.onclick=()=>$(button.dataset.command).click();
}
document.addEventListener('click',event => {
  for (const menu of document.querySelectorAll('.menus details[open],#more[open]')) {
    if (!menu.contains(event.target) || event.target.closest('.menu button,.menu a')) menu.open=false;
  }
});
window.addEventListener('keydown',event => {
  if (event.defaultPrevented || event.target.closest?.('input,select,textarea,[contenteditable]') || $('export-panel').open) return;
  const key=event.key.toLowerCase();
  const modifier=event.ctrlKey || event.metaKey;
  const shortcuts=modifier ? {'o':event.shiftKey?'open':'open-folder','s':'save-project','e':'download',
    'b':'toggle-left','v':event.shiftKey?'paste-settings':null}
    : {'f8':'toggle-browser','g':'toggle-grid','y':'compare','c':'crop-button','arrowleft':'previous','arrowright':'next'};
  if (shortcuts[key]) {event.preventDefault();$(shortcuts[key]).click();}
  if (!modifier && photo && /^[0-5]$/.test(key)) {photo.rating=Number(key);persist(photo);renderPhotos();}
});
stage.addEventListener('dragover', e => e.preventDefault());
stage.addEventListener('drop', e => { e.preventDefault(); addFiles(e.dataTransfer.files); });
$('develop-photo').onclick = () => {
  if (!photo || !catalog) return;
  if (mode === 'gallery') showMode('develop');
  developmentStarted = true;
  previewFresh = false;
  submit('preview');
};
$('compare').onclick = () => {
  if (mode === 'gallery') showMode('develop');
  comparison = comparison === 'original' ? null : 'original';
  syncPreview();
};
$('reference-button').onclick = () => {
  if (comparison === 'windows') {comparison = null; syncPreview();}
  else $('reference-file').click();
};
$('reference-file').onchange = event => {
  const file = event.target.files[0];
  if (!file) return;
  if (referenceUrl) URL.revokeObjectURL(referenceUrl);
  referenceUrl = URL.createObjectURL(file);
  const item=photo;
  reference.onload=()=>{
    if (photo !== item) return;
    if (mode === 'gallery') showMode('develop');
    comparison='windows';
    syncPreview();
  };
  reference.onerror=()=>status('无法打开 Windows 成片，请选择 PNG 或 JPEG。');
  reference.src=referenceUrl;
  event.target.value='';
};
for (const button of document.querySelectorAll('[data-scale]')) button.onclick = () =>
  setScale(button.dataset.scale === 'fit' ? 'fit' : Number(button.dataset.scale));
$('zoom-fit').onclick = () => setScale('fit');
$('zoom-in').onclick = () => stepZoom(1);
$('zoom-out').onclick = () => stepZoom(-1);
for (const [id,turn] of [['rotate-left',-1],['rotate-right',1]]) $(id).onclick = () => {
  viewTurn=(viewTurn+turn+4)%4;
  layoutViewport();
};
stage.addEventListener('wheel',event=>{
  if (mode==='gallery' || !photo || !event.ctrlKey || !event.deltaY) return;
  event.preventDefault();
  stepZoom(event.deltaY<0 ? 1 : -1);
},{passive:false});
for (const [pane,other] of [[panes[1],panes[2]],[panes[2],panes[1]]]) pane.addEventListener('scroll',()=>{
  if ($('pair').hidden) return;
  for (const [position,total,extent] of [['scrollLeft','scrollWidth','clientWidth'],['scrollTop','scrollHeight','clientHeight']]) {
    const available=pane[total]-pane[extent];
    if (available<=0) continue;
    const target=Math.round(pane[position]/available*(other[total]-other[extent]));
    // A fractional-pixel round trip must not keep the two listeners firing.
    if (Math.abs(other[position]-target)>1) other[position]=target;
  }
});
$('download').onclick = $('menu-export').onclick = () => {
  if (!photo) return;
  $('export-source').textContent=photo.dimensions?.length===2 ? '原始尺寸 '+photo.dimensions.join(' × ') : photo.name;
  $('export-panel').returnValue='';
  $('export-panel').showModal();
};
$('export-panel').onclose = () => {
  if ($('export-panel').returnValue==='export' && photo) {clearTimeout(timer);submit('download');}
};
$('publish').onclick = () => {clearTimeout(timer); submit('publish');};
$('back').onclick = () => {
  if (channel) parent.postMessage({type:'spektralab:close',channel},location.origin);
  else location.assign('../../');
};
original.onload = () => {
  if (!photo) return;
  photo.dimensions ??= dimensions(original);
  describeOriginal();
  if (!developmentStarted) {
    const [width,height]=dimensions(original);
    const factor=Math.min(1,320/Math.max(width,height));
    const raster=document.createElement('canvas');
    raster.width=Math.max(1,Math.round(width*factor));
    raster.height=Math.max(1,Math.round(height*factor));
    const ctx=raster.getContext('2d',{willReadFrequently:true});
    ctx.drawImage(original,0,0,raster.width,raster.height);
    const rgba=ctx.getImageData(0,0,raster.width,raster.height).data;
    drawHistogram(rgba);
    drawExposure(rgba);
  }
  syncPreview();
  refreshActions();
};
original.onerror = () => {
  if (!photo || !catalog || developmentStarted || photo.thumbnail) return;
  original.removeAttribute('src');
  submit('original');
};
addEventListener('message', ({origin,source,data}) => {
  if (origin !== location.origin || source !== parent || source === window || !data) return;
  if (data.type === 'spektralab:init' && typeof data.channel === 'string' && !channel) {
    channel = data.channel;
    $('publish').hidden = false;
    if (data.blob instanceof Blob) {
      const id=data.sourceId ? 'canvas:'+data.sourceId+':'+data.blob.size : makeId();
      const item=addPhoto({id,name:data.name || 'FrameLab 照片',blob:data.blob});
      persist(item);
      renderPhotos();
      select(item,true);
    }
  }
  if (data.channel === channel && data.type === 'spektralab:error') status(data.message);
});
try {
  catalog = await loadCatalog();
  loadPresets();
  restoreRecipe(photo?.recipe);
  if (photo && !photo.thumbnail && !photo.url) submit('original');
} catch (error) { status(error.message); }
try {
  for (const record of await listPhotos()) addPhoto(record);
  renderPhotos();
} catch {
  libraryUnavailable=true;
  status('当前浏览器无法打开本地图库。仍可导入照片和保存工程。');
}
refreshActions();
if (parent !== window) parent.postMessage({type:'spektralab:ready'},location.origin);
