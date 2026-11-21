export const projectMime = 'application/x-colorboard';
export const projectLimit = 3 * 1024 * 1024;
const expandedLimit = 52 * 1024 * 1024;
const projectType = 'framelab-colorboard-project';

export function toBase64(bytes) {
  let result = '';
  for (let offset = 0; offset < bytes.length; offset += 32768) {
    result += String.fromCharCode(...bytes.subarray(offset, offset + 32768));
  }
  return btoa(result);
}

export function fromBase64(data, limit) {
  if (typeof data !== 'string' || data.length > Math.ceil(limit / 3) * 4) {
    throw new Error('项目中的二进制数据超过上限。');
  }
  const raw = atob(data);
  if (raw.length > limit) throw new Error('项目中的二进制数据超过上限。');
  return Uint8Array.from(raw, char => char.charCodeAt(0));
}

export async function packProject(value) {
  const original = new Blob([JSON.stringify({ ...value, type: projectType, version: 1 })]);
  if (original.size > expandedLimit) throw new Error('调色工程过大，无法保存到画布。');
  const packed = await new Response(original.stream().pipeThrough(new CompressionStream('gzip'))).blob();
  if (packed.size > projectLimit) throw new Error('调色工程超过 3 MiB，请减少大尺寸 LUT 或蒙版后再保存。');
  return packed.slice(0, packed.size, projectMime);
}

export async function unpackProject(value) {
  const prefix = 'data:' + projectMime + ';base64,';
  const packed = typeof value === 'string' && value.startsWith(prefix)
    ? new Blob([fromBase64(value.slice(prefix.length), projectLimit)], { type: projectMime })
    : value;
  if (!(packed instanceof Blob) || packed.type !== projectMime || packed.size > projectLimit) {
    throw new Error('不支持这个调色工程文件。');
  }
  const reader = packed.stream().pipeThrough(new DecompressionStream('gzip')).getReader();
  let size = 0;
  const decoder = new TextDecoder(), chunks = [];
  try {
    for (;;) {
      const { done, value: data } = await reader.read();
      if (done) break;
      size += data.byteLength;
      if (size > expandedLimit) {
        await reader.cancel();
        throw new Error('调色工程展开后超过上限。');
      }
      chunks.push(decoder.decode(data, { stream: true }));
    }
  } finally {
    reader.releaseLock();
  }
  chunks.push(decoder.decode());
  const project = JSON.parse(chunks.join(''));
  if (project?.type !== projectType || project.version !== 1 || !Array.isArray(project.layers) || project.layers.length > 128) {
    throw new Error('调色工程的版本或蒙版记录无效。');
  }
  return project;
}

function toTable(table) {
  return {
    size: table.size,
    domainMin: table.domainMin,
    domainMax: table.domainMax,
    data: toBase64(new Uint8Array(table.data.buffer, table.data.byteOffset, table.data.byteLength))
  };
}

export function packLut(lut) {
  return lut ? {
    ...toTable(lut), title: lut.title, type: lut.type,
    shaper: lut.shaper ? toTable(lut.shaper) : null
  } : null;
}

function fromTable(table, dimension) {
  const { size, domainMin, domainMax } = table;
  const maximum = dimension === 1 ? 65536 : 128;
  if (!Number.isInteger(size) || size < 0 || size === 1 || size > maximum ||
      !Array.isArray(domainMin) || !Array.isArray(domainMax) ||
      domainMin.length !== 3 || domainMax.length !== 3 ||
      domainMin.some((min, i) => !Number.isFinite(min) || !Number.isFinite(domainMax[i]) || min >= domainMax[i])) {
    throw new Error('调色工程中的 LUT 记录有误。');
  }
  const limit = size ** dimension * 3 * 4;
  const bytes = fromBase64(table.data, limit);
  if (bytes.byteLength !== limit) throw new Error('调色工程中的 LUT 尺寸有误。');
  const data = new Float32Array(bytes.buffer);
  if (!data.every(Number.isFinite)) throw new Error('调色工程中的 LUT 数据有误。');
  return { size, domainMin, domainMax, data };
}

export function unpackLut(lut) {
  if (!lut) return null;
  return {
    ...fromTable(lut, lut.type === '1d' ? 1 : 3),
    title: typeof lut.title === 'string' ? lut.title.slice(0, 256) : '',
    type: lut.type === '1d' ? '1d' : undefined,
    shaper: lut.shaper ? fromTable(lut.shaper, 1) : null
  };
}
