import {mkdirSync,copyFileSync} from 'node:fs';
mkdirSync(new URL('./ai-web/',import.meta.url),{recursive:true});
for(const file of ['ort.wasm.min.mjs','ort-wasm-simd-threaded.mjs','ort-wasm-simd-threaded.wasm'])copyFileSync(new URL('./node_modules/onnxruntime-web/dist/'+file,import.meta.url),new URL('./ai-web/'+file,import.meta.url));const vision = new URL('./node_modules/@mediapipe/tasks-vision/', import.meta.url);
const visionRuntime = new URL('./ai-web/mediapipe/', import.meta.url);
mkdirSync(new URL('wasm/', visionRuntime), {recursive:true});
for (const asset of ['vision_bundle.mjs','wasm/vision_wasm_internal.js','wasm/vision_wasm_internal.wasm','wasm/vision_wasm_nosimd_internal.js','wasm/vision_wasm_nosimd_internal.wasm']) {
  copyFileSync(new URL(asset, vision), new URL(asset, visionRuntime));
}
