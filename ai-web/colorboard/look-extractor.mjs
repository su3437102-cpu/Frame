// A single reference supplies a look, not the exposure or white balance of an unobserved original.
// Use restrained OKLab statistics and a fixed mapping so the same template applies consistently.
const SAMPLE_BUDGET = 24_000;
const LUT_SIZE = 33;
const TONE_CENTERS = [0.22, 0.51, 0.79];
const LIMITS = {
  exposure: [-0.13, 0.13],
  contrast: [-0.25, 0.25],
  blackLift: [-0.035, 0.075],
  highlightRoll: [-0.025, 0.075],
  saturation: [-1, 0.34],
  tint: [-0.045, 0.045],
};

function clamp(value, min = 0, max = 1) {
  return Math.max(min, Math.min(value, max));
}

function blend(from, to, weight) {
  return from + (to - from) * weight;
}

function smoothstep(low, high, value) {
  const x = clamp((value - low) / (high - low));
  return x * x * (3 - 2 * x);
}

function linearize(value) {
  return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
}

function encode(value) {
  const clipped = clamp(value);
  return clipped <= 0.0031308 ? clipped * 12.92 : 1.055 * clipped ** (1 / 2.4) - 0.055;
}

// OKLab's axes let us estimate color bias without confusing saturation with brightness.
export function toLab(red, green, blue) {
  const l = Math.cbrt(0.4122214708 * red + 0.5363325363 * green + 0.0514459929 * blue);
  const m = Math.cbrt(0.2119034982 * red + 0.6806995451 * green + 0.1073969566 * blue);
  const s = Math.cbrt(0.0883024619 * red + 0.2817188376 * green + 0.6299787005 * blue);
  return [
    0.2104542553 * l + 0.7936177850 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.4285922050 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * s,
  ];
}

