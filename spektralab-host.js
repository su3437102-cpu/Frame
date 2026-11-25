(() => {
  const trigger = document.querySelector('.spektralab-entry');
  if (!trigger) return;
  let active;

  function close() {
    if (!active) return;
    const {dialog, controller} = active;
    active = null;
    controller.abort();
    dialog.close();
    dialog.remove();
    trigger.focus();
  }

  function open(event) {
    if (event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    if (active) return;
    const graph = createWorkbenchGraph();
    const item = [...selected].map(id => state.objects.find(object => object.id === id))
      .find(object => object?.type === 'image' && (graph.output(object) || object.src));
    const dialog = document.createElement('dialog');
    dialog.className = 'spektralab-workspace';
    dialog.setAttribute('aria-label','SpektraLab 胶片工作台');
    const iframe = document.createElement('iframe');
    iframe.title = 'SpektraLab 胶片工作台';
    iframe.src = './ai-web/spektralab/index.html';
    const controller = new AbortController();
    active = {dialog, iframe, controller, item, channel:crypto.randomUUID(), initialized:false};
    dialog.addEventListener('cancel',event => {event.preventDefault();close();});
    dialog.append(iframe);
    document.body.append(dialog);
    dialog.showModal();
  }

  function send(session, type, data = {}) {
    session.iframe.contentWindow.postMessage({type, channel:session.channel, ...data}, location.origin);
  }
  addEventListener('message', async ({origin, source, data}) => {
    const session = active;
    if (!session || origin !== location.origin || source !== session.iframe.contentWindow || !data) return;
    if (data.type === 'spektralab:ready' && !session.initialized) {
      session.initialized = true;
      let blob;
      let error;
      try {
        const item = session.item;
        const src = item && (createWorkbenchGraph().output(item) || item.src);
        if (src) {
          const response = await fetch(colorBoardSource(src),{signal:session.controller.signal});
          if (!response.ok) throw new Error('无法读取选中的照片。请从工作台打开图片。');
          blob = await response.blob();
        }
      } catch (problem) {error = problem.message;}
      if (active !== session) return;
      send(session,'spektralab:init',{blob,name:session.item?.name});
      if (error) send(session,'spektralab:error',{message:error});
      return;
    }
    if (data.channel !== session.channel) return;
    if (data.type === 'spektralab:close') {close();return;}
    if (data.type !== 'spektralab:publish' || session.publishing) return;
    const {blob,width,height} = data;
    if (!(blob instanceof Blob) || blob.type !== 'image/jpeg' || blob.size > 12*1024*1024 ||
        !Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1 ||
        width > 2048 || height > 2048) return;
    session.publishing = true;
    try {
      const src = await new Promise((resolve,reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(blob);
      });
      if (active !== session) return;
      const input = session.item;
      const extra = {src,name:'SpektraLab · '+String(data.name || '冲洗结果').slice(0,120),w:300,h:Math.max(1,Math.round(300*height/width))};
      if (input && (input.parentBoardId || null) === (state.activeBoardId || null)) {
        Object.assign(extra,{x:input.x+input.w+72,y:input.y,r:0});
      }
      add('image',extra);
      close();
      toast('已发布到当前画布');
    } catch {
      if (active === session) send(session,'spektralab:error',{message:'结果未能加入画布。请重试或先导出 PNG。'});
    } finally {session.publishing = false;}
  });
  trigger.addEventListener('click',open);
})();
