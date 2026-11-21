# 本地框选主体分割

使用 Apache 2.0 许可的 [SlimSAM 77% Uniform](https://github.com/czg1225/SlimSAM)，它基于 Meta 的 [Segment Anything](https://github.com/facebookresearch/segment-anything)。量化 ONNX 编码器来自 [Xenova 的固定版本 `5850ab4`](https://huggingface.co/Xenova/slimsam-77-uniform/tree/5850ab45f587c112167512ffef949107115e26a0/onnx)。

解码器在 Xenova 同版本的量化点提示模型上修改。该模型的导出未包含矩形提示路径，`build_box_decoder.py` 用 [原始 SlimSAM 权重 `72a5ae6`](https://huggingface.co/nielsr/slimsam-77-uniform/tree/72a5ae6ca4d1da579a001f6f008b6fb949282c10) 中训练好的两个角点向量恢复矩形提示。实现参考 [Transformers 4.36.2 中的 SAM 提示编码](https://github.com/huggingface/transformers/blob/v4.36.2/src/transformers/models/sam/modeling_sam.py)。用户框选的左上角和右下角坐标直接输入模型。网页选择适合这个框的候选蒙版，保留轻微的边缘过渡，将选框以外的蒙版值置零。编码结果只在当前后台工作线程内暂存，用于同一照片重复框选。

- `vision_encoder_quantized.onnx` SHA-256 `cce23c7b2e5d4f330932738fb67ba518e04b0d99ccdd1cccd22a7da4e01f2971`
- 原量化解码器 SHA-256 `cb90b279f549d2cab7fd6e20c38522438c65d84bdcca3d2a764cff7d857fdce2`
- 原始 safetensors SHA-256 `b0ee221e3d33935807a820c157fec81a537b3b9979edc88b148a8dae8bbdd5d2`
- `box_decoder_quantized.onnx` SHA-256 `233eaa95941a353a89f3630bf3f3a009f56df06cf5e48ebc3ae2035c9b18bc97`

模型文件均由本站提供，浏览器使用本地 ONNX Runtime Web 推理，无在线模型服务。框选模型无法运行时，本站在选框的照片裁片上使用已有 [U²-NetP](../matte/SOURCES.md)，并告知用户启用了替代算法。
