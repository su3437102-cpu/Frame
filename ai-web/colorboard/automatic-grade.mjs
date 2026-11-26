import { renderGrade } from './grade-engine.mjs';
import { toLab } from './look-extractor.mjs';

const clamp = (value, low = 0, high = 1) => Math.max(low, Math.min(high, value));
const linear = value => value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4;
const encoded = value => value <= .0031308 ? 12.92 * value : 1.055 * value ** (1 / 2.4) - .055;
const luminance = (r, g, b) => .2126 * r + .7152 * g + .0722 * b;
const decodeByte = Float64Array.from({ length: 256 }, (_, code) => linear(code / 255));
const opaque = 243;
const hueTolerance = Math.cos(8 * Math.PI / 180);

function lightCode(pixels, offset) {
  return Math.round(255 * encoded(luminance(decodeByte[pixels[offset]],
    decodeByte[pixels[offset + 1]], decodeByte[pixels[offset + 2]])));
}

function profile({ data }) {
  const histogram = new Uint32Array(256);
  let count = 0, clipped = 0;
  for (let offset = 0; offset < data.length; offset += 4) {
    if (data[offset + 3] < opaque) continue;
    histogram[lightCode(data, offset)]++;
    count++;
    const r = data[offset], g = data[offset + 1], b = data[offset + 2];
    if (Math.min(r, g, b) >= 254 || Math.max(r, g, b) <= 1) clipped++;
  }
  const at = fraction => {
    let total = 0;
    for (let code = 0; code < histogram.length; code++) {
      total += histogram[code];
      if (total >= count * fraction) return code / 255;
    }
  };
  const p05 = at(.05), p95 = at(.95);
  return { count, p05, p50: at(.5), p95, p99: at(.99), span: p95 - p05,
    clipped: clipped / Math.max(count, 1), occupied: histogram.filter(Boolean).length };
}

function chooseTarget({ count, p05, p50, p95, p99, span, clipped, occupied }) {
  if (count < 256 || occupied < 16 || p50 < .23 || p50 > .77 || span < .30 || clipped > .18) return null;
  if (p50 < .28) return { key: 'p50', direction: 1, label: '轻提中间调' };
  if (p50 > .72) return { key: 'p50', direction: -1, label: '轻收中间调' };
  if (p99 > .96 && p95 > .88) return { key: 'p95', direction: -1, label: '轻收高光' };
  if (p05 > .015 && p05 < .10 && p95 > .50) return { key: 'p05', direction: 1, label: '轻提暗部' };
  return null;
}

function toneWeight(key, light) {
  if (key === 'p05') return clamp(light / .06) * clamp((.48 - light) / .38) ** 2;
  if (key === 'p95') return clamp((light - .55) / .35) ** 2 * clamp((1 - light) / .04);
  return Math.sin(Math.PI * light);
}

function buildLut(target, model, amount) {
  // Use the learned tone direction as a suggestion. The mapping scales
  // linear RGB together, preserving hue without inferring a neutral surface.
  const size = model?.size ?? 33;
  const last = size - 1;
  const data = new Float32Array(size ** 3 * 3);
  const levels = Array.from({ length: size }, (_, index) => linear(index / last));
  for (let blue = 0, offset = 0; blue < size; blue++) {
    for (let green = 0; green < size; green++) {
      for (let red = 0; red < size; red++, offset += 3) {
        const r = levels[red], g = levels[green], b = levels[blue];
        const y = luminance(r, g, b);
        const light = encoded(y);
        const learned = model ? encoded(luminance(linear(clamp(model.data[offset])),
          linear(clamp(model.data[offset + 1])), linear(clamp(model.data[offset + 2])))) - light : 0;
        const limit = .046 * amount * toneWeight(target.key, light);
        const proposal = model ? clamp(.65 + target.direction * learned * 9, .5, 1) : .75;
        const desired = linear(clamp(light + limit * target.direction * proposal));
        // Uniform gamut limiting also leaves already clipped color ratios intact.
        const gain = y ? Math.min(desired / y, 1 / Math.max(r, g, b)) : 1;
        data[offset] = encoded(r * gain);
        data[offset + 1] = encoded(g * gain);
        data[offset + 2] = encoded(b * gain);
      }
    }
  }
  return { size, data, domainMin: [0, 0, 0], domainMax: [1, 1, 1], title: 'FrameLab Natural Auto' };
}

