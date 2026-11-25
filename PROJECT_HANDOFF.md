# FrameLab R11 交接

## 2026-11-25 · SpektraLab Windows 离线网页版

母站顶栏的 SpektraLab 打开 `/spektralab.html`。公网入口沿用 Worker 个人认证。本机及局域网静态副本也可展示同一入口。

用户提供的 Windows 离线包基于 SpektraLab 2.0.0-alpha.3，浏览器通过本机 Node HTTP 服务调用原生 Vulkan 引擎及图库助手。操作时先在支持 Vulkan 的 Windows x64 电脑上解压并运行 `Launch-SpektraLab.cmd`，再从母站入口打开同一台电脑的 `http://127.0.0.1:5193/`。如果启动时另选端口，使用启动窗口显示的网址。导出后使用母站已有的图片上传入口将成片加入画布。

- `index.html` 添加入口，`spektralab.html` 提供启动和回画布流程，`spektralab.css` 使用 FrameLab 界面变量。
- `cloud/build.mjs` 收录入口和样式。Worker 继续按已有规则保护页面。 `sync-local.mjs` 和 `sw.js` 收录本机副本与缓存资源。
- 接入通过浏览器在新标签打开本机服务。无需云端代理，也无需改变离线包的同源请求检查或回环监听。FrameLab 和离线包各自保存数据。
- GitHub 保存集成源码，不分发离线包的 Windows 二进制、编译后前端或素材。参见[上游版本](https://github.com/JamesQiu2005/SpektraLab/releases/tag/spektralab-windows-v2.0.0-alpha.3)及该包的许可证与来源说明。
- 本次基于 GitHub `06f2777`，沿用其 ColorBoard、拼贴、画布工作台串联及浏览器胶片配方。上游能力与本次接入的 Windows 工作台分别运行。
- 验证覆盖本机浏览器的入口和返回、构建及认证路由测试。Vulkan 照片冲洗和导出需要在运行离线包的 Windows 设备上验收。
