const LUMA_R = 0.2126;
const LUMA_G = 0.7152;
const LUMA_B = 0.0722;
const RANGE_NAMES = ['red', 'orange', 'yellow', 'green', 'blue', 'purple'];
const HUE_CENTERS = [0, 30, 60, 120, 220, 285, 360];

export const DEFAULT_SETTINGS = Object.freeze({
  exposure: 0, temperature: 0, tint: 0,
  contrast: 0, highlights: 0, shadows: 0, whites: 0, blacks: 0,
  saturation: 0, vibrance: 0, hue: 0,
  clarity: 0, sharpen: 0, dehaze: 0, fade: 0, vignette: 0, grain: 0,
  curve: null, hsl: null,
});

export const PRESETS = [
  {
    id: 'architecture', name: '建筑冷调', category: '建筑',
    description: '略冷的白平衡、干净的几何线条与收敛的杂色。',
    settings: {
      temperature: -12, tint: -3, contrast: 15, highlights: -20, shadows: 8,
      whites: 7, blacks: -10, saturation: -12, vibrance: 8, clarity: 24, dehaze: 9, sharpen: 12,
      hsl: { blue: { hue: -8, saturation: -13, luminance: 3 } },
    },
  },
  {
    id: 'portrait', name: '人像柔肤', category: '人像',
    description: '柔和高光与浅暖肤色，保留面部自然明暗。',
    settings: {
      exposure: 0.08, temperature: 12, tint: 4, contrast: -11, highlights: -15, shadows: 19,
      whites: 1, blacks: 5, saturation: -5, vibrance: 12, clarity: -16, fade: 7,
      hsl: { orange: { hue: -2, saturation: -6, luminance: 12 }, red: { hue: 3, saturation: -6, luminance: 5 } },
    },
  },
  {
    id: 'landscape', name: '山野通透', category: '风景',
    description: '压住天空高光，提亮暗部，增强植被与水面的色彩层次。',
    settings: {
      temperature: -3, tint: 2, contrast: 14, highlights: -24, shadows: 16,
      whites: 5, blacks: -12, saturation: 5, vibrance: 28, clarity: 13, dehaze: 16, sharpen: 10,
      hsl: { green: { hue: -9, saturation: 10, luminance: 2 }, blue: { hue: -6, saturation: 10, luminance: -9 } },
    },
  },
  {
    id: 'night', name: '霓虹夜景', category: '夜景',
    description: '冷青环境与暖色灯光形成对比，收住灯牌高光。',
    settings: {
      exposure: 0.09, temperature: -18, tint: 6, contrast: 17, highlights: -29, shadows: 11,
      whites: 1, blacks: -14, saturation: 6, vibrance: 18, clarity: 13, dehaze: 8, vignette: -13,
      hsl: { orange: { hue: -7, saturation: 15, luminance: 1 }, blue: { hue: -16, saturation: 16, luminance: -8 } },
    },
  },
  {
    id: 'general-portrait', name: '通用人像', category: '人像', example: 'portrait',
    description: '轻降对比和饱和度，抬起阴影，压低高光。',
    settings: { contrast: -7, shadows: 12, highlights: -8, saturation: -3 },
  },
  // The seasonal and hour looks adapt OpenStill Originals (CC0 1.0) to these controls.
  {
    id: 'spring', name: '春日清新', category: '四季', example: 'landscape',
    description: '提亮照片，保留柔和的暗部和清新的色彩。',
    settings: { exposure: 0.15, vibrance: 25, tint: 7, fade: 4 },
  },
  {
    id: 'summer', name: '夏日明亮', category: '四季', example: 'landscape',
    description: '提高亮度和鲜艳度，增加日光的暖意。',
    settings: { exposure: 0.1, temperature: 10, vibrance: 30 },
  },
  {
    id: 'autumn', name: '秋日暖色', category: '四季', example: 'landscape',
    description: '暖化白平衡，增强黄橙色和植被的色彩。',
    settings: { hue: 8, temperature: 13, saturation: 20 },
  },
  {
    id: 'winter', name: '冬日冷调', category: '四季', example: 'landscape',
    description: '降低色温和饱和度，轻提雪景和阴天的亮度。',
    settings: { temperature: -19, saturation: -30, exposure: 0.1 },
  },
  {
    id: 'golden', name: '暖金', category: '色调', example: 'landscape',
    description: '压住强光，给照片加入日落的暖金色。',
    settings: { temperature: 23, highlights: -20, saturation: 10 },
  },
  {
    id: 'blue', name: '暮蓝', category: '色调', example: 'night',
    description: '压暗并冷却画面，保留蓝调时刻的色彩。',
    settings: { temperature: -25, exposure: -0.3, saturation: 10 },
  },
  {
    id: 'matte', name: '柔和哑光', category: '色调', example: 'architecture',
    description: '减淡黑位、对比度和饱和度。',
    settings: { fade: 5, contrast: -9, saturation: -9 },
  },
];

