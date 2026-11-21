export const DEFAULT_GLOW = Object.freeze({
  amount: 0,
  threshold: 72,
  radius: 40,
  warmth: 0,
  streak: 0,
  angle: 0,
});

const MAX_GLOW_SIDE = 720;
const LINEAR_TO_SRGB_STEPS = 8192;
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const fromSrgb = value => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
const toSrgb = value => value <= 0.0031308 ? 12.92 * value : 1.055 * value ** (1 / 2.4) - 0.055;
const linearChannels = Float32Array.from({ length: 256 }, (_, value) => fromSrgb(value / 255));
const srgbBytes = Uint8Array.from(
  { length: LINEAR_TO_SRGB_STEPS + 1 },
  (_, value) => Math.round(255 * toSrgb(value / LINEAR_TO_SRGB_STEPS)),
);

export function normalizeGlow(params) {
  const value = (key, min, max) => Number.isFinite(params?.[key])
    ? clamp(params[key], min, max) : DEFAULT_GLOW[key];
  return {
    amount: value('amount', 0, 100),
    threshold: value('threshold', 0, 100),
    radius: value('radius', 0, 100),
    warmth: value('warmth', -100, 100),
    streak: value('streak', 0, 100),
    angle: value('angle', -90, 90),
  };
}

function axisBins(originalSize, workingSize) {
  const positions = new Int32Array(originalSize);
  const population = new Uint32Array(workingSize);
  for (let i = 0; i < originalSize; i++) {
    const position = Math.floor(i * workingSize / originalSize);
    positions[i] = position;
    population[position]++;
  }
  return { positions, population };
}

function extractHighlights(image, width, height, threshold) {
  const { data, width: originalWidth, height: originalHeight } = image;
  const field = new Float32Array(width * height * 3);
  const x = axisBins(originalWidth, width);
  const y = axisBins(originalHeight, height);
  const start = Math.max(0, threshold - 0.09);
  const topRolloff = clamp((1 - threshold) / .065, 0, 1);
  const byteFloor = Math.floor(start * 255);
  let emitting = false;
  for (let row = 0; row < originalHeight; row++) {
    let offset = row * originalWidth * 4;
    const fieldRow = y.positions[row] * width * 3;
    for (let col = 0; col < originalWidth; col++, offset += 4) {
      const opacity = data[offset + 3];
      if (opacity === 0) continue;
      const red = data[offset];
      const green = data[offset + 1];
      const blue = data[offset + 2];
      const peak = Math.max(red, green, blue);
      if (peak <= byteFloor) continue;
      const luma = red * .2126 + green * .7152 + blue * .0722;
      // Keep saturated light sources such as red brake lights in the bright pass.
      const brightness = (.35 * luma + .65 * peak) / 255;
      if (brightness <= start) continue;
      const knee = clamp((brightness - start) / .18, 0, 1);
      const emission = knee * knee * (3 - 2 * knee) * opacity / 255 * topRolloff;
      const index = fieldRow + x.positions[col] * 3;
      field[index] += linearChannels[red] * emission;
      field[index + 1] += linearChannels[green] * emission;
      field[index + 2] += linearChannels[blue] * emission;
      emitting = true;
    }
  }
  if (!emitting) return null;
  for (let row = 0, index = 0; row < height; row++) {
    for (let col = 0; col < width; col++, index += 3) {
      const group = x.population[col] * y.population[row];
      field[index] /= group;
      field[index + 1] /= group;
      field[index + 2] /= group;
    }
  }
  return field;
}

function boxPass(input, output, length, lanes, step, laneStep, radius) {
  const divisor = 1 / (radius * 2 + 1);
  for (let lane = 0; lane < lanes; lane++) {
    const first = lane * laneStep;
    const last = first + (length - 1) * step;
    let red = input[first] * (radius + 1);
    let green = input[first + 1] * (radius + 1);
    let blue = input[first + 2] * (radius + 1);
    for (let tap = 1; tap <= radius; tap++) {
      const source = Math.min(first + tap * step, last);
      red += input[source];
      green += input[source + 1];
      blue += input[source + 2];
    }
    for (let col = 0, index = first; col < length; col++, index += step) {
      output[index] = red * divisor;
      output[index + 1] = green * divisor;
      output[index + 2] = blue * divisor;
      const outgoing = Math.max(first, index - radius * step);
      const incoming = Math.min(last, index + (radius + 1) * step);
      red += input[incoming] - input[outgoing];
      green += input[incoming + 1] - input[outgoing + 1];
      blue += input[incoming + 2] - input[outgoing + 2];
    }
  }
}

function blur2d(input, scratch, output, width, height, radius) {
  boxPass(input, scratch, width, height, 3, width * 3, radius);
  boxPass(scratch, output, height, width, width * 3, 3, radius);
}

