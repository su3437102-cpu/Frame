import { DEFAULT_SETTINGS, PRESETS, parseCube, renderGrade } from './grade-engine.mjs';
import { planAutomaticGrade } from './automatic-grade.mjs';
import { generateSubjectMask } from './matte.mjs';
import { generateBoxMask } from './box-segment.mjs';
import { installBoxSelection } from './box-selection.mjs';
import { installCanvasViewport } from './canvas-viewport.mjs';
import { installCurveEditor, drawHistogram } from './color-controls.mjs';
import { OPEN_LUTS } from './luts/catalog.mjs';
import { FILMS, PAPERS, FILM_CONTROLS, filmDefaults, normalizeFilmPrint, renderFilmPrint } from './film-print.mjs';
import { FEISHU_LOOKS } from './luts/feishu/catalog.mjs';
import { applyGlow, DEFAULT_GLOW, normalizeGlow } from './glow-engine.mjs';
import { extractReferenceLook, lookSwatches, lookToLut } from './look-extractor.mjs';
import {
  LOOK_NAME_LIMIT, LOOK_STORAGE_KEY, createLookTemplate, decodeLookTemplate, encodeLookTemplate,
  readLookLibrary, writeLookLibrary
} from './look-library.mjs';
import { fromBase64, packLut, packProject, toBase64, unpackLut, unpackProject } from './framelab-project.mjs';

