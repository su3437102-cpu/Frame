import { atelierMarkup } from './template.mjs';
import { createTemplateGallery } from './template-gallery.mjs';
import { createCutoutEngine } from './extract.mjs';
import { createCutoutUI } from './cutout-ui.mjs';
import { mountCutoutWorkspace } from './cutout-workspace.mjs';
import { mountStudio } from './studio.mjs';

const assets = new URL('./assets/', import.meta.url).href;
const styles = ['studio', 'cutout', 'templates', 'journal', 'transform-ui', 'framelab'];
let fontsRegistered = false;

export async function mountAtelier(container, {source, project, theme, signal, onClose, onGrade, onSave}) {
  if (!fontsRegistered && globalThis.FontFace) {
    for (const [family, name, weight] of [
      ['Template Brush','template-brush.woff2','400'],
      ['Journal Hand','journal-hand.woff2','600']
    ]) {
      document.fonts.add(new FontFace(family, 'url("' + assets + name + '")', {weight}));
    }
    fontsRegistered = true;
  }
  const root = container.attachShadow({mode:'open'});
  container.dataset.framelabTheme = theme === 'dark' ? 'dark' : 'light';
  const template = document.createElement('template');
  template.innerHTML = atelierMarkup(assets);
  const loadedStyles = styles.map(name => {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = new URL(name + '.css', import.meta.url).href;
    const loaded = new Promise((resolve,reject) => {
      link.addEventListener('load', resolve, {once:true});
      link.addEventListener('error', () => reject(new Error('无法加载拼贴工作台样式。')), {once:true});
    });
    root.append(link);
    return loaded;
  });
  root.append(template.content);
  await Promise.all(loadedStyles);
  signal.throwIfAborted();

  const menu = root.querySelector('.atelier-nav');
  const pages = [...root.querySelector('.page').children];
  const outlet = root.querySelector('.atelier');
  function showSection(name) {
    const id = name === 'repositories' ? 'handbook' : name;
    if (!pages.some(page => page.id === id)) return;
    for (const page of pages) page.hidden = page.id !== id;
    for (const link of menu.querySelectorAll('a')) {
      const active = link.getAttribute('href') === '#' + id;
      link.classList.toggle('active', active);
      if (active) link.setAttribute('aria-current', 'page');
      else link.removeAttribute('aria-current');
    }
    outlet.scrollTop = 0;
  }
  root.addEventListener('click', event => {
    const link = event.target.closest?.('a[href^="#"]');
    if (!link) return;
    event.preventDefault();
    const id = link.getAttribute('href').slice(1);
    if (id === 'repositories' || pages.some(page => page.id === id)) showSection(id);
    else root.getElementById(id)?.scrollIntoView({block:'start'});
  }, {signal});
  root.getElementById('atelier-back').addEventListener('click', onClose, {signal});
  root.getElementById('atelier-grade').addEventListener('click', onGrade, {signal});
  showSection('studio');
  let cutouts;
  const studio = mountStudio({
    root, showSection, assetRoot:assets, source, project, onSave, signal,
    TemplateGallery:createTemplateGallery(root, assets),
    upload:(...args) => cutouts.upload(...args)
  });
  cutouts = mountCutoutWorkspace({
    CutoutUI:createCutoutUI(root, showSection),
    CutoutEngine:createCutoutEngine(signal),
    CollageStudio:studio,
    signal
  });
  return studio;
}
