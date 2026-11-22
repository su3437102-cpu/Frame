import { getOrt } from '../ort-runtime.mjs';

const INPUT_SIDE = 320;
const PIXELS = INPUT_SIDE * INPUT_SIDE;
const MEAN = [.485, .456, .406];
const STDDEV = [.229, .224, .225];
const modelURL = new URL('../vendor/matte/u2netp.onnx', import.meta.url);
let session;

function inputTensor(ort, rgba) {
  let max = 1;
  for (let i = 0; i < rgba.length; i += 4) {
    max = Math.max(max, rgba[i], rgba[i + 1], rgba[i + 2]);
  }
  const rgb = new Float32Array(PIXELS * 3);
  for (let channel = 0; channel < 3; channel++) {
    for (let i = 0; i < PIXELS; i++) {
      rgb[channel * PIXELS + i] = (rgba[i * 4 + channel] / max - MEAN[channel]) / STDDEV[channel];
    }
  }
  return new ort.Tensor('float32', rgb, [1, 3, INPUT_SIDE, INPUT_SIDE]);
}

async function getMask(rgba) {
  const ort = await getOrt();
  session ??= ort.InferenceSession.create(modelURL.href, {executionProviders: ['wasm']});
  let inference;
  try {
    inference = await session;
  } catch (error) {
    session = undefined;
    throw error;
  }
  const outputName = inference.outputNames[0];
  const result = await inference.run({[inference.inputNames[0]]: inputTensor(ort, rgba)}, [outputName]);
  const tensor = result[outputName];
  try {
    return Float32Array.from(tensor.data);
  } finally {
    tensor.dispose();
  }
}

self.addEventListener('message', async event => {
  const {id, rgba} = event.data;
  try {
    const mask = await getMask(new Uint8ClampedArray(rgba));
    self.postMessage({id, mask}, [mask.buffer]);
  } catch (error) {
    self.postMessage({id, error: error instanceof Error ? error.message : String(error)});
  }
});
