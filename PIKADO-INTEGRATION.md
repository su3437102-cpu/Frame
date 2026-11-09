# Pikado 接入说明

上游：https://github.com/koneb71/pikado

固定提交：29f6d8902a91f089edc8b327ab311ffa44859023。Pikado 使用 MIT 许可证，原始 LICENSE 随源代码和 editor 构建发布。libheif-js 许可证单独保留。完整源代码位于 vendor/pikado；FrameLab 修改 main.js 的内嵌启动方式并新增 framelab-bridge.js。

## 使用
1. 拖入 PS，连接照片。双击子台，在预览中选择“进入 Pikado 编辑”。
2. Pikado 图层编辑结果在操作停顿后回传子台；原照片保持不变。
3. 点击“保存并返回画布”，等待原生 PKD 工程回传完成。下次进入会恢复图层，而非重新打开扁平照片。
4. 桌面 PS 母台使用同一个编辑器，可自行导入文件；Pikado File 菜单提供原生保存和导出。

## 当前边界
- 每个母台/子台保留一个当前活动的 PKD 工程；编辑器里额外打开的其他标签页请单独保存 PKD。本版不是完整的母台多工程素材库。
- 关闭编辑器后，上游照片变化会标记“输入已更新”。再次进入时替换对应输入图层像素，保留其他图层和蒙版；尚未提供关闭编辑器时的后台自动重算。若原输入图层已删除，会报错并保留既有工程。
- 原生项目和预览随 R11 桌面保存及备份，仍受 localStorage 与云端 8MB 上限限制。大型 PSD/PKD 应用 Pikado 自带保存功能另存本机；存储失败以桌面状态提示为准。
- Pikado 原始界面以英文和桌面布局为主，尚未完成中文化及手机专用编辑布局。
- 不启用 AI 服务、不配置外部 API 密钥。上游网络字体和可选 AI 设置仍由 Pikado 提供。

## 构建与验证
首次：`npm ci --ignore-scripts --prefix vendor/pikado`。

重建编辑器：`node build-editor.mjs`。editor 构建产物一并提交，Cloudflare 常规构建无需安装编辑器开发依赖。

`npm run build` 打包主程序并复制编辑器静态资源。Worker 登录验证先于静态资源访问，编辑器仅允许同源框架加载。

`node --test ps-system.test.mjs pikado-host.test.mjs cloud/test.mjs` 验证连线、工程回传、消息来源校验、编辑器访问控制及既有同步认证。

实际浏览器已检查：载入照片、新增图层、隐藏背景后子台变透明、保存退出、重开后保留两个图层及显隐状态；恢复背景后再次保存。完整 Photoshop 功能兼容性没有逐项验收。

## FrameLab editor UI — 2026-11-09
Neutral light/dark theme follows desktop; vector tool rail, compact panel styling, layer-first dock and collapsed colour group. Common menu and tool labels translated; advanced labels remain English. Original editing engine and PKD format unchanged. Browser visual and interactive QA pending: no browser connected in this session.
