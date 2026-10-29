# FrameLab R11 个人云端版

本地 V0.4 原始备份：提交 c926a0c。原型仍可用 `npm start` 独立运行；云端版本仅在构建时加载 cloud-sync.js 和独立存储键，不接触 R10。

## 部署

- Cloudflare Workers Free，GitHub 仓库仅授权 su3437102-cpu/Frame。
- 构建命令 `npm run build`；部署命令 `npx wrangler deploy`。
- 构建环境变量 `OWNER_EMAIL` 填所有者邮箱。构建仅将邮箱 SHA-256 写入服务器包；浏览器脚本不包含所有者邮箱。也可配置同名运行时变量。
- 在 Cloudflare Access 将 **All traffic** 设为保护范围。应用额外验证 Cloudflare 提供的 `ctx.access` 和精确的所有者邮箱；未配置、未登录或非所有者一律拒绝。
- 不使用 Static Assets 路由器：官方说明该路由器不传递 ctx.access。运行资产直接打包进 Worker，仅允许清单内文件，不公开测试备份、源配置和 QA 目录。
- Durable Object PersonalDesk 使用 SQLite 后端和事务版本检查。首次部署由 Wrangler 创建绑定，无需开通 R2 或付费订阅。

## 使用和限制

- 手机使用已有项目列表，支持上传和编辑。电脑使用无限桌面。
- 修改后约 1.2 秒上传；页面可见且空闲时每 30 秒检查云端更新。
- 云端以整个桌面为一个版本；同时修改时后保存者收到冲突提示，先下载本机备份，再读取云端。暂不自动合并对象。
- 桌面 JSON 请求上限 8MiB（含压缩照片）；这不是原片图库。浏览器本地容量可能更小，页面显示未保存或待同步时请导出备份后再关闭。
- 初次打开云端先读取服务器；不会将默认示例覆盖现有云端桌面。要迁移 localhost 上的项目，请从旧版导出 R11 JSON 后，在云端菜单导入。
- 云端不安装离线 Service Worker，避免登录失效后仍从缓存提供页面。已打开页面在断网期间可继续编辑，联网重试；重新打开页面需要网络和登录。
- 免费配额耗尽可能暂时无法同步；本地仍可导出。未开通付费方案。
- 中国大陆公司网络和手机运营商可达性必须实际测试，不能从一次本机访问推断。

## 验证

`node cloud/build.mjs`、`node --test cloud/test.mjs`、`npx wrangler deploy --dry-run`。

后端单元测试采用内存事务替身，覆盖身份拒绝、伪造头拒绝、跨站写入、运行文件白名单、读写、并发版本冲突、大数据分块和容量上限。它不替代真实 Cloudflare 登录、Durable Object 和两设备验收。

当前仍需完成实际部署和在线验收，不能把本地测试通过当作网站已上线。
