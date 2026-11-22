import { MaterialCache } from './material-cache.mjs';
export function mountCutoutWorkspace({CutoutUI, CutoutEngine, CollageStudio, signal}) {
  const records = new Map();
  const previews = new Map();
  const jobs = new Map();
  const selected = new Set();
  const temporary = new Set();
  const maxFileSize = 32 * 1024 * 1024;
  const maxBatch = 12;
  let queue = Promise.resolve();
  let directory = {supported: typeof window.showDirectoryPicker === 'function', status: 'idle'};
  let directoryBusy = false;
  let composing = false;
  let cacheUnavailable = false;

  const ui = CutoutUI.create({
    upload, retry, toggle, selectAll, clearSelection, compose: () => compose(false),
    addSelected: () => compose(true), chooseDirectory: () => updateDirectory(false),
    reconnectDirectory: () => updateDirectory(true), download, removeSource, useSource
  });


  function urlFor(record) {
    signal.throwIfAborted();
    if (!previews.has(record.id)) previews.set(record.id, URL.createObjectURL(record.blob));
    return previews.get(record.id);
  }

  function render() {
    if (signal.aborted) return;
    const items = [...records.values()].map(record => ({...record, src: urlFor(record)}));
    const cacheMessage = temporary.size || cacheUnavailable
      ? '部分素材只能暂存在本页，请先下载需要保留的 PNG。'
      : '素材已保存在此浏览器的工作区，刷新页面后可以继续使用。';
    ui.render({
      sources: items.filter(item => item.kind === 'source'),
      cutouts: items.filter(item => item.kind === 'cutout'),
      jobs, selected, composing, directory: {...directory, busy: directoryBusy},
      cacheMessage: items.some(item => item.kind === 'cutout') || cacheUnavailable ? cacheMessage : ''
    });
  }

  function setJob(id, phase, progress, message) {
    jobs.set(id, {phase, progress, message});
    render();
  }

  async function refreshDirectory() {
    try {
      const status = await MaterialCache.directoryStatus();
      const {supported, name, access} = status;
      directory = {supported, name, status: access === 'granted' ? 'ready' : name ? 'permission' : 'idle'};
    } catch {
      directory = {...directory, status: 'error', message: '无法读取工作文件夹的授权。'};
    }
    render();
  }

  const initialized = (async () => {
    try {
      const result = await MaterialCache.listStatus();
      cacheUnavailable = !result.persistent;
      for (const record of result.records) {
        if (record?.blob instanceof Blob) records.set(record.id, record);
      }
      const completed = new Set([...records.values()].filter(record => record.kind === 'cutout').map(record => record.sourceId));
      for (const source of records.values()) {
        if (source.kind !== 'source') continue;
        const done = completed.has(source.id);
        jobs.set(source.id, done ? {phase: 'done', progress: 1} : {
          phase: 'error', progress: 0, message: source.extractionError || '上次未完成提取，可以重试。'
        });
      }
    } catch {
      cacheUnavailable = true;
    }
    render();
    await refreshDirectory();
  })();

  async function remember(items) {
    try {
      const result = await MaterialCache.save(items);
      for (const item of items) {
        if (result.persistent) temporary.delete(item.id);
        else temporary.add(item.id);
      }
      cacheUnavailable = !result.persistent;
      if (result.directoryError && items.some(item => item.kind === 'cutout')) {
        await refreshDirectory();
        if (directory.status === 'ready') {
          directory = {...directory, status: 'error', message: '工作文件夹写入未完成，素材仍可在工作区下载。'};
        }
      }
      return result;
    } catch {
      for (const item of items) temporary.add(item.id);
      cacheUnavailable = true;
      return {persistent: false, directory: false};
    }
  }

  function upload(files, {reveal = false} = {}) {
    const list = Array.from(files);
    if (!list.length) return;
    if (reveal) ui.open();
    const batch = list.slice(0, maxBatch);
    queue = queue.then(async () => {
      await initialized;
      const sources = [];
      for (const file of batch) {
        if (file.size === 0 || file.size > maxFileSize) continue;
        const source = {
          id: 'source-' + crypto.randomUUID(), kind: 'source', name: file.name || '导入图片',
          width: 0, height: 0, blob: file, createdAt: Date.now()
        };
        sources.push(source);
        records.set(source.id, source);
        jobs.set(source.id, {phase: 'queued', progress: 0});
      }
      const skipped = batch.length - sources.length;
      const overLimit = list.length - batch.length;
      if (skipped || overLimit) {
        ui.notice([
          skipped ? '跳过了 ' + skipped + ' 个空文件或超过 32 MB 的文件。' : '',
          overLimit ? '一次可导入 ' + maxBatch + ' 张图片，其余图片可分批添加。' : ''
        ].filter(Boolean).join(' '));
      }
      render();
      for (const source of sources) {
        if (signal.aborted) break;
        await run(source.id);
      }
    }).catch(() => ui.notice('无法完成本批图片的读取。请重试。'));
  }

  async function run(id) {
    let source = records.get(id);
    if (!source) return;
    setJob(id, 'working', .02);
    try {
      const image = new Image();
      image.decoding = 'async';
      image.src = urlFor(source);
      try {
        await image.decode();
      } catch {
        throw new Error('浏览器无法读取这张图片，请尝试使用 JPG、PNG 或 WebP。');
      }
      source = {...source, width: image.naturalWidth, height: image.naturalHeight, extractionError: undefined};
      records.set(id, source);
      await remember([source]);
      setJob(id, 'working', .06);
      const components = await CutoutEngine.extract(image, {
        onProgress(value) {
          const progress = Math.min(.96, Math.max(.06, value));
          if (progress - (jobs.get(id)?.progress || 0) >= .04) setJob(id, 'working', progress);
        }
      });
      if (!components.length) throw new Error('未找到清晰的前景元素。可以使用原图，或上传主体更清晰的图片。');
      const stem = source.name.replace(/\.[^.]*$/, '').trim() || '图片';
      const cutouts = components.map((element, index) => ({
        ...element, id: 'cutout-' + crypto.randomUUID(), kind: 'cutout', sourceId: id, createdAt: Date.now(),
        name: stem.slice(0, 48) + ' · 元素 ' + (index + 1)
      }));
      await remember([source, ...cutouts]);
      for (const element of cutouts) records.set(element.id, element);
      setJob(id, 'done', 1);
    } catch (error) {
      const message = error.message || '自动提取未完成，可以重新提取。';
      source = {...source, extractionError: message};
      records.set(id, source);
      if (source.width) await remember([source]);
      setJob(id, 'error', 0, message);
    }
  }

  function retry(id) {
    const job = jobs.get(id);
    if (!records.has(id) || job?.phase !== 'error') return;
    setJob(id, 'queued', 0);
    queue = queue.then(() => run(id)).catch(() => setJob(id, 'error', 0, '重新提取未完成。'));
  }

  function addSelection(id) {
    if (records.get(id)?.kind !== 'cutout' || selected.has(id)) return true;
    if (selected.size >= CollageStudio.materialLimit) return false;
    selected.add(id);
    return true;
  }

  function selectAll(ids) {
    for (const id of ids) {
      if (!addSelection(id)) {
        ui.notice('一次最多可用 ' + CollageStudio.materialLimit + ' 张素材进行拼贴。');
        break;
      }
    }
    render();
  }

  function toggle(id) {
    if (selected.delete(id)) render();
    else selectAll([id]);
  }

  function clearSelection() {
    selected.clear();
    render();
  }

  async function sendToCanvas(materials, append) {
    if (!materials.length || composing) return;
    composing = true;
    render();
    try {
      const count = await CollageStudio.useMaterials(materials, {append});
      ui.notice(append ? '已添加 ' + count + ' 张素材到当前画布。' : '已根据选中的素材生成拼贴。');
    } catch (error) {
      ui.notice(error.message || '这组素材暂时无法加入画布。');
    } finally {
      composing = false;
      render();
    }
  }

  function compose(append) {
    const materials = [...selected].map(id => records.get(id)).filter(Boolean);
    return sendToCanvas(materials, append);
  }

  function useSource(id) {
    const source = records.get(id);
    if (source?.kind === 'source' && source.width) return sendToCanvas([source], true);
  }

  async function updateDirectory(reconnect) {
    if (directoryBusy) return;
    directoryBusy = true;
    try {
      const request = reconnect
        ? MaterialCache.reconnectDirectory()
        : MaterialCache.chooseDirectory();
      render();
      const status = await request;
      await refreshDirectory();
      if (status?.access === 'granted') {
        const result = await MaterialCache.syncDirectory();
        if (result.directory) ui.notice('已同步 ' + result.count + ' 张 PNG 素材到工作文件夹。');
        else if (result.directoryError) throw new Error(result.directoryError);
      }
    } catch (error) {
      if (error.name !== 'AbortError') {
        directory = {...directory, status: 'error', message: '无法写入工作文件夹，可以重新选择文件夹或下载 PNG。'};
      }
    } finally {
      directoryBusy = false;
      render();
    }
  }

  function download(id) {
    const record = records.get(id);
    if (record?.kind !== 'cutout') return;
    const link = document.createElement('a');
    link.href = urlFor(record);
    link.download = record.name.replace(/[\\/:*?"<>|]/g, '-') + '.png';
    document.body.append(link);
    link.click();
    link.remove();
  }

  async function removeSource(id) {
    const job = jobs.get(id);
    if (!records.has(id) || ['working', 'queued'].includes(job?.phase)) return;
    const related = [id, ...[...records.values()].filter(record => record.sourceId === id).map(record => record.id)];
    try {
      await MaterialCache.remove(related);
      for (const key of related) {
        if (previews.has(key)) URL.revokeObjectURL(previews.get(key));
        previews.delete(key);
        selected.delete(key);
        records.delete(key);
        temporary.delete(key);
      }
      jobs.delete(id);
      ui.notice('已从工作区移除这张原图和它的提取素材。');
    } catch {
      ui.notice('移除素材失败，请再试一次。');
    }
    render();
  }
  signal.addEventListener('abort', () => {
    for (const url of previews.values()) URL.revokeObjectURL(url);
    previews.clear();
  }, {once: true});
  return {upload};
}