// Shear along the dominant axis so each lane is one line at the requested angle.
// A moving window integrates a continuous streak without spaced echoes.
function streakPass(input, output, width, height, orientation) {
  const { horizontal, offsets, radius } = orientation;
  const length = horizontal ? width : height;
  const lanes = horizontal ? height : width;
  const majorStep = horizontal ? 3 : width * 3;
  const minorStep = horizontal ? width * 3 : 3;
  const end = offsets[length - 1];
  const divisor = 1 / (radius * 2 + 1);
  for (let lane = -Math.max(0, end); lane < lanes - Math.min(0, end); lane++) {
    let red = 0;
    let green = 0;
    let blue = 0;
    for (let tap = 0; tap <= radius && tap < length; tap++) {
      const minor = lane + offsets[tap];
      if (minor < 0 || minor >= lanes) continue;
      const index = tap * majorStep + minor * minorStep;
      red += input[index];
      green += input[index + 1];
      blue += input[index + 2];
    }
    for (let col = 0; col < length; col++) {
      const minor = lane + offsets[col];
      if (minor >= 0 && minor < lanes) {
        const index = col * majorStep + minor * minorStep;
        output[index] = red * divisor;
        output[index + 1] = green * divisor;
        output[index + 2] = blue * divisor;
      }
      const outCol = col - radius;
      const outMinor = lane + offsets[outCol];
      if (outCol >= 0 && outMinor >= 0 && outMinor < lanes) {
        const index = outCol * majorStep + outMinor * minorStep;
        red -= input[index];
        green -= input[index + 1];
        blue -= input[index + 2];
      }
      const inCol = col + radius + 1;
      const inMinor = lane + offsets[inCol];
      if (inCol < length && inMinor >= 0 && inMinor < lanes) {
        const index = inCol * majorStep + inMinor * minorStep;
        red += input[index];
        green += input[index + 1];
        blue += input[index + 2];
      }
    }
  }
}

function direction(width, height, angle, length) {
  const radians = angle * Math.PI / 180;
  const dx = Math.cos(radians);
  const dy = Math.sin(radians);
  const horizontal = Math.abs(dx) >= Math.abs(dy);
  const major = horizontal ? dx : dy;
  const slope = (horizontal ? dy : dx) / major;
  return {
    horizontal,
    radius: Math.max(1, Math.round(length * Math.abs(major))),
    offsets: Int32Array.from({ length: horizontal ? width : height }, (_, column) => Math.round(slope * column)),
  };
}

function interpolationAxis(sourceSize, targetSize) {
  const low = new Int32Array(targetSize);
  const high = new Int32Array(targetSize);
  const fraction = new Float32Array(targetSize);
  for (let i = 0; i < targetSize; i++) {
    const sample = clamp((i + .5) * sourceSize / targetSize - .5, 0, sourceSize - 1);
    low[i] = Math.floor(sample);
    high[i] = Math.min(sourceSize - 1, low[i] + 1);
    fraction[i] = sample - low[i];
  }
  return { low, high, fraction };
}

function blendGlow(image, field, width, height, warmth) {
  const source = image.data;
  const output = new Uint8ClampedArray(source);
  const x = interpolationAxis(width, image.width);
  const y = interpolationAxis(height, image.height);
  const tint = [1 + .36 * warmth, 1 + .06 * warmth, 1 - .47 * warmth];
  for (let row = 0, offset = 0; row < image.height; row++) {
    const top = y.low[row] * width;
    const bottom = y.high[row] * width;
    const vertical = y.fraction[row];
    for (let col = 0; col < image.width; col++, offset += 4) {
      if (source[offset + 3] === 0) continue;
      const left = x.low[col];
      const right = x.high[col];
      const horizontal = x.fraction[col];
      const a = (top + left) * 3;
      const b = (top + right) * 3;
      const c = (bottom + left) * 3;
      const d = (bottom + right) * 3;
      for (let channel = 0; channel < 3; channel++) {
        const upper = field[a + channel] + horizontal * (field[b + channel] - field[a + channel]);
        const lower = field[c + channel] + horizontal * (field[d + channel] - field[c + channel]);
        const light = (upper + vertical * (lower - upper)) * tint[channel];
        if (light <= .00015) continue;
        const base = linearChannels[source[offset + channel]];
        // Screen in linear light, preserving the original white point and alpha.
        const combined = base + (1 - base) * Math.min(light, .93);
        output[offset + channel] = srgbBytes[Math.round(combined * LINEAR_TO_SRGB_STEPS)];
      }
    }
  }
  if (typeof ImageData !== 'undefined') return new ImageData(output, image.width, image.height);
  return { data: output, width: image.width, height: image.height };
}

export function applyGlow(imageData, params) {
  const { amount, threshold, radius, warmth, streak, angle } = normalizeGlow(params);
  if (amount === 0 || threshold === 100) return imageData;
  const { width: sourceWidth, height: sourceHeight } = imageData;
  const scale = Math.min(1, MAX_GLOW_SIDE / Math.max(sourceWidth, sourceHeight));
  const width = Math.max(1, Math.round(sourceWidth * scale));
  const height = Math.max(1, Math.round(sourceHeight * scale));
  const source = extractHighlights(imageData, width, height, threshold / 100);
  if (!source) return imageData;
  const shortSide = Math.min(width, height);
  const radiusScale = radius / 100;
  const nearRadius = Math.max(1, Math.round(shortSide * (.002 + .018 * radiusScale)));
  const hazeRadius = Math.max(1, Math.round(shortSide * (.005 + .063 * radiusScale ** 1.4)));
  const scratch = new Float32Array(source.length);
  const near = new Float32Array(source.length);
  const far = new Float32Array(source.length);
  blur2d(source, scratch, near, width, height, nearRadius);
  if (streak) {
    const strength = streak / 100;
    const length = shortSide * (.032 + .24 * radiusScale) * (.55 + .45 * strength);
    const orientation = direction(width, height, angle, length);
    streakPass(near, scratch, width, height, orientation);
    streakPass(scratch, source, width, height, orientation);
  }
  blur2d(near, scratch, far, width, height, hazeRadius);
  const bloomGain = amount / 100 * 1.55;
  const streakGain = bloomGain * (streak / 100) * 1.75;
  for (let i = 0; i < near.length; i++) {
    near[i] = (near[i] * .38 + far[i] * .62) * bloomGain + source[i] * streakGain;
  }
  return blendGlow(imageData, near, width, height, warmth / 100);
}
