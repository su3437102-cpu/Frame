# Image-Adaptive-3DLUT

自动调色使用 Hui Zeng、Jianrui Cai、Lida Li、Zisheng Cao、Lei Zhang 发表的 Image-Adaptive-3DLUT sRGB 模型。模型根据原照片预测权重，混合三张学习得到的 33 × 33 × 33 LUT。网页在本机浏览器运行 ONNX 推理，再把生成的 LUT 应用到照片。 [原始项目](https://github.com/HuiZeng/Image-Adaptive-3DLUT)

模型根据 Apache 2.0 许可分发，许可全文见 `LICENSE.txt`。`classifier.onnx` 由 `classifier.pth` 转换，输入的缩放交给浏览器。`basis-luts.f32` 由 `LUTs.pth` 转换，保留原 Float32 数值，按基础表、蓝、绿、红和输出通道的顺序存储，输入红色轴变化最快。 [固定版本的 sRGB 权重](https://github.com/HuiZeng/Image-Adaptive-3DLUT/tree/b491f6df64a588864739a157db271e5c848e1805/pretrained_models/sRGB)

如需重建，下载该固定版本的两个 `.pth` 文件，并安装 PyTorch 2.7 或更新版本、NumPy 和 ONNX，然后运行下面的命令。脚本先验证源文件 SHA-256，使用 PyTorch 的 `weights_only=True` 提取张量，并检查生成的 ONNX 图。

```text
python tools/convert-adaptive.py <权重目录> vendor/adaptive
```
