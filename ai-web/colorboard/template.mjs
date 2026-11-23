const markup = `
<div class="colorboard-layout">
  <header class="topbar">
    <button id="framelab-back" class="button" type="button" aria-label="返回画布" title="返回画布"><i data-icon="chevron-right"></i><span>返回画布</span></button>
    <span class="brand">FrameLab</span>
    <span class="header-divider" aria-hidden="true"></span>
    <div class="breadcrumbs"><h1>AI 调色</h1><i data-icon="chevron-right"></i><strong id="doc-name">未连接照片</strong></div>
    <div class="top-actions">
      <button id="framelab-collage" class="button" type="button" aria-label="拼图工作台" title="拼图工作台"><i data-icon="cards"></i><span>拼图工作台</span></button>
      <button id="framelab-cutout" class="button" type="button" aria-label="抠图工作台" title="抠图工作台"><i data-icon="mask"></i><span>抠图工作台</span></button>
      <button id="open-file" class="button" type="button" aria-label="打开照片" title="打开照片"><i data-icon="upload"></i><span>打开照片</span></button>
      <button id="extract-look-header" class="button" type="button" aria-label="提取调色" title="提取调色" aria-haspopup="dialog" aria-controls="extract-look-dialog"><i data-icon="sparkles"></i><span>提取调色</span></button>
      <button id="export-open" class="button" type="button" aria-label="导出" title="导出"><i data-icon="download"></i><span>导出</span></button>
      <button id="framelab-save" class="button button-dark" type="button" aria-label="保存到画布" title="保存到画布" disabled><i data-icon="check"></i><span>保存到画布</span></button>
    </div>
    <input id="file-input" type="file" accept="image/jpeg,image/png,image/webp,image/avif,image/gif,image/bmp" hidden>
    <input id="lut-input" type="file" accept=".cube" hidden>
    <input id="look-import-input" type="file" accept=".json,application/json" hidden>
  </header>

  <main class="workbench">
    <nav class="rail" aria-label="工作台工具">
      <button class="rail-button active" data-rail="tone" title="调色"><i data-icon="sliders"></i><span>调色</span></button>
      <button class="rail-button" data-rail="glow" title="辉光"><i data-icon="sparkles"></i><span>辉光</span></button>
      <button class="rail-button" data-rail="mask" title="蒙版"><i data-icon="mask"></i><span>蒙版</span></button>
      <button class="rail-button" data-rail="presets" title="预设"><i data-icon="cards"></i><span>预设</span></button>
      <span class="rail-spacer"></span>
      <button class="rail-button" id="help-open" title="使用指南"><i data-icon="help"></i><span>指南</span></button>
    </nav>

    <section class="board board-heading" id="board" aria-label="照片画板">
      <div class="viewport" id="viewport">
        <div class="photo-stage" id="photo-stage" aria-label="照片预览">
          <canvas id="result-canvas"></canvas>
          <canvas id="original-canvas" aria-hidden="true"></canvas>
          <canvas id="overlay-canvas" aria-hidden="true"></canvas>
          <div id="box-selection" hidden aria-label="框选主体" tabindex="0"></div>
          <div id="mask-brush-cursor" aria-hidden="true" hidden></div>
          <span id="before-tag" class="image-tag before-tag" hidden>原图</span>
          <span id="after-tag" class="image-tag after-tag" hidden>调色后</span>
          <div id="compare-divider" hidden><span><i data-icon="compare"></i></span></div>
        </div>
        <span class="canvas-placeholder" id="canvas-placeholder"><i data-icon="image"></i>将照片拖到这里，或打开一张照片</span>
        <div class="box-session" id="box-session" hidden>
          <span id="box-session-text" role="status"></span>
          <button type="button" class="button button-primary" id="box-confirm" title="确认选框（Enter）" disabled>确认识别</button>
          <button type="button" class="button" id="box-cancel">取消</button>
        </div>
        <div class="drop-prompt" id="drop-prompt" hidden><i data-icon="upload"></i>松开鼠标打开照片</div>
      </div>
      <div class="board-foot">
        <div class="photo-meta">
          <span id="canvas-caption"><i data-icon="image"></i><span>未连接照片</span></span>
          <span id="image-meta">打开照片，或从画布连接原图</span>
        </div>
        <div class="view-tools">
          <div class="segmented" aria-label="预览模式">
            <button type="button" data-view="after" class="selected" title="效果" aria-label="效果"><i data-icon="image"></i><span>效果</span></button>
            <button type="button" data-view="compare" title="前后对照" aria-label="前后对照"><i data-icon="compare"></i><span>前后对照</span></button>
          </div>
          <button type="button" class="button icon-button" id="fit-view" title="适合画板（0）" aria-label="适合画板"><i data-icon="expand"></i></button>
        </div>
        <div id="zoom-controls" class="zoom-controls" role="group" aria-label="画布工具">
          <button type="button" id="view-hand" title="抓手（H 或按住空格拖动）" aria-label="抓手" aria-pressed="false"><i data-icon="hand"></i></button>
          <button type="button" id="view-rotate" title="旋转视图（R 后拖动）" aria-label="拖动旋转视图" aria-pressed="false"><i data-icon="rotate"></i></button>
          <span class="viewport-tool-divider" aria-hidden="true"></span>
          <button type="button" id="rotate-left" title="逆时针转 90°" aria-label="逆时针转 90 度"><i data-icon="rotate-left"></i></button>
          <button type="button" id="rotate-angle" title="转回 0°" aria-label="视图转回 0 度">0°</button>
          <button type="button" id="rotate-right" title="顺时针转 90°" aria-label="顺时针转 90 度"><i data-icon="rotate-right"></i></button>
          <span class="viewport-tool-divider" aria-hidden="true"></span>
          <button type="button" id="zoom-out" title="缩小（−）" aria-label="缩小"><i data-icon="minus"></i></button>
          <button type="button" id="zoom-fit" title="适合画板（0）" aria-label="适合画板">适合</button>
          <button type="button" id="zoom-in" title="放大（+）" aria-label="放大"><i data-icon="plus"></i></button>
        </div>
      </div>
    </section>

    <aside class="inspector" aria-label="调色设置">
      <div class="inspector-tabs" role="tablist" aria-label="编辑模式">
        <button type="button" id="tab-tone" data-panel="tone" role="tab" aria-controls="panel-tone" aria-selected="true"><i data-icon="sliders"></i>调整</button>
        <button type="button" id="tab-color" data-panel="color" role="tab" aria-controls="panel-color" aria-selected="false"><i data-icon="curve"></i>曲线 · 色彩</button>
        <button type="button" id="tab-glow" data-panel="glow" role="tab" aria-controls="panel-glow" aria-selected="false"><i data-icon="sparkles"></i>辉光</button>
        <button type="button" id="tab-mask" data-panel="mask" role="tab" aria-controls="panel-mask" aria-selected="false"><i data-icon="mask"></i>蒙版</button>
      </div>
      <div class="inspector-scroll">
        <section class="auto-section">
          <div id="automatic-look">
            <div class="auto-title"><span class="ai-icon"><i data-icon="sparkles"></i></span><div><h2>AI 自动调色</h2><p id="ai-caption">根据照片分析光线与色彩</p></div></div>
            <button type="button" id="run-ai" class="button button-primary"><i data-icon="sparkles"></i><span>自动调色</span></button>
            <div id="ai-strength-wrap" class="ai-strength" hidden></div>
          </div>
          <div id="applied-look" hidden>
            <div class="auto-title"><span class="ai-icon"><i data-icon="cards"></i></span><div><h2 id="applied-look-name"></h2><p>已应用固定调色模板</p></div></div>
            <div id="applied-strength-wrap"></div>
            <button type="button" id="look-clear" class="text-button"><i data-icon="reset"></i><span>切回自动调色</span></button>
          </div>
        </section>
        <section class="histogram-section" aria-label="亮度直方图">
          <div class="histogram-heading"><h2>直方图</h2><button id="show-original" class="text-button" type="button" title="查看原图（V）"><i data-icon="eye"></i><span>看原图</span></button></div>
          <canvas id="histogram" width="390" height="106"></canvas>
        </section>
        <section id="panel-tone" role="tabpanel" aria-labelledby="tab-tone">
          <div class="panel-header"><h2>基础调整</h2><button id="reset-tone" class="text-button" type="button"><i data-icon="reset"></i>重置</button></div>
          <div id="tone-controls"></div>
        </section>
        <section id="panel-color" role="tabpanel" aria-labelledby="tab-color" hidden>
          <div class="panel-header"><h2>曲线</h2><button id="reset-curve" class="text-button" type="button"><i data-icon="reset"></i>重置</button></div>
          <div id="curve-channels" class="curve-channels" aria-label="曲线通道">
            <button data-channel="rgb" class="active">RGB</button><button data-channel="red">红</button><button data-channel="green">绿</button><button data-channel="blue">蓝</button>
          </div>
          <canvas id="curve-canvas" width="500" height="310" aria-label="调色曲线"></canvas>
          <p class="panel-note">点击添加曲线点。拖动调整，双击删除。</p>
          <div id="hsl-section" hidden>
            <div class="panel-header panel-subhead"><h2>色彩混合</h2><button id="reset-hsl" class="text-button" type="button"><i data-icon="reset"></i>重置</button></div>
            <div id="hsl-colors" class="hsl-colors" aria-label="选择色彩范围"></div>
            <div id="hsl-controls"></div>
          </div>
          <section class="control-group color-lut">
            <h2><button id="lut-disclosure" class="control-disclosure" type="button" aria-controls="lut-details" aria-expanded="false">LUT</button></h2>
            <div id="lut-details" hidden>
              <button id="import-lut" class="text-button lut-import" type="button"><i data-icon="upload"></i>导入 .cube</button>
              <p id="lut-caption" class="panel-note">可叠加第三方 3D LUT。</p>
              <div id="lut-controls" hidden></div>
            </div>
          </section>
        </section>
        <section id="panel-glow" role="tabpanel" aria-labelledby="tab-glow" hidden>
          <div class="panel-header"><h2>高光辉光</h2><button id="reset-glow" class="text-button" type="button"><i data-icon="reset"></i>重置辉光</button></div>
          <p class="panel-note">让画面中的灯光和其他高光自然向外扩散。</p>
          <button id="toggle-glow" class="button glow-toggle" type="button" aria-pressed="false"><i data-icon="sparkles"></i><span>开启辉光</span></button>
          <div id="glow-controls"></div>
        </section>
        <section id="panel-mask" role="tabpanel" aria-labelledby="tab-mask" hidden>
          <div class="panel-header"><h2>局部蒙版</h2><button id="mask-overlay" class="text-button" type="button" aria-pressed="true"><i data-icon="eye"></i>叠加预览</button></div>
          <button id="create-box-mask" class="button button-soft mask-box-primary" type="button" aria-pressed="false"><i data-icon="frame"></i>框选主体</button>
          <div class="mask-actions">
            <button type="button" id="create-subject-mask" class="button" title="在整张照片中识别主体"><i data-icon="sparkles"></i>全图 AI 主体</button>
            <button type="button" id="create-brush-mask" class="button"><i data-icon="brush"></i>新建画笔</button>
          </div>
          <p id="mask-box-guide" class="panel-note mask-box-guide" role="status">大致圈住目标，拖动框内移动，拉边或角调整大小，再点「确认识别」。</p>
          <div id="mask-list"></div>
          <p id="mask-empty" class="panel-note">生成蒙版后，可用画笔补选和擦除、保留主体颜色，或单独调色。</p>
          <div id="mask-editor" hidden>
            <div class="mask-select-actions">
              <button id="mask-keep-color" class="button" type="button" aria-pressed="false"><i data-icon="invert"></i>背景黑白</button>
              <button id="mask-reselect" class="button" type="button" hidden><i data-icon="frame"></i>重新框选</button>
              <button id="mask-show-box" class="text-button" type="button" aria-pressed="true" hidden>显示范围</button>
            </div>
            <div class="mask-tools"><button id="paint-mask" class="button" type="button" aria-pressed="false"><i data-icon="brush"></i>画笔补选</button><button id="erase-mask" class="button" type="button" aria-pressed="false"><i data-icon="eraser"></i>橡皮擦除</button><button id="invert-mask" class="button" type="button" aria-pressed="false"><i data-icon="invert"></i>反选</button></div>
            <div id="mask-brush-controls"></div>
            <div class="panel-header panel-subhead"><h2>局部调整</h2><button id="reset-mask-tone" class="text-button" type="button"><i data-icon="reset"></i>重置</button></div>
            <div id="mask-tone-controls"></div>
          </div>
        </section>
        <section class="preset-shelf" id="preset-shelf" aria-labelledby="preset-heading">
          <div class="shelf-heading">
            <h2 id="preset-heading">风格预设</h2>
            <div class="shelf-tabs" aria-label="预设来源">
              <button type="button" id="feishu-looks-tab" aria-pressed="true">预设</button>
              <button type="button" id="my-looks-tab" aria-pressed="false">我的模板</button>
            </div>
            <button type="button" id="extract-look-open" class="button button-soft" aria-haspopup="dialog" aria-controls="extract-look-dialog"><i data-icon="sparkles"></i>从照片提取</button>
          </div>
          <div id="feishu-looks">
            <p class="feishu-summary">3 套调色、1 套辉光预设和 1 套框选留色模板。</p>
            <div id="feishu-look-grid" class="feishu-look-grid"></div>
          </div>
          <div id="my-looks" hidden>
            <p id="looks-empty" class="panel-note">添加一张参考照片，把喜欢的调色保存到这里。</p>
            <div id="custom-look-grid" class="custom-look-grid"></div>
            <button id="look-import-open" class="text-button" type="button"><i data-icon="upload"></i>导入模板文件</button>
          </div>
        </section>
      </div>
      <div class="inspector-footer"><i data-icon="lock"></i><span>图像处理在当前设备完成</span></div>
    </aside>
  </main>

  <dialog id="feishu-case-dialog" aria-labelledby="feishu-case-title">
    <form method="dialog" class="dialog-form">
      <div class="dialog-header"><h2 id="feishu-case-title"></h2><button class="button icon-button" value="close" aria-label="关闭"><i data-icon="x"></i></button></div>
      <p id="feishu-case-summary" class="look-intro"></p>
      <div id="feishu-pairs"></div>
      <div id="feishu-extra"></div>
      <div class="dialog-actions"><button class="button" value="close">关闭</button><button class="button button-primary" type="button" id="feishu-case-apply"><i data-icon="check"></i><span>应用预设</span></button></div>
    </form>
  </dialog>
  <dialog id="extract-look-dialog" aria-labelledby="extract-look-title">
    <form method="dialog" class="dialog-form">
      <div class="dialog-header"><h2 id="extract-look-title">从照片提取调色</h2><button class="button icon-button" value="cancel" aria-label="关闭"><i data-icon="x"></i></button></div>
      <p class="look-intro">选一张调过色的参考照片，提取明暗、饱和度和色调。单张照片可以估计风格，原始调色参数无法精确还原。</p>
      <input id="look-reference-input" type="file" accept="image/jpeg,image/png,image/webp,image/avif,image/gif,image/bmp" hidden>
      <div class="look-preview-grid">
        <div>
          <span class="look-preview-label">参考照片</span>
          <button id="look-reference-open" type="button" class="look-reference-pick">
            <canvas id="look-reference-preview" hidden></canvas>
            <span id="look-reference-prompt"><i data-icon="upload"></i>选择参考照片</span>
          </button>
          <div class="look-reference-actions"><span id="look-reference-name"></span><button type="button" id="look-use-current" class="text-button">用当前原图</button></div>
        </div>
        <div>
          <span class="look-preview-label">在当前照片上试色</span>
          <div class="look-target"><canvas id="look-preview" aria-label="提取后的调色预览"></canvas></div>
          <div id="look-preview-swatches" class="look-swatches" aria-label="提取的阴影、中间调和高光颜色"></div>
        </div>
      </div>
      <div id="extract-strength-wrap"></div>
      <label class="look-name-label">模板名称<input id="look-name" type="text" maxlength="36" autocomplete="off" placeholder="例如：灰蓝街景"></label>
      <p id="look-status" class="panel-note" role="status"></p>
      <div class="dialog-actions"><button class="button" value="cancel">取消</button><button class="button button-primary" type="button" id="look-save" disabled><i data-icon="check"></i>保存并应用</button></div>
    </form>
  </dialog>
  <dialog id="rename-look-dialog" aria-labelledby="rename-look-title">
    <form method="dialog" class="dialog-form">
      <div class="dialog-header"><h2 id="rename-look-title">重命名模板</h2><button class="button icon-button" value="cancel" aria-label="关闭"><i data-icon="x"></i></button></div>
      <label>模板名称<input id="rename-look-name" type="text" maxlength="36" autocomplete="off"></label>
      <p id="rename-look-status" class="panel-note" role="status"></p>
      <div class="dialog-actions"><button class="button" value="cancel">取消</button><button class="button button-primary" type="button" id="rename-look-confirm">保存名称</button></div>
    </form>
  </dialog>
  <dialog id="delete-look-dialog" aria-labelledby="delete-look-title">
    <form method="dialog" class="dialog-form">
      <div class="dialog-header"><h2 id="delete-look-title">删除模板</h2><button class="button icon-button" value="cancel" aria-label="关闭"><i data-icon="x"></i></button></div>
      <p id="delete-look-status" class="panel-note"></p>
      <div class="dialog-actions"><button class="button" value="cancel">取消</button><button class="button button-danger" type="button" id="delete-look-confirm">删除模板</button></div>
    </form>
  </dialog>
  <dialog id="export-dialog">
    <form method="dialog" class="dialog-form">
      <div class="dialog-header"><h2>导出照片</h2><button class="button icon-button" value="cancel" aria-label="关闭"><i data-icon="x"></i></button></div>
      <label>格式<select id="export-format"><option value="jpeg">JPG · 高画质</option><option value="png">PNG · 无损</option></select></label>
      <label>内容<select id="export-mode"><option value="full">整张调色照片</option><option value="cutout">当前蒙版 · 透明抠图</option><option value="mask">当前蒙版 · 黑白 PNG</option></select></label>
      <p class="panel-note" id="export-info"></p>
      <div class="dialog-actions"><button class="button" value="cancel">取消</button><button class="button button-primary" type="button" id="export-confirm"><i data-icon="download"></i>下载文件</button></div>
    </form>
  </dialog>
  <dialog id="help-dialog">
    <form method="dialog" class="dialog-form">
      <div class="dialog-header"><h2>使用指南</h2><button class="button icon-button" value="close" aria-label="关闭"><i data-icon="x"></i></button></div>
      <ol class="help-steps"><li>打开或拖入照片后即可调整。需要 AI 建议时，点击「自动调色」。</li><li>在照片上滚轮缩放，按住空格拖动画布。按 R 切到旋转工具后拖动，按 0 适合画板。</li><li>在「蒙版」里画框，移动和调整大小后确认识别。生成后可继续用画笔修边或将背景设为黑白。</li><li>用滑块、曲线和辉光微调，再导出整图、透明抠图或黑白蒙版。</li></ol>
      <div class="help-links"><a href="https://milanote.com/guide/photography-moodboard" target="_blank" rel="noreferrer">Milanote 摄影画板指南 <i data-icon="external"></i></a><a href="https://github.com/HuiZeng/Image-Adaptive-3DLUT" target="_blank" rel="noreferrer">开源调色模型 <i data-icon="external"></i></a><a href="https://github.com/xuebinqin/U-2-Net" target="_blank" rel="noreferrer">开源抠图模型 <i data-icon="external"></i></a></div>
    </form>
  </dialog>
  <div id="toast" role="status" aria-live="polite" hidden></div>
</div>
`;

export function mountColorBoardTemplate(container, { theme = 'light' } = {}) {
  const root = container.attachShadow({ mode: 'open' });
  const document = container.ownerDocument;
  const stylesheet = document.createElement('link');
  stylesheet.rel = 'stylesheet';
  stylesheet.href = new URL('./styles.css', import.meta.url).href;
  const ready = new Promise((resolve, reject) => {
    stylesheet.addEventListener('load', resolve, { once: true });
    stylesheet.addEventListener('error', () => reject(new Error('无法加载调色工作台样式')), { once: true });
  });

  const template = document.createElement('template');
  template.innerHTML = markup;
  container.dataset.framelabTheme = theme === 'dark' ? 'dark' : 'light';
  root.append(stylesheet, template.content);
  return { root, ready };
}