export function mountColorBoard(root, { source = '', name = '', theme = 'light', project, legacyPreview, onSave, onClose, onCollage, signal } = {}) {
  const document = root.ownerDocument;
  const window = document.defaultView;
  const host = root.host;
  const listeners = new AbortController();
  const listenerOptions = { signal: listeners.signal };
  const $ = selector => root.querySelector(selector);
  const $$ = selector => [...root.querySelectorAll(selector)];
  const el = id => root.getElementById(id);
  const clamp = (value, low, high) => Math.max(low, Math.min(high, value));
  const menuBar = $('.spektralab-menus');
  const menuCommands = $$('[data-workbench-command]');

  function closeTopMenu(restoreFocus = false) {
    const open = menuBar.querySelector('details[open]');
    if (!open) return false;
    open.open = false;
    if (restoreFocus) open.querySelector('summary').focus();
    return true;
  }
  for (const button of menuCommands) {
    button.addEventListener('click', () => el(button.dataset.workbenchCommand).click(), listenerOptions);
  }
  menuBar.addEventListener('click', event => {
    if (event.target.closest('button')) closeTopMenu();
  }, listenerOptions);
  document.addEventListener('pointerdown', event => {
    if (!event.composedPath().includes(menuBar)) closeTopMenu();
  }, listenerOptions);
  root.addEventListener('keydown', event => {
    if (event.key !== 'Escape' || !closeTopMenu(true)) return;
    event.preventDefault();
    event.stopImmediatePropagation();
  }, listenerOptions);

  const paths = {
    'chevron-right': '<path d="m9 18 6-6-6-6"/>',
    'upload': '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5-5 5 5m-5-5v11"/>',
    'download': '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4m4-4 5 5 5-5m-5 5V3"/>',
    'sliders': '<path d="M4 21v-7m0-4V3m8 18v-9m0-4V3m8 18v-3m0-4V3M2 14h4m4-6h4m4 10h4"/>',
    'mask': '<path stroke-dasharray="2.5 3" d="M12 2.5a9.5 9.5 0 1 0 0 19 9.5 9.5 0 0 0 0-19Z"/><circle cx="12" cy="12" r="4"/>',
    'cards': '<rect x="3" y="7" width="16" height="14" rx="2"/><path d="M7 3h12a3 3 0 0 1 3 3v11m-19 0 4-4 3 3 3-4 6 6"/><circle cx="14" cy="11" r=".6"/>',
    'help': '<circle cx="12" cy="12" r="9"/><path d="M9 9a3 3 0 1 1 4.4 2.7c-1 .5-1.4 1.1-1.4 2.3m0 3h.01"/>',
    'image': '<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 16-5-5L5 21"/>',
    'compare': '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M12 2v20M8 12H6m10 0h2"/>',
    'expand': '<path d="M8 4H4v4m12-4h4v4m0 8v4h-4m-8 0H4v-4"/>',
    'plus': '<path d="M12 5v14M5 12h14"/>',
    'minus': '<path d="M5 12h14"/>',
    'sparkles': '<path d="M12 2 9.9 8.3 4 10l5.9 1.7L12 18l2.1-6.3L20 10l-5.9-1.7L12 2zm-8 13v6m-3-3h6M20 3v4m-2-2h4"/>',
    'eye': '<path d="M2 12s4-6 10-6 10 6 10 6-4 6-10 6-10-6-10-6Z"/><circle cx="12" cy="12" r="2.5"/>',
    'eye-off': '<path d="m3 3 18 18M10.6 6.1 12 6c6 0 10 6 10 6a15 15 0 0 1-2.5 2.8M6.5 7.5A16 16 0 0 0 2 12s4 6 10 6a11 11 0 0 0 4.5-.9"/>',
    'curve': '<path d="M3 3v18h18M5 17c5 0 4-5 8-5s3-5 7-5"/><circle cx="13" cy="12" r="1.4" fill="currentColor"/>',
    'reset': '<path d="M3 12a9 9 0 1 1 3 6.7M3 6v6h6"/>',
    'hand': '<path d="M7 12V6a1.5 1.5 0 0 1 3 0v5-7a1.5 1.5 0 0 1 3 0v7-6a1.5 1.5 0 0 1 3 0v6-4a1.5 1.5 0 0 1 3 0v7a7 7 0 0 1-7 7h-1a6 6 0 0 1-4.7-2.3l-3-3.9a1.6 1.6 0 0 1 2.5-2l1.2 1.1"/>',
    'rotate': '<path d="M18 5a8.5 8.5 0 1 0 2.3 9M18 2v4h-4"/><path d="M12 8v4l3 2"/>',
    'rotate-left': '<path d="M4 10h5M4 10V5m0 5a8.5 8.5 0 1 1 2 8"/>',
    'rotate-right': '<path d="M20 10h-5m5 0V5m0 5a8.5 8.5 0 1 0-2 8"/>',
    'brush': '<path d="m11 15 7-11a2 2 0 0 1 3 3l-9 9m0 0c.2 3.5-2.6 5-8 5 2-1.4 1-5 3.5-6.1a3 3 0 0 1 4.5 1.1Z"/>',
    'eraser': '<path d="M8 20 3.5 15.5a2 2 0 0 1 0-2.8l8.8-8.8a2 2 0 0 1 2.8 0l5 5a2 2 0 0 1 0 2.8L12 20H8Zm1-11 7 7m-4 4h9"/>',
    'invert': '<circle cx="12" cy="12" r="8.5"/><path d="M12 3.5a8.5 8.5 0 0 1 0 17Z" fill="currentColor"/>',
    'lock': '<rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3m-4 5v2"/>',
    'x': '<path d="m6 6 12 12M18 6 6 18"/>',
    'external': '<path d="M13 5h6v6m0-6-9 9m7-1v6H5V7h6"/>',
    'check': '<path d="m5 12 4 4L19 6"/>',
    'trash': '<path d="M4 7h16M9 7V4h6v3m3 0-1 13H7L6 7m4 4v5m4-5v5"/>',
    'loader': '<path d="M12 3a9 9 0 1 1-9 9"/>'
  };

  function icons(area = root) {
    for (const node of area.querySelectorAll('[data-icon]')) {
      const content = paths[node.dataset.icon];
      if (content) node.innerHTML = '<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round">' + content + '</svg>';
    }
  }

  const sections = [
    ['light', '明暗', 3, [
      ['exposure', '曝光', -3, 3, .01, ' EV'],
      ['contrast', '对比度'], ['highlights', '高光'], ['shadows', '阴影'], ['whites', '白色'], ['blacks', '黑色']
    ]],
    ['color', '色彩', 3, [
      ['temperature', '色温', -100, 100, 1, '', '#9eb8ee, #e9dce9, #f1bb80'],
      ['tint', '色调', -100, 100, 1, '', '#9ec5ac, #e8dce9, #d99bcc'],
      ['vibrance', '自然饱和度'], ['saturation', '饱和度'], ['hue', '色相', -180, 180, 1, '°']
    ]],
    ['texture', '质感', 3, [
      ['clarity', '清晰度'], ['dehaze', '去雾'], ['sharpen', '锐化', 0, 100],
      ['vignette', '暗角'], ['fade', '褪色', 0, 100], ['grain', '颗粒', 0, 100]
    ]]
  ];
  const hslRanges = [
    ['red', '红', '#df616b'], ['orange', '橙', '#e78d57'], ['yellow', '黄', '#dec260'],
    ['green', '绿', '#75ad79'], ['blue', '蓝', '#6796e5'], ['purple', '紫', '#a67bcf']
  ];
  const hslFields = [['hue', '色相', -180, 180, 1, '°'], ['saturation', '饱和度'], ['luminance', '明亮度']];

  const state = {
    photo: null,
    imageRequest: 0,
    settings: { ...DEFAULT_SETTINGS },
    presetId: null,
    baseLut: null,
    aiStrength: 100,
    aiRun: null,
    appliedLook: null,
    referenceLut: null,
    referenceStrength: 100,
    lut: null,
    lutName: '',
    lutLookId: '',
    lutStrength: 70,
    lutRequest: 0,
    lutPending: false,
    layers: [],
    filmPrint: filmDefaults(),
    glow: { ...DEFAULT_GLOW },
    glowEnabled: false,
    glowPresetId: null,
    glowBeforePreset: null,
    layerId: null,
    maskJob: null,
    maskMode: null,
    boxSession: null,
    colorLayerId: null,
    subjectPresetLayerId: null,
    maskOverlay: true,
    brushSize: 9,
    brushFeather: 72,
    panel: 'tone',
    hslRange: 'red',
    view: 'after',
    holdOriginal: false,
    compare: 50
  };
  const frameLab = { opening: true, dirty: false, saving: false, linkedImage: null };

  const original = el('original-canvas');
  const result = el('result-canvas');
  const overlay = el('overlay-canvas');
  const stage = el('photo-stage');
  const viewport = el('viewport');
  viewport.tabIndex = -1;
  const zoomLabel = el('zoom-fit');
  const viewportAngle = el('rotate-angle');
  const handTool = el('view-hand');
  const rotationTool = el('view-rotate');
  const brushCursor = el('mask-brush-cursor');
  let viewportView = { zoom: 1, rotation: 0, panMode: false, rotateMode: false };
  const canvasView = installCanvasViewport({
    viewport, stage, keyboardRoot: root,
    onChange(view) {
      if (!frameLab.opening && state.photo &&
          (view.rotation !== viewportView.rotation || Math.abs(view.zoom - viewportView.zoom) > 1e-6)) frameLab.dirty = true;
      viewportView = view;
      const zoom = Math.abs(view.zoom - 1) < .001 ? '适合' : Math.round(view.zoom * 100) + '%';
      const angle = Math.round(view.rotation) + '°';
      if (zoomLabel.textContent !== zoom) zoomLabel.textContent = zoom;
      if (viewportAngle.textContent !== angle) viewportAngle.textContent = angle;
      handTool.setAttribute('aria-pressed', String(view.panMode));
      rotationTool.setAttribute('aria-pressed', String(view.rotateMode));
      brushCursor.hidden = true;
    }
  });
  const inFlightMessage = el('ai-caption');
  const maskButton = el('create-subject-mask');
  const sourceContext = original.getContext('2d', { willReadFrequently: true });
  const resultContext = result.getContext('2d');
  const overlayContext = overlay.getContext('2d');
  let paintFrame = 0;
  let toastTimer = 0;

  function toast(message) {
    if (listeners.signal.aborted) return;
    const note = el('toast');
    clearTimeout(toastTimer);
    note.textContent = message;
    note.hidden = false;
    toastTimer = setTimeout(() => { note.hidden = true; }, 3900);
  }

  function createRange(scope, field, value, change) {
    const [key, name, min = -100, max = 100, step = 1, suffix = '', gradient = ''] = field;
    const row = document.createElement('div');
    row.className = 'range-row';
    const id = scope + '-' + key;
    const label = document.createElement('label');
    label.htmlFor = id;
    label.append(name + ' ');
    const output = document.createElement('output');
    output.htmlFor = id;
    label.append(output);
    const input = document.createElement('input');
    Object.assign(input, { type: 'range', id, min, max, step, value: value ?? 0 });
    if (gradient) input.style.setProperty('--track', 'linear-gradient(90deg, ' + gradient + ')');
    const format = number => (min < 0 && number > 0 ? '+' : '') + (step < 1 ? number.toFixed(2) : number) + suffix;
    const update = next => {
      input.value = next ?? 0;
      output.value = format(input.valueAsNumber);
    };
    input.addEventListener('input', () => {
      output.value = format(input.valueAsNumber);
      change(input.valueAsNumber);
    });
    input.addEventListener('dblclick', event => {
      event.preventDefault();
      if (min < 0) {
        update(0);
        change(0);
      }
    });
    update(value);
    row.append(label, input);
    return { row, update, key };
  }

  function bindDisclosure(button, content) {
    button.addEventListener('click', () => {
      content.hidden = !content.hidden;
      button.setAttribute('aria-expanded', String(!content.hidden));
    });
  }

  function appendRangeGroups(container, scope, groups, settings, change) {
    return groups.flatMap(([name, title, visibleCount, fields]) => {
      const group = document.createElement('div');
      group.className = 'control-group';
      const heading = document.createElement('h3');
      const ranges = fields.map(field => createRange(scope, field, settings[field[0]], value => change(field[0], value)));
      group.append(heading, ...ranges.slice(0, visibleCount).map(range => range.row));
      if (ranges.length > visibleCount) {
        const details = document.createElement('div');
        details.id = scope + '-' + name + '-details';
        details.hidden = true;
        details.append(...ranges.slice(visibleCount).map(range => range.row));
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'control-disclosure';
        button.setAttribute('aria-controls', details.id);
        button.setAttribute('aria-expanded', 'false');
        button.textContent = title;
        heading.append(button);
        group.append(details);
        bindDisclosure(button, details);
      } else {
        heading.textContent = title;
      }
      container.append(group);
      return ranges;
    });
  }

  const globalRanges = appendRangeGroups(el('tone-controls'), 'tone', sections, state.settings, (key, value) => {
    state.settings[key] = value;
    scheduleRender();
  });

  const aiRange = createRange('ai', ['strength', 'AI 强度', 0, 100, 1, '%'], state.aiStrength, value => {
    state.aiStrength = value;
    scheduleRender();
  });
  el('ai-strength-wrap').append(aiRange.row);

  const stockSelect = el('print-film');
  const paperSelect = el('print-paper');
  const filmToggle = el('film-print-toggle');
  stockSelect.append(...FILMS.map(film => new Option(film.name,film.id)));
  paperSelect.append(...PAPERS.map(paper => new Option(paper.name,paper.id)));
  const filmRanges = FILM_CONTROLS.map(field => {
    const range = createRange('film',field,state.filmPrint[field[0]],value => {
      state.filmPrint[range.key] = value;
      scheduleRender();
    });
    el('film-print-ranges').append(range.row);
    return range;
  });
  function syncFilmPrint() {
    const recipe = state.filmPrint;
    stockSelect.value = recipe.film;
    paperSelect.value = recipe.paper;
    filmToggle.textContent = recipe.enabled ? '关闭冲印' : '启用冲印';
    filmToggle.setAttribute('aria-pressed',String(recipe.enabled));
    el('film-print-state').hidden = !recipe.enabled;
    for (const range of filmRanges) range.update(recipe[range.key]);
  }
  function updateFilmPrint(recipe) {
    state.filmPrint = recipe;
    syncFilmPrint();
    scheduleRender();
  }
  stockSelect.addEventListener('change', () => {
    const {enabled,exposure,whiteBalance,contrast} = state.filmPrint;
    updateFilmPrint({...filmDefaults(stockSelect.value),enabled,exposure,whiteBalance,contrast});
  });
  paperSelect.addEventListener('change', () => updateFilmPrint({...state.filmPrint,paper:paperSelect.value}));
  filmToggle.addEventListener('click', () => updateFilmPrint({...state.filmPrint,enabled:!state.filmPrint.enabled}));
  el('film-print-reset').addEventListener('click', () => {
    updateFilmPrint({...filmDefaults(state.filmPrint.film),enabled:state.filmPrint.enabled});
  });
  syncFilmPrint();

  const glowButton = el('toggle-glow');
  const glowGroups = [
    ['bloom', '高光晕染', 2, [
      ['amount', '辉光强度', 0, 100, 1, '%'],
      ['threshold', '高光门槛', 0, 100, 1, '%'],
      ['radius', '扩散范围', 0, 100, 1, '%'],
      ['warmth', '辉光冷暖', -100, 100, 1, '', '#9eb8ee, #e9dce9, #f1bb80']
    ]],
    ['streak', '方向光带', 2, [
      ['streak', '光带强度', 0, 100, 1, '%'],
      ['angle', '光带方向', -90, 90, 1, '°']
    ]]
  ];
  const glowRanges = appendRangeGroups(el('glow-controls'), 'glow', glowGroups, state.glow, (key, value) => {
    state.glow[key] = value;
    if (key === 'amount') state.glowEnabled = value > 0;
    syncGlowControls();
    scheduleRender();
  });

  function syncGlowControls() {
    for (const range of glowRanges) range.update(state.glow[range.key]);
    glowButton.setAttribute('aria-pressed', String(state.glowEnabled));
    glowButton.querySelector('span').textContent = state.glowEnabled ? '关闭辉光' : '开启辉光';
    syncFeishuSelection();
  }

  function loadGlowPreset(look) {
    if (!state.glowPresetId) {
      state.glowBeforePreset = { settings: { ...state.glow }, enabled: state.glowEnabled };
    }
    state.glow = normalizeGlow(look.glow);
    state.glowEnabled = state.glow.amount > 0;
    state.glowPresetId = look.id;
    syncGlowControls();
    scheduleRender();
  }

  glowButton.addEventListener('click', () => {
    state.glowEnabled = !state.glowEnabled;
    if (state.glowEnabled && state.glow.amount === 0) state.glow.amount = 35;
    syncGlowControls();
    scheduleRender();
  });
  el('reset-glow').addEventListener('click', () => {
    state.glow = { ...DEFAULT_GLOW };
    state.glowEnabled = false;
    state.glowPresetId = null;
    state.glowBeforePreset = null;
    syncGlowControls();
    scheduleRender();
  });

  function syncSettings() {
    globalRanges.forEach(range => range.update(state.settings[range.key]));
    aiRange.update(state.aiStrength);
    el('ai-strength-wrap').hidden = !state.baseLut;
    syncAppliedLook();
    curveEditor.draw();
    setupHslRanges();
  }

  function sizedCanvas(image, maxSide, maxPixels = Infinity) {
    const width = image.naturalWidth || image.width;
    const height = image.naturalHeight || image.height;
    const ratio = Math.min(1, maxSide / Math.max(width, height), Math.sqrt(maxPixels / (width * height)));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(width * ratio));
    canvas.height = Math.max(1, Math.round(height * ratio));
    canvas.getContext('2d', { willReadFrequently: true }).drawImage(image, 0, 0, canvas.width, canvas.height);
    return canvas;
  }

  async function imageFrom(src) {
    listeners.signal.throwIfAborted();
    const image = new Image();
    const cancel = () => image.removeAttribute('src');
    listeners.signal.addEventListener('abort', cancel, { once: true });
    try {
      image.src = src;
      await image.decode();
      return image;
    } finally {
      listeners.signal.removeEventListener('abort', cancel);
    }
  }

  async function loadFile(file) {
    if (!file) return;
    if (file.size > 90 * 1024 * 1024) {
      toast('文件超过 90 MB，请换一张更小的照片。');
      return;
    }
    const request = ++state.imageRequest;
    const url = URL.createObjectURL(file);
    try {
      const image = await imageFrom(url);
      if (request !== state.imageRequest) return;
      mountPhoto(image, file.name.replace(/\.[^.]+$/, ''), false, file);
    } finally {
      URL.revokeObjectURL(url);
    }
  }

  function showOpenError(error) {
    if (listeners.signal.aborted) return;
    console.error(error);
    toast('无法打开这张照片，请试试 JPG、PNG 或 WebP。');
  }

  function mountPhoto(image, name, demo, file = null) {
    cancelFeishuApply();
    state.maskJob?.abort();
    state.maskJob = null;
    cancelBoxSelection();
    state.colorLayerId = null;
    state.subjectPresetLayerId = null;
    state.aiRun = null;
    state.baseLut = null;
    state.aiStrength = 100;
    state.layers = [];
    state.layerId = null;
    state.maskMode = null;
    state.holdOriginal = false;
    el('show-original').querySelector('span').textContent = '看原图';
    state.photo = { image, name, demo, file };
    if (!frameLab.opening) syncFrameLabActions();
    const preview = sizedCanvas(image, 1100);
    for (const canvas of [original, result, overlay]) {
      canvas.width = preview.width;
      canvas.height = preview.height;
    }
    canvasView.setImageSize(preview.width, preview.height);
    canvasView.setPanMode(false);
    canvasView.setRotateMode(false);
    sourceContext.drawImage(preview, 0, 0);
    state.photo.preview = sourceContext.getImageData(0, 0, original.width, original.height);
    const dimensions = image.naturalWidth.toLocaleString() + ' × ' + image.naturalHeight.toLocaleString() + ' px';
    el('doc-name').textContent = name;
    el('doc-name').title = name;
    el('image-meta').textContent = demo ? '示例照片  ·  ' + dimensions : dimensions;
    $('#canvas-caption span').textContent = name;
    el('canvas-placeholder').hidden = true;
    inFlightMessage.textContent = '根据照片分析光线与色彩';
    setBusy(el('run-ai'), false, '自动调色');
    setBusy(maskButton, false, '全图 AI 主体');
    state.presetId = null;
    if (state.appliedLook) state.referenceStrength = state.appliedLook.strength;
    state.settings = { ...DEFAULT_SETTINGS };
    const glowPreset = FEISHU_LOOKS.find(look => look.glow && state.glowEnabled && look.id === state.glowPresetId);
    if (glowPreset) {
      state.glow = normalizeGlow(glowPreset.glow);
    } else {
      state.glow = { ...DEFAULT_GLOW };
      state.glowEnabled = false;
      state.glowPresetId = null;
      state.glowBeforePreset = null;
    }
    syncGlowControls();
    syncSettings();
    syncMaskPanel();
    syncFeishuSelection();
    setView('after');
    canvasView.resize();
    scheduleRender();
  }

  function setView(view) {
    state.view = view;
    updateView();
  }

  function updateView() {
    const brushing = state.panel === 'mask' && !state.boxSession && state.maskMode && activeLayer();
    const split = state.view === 'compare' && !state.holdOriginal && !brushing && !state.boxSession;
    stage.classList.toggle('showOriginal', state.holdOriginal);
    stage.classList.toggle('comparing', split);
    stage.classList.toggle('brushing', Boolean(brushing) && !state.holdOriginal);
    stage.classList.toggle('overlay', Boolean(state.panel === 'mask' && !state.boxSession && state.maskOverlay && activeLayer()?.visible && !state.holdOriginal && !split));
    if (!brushing || state.holdOriginal) brushCursor.hidden = true;
    syncBoxHint();
    stage.classList.add('clear-bg');
    original.style.clipPath = split ? 'inset(0 ' + (100 - state.compare) + '% 0 0)' : 'none';
    el('compare-divider').style.left = state.compare + '%';
    el('compare-divider').hidden = !split;
    el('before-tag').hidden = !split && !state.holdOriginal;
    el('after-tag').hidden = state.holdOriginal;
    el('show-original').setAttribute('aria-pressed', String(state.holdOriginal));
    $$('[data-view]').forEach(button => {
      button.classList.toggle('selected', button.dataset.view === state.view);
      button.setAttribute('aria-pressed', String(button.dataset.view === state.view));
    });
  }

  function scheduleRender() {
    if (listeners.signal.aborted) return;
    if (!frameLab.opening && state.photo) frameLab.dirty = true;
    if (paintFrame || !state.photo) return;
    paintFrame = requestAnimationFrame(() => {
      paintFrame = 0;
      renderPreview();
    });
  }

  function readMask(canvas) {
    const image = canvas.getContext('2d', { willReadFrequently: true }).getImageData(0, 0, canvas.width, canvas.height);
    const alpha = new Uint8ClampedArray(canvas.width * canvas.height);
    for (let index = 0; index < alpha.length; index++) alpha[index] = image.data[index * 4 + 3];
    return alpha;
  }

  function maskPixels(layer, width, height) {
    if (layer.canvas.width === width && layer.canvas.height === height) {
      layer.alpha ??= readMask(layer.canvas);
      return layer.alpha;
    }
    const scaled = document.createElement('canvas');
    scaled.width = width;
    scaled.height = height;
    const ctx = scaled.getContext('2d', { willReadFrequently: true });
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(layer.canvas, 0, 0, width, height);
    return readMask(scaled);
  }

  function render(imageData, grade = state.settings, look = state.referenceLut, strength = state.referenceStrength) {
    const layers = state.layers.filter(layer => layer.visible && layer.opacity > 0 &&
      Object.entries(layer.settings).some(([key, value]) => value !== DEFAULT_SETTINGS[key])
    ).map(layer => ({
      mask: maskPixels(layer, imageData.width, imageData.height),
      settings: layer.settings, invert: layer.invert, opacity: layer.opacity
    }));
    const graded = renderGrade(renderFilmPrint(imageData,state.filmPrint), grade, {
      layers, baseLut: look ?? state.baseLut, baseLutStrength: look ? strength : state.aiStrength,
      lut: state.lut, lutStrength: state.lutStrength
    });
    const withGlow = state.glowEnabled ? applyGlow(graded, state.glow) : graded;
    const colorLayer = state.layers.find(layer => layer.id === state.colorLayerId && layer.visible);
    if (!colorLayer) return withGlow;
    const keep = maskPixels(colorLayer, imageData.width, imageData.height);
    const pixels = withGlow.data;
    for (let index = 0, offset = 0; index < keep.length; index++, offset += 4) {
      if (!pixels[offset + 3]) continue;
      const colorShare = (colorLayer.invert ? 255 - keep[index] : keep[index]) / 255;
      if (colorShare === 1) continue;
      const gray = pixels[offset] * .2126 + pixels[offset + 1] * .7152 + pixels[offset + 2] * .0722;
      pixels[offset] = gray + (pixels[offset] - gray) * colorShare;
      pixels[offset + 1] = gray + (pixels[offset + 1] - gray) * colorShare;
      pixels[offset + 2] = gray + (pixels[offset + 2] - gray) * colorShare;
    }
    return withGlow;
  }

  function renderPreview() {
    if (!state.photo) return;
    const graded = render(state.photo.preview);
    resultContext.putImageData(graded, 0, 0);
    drawHistogram(el('histogram'), state.holdOriginal ? state.photo.preview : graded);
    renderOverlay();
  }

  function setBusy(button, busy, label) {
    button.disabled = busy;
    const icon = button.querySelector('i');
    if (icon) {
      const defaultIcon = button === el('export-confirm') ? 'download' : 'sparkles';
      icon.dataset.icon = busy ? 'loader' : defaultIcon;
      icon.classList.toggle('spinning', busy);
      icons(button);
    }
    const span = button.querySelector('span');
    if (span) span.textContent = label;
    else if (button.lastChild?.nodeType === Node.TEXT_NODE) button.lastChild.textContent = label;
    if (button === el('run-ai')) syncFrameLabActions();
  }

  async function runAutoGrade({ quiet = false } = {}) {
    if (!state.photo || state.aiRun || state.appliedLook) return;
    const run = Symbol('AI run');
    const photo = state.photo;
    state.aiRun = run;
    setBusy(el('run-ai'), true, '正在分析…');
    inFlightMessage.textContent = '正在测量黑点、中间调和白点';
    try {
      await new Promise(resolve => window.setTimeout(resolve, 0));
      if (state.photo !== photo || state.aiRun !== run || state.appliedLook || listeners.signal.aborted) return;
      const input = renderFilmPrint(photo.preview, state.filmPrint);
      const { lut, before, after, reason } = planAutomaticGrade(input);
      const previous = state.baseLut;
      state.baseLut = lut;
      if (lut && previous?.title !== lut.title) state.aiStrength = 100;
      const percentiles = profile => [profile.p01, profile.p50, profile.p99].map(value => Math.round(value * 100)).join(' / ');
      const messages = {
        'in-range': '亮度已接近目标区间',
        'insufficient': '可用的影调层次太少',
        'clipping-or-color': '候选未通过影调与 RGB 复测'
      };
      const message = lut ? '已自动校正直方图' : messages[reason];
      inFlightMessage.textContent = lut
        ? `黑点 / 中间调 / 白点（100% 强度） ${percentiles(before)} → ${percentiles(after)}`
        : message;
      if (!quiet) toast(message);
    } catch (error) {
      if (state.photo !== photo || state.aiRun !== run) return;
      console.error(error);
      inFlightMessage.textContent = '无法完成本次分析，保留当前设置';
      if (!quiet) toast(inFlightMessage.textContent);
    } finally {
      if (state.aiRun === run) {
        state.aiRun = null;
        setBusy(el('run-ai'), false, state.baseLut ? '重新自动调色' : '自动调色');
        syncSettings();
        scheduleRender();
      }
    }
  }

  const curveEditor = installCurveEditor({
    canvas: el('curve-canvas'),
    channels: el('curve-channels'),
    reset: el('reset-curve'),
    getCurve: () => state.settings.curve,
    setCurve: value => {
      state.settings.curve = value;
      scheduleRender();
    }
  });

  function setupHslRanges() {
    const active = state.settings.hsl?.[state.hslRange] ?? {};
    el('hsl-controls').replaceChildren(...hslFields.map(field => createRange('hsl', field, active[field[0]], value => {
      state.settings.hsl ??= {};
      state.settings.hsl[state.hslRange] ??= {};
      state.settings.hsl[state.hslRange][field[0]] = value;
      scheduleRender();
    }).row));
    $$('#hsl-colors button').forEach(button => button.setAttribute('aria-pressed', String(button.value === state.hslRange)));
  }

  for (const [id, name, color] of hslRanges) {
    const button = document.createElement('button');
    Object.assign(button, { type: 'button', value: id, title: name });
    button.setAttribute('aria-label', name);
    button.style.setProperty('--swatch', color);
    button.addEventListener('click', () => { state.hslRange = id; setupHslRanges(); });
    el('hsl-colors').append(button);
  }
  el('hsl-section').hidden = false;

  const lutMenu = document.createElement('select');
  lutMenu.id = 'lut-menu';
  lutMenu.setAttribute('aria-label', '开源 LUT 方案');
  lutMenu.append(new Option('选择开源 LUT…', ''), ...OPEN_LUTS.map(item => new Option(item.name, item.id)));
  el('lut-caption').before(lutMenu);
  bindDisclosure(el('lut-disclosure'), el('lut-details'));
  const lutRange = createRange('lut', ['strength', 'LUT 强度', 0, 100, 1, '%'], state.lutStrength, value => {
    state.lutStrength = value;
    scheduleRender();
  });
  const clearLut = document.createElement('button');
  clearLut.type = 'button';
  clearLut.className = 'text-button';
  clearLut.textContent = '移除 LUT';
  clearLut.addEventListener('click', () => {
    state.lutRequest++;
    state.lutPending = false;
    state.lut = null;
    state.lutName = '';
    state.lutLookId = '';
    syncLutControls();
    syncFrameLabActions();
    scheduleRender();
  });
  el('lut-controls').append(lutRange.row, clearLut);

  function syncLutControls() {
    const look = OPEN_LUTS.find(item => item.id === state.lutLookId);
    lutMenu.value = look?.id ?? '';
    lutRange.update(state.lutStrength);
    el('lut-controls').hidden = !state.lut;
    const caption = el('lut-caption');
    caption.textContent = state.lut ? state.lutName : '可叠加第三方 3D LUT。';
    if (look) {
      const link = document.createElement('a');
      Object.assign(link, { href: look.sourceUrl, target: '_blank', rel: 'noreferrer', textContent: ' · slay / CC BY 4.0' });
      caption.append(link);
    }
  }

  async function installLut(read, name, look) {
    const request = ++state.lutRequest;
    state.lutPending = true;
    syncFrameLabActions();
    try {
      const text = await read();
      if (request !== state.lutRequest) return;
      state.lut = parseCube(text);
      state.lutName = name;
      state.lutLookId = look?.id ?? '';
      syncLutControls();
      scheduleRender();
    } catch (error) {
      if (request !== state.lutRequest) return;
      toast(error.message || '无法读取这个 .cube 文件。');
    } finally {
      if (request === state.lutRequest) {
        state.lutPending = false;
        syncFrameLabActions();
      }
    }
  }

  lutMenu.addEventListener('change', () => {
    const look = OPEN_LUTS.find(item => item.id === lutMenu.value);
    if (!look) {
      clearLut.click();
      return;
    }
    void installLut(async () => {
      const response = await fetch(look.url, listenerOptions);
      if (!response.ok) throw new Error('开源 LUT 加载失败。');
      return response.text();
    }, look.name, look);
  });

  function activeLayer() {
    return state.layers.find(layer => layer.id === state.layerId);
  }

  function installMaskAlpha(canvas, alpha) {
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (alpha) {
      const image = ctx.createImageData(canvas.width, canvas.height);
      for (let index = 0; index < alpha.length; index++) {
        image.data[index * 4 + 3] = alpha[index];
      }
      ctx.putImageData(image, 0, 0);
    }
  }

  function addMask(name, alpha, { box = null, color = false } = {}) {
    const canvas = document.createElement('canvas');
    canvas.width = original.width;
    canvas.height = original.height;
    installMaskAlpha(canvas, alpha);
    const layer = {
      id: crypto.randomUUID(), name, canvas, alpha, invert: false, visible: true,
      opacity: 100, settings: { ...DEFAULT_SETTINGS }, box, showBox: Boolean(box)
    };
    state.layers.push(layer);
    state.layerId = layer.id;
    if (color) state.colorLayerId = layer.id;
    state.maskMode = alpha ? null : 'paint';
    state.maskOverlay = !color;
    setView('after');
    syncMaskPanel();
    scheduleRender();
  }

  const selectionController = installBoxSelection({
    surface: el('box-selection'),
    keyboardRoot: root,
    signal: listeners.signal,
    showGuide: false,
    clientToPoint: event => canvasView.toImagePoint(event),
    onDraft: box => {
      const session = state.boxSession;
      if (!session || session.job) return;
      const canConfirm = Boolean(box && box.width > 0 && box.height > 0);
      session.canConfirm = canConfirm;
      setBoxStatus(canConfirm
        ? '拖动框内移动，拉边或角调整大小'
        : session.color ? '拖动框住所需留色的主体' : '在照片上拖一个框');
    },
    onSelect: box => { void submitBoxSelection(box); },
    onCancel: () => cancelBoxSelection()
  });

  function syncBoxHint() {
    if (state.boxSession) return;
    const layer = activeLayer();
    const show = state.panel === 'mask' && layer?.visible && layer.showBox && !state.holdOriginal &&
      state.view !== 'compare' && !state.maskMode;
    selectionController.setBox(show ? layer.box : null);
  }

  function setBoxStatus(text = '', error = false) {
    const guide = el('mask-box-guide');
    const guideText = text || '大致圈住目标，拖动框内移动，拉边或角调整大小，再点「确认识别」。';
    if (guide.textContent !== guideText) guide.textContent = guideText;
    guide.dataset.status = error ? 'error' : '';
    el('box-session').hidden = !state.boxSession;
    const sessionText = el('box-session-text');
    if (sessionText.textContent !== text) sessionText.textContent = text;
    el('box-confirm').disabled = !state.boxSession?.canConfirm || Boolean(state.boxSession?.job);
    stage.classList.toggle('drawing-box', Boolean(state.boxSession && !state.boxSession.job));
    const start = el('create-box-mask');
    start.setAttribute('aria-pressed', String(Boolean(state.boxSession)));
    el('create-subject-mask').disabled = Boolean(state.boxSession) || Boolean(state.maskJob);
  }

  function cancelBoxSelection(message) {
    const session = state.boxSession;
    if (!session) return;
    state.boxSession = null;
    session.job?.abort();
    clearTimeout(session.progressTimer);
    if (state.maskJob === session.job) state.maskJob = null;
    selectionController.disable();
    setBoxStatus(message);
    updateView();
    syncFeishuSelection();
    renderOverlay();
  }

  function beginBoxSelection({ color = false, replace = null, initial = null } = {}) {
    if (!state.photo) {
      toast('请先打开一张照片。');
      return false;
    }
    if (state.maskJob && !state.boxSession) return false;
    if (!replace && state.layers.length >= 8) {
      toast('已达到 8 个蒙版，请先删除一个。');
      return false;
    }
    cancelBoxSelection();
    canvasView.setPanMode(false);
    canvasView.setRotateMode(false);
    state.maskMode = null;
    setOriginal(false);
    state.boxSession = { color, replace, job: null, photo: state.photo, canConfirm: false };
    setPanel('mask');
    setView('after');
    setBoxStatus(color ? '拖动框住想保留颜色的主体' : '拖动框住想选取的主体');
    syncMaskPanel();
    canvasView.resize();
    selectionController.enable(replace?.box ?? initial ?? null);
    syncFeishuSelection();
    if (matchMedia('(max-width: 710px)').matches) {
      $('.board-heading').scrollIntoView({ block: 'start', behavior: 'smooth' });
    }
    return true;
  }

  async function submitBoxSelection(box) {
    const session = state.boxSession;
    if (!session || session.job) return;
    const job = new AbortController();
    session.job = job;
    state.maskJob = job;
    selectionController.disable();
    selectionController.setBox(box);
    setBoxStatus('AI 正在识别框内主体…');
    session.progressTimer = setTimeout(() => {
      if (state.boxSession === session && session.job === job) {
        setBoxStatus('首次分析照片需要几秒，正在识别主体…');
      }
    }, 2400);
    try {
      const alpha = await generateBoxMask(original, box, {
        signal: job.signal,
        onStatus: text => { if (state.boxSession === session && text) setBoxStatus(text); }
      });
      if (state.boxSession !== session || state.photo !== session.photo || job.signal.aborted) return;
      if (alpha.length !== original.width * original.height) throw new Error('蒙版尺寸不匹配。');
      let marked = 0;
      for (const value of alpha) if (value >= 128) marked++;
      if (marked < 4) {
        throw new Error('框内没有识别到清晰的主体。');
      }
      const replacing = session.replace && state.layers.includes(session.replace) ? session.replace : null;
      if (!replacing && state.layers.length >= 8) throw new Error('已达到 8 个蒙版，请先删除一个。');
      state.boxSession = null;
      if (replacing) {
        installMaskAlpha(replacing.canvas, alpha);
        Object.assign(replacing, { alpha, box, showBox: true, visible: true });
        state.layerId = replacing.id;
        state.maskOverlay = state.colorLayerId !== replacing.id;
        state.maskMode = null;
        syncMaskPanel();
        scheduleRender();
      } else {
        const suffix = state.layers.filter(layer => layer.box).length + 1;
        addMask(session.color ? '主体留色' : '框选主体 ' + suffix, alpha, { box, color: session.color });
      }
      if (session.color) state.subjectPresetLayerId = state.layerId;
      const tip = state.colorLayerId === state.layerId
        ? '主体已留色，背景已转黑白。可用画笔或橡皮修边。'
        : '主体蒙版已生成。可修边，也可开启「背景黑白」。';
      setBoxStatus(tip);
      syncFeishuSelection();
      if (matchMedia('(max-width: 710px)').matches) {
        toast(tip);
      }
    } catch (error) {
      if (job.signal.aborted || state.boxSession !== session) return;
      console.error(error);
      const text = ['框内没有识别到清晰的主体。', '已达到 8 个蒙版，请先删除一个。'].includes(error.message)
        ? error.message : '未能生成主体蒙版。';
      session.job = null;
      selectionController.enable(box);
      setBoxStatus(text + ' 可以缩小范围重框，或取消后用画笔。', true);
    } finally {
      clearTimeout(session.progressTimer);
      if (state.maskJob === job) state.maskJob = null;
      el('create-subject-mask').disabled = Boolean(state.boxSession) || Boolean(state.maskJob);
    }
  }

  function maskThumbnail(layer) {
    const canvas = document.createElement('canvas');
    canvas.width = 48;
    canvas.height = 36;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#282330';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    const patch = document.createElement('canvas');
    patch.width = canvas.width;
    patch.height = canvas.height;
    const patchCtx = patch.getContext('2d');
    patchCtx.fillStyle = '#f1edf5';
    patchCtx.fillRect(0, 0, patch.width, patch.height);
    patchCtx.globalCompositeOperation = layer.invert ? 'destination-out' : 'destination-in';
    patchCtx.drawImage(layer.canvas, 0, 0, patch.width, patch.height);
    ctx.drawImage(patch, 0, 0);
    return canvas;
  }

  function maskRow(layer) {
    const row = document.createElement('div');
    row.className = 'mask-row';
    row.classList.toggle('active', layer.id === state.layerId);
    const select = document.createElement('button');
    select.type = 'button';
    select.className = 'mask-select';
    select.setAttribute('aria-pressed', String(layer.id === state.layerId));
    select.append(maskThumbnail(layer), layer.name + (layer.invert ? ' · 反选' : ''));
    if (state.colorLayerId === layer.id) {
      const tag = document.createElement('span');
      tag.className = 'mask-color-tag';
      tag.textContent = '留色';
      select.append(tag);
    }
    select.addEventListener('click', () => {
      cancelBoxSelection();
      state.layerId = layer.id;
      state.maskMode = null;
      syncMaskPanel();
      renderOverlay();
    });
    const visible = document.createElement('button');
    visible.type = 'button';
    visible.className = 'button';
    visible.title = layer.visible ? '隐藏蒙版效果' : '显示蒙版效果';
    visible.setAttribute('aria-label', visible.title);
    visible.innerHTML = '<i data-icon="' + (layer.visible ? 'eye' : 'eye-off') + '"></i>';
    visible.addEventListener('click', () => {
      if (state.boxSession?.replace === layer) cancelBoxSelection();
      layer.visible = !layer.visible;
      if (!layer.visible && state.layerId === layer.id) state.maskMode = null;
      syncMaskPanel();
      syncFeishuSelection();
      scheduleRender();
    });
    const remove = document.createElement('button');
    remove.type = 'button';
    remove.className = 'button';
    remove.title = '删除蒙版';
    remove.setAttribute('aria-label', '删除' + layer.name);
    remove.innerHTML = '<i data-icon="trash"></i>';
    remove.addEventListener('click', () => {
      if (state.boxSession?.replace === layer) cancelBoxSelection();
      state.layers = state.layers.filter(item => item !== layer);
      if (state.colorLayerId === layer.id) state.colorLayerId = null;
      if (state.subjectPresetLayerId === layer.id) state.subjectPresetLayerId = null;
      if (state.layerId === layer.id) {
        state.layerId = state.layers.at(-1)?.id ?? null;
        state.maskMode = null;
      }
      syncMaskPanel();
      syncFeishuSelection();
      scheduleRender();
    });
    row.append(select, visible, remove);
    return row;
  }

  const localRanges = appendRangeGroups(el('mask-tone-controls'), 'local', sections, DEFAULT_SETTINGS, (key, value) => {
    const layer = activeLayer();
    if (!layer) return;
    layer.settings[key] = value;
    scheduleRender();
  });

  function syncMaskPanel() {
    const layer = activeLayer();
    el('mask-list').replaceChildren(...state.layers.map(maskRow));
    icons(el('mask-list'));
    el('mask-empty').hidden = state.layers.length > 0;
    el('mask-editor').hidden = !layer;
    el('mask-overlay').setAttribute('aria-pressed', String(state.maskOverlay));
    el('paint-mask').setAttribute('aria-pressed', String(state.maskMode === 'paint'));
    el('erase-mask').setAttribute('aria-pressed', String(state.maskMode === 'erase'));
    el('invert-mask').setAttribute('aria-pressed', String(Boolean(layer?.invert)));
    el('mask-keep-color').setAttribute('aria-pressed', String(Boolean(layer && state.colorLayerId === layer.id)));
    el('mask-reselect').hidden = !layer?.box;
    el('mask-show-box').hidden = !layer?.box;
    el('mask-show-box').setAttribute('aria-pressed', String(Boolean(layer?.showBox)));
    if (layer) {
      const size = createRange('mask', ['size', '画笔大小', 1, 35, 1, '%'], state.brushSize, value => { state.brushSize = value; });
      const feather = createRange('mask', ['feather', '羽化', 0, 100, 1, '%'], state.brushFeather, value => { state.brushFeather = value; });
      const opacity = createRange('mask', ['opacity', '效果强度', 0, 100, 1, '%'], layer.opacity, value => {
        layer.opacity = value;
        scheduleRender();
      });
      el('mask-brush-controls').replaceChildren(size.row, feather.row, opacity.row);
      for (const range of localRanges) range.update(layer.settings[range.key]);
    }
    updateView();
  }

  function renderOverlay() {
    if (!state.photo) return;
    const layer = activeLayer();
    overlayContext.clearRect(0, 0, overlay.width, overlay.height);
    if (!layer || state.panel !== 'mask' || !state.maskOverlay) return;
    overlayContext.save();
    overlayContext.fillStyle = 'rgba(185, 64, 222, .43)';
    overlayContext.fillRect(0, 0, overlay.width, overlay.height);
    overlayContext.globalCompositeOperation = layer.invert ? 'destination-out' : 'destination-in';
    overlayContext.drawImage(layer.canvas, 0, 0);
    overlayContext.restore();
  }

  async function createSubjectMask() {
    if (!state.photo || state.maskJob || state.boxSession) return;
    if (state.layers.length >= 8) {
      toast('已达到 8 个蒙版，请先删除一个。');
      return;
    }
    const job = new AbortController();
    state.maskJob = job;
    const photo = state.photo;
    setBusy(maskButton, true, '正在找主体…');
    try {
      const alpha = await generateSubjectMask(original, { signal: job.signal });
      if (state.photo !== photo || state.maskJob !== job) return;
      if (state.layers.length >= 8) {
        toast('已达到 8 个蒙版，请先删除一个。');
        return;
      }
      if (!alpha.some(value => value >= 96)) {
        toast('这张照片没有找到明显主体，可以用画笔绘制蒙版。');
        return;
      }
      addMask('AI 主体 ' + (state.layers.filter(layer => layer.name.startsWith('AI')).length + 1), alpha);
      toast('主体蒙版已添加。可反选背景或用画笔修整。');
    } catch (error) {
      if (!job.signal.aborted) {
        console.error(error);
        toast('AI 选主体失败。可以用画笔绘制蒙版。');
      }
    } finally {
      if (state.maskJob === job) {
        state.maskJob = null;
        setBusy(maskButton, false, '全图 AI 主体');
      }
    }
  }

  function setBrush(mode) {
    cancelBoxSelection();
    const layer = activeLayer();
    if (!layer) return;
    state.maskMode = state.maskMode === mode ? null : mode;
    if (state.maskMode) {
      canvasView.setPanMode(false);
      canvasView.setRotateMode(false);
      layer.visible = true;
      state.maskOverlay = true;
      setView('after');
    }
    syncMaskPanel();
    if (state.maskMode && matchMedia('(max-width: 710px)').matches) {
      $('.board-heading').scrollIntoView({ block: 'start', behavior: 'smooth' });
    }
    scheduleRender();
  }

  function maskPoint(event, layer) {
    const point = canvasView.toImagePoint(event);
    return {
      x: clamp(point.x, 0, 1) * layer.canvas.width,
      y: clamp(point.y, 0, 1) * layer.canvas.height
    };
  }

  function drawStroke(layer, start, end) {
    const canvas = layer.canvas;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    const radius = Math.max(1, state.brushSize * .005 * Math.min(canvas.width, canvas.height));
    const count = Math.max(1, Math.ceil(Math.hypot(end.x - start.x, end.y - start.y) / Math.max(1, radius * .4)));
    const erase = (state.maskMode === 'erase') !== layer.invert;
    ctx.save();
    ctx.globalCompositeOperation = erase ? 'destination-out' : 'source-over';
    for (let index = 1; index <= count; index++) {
      const x = start.x + (end.x - start.x) * index / count;
      const y = start.y + (end.y - start.y) * index / count;
      const core = radius * (1 - state.brushFeather / 100);
      const gradient = ctx.createRadialGradient(x, y, core, x, y, radius + .01);
      gradient.addColorStop(0, '#000');
      gradient.addColorStop(1, '#0000');
      ctx.fillStyle = gradient;
      ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2);
    }
    ctx.restore();
    layer.alpha = null;
    renderOverlay();
    scheduleRender();
  }

  let stagePointer = null;

  function moveCompare(event) {
    state.compare = clamp(canvasView.toImagePoint(event).x * 100, 0, 100);
    updateView();
  }

  stage.addEventListener('pointerdown', event => {
    if (event.button !== 0 || !state.photo || stagePointer) return;
    if (stage.classList.contains('brushing')) {
      const layer = activeLayer();
      const point = maskPoint(event, layer);
      stagePointer = { id: event.pointerId, layer, point };
      drawStroke(layer, point, point);
    } else if (stage.classList.contains('comparing')) {
      stagePointer = { id: event.pointerId, layer: null };
      moveCompare(event);
    } else {
      return;
    }
    stage.setPointerCapture(event.pointerId);
  });

  stage.addEventListener('pointermove', event => {
    if (stage.classList.contains('brushing') && event.pointerType !== 'touch') {
      const point = canvasView.toImagePoint(event);
      const diameter = Math.max(3, state.brushSize * .01 * Math.min(stage.clientWidth, stage.clientHeight));
      Object.assign(brushCursor.style, {
        left: point.x * 100 + '%', top: point.y * 100 + '%',
        width: diameter + 'px', height: diameter + 'px'
      });
      brushCursor.hidden = false;
    }
    if (stagePointer?.id !== event.pointerId) return;
    const { layer } = stagePointer;
    if (!layer) {
      moveCompare(event);
      return;
    }
    const point = maskPoint(event, layer);
    drawStroke(layer, stagePointer.point, point);
    stagePointer.point = point;
  });
  stage.addEventListener('pointerleave', () => { brushCursor.hidden = true; });

  for (const eventName of ['pointerup', 'pointercancel', 'lostpointercapture']) {
    stage.addEventListener(eventName, event => {
      if (stagePointer?.id !== event.pointerId) return;
      if (stagePointer.layer) syncMaskPanel();
      stagePointer = null;
    });
  }

  function setPanel(panel, fromRail = false) {
    if (panel !== 'mask') cancelBoxSelection();
    state.panel = panel;
    for (const target of ['tone', 'color', 'glow', 'mask']) {
      const active = target === panel;
      el('tab-' + target).setAttribute('aria-selected', String(active));
      el('panel-' + target).hidden = !active;
    }
    if (panel === 'color') curveEditor.draw();
    updateView();
    renderOverlay();
    if (fromRail) el('panel-' + panel).scrollIntoView({ block: 'nearest' });
  }

  const exportDialog = el('export-dialog');
  const exportMode = el('export-mode');
  const exportFormat = el('export-format');
  const exportButton = el('export-confirm');
  const maxExportSide = 6800;
  const maxExportPixels = 22_000_000;

  function exportScale(image) {
    return Math.min(
      1, maxExportSide / Math.max(image.naturalWidth, image.naturalHeight),
      Math.sqrt(maxExportPixels / (image.naturalWidth * image.naturalHeight))
    );
  }

  function syncExport() {
    const layer = activeLayer();
    const mode = exportMode.value;
    for (const option of exportMode.options) option.disabled = option.value !== 'full' && !layer;
    exportFormat.disabled = mode !== 'full';
    if (exportFormat.disabled) exportFormat.value = 'png';
    const image = state.photo?.image;
    if (!image) return;
    const scale = exportScale(image);
    const dimensions = Math.round(image.naturalWidth * scale) + ' × ' + Math.round(image.naturalHeight * scale) + ' px';
    el('export-info').textContent = dimensions + (scale < 1 ? ' · 超大照片按比例缩小' : ' · 原图尺寸') +
      (mode === 'full' ? '' : ' · ' + (layer?.name ?? '当前蒙版'));
  }

  function encodeCanvas(canvas, format) {
    return new Promise((resolve, reject) => {
      canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('无法编码照片。')), 'image/' + format, .94);
    });
  }

  async function downloadPhoto() {
    if (!state.photo || exportButton.disabled) return;
    const { image, name } = state.photo;
    const mode = exportMode.value;
    const layer = activeLayer();
    const format = mode === 'full' ? exportFormat.value : 'png';
    if (mode !== 'full' && !layer) return;
    setBusy(exportButton, true, '正在导出…');
    try {
      await new Promise(requestAnimationFrame);
      await new Promise(resolve => setTimeout(resolve, 0));
      const canvas = sizedCanvas(image, maxExportSide, maxExportPixels);
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      const pixels = mode === 'mask' ? ctx.createImageData(canvas.width, canvas.height)
        : render(ctx.getImageData(0, 0, canvas.width, canvas.height));
      if (mode !== 'full') {
        const alpha = maskPixels(layer, canvas.width, canvas.height);
        for (let index = 0; index < alpha.length; index++) {
          const offset = index * 4;
          const value = layer.invert ? 255 - alpha[index] : alpha[index];
          if (mode === 'cutout') {
            pixels.data[offset + 3] = pixels.data[offset + 3] * value / 255;
          } else {
            pixels.data[offset] = value;
            pixels.data[offset + 1] = value;
            pixels.data[offset + 2] = value;
            pixels.data[offset + 3] = 255;
          }
        }
      }
      ctx.putImageData(pixels, 0, 0);
      if (format === 'jpeg') {
        ctx.globalCompositeOperation = 'destination-over';
        ctx.fillStyle = '#fff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }
      const blob = await encodeCanvas(canvas, format);
      const url = URL.createObjectURL(blob);
      const suffix = { full: '调色', cutout: '抠图', mask: '蒙版' }[mode];
      const link = document.createElement('a');
      link.href = url;
      link.download = name + '-' + suffix + (format === 'jpeg' ? '.jpg' : '.png');
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 15000);
      exportDialog.close();
      toast('导出完成');
    } catch (error) {
      console.error(error);
      el('export-info').textContent = '导出失败，请尝试较小的照片。';
    } finally {
      setBusy(exportButton, false, '下载文件');
    }
  }

  function setOriginal(show) {
    if (!state.photo) return;
    state.holdOriginal = show;
    el('show-original').querySelector('span').textContent = show ? '看效果' : '看原图';
    updateView();
    scheduleRender();
  }

  el('open-file').addEventListener('click', () => el('file-input').click());
  el('file-input').addEventListener('change', event => {
    const file = event.target.files[0];
    event.target.value = '';
    loadFile(file).catch(showOpenError);
  });
  el('run-ai').addEventListener('click', runAutoGrade);
  el('reset-tone').addEventListener('click', () => {
    state.presetId = null;
    state.settings = { ...DEFAULT_SETTINGS, curve: state.settings.curve, hsl: state.settings.hsl };
    syncSettings();
    scheduleRender();
  });
  el('reset-hsl').addEventListener('click', () => {
    state.settings.hsl = null;
    setupHslRanges();
    scheduleRender();
  });
  el('import-lut').addEventListener('click', () => el('lut-input').click());
  el('lut-input').addEventListener('change', event => {
    const file = event.target.files[0];
    event.target.value = '';
    if (!file) return;
    if (file.size > 60_000_000) {
      toast('这个 LUT 文件太大，请使用 60 MB 以内的 .cube。');
      return;
    }
    void installLut(() => file.text(), file.name);
  });
  maskButton.addEventListener('click', createSubjectMask);
  el('create-box-mask').addEventListener('click', () => {
    if (state.boxSession) cancelBoxSelection();
    else beginBoxSelection();
  });
  el('box-cancel').addEventListener('click', () => cancelBoxSelection());
  el('box-confirm').addEventListener('click', () => selectionController.confirm());
  el('mask-reselect').addEventListener('click', () => {
    const layer = activeLayer();
    if (layer?.box) beginBoxSelection({ replace: layer, color: state.colorLayerId === layer.id });
  });
  el('mask-show-box').addEventListener('click', () => {
    const layer = activeLayer();
    if (!layer?.box) return;
    layer.showBox = !layer.showBox;
    el('mask-show-box').setAttribute('aria-pressed', String(layer.showBox));
    syncBoxHint();
  });
  el('mask-keep-color').addEventListener('click', () => {
    const layer = activeLayer();
    if (!layer) return;
    cancelBoxSelection();
    const enabled = state.colorLayerId !== layer.id;
    state.colorLayerId = enabled ? layer.id : null;
    if (enabled) {
      layer.visible = true;
      state.maskOverlay = false;
      state.maskMode = null;
    }
    syncMaskPanel();
    syncFeishuSelection();
    scheduleRender();
  });
  el('create-brush-mask').addEventListener('click', () => {
    if (!state.photo) return;
    if (state.layers.length >= 8) {
      toast('已达到 8 个蒙版，请先删除一个。');
      return;
    }
    cancelBoxSelection();
    canvasView.setPanMode(false);
    canvasView.setRotateMode(false);
    addMask('画笔 ' + (state.layers.filter(layer => layer.name.startsWith('画笔')).length + 1));
    if (matchMedia('(max-width: 710px)').matches) {
      $('.board-heading').scrollIntoView({ block: 'start', behavior: 'smooth' });
    }
  });
  el('paint-mask').addEventListener('click', () => setBrush('paint'));
  el('erase-mask').addEventListener('click', () => setBrush('erase'));
  el('invert-mask').addEventListener('click', () => {
    const layer = activeLayer();
    if (!layer) return;
    cancelBoxSelection();
    layer.invert = !layer.invert;
    syncMaskPanel();
    scheduleRender();
  });
  el('reset-mask-tone').addEventListener('click', () => {
    const layer = activeLayer();
    if (!layer) return;
    layer.settings = { ...DEFAULT_SETTINGS };
    syncMaskPanel();
    scheduleRender();
  });
  el('mask-overlay').addEventListener('click', () => {
    state.maskOverlay = !state.maskOverlay;
    el('mask-overlay').setAttribute('aria-pressed', String(state.maskOverlay));
    updateView();
    renderOverlay();
  });
  $$('[data-panel]').forEach(button => button.addEventListener('click', () => setPanel(button.dataset.panel, true)));
  $$('[data-view]').forEach(button => button.addEventListener('click', () => {
    cancelBoxSelection();
    state.maskMode = null;
    setOriginal(false);
    setView(button.dataset.view);
    syncMaskPanel();
  }));
  el('show-original').addEventListener('click', () => setOriginal(!state.holdOriginal));
  el('zoom-in').addEventListener('click', () => canvasView.zoomBy(1.25));
  el('zoom-out').addEventListener('click', () => canvasView.zoomBy(1 / 1.25));
  for (const id of ['zoom-fit', 'fit-view']) el(id).addEventListener('click', () => canvasView.fit());
  handTool.addEventListener('click', () => canvasView.setPanMode(!viewportView.panMode));
  rotationTool.addEventListener('click', () => canvasView.setRotateMode(!viewportView.rotateMode));
  el('rotate-left').addEventListener('click', () => canvasView.rotateBy(-90));
  el('rotate-right').addEventListener('click', () => canvasView.rotateBy(90));
  el('rotate-angle').addEventListener('click', () => canvasView.setRotation(0));
  el('export-open').addEventListener('click', () => {
    if (!state.photo) return;
    exportMode.value = 'full';
    syncExport();
    exportDialog.showModal();
  });
  exportMode.addEventListener('change', syncExport);
  exportButton.addEventListener('click', downloadPhoto);
  el('help-open').addEventListener('click', () => el('help-dialog').showModal());

  let dragDepth = 0;
  const hasFiles = event => event.dataTransfer?.types.includes('Files');
  el('board').addEventListener('dragenter', event => {
    if (!hasFiles(event)) return;
    event.preventDefault();
    dragDepth++;
    el('drop-prompt').hidden = false;
  });
  el('board').addEventListener('dragover', event => {
    if (!hasFiles(event)) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = 'copy';
  });
  el('board').addEventListener('dragleave', () => {
    dragDepth = Math.max(0, dragDepth - 1);
    if (!dragDepth) el('drop-prompt').hidden = true;
  });
  el('board').addEventListener('drop', event => {
    if (!hasFiles(event)) return;
    event.preventDefault();
    dragDepth = 0;
    el('drop-prompt').hidden = true;
    loadFile(event.dataTransfer.files[0]).catch(showOpenError);
  });

  root.addEventListener('keydown', event => {
    if (event.defaultPrevented || event.ctrlKey || event.metaKey || event.altKey ||
        $('dialog[open]') || event.target.closest?.('input, select, textarea, [contenteditable]')) return;
    switch (event.code) {
      case 'KeyV':
        if (!event.repeat && !state.boxSession) setOriginal(!state.holdOriginal);
        break;
      case 'Digit0':
      case 'Numpad0':
        canvasView.fit();
        break;
      case 'KeyH':
        if (!event.repeat) canvasView.setPanMode(!viewportView.panMode);
        break;
      case 'KeyR':
        if (!event.repeat) canvasView.setRotateMode(!viewportView.rotateMode);
        break;
      case 'Equal':
      case 'NumpadAdd':
        canvasView.zoomBy(1.25);
        break;
      case 'Minus':
      case 'NumpadSubtract':
        canvasView.zoomBy(1 / 1.25);
        break;
      case 'Escape':
        if (state.boxSession) {
          cancelBoxSelection();
        } else if (viewportView.panMode || viewportView.rotateMode) {
          canvasView.setPanMode(false);
          canvasView.setRotateMode(false);
        } else {
          return;
        }
        break;
      default:
        return;
    }
    event.preventDefault();
  }, listenerOptions);

  const extractDialog = el('extract-look-dialog');
  const renameDialog = el('rename-look-dialog');
  const deleteDialog = el('delete-look-dialog');
  const lookStatus = el('look-status');
  const lookSave = el('look-save');
  const lookName = el('look-name');
  const referenceCanvas = el('look-reference-preview');
  const targetCanvas = el('look-preview');
  const referenceContext = referenceCanvas.getContext('2d');
  const targetContext = targetCanvas.getContext('2d');
  let lookLibrary = [];
  let editingLookId = null;
  let referenceRequest = 0;
  let draftLook = null;
  let draftStrength = 80;
  let draftFrame = 0;

  const appliedRange = createRange('applied', ['strength', '模板强度', 1, 100, 1, '%'], 100, value => {
    state.referenceStrength = value;
    scheduleRender();
  });
  el('applied-strength-wrap').append(appliedRange.row);

  const extractRange = createRange('extract', ['strength', '模板强度', 1, 100, 1, '%'], draftStrength, value => {
    draftStrength = value;
    scheduleLookPreview();
  });
  el('extract-strength-wrap').append(extractRange.row);

  function syncAppliedLook() {
    el('applied-look').hidden = !state.appliedLook;
    el('automatic-look').hidden = Boolean(state.appliedLook);
    if (state.appliedLook) {
      el('applied-look-name').textContent = state.appliedLook.name;
      appliedRange.update(state.referenceStrength);
      el('look-clear').querySelector('span').textContent = FEISHU_LOOKS.some(look => look.id === state.appliedLook.id)
        ? '取消应用' : '切回自动调色';
    }
  }

  function clearAppliedLook() {
    cancelFeishuApply();
    state.appliedLook = null;
    state.referenceLut = null;
    state.referenceStrength = 100;
    syncAppliedLook();
    refreshLookCards();
  }

  function useSavedLook(template, lut = lookToLut(template.recipe), { keepAdjustments = false } = {}) {
    cancelFeishuApply();
    state.appliedLook = template;
    state.referenceLut = lut;
    state.referenceStrength = template.strength;
    if (!keepAdjustments) {
      state.presetId = null;
      state.settings = { ...DEFAULT_SETTINGS };
      state.aiRun = null;
      setBusy(el('run-ai'), false, state.baseLut ? '重新自动调色' : '自动调色');
    }
    syncSettings();
    refreshLookCards();
    scheduleRender();
  }

  function changeLookShelf(shelf) {
    for (const [name, panel, tab] of [
      ['feishu', 'feishu-looks', 'feishu-looks-tab'],
      ['personal', 'my-looks', 'my-looks-tab']
    ]) {
      el(panel).hidden = shelf !== name;
      el(tab).setAttribute('aria-pressed', String(shelf === name));
    }
  }

  function drawSwatches(container, recipe) {
    container.replaceChildren();
    if (!recipe) return;
    for (const color of lookSwatches(recipe)) {
      const chip = document.createElement('span');
      chip.style.backgroundColor = color;
      container.append(chip);
    }
  }

  function refreshLookCards() {
    el('looks-empty').hidden = lookLibrary.length > 0;
    const cards = lookLibrary.map(template => {
      const card = document.createElement('article');
      const selected = template.id === state.appliedLook?.id;
      card.className = 'custom-look-card';
      card.classList.toggle('active', selected);
      const apply = document.createElement('button');
      apply.type = 'button';
      apply.className = 'custom-look-apply';
      apply.dataset.lookId = template.id;
      apply.title = '应用「' + template.name + '」';
      apply.setAttribute('aria-pressed', String(selected));
      const swatches = document.createElement('div');
      swatches.className = 'look-swatches';
      swatches.setAttribute('aria-hidden', 'true');
      drawSwatches(swatches, template.recipe);
      const name = document.createElement('strong');
      name.textContent = template.name;
      apply.append(swatches, name);
      apply.addEventListener('click', () => {
        useSavedLook(template);
        toast('已应用「' + template.name + '」');
      });
      const actions = document.createElement('div');
      actions.className = 'custom-look-actions';
      for (const [action, title, handler] of [
        ['rename', '重命名', () => openRenameLook(template)],
        ['export', '导出', () => downloadLookTemplate(template)],
        ['delete', '删除', () => openDeleteLook(template)]
      ]) {
        const button = document.createElement('button');
        Object.assign(button, { type: 'button', className: 'text-button', textContent: title });
        button.dataset.lookAction = action;
        button.setAttribute('aria-label', title + '「' + template.name + '」');
        button.addEventListener('click', handler);
        actions.append(button);
      }
      card.append(apply, actions);
      return card;
    });
    el('custom-look-grid').replaceChildren(...cards);
    syncFeishuSelection();
  }

  function updateLookLibrary(change) {
    const changed = change(readLookLibrary());
    writeLookLibrary(changed);
    lookLibrary = changed;
    refreshLookCards();
  }

  function setLookStatus(message = '', error = false) {
    lookStatus.textContent = message;
    lookStatus.dataset.error = String(error);
  }

  function renderLookPreview() {
    const input = state.photo?.preview;
    if (!input) return;
    if (targetCanvas.width !== input.width || targetCanvas.height !== input.height) {
      targetCanvas.width = input.width;
      targetCanvas.height = input.height;
    }
    const pixels = draftLook
      ? render(input, DEFAULT_SETTINGS, draftLook.lut, draftStrength)
      : input;
    targetContext.putImageData(pixels, 0, 0);
  }

  function scheduleLookPreview() {
    if (draftFrame) return;
    draftFrame = requestAnimationFrame(() => {
      draftFrame = 0;
      if (extractDialog.open) renderLookPreview();
    });
  }

  function resetDraftReference() {
    draftLook = null;
    lookSave.disabled = true;
    referenceCanvas.hidden = true;
    referenceContext.clearRect(0, 0, referenceCanvas.width, referenceCanvas.height);
    el('look-reference-prompt').hidden = false;
    el('look-reference-open').setAttribute('aria-label', '选择参考照片');
    el('look-reference-name').textContent = '';
    el('look-reference-name').removeAttribute('title');
    drawSwatches(el('look-preview-swatches'), null);
  }

  function openLookExtractor() {
    if (!state.photo) {
      toast('请先打开一张照片，用来预览调色。');
      return;
    }
    referenceRequest++;
    resetDraftReference();
    lookName.value = '';
    draftStrength = 80;
    extractRange.update(draftStrength);
    setLookStatus('选择参考照片后可预览效果。');
    extractDialog.showModal();
    renderLookPreview();
  }

  function analyzeReference(image, label, suggestedName) {
    const reference = sizedCanvas(image, 640);
    const source = reference.getContext('2d', { willReadFrequently: true });
    const recipe = extractReferenceLook(source.getImageData(0, 0, reference.width, reference.height));
    draftLook = { recipe, lut: lookToLut(recipe) };
    referenceCanvas.width = reference.width;
    referenceCanvas.height = reference.height;
    referenceContext.drawImage(reference, 0, 0);
    referenceCanvas.hidden = false;
    el('look-reference-prompt').hidden = true;
    el('look-reference-open').setAttribute('aria-label', '更换参考照片');
    el('look-reference-name').textContent = label;
    el('look-reference-name').title = label;
    if (!lookName.value.trim()) lookName.value = suggestedName.slice(0, LOOK_NAME_LIMIT);
    drawSwatches(el('look-preview-swatches'), recipe);
    lookSave.disabled = false;
    setLookStatus('已提取风格。确认效果后即可保存。');
    scheduleLookPreview();
  }

  async function readReferenceFile(file) {
    if (!file || !extractDialog.open) return;
    const request = ++referenceRequest;
    resetDraftReference();
    scheduleLookPreview();
    if (file.size > 90 * 1024 * 1024) {
      setLookStatus('参考照片超过 90 MB，请选择较小的图片。', true);
      return;
    }
    setLookStatus('正在分析参考照片…');
    const url = URL.createObjectURL(file);
    try {
      const image = await imageFrom(url);
      if (request !== referenceRequest || !extractDialog.open) return;
      analyzeReference(image, file.name, file.name.replace(/\.[^.]+$/, ''));
    } catch (error) {
      if (request !== referenceRequest || !extractDialog.open) return;
      setLookStatus(error.name === 'EncodingError'
        ? '无法打开参考图，请选择 JPG、PNG 或 WebP。'
        : (error.message || '无法提取这张参考照片的调色，请换一张清晰的图片。'), true);
    } finally {
      URL.revokeObjectURL(url);
    }
  }

  function saveDraftLook() {
    if (!draftLook) return;
    if (!lookName.value.trim()) {
      setLookStatus('请输入模板名称。', true);
      lookName.focus();
      return;
    }
    try {
      const template = createLookTemplate({ name: lookName.value, recipe: draftLook.recipe, strength: draftStrength });
      updateLookLibrary(previous => [template, ...previous]);
      useSavedLook(template, draftLook.lut);
      changeLookShelf('personal');
      extractDialog.close();
      toast('已保存「' + template.name + '」');
    } catch (error) {
      setLookStatus(error.message || '保存失败，请检查浏览器存储。', true);
    }
  }

  function downloadLookTemplate(template) {
    const file = new Blob([encodeLookTemplate(template)], { type: 'application/json' });
    const url = URL.createObjectURL(file);
    const link = document.createElement('a');
    link.href = url;
    link.download = template.name.replace(/[<>:"/\\|?*]/g, '_') + '.colorboard.json';
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 15000);
  }

  async function importLookFile(file) {
    if (!file) return;
    try {
      if (file.size > 128 * 1024) throw new Error('模板文件超过 128 KB。');
      const template = decodeLookTemplate(await file.text());
      if (listeners.signal.aborted) return;
      updateLookLibrary(previous => [template, ...previous]);
      changeLookShelf('personal');
      toast('已导入「' + template.name + '」');
    } catch (error) {
      toast(error.message || '无法导入这个模板文件。');
    }
  }

  function openRenameLook(template) {
    editingLookId = template.id;
    el('rename-look-name').value = template.name;
    el('rename-look-status').textContent = '';
    renameDialog.showModal();
    el('rename-look-name').select();
  }

  function renameLook() {
    const name = el('rename-look-name').value.trim();
    const note = el('rename-look-status');
    if (!name || name.length > LOOK_NAME_LIMIT) {
      note.textContent = '请输入 1 至 ' + LOOK_NAME_LIMIT + ' 个字的名称。';
      note.dataset.error = 'true';
      return;
    }
    try {
      updateLookLibrary(previous => previous.map(template => template.id === editingLookId ? { ...template, name } : template));
      if (state.appliedLook?.id === editingLookId) {
        state.appliedLook = lookLibrary.find(template => template.id === editingLookId);
        syncAppliedLook();
      }
      renameDialog.close();
      toast('模板已重命名');
    } catch (error) {
      note.textContent = error.message || '重命名失败。';
      note.dataset.error = 'true';
    }
  }

  function openDeleteLook(template) {
    editingLookId = template.id;
    el('delete-look-status').textContent = '从「我的模板」中删除「' + template.name + '」？';
    deleteDialog.showModal();
  }

  function deleteLook() {
    const id = editingLookId;
    try {
      updateLookLibrary(previous => previous.filter(template => template.id !== id));
      if (state.appliedLook?.id === id) {
        clearAppliedLook();
        scheduleRender();
        if (!state.baseLut) void runAutoGrade({ quiet: true });
      }
      deleteDialog.close();
      toast('模板已删除');
    } catch (error) {
      el('delete-look-status').textContent = error.message || '删除失败。';
    }
  }

  for (const trigger of ['extract-look-header', 'extract-look-open']) {
    el(trigger).addEventListener('click', openLookExtractor);
  }
  el('my-looks-tab').addEventListener('click', () => changeLookShelf('personal'));
  el('feishu-looks-tab').addEventListener('click', () => changeLookShelf('feishu'));
  el('look-reference-open').addEventListener('click', () => el('look-reference-input').click());
  el('look-reference-input').addEventListener('change', event => {
    const file = event.target.files[0];
    event.target.value = '';
    void readReferenceFile(file);
  });
  el('look-use-current').addEventListener('click', () => {
    if (!state.photo) return;
    referenceRequest++;
    resetDraftReference();
    try {
      analyzeReference(state.photo.image, state.photo.name, state.photo.name + '风格');
    } catch (error) {
      setLookStatus(error.message || '当前照片的色彩信息不足。', true);
      scheduleLookPreview();
    }
  });
  lookSave.addEventListener('click', saveDraftLook);
  extractDialog.addEventListener('close', () => {
    if (extractDialog.open) return;
    referenceRequest++;
    resetDraftReference();
    targetCanvas.width = 1;
    targetCanvas.height = 1;
  });
  el('look-clear').addEventListener('click', () => {
    const preset = FEISHU_LOOKS.find(look => look.id === state.appliedLook?.id);
    if (preset) {
      toggleFeishu(preset);
      return;
    }
    clearAppliedLook();
    scheduleRender();
    if (!state.baseLut) void runAutoGrade({ quiet: true });
  });
  el('look-import-open').addEventListener('click', () => el('look-import-input').click());
  el('look-import-input').addEventListener('change', event => {
    const file = event.target.files[0];
    event.target.value = '';
    void importLookFile(file);
  });
  el('rename-look-confirm').addEventListener('click', renameLook);
  el('delete-look-confirm').addEventListener('click', deleteLook);
  for (const [input, submit] of [[lookName, saveDraftLook], [el('rename-look-name'), renameLook]]) {
    input.addEventListener('keydown', event => {
      if (event.key !== 'Enter' || event.isComposing) return;
      event.preventDefault();
      submit();
    });
  }
  window.addEventListener('storage', event => {
    if (frameLab.saving || (event.key !== LOOK_STORAGE_KEY && event.key !== null)) return;
    try {
      lookLibrary = readLookLibrary();
      if (state.appliedLook && !FEISHU_LOOKS.some(look => look.id === state.appliedLook.id)) {
        const current = lookLibrary.find(template => template.id === state.appliedLook.id);
        if (current) {
          state.appliedLook = current;
          syncAppliedLook();
        } else {
          clearAppliedLook();
          scheduleRender();
          if (!state.baseLut) void runAutoGrade({ quiet: true });
        }
      }
      refreshLookCards();
    } catch {
      toast('本地模板库暂时无法读取。');
    }
  }, listenerOptions);

  const feishuTables = new Map();
  const feishuDialog = el('feishu-case-dialog');
  const feishuCardButtons = new Map();
  let feishuRequest = 0;
  let feishuPending = null;
  let currentFeishuCase = null;

  function feishuSelection(look) {
    if (look.subjectColor) {
      if (state.boxSession?.color) return 'selecting';
      if (state.layers.some(layer => layer.id === state.colorLayerId && layer.visible)) return 'active';
    }
    if (look.id === state.appliedLook?.id || (state.glowEnabled && look.id === state.glowPresetId)) return 'active';
    return 'idle';
  }

  function syncFeishuSelection() {
    const label = (look, idleLabel) => {
      if (feishuPending === look.id) return '加载中…';
      const selection = feishuSelection(look);
      return selection === 'selecting' ? '取消框选' : selection === 'active' ? '取消应用' : idleLabel;
    };
    for (const [look, button] of feishuCardButtons) {
      const selected = feishuSelection(look) !== 'idle';
      button.setAttribute('aria-pressed', String(selected));
      button.closest('.feishu-card').classList.toggle('active', selected);
      button.textContent = label(look, '应用');
      button.setAttribute('aria-label', button.textContent + '「' + look.name + '」');
      button.disabled = feishuPending === look.id;
    }
    const caseApply = el('feishu-case-apply');
    caseApply.disabled = Boolean(currentFeishuCase && feishuPending === currentFeishuCase.id);
    if (currentFeishuCase) caseApply.querySelector('span').textContent = label(currentFeishuCase, '应用预设');
  }

  function cancelFeishuApply() {
    if (feishuPending !== null) {
      feishuRequest++;
      feishuPending = null;
      syncFeishuSelection();
    }
  }

  function toggleFeishu(look) {
    const selection = feishuSelection(look);
    if (selection === 'idle') {
      void applyFeishu(look);
      return;
    }
    if (selection === 'selecting') {
      cancelBoxSelection();
    } else if (look.subjectColor) {
      state.colorLayerId = null;
      syncMaskPanel();
    } else if (look.glow) {
      const previous = state.glowBeforePreset;
      if (previous) state.glow = previous.settings;
      state.glowEnabled = previous?.enabled ?? false;
      state.glowPresetId = null;
      state.glowBeforePreset = null;
      syncGlowControls();
    } else {
      clearAppliedLook();
    }
    syncFeishuSelection();
    if (feishuDialog.open && currentFeishuCase === look) feishuDialog.close();
    if (selection === 'active') {
      scheduleRender();
      toast('已取消「' + look.name + '」');
    }
  }

  async function applyFeishu(look, { quiet = false } = {}) {
    if (look.subjectColor) {
      const layer = state.layers.find(layer => layer.id === state.subjectPresetLayerId);
      if (layer) {
        state.colorLayerId = layer.id;
        layer.visible = true;
        state.maskOverlay = false;
        syncMaskPanel();
        syncFeishuSelection();
        scheduleRender();
      }
      const started = layer || beginBoxSelection({ color: true });
      if (started && feishuDialog.open) {
        feishuDialog.close();
        if (!layer) el('box-selection').focus({ preventScroll: true });
      }
      return Boolean(started);
    }
    const request = ++feishuRequest;
    feishuPending = look.id;
    syncFeishuSelection();
    try {
      if (look.glow) {
        loadGlowPreset(look);
        setPanel('glow');
      } else {
        let table = feishuTables.get(look.id);
        if (!table) {
          const response = await fetch(look.url, listenerOptions);
          if (!response.ok) throw new Error('Missing sample LUT: ' + look.id);
          table = parseCube(await response.text());
          feishuTables.set(look.id, table);
        }
        if (request !== feishuRequest) return false;
        feishuPending = null;
        useSavedLook(look, table, { keepAdjustments: true });
      }
      changeLookShelf('feishu');
      if (feishuDialog.open && currentFeishuCase?.id === look.id) feishuDialog.close();
      if (!quiet) toast('已应用「' + look.name + '」');
      return true;
    } catch (error) {
      if (request !== feishuRequest) return false;
      console.error(error);
      if (feishuDialog.open && currentFeishuCase?.id === look.id) {
        el('feishu-case-summary').textContent = '无法载入调色模板，请关闭后重试。';
      } else {
        toast('无法载入调色模板，请重试。');
      }
      return false;
    } finally {
      if (request === feishuRequest) {
        feishuPending = null;
        syncFeishuSelection();
      }
    }
  }

  async function tryFeishuFrame(look, source, name, button) {
    const request = ++state.imageRequest;
    button.disabled = true;
    try {
      const image = await imageFrom(source);
      if (request !== state.imageRequest || !feishuDialog.open || currentFeishuCase !== look) return;
      if (await applyFeishu(look, { quiet: true }) && request === state.imageRequest) {
        mountPhoto(image, name, true);
        setView('compare');
        $('.board-heading').scrollIntoView({ block: 'nearest' });
        toast('已在示例图上套用「' + look.name + '」');
      }
    } catch {
      el('feishu-case-summary').textContent = '暂时打不开这张案例照片，请重试。';
    } finally {
      button.disabled = false;
    }
  }

  function feishuPhoto(src, label) {
    const figure = document.createElement('figure');
    figure.className = 'feishu-case-photo';
    const image = document.createElement('img');
    Object.assign(image, { src, alt: label, loading: 'lazy' });
    const caption = document.createElement('figcaption');
    caption.textContent = label;
    figure.append(image, caption);
    return figure;
  }

  function openFeishuCase(look) {
    currentFeishuCase = look;
    el('feishu-case-title').textContent = look.name;
    const detail = look.subjectColor ? '在画面上拖一个框，移动或调整大小后点「确认识别」。主体保留颜色，其他区域转成黑白，生成后还可用画笔精修。' :
      look.glow ? '样片里的灯柱和尾灯已带辉光。应用预设后，工作台会根据当前照片的高光生成晕染和光带。' :
      look.cases.length ? '这套模板用同场景前后截图拟合整体色彩，局部光晕和柔焦需单独处理。' :
        '这套模板根据同组样本整理色调，适合在自己的照片上试色。';
    el('feishu-case-summary').textContent = look.description + ' ' + detail;
    const cases = look.cases.map(item => {
      const section = document.createElement('section');
      section.className = 'feishu-case';
      const header = document.createElement('div');
      header.className = 'feishu-case-heading';
      const heading = document.createElement('h3');
      heading.textContent = item.title;
      const tryCase = document.createElement('button');
      Object.assign(tryCase, { type: 'button', className: 'text-button', textContent: '用案例原图试色' });
      tryCase.addEventListener('click', () => {
        void tryFeishuFrame(look, item.before, item.title + ' · 原图', tryCase);
      });
      header.append(heading, tryCase);
      const photos = document.createElement('div');
      photos.className = 'feishu-case-photos';
      photos.append(feishuPhoto(item.before, '调整前'), feishuPhoto(item.after, '调整后'));
      const note = document.createElement('p');
      note.className = 'panel-note';
      note.textContent = item.analysis;
      section.append(header, photos, note);
      return section;
    });
    el('feishu-pairs').replaceChildren(...cases);
    const extra = el('feishu-extra');
    extra.replaceChildren();
    if (look.references.length) {
      const section = document.createElement('section');
      section.className = 'feishu-case';
      const heading = document.createElement('h3');
      heading.textContent = look.cases.length ? '同类参考' : '色调参考';
      const photos = document.createElement('div');
      photos.className = 'feishu-reference-grid';
      photos.append(...look.references.map(item => feishuPhoto(item.src, item.label)));
      section.append(heading, photos);
      if (look.glow || look.subjectColor) {
        const demo = document.createElement('button');
        Object.assign(demo, {
          type: 'button', className: 'button feishu-case-glow-demo',
          textContent: look.subjectColor ? '用示例练习框选' : '用参考图试加辉光'
        });
        demo.addEventListener('click', async () => {
          const reference = look.references[0];
          if (!look.subjectColor) {
            void tryFeishuFrame(look, reference.src, reference.label, demo);
            return;
          }
          const request = ++state.imageRequest;
          demo.disabled = true;
          try {
            const image = await imageFrom(reference.src);
            if (request !== state.imageRequest || !feishuDialog.open || currentFeishuCase !== look) return;
            feishuDialog.close();
            mountPhoto(image, reference.label, true);
            beginBoxSelection({ color: true });
            $('.board-heading').scrollIntoView({ block: 'nearest' });
          } catch {
            el('feishu-case-summary').textContent = '示例照片打开失败，请重试。';
          } finally {
            demo.disabled = false;
          }
        });
        section.append(demo);
      }
      extra.append(section);
    }
    syncFeishuSelection();
    feishuDialog.showModal();
  }

  function installFeishuCards() {
    const grid = el('feishu-look-grid');
    for (const look of FEISHU_LOOKS) {
      const card = document.createElement('article');
      card.className = 'feishu-card';
      const cover = document.createElement('img');
      Object.assign(cover, { src: look.thumbnail ?? look.cover, alt: look.name + '参考效果', loading: 'lazy', fetchPriority: 'low' });
      const body = document.createElement('div');
      body.className = 'feishu-card-body';
      const meta = document.createElement('div');
      meta.className = 'feishu-card-meta';
      const name = document.createElement('h3');
      name.textContent = look.name;
      const method = document.createElement('span');
      method.className = 'feishu-method';
      method.textContent = look.method;
      meta.append(name, method);
      const description = document.createElement('p');
      description.textContent = look.category + ' · ' + look.description;
      const actions = document.createElement('div');
      actions.className = 'feishu-card-actions';
      const apply = document.createElement('button');
      Object.assign(apply, { type: 'button', className: 'button button-soft' });
      apply.dataset.feishuLook = look.id;
      apply.addEventListener('click', () => toggleFeishu(look));
      feishuCardButtons.set(look, apply);
      const detail = document.createElement('button');
      Object.assign(detail, { type: 'button', className: 'text-button', textContent: look.cases.length ? '前后案例' : '看样本' });
      detail.setAttribute('aria-label', '查看「' + look.name + '」' + detail.textContent);
      detail.addEventListener('click', () => openFeishuCase(look));
      actions.append(detail, apply);
      body.append(meta, description, actions);
      card.append(cover, body);
      grid.append(card);
    }
    syncFeishuSelection();
  }

  el('feishu-case-apply').addEventListener('click', () => {
    if (currentFeishuCase) toggleFeishu(currentFeishuCase);
  });
  feishuDialog.addEventListener('close', () => {
    if (feishuDialog.open) return;
    currentFeishuCase = null;
  });

  const frameImageType = /^image\/(?:jpeg|png|webp|avif|gif|bmp)$/i;
  const replacementLimit = 1_500_000;
  const framePanels = ['tone', 'color', 'glow', 'mask'];
  const frameText = (value, fallback = '') => typeof value === 'string' ? value.slice(0, 256) : fallback;
  const frameNumber = (value, fallback, min, max) => Number.isFinite(value) ? clamp(value, min, max) : fallback;

  function syncFrameLabActions() {
    const locked = frameLab.saving || frameLab.opening;
    const save = el('framelab-save');
    save.disabled = locked || !state.photo || Boolean(state.aiRun) || state.lutPending;
    $('main').inert = locked;
    save.querySelector('span').textContent = frameLab.saving ? '正在保存…' : '保存到画布';
    el('framelab-collage').disabled = locked;
    el('open-file').disabled = locked;
    el('extract-look-header').disabled = locked;
    el('export-open').disabled = locked || !state.photo;
    el('framelab-back').disabled = frameLab.saving;
    for (const button of menuCommands) {
      const target = el(button.dataset.workbenchCommand);
      const requiresPhoto = ['show-original', 'fit-view'].includes(target.id);
      button.disabled = locked || target.disabled || (requiresPhoto && !state.photo);
    }
  }

  function frameSourceUrl(source) {
    if (!source) return '';
    if (typeof source !== 'string') throw new Error('照片来源无效。');
    if (/^data:image\/(?:jpeg|png|webp|avif|gif|bmp);base64,[a-z0-9+/]+=*$/i.test(source)) return source;
    const url = new URL(source, window.location.href);
    if (!['https:', 'http:', 'blob:'].includes(url.protocol) || url.origin !== window.location.origin) {
      throw new Error('无法读取这个来源的照片。');
    }
    return url.href;
  }

  function frameSettings(input) {
    const settings = { ...DEFAULT_SETTINGS };
    for (const key of Object.keys(settings)) {
      if (typeof settings[key] !== 'number') continue;
      const limit = key === 'exposure' ? 3 : key === 'hue' ? 180 : 100;
      settings[key] = frameNumber(input?.[key], 0, -limit, limit);
    }
    const curve = Array.isArray(input?.curve) ? { rgb: input.curve } : input?.curve;
    const channels = ['rgb', 'red', 'green', 'blue'];
    const validPoints = points => Array.isArray(points) && points.length >= 2 && points.length <= 128 &&
      points.every(point => Array.isArray(point) && point.length === 2 && point.every(v => Number.isFinite(v) && v >= 0 && v <= 1));
    const curves = channels.filter(channel => validPoints(curve?.[channel]));
    if (curves.length) settings.curve = Object.fromEntries(curves.map(channel => [channel, curve[channel]]));
    if (input?.hsl) {
      settings.hsl = {};
      for (const [key] of hslRanges) {
        const range = input.hsl[key];
        if (range && typeof range === 'object') settings.hsl[key] = {
          hue: frameNumber(range.hue, 0, -180, 180),
          saturation: frameNumber(range.saturation, 0, -100, 100),
          luminance: frameNumber(range.luminance, 0, -100, 100)
        };
      }
    }
    return settings;
  }

  function frameBox(value) {
    const keys = ['x', 'y', 'width', 'height'];
    if (!value || !keys.every(key => Number.isFinite(value[key]) && value[key] >= 0 && value[key] <= 1) ||
        value.width <= 0 || value.height <= 0 || value.x + value.width > 1.0001 || value.y + value.height > 1.0001) return null;
    return Object.fromEntries(keys.map(key => [key, value[key]]));
  }

  function restoreFrameLayers(records) {
    const seen = new Set();
    return records.map(record => {
      const { id, width, height } = record;
      if (typeof id !== 'string' || !/^[a-z0-9-]{1,80}$/i.test(id) || seen.has(id) ||
          ![width,height].every(size => Number.isInteger(size) && size >= 1 && size <= 1100)) {
        throw new Error('调色工程中的蒙版记录无效。');
      }
      seen.add(id);
      const pixels = fromBase64(record.alpha, width * height);
      if (pixels.length !== width * height) throw new Error('调色工程中的蒙版尺寸无效。');
      const alpha = new Uint8ClampedArray(pixels.buffer);
      const canvas = document.createElement('canvas');
      Object.assign(canvas, { width, height });
      installMaskAlpha(canvas, alpha);
      const box = frameBox(record.box);
      return {
        id, canvas, alpha, box, showBox: Boolean(box && record.showBox),
        name: frameText(record.name, '蒙版'), visible: record.visible !== false,
        invert: record.invert === true, opacity: frameNumber(record.opacity, 100, 0, 100),
        settings: frameSettings(record.settings)
      };
    });
  }

  function restoreFrameProject(project) {
    const layers = restoreFrameLayers(project.layers);
    const savedLook = project.appliedLook;
    const referenceLut = unpackLut(project.referenceLut);
    const appliedLook = savedLook && referenceLut ? {
      id: frameText(savedLook.id), name: frameText(savedLook.name, '已应用模板'),
      strength: frameNumber(savedLook.strength, 100, 1, 100)
    } : null;
    Object.assign(state, {
      settings: frameSettings(project.settings),
      presetId: PRESETS.some(preset => preset.id === project.presetId) ? project.presetId : null,
      baseLut: unpackLut(project.baseLut), aiStrength: frameNumber(project.aiStrength, 70, 0, 100),
      referenceLut: appliedLook ? referenceLut : null, appliedLook,
      referenceStrength: frameNumber(project.referenceStrength, 100, 1, 100),
      lut: unpackLut(project.lut), lutName: frameText(project.lutName), lutLookId: frameText(project.lutLookId),
      lutStrength: frameNumber(project.lutStrength, 70, 0, 100),
      layers, layerId: layers.find(layer => layer.id === project.layerId)?.id ?? null,
      colorLayerId: layers.find(layer => layer.id === project.colorLayerId)?.id ?? null,
      subjectPresetLayerId: layers.find(layer => layer.box && layer.id === (project.subjectPresetLayerId ?? project.colorLayerId))?.id ?? null,
      maskOverlay: project.maskOverlay !== false,
      brushSize: frameNumber(project.brushSize, 9, 1, 35),
      brushFeather: frameNumber(project.brushFeather, 72, 0, 100),
      filmPrint: normalizeFilmPrint(project.filmPrint),
      glow: normalizeGlow(project.glow),
      glowEnabled: project.glowEnabled === true,
      glowPresetId: typeof project.glowPresetId === 'string' ? frameText(project.glowPresetId) : null,
      glowBeforePreset: project.glowBeforePreset?.settings ? {
        settings: normalizeGlow(project.glowBeforePreset.settings),
        enabled: project.glowBeforePreset.enabled === true
      } : null,
      compare: frameNumber(project.compare, 50, 0, 100)
    });
    setBusy(el('run-ai'), false, state.baseLut ? '重新自动调色' : '自动调色');
    if (state.baseLut) inFlightMessage.textContent = '已恢复此照片的自动调色';
    syncLutControls();
    syncGlowControls();
    syncFilmPrint();
    el('film-print').open = state.filmPrint.enabled;
    syncSettings();
    syncMaskPanel();
    syncFeishuSelection();
    setPanel(framePanels.includes(project.panel) ? project.panel : 'tone');
    setView(project.view === 'compare' ? 'compare' : 'after');
    canvasView.setRotation(frameNumber(project.rotation, 0, -180, 180));
    canvasView.zoomBy(frameNumber(project.zoom, 1, .12, 16));
    scheduleRender();
  }

  async function openFrameLabProject() {
    syncFrameLabActions();
    let problem, saved;
    try {
      if (project) saved = await unpackProject(project);
    } catch (error) {
      problem = error.message;
    }
    if (listeners.signal.aborted) return;
    try {
      const photoName = frameText(name) || '画布照片';
      if (saved?.replacement) {
        const replacement = saved.replacement;
        if (!frameImageType.test(replacement.mime)) throw new Error('工程中的照片格式无效。');
        const file = new Blob([fromBase64(replacement.data, replacementLimit)], { type: replacement.mime });
        const url = URL.createObjectURL(file);
        try {
          const image = await imageFrom(url);
          if (listeners.signal.aborted) return;
          mountPhoto(image, frameText(replacement.name, photoName), false, file);
        } finally {
          URL.revokeObjectURL(url);
        }
      } else if (source || (!saved && legacyPreview)) {
        const useLegacy = !saved && Boolean(legacyPreview);
        const image = await imageFrom(frameSourceUrl(useLegacy ? legacyPreview : source));
        if (listeners.signal.aborted) return;
        if (!useLegacy) frameLab.linkedImage = image;
        mountPhoto(image, photoName, false);
      }
      if (state.photo && saved) restoreFrameProject(saved);
    } catch (error) {
      problem = error.message || '无法恢复调色工程。';
    } finally {
      if (!listeners.signal.aborted) {
        frameLab.opening = false;
        syncFrameLabActions();
        if (problem) toast(problem);
      }
    }
  }

  function frameCanvasBlob(canvas, type, quality) {
    return new Promise((resolve, reject) => {
      canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('无法编码当前照片。')), type, quality);
    });
  }

  async function frameReplacement() {
    const { image, name } = state.photo;
    if (image === frameLab.linkedImage) return null;
    let file = state.photo.file;
    if (!file) {
      try {
        const response = await fetch(frameSourceUrl(image.src), listenerOptions);
        if (response.ok) file = await response.blob();
      } catch {
        listeners.signal.throwIfAborted();
        // Use decoded pixels if the replacement source no longer has a reusable URL.
      }
    }
    if (!file || file.size > replacementLimit || !frameImageType.test(file.type)) {
      file = await frameCanvasBlob(sizedCanvas(image, 2048, 2_800_000), 'image/webp', .90);
    }
    if (file.size > replacementLimit) {
      throw new Error('新照片过大，保存到画布前请换用较小的照片。');
    }
    return { name, mime: file.type, data: toBase64(new Uint8Array(await file.arrayBuffer())) };
  }

  async function frameProjectBlob() {
    const replacement = await frameReplacement();
    const {
      settings, presetId, aiStrength, referenceStrength, lutStrength, lutName, lutLookId,
      layerId, colorLayerId, subjectPresetLayerId, filmPrint, glow, glowEnabled, glowPresetId, glowBeforePreset, maskOverlay, brushSize,
      brushFeather, panel, view, compare
    } = state;
    const layers = state.layers.map(({ canvas, id, name, box, showBox, visible, invert, opacity, settings }) => ({
      id, name, box, showBox, visible, invert, opacity, settings,
      width: canvas.width, height: canvas.height, alpha: toBase64(readMask(canvas))
    }));
    const { zoom, rotation } = canvasView.getState();
    const active = state.appliedLook;
    return packProject({
      replacement, settings, presetId, aiStrength, referenceStrength, lutStrength, lutName, lutLookId,
      layerId, colorLayerId, subjectPresetLayerId, filmPrint, glow, glowEnabled, glowPresetId, glowBeforePreset, maskOverlay, brushSize,
      brushFeather, panel, view, compare, layers, zoom, rotation,
      baseLut: packLut(state.baseLut), referenceLut: packLut(state.referenceLut), lut: packLut(state.lut),
      appliedLook: active && { id: active.id, name: active.name, strength: active.strength }
    });
  }

  function finishFrameLabSave(error) {
    if (listeners.signal.aborted) return;
    frameLab.saving = false;
    syncFrameLabActions();
    if (!error) frameLab.dirty = false;
    else el('framelab-save').focus();
    toast(error || '已保存到画布');
  }

  async function saveFrameLabPhoto() {
    if (frameLab.opening || frameLab.saving || !state.photo) return;
    if (state.aiRun || state.lutPending || state.maskJob || state.boxSession?.job || feishuPending) {
      toast('请等当前调色或蒙版处理完成再保存。');
      return;
    }
    frameLab.saving = true;
    syncFrameLabActions();
    try {
      await new Promise(requestAnimationFrame);
      if (listeners.signal.aborted) return;
      const canvas = sizedCanvas(state.photo.image, 1400);
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      ctx.putImageData(render(ctx.getImageData(0, 0, canvas.width, canvas.height)), 0, 0);
      ctx.globalCompositeOperation = 'destination-over';
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      const [preview, project] = await Promise.all([frameCanvasBlob(canvas, 'image/jpeg', .90), frameProjectBlob()]);
      if (listeners.signal.aborted) return;
      await onSave({ preview, project, width: canvas.width, height: canvas.height });
      finishFrameLabSave();
    } catch (error) {
      finishFrameLabSave(error.message || '无法保存到画布。');
    }
  }

  function setTheme(value) {
    host.dataset.framelabTheme = value === 'dark' ? 'dark' : 'light';
  }

  function dispose() {
    if (listeners.signal.aborted) return;
    listeners.abort();
    signal?.removeEventListener('abort', dispose);
    cancelAnimationFrame(paintFrame);
    cancelAnimationFrame(draftFrame);
    clearTimeout(toastTimer);
    state.imageRequest++;
    state.lutRequest++;
    referenceRequest++;
    feishuRequest++;
    state.aiRun = null;
    state.maskJob?.abort();
    state.maskJob = null;
    cancelBoxSelection();
    canvasView.destroy();
    $$('dialog[open]').forEach(dialog => dialog.close());
  }

  installFeishuCards();
  icons();
  try {
    lookLibrary = readLookLibrary();
    refreshLookCards();
  } catch {
    toast('本地模板库暂时无法读取。');
  }
  syncSettings();
  setTheme(theme);
  el('framelab-save').addEventListener('click', saveFrameLabPhoto, listenerOptions);
  el('framelab-collage').addEventListener('click', onCollage, listenerOptions);
  el('framelab-back').addEventListener('click', () => {
    if (frameLab.saving || (frameLab.dirty && !window.confirm('当前调整尚未保存，确定要离开吗？'))) return;
    onClose();
  }, listenerOptions);
  signal?.addEventListener('abort', dispose, { once: true });
  if (signal?.aborted) dispose();
  const ready = listeners.signal.aborted ? Promise.resolve() : openFrameLabProject();
  async function photoForCollage() {
    if (!state.photo) return null;
    const canvas = sizedCanvas(state.photo.image, 1600);
    const ctx = canvas.getContext('2d', {willReadFrequently:true});
    ctx.putImageData(render(ctx.getImageData(0, 0, canvas.width, canvas.height)), 0, 0);
    return {name:state.photo.name, blob:await frameCanvasBlob(canvas, 'image/webp', .94)};
  }
  return { ready, dispose, setTheme, photoForCollage, hasPhoto:() => Boolean(state.photo), isDirty:() => frameLab.dirty };
}
