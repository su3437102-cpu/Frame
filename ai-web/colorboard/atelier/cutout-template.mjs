import { symbols } from './symbols.mjs';

export const cutoutMarkup = `<div class="atelier cutout-atelier">
${symbols}
<header class="site-header">
  <div class="header-inner">
    <div class="atelier-title"><button id="cutout-back" class="text-button" type="button" aria-label="返回画布">‹ <span>返回画布</span></button><span class="atelier-brand">FrameLab</span><h1 id="cutout-heading">抠图工作台</h1></div>
    <div class="atelier-actions"><button id="cutout-to-collage" class="button compact outline" type="button">打开拼图工作台</button></div>
  </div>
</header>
<main class="page">
    <section id="cutouts" class="editorial cutout-workspace" aria-labelledby="cutout-title">
      <div class="section-intro cutout-intro">
        <div><h2 id="cutout-title">抠图素材</h2><p>上传照片，自动提取前景元素。可下载透明 PNG，也可以把选中的素材送到拼图。</p></div>
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
          <button id="cutout-linked" type="button" class="button compact outline" hidden>抠图当前照片</button>
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
              <button id="cutout-add" type="button" class="button outline" hidden disabled><svg aria-hidden="true"><use href="#i-plus"/></svg>添加到拼图</button>
              <button id="cutout-compose" type="button" class="button primary" disabled><svg aria-hidden="true"><use href="#i-layers"/></svg>用素材新建构图</button>
            </div>
          </div>
        </div>
      </div>
      <p id="cutout-notice" class="status" role="status" aria-live="polite" hidden></p>
    </section>
</main></div>`;
