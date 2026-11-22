export function createCutoutEngine(signal) {
  'use strict';

  const SIDE = 320;
  const PIXELS = SIDE * SIDE;
  const MAX_ELEMENTS = 8;
  const MAX_IMAGE_SIDE = 2400;
  const workerURL = new URL('./cutout-worker.mjs', import.meta.url);
  const neighboring = [-1, 0, 1];
  const pending = new Map();
  let worker;
  let requestId = 0;

  function stopWorker(error) {
    worker?.terminate();
    worker = undefined;
    for (const {timer, reject} of pending.values()) {
      clearTimeout(timer);
      reject(error);
    }
    pending.clear();
  }

  function startWorker() {
    worker = new Worker(workerURL, {type: 'module'});
    worker.addEventListener('message', ({data}) => {
      const request = pending.get(data.id);
      if (!request) return;
      pending.delete(data.id);
      clearTimeout(request.timer);
      if (data.error) request.reject(new Error(data.error));
      else request.resolve(data.mask);
    });
    worker.addEventListener('error', event => {
      event.preventDefault();
      stopWorker(new Error('本地抠图模型暂时无法启动。'));
    });
    worker.addEventListener('messageerror', () => stopWorker(new Error('抠图模型没有返回图像。')));
  }

  function modelMask(pixels) {
    signal.throwIfAborted();
    return new Promise((resolve, reject) => {
      if (!worker) startWorker();
      const id = ++requestId;
      const timer = setTimeout(() => stopWorker(new Error('本地抠图模型响应超时。')), 55000);
      pending.set(id, {resolve, reject, timer});
      const rgba = pixels.slice().buffer;
      try {
        worker.postMessage({id, rgba}, [rgba]);
      } catch (error) {
        stopWorker(error);
      }
    });
  }

  function canvasFor(width, height) {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    return canvas;
  }

  function png(canvas) {
    return new Promise((resolve, reject) => canvas.toBlob(blob => {
      if (blob) resolve(blob);
      else reject(new Error('无法保存透明 PNG。'));
    }, 'image/png'));
  }

  function borderPixels() {
    const indices = [];
    for (let n = 0; n < SIDE; n++) {
      indices.push(n, PIXELS - SIDE + n, n * SIDE, n * SIDE + SIDE - 1);
    }
    return indices;
  }

  const border = borderPixels();

  function existingAlpha(pixels) {
    const alpha = new Float32Array(PIXELS);
    let transparent = 0;
    for (let i = 0; i < PIXELS; i++) {
      alpha[i] = pixels[i * 4 + 3] / 255;
      if (alpha[i] < .94) transparent++;
    }
    return transparent > PIXELS * .007 &&
      border.filter(index => alpha[index] < .94).length > border.length * .04 ? alpha : null;
  }

  function normalize(mask) {
    if (!mask || mask.length !== PIXELS) return null;
    let min = 1;
    let max = 0;
    for (const value of mask) {
      min = Math.min(value, min);
      max = Math.max(value, max);
    }
    if (!(max - min > .1 && max > .28)) return null;
    return mask.map(value => (value - min) / (max - min));
  }

  function smooth(low, high, value) {
    const step = Math.max(0, Math.min(1, (value - low) / (high - low)));
    return step * step * (3 - 2 * step);
  }

  // Product photos and scans often have enough border-color agreement for a cleaner edge.
  function plainBackdrop(pixels) {
    const color = [0, 1, 2].map(channel => {
      const values = border.map(index => pixels[index * 4 + channel]).sort((a, b) => a - b);
      return values[Math.floor(values.length / 2)];
    });
    const distance = new Float32Array(PIXELS);
    for (let i = 0; i < PIXELS; i++) {
      const offset = i * 4;
      distance[i] = Math.hypot(
        pixels[offset] - color[0],
        pixels[offset + 1] - color[1],
        pixels[offset + 2] - color[2]
      );
    }
    const borderDistances = border.map(index => distance[index]).sort((a, b) => a - b);
    const variation = borderDistances[Math.floor(borderDistances.length * .92)];
    if (variation > 37) return null;

    const lower = Math.max(12, variation + 7);
    const upper = lower + 33;
    const visited = new Uint8Array(PIXELS);
    const queue = new Int32Array(PIXELS);
    let front = 0;
    let end = 0;
    function enqueue(index) {
      if (visited[index] || distance[index] > upper) return;
      visited[index] = 1;
      queue[end++] = index;
    }
    for (const index of border) enqueue(index);
    while (front < end) {
      const index = queue[front++];
      const x = index % SIDE;
      if (index >= SIDE) enqueue(index - SIDE);
      if (index + SIDE < PIXELS) enqueue(index + SIDE);
      if (x > 0) enqueue(index - 1);
      if (x + 1 < SIDE) enqueue(index + 1);
    }
    if (end < PIXELS * .12 || end > PIXELS * .997) return null;
    return distance.map((value, index) => visited[index] ? smooth(lower, upper, value) : 1);
  }

  function useBackdrop(model, backdrop) {
    if (!model || !backdrop) return backdrop || model;
    let modelArea = 0;
    let matched = 0;
    let backdropArea = 0;
    for (let i = 0; i < PIXELS; i++) {
      const visible = backdrop[i] > .52;
      backdropArea += Number(visible);
      if (model[i] < .56) continue;
      modelArea++;
      matched += Number(visible);
    }
    return matched / modelArea > .55 && matched / backdropArea > .14 ? backdrop : model;
  }

  function floodCore(mask, threshold) {
    const labels = new Int32Array(PIXELS);
    const queue = new Int32Array(PIXELS);
    const groups = [];
    for (let start = 0; start < PIXELS; start++) {
      if (labels[start] || mask[start] < threshold) continue;
      const id = groups.length + 1;
      const region = {id, area: 0, x: SIDE, y: SIDE, r: 0, b: 0};
      let begin = 0;
      let end = 1;
      labels[start] = id;
      queue[0] = start;
      while (begin < end) {
        const index = queue[begin++];
        const y = Math.floor(index / SIDE);
        const x = index % SIDE;
        region.x = Math.min(region.x, x);
        region.y = Math.min(region.y, y);
        region.r = Math.max(region.r, x);
        region.b = Math.max(region.b, y);
        for (const dy of neighboring) for (const dx of neighboring) {
          const nx = x + dx;
          const ny = y + dy;
          if (nx < 0 || nx >= SIDE || ny < 0 || ny >= SIDE) continue;
          const next = ny * SIDE + nx;
          if (labels[next] || mask[next] < threshold) continue;
          labels[next] = id;
          queue[end++] = next;
        }
      }
      region.area = end;
      groups.push(region);
    }
    return {labels, groups};
  }

  // Grow labels outward into soft edges without joining separate pieces.
  function extendEdges(labels, areas, mask, preserveAlpha) {
    const queue = new Int32Array(PIXELS);
    const depth = new Uint8Array(PIXELS);
    let front = 0;
    let end = 0;
    for (let i = 0; i < PIXELS; i++) {
      if (areas.has(labels[i])) queue[end++] = i;
      else labels[i] = 0;
    }
    while (front < end) {
      const index = queue[front++];
      const steps = depth[index];
      if (steps >= 7) continue;
      const y = Math.floor(index / SIDE);
      const x = index % SIDE;
      for (const dy of neighboring) for (const dx of neighboring) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || nx >= SIDE || ny < 0 || ny >= SIDE) continue;
        const next = ny * SIDE + nx;
        if (labels[next] || (!preserveAlpha && mask[next] < .1)) continue;
        labels[next] = labels[index];
        depth[next] = steps + 1;
        queue[end++] = next;
      }
    }
  }

  function sample(mask, x, y) {
    const x0 = Math.max(0, Math.floor(x));
    const y0 = Math.max(0, Math.floor(y));
    const x1 = Math.min(SIDE - 1, x0 + 1);
    const y1 = Math.min(SIDE - 1, y0 + 1);
    const dx = Math.max(0, x - x0);
    const dy = Math.max(0, y - y0);
    const row0 = y0 * SIDE;
    const row1 = y1 * SIDE;
    const top = mask[row0 + x0] * (1 - dx) + mask[row0 + x1] * dx;
    const bottom = mask[row1 + x0] * (1 - dx) + mask[row1 + x1] * dx;
    return top * (1 - dy) + bottom * dy;
  }

  function cropElement(image, width, height, region, labels, mask, original) {
    const left = Math.max(0, Math.floor((region.x - 8) * width / SIDE));
    const top = Math.max(0, Math.floor((region.y - 8) * height / SIDE));
    const right = Math.min(width, Math.ceil((region.r + 9) * width / SIDE));
    const bottom = Math.min(height, Math.ceil((region.b + 9) * height / SIDE));
    const canvas = canvasFor(right - left, bottom - top);
    const ctx = canvas.getContext('2d', {willReadFrequently: true});
    ctx.drawImage(image, -left, -top, width, height);
    const data = ctx.getImageData(0, 0, canvas.width, canvas.height);
    let l = canvas.width;
    let t = canvas.height;
    let r = -1;
    let b = -1;

    for (let y = 0; y < canvas.height; y++) {
      const sy = Math.min(SIDE - 1, (top + y + .5) * SIDE / height - .5);
      const row = Math.round(sy) * SIDE;
      for (let x = 0; x < canvas.width; x++) {
        const at = (y * canvas.width + x) * 4 + 3;
        const sx = Math.min(SIDE - 1, (left + x + .5) * SIDE / width - .5);
        if (labels[row + Math.round(sx)] !== region.id) data.data[at] = 0;
        else if (!original) data.data[at] *= smooth(.13, .85, sample(mask, sx, sy));
        if (data.data[at] > 9) {
          l = Math.min(l, x);
          r = Math.max(r, x);
          t = Math.min(t, y);
          b = Math.max(b, y);
        }
      }
    }
    if (r < l || b < t) return null;

    // Keep a narrow transparent margin so the clipped edge remains visible in the tray.
    const output = canvasFor(r - l + 5, b - t + 5);
    output.getContext('2d').putImageData(data, 2 - l, 2 - t, l, t, r - l + 1, b - t + 1);
    return output;
  }

  async function extract(image, {onProgress = () => {}} = {}) {
    const iw = image.naturalWidth || image.width;
    const ih = image.naturalHeight || image.height;
    if (!iw || !ih) throw new Error('无法读取图片尺寸。');
    const scale = Math.min(1, MAX_IMAGE_SIDE / Math.max(iw, ih));
    const width = Math.max(1, Math.round(iw * scale));
    const height = Math.max(1, Math.round(ih * scale));
    onProgress(.06);
    const preview = canvasFor(SIDE, SIDE);
    const context = preview.getContext('2d', {willReadFrequently: true});
    context.drawImage(image, 0, 0, SIDE, SIDE);
    const pixels = context.getImageData(0, 0, SIDE, SIDE).data;
    const alpha = existingAlpha(pixels);
    let mask = alpha;
    let inferenceFailed = false;
    if (!mask) {
      onProgress(.2);
      let model;
      try {
        model = normalize(await modelMask(pixels));
      } catch {
        inferenceFailed = true;
      }
      mask = useBackdrop(model, plainBackdrop(pixels));
    }
    onProgress(.65);
    if (!mask) {
      throw new Error(inferenceFailed
        ? '本地抠图模型暂时不可用，且背景较复杂。请重试，或选择背景简单的照片。'
        : '未找到清晰的前景。请换一张主体和背景区别更明显的图片。');
    }
    const {labels, groups} = floodCore(mask, alpha ? .15 : .46);
    groups.sort((a, b) => b.area - a.area);
    const minArea = Math.max(48, (groups[0]?.area || 0) * .023);
    const regions = groups.filter(group =>
      group.area >= minArea && group.area < PIXELS * (alpha ? 1 : .97) &&
      group.r - group.x >= 3 && group.b - group.y >= 3
    ).slice(0, MAX_ELEMENTS);
    extendEdges(labels, new Set(regions.map(region => region.id)), mask, Boolean(alpha));

    const elements = [];
    for (const region of regions) {
      const output = cropElement(image, width, height, region, labels, mask, Boolean(alpha));
      if (!output) continue;
      elements.push({blob: await png(output), width: output.width, height: output.height});
      onProgress(.65 + .35 * elements.length / regions.length);
    }
    if (!elements.length) throw new Error('未找到可独立裁出的主体。请换一张前景更清晰的照片。');
    onProgress(1);
    return elements;
  }

  signal.addEventListener('abort', () => stopWorker(signal.reason), {once: true});
  return {extract};
}
