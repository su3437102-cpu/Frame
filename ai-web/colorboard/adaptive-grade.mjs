import { getOrt } from './ort-runtime.mjs';

const assetBase = new URL('./vendor/adaptive/', import.meta.url);
const imageSize = 256;
const lutSize = 33;
const lutLength = lutSize ** 3 * 3;
let modelPromise;

function loadModel() {
  modelPromise ??= (async () => {
    const [ort, response] = await Promise.all([
      getOrt(),
      fetch(new URL('basis-luts.f32', assetBase)),
    ]);
    if (!response.ok) throw new Error('自适应调色表加载失败。');
    const basis = new Float32Array(await response.arrayBuffer());
    if (basis.length !== 3 * lutLength) throw new Error('自适应调色表文件不完整。');
    const session = await ort.InferenceSession.create(new URL('classifier.onnx', assetBase).href, {
      executionProviders: ['wasm'],
    });
    return { ort, session, basis };
  })().catch(error => {
    modelPromise = undefined;
    throw error;
  });
  return modelPromise;
}

function prepareImage(canvas) {
  const thumbnail = document.createElement('canvas');
  thumbnail.width = imageSize;
  thumbnail.height = imageSize;
  const context = thumbnail.getContext('2d', { willReadFrequently: true });
  if (!context) throw new Error('浏览器无法读取照片像素。');

  // A neutral background keeps transparent areas from turning into black input pixels.
  context.fillStyle = '#808080';
  context.fillRect(0, 0, imageSize, imageSize);
  context.drawImage(canvas, 0, 0, imageSize, imageSize);
  const { data } = context.getImageData(0, 0, imageSize, imageSize);
  const planeLength = imageSize ** 2;
  const channels = new Float32Array(3 * planeLength);
  for (let index = 0; index < planeLength; index++) {
    const pixel = index * 4;
    channels[index] = data[pixel] / 255;
    channels[index + planeLength] = data[pixel + 1] / 255;
    channels[index + 2 * planeLength] = data[pixel + 2] / 255;
  }
  return channels;
}

/** Predict three LUT weights from the original sRGB image and combine the learned bases. */
export async function adaptiveLut(canvas) {
  if (!(canvas?.width && canvas?.height)) throw new Error('请先导入照片。');
  const channels = prepareImage(canvas);
  const { ort, session, basis } = await loadModel();
  const image = new ort.Tensor('float32', channels, [1, 3, imageSize, imageSize]);
  let weights;
  try {
    ({ weights } = await session.run({ image }));
    const [first, second, third] = weights.data;
    if (![first, second, third].every(Number.isFinite)) throw new Error('自动调色模型返回了无效结果。');
    const data = new Float32Array(lutLength);
    for (let index = 0; index < lutLength; index++) {
      data[index] = first * basis[index] + second * basis[lutLength + index] + third * basis[2 * lutLength + index];
    }
    return { size: lutSize, data, domainMin: [0, 0, 0], domainMax: [1, 1, 1], title: 'Image-Adaptive-3DLUT' };
  } finally {
    weights?.dispose();
    image.dispose();
  }
}
