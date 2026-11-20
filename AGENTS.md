# FrameLab 开发与发布

1. 本地验证本轮变更。检查实际加载的资源和受影响的操作，可使用本机回环地址 `http://127.0.0.1:4311/`。
2. 验证通过后，将本轮改动提交并推送到 `su3437102-cpu/Frame` 的 `main`。Cloudflare Workers Builds 会自动发布到 `https://frame.su3437102.workers.dev/`。
3. 等待发布完成，在公网确认响应中的构建号与本轮构建一致，再报告上线结果。
