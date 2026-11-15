# AI 自动调色：第一轮本机评估

2026-11-15，比较 Image-Adaptive-3DLUT 与 AdaInt 的官方 sRGB 预训练权重。

## 当前结论

两套模型均已运行并生成实际图片。建议下一阶段以 **AdaInt** 作为首选，Image-Adaptive-3DLUT 作为对照。这个结论仅针对本轮样本，不等于经过人像、RAW 或产品级质量验收。

| 模型 | 本轮单张推理中位数范围 | 观察 |
| --- | --- | --- |
| Image-Adaptive-3DLUT | 34.1–91.9 ms | 更快，但本轮多数图片的输出通道越界比例更高 |
| AdaInt | 49.3–141.4 ms | 多数样本越界较少，仍有一张竖图超过 11%；需要可调强度 |

9 张输入：AdaInt 官方演示图片 1 张，以及 FrameLab 现有示例照片 8 张。最长边不超过 1600px。CPU 四线程、PyTorch 2.15.0+cpu；预热后 3 次中位数，不含模型加载、图片解码和文件写入。机器有 RTX 3060 6GB，本轮没有使用 GPU。

8 张 FrameLab 示例已经过调色，不能把“再次调整”当作客观质量提升。没有人像、未处理 RAW 或专家目标图，未计算 PSNR/SSIM，也没有宣称达到实时高分辨率生产性能。

## 计算方式与核查

保留官方 CNN、LUT 参数与权重，以 PyTorch grid_sample 及自适应区间坐标替代原项目的旧版 C++/CUDA 插件。两套权重都严格匹配模型参数，通过 weights_only=True 加载。

独立的八顶点标量插值核查最大误差：3DLUT 1.79e-6，AdaInt 7.15e-7。该核查包括随机 LUT 和 0/1 端点，避免仅凭图片看起来正常就认定移植正确。

## 本机结果

- 对照页：`http://192.168.3.4:4311/design/ai-color/index.html`
- 本机：`http://127.0.0.1:4313/design/ai-color/index.html`
- 完整输出保存在工作区 `outputs/AI-Color-Evaluation/`，包括原图、两套输出和 JSON 数值报告。
- 独立 Python 环境：`C:/Users/Administrator/.codex/envs/r11-ai/`。
- 本轮只完成模型评估；画布 AI 调色子台与云端推理尚未接入。

## 复现

在此目录运行 setup.ps1（使用官方仓库地址下载模型及源码），然后在独立环境安装 torch、numpy、pillow。设置 R11_AI_ASSETS 为 FrameLab assets 的绝对路径、R11_AI_OUTPUT 为输出目录，再运行 evaluate.py 和 verify_interpolation.py。

## 来源与使用范围

- https://github.com/HuiZeng/Image-Adaptive-3DLUT — 仓库代码 Apache-2.0。
- https://github.com/ImCharlesY/AdaInt — 仓库代码 Apache-2.0。
- 两项目使用 FiveK 等数据训练；代码许可不能替代训练数据和模型使用范围的核对。本轮用于本机评估，未把权重或官方样本发布到 FrameLab 仓库或云服务。

后续接入建议：照片 → AI 调色子台，在子台显示结果；提供强度、原图对比与重新计算。首先评估 60% 默认强度，保留原图和工程参数。
