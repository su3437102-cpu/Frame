import { cutoutMarkup } from './cutout-template.mjs';
import { createCutoutUI } from './cutout-ui.mjs';
import { mountCutoutWorkspace } from './cutout-workspace.mjs';

export function mountCutout(root, {signal, onMaterials, linkedSource, currentPhoto}) {
  const el = id => root.getElementById(id);
  const template = document.createElement('template');
  template.innerHTML = cutoutMarkup;
  el('cutout-content').replaceChildren(template.content);
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
  const button = el('cutout-linked');
  function refreshLinked() {
    button.hidden = !currentPhoto() && !linkedSource;
  }

  button.addEventListener('click', async () => {
    button.disabled = true;
    try {
      const photo = currentPhoto() || await linkedSource?.();
      if (!photo) throw new Error('请导入一张照片后再使用抠图。');
      signal.throwIfAborted();
      await cutouts.upload([new File([photo.blob], photo.name || '画布照片', {type:photo.blob.type})]);
    } catch (error) {
      if (!signal.aborted) {
        const notice = el('cutout-notice');
        notice.textContent = error.message || '无法读取当前照片。';
        notice.hidden = false;
      }
    } finally {
      button.disabled = false;
      refreshLinked();
    }
  }, {signal});
  refreshLinked();
  return {refreshLinked};
}
