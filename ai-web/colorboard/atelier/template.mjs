import { symbols } from './symbols.mjs';

export function atelierMarkup(assetRoot) {
  return `<div class="atelier">${symbols}
  <header class="site-header">
    <div class="header-inner">
      <div class="atelier-title"><button id="atelier-back" class="text-button" type="button" aria-label="返回画布">‹ <span>返回画布</span></button><span class="atelier-brand">FrameLab</span><h1 id="studio-title">抠图拼图工作台</h1></div>
      <div class="atelier-actions"><button id="atelier-grade" class="button compact outline" type="button" hidden>回到调色</button><button class="button compact outline" id="export" type="button" disabled>导出</button><button id="atelier-save" class="button compact primary" type="button" disabled>保存到画布</button></div>
    </div>
  </header>
  <main class="page">
    <section id="studio" aria-labelledby="studio-title">
      <div class="workspace">
        <div class="board">
          <div class="toolbar">
            <div class="editor-tool-actions">
              <button type="button" class="button compact outline editor-tool" id="tool-brush" aria-pressed="false" aria-controls="brush-options"><svg aria-hidden="true"><use href="#i-brush"/></svg>画笔</button>
              <button type="button" class="button compact outline editor-tool" id="tool-tape"><svg aria-hidden="true"><use href="#i-tape"/></svg>胶带</button>
            </div>
            <div class="board-actions">
              <button type="button" class="icon-button" id="undo" aria-label="撤销" title="撤销 Ctrl/⌘+Z"><svg><use href="#i-undo"/></svg></button>
              <button type="button" class="icon-button" id="redo" aria-label="重做" title="重做 Ctrl/⌘+Shift+Z"><svg><use href="#i-redo"/></svg></button>
              <span class="separator"></span>
              <button type="button" class="button compact outline" id="upload"><svg><use href="#i-upload"/></svg><span>导入照片</span></button>
              <input type="file" accept="image/*,.heic,.heif" id="image-input" multiple hidden>
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
              <canvas id="canvas" width="1200" height="800" tabindex="0" aria-label="拼贴画布。拖动图层，按住空格拖动视图，按 0 回到适合窗口。"></canvas>
              <div id="region-guides" class="region-guides" aria-hidden="true" hidden></div>
            </div>
            <div id="transform-overlay" class="transform-overlay" role="group" aria-label="所选图层的变换手柄" hidden>
              <div id="transform-outline" class="transform-outline" aria-hidden="true"></div>
              <button type="button" id="transform-resize" class="transform-handle transform-resize" title="拖动缩放图层" aria-label="拖动缩放图层"><svg aria-hidden="true"><use href="#i-resize"/></svg></button>
              <button type="button" id="transform-rotate" class="transform-handle transform-rotate" title="拖动旋转图层" aria-label="拖动旋转图层"><svg aria-hidden="true"><use href="#i-rotate"/></svg></button>
              <button type="button" id="transform-tape" class="transform-handle transform-tape" title="沿长轴拉伸胶带" aria-label="沿长轴拉伸胶带" hidden><svg aria-hidden="true"><use href="#i-length"/></svg></button>
            </div>
            <div class="drop-overlay">放下图片添加图层</div>
          </div>
          <div class="board-footer">
            <div class="work-name"><span id="work-title">我的拼贴</span><small id="work-subtitle">1200 × 800 px</small></div>
            <div class="view-options">
              <label id="aspect-label" class="sr-only" for="aspect">画布比例</label>
              <select id="aspect" title="画布比例"><option value="landscape">3∶2 横幅</option><option value="square">1∶1 方形</option><option value="portrait">4∶5 竖幅</option><option value="journal">3∶4 手记</option><option value="wide">16∶9 宽屏</option></select>
              <div class="atelier-view-tools" role="group" aria-label="画布视图">
                <button id="atelier-pan" type="button" class="icon-button" aria-pressed="false" title="平移视图（也可按住空格拖动）" aria-label="平移视图"><svg aria-hidden="true"><use href="#i-hand"/></svg></button>
                <button id="atelier-zoom-out" type="button" class="icon-button" title="缩小视图（− 或 Ctrl/⌘ 加滚轮）" aria-label="缩小视图"><svg aria-hidden="true"><use href="#i-minus"/></svg></button>
                <button id="atelier-zoom-fit" type="button" title="适合窗口（0）" aria-label="适合窗口"><span id="atelier-zoom-readout">适合</span></button>
                <button id="atelier-zoom-in" type="button" class="icon-button" title="放大视图（+ 或 Ctrl/⌘ 加滚轮）" aria-label="放大视图"><svg aria-hidden="true"><use href="#i-plus"/></svg></button>
              </div>
              <button id="view" type="button" class="icon-button" title="预览作品" aria-label="预览作品"><svg><use href="#i-zoom"/></svg></button>
            </div>
          </div>
        </div>
        <aside class="inspector" aria-label="拼贴设置">
          <div class="inspector-tabs" role="tablist" aria-label="编辑面板">
            <button id="tab-compose" role="tab" aria-selected="false" aria-controls="panel-compose" tabindex="-1" type="button">构图</button>
            <button id="tab-layers" role="tab" aria-selected="true" aria-controls="panel-layers" class="selected" type="button">图层 <span id="layer-count"></span></button>
            <button id="tab-regions" role="tab" aria-selected="false" aria-controls="panel-regions" tabindex="-1" type="button">九宫格编辑</button>
          </div>
          <div class="inspector-content">
            <div class="inspector-panel" id="panel-compose" role="tabpanel" aria-labelledby="tab-compose" hidden>
              <h2>艺术手法</h2>
              <div id="styles" class="style-grid" aria-label="艺术手法"></div>
              <p class="style-note" id="style-note"></p>
              <label class="range-label" for="variation">构图变化 <output id="variation-value" for="variation">38%</output></label>
              <input type="range" id="variation" min="0" max="100" value="38">
              <button type="button" id="remix" class="button outline remix"><svg><use href="#i-shuffle"/></svg> 重组构图</button>
            </div>
            <div class="inspector-panel region-panel" id="panel-regions" role="tabpanel" aria-labelledby="tab-regions" hidden>
              <label class="region-count" for="region-count">选区数量
                <select id="region-count">${Array.from({length:9}, (_, i) => `<option value="${i+1}">${i+1} 个</option>`).join('')}</select>
              </label>
              <div id="region-map" class="region-map" role="group" aria-label="选择要导出的选区"></div>
              <p class="region-hint">选区共用图层。选中编号后可单独导出，也可在顶部导出整张。</p>
              <button id="export-region" class="button compact outline" type="button"><svg aria-hidden="true"><use href="#i-download"/></svg><span>导出选区 1</span></button>
            </div>
            <div class="inspector-panel" id="panel-layers" role="tabpanel" aria-labelledby="tab-layers">
              <div class="panel-title"><h2>图层顺序</h2><div class="add-layer-actions"><button type="button" class="text-button" id="add-type"><svg><use href="#i-plus"/></svg> 文字</button><button type="button" class="text-button" id="add-shape"><svg><use href="#i-plus"/></svg> 色纸</button></div></div>
              <details class="journal-layer-tools">
                <summary>添加手记元素</summary>
                <div>
                  <button type="button" class="text-button" id="journal-add-edge">破边印记</button>
                  <button type="button" class="text-button" id="journal-add-fill">填充印纹</button>
                  <button type="button" class="text-button" id="journal-add-type">手记文字</button>
                  <button type="button" class="text-button" id="journal-add-crop-left">左角标</button>
                  <button type="button" class="text-button" id="journal-add-crop-right">右角标</button>
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
                <div id="text-path-row" class="text-path-row" hidden>
                  <button type="button" id="text-path-edit" class="button compact outline" aria-pressed="false">绘制文字路径</button>
                  <button type="button" id="text-path-clear" class="text-button" hidden>恢复直排</button>
                </div>
                <button id="layer-replace" class="button outline compact layer-replace" type="button" hidden><svg aria-hidden="true"><use href="#i-image"/></svg>替换图片</button>
                <input id="layer-image-input" type="file" accept="image/*" hidden>
              </div>
              <p id="layer-empty" hidden>导入照片或抠图后，素材会出现在图层中。</p>
            </div>
          </div>
        </aside>
      </div>
      <div class="materials">
        <div class="materials-title"><h2>素材盘</h2></div>
        <div class="material-list" id="material-list" aria-label="当前可用素材"></div>
        <div class="material-actions">
          <button type="button" class="button compact outline" id="atelier-cutout" aria-expanded="false" aria-controls="cutouts"><svg aria-hidden="true"><use href="#i-cut"/></svg>AI 抠图</button>
          <button type="button" class="text-button sample-button" id="restore">载入示例</button>
        </div>
      </div>
      <p id="message" class="status" role="status" aria-live="polite"></p>
    </section>
    <section id="cutouts" class="editorial cutout-workspace" aria-labelledby="cutout-title" hidden>
      <div class="section-intro cutout-intro"><h2 id="cutout-title" tabindex="-1">AI 抠图</h2><button type="button" id="cutout-hide" class="text-button">收起抠图</button></div>
      <p id="cutout-load-status" class="status" role="status"></p>
      <button id="cutout-retry-load" type="button" class="button compact outline" hidden>重试加载</button>
      <div id="cutout-content"></div>
    </section>
    <nav class="template-jumps" aria-label="模板快速定位"><a href="#journal">野外手记</a><a href="#templates">构图模板</a></nav>
    <section id="journal" class="editorial journal-section" aria-labelledby="journal-title">
      <div class="section-intro journal-intro">
        <div><h2 id="journal-title" tabindex="-1">野外手记</h2></div>
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
                <option value="auto">自动变化</option><option value="code">字码纹样</option><option value="coordinates">坐标</option><option value="contours">等高线</option><option value="grid">测绘网格</option><option value="halftone">半调点阵</option>
              </select>
            </label>
          </div>
          <button type="button" class="button outline journal-regenerate" id="journal-regenerate"><svg aria-hidden="true"><use href="#i-shuffle"/></svg>再排一版</button>
          <p id="journal-status" role="status" aria-live="polite">可先点选样例查看排版效果。</p>
        </div>
        <div class="journal-examples">
          <h3 id="journal-example-title">版式样例</h3>
          <ul aria-labelledby="journal-example-title">
            <li><button type="button" class="journal-example" data-journal-layout="banner"><span class="journal-image-mat"><img data-src="${assetRoot}study-journal-banner.webp" loading="lazy" decoding="async" alt=""></span><span class="journal-example-title">上图下记</span></button></li>
            <li><button type="button" class="journal-example" data-journal-layout="column"><span class="journal-image-mat"><img data-src="${assetRoot}study-journal-column.webp" loading="lazy" decoding="async" alt=""></span><span class="journal-example-title">纵向主景</span></button></li>
            <li><button type="button" class="journal-example" data-journal-layout="drift"><span class="journal-image-mat"><img data-src="${assetRoot}study-journal-drift.webp" loading="lazy" decoding="async" alt=""></span><span class="journal-example-title">错落散页</span></button></li>
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
        <div><h2 id="template-title" tabindex="-1">构图模板</h2></div>
        <p>选择模板开始构图。想换一张图时，在画布里选中对应图层，再点「替换图片」。</p>
      </div>
      <div id="template-groups" class="template-groups"><p class="status" role="status">正在准备构图模板…</p></div>
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
            <button type="button" class="text-button" id="montage-cutouts" aria-controls="cutouts">AI 抠图</button>
          </div>
          <button class="button primary" type="submit">生成可编辑拼贴</button>
        </form>
      </template>
    </section>
    <details class="atelier-reference"><summary>灵感图鉴与构图手册</summary>
    <section id="archive" class="editorial" aria-labelledby="archive-title">
      <div class="section-intro">
        <div><h2 id="archive-title">灵感图鉴</h2></div>
        <p>沿着四件作品，看图像如何被剪开、排列，再获得新的含义。</p>
      </div>
      <div class="reference-grid" id="references"></div>
    </section>
    <section id="handbook" class="editorial" aria-labelledby="handbook-title">
      <div class="section-intro">
        <div><h2 id="handbook-title">构图手册</h2></div>
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
    </details>
  </main>

  <dialog id="export-dialog">
    <form method="dialog" class="dialog-inner">
      <div class="dialog-heading"><h2>导出作品</h2><button type="submit" class="icon-button" value="cancel" aria-label="关闭"><svg><use href="#i-close"/></svg></button></div>
      <label id="export-area-row" hidden>导出范围<select id="export-area"><option value="whole">整张画布</option></select></label>
      <label>文件格式<select id="file-format"><option value="png">PNG</option><option value="jpg">JPG</option></select></label>
      <label>输出倍率<select id="resolution"><option value="1">1×</option><option value="2" selected>2×</option><option value="3">3×</option></select></label>
      <p id="export-size"></p>
      <button type="button" class="button primary" id="download"><svg><use href="#i-download"/></svg> 下载图片</button>
    </form>
  </dialog>
  <dialog id="view-dialog">
    <form method="dialog" class="preview-dialog"><button class="icon-button" aria-label="关闭预览" value="cancel"><svg><use href="#i-close"/></svg></button><canvas id="preview-canvas" aria-label="作品全图"></canvas></form>
  </dialog></div>`;
}