const clamp = (value, min = 0, max = 1) => Math.max(min, Math.min(max, value));
const numeric = (value, fallback = 0) => typeof value === 'number' && Number.isFinite(value) ? value : fallback;
const lerp = (a, b, t) => a + (b - a) * t;
const gammaToLinear = value => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
const linearToGamma = value => value <= 0.0031308 ? value * 12.92 : 1.055 * value ** (1 / 2.4) - 0.055;
const luma = (red, green, blue) => LUMA_R * red + LUMA_G * green + LUMA_B * blue;
const round = (value, precision = 0) => Number(value.toFixed(precision));

export function applyPreset(presetId, strength = 100) {
  const source = PRESETS.find(preset => preset.id === presetId)?.settings;
  const result = { ...DEFAULT_SETTINGS };
  if (!source) return result;
  const weight = clamp(numeric(strength, 100) / 100);
  for (const [key, value] of Object.entries(source)) {
    if (typeof value === 'number') {
      result[key] = round(value * weight, key === 'exposure' ? 2 : 0);
    } else if (key === 'hsl') {
      result.hsl = Object.fromEntries(Object.entries(value).map(([range, controls]) => [
        range,
        Object.fromEntries(Object.entries(controls).map(([channel, amount]) => [channel, round(amount * weight)])),
      ]));
    }
  }
  return result;
}

function checkPixels(imageData) {
  if (!imageData || !Number.isInteger(imageData.width) || !Number.isInteger(imageData.height) ||
      imageData.width < 1 || imageData.height < 1 || imageData.data?.length !== imageData.width * imageData.height * 4) {
    throw new TypeError('需要有效的 RGBA 图像。');
  }
}

export function analyzeImage(imageData) {
  checkPixels(imageData);
  const { width, height, data } = imageData;
  const histogram = Array(256).fill(0);
  const stride = Math.max(1, Math.ceil(width * height / 65536));
  let count = 0;
  let luminance = 0;
  let saturation = 0;
  let dark = 0;
  let bright = 0;
  let weightedCast = 0;
  let temperature = 0;
  let tint = 0;
  for (let index = 0; index < data.length; index += 4 * stride) {
    if (data[index + 3] < 16) continue;
    const red = data[index] / 255;
    const green = data[index + 1] / 255;
    const blue = data[index + 2] / 255;
    const value = luma(red, green, blue);
    const maximum = Math.max(red, green, blue);
    const chroma = maximum - Math.min(red, green, blue);
    histogram[Math.round(value * 255)]++;
    luminance += value;
    saturation += maximum > 0.04 ? chroma / maximum : 0;
    dark += maximum < 0.026 ? 1 : 0;
    bright += maximum > 0.988 ? 1 : 0;
    count++;
    if (value > 0.14 && value < 0.92 && chroma < 0.18) {
      const weight = (1 - chroma / 0.18) ** 2;
      weightedCast += weight;
      temperature += (red - blue) * weight;
      tint += (green - (red + blue) * 0.5) * weight;
    }
  }
  const quantile = (fraction, fallback) => {
    if (!count) return fallback;
    let accumulated = 0;
    for (let index = 0; index < histogram.length; index++) {
      accumulated += histogram[index];
      if (accumulated >= count * fraction) return index / 255;
    }
    return 1;
  };
  const lowLuminance = quantile(0.06, 0.1);
  const highLuminance = quantile(0.94, 0.9);
  const castConfidence = count ? Math.min(1, weightedCast / (count * 0.15)) : 0;
  return {
    width, height, count, histogram, lowLuminance, highLuminance,
    meanLuminance: count ? luminance / count : 0.5,
    medianLuminance: quantile(0.5, 0.5),
    dynamicRange: highLuminance - lowLuminance,
    meanSaturation: count ? saturation / count : 0,
    shadowClipping: count ? dark / count : 0,
    highlightClipping: count ? bright / count : 0,
    temperatureCast: weightedCast ? temperature / weightedCast * castConfidence : 0,
    tintCast: weightedCast ? tint / weightedCast * castConfidence : 0,
  };
}

