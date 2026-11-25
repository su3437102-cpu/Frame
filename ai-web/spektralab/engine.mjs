import * as wasm from './negs/pkg/spektrafilm_wasm.js';

export const loadCatalog = async () => {
  const response = await fetch(new URL('./negs/catalog.json', import.meta.url));
  if (!response.ok) throw new Error('无法读取胶卷与相纸资料');
  return response.json();
};

let wasmReady;
const registered = new Set();
export async function createFilmEngine({gpu = true, module, readData = fetchData} = {}) {
  wasmReady ??= wasm.default(module ? {module_or_path:module} : undefined);
  try {
    await wasmReady;
  } catch (error) {
    wasmReady = null;
    throw error;
  }
  let engine;
  if (gpu && globalThis.navigator?.gpu) {
    try { engine = await wasm.Engine.newGpu(); } catch { /* CPU fallback */ }
  }
  engine ??= wasm.Engine.newCpu();
  return {
    backend: () => engine.backend(),
    load(bytes, edge, whiteBalance) {
      engine.forget();
      return [...engine.load(bytes, edge, Math.min(24_000_000,edge*edge), whiteBalance)];
    },
    original(params,edge) {
      const frame = engine.original(JSON.stringify(params),edge,false);
      try {return {width:frame.width,height:frame.height,rgba:frame.rgba};}
      finally {frame.free();}
    },
    async render(film, paper, params, edge) {
      const visited = new Set();
      let renderTime = 0;
      for (;;) {
        const frame = await engine.render(film, paper, JSON.stringify(params), edge, false, false);
        let missing;
        try {
          missing = frame.missing;
          renderTime += frame.elapsedMs || 0;
          if (!missing.length) {
            return {width:frame.width, height:frame.height, rgba:frame.rgba,
              backend:frame.backend, elapsedMs:renderTime};
          }
        } finally { frame.free(); }
        for (const name of missing) {
          if (visited.has(name)) throw new Error('引擎无法读取胶片配置：' + name);
          visited.add(name);
        }
        await Promise.all(missing.map(async name => {
          if (!registered.has(name)) {
            const bytes = await readData(name);
            wasm.registerData(name, bytes);
            registered.add(name);
          }
        }));
      }
    },
    dispose: () => engine.free()
  };
}

async function fetchData(name) {
  const response = await fetch(new URL('./negs/data/' + name, import.meta.url));
  if (!response.ok) throw new Error('缺少胶片引擎资源：' + name);
  return new Uint8Array(await response.arrayBuffer());
}
