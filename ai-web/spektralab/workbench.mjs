import {loadCatalog} from './engine.mjs';

const $ = id => document.getElementById(id);
const photos = [];
const preview = $('preview'), original = $('original'), files = $('files'), stage = $('stage');
const nativeDefault = 'kodak_supra_endura';
const stockOrder = new Intl.Collator('zh-CN', {numeric:true});
let catalog, film, paper, photo, worker, current, pending, sequence = 0, timer;
let comparing = false, scale = 'fit', busy = false, channel = null;
let referenceUrl, comparingReference = false;
const values = {};
const channels = ['rgb','red','green','blue'];
const hues = ['red','orange','yellow','green','blue','purple'];
const curves = Object.fromEntries(channels.map(key => [key,0]));
const hsl = Object.fromEntries(hues.map(key => [key,{hue:0,saturation:0,luminance:0}]));
const controls = [
  ['develop','胶片曝光',[
    ['exposure','胶片曝光',-3,3,.05,0], ['format','画幅宽度 mm',17,65,1,35],
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
  $('paper').replaceChildren(...choices.map(item => node('option',item.name,{value:item.id})));
  if (paper) $('paper').value = paper.id;
  $('paper').disabled = $('direct').checked;
  $('stock-info').textContent = film.name + ($('direct').checked ? ' · 直接扫描' : ' · '+(paper?.name || ''));
}
$('category').append(...['','彩色负片','电影胶片','反转片','黑白'].map(name => node('option',name || '全部',{value:name})));
$('category').onchange = renderStocks;
$('paper').onchange = () => { paper = catalog.profiles.find(item => item.id === $('paper').value); renderPapers(); schedule(); };
$('direct').onchange = () => { renderPapers(); schedule(); };
for (const mode of ['develop','edit']) $(mode+'-tab').onclick = () => {
  for (const item of ['develop','edit']) {
    $(item).hidden = item !== mode;
    pressed($(item+'-tab'), item === mode);
  }
};

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
  neg.halation.halation_amount = values.halation;
  neg.halation.scatter_amount = values.scatter;
  neg.halation.halation_spatial_scale = values.haloSize;
  params.enlarger.print_exposure = 2 ** values.printExposure;
  params.enlarger.m_filter_shift = values.magenta;
  params.enlarger.y_filter_shift = values.yellow;
  params.enlarger.preflash_exposure = values.preflash;
  params.print_render.glare.active = values.glare > 0;
  params.print_render.glare.percent = values.glare;
  params.io.scan_film = $('direct').checked;
  const grade = Object.fromEntries(controls.filter(group => group[0] === 'edit')
    .flatMap(group => group[2].map(([key]) => [key,values[key]])));
  if (Object.values(curves).some(Boolean)) grade.curve = Object.fromEntries(channels.map(key =>
    [key,[[0,0],[.5,.5+curves[key]/100],[1,1]]]));
  if (Object.values(hsl).some(values => Object.values(values).some(Boolean))) grade.hsl = structuredClone(hsl);
  return {params,grade,film:film.id,paper:paper?.id || nativeDefault};
}

function schedule() {
  if (!photo || !catalog) return;
  clearTimeout(timer);
  pending = null;
  sequence++;
  refreshActions();
  timer = setTimeout(() => submit('preview'), 180);
}
function submit(kind) {
  const job = {id:++sequence,source:photo,...settings(),kind,edge:kind === 'preview' ? 960 : 2048};
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
      if (data.error) status('渲染失败：' + data.error);
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
  status(current.kind === 'preview' ? '正在冲洗预览…' : '正在渲染输出…');
  getWorker().postMessage(current);
  refreshActions();
}
function paint(frame) {
  if (!preview.dataset.ready) comparing = false;
  preview.dataset.ready = 'yes';
  preview.width = frame.width;
  preview.height = frame.height;
  preview.getContext('2d').putImageData(new ImageData(new Uint8ClampedArray(frame.rgba),frame.width,frame.height),0,0);
  drawHistogram(frame.rgba);
  $('backend').textContent = frame.backend;
  status(frame.width+' × '+frame.height+' · '+Math.round(frame.elapsedMs)+' ms');
  syncPreview();
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
function syncPreview() {
  $('empty').hidden = !!photo;
  $('pair').hidden = !comparingReference || !preview.dataset.ready;
  original.hidden = !photo || !comparing || comparingReference;
  preview.hidden = !photo || comparing || comparingReference || !preview.dataset.ready;
  if (!$('pair').hidden) {
    const right=$('reference-preview');
    right.width=preview.width;
    right.height=preview.height;
    right.getContext('2d').drawImage(preview,0,0);
  }
  const visual = comparing ? original : preview;
  stage.toggleAttribute('data-scaled',scale !== 'fit');
  for (const item of [original,preview]) item.style.width = '';
  const w = visual === original ? original.naturalWidth : preview.width;
  if (scale !== 'fit' && w) visual.style.width = w*Number(scale)+'px';
  pressed($('compare'),comparing);
}
function refreshActions() {
  $('compare').disabled = !photo;
  $('reference-button').disabled = !preview.dataset.ready;
  $('download').disabled = !photo || !catalog || !!current || !!pending || busy;
  $('publish').disabled = $('download').disabled;
}
function select(item) {
  photo = item;
  original.src = item.url;
  preview.dataset.ready = '';
  comparing = true;
  comparingReference = false;
  syncPreview();
  for (const button of $('photos').children) pressed(button,button.dataset.id === item.id);
  if (catalog) schedule();
}
function addFiles(list, useFirst = true) {
  let first;
  for (const blob of list) {
    if (!/^image\/(?:jpeg|png|webp)$/.test(blob.type) || blob.size > 60*1024*1024) continue;
    const item = {blob,name:blob.name || 'FrameLab 照片',id:String(photos.length+1),url:URL.createObjectURL(blob)};
    const button = node('button','',{type:'button',title:item.name});
    button.dataset.id=item.id;
    button.append(node('img','',{src:item.url,alt:'',loading:'lazy'}),node('span',item.name));
    button.onclick = () => select(item);
    $('photos').append(button);
    photos.push(item);
    first ??= item;
  }
  $('count').textContent = photos.length+' 张照片';
  if (first && useFirst) select(first);
  if (!first) status('请选择不超过 60 MB 的 JPG、PNG 或 WebP。');
}
async function finishFrame(frame, job) {
  busy = true;
  refreshActions();
  try {
    const canvas = document.createElement('canvas');
    canvas.width = frame.width;
    canvas.height = frame.height;
    canvas.getContext('2d').putImageData(new ImageData(new Uint8ClampedArray(frame.rgba),frame.width,frame.height),0,0);
    const blob = await new Promise(resolve => canvas.toBlob(resolve,job.kind === 'download' ? 'image/png' : 'image/jpeg',.94));
    if (!blob) throw new Error('无法生成图像文件');
    if (job.kind === 'publish') {
      parent.postMessage({type:'spektralab:publish',channel,blob,width:frame.width,height:frame.height,name:job.source.name}, location.origin);
      status('正在将结果发布到 FrameLab…');
    } else {
      const url = URL.createObjectURL(blob);
      const link = node('a','',{href:url,download:'SpektraLab-'+job.source.name.replace(/\.[^.]+$/,'')+'.png'});
      link.click();
      setTimeout(() => URL.revokeObjectURL(url),60000);
      status('已导出 PNG');
    }
  } catch (error) {status(error.message);}
  finally {busy = false; refreshActions();}
}

$('open').onclick = $('empty-open').onclick = () => files.click();
files.onchange = () => {
  addFiles(files.files);
  files.value = '';
};
stage.addEventListener('dragover', e => e.preventDefault());
stage.addEventListener('drop', e => { e.preventDefault(); addFiles(e.dataTransfer.files); });
$('compare').onclick = () => { comparing = comparingReference || !comparing; comparingReference = false; syncPreview(); };
$('reference-button').onclick = () => {
  if (comparingReference) {comparingReference = false; syncPreview();}
  else $('reference-file').click();
};
$('reference-file').onchange = event => {
  const file = event.target.files[0];
  if (!file) return;
  if (referenceUrl) URL.revokeObjectURL(referenceUrl);
  referenceUrl = URL.createObjectURL(file);
  const image=$('reference');
  image.onload=()=>{comparingReference=true;comparing=false;syncPreview();};
  image.onerror=()=>status('无法打开 Windows 成片，请选择 PNG 或 JPEG。');
  image.src=referenceUrl;
  event.target.value='';
};
for (const button of document.querySelectorAll('[data-scale]')) button.onclick = () => {
  scale = button.dataset.scale;
  for (const choice of document.querySelectorAll('[data-scale]')) pressed(choice,choice === button);
  syncPreview();
};
$('download').onclick = () => {clearTimeout(timer); submit('download');};
$('publish').onclick = () => {clearTimeout(timer); submit('publish');};
$('back').onclick = () => {
  if (channel) parent.postMessage({type:'spektralab:close',channel},location.origin);
  else location.assign('../../');
};
original.onload = syncPreview;
addEventListener('message', ({origin,source,data}) => {
  if (origin !== location.origin || source !== parent || source === window || !data) return;
  if (data.type === 'spektralab:init' && typeof data.channel === 'string' && !channel) {
    channel = data.channel;
    $('publish').hidden = false;
    if (data.blob instanceof Blob) addFiles([new File([data.blob],data.name || 'FrameLab 照片',{type:data.blob.type})]);
  }
  if (data.channel === channel && data.type === 'spektralab:error') status(data.message);
});
if (parent !== window) parent.postMessage({type:'spektralab:ready'},location.origin);

try {
  catalog = await loadCatalog();
  film = catalog.profiles.find(item => item.id === 'kodak_portra_400');
  renderStocks();
  renderPapers();
  if (photo) schedule();
} catch (error) { status(error.message); }
refreshActions();
