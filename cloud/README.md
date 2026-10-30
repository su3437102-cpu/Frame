# FrameLab R11 个人云端部署

此版本使用网站自己的个人口令登录，不依赖 Cloudflare Access / Zero Trust，也不需要开通 Zero Trust 绑卡套餐。

## 部署
- Worker: frame；GitHub: su3437102-cpu/Frame，main。
- Build: npm run build；Deploy: npx wrangler deploy。
- 在 Worker Settings → Runtime variables and secrets 添加 Secret：LOGIN_KEY。
- 请用密码管理器生成 32–64 位随机字母数字口令，保存于密码管理器，仅由本人填写至 Cloudflare Secret。不要发到聊天或 GitHub。
- 未设置或少于 32 位时，所有私有资源和数据接口返回 503；登录页仍可查看。
- 构建凭证已缩减为 Workers Scripts Edit + Account Settings Read，仅当前账户；不是单 Worker 范围。

## 登录与数据
口令只在 HTTPS 登录请求中发送；Cookie 使用 HttpOnly、Secure、SameSite=Strict，12 小时到期。所有运行文件和数据 API 都在服务器验证登录；静态资源无公开旁路。退出会清除当前浏览器 Cookie 和本地缓存；已经被复制的会话令牌在到期前仍有效，修改 LOGIN_KEY 会使全部旧会话失效。
登录全站最多 30 次 / 10 分钟（Durable Object 持久化计数）；这也意味着攻击者可以暂时耗尽登录次数，但不能因此访问数据。

云端桌面使用 Durable Object 保存，版本号检查防止不同设备静默覆盖。冲突时先导出本机备份，再明确选择云端版本。单次快照限 8 MiB；浏览器 localStorage 配额更小，较大照片项目应先导出归档。本地原型和云端使用不同存储键；首次迁移请从本地导出，再在云端导入。当前没有服务端历史版本回收站，请保留独立导出备份。

## 已验证与待验证
node --test cloud/test.mjs：7 组测试通过，涵盖未配置关闭、口令校验、Cookie 伪造、跨站拒绝、退出、密钥轮换、频率限制、并发版本冲突、大快照及超限。
npx wrangler deploy --dry-run：通过，压缩约 1.46 MiB。
真实生产口令登录、跨设备同步、手机和大陆网络连通性需完成 Secret 配置并部署后验证，不能据本地测试宣称完成。
