export const assets = new URL('./assets/', import.meta.url).href;

export async function mountWorkbenchDom(container, markup, styles, theme, signal) {
  const root = container.attachShadow({mode:'open'});
  container.dataset.framelabTheme = theme === 'dark' ? 'dark' : 'light';
  const template = document.createElement('template');
  template.innerHTML = markup;
  const loadedStyles = styles.map(name => {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = new URL(name + '.css', import.meta.url).href;
    const loaded = new Promise((resolve, reject) => {
      link.addEventListener('load', resolve, {once:true});
      link.addEventListener('error', () => reject(new Error('无法加载工作台样式。')), {once:true});
    });
    root.append(link);
    return loaded;
  });
  root.append(template.content);
  await Promise.all(loadedStyles);
  signal.throwIfAborted();
  return root;
}
