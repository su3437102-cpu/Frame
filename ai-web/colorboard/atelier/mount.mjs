import { assets, mountWorkbenchDom } from './bench-dom.mjs';
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

export async function mountAtelier(container, {source, project, theme, signal, onClose, onGrade, onCutout, onSave}) {
  const root = await mountWorkbenchDom(container, atelierMarkup(assets),
    ['studio', 'templates', 'journal', 'transform-ui', 'framelab'], theme, signal);
  const outlet = root.querySelector('.atelier');
  const el = id => root.getElementById(id);
  el('atelier-back').addEventListener('click', onClose, {signal});
  el('atelier-cutout').addEventListener('click', onCutout, {signal});
  if (onGrade) {
    el('atelier-grade').hidden = false;
    el('atelier-grade').addEventListener('click', onGrade, {signal});
  }

  const studio = mountStudio({
    root, revealStudio:() => { outlet.scrollTop = 0; },
    assetRoot:assets, source, project, onSave, signal, loadJournalFonts
  });
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
    if (event.target.closest?.('#montage-cutouts')) return onCutout();
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