function fromLab(light, a, b) {
  const l = (light + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (light - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (light - 0.0894841775 * a - 1.2914855480 * b) ** 3;
  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s,
  ];
}

const LINEAR_BYTE = Float64Array.from({ length: 256 }, (_, index) => linearize(index / 255));

function skinLikelihood(light, a, b, chroma) {
  if (a <= 0 || b <= 0 || chroma < 0.022 || light < 0.27 || light > 0.94) return 0;
  const angle = Math.atan2(b, a);
  const hueBand = smoothstep(0.24, 0.49, angle) * (1 - smoothstep(0.97, 1.32, angle));
  const chromaBand = smoothstep(0.022, 0.054, chroma) * (1 - smoothstep(0.13, 0.20, chroma));
  return hueBand * chromaBand * smoothstep(0.27, 0.42, light) * (1 - smoothstep(0.83, 0.94, light));
}

function quantile(sorted, proportion) {
  const position = proportion * (sorted.length - 1);
  const low = Math.floor(position);
  return blend(sorted[low], sorted[Math.min(low + 1, sorted.length - 1)], position - low);
}

function toneWeights(light) {
  const middle = TONE_CENTERS[1];
  if (light <= middle) {
    const weight = smoothstep(TONE_CENTERS[0], middle, light);
    return [1 - weight, weight, 0];
  }
  const weight = smoothstep(middle, TONE_CENTERS[2], light);
  return [0, 1 - weight, weight];
}

function estimateTint(tones, neutralConfidence) {
  const pooled = tones.reduce((total, tone) => ({
    a: total.a + tone.a, b: total.b + tone.b,
    weight: total.weight + tone.weight,
  }), { a: 0, b: 0, weight: 0 });
  const typicalA = pooled.weight ? pooled.a / pooled.weight : 0;
  const typicalB = pooled.weight ? pooled.b / pooled.weight : 0;
  return tones.map(tone => {
    const coverage = tone.weight / Math.max(1, tone.count);
    const reliability = smoothstep(0.07, 0.5, coverage);
    const localBalance = smoothstep(18, 150, tone.weight) * reliability;
    // Back off when the reference has no representative shadows, mids, or highlights.
    const a = blend(typicalA * 0.45, tone.a / Math.max(1, tone.weight), localBalance);
    const b = blend(typicalB * 0.45, tone.b / Math.max(1, tone.weight), localBalance);
    const amount = 0.70 * neutralConfidence;
    return [a * amount, b * amount];
  });
}

function bounded(value, field) {
  const [min, max] = LIMITS[field];
  return Number(clamp(value, min, max).toFixed(6)) || 0;
}

export function extractReferenceLook(imageData) {
  const { width, height, data } = imageData ?? {};
  if (!Number.isSafeInteger(width) || !Number.isSafeInteger(height) || width < 1 || height < 1 ||
      !(data instanceof Uint8ClampedArray) || data.length !== width * height * 4) {
    throw new TypeError('请使用有效的参考照片。');
  }

  const lightness = [];
  const chromaValues = [];
  const tones = TONE_CENTERS.map(() => ({ a: 0, b: 0, count: 0, weight: 0 }));
  const columns = Math.min(width, SAMPLE_BUDGET, Math.max(1, Math.ceil(Math.sqrt(SAMPLE_BUDGET * width / height))));
  const rows = Math.min(height, Math.max(1, Math.floor(SAMPLE_BUDGET / columns)));
  let neutralPixels = 0;
  let colorPixels = 0;
  for (let row = 0; row < rows; row++) {
    const y = Math.floor((row + 0.5) * height / rows);
    for (let column = 0; column < columns; column++) {
      const x = Math.floor((column + 0.5) * width / columns);
      const pixel = (y * width + x) * 4;
      if (data[pixel + 3] < 128) continue;
      const [light, a, b] = toLab(
        LINEAR_BYTE[data[pixel]], LINEAR_BYTE[data[pixel + 1]], LINEAR_BYTE[data[pixel + 2]]
      );
      lightness.push(light);
      if (light < 0.08 || light > 0.98) continue;
      const chroma = Math.hypot(a, b);
      chromaValues.push(chroma);
      colorPixels++;
      if (chroma <= 0.086) neutralPixels++;

      // Near-neutrals reveal color bias better than a saturated foreground object.
      const reliability = (1 - 0.78 * skinLikelihood(light, a, b, chroma)) / (1 + (chroma / 0.086) ** 4);
      const boundedChroma = Math.min(1, 0.072 / Math.max(chroma, 1e-6));
      const weights = toneWeights(light);
      tones.forEach((tone, index) => {
        const weight = weights[index] * reliability;
        tone.count += weights[index];
        tone.weight += weight;
        tone.a += a * weight * boundedChroma;
        tone.b += b * weight * boundedChroma;
      });
    }
  }
  if (!lightness.length) throw new Error('参考照片里没有可分析的不透明区域。');
  lightness.sort((a, b) => a - b);
  chromaValues.sort((a, b) => a - b);

  const q = proportion => quantile(lightness, proportion);
  const span = q(0.92) - q(0.08);
  // Low information photos (a flat wall, white background or tiny image) get softer adjustments.
  const evidence = smoothstep(0.05, 0.38, span) * smoothstep(1, 150, lightness.length);
  const neutralConfidence = 0.35 + 0.65 * smoothstep(0.08, 0.68, neutralPixels / Math.max(1, colorPixels));
  const exposure = (q(0.5) - 0.58) * 0.62 * evidence;
  const contrast = (span - 0.52) * 0.65 * evidence;
  const blackLift = (q(0.035) - 0.15) * 0.31 * evidence;
  const highlightRoll = (0.9 - q(0.965)) * 0.27 * evidence;
  let saturation = 0;
  if (chromaValues.length) {
    const c60 = quantile(chromaValues, 0.60);
    const c88 = quantile(chromaValues, 0.88);
    const monochrome = 1 - smoothstep(0.013, 0.036, c88);
    const ordinarySaturation = clamp(((c60 * 0.60 + c88 * 0.40) - 0.084) * 4.1, -0.33, 0.34);
    saturation = blend(ordinarySaturation, -1, monochrome) * evidence;
    // Clear black-and-white photographs should stay black-and-white as a style.
    if (c88 < 0.005 && span >= 0.36) saturation = -1;
  }
  const tints = estimateTint(tones, neutralConfidence * smoothstep(2, 210, colorPixels))
    .map(([a, b]) => [bounded(a, 'tint'), bounded(b, 'tint')]);

  return {
    version: 1,
    exposure: bounded(exposure, 'exposure'),
    contrast: bounded(contrast, 'contrast'),
    blackLift: bounded(blackLift, 'blackLift'),
    highlightRoll: bounded(highlightRoll, 'highlightRoll'),
    saturation: bounded(saturation, 'saturation'),
    tints,
  };
}

export function normalizeLookRecipe(candidate) {
  if (!candidate || candidate.version !== 1 || !Array.isArray(candidate.tints) || candidate.tints.length !== 3) {
    throw new TypeError('无法识别这个调色模板。');
  }
  const validate = (value, field) => {
    const [min, max] = LIMITS[field];
    if (!Number.isFinite(value) || value < min || value > max) throw new RangeError('调色模板中包含无效的参数。');
    return bounded(value, field);
  };
  return {
    version: 1,
    exposure: validate(candidate.exposure, 'exposure'),
    contrast: validate(candidate.contrast, 'contrast'),
    blackLift: validate(candidate.blackLift, 'blackLift'),
    highlightRoll: validate(candidate.highlightRoll, 'highlightRoll'),
    saturation: validate(candidate.saturation, 'saturation'),
    tints: Array.from(candidate.tints, entry => {
      if (!Array.isArray(entry) || entry.length !== 2) throw new TypeError('调色模板的色彩分区无效。');
      return [validate(entry[0], 'tint'), validate(entry[1], 'tint')];
    }),
  };
}

function inGamut(rgb) {
  return rgb.every(channel => channel >= -1e-6 && channel <= 1 + 1e-6);
}

function limitToGamut(light, a, b) {
  let rgb = fromLab(light, a, b);
  if (inGamut(rgb)) return rgb;

  // Reduce chroma along the same hue rather than clipping individual RGB channels.
  let low = 0;
  let high = 1;
  for (let iteration = 0; iteration < 8; iteration++) {
    const candidate = (low + high) * 0.5;
    rgb = fromLab(light, a * candidate, b * candidate);
    if (inGamut(rgb)) low = candidate;
    else high = candidate;
  }
  return fromLab(light, a * low, b * low);
}

function applyLook(linearRed, linearGreen, linearBlue, recipe) {
  const [light, a, b] = toLab(linearRed, linearGreen, linearBlue);
  const middle = 4 * light * (1 - light);
  const gradedLight = clamp(light + recipe.exposure * middle +
    recipe.contrast * (light - 0.5) * middle +
    recipe.blackLift * (1 - light) ** 5 -
    recipe.highlightRoll * light ** 5);

  const chroma = Math.hypot(a, b);
  const skin = skinLikelihood(light, a, b, chroma);
  const saturation = recipe.saturation <= 0 ? 1 + recipe.saturation : 1 +
    recipe.saturation * (1 - 0.50 * skin) * (1 - 0.62 * smoothstep(0.09, 0.25, chroma));
  const weights = toneWeights(light);
  const tintGuard = smoothstep(0.01, 0.15, light) * (1 - smoothstep(0.83, 0.996, light)) *
    (1 - 0.58 * skin) * (1 - 0.60 * smoothstep(0.087, 0.24, chroma));
  const shadowTint = recipe.tints[0];
  const midTint = recipe.tints[1];
  const highlightTint = recipe.tints[2];
  const tintA = (shadowTint[0] * weights[0] + midTint[0] * weights[1] + highlightTint[0] * weights[2]) * tintGuard;
  const tintB = (shadowTint[1] * weights[0] + midTint[1] * weights[1] + highlightTint[1] * weights[2]) * tintGuard;
  return limitToGamut(gradedLight, a * saturation + tintA, b * saturation + tintB);
}

export function lookToLut(candidate) {
  const recipe = normalizeLookRecipe(candidate);
  const size = LUT_SIZE;
  const linearValues = Float64Array.from({ length: size }, (_, index) => linearize(index / (size - 1)));
  const data = new Float32Array(size ** 3 * 3);
  let offset = 0;
  for (const blue of linearValues) {
    for (const green of linearValues) {
      for (const red of linearValues) {
        const [mappedRed, mappedGreen, mappedBlue] = applyLook(red, green, blue, recipe);
        data[offset++] = encode(mappedRed);
        data[offset++] = encode(mappedGreen);
        data[offset++] = encode(mappedBlue);
      }
    }
  }
  return { size, data, domainMin: [0, 0, 0], domainMax: [1, 1, 1], title: '参考照片调色' };
}

export function lookSwatches(candidate) {
  const recipe = normalizeLookRecipe(candidate);
  return [0.26, 0.49, 0.75].map(gray => {
    const linear = linearize(gray);
    const channels = applyLook(linear, linear, linear, recipe);
    return '#' + channels.map(channel => Math.round(encode(channel) * 255).toString(16).padStart(2, '0')).join('');
  });
}