function respectsClippingAndPalette({ data: before }, { data: after }, count) {
  let highAny = 0, highAll = 0, lowAny = 0, lowAll = 0;
  let sampled = 0, chromatic = 0, hueChanges = 0, chromaChanges = 0, neutralChanges = 0;
  const stride = 4 * Math.max(1, Math.floor(before.length / (4 * 16000)));
  for (let offset = 0; offset < before.length; offset += 4) {
    if (before[offset + 3] < opaque) continue;
    let nowHigh = 0, wasHigh = 0, nowLow = 0, wasLow = 0, newHigh = false, newLow = false;
    for (let channel = offset; channel < offset + 3; channel++) {
      const old = before[channel], next = after[channel];
      if (next >= 254) { nowHigh++; newHigh ||= old < 254; }
      if (next <= 1) { nowLow++; newLow ||= old > 1; }
      wasHigh += Number(old >= 254);
      wasLow += Number(old <= 1);
    }
    highAny += Number(newHigh);
    lowAny += Number(newLow);
    highAll += Number(nowHigh === 3 && wasHigh < 3);
    lowAll += Number(nowLow === 3 && wasLow < 3);
    if (offset % stride) continue;
    sampled++;
    const [, a, b] = toLab(decodeByte[before[offset]], decodeByte[before[offset + 1]], decodeByte[before[offset + 2]]);
    const [, nextA, nextB] = toLab(decodeByte[after[offset]], decodeByte[after[offset + 1]], decodeByte[after[offset + 2]]);
    const c = Math.hypot(a, b), nextC = Math.hypot(nextA, nextB);
    if (c < .012 && nextC > .025) neutralChanges++;
    if (c < .035) continue;
    chromatic++;
    if (a * nextA + b * nextB < c * nextC * hueTolerance) hueChanges++;
    if (nextC < c * .8 || nextC > c * 1.2) chromaChanges++;
  }
  return highAny <= count * .001 && lowAny <= count * .001 && highAll <= count * .0003 && lowAll <= count * .001
    && hueChanges <= chromatic * .015 && chromaChanges <= chromatic * .025 && neutralChanges <= sampled * .005;
}

function sample(image) {
  const step = Math.max(1, Math.ceil(Math.max(image.width, image.height) / 400));
  if (step === 1) return image;
  const width = Math.ceil(image.width / step), height = Math.ceil(image.height / step);
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const offset = 4 * (y * step * image.width + x * step);
      data.set(image.data.subarray(offset, offset + 4), 4 * (y * width + x));
    }
  }
  return { width, height, data };
}

function passes(image, before, lut, target) {
  const rendered = renderGrade(image, undefined, { baseLut: lut });
  const after = profile(rendered);
  return target.direction * (after[target.key] - before[target.key]) >= .0075
    && Math.abs(after.p50 - before.p50) <= .038 && after.span >= before.span - .035
    && respectsClippingAndPalette(image, rendered, before.count);
}

export function planAutomaticGrade(image, model) {
  const before = profile(image);
  const target = chooseTarget(before);
  if (!target) return { lut: null };
  const thumbnail = sample(image);
  const small = thumbnail === image ? before : profile(thumbnail);
  for (const amount of [.75, .5, .25]) {
    const lut = buildLut(target, model, amount);
    if (passes(thumbnail, small, lut, target) && (thumbnail === image || passes(image, before, lut, target))) {
      return { lut, label: target.label };
    }
  }
  return { lut: null };
}
