import { mountWorkbenchDom } from './bench-dom.mjs';
import { cutoutMarkup } from './cutout-template.mjs';
import { createCutoutUI } from './cutout-ui.mjs';
import { mountCutoutWorkspace } from './cutout-workspace.mjs';

export async function mountCutout(container, {theme, signal, onClose, onCollage, onMaterials, linkedSource}) {
  const root = await mountWorkbenchDom(container, cutoutMarkup, ['studio', 'cutout', 'framelab'], theme, signal);
  const el = id => root.getElementById(id);
  let engine;
  const cutouts = mountCutoutWorkspace({
    CutoutUI:createCutoutUI(root),
    CutoutEngine: {
      async extract(...args) {
        engine ??= import('./extract.mjs').then(({createCutoutEngine}) => {
          signal.throwIfAborted();
          return createCutoutEngine(signal);
        }).catch(error => {
          engine = undefined;
          throw error;
        });
        return (await engine).extract(...args);
      }
    },
    sendMaterials:onMaterials,
    signal
  });
  el('cutout-back').addEventListener('click', onClose, {signal});
  el('cutout-to-collage').addEventListener('click', onCollage, {signal});
  if (linkedSource) {
    const button = el('cutout-linked');
    button.hidden = false;
    button.addEventListener('click', async () => {
      button.disabled = true;
      try {
        const photo = await linkedSource();
        if (photo) await cutouts.upload([new File([photo.blob], photo.name || '画布照片', {type:photo.blob.type})]);
      } catch (error) {
        if (!signal.aborted) {
          const notice = el('cutout-notice');
          notice.textContent = error.message || '无法读取当前照片。';
          notice.hidden = false;
        }
      } finally {
        button.disabled = false;
      }
    }, {signal});
  }
  return cutouts;
}
