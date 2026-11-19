// Four seasons, Golden Hour and Blue Hour are adapted from OpenStill Originals (CC0-1.0).
// https://github.com/haon-v2/OpenStill/blob/main/Resources/LUTs/originals.json
export const presetGroups = [
  ['人像', ['portrait']],
  ['四季', ['spring', 'summer', 'autumn', 'winter']],
  ['色调', ['golden', 'blue', 'matte']],
];
export const presets = {
  portrait: {name: '通用人像', manual: {contrast: -7, shadows: 12, highlights: -8, saturation: -3}},
  spring: {name: '春日清新', recipe: [['exposure', .15], ['vibrance', .25], ['tint', .15], ['fade', .04]]},
  summer: {name: '夏日明亮', recipe: [['exposure', .1], ['warm', .25], ['vibrance', .3]]},
  autumn: {name: '秋日暖色', recipe: [['hue', 8], ['warm', .3], ['sat', 1.2]]},
  winter: {name: '冬日冷调', recipe: [['warm', -.45], ['sat', .7], ['exposure', .1]]},
  golden: {name: '暖金', recipe: [['warm', .55], ['rolloff', .75], ['sat', 1.1]]},
  blue: {name: '暮蓝', recipe: [['warm', -.6], ['exposure', -.3], ['sat', 1.1]]},
  matte: {name: '柔和哑光', recipe: [['fade', .05]], manual: {contrast: -9, saturation: -9}},
};
export const globalControls = [
  ['exposure', '曝光', -2, 2, .05, ' EV'], ['contrast', '对比度', -50, 50, 1, ''],
  ['highlights', '高光', -100, 100, 1, ''], ['shadows', '阴影', -100, 100, 1, ''],
  ['temperature', '色温', -50, 50, 1, ''], ['saturation', '饱和度', -50, 50, 1, ''],
];
export const colorControls = [
  ['hue', '色相', -40, 40, 1, '°'], ['saturation', '饱和度', -100, 100, 1, ''],
  ['lightness', '明度', -50, 50, 1, ''],
];
export const localControls = [
  ['subject', '主体曝光', -2, 2, .05, ' EV'], ['background', '背景曝光', -2, 2, .05, ' EV'],
  ['feather', '边缘羽化', 0, 100, 1, '%'],
];
export const channels = [
  ['red', '红色', 0], ['orange', '橙色', 31], ['yellow', '黄色', 59], ['green', '绿色', 120],
  ['cyan', '青色', 182], ['blue', '蓝色', 232], ['purple', '紫色', 274], ['magenta', '洋红', 320],
];
const bounded = (value, low, high, fallback = 0) => typeof value === 'number' && Number.isFinite(value) ? Math.min(high, Math.max(low, value)) : fallback;
const validPreset = key => Object.hasOwn(presets, key) ? key : '';
const point = p => [bounded(p?.[0], 0, 1, .5), bounded(p?.[1], 0, 1, .5)];
const tidy = (values, controls) => Object.fromEntries(controls.flatMap(([key,, min, max]) => {
  const value = bounded(values?.[key], min, max);
  return value === 0 ? [] : [[key, value]];
}));
export function gradeSettings(input) {
  const options = input && typeof input === 'object' ? input : {};
  const colors = Object.fromEntries(channels.flatMap(([key]) => {
    const value = tidy(options.colors?.[key], colorControls);
    return Object.keys(value).length ? [[key, value]] : [];
  }));
  const strokes = Array.isArray(options.strokes) ? options.strokes.slice(0, 80).map(stroke => ({
    erase: Boolean(stroke?.erase), radius: bounded(stroke?.radius, .005, .15, .04),
    points: Array.isArray(stroke?.points) ? stroke.points.slice(0, 160).map(point) : [],
  })).filter(stroke => stroke.points.length) : [];
  return {
    version: 1,
    preset: validPreset(options.preset),
    strength: bounded(options.strength, 0, 100, 70),
    base: options.base === 'legacy' || options.base === 'auto' ? options.base : 'original',
    aiStrength: bounded(options.aiStrength, 0, 1, .6),
    draft: options.draft ? {preset:validPreset(options.draft.preset),strength:bounded(options.draft.strength,0,100,0),global:tidy(options.draft.global,globalControls)} : null,
    global: tidy(options.global, globalControls), colors,
    local: {...tidy(options.local, localControls), feather: bounded(options.local?.feather, 0, 100, 24)},
    point: Array.isArray(options.point) && options.point.length === 2 ? point(options.point) : null,
    strokes,
  };
}
const clamp = value => Math.min(1, Math.max(0, value));
const toLinear = value => value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4;
const fromLinear = value => value <= .0031308 ? value * 12.92 : 1.055 * value ** (1/2.4) - .055;
const changeExposure = (value,factor) => factor === 1 ? value : fromLinear(toLinear(value) * factor);
const luma = (r, g, b) => .2126 * r + .7152 * g + .0722 * b;
function adjustChannel(rgb, values) {
  let [r, g, b] = rgb;
  const exposure = 2 ** (values.exposure || 0), temperature = (values.temperature || 0) * .003;
  r = changeExposure(r,exposure) * (1 + temperature);
  g = changeExposure(g,exposure);
  b = changeExposure(b,exposure) * (1 - temperature);
  const light = luma(r,g,b), contrast = 1 + (values.contrast || 0) / 100;
  const shadows = (values.shadows || 0) / 100, highlights = (values.highlights || 0) / 100;
  const weight = clamp(light);
  const tone = shadows * (1 - weight) ** 3 * .3 + highlights * weight ** 3 * .26;
  const sat = 1 + (values.saturation || 0) / 100;
  const newLight = (light - .5) * contrast + .5 + tone;
  return [r,g,b].map(value => clamp(newLight + (value - light) * contrast * sat));
}
function step(rgb, entry) {
  const [kind, amount] = entry;
  const [r,g,b] = rgb;
  let out;
  if (kind === 'warm') out = [r * (1 + amount * .12), g * (1 + amount * .02), b * (1 - amount * .12)];
  if (kind === 'tint') out = [r * (1 + amount * .04), g * (1 - amount * .08), b * (1 + amount * .04)];
  if (kind === 'exposure') out = rgb.map(value => value * 2 ** amount);
  if (kind === 'fade') out = rgb.map(value => amount + value * (1 - amount));
  if (kind === 'rolloff') out = rgb.map(value => value <= amount ? value : amount + (1 - amount) * (1 - Math.exp(-(value - amount) / (1 - amount))));
  if (kind === 'sat' || kind === 'vibrance') {
    const y = luma(r,g,b);
    const factor = kind === 'sat' ? amount : 1 + amount * (1 - (Math.max(r,g,b) - Math.min(r,g,b)));
    out = rgb.map(value => y + (value - y) * factor);
  }
  if (kind === 'hue') {
    const angle = amount * Math.PI / 180, sin = Math.sin(angle), cos = Math.cos(angle);
    const y = .299*r + .587*g + .114*b;
    const i = .596*r - .274*g - .322*b, q = .211*r - .523*g + .312*b;
    const a = i*cos - q*sin, z = i*sin + q*cos;
    out = [y + .956*a + .621*z, y - .272*a - .647*z, y - 1.106*a + 1.703*z];
  }
  return out.map(clamp);
}
function selectiveColor([r,g,b], colors) {
  const min = Math.min(r,g,b), max = Math.max(r,g,b), diff = max - min;
  if (diff < .015) return [r,g,b];
  const light = (min + max) / 2;
  const hue = 60 * ((max === r ? (g-b)/diff + 6 : max === g ? (b-r)/diff + 2 : (r-g)/diff + 4) % 6);
  const sat = diff / (1 - Math.abs(2*light - 1));
  let h = hue, s = sat, l = light;
  for (const {center, width, values} of colors) {
    const delta = Math.abs(hue-center);
    const weight = Math.max(0, 1 - Math.min(delta, 360-delta) / width) * Math.min(1, diff / .12);
    h += (values.hue || 0) * weight;
    s += sat * (values.saturation || 0) / 100 * weight;
    l += (values.lightness || 0) / 170 * weight;
  }
  s = clamp(s); l = clamp(l);
  const a = s * Math.min(l, 1-l);
  return [0,8,4].map(n => {
    const k = (n + (h + 360) / 30) % 12;
    return l - a * Math.max(-1, Math.min(k-3,9-k,1));
  });
}
const grid = 33;
const plane = grid * 3;
const slab = grid * plane;
const lutCache = new Map();
export function gradeLUT(edit) {
  const key = JSON.stringify([edit.preset, edit.strength, edit.global, edit.colors]);
  if (lutCache.has(key)) return lutCache.get(key);
  const preset = presets[edit.preset];
  const strength = edit.strength / 100;
  const recipe = strength ? preset?.recipe || [] : [];
  const style = strength ? preset?.manual || {} : {};
  const colors = channels.flatMap(([name,,center]) => edit.colors[name] ? [{center, width: name === 'green' ? 62 : 37, values: edit.colors[name]}] : []);
  const manual = Object.keys(edit.global).length > 0;
  const manualPreset = Object.keys(style).length > 0;
  if (!recipe.length && !manualPreset && !manual && !colors.length) return null;
  const table = new Float32Array(grid ** 3 * 3);
  let index = 0;
  for (let r=0;r<grid;r++) for (let g=0;g<grid;g++) for (let b=0;b<grid;b++) {
    const source = [r,g,b].map(value => value / (grid - 1));
    let target = recipe.reduce(step, source);
    if (manualPreset) target = adjustChannel(target,style);
    target = source.map((value, i) => value + (target[i] - value) * strength);
    if (manual) target = adjustChannel(target, edit.global);
    if (colors.length) target = selectiveColor(target, colors);
    table.set(target, index); index += 3;
  }
  if (lutCache.size >= 12) lutCache.delete(lutCache.keys().next().value);
  lutCache.set(key, table);
  return table;
}
const gridPosition = Float32Array.from({length:256}, (_, i) => i * (grid - 1) / 255);
const gridOffset = Uint8Array.from(gridPosition, value => Math.min(grid - 2, Math.floor(value)));
export function applyGrade(pixels, table, local, mask) {
  if (!table && !mask) return pixels;
  const subject = local.subject || 0, background = local.background || 0;
  const useMask = Boolean(mask && (subject || background));
  const exposure = useMask ? new Uint8ClampedArray(256 * 256) : null;
  if (useMask) {
    for(let alpha=0;alpha<256;alpha++) {
      const factor = 2 ** (subject * alpha / 255 + background * (1 - alpha / 255));
      for(let value=0;value<256;value++) exposure[alpha*256+value] = changeExposure(value/255,factor)*255;
    }
  } else if(!table) return pixels;
  for (let i=0;i<pixels.length;i+=4) {
    const r=pixels[i], g=pixels[i+1], b=pixels[i+2];
    const band = useMask ? mask[i >> 2]*256 : 0;
    if (!table) {
      pixels[i]=exposure[band+r]; pixels[i+1]=exposure[band+g]; pixels[i+2]=exposure[band+b];
      continue;
    }
    const rr=gridOffset[r], gg=gridOffset[g], bb=gridOffset[b];
    const x=gridPosition[r]-rr, y=gridPosition[g]-gg, z=gridPosition[b]-bb;
    const p=rr*slab+gg*plane+bb*3;
    const a=(1-x)*(1-y), d=(1-x)*y, f=x*(1-y), h=x*y;
    for (let c=0;c<3;c++) {
      const k=p+c;
      const low = a*table[k]+d*table[k+plane]+f*table[k+slab]+h*table[k+slab+plane];
      const high = a*table[k+3]+d*table[k+plane+3]+f*table[k+slab+3]+h*table[k+slab+plane+3];
      const channel=(low+(high-low)*z)*255;
      pixels[i+c]=useMask?exposure[band+Math.round(channel)]:channel;
    }
  }
  return pixels;
}
