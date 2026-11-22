import {fromBase64, toBase64} from '../framelab-project.mjs';

const materialLimit = 700_000;

export function canvasBlob(canvas, type, quality) {
  return new Promise((resolve, reject) => canvas.toBlob(blob => {
    if (blob) resolve(blob);
    else reject(new Error('无法生成图片。'));
  }, type, quality));
}

export async function serializeMaterial({id, name, kind, image}) {
  const canvas = document.createElement('canvas');
  const draw = maxSide => {
    const ratio = Math.min(1, maxSide / Math.max(image.naturalWidth, image.naturalHeight));
    canvas.width = Math.max(1, Math.round(image.naturalWidth * ratio));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * ratio));
    canvas.getContext('2d').drawImage(image, 0, 0, canvas.width, canvas.height);
  };
  draw(1600);
  let blob = await canvasBlob(canvas, 'image/webp', .88);
  if (blob.size > materialLimit) {
    draw(980);
    blob = await canvasBlob(canvas, 'image/webp', .78);
  }
  if (blob.size > materialLimit) throw new Error('有素材太大，请缩小后再保存到画布。');
  return {id, name, kind, mime:blob.type, data:toBase64(new Uint8Array(await blob.arrayBuffer()))};
}

export function deserializeMaterial(record) {
  if (!record || !/^image\/(?:webp|jpeg|png)$/.test(record.mime) ||
      typeof record.id !== 'string' || typeof record.name !== 'string') {
    throw new Error('拼贴工程包含无效素材。');
  }
  return new Blob([fromBase64(record.data, materialLimit)], {type:record.mime});
}
