export function atelierMarkup(assetRoot) {
  return `<div class="atelier"><svg class="symbols" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <symbol id="i-plus" viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></symbol>
    <symbol id="i-upload" viewBox="0 0 24 24"><path d="M12 16V4m-5 5 5-5 5 5M4 15v4a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-4"/></symbol>
    <symbol id="i-download" viewBox="0 0 24 24"><path d="M12 4v12m-5-5 5 5 5-5M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3"/></symbol>
    <symbol id="i-undo" viewBox="0 0 24 24"><path d="M9 6 4 11l5 5m-5-5h10a5 5 0 0 1 5 5v2"/></symbol>
    <symbol id="i-redo" viewBox="0 0 24 24"><path d="m15 6 5 5-5 5m5-5H10a5 5 0 0 0-5 5v2"/></symbol>
    <symbol id="i-shuffle" viewBox="0 0 24 24"><path d="M3 6h3c4 0 8 12 12 12h3m-3-3 3 3-3 3M3 18h3c1.6 0 3.3-2 5-4.7M13 10c1.7-2.5 3.3-4 5-4h3m-3-3 3 3-3 3"/></symbol>
    <symbol id="i-layers" viewBox="0 0 24 24"><path d="m12 3 9 5-9 5-9-5 9-5Zm-9 9 9 5 9-5M3 16l9 5 9-5"/></symbol>
    <symbol id="i-image" viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="16" rx="2"/><path d="m4 17 5-5 3 3 3-4 5 6"/><circle cx="8" cy="8.5" r=".75"/></symbol>
    <symbol id="i-github" viewBox="0 0 24 24"><path d="M8 20c-4 1-4-2-6-2m12 4v-3.4c0-1 .1-1.4-.5-2 2.5-.3 5.1-1.2 5.1-5.5A4.2 4.2 0 0 0 17.5 8c.2-.8.2-1.9-.2-3 0 0-.9-.3-3.1 1.2a11.6 11.6 0 0 0-6 0C6 4.7 5 5 5 5c-.4 1.1-.4 2.2-.2 3a4.2 4.2 0 0 0-1.1 3.1c0 4.3 2.6 5.2 5.1 5.5-.5.4-.7 1.1-.7 2V22"/></symbol>
    <symbol id="i-check" viewBox="0 0 24 24"><path d="m5 12 5 5L20 7"/></symbol>
    <symbol id="i-close" viewBox="0 0 24 24"><path d="m6 6 12 12M6 18 18 6"/></symbol>
    <symbol id="i-up" viewBox="0 0 24 24"><path d="M12 20V4m-6 6 6-6 6 6"/></symbol>
    <symbol id="i-down" viewBox="0 0 24 24"><path d="M12 4v16m-6-6 6 6 6-6"/></symbol>
    <symbol id="i-copy" viewBox="0 0 24 24"><rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/></symbol>
    <symbol id="i-trash" viewBox="0 0 24 24"><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 10v7m4-7v7"/></symbol>
    <symbol id="i-eye" viewBox="0 0 24 24"><path d="M2 12s3-6 10-6 10 6 10 6-3 6-10 6S2 12 2 12Z"/><circle cx="12" cy="12" r="2.5"/></symbol>
    <symbol id="i-zoom" viewBox="0 0 24 24"><path d="M9 3H3v6m12-6h6v6M3 15v6h6m12-6v6h-6"/></symbol>
    <symbol id="i-folder" viewBox="0 0 24 24"><path d="M3 6a2 2 0 0 1 2-2h5l2 2h7a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z"/><path d="M3 9h18"/></symbol>
    <symbol id="i-cut" viewBox="0 0 24 24"><circle cx="6" cy="7" r="3"/><circle cx="6" cy="17" r="3"/><path d="m8.4 8.8 12.3 9.7M8.4 15.2l12.3-9.7"/></symbol>
    <symbol id="i-resize" viewBox="0 0 24 24"><path d="M19 12v7h-7M19 19l-7-7M5 12V5h7"/></symbol>
    <symbol id="i-rotate" viewBox="0 0 24 24"><path d="M20 6v5h-5M20 11a8 8 0 1 0-1.5 6"/></symbol>
    <symbol id="i-length" viewBox="0 0 24 24"><path d="M4 8v8m16-8v8M4 12h16m-9-4v8m2-8v8"/></symbol>
    <symbol id="i-brush" viewBox="0 0 24 24"><path d="m9 14 9-10a2 2 0 0 1 3 3l-9 10M3 21c2-2 1-4 2.5-5.4a3.2 3.2 0 0 1 4.5 4.5C8.5 21.5 5.8 21.6 3 21Z"/></symbol>
    <symbol id="i-tape" viewBox="0 0 24 24"><path d="m3 10 15-4 2 8-15 4-1-3 1-2-2-1Z"/><path d="m18 6 2 1-1 2 2 1-1 2 1 1-1 1"/></symbol>
  </svg>
  <header class="site-header">
  <div class="header-inner">
    <div class="atelier-title"><button id="atelier-back" class="text-button" type="button">返回画布</button><span class="atelier-brand">FrameLab</span><h1 id="studio-title">拼贴工作台</h1></div>
    <div class="atelier-actions"><button id="atelier-grade" class="button compact outline" type="button">回到调色</button><button id="atelier-save" class="button compact primary" type="button" disabled>保存到画布</button></div>
  </div>
  <nav class="atelier-nav" aria-label="拼贴工具">
    <a href="#studio">构图与图层</a><a href="#cutouts">抠图素材</a><a href="#templates">构图模板</a><a href="#journal">野外手记</a><a href="#archive">灵感图鉴</a><a href="#handbook">构图手册</a>
  </nav>
  </header>
  <main class="page">
    <section id="studio" aria-labelledby="studio-title">
      <div class="workspace">
        <div class="board">
          <div class="toolbar">
            <div class="board-name"><svg><use href="#i-layers"/></svg><span>拼贴画布</span></div>
            <div class="board-actions">
              <button type="button" class="icon-button" id="undo" aria-label="撤销" title="撤销 Ctrl/⌘+Z"><svg><use href="#i-undo"/></svg></button>
              <button type="button" class="icon-button" id="redo" aria-label="重做" title="重做 Ctrl/⌘+Shift+Z"><svg><use href="#i-redo"/></svg></button>
              <span class="separator"></span>
              <button type="button" class="button compact outline" id="upload"><svg><use href="#i-upload"/></svg><span>导入并抠图</span></button>
              <input type="file" accept="image/*,.heic,.heif" id="image-input" multiple hidden>
            </div>
          </div>
          <div class="editor-tools" role="group" aria-label="画布工具">
            <div class="editor-tool-actions">
              <button type="button" class="button compact outline editor-tool" id="tool-brush" aria-pressed="false" aria-controls="brush-options"><svg aria-hidden="true"><use href="#i-brush"/></svg>画笔</button>
              <button type="button" class="button compact outline editor-tool" id="tool-tape"><svg aria-hidden="true"><use href="#i-tape"/></svg>胶带</button>
            </div>
            <div class="transform-lock">
              <label class="transform-lock-label" title="拖动时按住 Shift 临时切换等比"><input type="checkbox" id="transform-lock" aria-describedby="transform-lock-hint">等比</label>
              <span id="transform-lock-hint"><kbd>Shift</kbd> 临时切换</span>
            </div>
          </div>
          <div class="brush-options" id="brush-options" role="group" aria-label="画笔设置" hidden>
            <label for="brush-color">颜色 <input type="color" id="brush-color" value="#2e2923"></label>
            <label for="brush-size">笔宽 <span class="editor-number"><input type="number" id="brush-size" value="8" step="any" inputmode="decimal"><span aria-hidden="true">px</span></span></label>
            <label for="brush-style">笔触
              <select id="brush-style"><option value="ink">墨线</option><option value="pencil">铅笔</option><option value="marker">马克笔</option></select>
            </label>
          </div>
          <div class="stage" id="stage">
            <div class="stage-inner">
              <img class="poster-fallback" src="${assetRoot}study-dada.webp" alt="" id="poster-fallback">
              <canvas id="canvas" width="1200" height="800" tabindex="0" aria-label="拼贴画布。拖动图层，或在图层面板选择图层并用方向键移动。"></canvas>
            </div>
            <div id="transform-overlay" class="transform-overlay" role="group" aria-label="所选图层的变换手柄" hidden>
              <div id="transform-outline" class="transform-outline" aria-hidden="true"></div>
              <button type="button" id="transform-resize" class="transform-handle transform-resize" title="拖动缩放图层" aria-label="拖动缩放图层"><svg aria-hidden="true"><use href="#i-resize"/></svg></button>
              <button type="button" id="transform-rotate" class="transform-handle transform-rotate" title="拖动旋转图层" aria-label="拖动旋转图层"><svg aria-hidden="true"><use href="#i-rotate"/></svg></button>
              <button type="button" id="transform-tape" class="transform-handle transform-tape" title="沿长轴拉伸胶带" aria-label="沿长轴拉伸胶带" hidden><svg aria-hidden="true"><use href="#i-length"/></svg></button>
              <button type="button" id="text-path-start" class="transform-handle text-path-handle" title="拖动曲线起点" aria-label="曲线起点" hidden></button>
              <button type="button" id="text-path-control" class="transform-handle text-path-handle text-path-control" title="拖动曲线控制点" aria-label="曲线控制点" hidden></button>
              <button type="button" id="text-path-end" class="transform-handle text-path-handle" title="拖动曲线终点" aria-label="曲线终点" hidden></button>
            </div>
            <div class="drop-overlay">放下图片，自动抠图</div>
          </div>
          <div class="board-footer">
            <div class="work-name"><span id="work-title">错版练习</span><small id="work-subtitle">工作室示例</small></div>
            <div class="view-options">
              <label class="sr-only" for="aspect">画布比例</label>
              <select id="aspect" title="画布比例"><option value="landscape">3∶2 横幅</option><option value="square">1∶1 方形</option><option value="portrait">4∶5 竖幅</option><option value="journal">3∶4 手记</option><option value="wide">16∶9 宽屏</option></select>
              <button id="view" type="button" class="icon-button" title="预览作品" aria-label="预览作品"><svg><use href="#i-zoom"/></svg></button>
            </div>
          </div>
        </div>
        <aside class="inspector" aria-label="拼贴设置">
          <div class="inspector-tabs" role="tablist" aria-label="编辑面板">
            <button id="tab-compose" role="tab" aria-selected="true" aria-controls="panel-compose" class="selected" type="button">构图</button>
            <button id="tab-layers" role="tab" aria-selected="false" aria-controls="panel-layers" tabindex="-1" type="button">图层 <span id="layer-count"></span></button>
          </div>
          <div class="inspector-content">
            <div class="inspector-panel" id="panel-compose" role="tabpanel" aria-labelledby="tab-compose">
              <h2>艺术手法</h2>
              <div id="styles" class="style-grid" aria-label="艺术手法"></div>
              <p class="style-note" id="style-note"></p>
              <label class="range-label" for="variation">构图变化 <output id="variation-value" for="variation">38%</output></label>
              <input type="range" id="variation" min="0" max="100" value="38">
              <button type="button" id="remix" class="button outline remix"><svg><use href="#i-shuffle"/></svg> 重组构图</button>
            </div>
            <div class="inspector-panel" id="panel-layers" role="tabpanel" aria-labelledby="tab-layers" hidden>
              <div class="panel-title"><h2>图层顺序</h2><div class="add-layer-actions"><button type="button" class="text-button" id="add-type"><svg><use href="#i-plus"/></svg> 文字</button><button type="button" class="text-button" id="add-shape"><svg><use href="#i-plus"/></svg> 色纸</button></div></div>
              <details class="journal-layer-tools">
                <summary>添加手记元素</summary>
                <div>
                  <button type="button" class="text-button" id="journal-add-edge">破边印记</button>
                  <button type="button" class="text-button" id="journal-add-fill">填充印纹</button>
                  <button type="button" class="text-button" id="journal-add-type">手记文字</button>
                </div>
              </details>
              <ul id="layer-list" aria-label="从前景到背景的图层"></ul>
              <div id="layer-controls">
                <div class="layer-actions" aria-label="所选图层操作">
                  <button type="button" class="icon-button" id="layer-up" aria-label="向上一层" title="向上一层"><svg><use href="#i-up"/></svg></button>
                  <button type="button" class="icon-button" id="layer-down" aria-label="向下一层" title="向下一层"><svg><use href="#i-down"/></svg></button>
                  <button type="button" class="icon-button" id="layer-toggle" aria-label="显示或隐藏" title="显示或隐藏"><svg><use href="#i-eye"/></svg></button>
                  <button type="button" class="icon-button" id="layer-copy" aria-label="复制图层" title="复制副本（Ctrl/⌘+D）"><svg><use href="#i-copy"/></svg></button>
                  <button type="button" class="icon-button" id="layer-delete" aria-label="删除图层" title="删除图层"><svg><use href="#i-trash"/></svg></button>
                </div>
                <label class="range-label" for="opacity">不透明度 <output id="opacity-value"></output></label>
                <input type="range" id="opacity" min="0" max="100" step="1">
                <div class="layer-selects">
                  <label>裁切<select id="mask"><option value="rect">矩形</option><option value="tear">撕纸</option><option value="cut">斜切</option><option value="circle">椭圆</option><option value="polygon" hidden disabled>模板轮廓</option></select></label>
                  <label>混合<select id="blend"><option value="source-over">正常</option><option value="multiply">正片叠底</option><option value="screen">滤色</option><option value="overlay">叠加</option></select></label>
                </div>
                <details class="layer-transform-fields">
                  <summary>图层变换</summary>
                <div class="transform-inputs" role="group" aria-label="图层变换">
                  <label for="rotation">旋转
                    <span class="editor-number"><input type="number" id="rotation" value="0" step="any" inputmode="decimal"><span aria-hidden="true">°</span></span>
                  </label>
                  <output class="sr-only" id="rotation-value" for="rotation"></output>
                  <label for="scale">整体缩放
                    <span class="editor-number"><input type="number" id="scale" value="100" step="any" inputmode="decimal"><span aria-hidden="true">%</span></span>
                  </label>
                  <output class="sr-only" id="scale-value" for="scale"></output>
                  <label for="width-scale">横向缩放
                    <span class="editor-number"><input type="number" id="width-scale" value="100" step="any" inputmode="decimal"><span aria-hidden="true">%</span></span>
                  </label>
                  <output class="sr-only" id="width-scale-value" for="width-scale"></output>
                  <label for="height-scale">纵向缩放
                    <span class="editor-number"><input type="number" id="height-scale" value="100" step="any" inputmode="decimal"><span aria-hidden="true">%</span></span>
                  </label>
                  <output class="sr-only" id="height-scale-value" for="height-scale"></output>
                </div>
                </details>
                <label class="color-row" id="text-row" hidden>文字内容<textarea rows="2" id="layer-text" maxlength="72"></textarea></label>
                <label class="color-row" id="color-row" hidden>纸片颜色<input type="color" id="layer-color"></label>
                <label class="color-row" id="tone-row">图片色调<select id="tone"><option value="original">原色</option><option value="mono">黑白</option><option value="warm">暖褐</option></select></label>
                <label class="color-row" id="journal-pattern-row" hidden>印纹样式
                  <select id="journal-pattern"></select>
                </label>
                <div id="text-curve-row" class="text-curve-row" hidden>
                  <div class="text-curve-field">
                    <label for="text-curve">文字弧度</label>
                    <input type="range" id="text-curve" min="-100" max="100" value="0">
                  </div>
                  <button type="button" id="text-path-edit" class="button compact outline" aria-pressed="false" title="在画布上拖动曲线起点、控制点和终点">编辑曲线</button>
                </div>
                <label class="color-row" id="journal-font-row" hidden>手记字体
                  <select id="journal-font">
                    <option value="zh-brush">中文 · 手写笔触</option><option value="zh-ink">中文 · 墨迹</option><option value="zh-song">中文 · 宋体</option><option value="en-hand">英文 · 手写</option><option value="en-serif">英文 · 衬线</option><option value="en-mono">英文 · 等宽</option>
                  </select>
                </label>
                <button id="layer-replace" class="button outline compact layer-replace" type="button" hidden><svg aria-hidden="true"><use href="#i-image"/></svg>替换图片</button>
                <input id="layer-image-input" type="file" accept="image/*" hidden>
              </div>
              <p id="layer-empty" hidden>在画布上点选图层，或从上方列表选择。</p>
            </div>
          </div>
          <div class="export-row">
            <button class="button primary" id="export" type="button"><svg><use href="#i-download"/></svg> 导出作品</button>
          </div>
        </aside>
      </div>
      <div class="materials">
        <div class="materials-title"><h2>素材盘</h2><p>点选素材可再贴一层</p></div>
        <div class="material-list" id="material-list" aria-label="当前可用素材"></div>
        <button type="button" class="text-button sample-button" id="restore" title="恢复可编辑的工作室示例">载入示例</button>
      </div>
      <p id="message" class="status" role="status" aria-live="polite"></p>
    </section>
    <section id="cutouts" class="editorial cutout-workspace" aria-labelledby="cutout-title">
      <div class="section-intro cutout-intro">
        <div><h2 id="cutout-title" tabindex="-1">抠图工作区</h2><p>上传照片，自动提取前景元素。勾选想用的素材，再开始拼贴。</p></div>
        <div class="cutout-folder">
          <div class="cutout-folder-actions">
            <button type="button" class="button outline compact" id="cutout-reconnect" hidden>重新连接</button>
            <button type="button" class="button outline compact" id="cutout-folder-button" hidden><svg aria-hidden="true"><use href="#i-folder"/></svg><span>选择工作文件夹</span></button>
          </div>
          <p id="cutout-folder-state">素材缓存在当前浏览器。</p>
        </div>
      </div>
      <div class="cutout-board">
        <div class="cutout-sources">
          <button type="button" id="cutout-picker" class="cutout-picker">
            <span class="cutout-picker-icon"><svg aria-hidden="true"><use href="#i-upload"/></svg></span>
            <strong>选择图片</strong><span>也可以拖到这里，支持多张</span>
          </button>
          <input id="cutout-files" type="file" accept="image/*,.heic,.heif" multiple hidden>
          <div class="cutout-list-heading"><h3>原图</h3><button id="cutout-all-sources" class="text-button" type="button" hidden>查看全部</button></div>
          <ul id="cutout-sources" class="cutout-source-list" aria-label="已导入原图"></ul>
          <p id="cutout-source-empty" class="cutout-secondary">待导入图片</p>
        </div>
        <div class="cutout-results">
          <div class="cutout-results-heading">
            <h3>透明素材 <span id="cutout-result-count"></span></h3>
            <div class="cutout-selection-tools">
              <button id="cutout-select-all" type="button" class="text-button" hidden>全选可见素材</button>
              <button id="cutout-clear" type="button" class="text-button" hidden>清空勾选</button>
            </div>
          </div>
          <div id="cutout-empty" class="cutout-empty">
            <svg aria-hidden="true"><use href="#i-cut"/></svg>
            <p>上传后，提取出来的元素会出现在这里。</p>
          </div>
          <ul id="cutout-grid" class="cutout-grid" aria-label="提取的透明素材" hidden></ul>
          <div class="cutout-footer">
            <div>
              <p id="cutout-selected">已选 0 个素材</p>
              <p id="cutout-cache-state" class="cutout-secondary" hidden></p>
            </div>
            <div class="cutout-compose-actions">
              <button id="cutout-add" type="button" class="button outline" hidden disabled><svg aria-hidden="true"><use href="#i-plus"/></svg>添加到画布</button>
              <button id="cutout-compose" type="button" class="button primary" disabled><svg aria-hidden="true"><use href="#i-layers"/></svg>用所选素材拼贴</button>
            </div>
          </div>
        </div>
      </div>
      <p id="cutout-notice" class="status" role="status" aria-live="polite" hidden></p>
    </section>
    <section id="journal" class="editorial journal-section" aria-labelledby="journal-title">
      <div class="section-intro journal-intro">
        <div><h2 id="journal-title">野外手记</h2></div>
        <p>上传照片，自动排成 3∶4 野外手记。主景、双语批注和印纹都可以在画布里调整。</p>
      </div>
      <div class="journal-board">
        <div class="journal-controls">
          <button type="button" class="journal-pick" id="journal-pick" aria-describedby="journal-status">
            <svg aria-hidden="true"><use href="#i-upload"/></svg>
            <span><strong>上传照片并排版</strong><small>选择或拖放 2–5 张照片</small></span>
          </button>
          <input id="journal-files" type="file" accept="image/*" multiple hidden>
          <div class="journal-options" role="group" aria-label="手记排版偏好">
            <label for="journal-layout">版式
              <select id="journal-layout">
                <option value="auto">智能匹配</option><option value="banner">上图下记</option><option value="column">纵向主景</option><option value="drift">错落散页</option>
              </select>
            </label>
            <label for="journal-density">密度
              <select id="journal-density">
                <option value="quiet">留白</option><option value="balanced" selected>均衡</option><option value="rich">繁密</option>
              </select>
            </label>
            <label for="journal-hero">主照片
              <select id="journal-hero"><option value="auto">自动选择</option></select>
            </label>
            <label for="journal-print">填充印纹
              <select id="journal-print">
                <option value="auto">自动变化</option><option value="code">字码纹样</option><option value="coordinates">坐标</option><option value="contours">等高线</option><option value="grid">测绘网格</option><option value="notes">笔记字样</option><option value="halftone">半调点阵</option><option value="stamps">档案印戳</option>
              </select>
            </label>
          </div>
          <button type="button" class="button outline journal-regenerate" id="journal-regenerate"><svg aria-hidden="true"><use href="#i-shuffle"/></svg>再排一版</button>
          <p id="journal-status" role="status" aria-live="polite">可先点选样例查看排版效果。</p>
        </div>
        <div class="journal-examples">
          <h3 id="journal-example-title">版式样例</h3>
          <ul aria-labelledby="journal-example-title">
            <li><button type="button" class="journal-example" data-journal-layout="banner"><span class="journal-image-mat"><img src="${assetRoot}study-journal-banner.webp" loading="lazy" decoding="async" alt=""></span><span class="journal-example-title">上图下记</span></button></li>
            <li><button type="button" class="journal-example" data-journal-layout="column"><span class="journal-image-mat"><img src="${assetRoot}study-journal-column.webp" loading="lazy" decoding="async" alt=""></span><span class="journal-example-title">纵向主景</span></button></li>
            <li><button type="button" class="journal-example" data-journal-layout="drift"><span class="journal-image-mat"><img src="${assetRoot}study-journal-drift.webp" loading="lazy" decoding="async" alt=""></span><span class="journal-example-title">错落散页</span></button></li>
          </ul>
        </div>
      </div>
      <ul class="journal-rules" aria-label="手记构图要点">
        <li><strong>先看照片</strong><p>让一张图领起版面，其余照片用作近景或细节。</p></li>
        <li><strong>局部破边</strong><p>让印记掠过一段照片边缘，留出完整的主景轮廓。</p></li>
        <li><strong>双语有主次</strong><p>中文标题承接主景，英文小字像档案标签一样退到旁边。</p></li>
        <li><strong>淡纹留白</strong><p>用浅色网格、点阵或线条把照片与批注连在一起。</p></li>
      </ul>
    </section>
    <section id="templates" class="editorial template-library" aria-labelledby="template-title">
      <div class="section-intro">
        <div><h2 id="template-title">构图模板</h2></div>
        <p>选择模板开始构图。想换一张图时，在画布里选中对应图层，再点「替换图片」。</p>
      </div>
      <div id="template-groups" class="template-groups"></div>
      <template id="montage-composer-template">
        <form id="montage-rules" class="montage-rules" aria-labelledby="montage-title">
          <header>
            <h4 id="montage-title">按规则生成</h4>
            <p>先选同题材的主体和整体造型，再选剪影、细节与点缀色。</p>
          </header>
          <div class="montage-options">
            <label>主体素材<select name="theme"></select></label>
            <label>整体造型<select name="shape"></select></label>
            <label>跨界元素一<select name="first"></select></label>
            <label>跨界元素二<select name="second"></select></label>
            <label>点线面与纹理<select name="detail"></select></label>
            <label>配色<select name="palette"></select></label>
          </div>
          <div class="montage-input">
            <label><input type="checkbox" name="uploads" disabled> 用素材盘里的上传图片做主体</label>
            <span id="montage-materials" role="status"></span>
            <a class="text-button" href="#cutouts">添加素材</a>
          </div>
          <button class="button primary" type="submit">生成可编辑拼贴</button>
        </form>
      </template>
    </section>
    <section id="archive" class="editorial" aria-labelledby="archive-title">
      <div class="section-intro">
        <div><p class="eyebrow"><span class="asterisk" aria-hidden="true">✳</span> VISUAL ARCHIVE</p><h2 id="archive-title">灵感图鉴</h2></div>
        <p>沿着四件作品，看图像如何被剪开、排列，再获得新的含义。</p>
      </div>
      <div class="reference-grid" id="references"></div>
    </section>
    <section id="handbook" class="editorial" aria-labelledby="handbook-title">
      <div class="section-intro">
        <div><p class="eyebrow"><span class="asterisk" aria-hidden="true">✳</span> COMPOSITION NOTES</p><h2 id="handbook-title">构图手册</h2></div>
        <p>每条规则都可以在工作台里试一遍，也可以从样片开始逐层改写。</p>
      </div>
      <div class="rule-list" id="rules"></div>
      <details class="image-credits"><summary>可编辑样例的素材出处</summary><div id="image-credits"></div></details>
      <div class="source-area" id="repositories">
        <h3><svg><use href="#i-github"/></svg> 编辑器参考</h3>
        <div class="repo-grid">
          <article><h4>Ultra Collage</h4><p>考察自由图层、素材盘和画布变换。工作台采用独立图层，先由规则排布，再逐片编辑。</p><a href="https://github.com/viceduong/ultra-collage" target="_blank" rel="noopener noreferrer">查看仓库</a></article>
          <article><h4>web-collage</h4><p>考察斜切接缝与图片合成。这里把切口做成逐层可选的蒙版，和撕纸、椭圆一起使用。</p><a href="https://github.com/ongxeno/web-collage" target="_blank" rel="noopener noreferrer">查看仓库</a></article>
          <article><h4>Images to Montage</h4><p>考察浏览器内解码、画布合成与导出。工作台用 Canvas 2D 合成，图像处理在设备内完成。</p><a href="https://github.com/html-js/images-to-montage" target="_blank" rel="noopener noreferrer">查看仓库</a></article>
          <article><h4>Konva Transformer</h4><p>参考角点缩放、等比切换和角外旋转区。画布上的手柄以图层自身坐标计算。</p><a href="https://konvajs.org/api/Konva.Transformer.html" target="_blank" rel="noopener noreferrer">查看交互参考</a></article>
          <article><h4>Pointer Events</h4><p>用同一套指针事件处理鼠标、手指和触控笔，把每条笔迹保存成独立图层。</p><a href="https://developer.mozilla.org/en-US/docs/Web/API/Pointer_events/Using_Pointer_Events" target="_blank" rel="noopener noreferrer">查看画布示例</a></article>
          <article><h4>Canvas 路径裁切</h4><p>用锯齿轮廓裁切胶带的半透明底色和纤维。胶带长度和撕口深度各自计算。</p><a href="https://html.spec.whatwg.org/multipage/canvas.html#dom-context-2d-clip" target="_blank" rel="noopener noreferrer">查看裁切规范</a></article>
        </div>
      </div>
    </section>
  </main>

  <dialog id="export-dialog">
    <form method="dialog" class="dialog-inner">
      <div class="dialog-heading"><h2>导出作品</h2><button type="submit" class="icon-button" value="cancel" aria-label="关闭"><svg><use href="#i-close"/></svg></button></div>
      <label>文件格式<select id="file-format"><option value="png">PNG</option><option value="jpg">JPG</option></select></label>
      <label>输出尺寸<select id="resolution"><option value="1">长边 1200 px</option><option value="2" selected>长边 2400 px</option><option value="3">长边 3600 px</option></select></label>
      <p id="export-size"></p>
      <button type="button" class="button primary" id="download"><svg><use href="#i-download"/></svg> 下载图片</button>
    </form>
  </dialog>
  <dialog id="view-dialog">
    <form method="dialog" class="preview-dialog"><button class="icon-button" aria-label="关闭预览" value="cancel"><svg><use href="#i-close"/></svg></button><canvas id="preview-canvas" aria-label="作品全图"></canvas></form>
  </dialog></div>`;
}
