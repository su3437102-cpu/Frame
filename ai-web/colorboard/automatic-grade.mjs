import { renderGrade } from './grade-engine.mjs';
import { toLab } from './look-extractor.mjs';

const clamp = (value, low = 0, high = 1) => Math.max(low, Math.min(high, value));
const linear = value => value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4;
const encoded = value => value <= .0031308 ? 12.92 * value : 1.055 * value ** (1 / 2.4) - .055;
const luminance = (r, g, b) => .2126 * r + .7152 * g + .0722 * b;
const decodeByte = Float64Array.from({ length: 256 }, (_, code) => linear(code / 255));
const opaque = 243;
const hueTolerance = Math.cos(8 * Math.PI / 180);
// These are working ranges for a natural SDR starting point, in sRGB-encoded luminance.
const toneBands = [
  { key: 'p01', low: .04, high: .12, maxMove: .34 },
  { key: 'p50', low: .35, high: .65, maxMove: .30 },
  { key: 'p99', low: .88, high: .97, maxMove: .34 }
];
const anchorGap = .018;
const maxSlope = 4.2;

function lightCode(pixels, offset) {
  return Math.round(255 * encoded(luminance(decodeByte[pixels[offset]],
    decodeByte[pixels[offset + 1]], decodeByte[pixels[offset + 2]])));
}

function profile({ data }) {
  const histogram = new Uint32Array(256);
  let count = 0;
  for (let offset = 0; offset < data.length; offset += 4) {
    if (data[offset + 3] < opaque) continue;
    histogram[lightCode(data, offset)]++;
    count++;
  }
  const at = fraction => {
    let total = 0;
    for (let code = 0; code < histogram.length; code++) {
      total += histogram[code];
      if (total >= count * fraction) return code / 255;
    }
  };
  const p05 = at(.05), p95 = at(.95);
  return { count, p01: at(.01), p50: at(.5), p99: at(.99), span: p95 - p05,
    occupied: histogram.filter(Boolean).length };
}

function toneAnchors(before) {
  return toneBands.flatMap(band => {
    const input = before[band.key];
    // Saturated endpoints and anchors too close to the median cannot describe independent tones.
    if (input < .008 || input > .992 || (band.key !== 'p50' && Math.abs(input - before.p50) < anchorGap)) return [];
    const desired = clamp(input, band.low, band.high);
    return [{ ...band, input, output: input + clamp(desired - input, -band.maxMove, band.maxMove) }];
  });
}

function toneCurve(anchors, selected, amount) {
  const points = [[0, 0]];
  for (const { key, input, output } of anchors) {
    const [lastInput, lastOutput] = points.at(-1);
    const blend = selected.includes(key) ? amount : 0;
    const min = Math.max(1 - (1 - input) * maxSlope, lastOutput);
    const max = Math.min(lastOutput + (input - lastInput) * maxSlope, 1);
    points.push([input, clamp(input + (output - input) * blend, min, max)]);
  }
  points.push([1, 1]);
  const slopes = points.slice(1).map(([x, y], i) => (y - points[i][1]) / (x - points[i][0]));
  // Harmonic means keep the interpolated curve monotone and smooth between measured anchors.
  const tangents = points.map((_, i) => {
    const a = slopes[i - 1] ?? slopes[i];
    const b = slopes[i] ?? slopes[i - 1];
    return a > 0 && b > 0 ? 2 * a * b / (a + b) : 0;
  });
  const last = 2048;
  const table = Float32Array.from({ length: last + 1 }, (_, index) => {
    const light = index / last;
    const i = points.findIndex(([x]) => x >= light && x > 0) - 1;
    const [x, y] = points[i], [nextX, nextY] = points[i + 1];
    const width = nextX - x;
    const t = (light - x) / width;
    return y + (nextY - y) * (3 - 2 * t) * t * t
      + width * t * (1 - t) * ((1 - t) * tangents[i] - t * tangents[i + 1]);
  });
  return light => {
    const position = light * last;
    const i = Math.min(last - 1, Math.floor(position));
    return table[i] + (table[i + 1] - table[i]) * (position - i);
  };
}

