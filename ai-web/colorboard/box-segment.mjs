import { generateSubjectMask } from './matte.mjs';

const MODEL_SIDE = 1024;
const MASK_SIDE = 256;
const clamp = (value, low, high) => Math.min(high, Math.max(low, value));
let worker;
let nextJob = 0;
let modelReady = false;
const pending = new Map();

function getWorker() {
  if (worker) return worker;
  const active = new Worker(new URL('./vendor/box-segment/worker.mjs', import.meta.url), { type: 'module' });
  active.addEventListener('message', ({ data }) => {
    const job = pending.get(data.id);
    if (!job) return;
    if (data.status) {
      modelReady = true;
      job.onStatus?.(data.status);
      return;
    }
    if (data.error) job.reject(new Error(data.error));
    else job.resolve(data.mask);
  });
  active.addEventListener('error', event => {
    const error = new Error(event.message || '无法启动框选分割模型。');
    for (const job of pending.values()) job.reject(error);
    pending.clear();
    active.terminate();
    worker = undefined;
    modelReady = false;
  });
  worker = active;
  return worker;
}

function normalizedBox(box, imageCanvas) {
  const { width, height } = imageCanvas;
  if (!width || !height) throw new Error('请先打开一张照片。');
  if (![box?.x, box?.y, box?.width, box?.height].every(Number.isFinite)) {
    throw new Error('请先拖出主体框选范围。');
  }
  const x = clamp(box.x, 0, 1);
  const y = clamp(box.y, 0, 1);
  const right = clamp(box.x + box.width, 0, 1);
  const bottom = clamp(box.y + box.height, 0, 1);
  const bounds = {
    left: Math.ceil(x * width - 0.5),
    top: Math.ceil(y * height - 0.5),
    right: Math.ceil(right * width - 0.5),
    bottom: Math.ceil(bottom * height - 0.5),
    x, y, rightN: right, bottomN: bottom,
  };
  if (bounds.right - bounds.left < 4 || bounds.bottom - bounds.top < 4) {
    throw new Error('框选范围太小，请框住完整主体并留少量边缘。');
  }
  return bounds;
}

function samplePhoto(canvas) {
  const scale = MODEL_SIDE / Math.max(canvas.width, canvas.height);
  const sampled = document.createElement('canvas');
  sampled.width = Math.max(1, Math.round(canvas.width * scale));
  sampled.height = Math.max(1, Math.round(canvas.height * scale));
  const context = sampled.getContext('2d', { willReadFrequently: true });
  context.imageSmoothingQuality = 'high';
  context.fillStyle = '#fff';
  context.fillRect(0, 0, sampled.width, sampled.height);
  context.drawImage(canvas, 0, 0, sampled.width, sampled.height);
  return { width: sampled.width, height: sampled.height, rgba: context.getImageData(0, 0, sampled.width, sampled.height).data };
}

function projectMask(mask, bounds, width, height, scaledWidth, scaledHeight) {
  const output = new Uint8ClampedArray(width * height);
  const max = MASK_SIDE - 1;
  const scaleX = scaledWidth * MASK_SIDE / MODEL_SIDE / width;
  const scaleY = scaledHeight * MASK_SIDE / MODEL_SIDE / height;
  for (let y = bounds.top; y < bounds.bottom; y++) {
    const sy = clamp((y + 0.5) * scaleY - 0.5, 0, max);
    const y0 = Math.floor(sy);
    const y1 = Math.min(y0 + 1, max);
    const fy = sy - y0;
    for (let x = bounds.left; x < bounds.right; x++) {
      const sx = clamp((x + 0.5) * scaleX - 0.5, 0, max);
      const x0 = Math.floor(sx);
      const x1 = Math.min(x0 + 1, max);
      const fx = sx - x0;
      const above = mask[y0 * MASK_SIDE + x0] * (1 - fx) + mask[y0 * MASK_SIDE + x1] * fx;
      const below = mask[y1 * MASK_SIDE + x0] * (1 - fx) + mask[y1 * MASK_SIDE + x1] * fx;
      const logit = above * (1 - fy) + below * fy;
      // Feather the model's contour gently while retaining solid interiors.
      const fraction = clamp((logit + 1.5) / 3, 0, 1);
      output[y * width + x] = 255 * fraction ** 2 * (3 - 2 * fraction);
    }
  }
  return output;
}

async function runModel(canvas, bounds, { onStatus, signal }) {
  const { width, height, rgba } = samplePhoto(canvas);
  const id = ++nextJob;
  onStatus?.(modelReady ? '正在分析框选主体…' : '正在加载框选 AI 模型…');
  signal?.throwIfAborted();
  let cancel;
  try {
    const mask = await new Promise((resolve, reject) => {
      cancel = () => reject(signal.reason ?? new DOMException('操作已取消。', 'AbortError'));
      signal?.addEventListener('abort', cancel, { once: true });
      pending.set(id, { resolve, reject, onStatus });
      getWorker().postMessage({
        id, width, height, rgba,
        prompt: [bounds.x * width, bounds.y * height, bounds.rightN * width, bounds.bottomN * height],
      }, [rgba.buffer]);
    });
    signal?.throwIfAborted();
    return projectMask(mask, bounds, canvas.width, canvas.height, width, height);
  } finally {
    pending.delete(id);
    signal?.removeEventListener('abort', cancel);
  }
}

async function runCropFallback(canvas, bounds, { signal }) {
  const width = bounds.right - bounds.left;
  const height = bounds.bottom - bounds.top;
  const cropped = document.createElement('canvas');
  cropped.width = width;
  cropped.height = height;
  cropped.getContext('2d').drawImage(canvas, bounds.left, bounds.top, width, height, 0, 0, width, height);
  const subject = await generateSubjectMask(cropped, { signal });
  const output = new Uint8ClampedArray(canvas.width * canvas.height);
  for (let y = 0; y < height; y++) {
    output.set(subject.subarray(y * width, (y + 1) * width), (y + bounds.top) * canvas.width + bounds.left);
  }
  return output;
}

/** Segment a subject from the normalized {x, y, width, height} prompt. */
export async function generateBoxMask(canvas, box, { signal, onStatus } = {}) {
  signal?.throwIfAborted();
  const bounds = normalizedBox(box, canvas);
  try {
    return await runModel(canvas, bounds, { signal, onStatus });
  } catch (error) {
    if (signal?.aborted) throw error;
    onStatus?.('框选模型暂不可用，正在识别选框内的主体…');
    return runCropFallback(canvas, bounds, { signal });
  }
}
