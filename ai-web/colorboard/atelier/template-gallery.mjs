export function createTemplateGallery(root, assetRoot) {
  const ratios = {
    landscape: '3∶2 横幅',
    square: '1∶1 方形',
    portrait: '4∶5 竖幅',
    journal: '3∶4 竖幅',
    wide: '16∶9 宽屏'
  };

  function element(tag, className, text) {
    const node = document.createElement(tag);
    node.className = className;
    if (text) node.textContent = text;
    return node;
  }

  function preview(source, description) {
    const image = element('img', 'template-preview');
    image.src = source;
    image.alt = description;
    image.decoding = 'async';
    image.loading = 'lazy';
    return image;
  }

  function create({groups, designs, onApply}) {
    const gallery = root.getElementById('template-groups');
    const actions = new Map();
    const sections = [];

    function makeCard(design) {
      const card = element('li', 'template-card');
      const frame = element('div', 'template-preview-frame');
      frame.append(preview((assetRoot + 'study-') + design.id + '.webp', design.title + '模板预览'));

      const body = element('div', 'template-card-body');
      const heading = element('div', 'template-card-heading');
      heading.append(element('h4', '', design.name));
      const ratio = ratios[design.aspect];
      if (ratio) heading.append(element('span', 'template-ratio', ratio));
      body.append(heading);

      const guidance = design.description || design.action;
      if (guidance) body.append(element('p', 'template-description', guidance));
      if (design.slots?.length) {
        const slots = element('p', 'template-slots');
        slots.append(
          element('span', 'template-slots-label', '图层'),
          element('span', '', design.slots.join(' · '))
        );
        body.append(slots);
      }

      const action = element('button', 'button compact outline template-apply', '应用模板');
      action.type = 'button';
      action.dataset.templateId = design.id;
      action.addEventListener('click', () => onApply(design.id));
      actions.set(design.id, {card, action, name: design.name});
      card.append(frame, body, action);
      return card;
    }

    for (const group of groups) {
      const templates = designs.filter(design => design.group === group.id);
      if (!templates.length) continue;
      const panel = element('article', 'template-group');
      const notes = element('div', 'template-notes');
      const title = element('h3', '', group.title);
      title.id = 'template-group-' + group.id;
      panel.setAttribute('aria-labelledby', title.id);
      notes.append(title);

      if (group.source) notes.append(element('p', 'template-source', group.source));
      if (group.reference) {
        const frame = element('figure', 'template-reference');
        frame.append(preview(group.reference, group.title + '原始素材预览'));
        notes.append(frame);
      }
      if (group.description) notes.append(element('p', 'template-analysis', group.description));
      if (group.rules?.length) {
        const rules = element('ul', 'template-rules');
        for (const rule of group.rules) rules.append(element('li', '', rule));
        notes.append(rules);
      }
      if (group.references?.length) {
        const links = element('ul', 'template-rules template-references');
        links.setAttribute('aria-label', 'GitHub 制作参考');
        for (const {name, url} of group.references) {
          const item = element('li', '');
          const link = element('a', '', name);
          link.href = url;
          link.target = '_blank';
          link.rel = 'noopener noreferrer';
          item.append(link);
          links.append(item);
        }
        notes.append(links);
      }
      if (group.composer) {
        const launch = element('a', 'text-button template-compose-link', '按规则生成');
        launch.href = '#montage-rules';
        notes.append(launch);
      }

      const list = element('ul', 'template-cards');
      list.setAttribute('aria-label', group.title + '构图模板');
      list.append(...templates.map(makeCard));
      panel.append(notes, list);
      if (group.composer) panel.append(root.getElementById('montage-composer-template').content.cloneNode(true));
      sections.push(panel);
    }

    function setActive(id) {
      for (const [key, {card, action, name}] of actions) {
        const active = key === id;
        card.classList.toggle('is-current', active);
        action.textContent = active ? '重新应用' : '应用模板';
        action.setAttribute('aria-pressed', String(active));
        action.setAttribute('aria-label', (active ? '重新应用 ' : '应用模板 ') + name);
      }
    }

    gallery.replaceChildren(...sections);
    setActive(null);
    return {setActive};
  }

  return {create};
}