export function autoGrade(imageData, { presetId, strength = 100 } = {}) {
  const analysis = analyzeImage(imageData);
  const template = PRESETS.find(preset => preset.id === presetId);
  const settings = applyPreset(template?.id, strength);
  if (!analysis.count) return { settings, analysis, presetId: template?.id ?? null };
  const weight = clamp(numeric(strength, 100) / 100);
  const lowKey = template?.id === 'night' || analysis.medianLuminance < 0.22 && analysis.highLuminance > 0.55;
  const targetMedian = lowKey ? 0.27 : 0.49;
  const brightness = Math.max(0.055, (analysis.meanLuminance + analysis.medianLuminance * 2) / 3);
  const luminanceRatio = gammaToLinear(targetMedian) / gammaToLinear(brightness);
  let exposure = clamp(Math.log2(luminanceRatio) * 0.56, -0.95, 1.25);
  if (exposure > 0 && analysis.highLuminance > 0.92) exposure *= 0.35;
  if (exposure > 0 && lowKey) exposure *= 0.45;

  const corrections = {
    exposure,
    temperature: clamp(-analysis.temperatureCast * 180, -25, 25),
    tint: clamp(-analysis.tintCast * 205, -20, 20),
    contrast: analysis.dynamicRange < 0.6 && analysis.dynamicRange > 0.045
      ? clamp((0.61 - analysis.dynamicRange) * 52, 0, 19)
      : 0,
    highlights: -clamp((analysis.highLuminance - 0.78) * 82 + analysis.highlightClipping * 60, 0, 35),
    shadows: lowKey ? clamp((0.07 - analysis.lowLuminance) * 110, 0, 10)
      : clamp((0.14 - analysis.lowLuminance) * 125, 0, 19),
    blacks: analysis.lowLuminance > 0.22 && analysis.dynamicRange > 0.05
      ? -clamp((analysis.lowLuminance - 0.19) * 66, 0, 14) : 0,
    vibrance: clamp((0.35 - analysis.meanSaturation) * 40, -10, 11),
  };
  for (const [key, value] of Object.entries(corrections)) {
    const limit = key === 'exposure' ? 3 : 100;
    settings[key] = round(clamp(settings[key] + value * weight, -limit, limit), key === 'exposure' ? 2 : 0);
  }
  return { settings, analysis, presetId: template?.id ?? null };
}

function readTriplet(values, line) {
  if (values.length !== 3) throw new Error(`第 ${line} 行需要三个数值。`);
  const parsed = values.map(Number);
  if (parsed.some(value => !Number.isFinite(value))) {
    throw new Error(`第 ${line} 行数值无效。`);
  }
  return parsed;
}

