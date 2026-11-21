import { getOrt } from '../../ort-runtime.mjs';

const inputSize = 320;
const pixelCount = inputSize ** 2;
const mean = [0.485, 0.456, 0.406];
const deviation = [0.229, 0.224, 0.225];
let modelSession;
let jobs = Promise.resolve();

async function getModel() {
  const ort = await getOrt();
  modelSession ??= ort.InferenceSession.create(
    new URL('./u2netp.onnx', import.meta.url).href,
    { executionProviders: ['wasm'], graphOptimizationLevel: 'all' },
  ).catch(error => {
    modelSession = undefined;
    throw error;
  });
  return { ort, session: await modelSession };
}

function normalize(rgba) {
  let largest = 1;
  for (let i = 0; i < rgba.length; i += 4) {
    largest = Math.max(largest, rgba[i], rgba[i + 1], rgba[i + 2]);
  }
  const values = new Float32Array(pixelCount * 3);
  for (let channel = 0; channel < 3; channel++) {
    const offset = channel * pixelCount;
    for (let i = 0; i < pixelCount; i++) {
      values[offset + i] = (rgba[i * 4 + channel] / largest - mean[channel]) / deviation[channel];
    }
  }
  return values;
}

function toMask(values) {
  let minimum = Infinity;
  let maximum = -Infinity;
  for (const value of values) {
    minimum = Math.min(minimum, value);
    maximum = Math.max(maximum, value);
  }
  const mask = new Uint8ClampedArray(pixelCount);
  const spread = maximum - minimum;
  if (spread > 1e-6) {
    for (let i = 0; i < mask.length; i++) {
      mask[i] = (values[i] - minimum) * 255 / spread;
    }
  }
  return mask;
}

async function run({ id, rgba }) {
  try {
    const { ort, session } = await getModel();
    self.postMessage({ id, status: '正在识别照片主体…' });
    const input = new ort.Tensor('float32', normalize(rgba), [1, 3, inputSize, inputSize]);
    const outputName = session.outputNames[0];
    let prediction;
    try {
      const output = await session.run({ [session.inputNames[0]]: input }, [outputName]);
      prediction = output[outputName];
      const values = prediction.data;
      if (values.length !== pixelCount) throw new Error('Unexpected U²-NetP output dimensions');
      const mask = toMask(values);
      self.postMessage({ id, mask }, [mask.buffer]);
    } finally {
      input.dispose();
      prediction?.dispose();
    }
  } catch (error) {
    self.postMessage({ id, error: error instanceof Error ? error.message : String(error) });
  }
}

self.onmessage = ({ data }) => {
  jobs = jobs.then(() => run(data));
};
