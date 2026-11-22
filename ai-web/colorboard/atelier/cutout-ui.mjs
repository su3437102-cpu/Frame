export function createCutoutUI(root, showSection) {
  const get = id => root.getElementById('cutout-' + id);
  const namespace = 'http://www.w3.org/2000/svg';

  function icon(name) {
    const svg = document.createElementNS(namespace, 'svg');
    const use = document.createElementNS(namespace, 'use');
    use.setAttribute('href', '#i-' + name);
    svg.setAttribute('aria-hidden', 'true');
    svg.append(use);
    return svg;
  }

  function element(tag, className, text) {
    const node = document.createElement(tag);
    node.className = className;
    if (text) node.textContent = text;
    return node;
  }

  function button(className, text, action) {
    const node = element('button', className, text);
    node.type = 'button';
    node.addEventListener('click', action);
    return node;
  }

  function image() {
    const node = document.createElement('img');
    node.alt = '';
    node.decoding = 'async';
    node.loading = 'lazy';
    return node;
  }

  function syncImage(node, source) {
    const next = source || '';
    if ((node.getAttribute('src') || '') !== next) {
      if (next) node.src = next;
      else node.removeAttribute('src');
    }
    node.hidden = !next;
  }

  function syncRows(list, nodes, records, createRow, updateRow) {
    const ids = new Set(records.map(record => record.id));
    for (const [id, row] of nodes) {
      if (ids.has(id)) continue;
      row.node.remove();
      nodes.delete(id);
    }

    let position = list.firstElementChild;
    for (const record of records) {
      let row = nodes.get(record.id);
      if (!row) {
        row = createRow(record.id);
        nodes.set(record.id, row);
      }
      if (position !== row.node) list.insertBefore(row.node, position);
      position = row.node.nextElementSibling;
      updateRow(row, record);
    }
  }

  function create(handlers) {
    const picker = get('picker');
    const fileInput = get('files');
    const sourceRows = new Map();
    const cutoutRows = new Map();
    const noticeText = get('notice');
    let view = {};
    let sourceFilter = null;
    let visibleIds = [];
    let dragDepth = 0;

    const notice = text => {
      noticeText.hidden = !text;
      noticeText.textContent = text || '';
    };

    function open() {
      showSection('cutouts');
      get('title').focus({preventScroll: true});
    }

    function handleFiles(files) {
      if (files.length) handlers.upload(files);
    }

    picker.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', () => {
      const files = Array.from(fileInput.files);
      fileInput.value = '';
      handleFiles(files);
    });

    const hasFiles = event => Array.from(event.dataTransfer?.types || []).includes('Files');
    picker.addEventListener('dragenter', event => {
      if (!hasFiles(event)) return;
      event.preventDefault();
      dragDepth++;
      picker.classList.add('is-dragging');
    });
    picker.addEventListener('dragover', event => {
      if (!hasFiles(event)) return;
      event.preventDefault();
      event.dataTransfer.dropEffect = 'copy';
    });
    picker.addEventListener('dragleave', () => {
      dragDepth = Math.max(0, dragDepth - 1);
      if (!dragDepth) picker.classList.remove('is-dragging');
    });
    picker.addEventListener('drop', event => {
      if (!hasFiles(event)) return;
      event.preventDefault();
      dragDepth = 0;
      picker.classList.remove('is-dragging');
      handleFiles(Array.from(event.dataTransfer.files));
    });

    get('all-sources').addEventListener('click', () => {
      sourceFilter = null;
      render(view);
    });
    get('select-all').addEventListener('click', () => handlers.selectAll(visibleIds));
    get('clear').addEventListener('click', () => handlers.clearSelection());
    get('compose').addEventListener('click', () => handlers.compose());
    get('add').addEventListener('click', () => handlers.addSelected?.());
    get('folder-button').addEventListener('click', () => handlers.chooseDirectory?.());
    get('reconnect').addEventListener('click', () => handlers.reconnectDirectory?.());

    function sourceRow(id) {
      const node = element('li', 'cutout-source-row');
      const source = button('cutout-source-main', '', () => {
        sourceFilter = sourceFilter === id ? null : id;
        render(view);
      });
      const thumb = element('span', 'cutout-source-preview');
      const preview = image();
      thumb.append(icon('image'), preview);
      const information = element('span', 'cutout-source-information');
      const name = element('strong', 'cutout-file-name');
      const status = element('span', 'cutout-secondary cutout-source-status');
      const progress = document.createElement('progress');
      progress.max = 1;
      information.append(name, status, progress);
      source.append(thumb, information);

      const remove = button('icon-button cutout-remove', '', () => handlers.removeSource?.(id));
      remove.append(icon('trash'));
      const actions = element('div', 'cutout-source-actions');
      const retry = button('text-button', '重试抠图', () => handlers.retry?.(id));
      const original = button('text-button', '原图入画布', () => handlers.useSource?.(id));
      actions.append(retry, original);
      node.append(source, remove, actions);
      return {node, source, preview, name, status, progress, remove, actions, retry, original};
    }

    function updateSource(row, record, jobs, totals, composing) {
      const job = jobs.get(record.id);
      const phase = job?.phase || 'done';
      const active = phase === 'queued' || phase === 'working';
      const count = totals.get(record.id) || 0;
      const dimensions = record.width && record.height ? record.width + ' × ' + record.height : '';
      const phaseLabel = {
        queued: '等待处理',
        working: '正在提取',
        error: '提取失败',
        done: count ? '已提取 ' + count + ' 个素材' : '暂未提取到素材'
      }[phase];
      const value = job?.progress;
      const percentage = typeof value === 'number' && Number.isFinite(value)
        ? Math.round(Math.min(1, Math.max(0, value)) * 100)
        : null;

      syncImage(row.preview, record.src);
      row.name.textContent = record.name;
      row.name.title = record.name;
      row.status.textContent = job?.message || phaseLabel || dimensions;
      if (phase === 'working' && percentage !== null) row.status.textContent += ' · ' + percentage + '%';
      row.status.title = row.status.textContent;
      row.source.setAttribute('aria-label', '筛选原图 ' + record.name);
      row.source.setAttribute('aria-pressed', String(sourceFilter === record.id));
      row.node.dataset.phase = phase;
      row.progress.hidden = phase !== 'working';
      row.progress.setAttribute('aria-label', '抠图进度 ' + record.name);
      if (percentage === null) row.progress.removeAttribute('value');
      else row.progress.value = percentage / 100;
      row.remove.hidden = !handlers.removeSource;
      row.remove.disabled = active;
      row.remove.setAttribute('aria-label', '移除原图及其素材 ' + record.name);
      row.remove.title = '移除原图及其素材';
      row.retry.hidden = !handlers.retry || phase !== 'error';
      row.original.hidden = !handlers.useSource || !record.src || !record.width || !record.height;
      row.original.disabled = composing;
      row.actions.hidden = row.retry.hidden && row.original.hidden;
    }

    function cutoutRow(id) {
      const node = element('li', 'cutout-card');
      const choose = button('cutout-card-main', '', () => handlers.toggle(id));
      const preview = element('span', 'cutout-card-preview');
      const thumb = image();
      const mark = element('span', 'cutout-checkbox');
      mark.append(icon('check'));
      preview.append(thumb, mark);
      const details = element('span', 'cutout-card-details');
      const name = element('strong', 'cutout-file-name');
      const info = element('span', 'cutout-secondary');
      details.append(name, info);
      choose.append(preview, details);
      const download = button('icon-button cutout-download', '', () => handlers.download?.(id));
      download.append(icon('download'));
      node.append(choose, download);
      return {node, choose, thumb, name, info, download};
    }

    function updateCutout(row, record, selected) {
      const dimensions = record.width + ' × ' + record.height + ' px';
      syncImage(row.thumb, record.src);
      row.name.textContent = record.name;
      row.name.title = record.name;
      row.choose.setAttribute('aria-label', '选择素材 ' + record.name);
      row.choose.setAttribute('aria-pressed', String(selected.has(record.id)));
      row.info.textContent = dimensions;
      row.download.hidden = !handlers.download;
      row.download.setAttribute('aria-label', '下载透明 PNG ' + record.name);
      row.download.title = '下载透明 PNG';
    }

    function renderDirectory(directory = {}) {
      const choose = get('folder-button');
      const reconnect = get('reconnect');
      const label = get('folder-state');
      const {supported, name, status, message} = directory;
      const needsPermission = status === 'permission';
      const active = status === 'ready';
      choose.hidden = !supported || !handlers.chooseDirectory;
      reconnect.hidden = !supported || !needsPermission || !handlers.reconnectDirectory;
      choose.disabled = directory.busy === true;
      reconnect.disabled = directory.busy === true;
      choose.querySelector('span').textContent = name ? '更换工作文件夹' : '选择工作文件夹';
      if (name) {
        const suffix = needsPermission ? '（待连接）' : status === 'error' ? '（同步失败）' : '';
        label.textContent = '工作文件夹 · ' + name + suffix;
      } else {
        label.textContent = supported ? '素材缓存在当前浏览器。可另存到文件夹。' : '素材缓存在当前浏览器，也可下载 PNG。';
      }
      if (message && !active) label.textContent += ' ' + message;
      label.classList.toggle('cutout-folder-ready', active);
      label.title = label.textContent;
    }

    function render(nextView) {
      view = nextView;
      const {sources = [], cutouts = [], jobs = new Map(), selected = new Set(), directory, cacheMessage} = view;
      const composing = (view.composing ?? view.active) === true;
      if (sourceFilter && !sources.some(record => record.id === sourceFilter)) sourceFilter = null;
      const filter = sources.find(record => record.id === sourceFilter);
      const visible = filter ? cutouts.filter(record => record.sourceId === sourceFilter) : cutouts;
      const totals = new Map();
      for (const cutout of cutouts) totals.set(cutout.sourceId, (totals.get(cutout.sourceId) || 0) + 1);
      visibleIds = visible.map(record => record.id);

      syncRows(get('sources'), sourceRows, sources, sourceRow, (row, record) => updateSource(row, record, jobs, totals, composing));
      syncRows(get('grid'), cutoutRows, visible, cutoutRow, (row, record) => updateCutout(row, record, selected));
      get('source-empty').hidden = sources.length > 0;
      get('all-sources').hidden = !filter;
      get('grid').hidden = visible.length === 0;
      get('empty').hidden = visible.length > 0;
      get('result-count').textContent = cutouts.length ? (filter ? visible.length + ' / ' + cutouts.length : cutouts.length) : '';
      const disabled = selected.size === 0 || composing;
      get('compose').disabled = disabled;
      get('add').disabled = disabled;
      get('add').hidden = !handlers.addSelected;
      get('clear').hidden = selected.size === 0;
      get('select-all').hidden = visible.length === 0;
      get('select-all').disabled = visibleIds.every(id => selected.has(id));
      get('selected').textContent = '已选 ' + selected.size + ' 个素材';
      get('cache-state').textContent = cacheMessage || '';
      get('cache-state').hidden = !cacheMessage;

      const processing = filter
        ? ['queued', 'working'].includes(jobs.get(filter.id)?.phase)
        : [...jobs.values()].some(job => ['queued', 'working'].includes(job.phase));
      let emptyText = '上传后，提取出来的元素会出现在这里。';
      if (processing) emptyText = '正在提取，生成的透明素材会陆续出现。';
      else if (filter) emptyText = '这张原图暂时没有透明素材。';
      else if (sources.length) emptyText = '还没有可选素材。可重试抠图或换一张主体更清晰的图片。';
      get('empty').querySelector('p').textContent = emptyText;
      renderDirectory(directory);
    }

    return {render, notice, open};
  }

  return {create};
}
