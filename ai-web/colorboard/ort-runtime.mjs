let runtime;

export function getOrt() {
  runtime ??= import('./vendor/ort/ort.wasm.min.mjs').then(({ default: ort }) => {
    ort.env.wasm.numThreads = 1;
    ort.env.wasm.proxy = false;
    ort.env.wasm.wasmPaths = new URL('./vendor/ort/', import.meta.url).href;
    return ort;
  }).catch(error => {
    runtime = undefined;
    throw error;
  });
  return runtime;
}