export function parseCube(text) {
  let title = '';
  let size = 0;
  let size1D = 0;
  let domainMin = [0, 0, 0];
  let domainMax = [1, 1, 1];
  let domainMin1D;
  let domainMax1D;
  let domainMin3D;
  let domainMax3D;
  const entries = [];

  String(text).replace(/^\uFEFF/, '').split(/\r?\n/).forEach((line, index) => {
    const number = index + 1;
    const content = line.replace(/#(?=(?:[^"]*"[^"]*")*[^"]*$).*/, '').trim();
    if (!content) return;
    const [header, ...values] = content.split(/\s+/);
    if (header === 'TITLE') {
      title = values.join(' ').replace(/^"|"$/g, '');
    } else if (header === 'LUT_3D_SIZE' || header === 'LUT_1D_SIZE') {
      const value = Number(values[0]);
      const max = header === 'LUT_3D_SIZE' ? 128 : 65536;
      if (values.length !== 1 || !Number.isInteger(value) || value < 2 || value > max) {
        throw new Error(`第 ${number} 行 LUT 尺寸无效。`);
      }
      if (header === 'LUT_3D_SIZE') size = value;
      else size1D = value;
    } else if (header === 'DOMAIN_MIN' || header === 'DOMAIN_MAX') {
      const triplet = readTriplet(values, number);
      if (header === 'DOMAIN_MIN') domainMin = triplet;
      else domainMax = triplet;
    } else if (header === 'LUT_1D_INPUT_RANGE' || header === 'LUT_3D_INPUT_RANGE') {
      const [min, max] = values.map(Number);
      if (values.length !== 2 || !Number.isFinite(min) || !Number.isFinite(max) || min >= max) {
        throw new Error(`第 ${number} 行 LUT 输入范围无效。`);
      }
      if (header === 'LUT_1D_INPUT_RANGE') {
        domainMin1D = [min, min, min];
        domainMax1D = [max, max, max];
      } else {
        domainMin3D = [min, min, min];
        domainMax3D = [max, max, max];
      }
    } else {
      const triplet = readTriplet([header, ...values], number);
      entries.push(...triplet);
    }
  });

  if (!size && !size1D) throw new Error('缺少 LUT_3D_SIZE 或 LUT_1D_SIZE。');
  if (entries.length !== 3 * (size ** 3 + size1D)) throw new Error('LUT 条目数量与声明的尺寸不一致。');
  if (domainMin.some((min, channel) => min >= domainMax[channel])) throw new Error('LUT 输入范围无效。');
  const shaper = size1D ? {
    size: size1D,
    data: Float32Array.from(entries.slice(0, size1D * 3)),
    domainMin: domainMin1D ?? domainMin,
    domainMax: domainMax1D ?? domainMax,
  } : null;

  return {
    size,
    title,
    data: Float32Array.from(entries.slice(size1D * 3)),
    domainMin: domainMin3D ?? (shaper ? [0, 0, 0] : domainMin),
    domainMax: domainMax3D ?? (shaper ? [1, 1, 1] : domainMax),
    shaper,
  };
}

function prepareLut(lut) {
  const normalize = (reference, minimum) => {
    const limit = reference.size - 1;
    return [0, 1, 2].map(channel => {
      const lower = numeric(reference.domainMin?.[channel]);
      const upper = numeric(reference.domainMax?.[channel], 1);
      const scale = limit / Math.max(0.00001, upper - lower);
      return minimum ? -lower * scale : scale;
    });
  };
  if (!lut) return null;
  const shaper = lut.shaper ?? (lut.type === '1d' ? lut : null);
  const dimension = lut.type === '1d' ? 0 : lut.size;
  return {
    size: dimension,
    last: dimension - 1,
    data: lut.data,
    scale: dimension ? normalize(lut, false) : null,
    offset: dimension ? normalize(lut, true) : null,
    shaper: shaper ? {
      last: shaper.size - 1,
      data: shaper.data,
      scale: normalize(shaper, false),
      offset: normalize(shaper, true),
    } : null,
  };
}

function interpolateCube(data, index, row, plane, red, green, blue) {
  const first = lerp(
    lerp(data[index], data[index + 3], red),
    lerp(data[index + row], data[index + row + 3], red),
    green,
  );
  const far = index + plane;
  const second = lerp(
    lerp(data[far], data[far + 3], red),
    lerp(data[far + row], data[far + row + 3], red),
    green,
  );
  return lerp(first, second, blue);
}

function sampleLut(color, lut, strength) {
  if (!lut || strength <= 0) return;
  let red = color[0];
  let green = color[1];
  let blue = color[2];
  if (lut.shaper) {
    const { data, last, scale, offset } = lut.shaper;
    const redPosition = clamp(red * scale[0] + offset[0], 0, last);
    const greenPosition = clamp(green * scale[1] + offset[1], 0, last);
    const bluePosition = clamp(blue * scale[2] + offset[2], 0, last);
    const ri = Math.min(last - 1, Math.floor(redPosition));
    const gi = Math.min(last - 1, Math.floor(greenPosition));
    const bi = Math.min(last - 1, Math.floor(bluePosition));
    red = lerp(data[ri * 3], data[(ri + 1) * 3], redPosition - ri);
    green = lerp(data[gi * 3 + 1], data[(gi + 1) * 3 + 1], greenPosition - gi);
    blue = lerp(data[bi * 3 + 2], data[(bi + 1) * 3 + 2], bluePosition - bi);
  }

  if (lut.size) {
    const { size, data, last, scale, offset } = lut;
    const redPosition = clamp(red * scale[0] + offset[0], 0, last);
    const greenPosition = clamp(green * scale[1] + offset[1], 0, last);
    const bluePosition = clamp(blue * scale[2] + offset[2], 0, last);
    const redIndex = Math.min(last - 1, Math.floor(redPosition));
    const greenIndex = Math.min(last - 1, Math.floor(greenPosition));
    const blueIndex = Math.min(last - 1, Math.floor(bluePosition));
    const rd = redPosition - redIndex;
    const gd = greenPosition - greenIndex;
    const bd = bluePosition - blueIndex;
    const origin = (redIndex + greenIndex * size + blueIndex * size * size) * 3;
    const row = size * 3;
    const plane = size * row;
    red = interpolateCube(data, origin, row, plane, rd, gd, bd);
    green = interpolateCube(data, origin + 1, row, plane, rd, gd, bd);
    blue = interpolateCube(data, origin + 2, row, plane, rd, gd, bd);
  }

  color[0] = lerp(color[0], clamp(red), strength);
  color[1] = lerp(color[1], clamp(green), strength);
  color[2] = lerp(color[2], clamp(blue), strength);
}

const TABLE_LAST = 2048;
const table = map => Float32Array.from({ length: TABLE_LAST + 1 }, (_, index) => map(index / TABLE_LAST));

function lookup(values, value) {
  const position = clamp(value) * TABLE_LAST;
  const index = Math.min(TABLE_LAST - 1, Math.floor(position));
  return lerp(values[index], values[index + 1], position - index);
}

function compileCurve(points) {
  if (!Array.isArray(points) || points.length < 2) return null;
  const byInput = new Map();
  for (const point of points) {
    if (Array.isArray(point) && point.slice(0, 2).length === 2 && point.slice(0, 2).every(Number.isFinite)) {
      byInput.set(clamp(point[0]), clamp(point[1]));
    }
  }
  const ordered = [...byInput].sort((a, b) => a[0] - b[0]);
  if (ordered.length < 2 || ordered.every(([input, output]) => input === output)) return null;
  return table(value => {
    if (value <= ordered[0][0]) return ordered[0][1];
    for (let index = 1; index < ordered.length; index++) {
      const [high, highValue] = ordered[index];
      if (value > high) continue;
      const [low, lowValue] = ordered[index - 1];
      return lerp(lowValue, highValue, (value - low) / (high - low));
    }
    return ordered.at(-1)[1];
  });
}

function compileHsl(settings) {
  if (!settings) return null;
  const adjustments = RANGE_NAMES.map(range => {
    const values = settings[range] ?? {};
    return [
      clamp(numeric(values.hue), -180, 180),
      clamp(numeric(values.saturation) / 100, -1, 1),
      clamp(numeric(values.luminance) / 100, -1, 1),
    ];
  });
  if (!adjustments.some(range => range.some(Boolean))) return null;
  const hueMap = new Float32Array(361 * 3);
  let rangeIndex = 0;
  for (let angle = 0; angle <= 360; angle++) {
    if (angle > HUE_CENTERS[rangeIndex + 1]) rangeIndex++;
    const left = adjustments[rangeIndex];
    const right = adjustments[(rangeIndex + 1) % adjustments.length];
    const position = (angle - HUE_CENTERS[rangeIndex]) / (HUE_CENTERS[rangeIndex + 1] - HUE_CENTERS[rangeIndex]);
    const weight = position * position * (3 - 2 * position);
    for (let i = 0; i < 3; i++) hueMap[3 * angle + i] = lerp(left[i], right[i], weight);
  }
  return hueMap;
}

function shiftHsl(color, hueMap, globalHue) {
  let red = color[0];
  let green = color[1];
  let blue = color[2];
  const maximum = Math.max(red, green, blue);
  const minimum = Math.min(red, green, blue);
  const delta = maximum - minimum;
  if (delta < 0.00015) return;
  let hue = 60 * (maximum === red ? ((green - blue) / delta) % 6
    : maximum === green ? (blue - red) / delta + 2
    : (red - green) / delta + 4);
  if (hue < 0) hue += 360;
  let light = (maximum + minimum) * 0.5;
  let saturation = delta / Math.max(0.0001, 1 - Math.abs(light * 2 - 1));
  if (hueMap) {
    const angle = Math.min(359, Math.floor(hue));
    const blend = hue - angle;
    const hueShift = lerp(hueMap[angle * 3], hueMap[angle * 3 + 3], blend);
    const satShift = lerp(hueMap[angle * 3 + 1], hueMap[angle * 3 + 4], blend);
    const lightShift = lerp(hueMap[angle * 3 + 2], hueMap[angle * 3 + 5], blend);
    const colorWeight = clamp(delta * 8);
    hue += hueShift * colorWeight;
    saturation = clamp(saturation + satShift * (satShift > 0 ? 1 - saturation : saturation) * colorWeight);
    light = clamp(light + lightShift * 0.46 * colorWeight * (lightShift > 0 ? 1 - light : light));
  }
  hue = ((hue + globalHue + 720) % 360) / 60;
  const chroma = (1 - Math.abs(2 * light - 1)) * saturation;
  const secondary = chroma * (1 - Math.abs(hue % 2 - 1));
  const offset = light - chroma * 0.5;
  const sector = Math.floor(hue);
  red = sector === 0 || sector === 5 ? chroma : sector === 1 || sector === 4 ? secondary : 0;
  green = sector === 1 || sector === 2 ? chroma : sector === 0 || sector === 3 ? secondary : 0;
  blue = sector === 3 || sector === 4 ? chroma : sector === 2 || sector === 5 ? secondary : 0;
  color[0] = red + offset;
  color[1] = green + offset;
  color[2] = blue + offset;
}

function compileSettings(settings) {
  const value = key => clamp(numeric(settings?.[key]) / 100, -1, 1);
  const exposure = clamp(numeric(settings?.exposure), -3, 3);
  const temperature = value('temperature');
  const tint = value('tint');
  const contrast = value('contrast');
  const highlights = value('highlights');
  const shadows = value('shadows');
  const whites = value('whites');
  const blacks = value('blacks');
  const saturation = value('saturation');
  const vibrance = value('vibrance');
  const dehaze = value('dehaze');
  const fade = clamp(value('fade'));
  const clarity = value('clarity');
  const sharpen = clamp(value('sharpen'));
  const vignette = value('vignette');
  const grain = clamp(value('grain'));
  const hue = clamp(numeric(settings?.hue), -180, 180);
  const hsl = compileHsl(settings?.hsl);
  const curve = settings?.curve;
  const masterCurve = compileCurve(Array.isArray(curve) ? curve : curve?.rgb);
  const channelCurves = ['red', 'green', 'blue'].map(channel => compileCurve(curve?.[channel]));

  const balanceFactors = [exposure + temperature * 0.43 + tint * 0.14,
    exposure - tint * 0.36, exposure - temperature * 0.58 + tint * 0.14];
  const balanceTables = balanceFactors.map(amount => {
    if (!amount) return null;
    const multiplier = 2 ** amount;
    return table(value => {
      const linear = gammaToLinear(value);
      const boosted = linear * multiplier;
      // A rational shoulder keeps positive exposure monotonic and rolls smoothly into white.
      return linearToGamma(amount < 0 ? boosted : boosted / (1 + linear * (multiplier - 1)));
    });
  });

  const toneTable = contrast || highlights || shadows || whites || blacks || dehaze || fade ? table(y => {
    const softShadow = 4 * y * (1 - y) ** 3;
    const softHighlight = 4 * y ** 3 * (1 - y);
    const subtleDehaze = dehaze * 0.13 * (2 * y - 1);
    const contrastOffset = contrast * (y - 0.5) * (0.9 - 0.68 * Math.abs(2 * y - 1));
    let result = y + contrastOffset + subtleDehaze;
    result += shadows * 0.66 * softShadow + highlights * 0.66 * softHighlight;
    result += blacks * 0.23 * (1 - y) ** 4 + whites * 0.23 * y ** 4;
    return clamp(lerp(result, 0.079 + result * 0.86, fade));
  }) : null;

  return {
    balanceTables, toneTable, saturation, vibrance, hue, hsl, masterCurve, channelCurves,
    clarity, sharpen, vignette, grain,
    active: !!(balanceTables.some(Boolean) || toneTable || saturation || vibrance || hue || hsl ||
      masterCurve || channelCurves.some(Boolean) || clarity || sharpen || vignette || grain),
  };
}

function paint(color, grade, claritySignal, sharpenSignal, distance, noise) {
  for (let channel = 0; channel < 3; channel++) {
    const value = grade.balanceTables[channel];
    if (value) color[channel] = lookup(value, color[channel]);
  }
  if (grade.toneTable || grade.clarity || grade.sharpen || grade.vignette || grade.grain) {
    const oldTone = luma(color[0], color[1], color[2]);
    let newTone = grade.toneTable ? lookup(grade.toneTable, oldTone) : oldTone;
    newTone += claritySignal * grade.clarity * 0.85 + sharpenSignal * grade.sharpen * 0.65;
    const vignetteWeight = distance * Math.abs(grade.vignette) * 0.43;
    newTone = lerp(newTone, grade.vignette > 0 ? 1 : 0, vignetteWeight) + noise * grade.grain * 0.1;
    newTone = clamp(newTone);
    if (newTone > oldTone) {
      const weight = (newTone - oldTone) / Math.max(0.00001, 1 - oldTone);
      for (let channel = 0; channel < 3; channel++) color[channel] = lerp(color[channel], 1, weight);
    } else if (newTone < oldTone) {
      const weight = newTone / Math.max(0.00001, oldTone);
      for (let channel = 0; channel < 3; channel++) color[channel] *= weight;
    }
  }
  if (grade.saturation || grade.vibrance) {
    const tone = luma(color[0], color[1], color[2]);
    const chroma = Math.max(color[0], color[1], color[2]) - Math.min(color[0], color[1], color[2]);
    const weight = 1 + grade.saturation + grade.vibrance * (1 - chroma) * 0.72;
    for (let channel = 0; channel < 3; channel++) color[channel] = clamp(tone + (color[channel] - tone) * weight);
  }
  if (grade.hue || grade.hsl) shiftHsl(color, grade.hsl, grade.hue);
  for (let channel = 0; channel < 3; channel++) {
    if (grade.masterCurve) color[channel] = lookup(grade.masterCurve, color[channel]);
    const curve = grade.channelCurves[channel];
    if (curve) color[channel] = lookup(curve, color[channel]);
  }
}

function blurLuminance(source, width, height, radius) {
  const across = new Float32Array(source.length);
  const output = new Float32Array(source.length);
  const divisor = 2 * radius + 1;
  for (let row = 0; row < height; row++) {
    const first = row * width;
    let sum = source[first] * radius;
    for (let col = 0; col <= radius; col++) sum += source[first + Math.min(width - 1, col)];
    for (let col = 0; col < width; col++) {
      across[first + col] = sum / divisor;
      sum += source[first + Math.min(width - 1, col + radius + 1)] - source[first + Math.max(0, col - radius)];
    }
  }
  for (let col = 0; col < width; col++) {
    let sum = across[col] * radius;
    for (let row = 0; row <= radius; row++) sum += across[Math.min(height - 1, row) * width + col];
    for (let row = 0; row < height; row++) {
      output[row * width + col] = sum / divisor;
      sum += across[Math.min(height - 1, row + radius + 1) * width + col] - across[Math.max(0, row - radius) * width + col];
    }
  }
  return output;
}

function prepareMask(mask, pixelCount) {
  if (!mask) return null;
  if (mask.length === pixelCount) return mask;
  const pixels = mask.data ?? mask;
  if (pixels?.length !== pixelCount * 4) throw new RangeError('蒙版尺寸必须与照片一致。');
  return Uint8Array.from({ length: pixelCount }, (_, index) => pixels[index * 4 + 3]);
}

export function renderGrade(imageData, settings = DEFAULT_SETTINGS, {
  layers = [], lut = null, lutStrength = 100, baseLut = null, baseLutStrength = 100,
} = {}) {
  checkPixels(imageData);
  const { width, height, data } = imageData;
  const grade = compileSettings(settings);
  const pixelCount = width * height;
  const localGrades = layers
    .filter(layer => layer?.mask && layer.visible !== false && numeric(layer.opacity, 100) > 0)
    .map(layer => ({
      grade: compileSettings(layer.settings),
      mask: prepareMask(layer.mask, pixelCount),
      amount: clamp(numeric(layer.opacity, 100) / 100),
      invert: !!layer.invert,
    }))
    .filter(layer => layer.grade.active);
  const baseWeight = baseLut ? clamp(numeric(baseLutStrength, 100) / 100) : 0;
  const lutWeight = lut ? clamp(numeric(lutStrength, 100) / 100) : 0;
  const baseTable = baseWeight ? prepareLut(baseLut) : null;
  const userTable = lutWeight ? prepareLut(lut) : null;
  const pixels = new Uint8ClampedArray(data);
  const finish = () => typeof ImageData === 'function' ? new ImageData(pixels, width, height)
    : { data: pixels, width, height };
  if (!grade.active && !localGrades.length && !baseTable && !userTable) return finish();

  const grades = [grade, ...localGrades.map(layer => layer.grade)];
  const useClarity = grades.some(g => g.clarity);
  const useSharpen = grades.some(g => g.sharpen);
  const useVignette = grades.some(g => g.vignette);
  const useGrain = grades.some(g => g.grain);
  const tone = useClarity || useSharpen ? new Float32Array(pixelCount) : null;
  if (tone) {
    for (let index = 0; index < pixelCount; index++) {
      const byte = index * 4;
      tone[index] = luma(data[byte], data[byte + 1], data[byte + 2]) / 255;
    }
  }
  const wideRadius = clamp(Math.round(Math.min(width, height) / 100), 2, 28);
  const blurred = useClarity ? blurLuminance(tone, width, height, wideRadius) : null;
  const color = new Float64Array(3);
  const rowDenominator = Math.max(height - 1, 1);
  const columnDenominator = Math.max(width - 1, 1);
  for (let row = 0; row < height; row++) {
    const verticalDistance = height === 1 ? 0 : (2 * row / rowDenominator - 1) ** 2;
    const above = Math.max(0, row - 1) * width;
    const below = Math.min(height - 1, row + 1) * width;
    for (let col = 0; col < width; col++) {
      const index = row * width + col;
      const offset = index * 4;
      if (!data[offset + 3]) continue;
      let distance = 0;
      let noise = 0;
      if (useVignette) {
        const horizontalDistance = width === 1 ? 0 : (2 * col / columnDenominator - 1) ** 2;
        const edge = clamp((verticalDistance + horizontalDistance - 0.19) * 0.60);
        distance = edge * edge * (3 - 2 * edge);
      }
      if (useGrain) {
        let hash = Math.imul(index ^ 1396451, 0x45d9f3b);
        hash = Math.imul(hash ^ (hash >>> 16), 0x45d9f3b);
        noise = ((hash ^ (hash >>> 16)) & 255) / 255 - 0.5;
      }
      const claritySignal = blurred ? clamp(tone[index] - blurred[index], -0.22, 0.22) : 0;
      const left = col > 0 ? index - 1 : index;
      const right = col + 1 < width ? index + 1 : index;
      const sharpenSignal = useSharpen ? tone[index] - 0.25 * (
        tone[above + col] + tone[below + col] + tone[left] + tone[right]
      ) : 0;
      color[0] = data[offset] / 255;
      color[1] = data[offset + 1] / 255;
      color[2] = data[offset + 2] / 255;
      sampleLut(color, baseTable, baseWeight);
      if (grade.active) paint(color, grade, claritySignal, sharpenSignal, distance, noise);
      sampleLut(color, userTable, lutWeight);

      for (const layer of localGrades) {
        const maskValue = (layer.invert ? 255 - layer.mask[index] : layer.mask[index]) / 255 * layer.amount;
        if (maskValue <= 0) continue;
        const red = color[0];
        const green = color[1];
        const blue = color[2];
        paint(color, layer.grade, claritySignal, sharpenSignal, distance, noise);
        color[0] = lerp(red, color[0], maskValue);
        color[1] = lerp(green, color[1], maskValue);
        color[2] = lerp(blue, color[2], maskValue);
      }
      pixels[offset] = clamp(color[0]) * 255;
      pixels[offset + 1] = clamp(color[1]) * 255;
      pixels[offset + 2] = clamp(color[2]) * 255;
    }
  }
  return finish();
}