function buildLut(curve) {
  const size = 33;
  const last = size - 1;
  const data = new Float32Array(size ** 3 * 3);
  const levels = Array.from({ length: size }, (_, index) => linear(index / last));
  for (let blue = 0, offset = 0; blue < size; blue++) {
    for (let green = 0; green < size; green++) {
      for (let red = 0; red < size; red++, offset += 3) {
        const r = levels[red], g = levels[green], b = levels[blue];
        const y = luminance(r, g, b);
        const light = encoded(y);
        const desired = linear(clamp(curve(clamp(light))));
        const peak = Math.max(r, g, b);
        // Scale RGB together so tone correction preserves hue and usable highlight headroom.
        const gain = y ? Math.min(desired / y, Math.max(peak, linear(253 / 255)) / peak) : 1;
        data[offset] = encoded(r * gain);
        data[offset + 1] = encoded(g * gain);
        data[offset + 2] = encoded(b * gain);
      }
    }
  }
  return { size, data, domainMin: [0, 0, 0], domainMax: [1, 1, 1], title: 'FrameLab Histogram Auto' };
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
    const [light, a, b] = toLab(decodeByte[before[offset]], decodeByte[before[offset + 1]], decodeByte[before[offset + 2]]);
    const [nextLight, nextA, nextB] = toLab(decodeByte[after[offset]], decodeByte[after[offset + 1]], decodeByte[after[offset + 2]]);
    const c = Math.hypot(a, b), nextC = Math.hypot(nextA, nextB);
    // Chroma scales with lightness under uniform linear gain. Compare proportional chroma.
    const relative = c / Math.max(.08, light);
    const nextRelative = nextC / Math.max(.08, nextLight);
    if (relative < .03 && nextRelative > .055) neutralChanges++;
    if (c < .035) continue;
    chromatic++;
    if (a * nextA + b * nextB < c * nextC * hueTolerance) hueChanges++;
    if (nextRelative < relative * .78 || nextRelative > relative * 1.22) chromaChanges++;
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

function distanceToBands(profile, anchors) {
  return anchors.reduce((sum, { key, low, high }) => {
    const value = profile[key];
    return sum + Math.abs(value - clamp(value, low, high));
  }, 0);
}

function measureCandidate(image, before, lut, anchors) {
  const rendered = renderGrade(image, undefined, { baseLut: lut });
  const after = profile(rendered);
  const distance = distanceToBands(after, anchors);
  const improvement = distanceToBands(before, anchors) - distance;
  if (improvement < .0075 || after.span < before.span - .055
    || !respectsClippingAndPalette(image, rendered, before.count)) return null;
  return { after, distance };
}

export function planAutomaticGrade(image) {
  const before = profile(image);
  if (before.count < 256 || before.occupied < 5 || before.span < .025) return { lut: null, reason: 'insufficient' };
  const anchors = toneAnchors(before);
  if (distanceToBands(before, anchors) < .008) return { lut: null, reason: 'in-range' };
  const thumbnail = sample(image);
  const small = thumbnail === image ? before : profile(thumbnail);
  const active = anchors.filter(({ input, output }) => input !== output).map(({ key }) => key);
  const variants = active.length > 1 ? [active, ...active.map(key => [key])] : [active];
  let best;
  for (const selected of variants) {
    for (const amount of [1, .75, .5, .25, .125]) {
      const lut = buildLut(toneCurve(anchors, selected, amount));
      const estimated = measureCandidate(thumbnail, small, lut, anchors);
      if (!estimated) continue;
      const result = thumbnail === image ? estimated : measureCandidate(image, before, lut, anchors);
      if (!result || (best && result.distance >= best.distance - .004)) continue;
      best = { lut, before, ...result };
      if (result.distance <= .008) return best;
    }
  }
  return best ?? { lut: null, reason: 'clipping-or-color' };
}
