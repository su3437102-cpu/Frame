import { Collage } from './artwork.mjs';
import { MontageArt } from './montage.mjs';
import { CollageTemplates } from './templates.mjs';
import { Renderer } from './renderer.mjs';
import { JournalArt } from './journal.mjs';
import { JournalMarks } from './journal-marks.mjs';
import { LayerTransform } from './layer-transform.mjs';
import { BrushArt } from './brush.mjs';
import { packProject, unpackProject } from '../framelab-project.mjs';
import { canvasBlob, serializeMaterial, deserializeMaterial } from './project-materials.mjs';

export function mountStudio({root, showSection, assetRoot, TemplateGallery, upload, signal, source, project, onSave}) {
  const $ = id => root.getElementById(id);
  const stage = $('stage');
  const canvas = $('canvas');
  const designs = [...Collage.designs, ...CollageTemplates.designs, JournalArt.design];
  const library = [...Collage.library, ...CollageTemplates.library, ...JournalArt.library];
  const styleById = new Map(designs.map(design => [design.id, design]));
  const images = new Map();
  const history = [];
  const future = [];
  const MAX_UPLOADS = 16;
  let state = {
    style: 'dada', aspect: 'landscape', bg: styleById.get('dada').background,
    layers: Collage.sample('dada'), uploads: [], example: true, variation: 38
  };
  let selectedId = null;
  let layerClipboard = null;
  let draggedLayerId = null;
  let reorderDrag = null;
  let dropCue = null;
  let curveEditId = null;
  let activeTab = 'compose';
  let ready = false;
  let savedState = '';
  let saving = false;
  let drag = null;
  let filterEdit = null;
  let scheduled = false;
  let stageDragDepth = 0;
  let sequence = 0;
  let templateGallery;
  let pendingReplacement = null;
  let lastJournalPhotos = [];
  let journalBusy = false;
  let transformDrag = null;
  let brushMode = false;
  let brushDraft = null;

  const svg = name => {
    const graphic = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    const use = document.createElementNS('http://www.w3.org/2000/svg', 'use');
    graphic.setAttribute('aria-hidden', 'true');
    use.setAttribute('href', '#i-' + name);
    graphic.append(use);
    return graphic;
  };

  function notice(text) {
    $('message').textContent = text;
  }

  function enqueuePaint() {
    if (signal.aborted || scheduled || !ready) return;
    scheduled = true;
    requestAnimationFrame(() => {
      scheduled = false;
      if (signal.aborted) return;
      const selected=currentLayer();
      const draft=brushDraft ? BrushArt.create(brushDraft.samples,canvas.width,canvas.height,brushDraft.settings) : null;
      Renderer.paint(canvas, state, images, {selected, draft, showTextBoxes:Boolean(state.journal)&&!brushMode, drawSelection:false, showCurve:selected?.id===curveEditId&&!brushMode});
      positionTransformOverlay(selected);
    });
  }

  function currentLayer() {
    return state.layers.find(layer => layer.id === selectedId);
  }

  function checkpoint(snapshot = structuredClone(state)) {
    history.push(snapshot);
    if (history.length > 36) history.shift();
    future.length = 0;
  }

  function edit(operation, message) {
    finishFilter();
    checkpoint();
    operation();
    render();
    if (message) notice(message);
  }

  function navigateHistory(from, to, message) {
    finishFilter();
    if (!from.length) return;
    to.push(structuredClone(state));
    state = from.pop();
    if (state.montage) setMontageControls(state.montage);
    else if (styleById.get(state.style).group==='montage') setMontageControls();
    render();
    notice(message);
  }

  function showTab(tab, focus = false) {
    activeTab = tab;
    for (const name of ['compose', 'layers']) {
      const active = tab === name;
      const button = $('tab-' + name);
      button.classList.toggle('selected', active);
      button.setAttribute('aria-selected', String(active));
      button.tabIndex = active ? 0 : -1;
      $('panel-' + name).hidden = !active;
      if (active && focus) button.focus();
    }
  }

  function chooseLayer(id, showControls) {
    if (id !== selectedId) finishFilter();
    selectedId = id;
    if (showControls) showTab('layers');
    renderLayerPanel();
    enqueuePaint();
  }

  function openFilePicker() {
    $('image-input').click();
  }

  function imageElement(src, alt = '') {
    const img = new Image();
    img.alt = alt;
    img.decoding = 'async';
    img.loading = 'lazy';
    img.src = src;
    return img;
  }

  function loadImage(src) {
    const img = imageElement(src);
    img.loading = 'eager';
    return img.decode().then(() => img);
  }

  function makeButton(text, className, action) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = className;
    button.textContent = text;
    button.addEventListener('click', action);
    return button;
  }

  function makeLink(text, href) {
    const link = document.createElement('a');
    link.textContent = text;
    link.href = href;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    return link;
  }

  function buildDesign(design, materials, seed, amount) {
    if (design.group) {
      return CollageTemplates.layout(design.id, materials.length ? materials : null, seed, amount);
    }
    return materials.length
      ? Collage.uploadLayout(design, materials, seed, amount)
      : Collage.sample(design.id);
  }

  function setMontageControls(settings = {...MontageArt.defaults,theme:state.style,shape:state.style}) {
    const controls = $('montage-rules').elements;
    for (const key of Object.keys(MontageArt.choices)) controls.namedItem(key).value = settings[key];
    controls.namedItem('uploads').checked = Boolean(settings.useUploads);
  }

  function composeMontage(settings, uploads = state.uploads) {
    const materials = settings.useUploads ? uploads.map(id=>images.get(id)).filter(Boolean) : [];
    const design = styleById.get(settings.shape);
    const layers = MontageArt.compose(CollageTemplates.layout(design.id),settings,materials,id=>images.get(id));
    state = {...state, uploads, style:design.id, layers, aspect:design.aspect, bg:design.background,
      flat:true, journal:null, example:false, montage:settings};
    selectedId = null;
  }

  function showStudio() {
    showSection('studio');
  }

  function applyDesign(id, remix = false, templateExample = false) {
    if (!ready) return;
    if (id === JournalArt.design.id) {
      regenerateJournal();
      return;
    }
    const design = styleById.get(id);
    if (!design) return;
    const seed = Date.now() + (++sequence * 14647);
    edit(() => {
      if (design.group && remix) {
        const rng = Collage.random(seed);
        const spread = state.variation / 100;
        state.layers = state.layers.map(layer => layer.kind === 'photo' && layer.w < 1199
          ? {...layer, x: layer.x + (rng() - .5) * 38 * spread, y: layer.y + (rng() - .5) * 30 * spread}
          : layer);
        return;
      }
      const materials = templateExample ? [] : state.uploads.map(assetId => images.get(assetId));
      let layers = buildDesign(design, materials, remix ? seed : 3049, design.group ? 0 : state.variation);
      if (remix && !materials.length) layers = Collage.vary(layers, id, seed, state.variation);
      state = {
        ...state, style: id, bg: design.background, layers, example: !materials.length,
        aspect: design.aspect || state.aspect, flat: Boolean(design.group), journal:null, montage:null
      };
      selectedId = null;
      if (design.group==='montage') setMontageControls();
    }, remix ? '已生成一版新构图。' : '已应用' + design.name + '。');
  }

  function resetExample() {
    if (state.journal) {
      loadJournalExample(state.journal.profile);
      return;
    }
    const design = styleById.get(state.style);
    edit(() => {
      state = {
        ...state, layers: buildDesign(design, [], 0, 0), bg: design.background, example: true,
        aspect: design.aspect || state.aspect, flat: Boolean(design.group), journal:null, montage:null
      };
      selectedId = null;
      if (design.group==='montage') setMontageControls();
    }, '已载入可编辑的示例。素材仍保留在素材盘。');
  }

  function addMaterial(asset) {
    const shape = Collage.photo(asset, 603, 377, 396, 300, {
      rotation: -7, mask: 'tear', fit: asset.id === 'head' ? 'contain' : 'cover'
    });
    edit(() => {
      state.layers.push(shape);
      state.example = false;
      selectedId = shape.id;
      showTab('layers');
    }, '已加入图层。');
  }

  function addPaper() {
    const design = styleById.get(state.style);
    const layer = Collage.paper('色纸', design.palette[0], 596, 422, 338, 242, 'cut', -8, {grain: true});
    edit(() => {
      state.layers.push(layer);
      selectedId = layer.id;
    }, '已添加色纸。');
  }

  function addText() {
    const layer = Collage.label('文字', '#26211d', 596, 416, 320, 91);
    edit(() => {
      state.layers.push(layer);
      selectedId = layer.id;
    });
    $('layer-text').focus();
    $('layer-text').select();
  }

  function removeMaterial(asset) {
    edit(() => {
      state.uploads = state.uploads.filter(id => id !== asset.id);
      state.layers = state.layers.filter(layer => layer.asset !== asset.id);
    }, '已从当前拼贴移除素材及其图层。');
  }

  function renderMaterials() {
    const list = $('material-list');
    list.replaceChildren();
    const upload = makeButton('', 'material-item material-add', openFilePicker);
    upload.setAttribute('aria-label', '添加图片素材');
    upload.title = '添加图片素材';
    upload.append(svg('plus'));
    list.append(upload);
    const template = state.journal || CollageTemplates.byId.get(state.style);
    const sampleMaterials = template
      ? [...new Set(state.layers.map(layer => layer.asset))].map(id => images.get(id)).filter(asset => asset && !asset.uploaded)
      : Collage.library.map(asset => images.get(asset.id));
    const assets = [...state.uploads.map(id => images.get(id)), ...sampleMaterials];
    for (const asset of assets) {
      if (!asset) continue;
      const button = makeButton('', 'material-item', () => addMaterial(asset));
      button.setAttribute('aria-label', '贴上' + asset.name);
      button.title = '贴上' + asset.name;
      button.append(imageElement(asset.src));
      if (!asset.uploaded) {
        list.append(button);
        continue;
      }
      const wrapper = document.createElement('span');
      wrapper.className = 'material-unload';
      const remove = makeButton('', 'remove-material', () => removeMaterial(asset));
      remove.setAttribute('aria-label', '移除' + asset.name);
      remove.title = '从当前拼贴移除素材及其图层';
      remove.append(svg('close'));
      wrapper.append(button, remove);
      list.append(wrapper);
    }
  }

  function renderLayerPanel() {
    const list = $('layer-list');
    const focusedId = root.activeElement?.dataset.layer;
    const top = list.scrollTop;
    list.replaceChildren();
    $('layer-count').textContent = String(state.layers.length);
    for (const layer of state.layers.toReversed()) {
      const row = document.createElement('li');
      const item = makeButton('', 'layer-item', () => chooseLayer(layer.id, false));
      item.dataset.layer = String(layer.id);
      item.draggable = true;
      item.addEventListener('dragstart', event => {
        draggedLayerId = layer.id;
        event.dataTransfer.effectAllowed = 'move';
        event.dataTransfer.setData('text/plain', String(layer.id));
      });
      item.addEventListener('dragend', () => { draggedLayerId = null; clearDropCue(); });
      item.addEventListener('dragleave', () => { if (dropCue===item) clearDropCue(); });
      item.addEventListener('dragover', event => {
        if (draggedLayerId === null || draggedLayerId === layer.id) return;
        event.preventDefault();
        event.dataTransfer.dropEffect = 'move';
        showDropCue(item,event);
      });
      item.addEventListener('drop', event => {
        if (draggedLayerId === null) return;
        event.preventDefault();
        const sourceId=draggedLayerId;
        const target=showDropCue(item,event);
        draggedLayerId=null;
        clearDropCue();
        reorderLayer(sourceId,target.id,target.above);
      });
      item.dataset.kind = layer.kind;
      if (layer.markGroup) item.dataset.markGroup = layer.markGroup;
      if (layer.journalRole) item.dataset.journalRole = layer.journalRole;
      item.title = layer.name + (layer.hidden ? '（隐藏）' : '');
      item.classList.toggle('is-hidden', layer.hidden);
      item.setAttribute('aria-pressed', String(layer.id === selectedId));
      const asset = images.get(layer.asset);
      if (asset) item.append(imageElement(asset.src));
      else if (layer.color) {
        const color = document.createElement('i');
        color.setAttribute('aria-hidden', 'true');
        color.style.backgroundColor = layer.color;
        item.append(color);
      } else item.append(svg('image'));
      const name = document.createElement('span');
      name.textContent = layer.name;
      item.append(name);
      const grip=makeButton('⋮⋮','layer-reorder-grip',()=>{});
      grip.dataset.reorderLayer=String(layer.id);
      grip.setAttribute('aria-label','排序 '+layer.name);
      grip.title='拖动或使用上下键排序';
      bindReorderGrip(grip,layer.id);
      row.append(grip,item);
      list.append(row);
    }
    list.hidden = !state.layers.length;
    list.scrollTop = top;
    if (focusedId) list.querySelector('[data-layer="' + focusedId + '"]')?.focus({preventScroll:true});
    const current = currentLayer();
    $('layer-controls').hidden = !current;
    $('layer-replace').hidden = current?.kind !== 'photo';
    $('journal-pattern-row').hidden = current?.kind !== 'mark';
    $('journal-font-row').hidden = current?.kind !== 'type';
    $('text-curve-row').hidden = current?.kind !== 'type';
    if (current?.id!==curveEditId) curveEditId=null;
    $('text-path-edit').setAttribute('aria-pressed',String(curveEditId!==null));
    $('layer-empty').hidden = Boolean(current);
    if (!current) return;
    const index = state.layers.indexOf(current);
    $('layer-up').disabled = index === state.layers.length - 1;
    $('layer-down').disabled = index === 0;
    $('layer-toggle').setAttribute('aria-pressed', String(current.hidden));
    $('layer-toggle').setAttribute('aria-label', current.hidden ? '显示图层' : '隐藏图层');
    transformValues(current);
    $('opacity').value = Math.round(current.opacity);
    $('opacity-value').textContent = Math.round(current.opacity) + '%';
    const outline = $('mask').querySelector('option[value="polygon"]');
    outline.hidden = outline.disabled = !current.points?.length;
    $('mask').value = current.mask;
    $('blend').value = current.blend;
    $('tone').value = current.tone;
    $('tone-row').hidden = current.kind !== 'photo';
    $('color-row').hidden = !current.color;
    $('text-row').hidden = current.kind !== 'type';
    if (current.color) $('layer-color').value = current.color;
    if (current.kind === 'type') {
      $('layer-text').value = current.text;
      $('text-curve').value = current.curve || 0;
      $('journal-font').value = current.font || (current.style === 'brush' ? 'zh-brush' : current.mono ? 'en-mono' : '');
    }
    if (current.kind === 'mark') {
      const options = current.markGroup === 'edge' ? JournalMarks.edge : JournalMarks.fill;
      $('journal-pattern').replaceChildren(...options.map(item => new Option(item.name,item.id)));
      $('journal-pattern').value = current.pattern;
    }
  }

  function render() {
    const design = styleById.get(state.style);
    const [w, h] = Renderer.sizes[state.aspect];
    if (!currentLayer()) selectedId = null;
    $('work-title').textContent = state.montage ? '规则拼贴' : state.example || state.journal ? design.title : '我的拼贴';
    $('work-subtitle').textContent = state.example ? (design.group ? '可编辑模板' : '工作室示例') : design.name;
    templateGallery.setActive(state.style);
    $('style-note').textContent = design.action;
    $('variation').value = state.variation;
    $('variation-value').value = String(state.variation) + '%';
    $('undo').disabled = !history.length;
    $('redo').disabled = !future.length;
    $('aspect').value = state.aspect;
    root.querySelectorAll('.style-card').forEach(button => {
      button.setAttribute('aria-pressed', String(button.dataset.id === state.style));
    });
    stage.style.setProperty('--art-ratio', w + ' / ' + h);
    stage.style.setProperty('--max-art', Math.min(680, Math.max(150, stage.clientHeight - 46) * w / h) + 'px');
    renderLayerPanel();
    renderMaterials();
    const reuse = $('montage-rules').elements.namedItem('uploads');
    reuse.disabled = state.uploads.length === 0;
    if (reuse.disabled) reuse.checked = false;
    $('montage-materials').textContent = state.uploads.length ? '可用 ' + state.uploads.length + ' 张' : '默认用内置示例';
    syncJournalControls();
    enqueuePaint();
    const pending = state.layers.map(layer => layer.asset).filter(id => images.has(id) && !images.get(id).image);
    if (pending.length) void loadAssets(pending).then(enqueuePaint);
  }

  function buildEditorial() {
    for (const design of Collage.designs) {
      const card = makeButton('', 'style-card', () => applyDesign(design.id));
      card.dataset.id = design.id;
      const art = imageElement((assetRoot + 'study-') + design.id + '.webp');
      art.className = 'style-art';
      const caption = document.createElement('span');
      caption.className = 'style-label';
      caption.textContent = design.name;
      const check = svg('check');
      check.classList.add('style-check');
      card.append(art, caption, check);
      $('styles').append(card);

      const ref = document.createElement('article');
      ref.className = 'reference-card';
      const full = makeLink('', design.source);
      full.className = 'reference-image ref-' + design.id;
      const original = imageElement(assetRoot + design.image + '.webp', design.work + '作品图像');
      original.loading = 'lazy';
      full.append(original);
      if (design.id === 'dada') {
        const detail = document.createElement('span');
        detail.textContent = '作品局部';
        full.append(detail);
      }
      const body = document.createElement('div');
      body.className = 'reference-body';
      const heading = document.createElement('h3');
      heading.textContent = design.work;
        const artist = document.createElement('div');
      artist.className = 'artist';
      artist.textContent = design.artist;
      const analysis = document.createElement('p');
      analysis.textContent = design.analysis;
      const links = document.createElement('div');
      links.className = 'reference-links';
      links.append(makeLink('馆藏原作', design.source));
      if (design.imageSource !== design.source) links.append(makeLink('图像出处', design.imageSource));
      body.append(heading, artist, analysis, links);
      ref.append(full, body);
      $('references').append(ref);

      const row = document.createElement('article');
      row.className = 'rule';
      const ruleHeading = document.createElement('h3');
      ruleHeading.textContent = design.name;
      const idea = document.createElement('p');
      idea.textContent = design.action;
      const steps = document.createElement('p');
      steps.textContent = design.rule;
      const tryIt = makeButton('试试这个手法', 'text-button', () => {
        applyDesign(design.id);
        showTab('compose');
        root.getElementById('studio').scrollIntoView();
        root.querySelector('.style-card[data-id="' + design.id + '"]').focus({preventScroll: true});
      });
      row.append(ruleHeading, idea, steps, tryIt);
      $('rules').append(row);
    }
    for (const asset of Collage.library) $('image-credits').append(makeLink(asset.name + ' · 大都会艺术博物馆', asset.source));
  }

  function alphaPreview(image) {
    const ratio = Math.min(1, 160 / Math.max(image.naturalWidth, image.naturalHeight));
    const sample = document.createElement('canvas');
    sample.width = Math.max(1, Math.round(image.naturalWidth * ratio));
    sample.height = Math.max(1, Math.round(image.naturalHeight * ratio));
    const ctx = sample.getContext('2d', {willReadFrequently: true});
    ctx.drawImage(image, 0, 0, sample.width, sample.height);
    const pixels = ctx.getImageData(0, 0, sample.width, sample.height).data;
    return {width: sample.width, height: sample.height, pixels};
  }

  async function prepareMaterial(record) {
    signal.throwIfAborted();
    if (images.has(record.id)) return images.get(record.id);
    const src = URL.createObjectURL(record.blob);
    try {
      const image = await loadImage(src);
      signal.throwIfAborted();
      const asset = {id: record.id, name: record.name, kind: record.kind, src, image, uploaded: true};
      if (asset.kind === 'cutout') asset.alpha = alphaPreview(image);
      if (images.has(asset.id)) {
        URL.revokeObjectURL(src);
        return images.get(asset.id);
      }
      images.set(asset.id, asset);
      return asset;
    } catch (error) {
      URL.revokeObjectURL(src);
      throw error;
    }
  }

  async function useMaterials(records, {append = false} = {}) {
    if (!ready) await loaded;
    if (!records.length) return 0;
    if (records.length > MAX_UPLOADS) throw new Error('一次最多可拼贴 ' + MAX_UPLOADS + ' 张素材。');
    const materials = await Promise.all(records.map(prepareMaterial));
    const ids = materials.map(asset => asset.id);
    const combined = [...new Set([...state.uploads, ...ids])];
    if (append && combined.length > MAX_UPLOADS) {
      throw new Error('画布最多使用 ' + MAX_UPLOADS + ' 张素材，请先在素材盘移除几张。');
    }
    edit(() => {
      state.example = false;
      if (append) {
        state.uploads = combined;
        for (const [index, asset] of materials.entries()) {
          const offset = index * 49;
          const layer = Collage.photo(asset, 553 + offset % 270, 351 + offset % 205, 422, 325,
            {mask: 'rect', fit: 'contain', rotation: (index % 3 - 1) * 7});
          state.layers.push(layer);
          selectedId = layer.id;
        }
        showTab('layers');
        return;
      }
      if (state.montage) {
        const settings = {...state.montage,useUploads:true};
        composeMontage(settings,ids);
        setMontageControls(settings);
        showTab('layers');
        return;
      }
      const design = styleById.get(state.journal ? 'field-notes' : state.style);
      state.style = design.id;
      state.journal = null;
      state.uploads = ids;
      state.layers = buildDesign(design, materials, 3049, state.variation);
      state.flat = Boolean(design.group);
      state.bg = design.background;
      selectedId = null;
      showTab('compose');
    }, append ? '已将 ' + ids.length + ' 张素材添加到画布。' : '已用选中的 ' + ids.length + ' 张素材生成拼贴。');
    showSection('studio');
    return ids.length;
  }

  function pickReplacement() {
    const current = currentLayer();
    if (current?.kind !== 'photo') return;
    pendingReplacement = {id: current.id, asset: current.asset};
    $('layer-image-input').click();
  }

  async function replaceLayer(event) {
    const target = pendingReplacement;
    pendingReplacement = null;
    const [file] = event.target.files;
    event.target.value = '';
    if (!file || !target) return;
    if (file.size > 32 * 1024 * 1024) {
      notice('请选择 32 MB 以内的图片。');
      return;
    }
    try {
      const record = {id: 'replacement-' + Collage.uid(), kind: 'source', name: file.name || '替换图片', blob: file};
      const asset = await prepareMaterial(record);
      const layer = state.layers.find(item => item.id === target.id && item.asset === target.asset);
      if (!layer) {
        images.delete(asset.id);
        URL.revokeObjectURL(asset.src);
        return;
      }
      const replaceChosenHero = $('journal-hero').value === target.asset;
      const alpha = alphaPreview(asset.image);
      const hasTransparency = alpha.pixels.some((value, index) => index % 4 === 3 && value < 32);
      edit(() => {
        layer.asset = asset.id;
        if (state.journal?.photos.includes(target.asset) && layer.journalRole === 'photo-' + target.asset) {
          state.journal.photos = state.journal.photos.map(id => id === target.asset ? asset.id : id);
          if (state.journal.hero === target.asset) state.journal.hero = asset.id;
          state.uploads = [...new Set([...state.uploads.filter(id => id !== target.asset), asset.id])];
          for (const piece of state.layers) {
            if (piece.journalRole === 'edge-' + target.asset) piece.journalRole = 'edge-' + asset.id;
          }
          layer.journalRole = 'photo-' + asset.id;
        }
        layer.name = layer.slot ? layer.slot + ' · ' + asset.name : asset.name;
        if (hasTransparency) {
          asset.kind = 'cutout';
          asset.alpha = alpha;
        }
        state.example = false;
      }, '已替换图片，原图层的位置和裁切保留。');
      if (replaceChosenHero && state.journal?.photos.includes(asset.id)) $('journal-hero').value = asset.id;
    } catch {
      notice('无法读取这张图片，请换一张 JPG、PNG 或 WebP。');
    }
  }

  function journalSources() {
    return state.journal?.photos ?? lastJournalPhotos;
  }

  function syncJournalControls() {
    const ids = journalSources();
    const active = state.journal?.profile;
    const hero = $('journal-hero');
    const selection = hero.value;
    if (hero.dataset.sources !== ids.join(',')) {
      hero.dataset.sources = ids.join(',');
      hero.replaceChildren(new Option('自动选择', 'auto'),
        ...ids.map(id => new Option(images.get(id)?.name || id, id)));
      hero.value = ids.includes(selection) ? selection : 'auto';
    }
    $('journal-regenerate').disabled = journalBusy;
    root.querySelectorAll('[data-journal-layout]').forEach(action => {
      action.setAttribute('aria-pressed', String(action.dataset.journalLayout === active));
    });
  }

  function setJournalStatus(text) {
    $('journal-status').textContent = text;
  }

  function openStudio() {
    showSection('studio');
  }

  function updateLayer(layer, key, value) {
    layer[key] = value;
    if (layer.journalRole) {
      layer.journalEdits ??= {};
      layer.journalEdits[key] = value;
    }
  }

  function applyJournal(ids, options = {}) {
    const {example = false, preserve = false, seed = Date.now(), reveal = true} = options;
    const settings = {layout: $('journal-layout').value, density: $('journal-density').value,
      hero: $('journal-hero').value, print: $('journal-print').value};
    const assets = ids.map(id => images.get(id));
    if (assets.some(asset => !asset?.image)) {
      setJournalStatus('照片还在载入，请稍后再试。');
      return;
    }
    assets.forEach(asset => { asset.journal ??= JournalArt.measure(asset.image); });
    const plan = JournalArt.compose(assets, settings, seed);
    edit(() => {
      const existing = preserve && state.journal;
      const previous = existing ? new Map(state.layers.map(layer => [layer.journalRole, layer.journalEdits])) : new Map();
      const extras = existing ? state.layers.filter(layer => layer.journalManual) : [];
      const layers = plan.layers.map(layer => {
        const saved = previous.get(layer.journalRole);
        if (!saved) return layer;
        const adjusted = {...layer, ...saved, journalEdits:{...saved}};
        if (adjusted.kind === 'mark' && saved.pattern) {
          const choices = adjusted.markGroup === 'edge' ? JournalMarks.edge : JournalMarks.fill;
          adjusted.name = markName(adjusted.markGroup, choices.find(item => item.id === saved.pattern)?.name || layer.name);
        }
        if (adjusted.kind === 'type' && saved.text) adjusted.name = saved.text;
        return adjusted;
      });
      state = {
        ...state, style: JournalArt.design.id, aspect: 'journal', flat:true, bg:plan.background, montage:null,
        uploads: ids.filter(id => images.get(id).uploaded), layers:[...layers, ...extras],
        example, journal:{photos:[...ids],profile:plan.profile,hero:plan.hero}
      };
      selectedId = null;
      showTab('layers');
    }, '点击虚线文字框修改文案，或在图层面板替换照片、印纹和字体。');
    setJournalStatus((example ? '样例' : '已排版 ' + ids.length + ' 张照片') + ' · ' + JournalArt.labels[plan.profile]);
    if (reveal) openStudio();
  }

  async function loadJournalExample(layout = 'banner') {
    if (!ready) await loaded;
    $('journal-layout').value = layout;
    $('journal-hero').value = 'auto';
    const sample = JournalArt.examples[layout];
    await loadAssets(sample.ids);
    if (signal.aborted) return;
    applyJournal(sample.ids, {example:true, seed:sample.seed});
  }

  function regenerateJournal() {
    const sources = journalSources();
    if (!sources.length) {
      loadJournalExample($('journal-layout').value === 'auto' ? 'banner' : $('journal-layout').value);
      return;
    }
    applyJournal(sources, {example:state.journal ? state.example : false, preserve:true});
  }

  async function loadJournalFiles(files) {
    const items = Array.from(files);
    if (!items.length || journalBusy) return;
    if (items.length < 2 || items.length > 5) {
      setJournalStatus('每次请选择 2–5 张照片。');
      return;
    }
    if (items.some(file => !file.size || file.size > 32 * 1024 * 1024)) {
      setJournalStatus('请选择可读取的图片，单张大小需在 32 MB 以内。');
      return;
    }
    journalBusy = true;
    syncJournalControls();
    $('journal-pick').disabled = true;
    setJournalStatus('正在读取照片并安排主景、文字和印纹…');
    const added = [];
    try {
      if (!ready) await loaded;
      for (const [index, file] of items.entries()) {
        const record = {id:'journal-photo-' + Collage.uid(), kind:'source',
          name:file.name || '照片 ' + (index+1), blob:file};
        const material = await prepareMaterial(record);
        added.push(material.id);
      }
      $('journal-hero').value = 'auto';
      applyJournal(added);
      lastJournalPhotos = [...added];
    } catch (error) {
      for (const id of added) {
        URL.revokeObjectURL(images.get(id).src);
        images.delete(id);
      }
      setJournalStatus('照片读取失败，请尝试重新选择 JPG、PNG 或 WebP。');
    } finally {
      journalBusy = false;
      $('journal-pick').disabled = false;
      syncJournalControls();
    }
  }

  function markName(group, name) {
    return (group === 'edge' ? '破边 · ' : '填充 · ') + name;
  }

  function addJournalElement(group) {
    const layer = JournalArt.manual(group, sequence++);
    if (group !== 'type') layer.name = markName(group, layer.name);
    edit(() => {
      state.layers.push(layer);
      selectedId = layer.id;
      showTab('layers');
    });
    if (group === 'type') {
      $('layer-text').focus();
      $('layer-text').select();
    }
  }

  function queueFiles(files) {
    if (files.length) upload(files, {reveal: true});
  }



  function arrangeLayer(step) {
    const current = currentLayer();
    if (!current) return;
    const index = state.layers.indexOf(current);
    const next = index + step;
    if (next < 0 || next >= state.layers.length) return;
    edit(() => {
      [state.layers[index], state.layers[next]] = [state.layers[next], state.layers[index]];
    });
  }

  function deleteLayer() {
    if (!currentLayer()) return;
    edit(() => {
      state.layers = state.layers.filter(layer => layer.id !== selectedId);
      selectedId = null;
    }, '已删除图层。');
  }

  function finishFilter() {
    if (!filterEdit) return;
    checkpoint(filterEdit);
    filterEdit = null;
    $('undo').disabled = false;
    $('redo').disabled = true;
  }

  function rangeLayer(key) {
    $(key).addEventListener('input', event => {
      const layer = currentLayer();
      if (!layer) return;
      filterEdit ??= structuredClone(state);
      updateLayer(layer, key, Number(event.target.value));
      $(key + '-value').textContent = event.target.value + (key === 'rotation' ? '°' : '%');
      enqueuePaint();
    });
    $(key).addEventListener('change', finishFilter);
    $(key).addEventListener('blur', finishFilter);
  }

  const transformFields = {
    rotation: {key:'rotation', factor:() => 1},
    scale: {key:'scale', factor:() => 1},
    'width-scale': {key:'scaleX', factor:layer => layer.scale},
    'height-scale': {key:'scaleY', factor:layer => layer.scale}
  };

  function transformValues(layer) {
    for (const [id,{key,factor}] of Object.entries(transformFields)) {
      const value = (layer[key] ?? 1) * factor(layer);
      const displayed = Number(value.toPrecision(10));
      $(id).value = displayed;
      $(id+'-value').textContent = displayed + (id==='rotation'?'°':'%');
    }
  }

  function updateTransformValue(id) {
    const layer = currentLayer();
    if (!layer) return;
    const {key,factor} = transformFields[id];
    const field = $(id);
    const value = field.valueAsNumber / factor(layer);
    if (!Number.isFinite(value) || (key!=='rotation' && value<=0)) {
      transformValues(layer);
      notice('请输入有效数值。缩放比例需要大于零。');
      return;
    }
    edit(() => { updateLayer(layer, key, value); });
  }

  const curveHandles=['start','control','end'];

  function clearDropCue() {
    dropCue?.classList.remove('is-drop-before','is-drop-after');
    dropCue=null;
  }

  function showDropCue(item, event) {
    clearDropCue();
    if (!item) return;
    const bounds=item.getBoundingClientRect();
    const above=event.clientY < bounds.top+bounds.height/2;
    item.classList.add(above?'is-drop-before':'is-drop-after');
    dropCue=item;
    return {id:Number(item.dataset.layer),above};
  }

  function reorderLayer(sourceId,targetId,above) {
    const from=state.layers.findIndex(layer=>layer.id===sourceId);
    const target=state.layers.findIndex(layer=>layer.id===targetId);
    if (from<0 || target<0 || from===target) return;
    const next=target+Number(above)-Number(from<target);
    if (next===from) return;
    edit(()=>{
      const [layer]=state.layers.splice(from,1);
      state.layers.splice(next,0,layer);
      selectedId=sourceId;
    },'已调整图层顺序。');
  }

  function bindReorderGrip(handle,layerId) {
    handle.addEventListener('pointerdown',event=>{
      if (event.button!==0 || reorderDrag || transformDrag || brushDraft) return;
      event.preventDefault();
      handle.focus({preventScroll:true});
      reorderDrag={layerId,pointerId:event.pointerId,target:null};
      handle.setPointerCapture?.(event.pointerId);
    });
    handle.addEventListener('pointermove',event=>{
      if (reorderDrag?.pointerId!==event.pointerId) return;
      const item=(root.elementFromPoint?.(event.clientX,event.clientY) ?? document.elementFromPoint(event.clientX,event.clientY))?.closest('#layer-list li')?.querySelector('.layer-item');
      reorderDrag.target=showDropCue(item,event);
    });
    const end=(event,cancel=false)=>{
      if (reorderDrag?.pointerId!==event.pointerId) return;
      const {target}=reorderDrag;
      reorderDrag=null;
      clearDropCue();
      if (target&&!cancel) reorderLayer(layerId,target.id,target.above);
    };
    handle.addEventListener('pointerup',end);
    handle.addEventListener('pointercancel',event=>end(event,true));
    handle.addEventListener('lostpointercapture',event=>end(event,true));
    handle.addEventListener('keydown',event=>{
      if (event.key!=='ArrowUp'&&event.key!=='ArrowDown') return;
      event.preventDefault();
      const index=state.layers.findIndex(layer=>layer.id===layerId);
      const above=event.key==='ArrowUp';
      const target=state.layers[index+(above?1:-1)];
      if (target) {
        reorderLayer(layerId,target.id,above);
        $('layer-list').querySelector('[data-reorder-layer="'+layerId+'"]')?.focus();
      }
    });
  }

  function currentCurveAmount(path) {
    return Math.max(-100,Math.min(100,Math.round(((path[0].y+path[2].y)/2-path[1].y)/.0064)));
  }

  function applyCurvePoint(layer,path,index,x,y) {
    const adjusted=path.map(point=>({...point}));
    const min=index===0 ? -.47 : adjusted[index-1].x+.018;
    const max=index===2 ? .47 : adjusted[index+1].x-.018;
    adjusted[index]={
      x:Math.max(min,Math.min(max,x)),
      y:Math.max(index===1?-.55:-.31,Math.min(index===1?.55:.31,y))
    };
    updateLayer(layer,'curvePath',adjusted);
    updateLayer(layer,'curve',currentCurveAmount(adjusted));
  }

  function startCurveDrag(event,index) {
    const layer=currentLayer();
    if (!ready || layer?.kind!=='type' || layer.id!==curveEditId || brushMode ||
        transformDrag || drag || event.button!==0) return;
    event.preventDefault();
    finishFilter();
    const box=Renderer.placement(layer,canvas.width,canvas.height);
    const controls=Renderer.textPathControls(canvas.getContext('2d'),layer,box.contentW,box.contentH);
    transformDrag={layer,pointerId:event.pointerId,before:structuredClone(state),changed:false,
      curveIndex:index,controls,box,start:canvasPoint(event)};
    event.currentTarget.setPointerCapture?.(event.pointerId);
  }

  function moveCurveHandle(gesture,event) {
    const [x,y]=canvasPoint(event);
    const [dx,dy]=[x-gesture.start[0],y-gesture.start[1]];
    if (!gesture.changed && Math.hypot(dx,dy)<.3) return;
    const {box,controls,layer,curveIndex:index}=gesture;
    const cos=Math.cos(box.angle), sin=Math.sin(box.angle);
    const point=controls.path[index];
    applyCurvePoint(layer,controls.path,index,point.x+(dx*cos+dy*sin)/box.w,
      point.y+(-dx*sin+dy*cos)/(controls.lineHeight*box.sy));
    gesture.changed=true;
    $('text-curve').value=layer.curve;
    enqueuePaint();
  }

  function curveHandleKey(event,index) {
    const directions={ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1]};
    const direction=directions[event.key];
    const layer=currentLayer();
    if (!direction || layer?.kind!=='type') return;
    event.preventDefault();
    const box=Renderer.placement(layer,canvas.width,canvas.height);
    const {path}=Renderer.textPathControls(canvas.getContext('2d'),layer,box.contentW,box.contentH);
    const point=path[index];
    const step=event.shiftKey?.04:.012;
    edit(()=>applyCurvePoint(layer,path,index,point.x+direction[0]*step,point.y+direction[1]*step));
  }

  function positionTransformOverlay(layer) {
    const overlay = $('transform-overlay');
    if (!layer || layer.hidden || brushMode) {
      overlay.hidden = true;
      return;
    }
    const canvasRect = canvas.getBoundingClientRect();
    const stageRect = stage.getBoundingClientRect();
    const box = Renderer.placement(layer,canvas.width,canvas.height);
    if (!(canvasRect.width && canvasRect.height && stageRect.width && stageRect.height &&
      [box.x, box.y, box.w, box.h].every(Number.isFinite) && box.w>0 && box.h>0)) {
      overlay.hidden = true;
      return;
    }
    const sx=canvasRect.width/canvas.width;
    const sy=canvasRect.height/canvas.height;
    const baseX=canvasRect.left-stageRect.left;
    const baseY=canvasRect.top-stageRect.top;
    const project=([x,y])=>[baseX+x*sx,baseY+y*sy];
    const [cx,cy]=project([box.x,box.y]);
    const outline=$('transform-outline');
    outline.style.left=(cx-box.w*sx/2)+'px';
    outline.style.top=(cy-box.h*sy/2)+'px';
    outline.style.width=box.w*sx+'px';
    outline.style.height=box.h*sy+'px';
    outline.style.transform='rotate('+box.angle+'rad)';
    const points=LayerTransform.points(box);
    const sin=Math.sin(box.angle);
    const cos=Math.cos(box.angle);
    const marks=[
      ['resize',project(points.resize),[0,0]],
      ['rotate',project(points.rotate),[sin*22,-cos*22]]
    ];
    const editing=layer.kind==='type' && layer.id===curveEditId;
    const tape=JournalMarks.isTape(layer) && !editing;
    $('transform-tape').hidden=!tape;
    $('transform-resize').hidden=editing;
    $('transform-rotate').hidden=editing;
    for (const key of curveHandles) $('text-path-'+key).hidden=!editing;
    if (tape) marks.push(['tape',project(points.tape),[cos*25,sin*25]]);
    if (editing) {
      const controls=Renderer.textPathControls(canvas.getContext('2d'),layer,box.contentW,box.contentH);
      marks.length=0;
      for (const [index,[px,py]] of controls.points.entries()) {
        const x=px*box.sx,y=py*box.sy;
        marks.push(['path-'+curveHandles[index],project([box.x+x*cos-y*sin,box.y+x*sin+y*cos]),[0,0]]);
      }
    }
    const inset=22;
    const clamp=(value,max)=>Math.max(inset,Math.min(Math.max(inset,max-inset),value));
    const placed=[];
    for (const [key,[x,y],[dx,dy]] of marks) {
      const preferred=[clamp(x+dx,stageRect.width),clamp(y+dy,stageRect.height)];
      const alternatives=[[0,0],[0,-45],[0,45],[-45,0],[45,0],[-45,-45],[45,45]];
      const point=alternatives.map(([a,b])=>[clamp(preferred[0]+a,stageRect.width),clamp(preferred[1]+b,stageRect.height)])
        .find(candidate=>placed.every(previous=>Math.hypot(candidate[0]-previous[0],candidate[1]-previous[1])>=42)) || preferred;
      placed.push(point);
      const button=$(key.startsWith('path-')?'text-'+key:'transform-'+key);
      button.style.left=point[0]+'px';
      button.style.top=point[1]+'px';
      if (key==='tape') {
        button.querySelector('svg').style.transform='rotate('+box.angle+'rad)';
        const axis=(Math.round(box.angle/(Math.PI/4))+8)%4;
        button.style.cursor=['ew-resize','nwse-resize','ns-resize','nesw-resize'][axis];
      }
    }
    overlay.hidden=false;
  }

  function useTransformPatch(layer,patch) {
    if (Object.values(patch).some(value=>!Number.isFinite(value))) return false;
    if (Object.entries(patch).every(([key,value])=>(layer[key] ?? 1)===value)) return false;
    for (const [key,value] of Object.entries(patch)) {
      if (key==='x' || key==='y') layer[key]=value;
      else updateLayer(layer,key,value);
    }
    return true;
  }

  function startTransform(event,handle) {
    const layer=currentLayer();
    if (!ready || !layer || brushMode || drag || transformDrag || event.button!==0) return;
    event.preventDefault();
    finishFilter();
    const {width,height}=canvas;
    const box=Renderer.placement(layer,width,height);
    const point=canvasPoint(event);
    const session=LayerTransform.begin({layer,box,handle,point,width,height});
    transformDrag={layer,session,pointerId:event.pointerId,before:structuredClone(state),changed:false};
    event.currentTarget.setPointerCapture?.(event.pointerId);
  }

  function moveTransform(event) {
    const gesture=transformDrag;
    if (!gesture || gesture.pointerId!==event.pointerId || !state.layers.includes(gesture.layer)) return;
    if (gesture.curveIndex!==undefined) {
      moveCurveHandle(gesture,event);
      return;
    }
    const lock=$('transform-lock').checked!==Boolean(event.shiftKey);
    const patch=LayerTransform.update(gesture.session,canvasPoint(event),{lock});
    if (useTransformPatch(gesture.layer,patch)) {
      gesture.changed=true;
      transformValues(gesture.layer);
      enqueuePaint();
    }
  }

  function endTransform(event,cancel=false) {
    const gesture=transformDrag;
    if (!gesture || (event && gesture.pointerId!==event.pointerId)) return;
    if (event && event.type==='pointerup' && !cancel) moveTransform(event);
    transformDrag=null;
    if (!state.layers.includes(gesture.layer)) return;
    if (cancel) state=gesture.before;
    else if (gesture.changed) checkpoint(gesture.before);
    render();
  }

  function handleKey(event,handle) {
    const layer=currentLayer();
    const delta={ArrowLeft:-1,ArrowDown:-1,ArrowRight:1,ArrowUp:1}[event.key];
    if (!layer || !delta) return;
    event.preventDefault();
    const step=event.shiftKey?15:1;
    if (handle==='rotate') {
      edit(()=>{updateLayer(layer,'rotation',layer.rotation+delta*step);});
      return;
    }
    const {width,height}=canvas;
    const box=Renderer.placement(layer,width,height);
    const point=LayerTransform.points(box)[handle];
    const session=LayerTransform.begin({layer,box,handle,point,width,height});
    const lock=$('transform-lock').checked;
    const dw=(handle==='tape' || lock || event.key==='ArrowLeft' || event.key==='ArrowRight') ? box.w*.05*delta*step:0;
    const dh=handle==='resize' && (lock || event.key==='ArrowDown' || event.key==='ArrowUp') ? box.h*.05*delta*step:0;
    const cos=Math.cos(box.angle);
    const sin=Math.sin(box.angle);
    const patch=LayerTransform.update(session,[point[0]+dw*cos-dh*sin,point[1]+dw*sin+dh*cos],{lock});
    edit(()=>{useTransformPatch(layer,patch);});
  }

  function toggleBrush(enabled) {
    brushMode=enabled;
    stage.classList.toggle('is-drawing',enabled);
    $('tool-brush').setAttribute('aria-pressed',String(enabled));
    $('brush-options').hidden=!enabled;
    if (!enabled) brushDraft=null;
    notice(enabled ? '在画布上画线，完成后再次点画笔或按 Esc。' : '已切回图层编辑。');
    enqueuePaint();
  }

  function addTapeLayer() {
    if (!ready) return;
    if (brushMode) toggleBrush(false);
    const mark=JournalArt.manual('edge',JournalMarks.edge.findIndex(pattern=>pattern.id==='tape'));
    const layer={...mark,name:'胶带 · 撕边',w:310,h:46,rotation:-8,opacity:88};
    edit(()=>{
      state.layers.push(layer);
      selectedId=layer.id;
      showTab('layers');
    },'拖动胶带右侧长轴手柄，沿胶带方向延长。');
  }

  function appendBrushSamples(event) {
    const samples=event.getCoalescedEvents?.() || [];
    for (const entry of (samples.length?samples:[event])) {
      const [x,y]=canvasPoint(entry);
      if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
      const previous=brushDraft.samples.at(-1);
      if (previous && Math.hypot(previous.x-x,previous.y-y)<.32) continue;
      brushDraft.samples.push({x,y,pressure:entry.pressure,pointerType:event.pointerType});
    }
  }

  function startBrush(event) {
    if (!ready || brushDraft || event.button!==0) return;
    const size=$('brush-size').valueAsNumber;
    if (!(size>0&&Number.isFinite(size))) {
      notice('请输入大于零的笔宽。');
      return;
    }
    const settings={style:$('brush-style').value,color:$('brush-color').value,size,id:Collage.uid()};
    brushDraft={pointerId:event.pointerId,settings,samples:[]};
    appendBrushSamples(event);
    canvas.setPointerCapture?.(event.pointerId);
    enqueuePaint();
  }

  function moveBrush(event) {
    if (!brushDraft || brushDraft.pointerId!==event.pointerId) return;
    appendBrushSamples(event);
    enqueuePaint();
  }

  function endBrush(event,cancel=false) {
    if (!brushDraft || brushDraft.pointerId!==event.pointerId) return;
    if (!cancel) appendBrushSamples(event);
    const {samples,settings}=brushDraft;
    brushDraft=null;
    const layer=cancel?null:BrushArt.create(samples,canvas.width,canvas.height,settings);
    if (layer) {
      layer.journalManual=true;
      edit(()=>{
        state.layers.push(layer);
        selectedId=layer.id;
        showTab('layers');
      },'已添加笔刷笔迹。退出画笔即可缩放、旋转和改色。');
    } else enqueuePaint();
  }

  function updateVariation(event) {
    state.variation = Number(event.target.value);
    $('variation-value').value = event.target.value + '%';
  }

  function canvasPoint(event) {
    const rect = canvas.getBoundingClientRect();
    return [(event.clientX - rect.left) * canvas.width / rect.width, (event.clientY - rect.top) * canvas.height / rect.height];
  }

  function startDrag(event) {
    if (!ready || drag || transformDrag || event.button !== 0) return;
    if (brushMode) {
      startBrush(event);
      return;
    }
    const [x, y] = canvasPoint(event);
    const layer = Renderer.hitTest(canvas.getContext('2d'), state, x, y, images);
    chooseLayer(layer?.id ?? null, false);
    if (!layer) return;
    drag = {
      pointerId: event.pointerId, layer, startX: x, startY: y,
      x: layer.x, y: layer.y, moved: false, before: structuredClone(state)
    };
    canvas.setPointerCapture?.(event.pointerId);
    canvas.classList.add('dragging');
  }

  function moveDrag(event) {
    if (brushMode) {
      moveBrush(event);
      return;
    }
    if (!drag || drag.pointerId !== event.pointerId) return;
    const [x, y] = canvasPoint(event);
    const dx = (x - drag.startX) * 1200 / canvas.width;
    const dy = (y - drag.startY) * 800 / canvas.height;
    if (!drag.moved && Math.abs(dx) + Math.abs(dy) < 3) return;
    drag.moved = true;
    if (Number.isFinite(drag.x+dx)) drag.layer.x=drag.x+dx;
    if (Number.isFinite(drag.y+dy)) drag.layer.y=drag.y+dy;
    enqueuePaint();
  }

  function endDrag(event, cancel = false) {
    if (brushDraft) {
      endBrush(event,cancel);
      return;
    }
    if (!drag || drag.pointerId !== event.pointerId) return;
    if (cancel) {
      drag.layer.x = drag.x;
      drag.layer.y = drag.y;
    } else if (drag.moved) {
      checkpoint(drag.before);
      $('undo').disabled = false;
      $('redo').disabled = true;
    } else {
      showTab('layers');
    }
    drag = null;
    canvas.classList.remove('dragging');
    enqueuePaint();
  }

  function renderExportSize() {
    const factor = Number($('resolution').value);
    const [w, h] = Renderer.sizes[state.aspect];
    $('export-size').textContent = w * factor + ' × ' + h * factor + ' px';
  }

  async function downloadWork() {
    const button = $('download');
    button.disabled = true;
    const name = $('work-title').textContent;
    const type = $('file-format').value;
    try {
      const output = document.createElement('canvas');
      await loadAssets(state.layers.map(layer => layer.asset));
      Renderer.paint(output, state, images, {ratio: Number($('resolution').value)});
      const blob = await new Promise(resolve => output.toBlob(resolve, type === 'png' ? 'image/png' : 'image/jpeg', .94));
      if (!blob) throw new Error('Empty export');
      const link = document.createElement('a');
      link.download = 'FrameLab-' + name + '.' + type;
      link.href = URL.createObjectURL(blob);
      document.body.append(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(link.href), 12000);
      $('export-dialog').close();
      notice('已生成 ' + type.toUpperCase() + ' 文件。');
    } catch {
      $('export-size').textContent = '导出失败，请尝试较小的输出尺寸。';
    } finally {
      button.disabled = false;
    }
  }

  buildEditorial();
  templateGallery = TemplateGallery.create({
    groups: CollageTemplates.groups, designs: CollageTemplates.designs,
    async onApply(id) {
      if (!ready) await loaded;
      applyDesign(id, false, true);
      showTab('layers');
      showStudio();
    }
  });
  const montageForm = $('montage-rules');
  for (const [key,choices] of Object.entries(MontageArt.choices)) {
    montageForm.elements.namedItem(key).append(...choices.map(([id,label])=>new Option(label,id)));
  }
  setMontageControls(MontageArt.defaults);
  montageForm.addEventListener('submit',async event => {
    event.preventDefault();
    if (!ready) await loaded;
    await loadAssets(CollageTemplates.library.map(asset => asset.id));
    if (signal.aborted) return;
    const settings = Object.fromEntries(Object.keys(MontageArt.choices).map(key=>[key,montageForm.elements.namedItem(key).value]));
    settings.useUploads = montageForm.elements.namedItem('uploads').checked;
    edit(()=>composeMontage(settings),'已按所选规则生成，可在图层面板继续调整。');
    showTab('layers');
    showStudio();
  });
  document.fonts?.load('400 44px "Template Brush"', '山野手记去有风的地方').then(enqueuePaint).catch(() => {});
  document.fonts?.load('600 36px "Journal Hand"', 'Letters from the hills').then(enqueuePaint).catch(() => {});
  for (const asset of library) images.set(asset.id, {...asset, src: assetRoot + asset.file});
  function loadAssets(ids) {
    return Promise.allSettled([...new Set(ids)].map(id => {
      const asset = images.get(id);
      if (!asset || asset.image) return null;
      asset.loading ??= loadImage(asset.src).then(image => {
        asset.image = image;
        if (asset.kind === 'cutout') asset.alpha = alphaPreview(image);
      }).catch(error => {
        asset.loading = undefined;
        throw error;
      });
      return asset.loading;
    }));
  }

  const loaded = (async () => {
    let problem;
    try {
      if (project) await restoreProject(project);
      else if (source?.blob) {
        const asset = await prepareMaterial({id:'framelab-input', name:source.name || '画布照片', kind:'source', blob:source.blob});
        state.layers = [Collage.photo(asset, 600, 400, 1200, 800, {fit:'contain', mask:'rect'})];
        state.uploads = [asset.id];
        state.example = false;
        state.flat = true;
        state.bg = '#f2f1ed';
        selectedId = state.layers[0].id;
        showTab('layers');
      }
    } catch (error) {
      problem = error.message;
    }
    if (signal.aborted) return;
    const results = await loadAssets(state.layers.map(layer => layer.asset));
    if (signal.aborted) return;
    ready = true;
    savedState = JSON.stringify(state);
    render();
    $('poster-fallback').hidden = true;
    $('atelier-save').disabled = false;
    if (problem) notice(problem);
    else if (results.some(item => item.status === 'rejected')) notice('有素材暂时加载失败，可重试打开这项素材。');
    else notice('');
  })();

  $('upload').addEventListener('click', openFilePicker);
  $('image-input').addEventListener('change', event => {
    queueFiles(event.target.files);
    event.target.value = '';
  });
  $('undo').addEventListener('click', () => navigateHistory(history, future, '已撤销。'));
  $('redo').addEventListener('click', () => navigateHistory(future, history, '已重做。'));
  $('aspect').addEventListener('change', event => edit(() => { state.aspect = event.target.value; }));
  $('restore').addEventListener('click', resetExample);
  $('remix').addEventListener('click', () => applyDesign(state.style, true));
  $('variation').addEventListener('input', updateVariation);
  $('variation').title = '改变下一次重组构图的幅度';
  $('tab-compose').addEventListener('click', () => showTab('compose'));
  $('tab-layers').addEventListener('click', () => showTab('layers'));
  root.querySelector('.inspector-tabs').addEventListener('keydown', event => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    const next = event.key === 'Home' ? 'compose' : event.key === 'End' ? 'layers' : activeTab === 'compose' ? 'layers' : 'compose';
    showTab(next, true);
  });
  $('add-shape').addEventListener('click', addPaper);
  $('add-type').addEventListener('click', addText);
  $('layer-up').addEventListener('click', () => arrangeLayer(1));
  $('layer-down').addEventListener('click', () => arrangeLayer(-1));
  $('layer-delete').addEventListener('click', deleteLayer);
  $('layer-toggle').addEventListener('click', () => {
    const layer = currentLayer();
    if (layer) edit(() => { updateLayer(layer, 'hidden', !layer.hidden); });
  });
  $('layer-replace').addEventListener('click', pickReplacement);
  $('layer-image-input').addEventListener('change', replaceLayer);
  function pasteLayer(source) {
    if (!source) return;
    edit(() => {
      const copy = {...structuredClone(source), journalRole:undefined, journalEdits:undefined,
        journalManual:Boolean(state.journal), id:Collage.uid(), x:source.x+28, y:source.y+20, name:source.name+' 副本'};
      const selected = currentLayer();
      state.layers.splice(selected ? state.layers.indexOf(selected)+1 : state.layers.length, 0, copy);
      selectedId = copy.id;
      showTab('layers');
    }, '已粘贴图层。');
  }
  $('layer-copy').addEventListener('click', () => pasteLayer(currentLayer()));
  $('text-curve').addEventListener('input', event => {
    const layer = currentLayer();
    if (layer?.kind !== 'type') return;
    filterEdit ??= structuredClone(state);
    const amount=Number(event.target.value);
    if (layer.curvePath) {
      const path=layer.curvePath;
      applyCurvePoint(layer,path,1,path[1].x,(path[0].y+path[2].y)/2-.0064*amount);
    } else updateLayer(layer,'curve',amount);
    enqueuePaint();
  });
  $('text-path-edit').addEventListener('click',()=>{
    const layer=currentLayer();
    if (layer?.kind!=='type') return;
    curveEditId=curveEditId===layer.id?null:layer.id;
    renderLayerPanel();
    enqueuePaint();
  });
  for (const [index,key] of curveHandles.entries()) {
    const handle=$('text-path-'+key);
    handle.addEventListener('pointerdown',event=>startCurveDrag(event,index));
    handle.addEventListener('pointermove',moveTransform);
    handle.addEventListener('pointerup',endTransform);
    handle.addEventListener('pointercancel',event=>endTransform(event,true));
    handle.addEventListener('lostpointercapture',event=>endTransform(event,true));
    handle.addEventListener('keydown',event=>curveHandleKey(event,index));
  }
  $('text-curve').addEventListener('change', finishFilter);
  $('text-curve').addEventListener('blur', finishFilter);
  rangeLayer('opacity');
  for (const id of Object.keys(transformFields)) {
    $(id).addEventListener('change',()=>updateTransformValue(id));
  }
  $('tool-brush').addEventListener('click',()=>{if (ready && !transformDrag) toggleBrush(!brushMode);});
  $('tool-tape').addEventListener('click',addTapeLayer);
  for (const kind of ['resize','rotate','tape']) {
    const button=$('transform-'+kind);
    button.addEventListener('pointerdown',event=>startTransform(event,kind));
    button.addEventListener('pointermove',moveTransform);
    button.addEventListener('pointerup',endTransform);
    button.addEventListener('pointercancel',event=>endTransform(event,true));
    button.addEventListener('lostpointercapture',event=>endTransform(event,true));
    button.addEventListener('keydown',event=>handleKey(event,kind));
  }
  for (const key of ['mask', 'tone', 'blend']) {
    $(key).addEventListener('change', event => {
      const layer = currentLayer();
      if (layer) edit(() => { updateLayer(layer, key, event.target.value); });
    });
  }
  $('layer-color').addEventListener('change', event => {
    const layer = currentLayer();
    if (layer) edit(() => { updateLayer(layer, 'color', event.target.value); });
  });
  $('layer-text').addEventListener('change', event => {
    const layer = currentLayer();
    if (layer) edit(() => {
      updateLayer(layer, 'text', event.target.value.trim() || '文字');
      layer.name = layer.text;
    });
  });

  $('journal-pick').addEventListener('click', () => $('journal-files').click());
  $('journal-files').addEventListener('change', event => {
    loadJournalFiles(event.target.files);
    event.target.value = '';
  });
  $('journal-regenerate').addEventListener('click', regenerateJournal);
  root.querySelectorAll('[data-journal-layout]').forEach(button => {
    button.addEventListener('click', () => loadJournalExample(button.dataset.journalLayout));
  });
  function journalHasFiles(event) {
    return Array.from(event.dataTransfer?.types || []).includes('Files');
  }
  $('journal-pick').addEventListener('dragover', event => {
    if (!journalHasFiles(event)) return;
    event.preventDefault();
    $('journal-pick').classList.add('is-dragging');
  });
  $('journal-pick').addEventListener('dragleave', event => {
    if (!(event.relatedTarget instanceof Node) || !$('journal-pick').contains(event.relatedTarget)) $('journal-pick').classList.remove('is-dragging');
  });
  $('journal-pick').addEventListener('drop', event => {
    if (!journalHasFiles(event)) return;
    event.preventDefault();
    $('journal-pick').classList.remove('is-dragging');
    loadJournalFiles(event.dataTransfer.files);
  });
  for (const kind of ['edge','fill','type']) $('journal-add-' + kind).addEventListener('click', () => addJournalElement(kind));
  $('journal-pattern').addEventListener('change', event => {
    const layer = currentLayer();
    if (layer?.kind !== 'mark') return;
    const list = layer.markGroup === 'edge' ? JournalMarks.edge : JournalMarks.fill;
    const pattern = list.find(item => item.id === event.target.value);
    if (!pattern) return;
    edit(() => {
      updateLayer(layer, 'pattern', pattern.id);
      layer.name = markName(layer.markGroup, pattern.name);
    });
  });
  $('journal-font').addEventListener('change', event => {
    const layer = currentLayer();
    if (layer?.kind === 'type') edit(() => { updateLayer(layer, 'font', event.target.value); });
  });

  canvas.addEventListener('dblclick', event => {
    if (!state.journal || brushMode) return;
    const [x,y] = canvasPoint(event);
    const layer = Renderer.hitTest(canvas.getContext('2d'), state, x, y, images);
    if (layer?.kind === 'type') {
      chooseLayer(layer.id, true);
      $('layer-text').focus();
      $('layer-text').select();
    }
  });
  canvas.addEventListener('pointerdown', startDrag);
  canvas.addEventListener('pointermove', moveDrag);
  canvas.addEventListener('pointerup', endDrag);
  canvas.addEventListener('pointercancel', event => endDrag(event, true));
  canvas.addEventListener('lostpointercapture', event => endDrag(event, true));
  stage.addEventListener('dragenter', event => {
    if (!event.dataTransfer.types.includes('Files')) return;
    event.preventDefault();
    stageDragDepth++;
    stage.classList.add('drop-active');
  });
  stage.addEventListener('dragover', event => {
    if (!event.dataTransfer.types.includes('Files')) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = 'copy';
  });
  stage.addEventListener('dragleave', () => {
    stageDragDepth = Math.max(0, stageDragDepth - 1);
    if (!stageDragDepth) stage.classList.remove('drop-active');
  });
  stage.addEventListener('drop', event => {
    if (!event.dataTransfer.types.includes('Files')) return;
    event.preventDefault();
    stageDragDepth = 0;
    stage.classList.remove('drop-active');
    queueFiles(event.dataTransfer.files);
  });
  const resizeObserver = new ResizeObserver(() => {
    const [w, h] = Renderer.sizes[state.aspect];
    stage.style.setProperty('--max-art', Math.min(680, Math.max(150, stage.clientHeight - 46) * w / h) + 'px');
    enqueuePaint();
  });
  resizeObserver.observe(stage);

  $('export').addEventListener('click', () => {
    if (!ready) return;
    renderExportSize();
    $('export-dialog').showModal();
  });
  $('resolution').addEventListener('change', renderExportSize);
  $('download').addEventListener('click', downloadWork);
  $('view').addEventListener('click', async () => {
    if (!ready) return;
    await loadAssets(state.layers.map(layer => layer.asset));
    if (signal.aborted) return;
    Renderer.paint($('preview-canvas'), state, images);
    $('view-dialog').showModal();
  });
  root.addEventListener('keydown', event => {
    if (event.key==='Escape' && (brushMode || transformDrag || curveEditId!==null)) {
      event.preventDefault();
      if (transformDrag) endTransform(null,true);
      if (brushMode) toggleBrush(false);
      if (curveEditId!==null) {
        curveEditId=null;
        renderLayerPanel();
        enqueuePaint();
      }
      return;
    }
    if (brushDraft || transformDrag) return;
    const field = event.target.closest?.('input,select,textarea,dialog,[contenteditable]');
    if (field || event.defaultPrevented || !ready) return;
    const key = event.key.toLowerCase();
    if ((event.ctrlKey || event.metaKey) && !event.altKey && !event.shiftKey &&
        event.target.closest?.('#studio') && document.getSelection()?.isCollapsed!==false) {
      const layer = currentLayer();
      if (key === 'v' && layerClipboard) {
        event.preventDefault();
        pasteLayer(layerClipboard);
        return;
      }
      if (layer && ['c','x','d'].includes(key)) {
        event.preventDefault();
        if (key === 'd') pasteLayer(layer);
        else {
          layerClipboard = structuredClone(layer);
          if (key === 'x') deleteLayer();
          else notice('已复制图层，按 Ctrl/⌘+V 粘贴。');
        }
        return;
      }
    }
    if ((event.ctrlKey || event.metaKey) && ['z', 'y'].includes(key)) {
      event.preventDefault();
      if (event.shiftKey || key === 'y') navigateHistory(future, history, '已重做。');
      else navigateHistory(history, future, '已撤销。');
      return;
    }
    const layer = currentLayer();
    if (!layer || (event.target !== canvas && !event.target.closest?.('#panel-layers'))) return;
    if (key === 'delete' || key === 'backspace') {
      event.preventDefault();
      deleteLayer();
    }
    const directions = {arrowleft: [-1, 0], arrowright: [1, 0], arrowup: [0, -1], arrowdown: [0, 1]};
    if (!directions[key]) return;
    event.preventDefault();
    const [dx, dy] = directions[key];
    const step = event.shiftKey ? 20 : 4;
    edit(() => {
      layer.x += dx*step;
      layer.y += dy*step;
    });
  });

  async function restoreProject(value) {
    const packed = await unpackProject(value);
    const draft = packed.atelier;
    if (!draft || !styleById.has(draft.style) || !Object.hasOwn(Renderer.sizes, draft.aspect) ||
        !Array.isArray(draft.uploads) || !Array.isArray(packed.materials) || packed.materials.length > 128) {
      throw new Error('无法读取这个拼贴工程。');
    }
    await Promise.all(packed.materials.map(record => prepareMaterial({
      ...record, blob: deserializeMaterial(record)
    })));
    state = {...draft, layers:packed.layers};
    if (state.montage) setMontageControls(state.montage);
    else if (styleById.get(state.style).group === 'montage') setMontageControls();
    showTab('layers');
  }

  async function saveStudio() {
    if (!ready || saving) return;
    saving = true;
    const button = $('atelier-save');
    button.disabled = true;
    const page = root.querySelector('.page');
    const menu = root.querySelector('.atelier-nav');
    page.inert = menu.inert = true;
    $('atelier-back').disabled = $('atelier-grade').disabled = true;
    try {
      finishFilter();
      const snapshot = JSON.stringify(state);
      const {layers, ...draft} = JSON.parse(snapshot);
      const used = [...new Set([...draft.uploads, ...layers.map(layer => layer.asset)])];
      await loadAssets(used);
      signal.throwIfAborted();
      const materials = await Promise.all(used.map(id => images.get(id)).filter(asset => asset?.uploaded).map(serializeMaterial));
      const project = await packProject({layers, atelier:draft, materials});
      const picture = document.createElement('canvas');
      Renderer.paint(picture, {...draft, layers}, images);
      const preview = await canvasBlob(picture, 'image/jpeg', .88);
      signal.throwIfAborted();
      await onSave({project, preview, width:picture.width, height:picture.height});
      savedState = snapshot;
      notice('拼贴已保存到画布。');
    } catch (error) {
      if (!signal.aborted) notice(error.message.replace('调色工程','拼贴工程'));
    } finally {
      saving = false;
      button.disabled = false;
      page.inert = menu.inert = false;
      $('atelier-back').disabled = $('atelier-grade').disabled = false;
    }
  }

  $('atelier-save').addEventListener('click', saveStudio, {signal});
  signal.addEventListener('abort', () => {
    resizeObserver.disconnect();
    for (const asset of images.values()) {
      if (asset.uploaded) URL.revokeObjectURL(asset.src);
    }
  }, {once:true});
  return {
    ready:loaded,
    useMaterials,
    materialLimit:MAX_UPLOADS,
    isDirty:() => ready && savedState !== JSON.stringify(state),
    isSaving:() => saving
  };
}
