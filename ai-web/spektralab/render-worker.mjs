import {createFilmEngine} from './engine.mjs';
import {renderGrade} from '../colorboard/grade-engine.mjs';
import {geometryCanvas} from './frame-tools.mjs';

let engine, loaded, cpuOnly = false;
async function render({source, film, paper, params, grade, appearance, edge, kind}) {
  engine ??= await createFilmEngine({gpu:!cpuOnly});
  const whiteBalance = appearance?.rawTemperature ?
    JSON.stringify({mode:'custom',temperature:appearance.rawTemperature,tint:appearance.rawTint}) : undefined;
  if (source && (source.id !== loaded?.id || edge !== loaded?.edge || whiteBalance !== loaded?.whiteBalance)) {
    const dimensions = engine.load(new Uint8Array(await source.blob.arrayBuffer()), edge, whiteBalance);
    loaded = {id:source.id, edge, whiteBalance, dimensions};
  }
  if (kind === 'original') {
    // Decode with the camera's white balance and bypass the entire film chain.
    const canvas = geometryCanvas(engine.original(params,edge));
    return {original:await canvas.convertToBlob({type:'image/png'}),sourceSize:loaded.dimensions.slice(2)};
  }
  const result = await engine.render(film, paper, params, edge);
  if (grade && Object.values(grade).some(Boolean)) {
    result.rgba = renderGrade({width:result.width,height:result.height,data:result.rgba}, grade).data;
  }
  let canvas = geometryCanvas(result,appearance);
  if (kind === 'download' || kind === 'publish') {
    const ratio = Math.min(1,edge/Math.max(canvas.width,canvas.height),
      Math.sqrt(24_000_000/(canvas.width*canvas.height)));
    if (ratio < 1) {
      const resized = new OffscreenCanvas(Math.max(1,Math.floor(canvas.width*ratio)),Math.max(1,Math.floor(canvas.height*ratio)));
      const ctx = resized.getContext('2d');
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(canvas,0,0,resized.width,resized.height);
      canvas = resized;
    }
  }
  const out = canvas.getContext('2d').getImageData(0,0,canvas.width,canvas.height);
  result.rgba = out.data;
  result.width = out.width;
  result.height = out.height;
  result.sourceSize = loaded.dimensions.slice(2);
  return result;
}

self.onmessage = async ({data}) => {
  try {
    let frame;
    try {
      frame = await render(data);
    } catch (error) {
      if (cpuOnly || !engine || !/gpu/i.test(engine.backend())) throw error;
      engine.dispose();
      engine = loaded = null;
      cpuOnly = true;
      frame = await render(data);
    }
    self.postMessage({id:data.id, frame}, frame.rgba ? [frame.rgba.buffer] : []);
  } catch (error) {
    self.postMessage({id:data.id, error:error.message || String(error)});
  }
};
