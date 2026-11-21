import { getOrt } from '../../ort-runtime.mjs';

const IMAGE_SIDE = 1024;
const MASK_SIDE = 256;
const maskPixels = MASK_SIDE * MASK_SIDE;
const mean = [0.485, 0.456, 0.406];
const std = [0.229, 0.224, 0.225];
const clamp = (value, low, high) => Math.min(high, Math.max(low, value));
let models;
let cached;
let queue = Promise.resolve();

async function getModels() {
  const ort = await getOrt();
  const options = { executionProviders: ['wasm'], graphOptimizationLevel: 'all' };
  const open = file => ort.InferenceSession.create(new URL(file, import.meta.url).href, options);
  models ??= (async () => {
    const encoder = await open('./vision_encoder_quantized.onnx');
    try {
      const decoder = await open('./box_decoder_quantized.onnx');
      return { ort, encoder, decoder };
    } catch (error) {
      await encoder.release();
      throw error;
    }
  })().catch(error => {
    models = undefined;
    throw error;
  });
  return models;
}

function pixelTensor(ort, rgba, width, height) {
  const plane = IMAGE_SIDE * IMAGE_SIDE;
  const pixels = new Float32Array(3 * plane);
  for (let channel = 0; channel < 3; channel++) {
    const offset = channel * plane;
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const sample = rgba[4 * (y * width + x) + channel];
        pixels[offset + y * IMAGE_SIDE + x] = (sample / 255 - mean[channel]) / std[channel];
      }
    }
  }
  return new ort.Tensor('float32', pixels, [1, 3, IMAGE_SIDE, IMAGE_SIDE]);
}

async function encodeModel(ort, encoder, { rgba, width, height }) {
  const hash = await crypto.subtle.digest('SHA-256', rgba);
  const key = width + ':' + height + ':' + new Uint8Array(hash).join(',');
  if (cached?.key === key) return cached.embedding;
  const pixels = pixelTensor(ort, rgba, width, height);
  try {
    const embedding = await encoder.run({ pixel_values: pixels });
    if (cached) Object.values(cached.embedding).forEach(tensor => tensor.dispose());
    cached = { key, embedding };
    return embedding;
  } finally {
    pixels.dispose();
  }
}

function chooseMask(output, prompt) {
  const logits = output.pred_masks.data;
  const confidences = output.iou_scores.data;
  const [left, top, right, bottom] = prompt.map(value => value * MASK_SIDE / IMAGE_SIDE);
  const boxArea = (right - left) * (bottom - top);
  const centerX = (left + right) * .5;
  const centerY = (top + bottom) * .5;
  let best;
  for (let id = 0; id < confidences.length; id++) {
    const mask = logits.subarray(id * maskPixels, (id + 1) * maskPixels);
    let inside = 0;
    let outside = 0;
    let center = 0;
    for (let y = 0; y < MASK_SIDE; y += 2) {
      for (let x = 0; x < MASK_SIDE; x += 2) {
        if (mask[y * MASK_SIDE + x] <= 0) continue;
        if (x >= left && x < right && y >= top && y < bottom) {
          inside += 4;
          if (Math.abs(x - centerX) <= (right - left) * .22 &&
              Math.abs(y - centerY) <= (bottom - top) * .22) center += 4;
        } else {
          outside += 4;
        }
      }
    }
    if (!inside) continue;
    const coverage = clamp(inside / boxArea, 0, 1);
    const spilling = outside / (inside + outside);
    const squarePenalty = Math.max(0, coverage - .96);
    const centrality = Math.min(1, center / Math.max(1, boxArea * .12));
    const nativeBoxMaskBias = id === 0 ? .05 : 0;
    const score = confidences[id] + nativeBoxMaskBias +
      .17 * Math.sqrt(coverage) + .12 * centrality - .92 * spilling - squarePenalty;
    if (!best || score > best.score) best = { score, mask };
  }
  if (!best) throw new Error('框选内没有发现清晰的主体。');
  return new Float32Array(best.mask);
}

async function predict(ort, decoder, embedding, prompt) {
  const coords = new ort.Tensor('float32', Float32Array.from(prompt), [1, 1, 2, 2]);
  let output;
  try {
    output = await decoder.run({ ...embedding, input_points: coords });
    return chooseMask(output, prompt);
  } finally {
    coords.dispose();
    if (output) Object.values(output).forEach(tensor => tensor.dispose());
  }
}

async function run(request) {
  const { id, prompt } = request;
  try {
    const { ort, encoder, decoder } = await getModels();
    self.postMessage({ id, status: '正在分析框选主体…' });
    const embedding = await encodeModel(ort, encoder, request);
    const mask = await predict(ort, decoder, embedding, prompt);
    self.postMessage({ id, mask }, [mask.buffer]);
  } catch (error) {
    self.postMessage({ id, error: error instanceof Error ? error.message : String(error) });
  }
}

self.addEventListener('message', ({ data }) => {
  queue = queue.then(() => run(data));
});
