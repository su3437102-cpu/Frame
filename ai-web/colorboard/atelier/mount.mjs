import { assets, loadWorkbenchStyle, mountWorkbenchDom } from './bench-dom.mjs';
import { atelierMarkup } from './template.mjs';
import { mountStudio } from './studio.mjs';

let journalFonts;

function loadJournalFonts() {
  if (!globalThis.FontFace) return Promise.resolve();
  journalFonts ??= Promise.allSettled([
    ['Template Brush', 'template-brush.woff2', '400'],
    ['Journal Hand', 'journal-hand.woff2', '600']
  ].map(async ([family, file, weight]) => {
    const font = new FontFace(family, 'url("' + assets + file + '")', {weight});
    await font.load();
    document.fonts.add(font);
  }));
  return journalFonts;
}

export async function mountAtelier(container, {source, project, theme, signal, onClose, onGrade, onSave, linkedSource}) {
  const root = await mountWorkbenchDom(container, atelierMarkup(assets),
    ['studio', 'templates', 'journal', 'transform-ui', 'framelab'], theme, signal);
  const outlet = root.querySelector('.atelier');
  const el = id => root.getElementById(id);
  el('atelier-back').addEventListener('click', onClose, {signal});
  if (onGrade) {
    el('atelier-grade').hidden = false;
    el('atelier-grade').addEventListener('click', onGrade, {signal});
  }

  let cutouts;
  let cutoutLoading;
  let cutoutStyle;
  const cutoutToggle = el('atelier-cutout');
  const cutoutPanel = el('cutouts');
  const cutoutStatus = el('cutout-load-status');
  const cutoutRetry = el('cutout-retry-load');
  const studio = mountStudio({
    root, revealStudio:() => { outlet.scrollTop = 0; },
    assetRoot:assets, source, project, onSave, signal, loadJournalFonts,
    onPhotoChange:() => cutouts?.refreshLinked()
  });

  function hideCutout() {
    cutoutPanel.hidden = true;
    cutoutToggle.setAttribute('aria-expanded', 'false');
  }

  function closeCutout() {
    hideCutout();
    cutoutToggle.focus();
  }

  async function openCutout() {
    cutoutPanel.hidden = false;
    cutoutToggle.setAttribute('aria-expanded', 'true');
    cutoutPanel.scrollIntoView({block:'start'});
    el('cutout-title').focus({preventScroll:true});
    if (cutouts) {
      cutouts.refreshLinked();
      return;
    }
    if (cutoutLoading) return;
    cutoutRetry.hidden = true;
    cutoutStatus.textContent = '正在载入抠图工具…';
    cutoutLoading = import('./cutout-mount.mjs');
    try {
      const {mountCutout} = await cutoutLoading;
      cutoutStyle ??= loadWorkbenchStyle(root, 'cutout').catch(error => {
        cutoutStyle = undefined;
        throw error;
      });
      await cutoutStyle;
      signal.throwIfAborted();
      cutouts = mountCutout(root, {
        signal, linkedSource, currentPhoto:studio.cutoutPhoto,
        async onMaterials(records, options) {
          const count = await studio.useMaterials(records, options);
          if (!signal.aborted) {
            hideCutout();
            el('canvas').focus({preventScroll:true});
          }
          return count;
        }
      });
      cutoutStatus.textContent = '';
    } catch {
      if (!signal.aborted) {
        cutoutStatus.textContent = '无法载入抠图工具，请重试。';
        cutoutRetry.hidden = false;
      }
    } finally {
      cutoutLoading = undefined;
    }
  }

  cutoutToggle.addEventListener('click', () => {
    if (cutoutPanel.hidden) void openCutout();
    else closeCutout();
  }, {signal});
  el('cutout-hide').addEventListener('click', closeCutout, {signal});
  cutoutRetry.addEventListener('click', openCutout, {signal});
  cutoutPanel.addEventListener('keydown', event => {
    if (event.key !== 'Escape') return;
    event.preventDefault();
    event.stopPropagation();
    closeCutout();
  }, {signal});
  let gallery;
  function openGallery() {
    gallery ??= import('./template-gallery.mjs').then(({createTemplateGallery}) => {
      if (!signal.aborted) studio.mountTemplates(createTemplateGallery(root, assets));
    }).catch(() => {
      gallery = undefined;
      el('template-groups').textContent = '模板暂未载入，可点击「构图模板」重试。';
    });
    return gallery;
  }
  function openJournalPreviews() {
    for (const image of el('journal').querySelectorAll('img[data-src]')) {
      image.src = image.dataset.src;
      image.removeAttribute('data-src');
    }
  }

  root.addEventListener('click', event => {
    if (event.target.closest?.('#montage-cutouts')) return void openCutout();
    const link = event.target.closest?.('a[href^="#"]');
    const target = link && el(link.getAttribute('href').slice(1));
    if (!target) return;
    event.preventDefault();
    if (target.id === 'templates') void openGallery();
    if (target.id === 'journal') openJournalPreviews();
    target.scrollIntoView({block:'start'});
    target.querySelector('h2').focus({preventScroll:true});
  }, {signal});
  root.querySelector('.atelier-reference').addEventListener('toggle', event => {
    if (event.currentTarget.open) studio.mountReferences();
  }, {signal});

  const observer = new IntersectionObserver(entries => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      if (entry.target.id === 'templates') {
        observer.unobserve(entry.target);
        void openGallery();
      } else if (entry.intersectionRatio >= .2) {
        observer.unobserve(entry.target);
        openJournalPreviews();
      }
    }
  }, {root:outlet, threshold:[0, .2]});
  observer.observe(el('journal').querySelector('.journal-examples'));
  observer.observe(el('templates'));
  signal.addEventListener('abort', () => observer.disconnect(), {once:true});
  return studio;
}
