const modelSize = 320;
const pending = new Map();
let worker;
let nextJobId = 0;
let modelLoaded = false;

function getWorker() {
  if (worker) return worker;
  worker = new Worker(new URL('./vendor/matte/worker.mjs', import.meta.url), { type: 'module' });
  worker.addEventListener('message', ({ data: { id, status, mask, error } }) => {
    const job = pending.get(id);
    if (status) {
      modelLoaded = true;
      job?.onStatus?.(status);
      return;
    }
    if (!job) return;
    pending.delete(id);
    if (error) job.reject(new Error(error));
    else job.resolve(mask);
  });
  worker.addEventListener('error', event => {
    const error = new Error(event.message || '无法启动 AI 抠图模型。');
    for (const job of pending.values()) job.reject(error);
    pending.clear();
    worker.terminate();
    worker = undefined;
    modelLoaded = false;
  });
  return worker;
}

function samplePhoto(imageCanvas) {
  const canvas = document.createElement('canvas');
  canvas.width = modelSize;
  canvas.height = modelSize;
  const context = canvas.getContext('2d', { willReadFrequently: true });
  context.imageSmoothingQuality = 'high';
  context.fillStyle = '#fff';
  context.fillRect(0, 0, modelSize, modelSize);
  context.drawImage(imageCanvas, 0, 0, modelSize, modelSize);
  return context.getImageData(0, 0, modelSize, modelSize).data;
}

function resizeMask(mask, width, height) {
  if (width === modelSize && height === modelSize) return mask;
  const result = new Uint8ClampedArray(width * height);
  const left = new Uint16Array(width);
  const fraction = new Float32Array(width);
  for (let x = 0; x < width; x++) {
    const sourceX = Math.max(0, Math.min(modelSize - 1, (x + 0.5) * modelSize / width - 0.5));
    left[x] = Math.floor(sourceX);
    fraction[x] = sourceX - left[x];
  }
  for (let y = 0; y < height; y++) {
    const sourceY = Math.max(0, Math.min(modelSize - 1, (y + 0.5) * modelSize / height - 0.5));
    const upper = Math.floor(sourceY);
    const lower = Math.min(upper + 1, modelSize - 1);
    const blendY = sourceY - upper;
    for (let x = 0; x < width; x++) {
      const x0 = left[x];
      const x1 = Math.min(x0 + 1, modelSize - 1);
      const above = mask[upper * modelSize + x0] * (1 - fraction[x]) + mask[upper * modelSize + x1] * fraction[x];
      const below = mask[lower * modelSize + x0] * (1 - fraction[x]) + mask[lower * modelSize + x1] * fraction[x];
      result[y * width + x] = above * (1 - blendY) + below * blendY;
    }
  }
  return result;
}

/** Returns one 0–255 mask value per pixel of the input canvas. */
export async function generateSubjectMask(imageCanvas, { onStatus, signal } = {}) {
  signal?.throwIfAborted();
  const { width, height } = imageCanvas;
  if (!width || !height) throw new Error('请先打开一张照片。');
  const activeWorker = getWorker();
  const rgba = samplePhoto(imageCanvas);
  const id = ++nextJobId;
  onStatus?.(modelLoaded ? '正在识别照片主体…' : '正在加载 AI 抠图模型…');
  signal?.throwIfAborted();

  let cancel;
  try {
    const mask = await new Promise((resolve, reject) => {
      pending.set(id, { resolve, reject, onStatus });
      cancel = () => {
        pending.delete(id);
        reject(signal.reason);
      };
      signal?.addEventListener('abort', cancel, { once: true });
      activeWorker.postMessage({ id, rgba }, [rgba.buffer]);
    });
    return resizeMask(mask, width, height);
  } finally {
    pending.delete(id);
    signal?.removeEventListener('abort', cancel);
  }
}
