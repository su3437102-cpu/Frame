import {createFilmEngine} from './engine.mjs';
import {renderGrade} from '../colorboard/grade-engine.mjs';
import {geometryCanvas} from './frame-tools.mjs';

let engine, loaded, cpuOnly = false;
async function render({source, film, paper, params, grade, appearance, edge, kind}) {
  engine ??= await createFilmEngine({gpu:!cpuOnly});
  const whiteBalance = appearance.rawTemperature ?
    JSON.stringify({mode:'custom',temperature:appearance.rawTemperature,tint:appearance.rawTint}) : undefined;
  if (source && (source.id !== loaded?.id || edge !== loaded?.edge || whiteBalance !== loaded?.whiteBalance)) {
    const dimensions = engine.load(new Uint8Array(await source.blob.arrayBuffer()), edge, whiteBalance);
    loaded = {id:source.id, edge, whiteBalance, dimensions};
  }
  const result = await engine.render(film, paper, params, edge);
  if (grade && Object.values(grade).some(Boolean)) {
    result.rgba = renderGrade({width:result.width,height:result.height,data:result.rgba}, grade).data;
  }
  const canvas = geometryCanvas(result,appearance);
  const out = canvas.getContext('2d').getImageData(0,0,canvas.width,canvas.height);
  result.rgba = out.data;
  result.width = out.width;
  result.height = out.height;
  result.sourceSize = loaded.dimensions.slice(2);
  if (kind === 'preview' && !loaded.sentOriginal) {
    const unedited = geometryCanvas(engine.original(params,480));
    result.original = await unedited.convertToBlob({type:'image/jpeg',quality:.9});
    loaded.sentOriginal = true;
  }
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
    self.postMessage({id:data.id, frame}, [frame.rgba.buffer]);
  } catch (error) {
    self.postMessage({id:data.id, error:error.message || String(error)});
  }
};
