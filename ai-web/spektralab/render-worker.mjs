import {createFilmEngine} from './engine.mjs';
import {renderGrade} from '../colorboard/grade-engine.mjs';

let engine, loaded, cpuOnly = false;
async function render({source, film, paper, params, grade, edge}) {
  engine ??= await createFilmEngine({gpu:!cpuOnly});
  if (source && (source.id !== loaded?.id || edge !== loaded?.edge)) {
    engine.load(new Uint8Array(await source.blob.arrayBuffer()), edge);
    loaded = {id:source.id, edge};
  }
  const result = await engine.render(film, paper, params, edge);
  if (grade && Object.values(grade).some(Boolean)) {
    result.rgba = renderGrade({width:result.width,height:result.height,data:result.rgba}, grade).data;
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
