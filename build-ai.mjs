import {mkdirSync,copyFileSync} from 'node:fs';
mkdirSync(new URL('./ai-web/',import.meta.url),{recursive:true});
for(const file of ['ort.wasm.min.mjs','ort-wasm-simd-threaded.mjs','ort-wasm-simd-threaded.wasm'])copyFileSync(new URL('./node_modules/onnxruntime-web/dist/'+file,import.meta.url),new URL('./ai-web/'+file,import.meta.url));