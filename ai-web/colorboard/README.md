# FrameLab 调色工作台

本模块来自用户提供的 ColorBoard 源码和模型包。选中 FrameLab 照片并点击「AI 调色」，在生成的节点中打开「调色设置」。旧基础调色的已保存结果可以作为工作台的起始照片。

1. 打开或拖入照片即可手动调整，也可以先用示例照片体验。点击「自动调色」可让 AI 根据照片生成可调强度的起始色调。
2. 选择建筑冷调、人像柔肤、山野通透、霓虹夜景、通用人像、四季或色调预设。应用后可继续修改参数。
3. 在侧栏调整曝光、白平衡、反差、高光和阴影、饱和度、清晰度、锐化、去雾与暗角。可单独修改 RGB 曲线和六区 HSL，或叠加内置的开源 LUT 或导入 `.cube`。
4. 从「蒙版」选「框选主体」，在照片上拖一个框。在框内拖动可移动，拉边或角可调整大小。点击「确认识别」或按 Enter 后，AI 沿主体边缘生成蒙版。也可以使用全图 AI 主体或新建画笔。框选后可显示或隐藏范围、重新框选，或使用画笔补选和橡皮擦除。支持导出整张 JPG/PNG、透明抠图或黑白蒙版。

画板支持滚轮围绕鼠标缩放，按住空格或鼠标中键拖动来平移，按 R 或点击旋转工具后拖动可任意旋转。工具栏可直接左右转 90°，点击角度归零，按 0 重新适合画板。视图变换会带着框选、画笔和前后分隔线一起移动，导出时仍使用照片原方向与尺寸。

在风格预设区点击「从照片提取」，可单独选择一张调过色的参考图，也可用当前原图。工作台会估计参考图的明暗、饱和度和阴影到高光的色调。在当前照片上试色，选好强度后保存为「我的模板」。应用模板时会以保存的色彩映射作为基础，后续手动调整只影响当前编辑。模板保存在当前浏览器，也可以导出为 JSON 文件换设备使用，模板文件只含名称、调色参数和强度。单张参考照片可以估计风格，无法精确还原摄影现场和原始设置。

「飞书样本」现有三套固定调色、「夜灯辉光」和「主体留色」。点「主体留色」的「应用」可直接框选。它会保留分割出的主体颜色，并把其他区域变成黑白。全局明暗、曲线、辉光和局部蒙版可继续叠加。关闭蒙版上的「背景黑白」可恢复背景颜色。换照片后需重新选择主体。可在模板案例中用 07.jpg 的黄色汽车练习框选。

可在网页上查看两组前后案例并用原图试色。当前案例图片位于 `assets/feishu-grade/crops`，原批次分析见 `docs/feishu-grade-review.md`。

右侧「辉光」可独立开启，支持调强度、高光门槛、扩散范围、冷暖、光带强度与方向。它可以叠加在当前调色上，整图导出也会应用。默认开启时先使用柔光，飞书样本的「夜灯辉光」会启用更暖的高光与横向光带。07.jpg 是已有辉光的效果参考。

模型推理、调色计算和导出在当前浏览器完成。选择「保存到画布」会把工作预览和可编辑工程保存到当前 FrameLab 工作空间。工作空间的同步遵循 FrameLab 的现有设置。AI 蒙版会受原图主体与背景的清晰程度影响，可用画笔校正边缘。

## 参考与来源

- 工作台的摄影画板与组织方式参考 [Milanote 摄影画板官方指南](https://milanote.com/guide/photography-moodboard)。
- 四季、暖金和暮蓝预设参考 [OpenStill Originals](https://github.com/haon-v2/OpenStill/blob/main/Resources/LUTs/originals.json)，采用 CC0 1.0 授权，参数已适配本工作台。
- AI 调色使用 [HuiZeng/Image-Adaptive-3DLUT](https://github.com/HuiZeng/Image-Adaptive-3DLUT) 的 sRGB 模型，分类器转换为 ONNX，在浏览器根据照片预测三个色彩查找表的权重。参考 [Apache 2.0 许可](./vendor/adaptive/LICENSE.txt)。
- AI 主体蒙版使用 [U²-NetP](https://github.com/xuebinqin/U-2-Net)，加载 [rembg 提供的 ONNX 模型](https://github.com/danielgatis/rembg/releases/download/v0.0.0/u2netp.onnx)。相关许可和来源见 [模型说明](./vendor/matte/SOURCES.md)。模型由 [ONNX Runtime Web](https://onnxruntime.ai/docs/get-started/with-javascript/web.html) 在本地运行。
- AI 框选使用 Apache 2.0 许可的 [SlimSAM](https://github.com/czg1225/SlimSAM)，基于 [Segment Anything](https://github.com/facebookresearch/segment-anything)。浏览器用选框的两个角点提示分割模型。同一张照片首次框选需要几秒，后续可重用分析结果。模型加载失败时，可改用选框范围内的 U²-NetP 主体识别。模型版本、转换过程和许可见 [框选模型来源](./vendor/box-segment/SOURCES.md)。
- 内置 Amber、Fade、Neon 和 Portrait LUT 由 [slay](https://www.slaycamera.com/) 制作，按 [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) 原样分发。[GitHub 项目](https://github.com/slaycamera/luts) · [署名说明](./luts/ATTRIBUTION.md)
- 辉光参考 [Three.js UnrealBloomPass 的多尺度扩散](https://github.com/mrdoob/three.js/blob/0245b6dad700ecc32f145dfa495c55e41fc75db7/examples/jsm/postprocessing/UnrealBloomPass.js) 和 [Godot 方向光带示例](https://github.com/NicolasPetton/bloom_anamorphic_godot_shader/blob/ef5e6e51397e40b0550c2c514c7ba84268846893/anamorphic_streak.gdshader)，两者均为 MIT 许可。工作台使用独立实现的像素处理模块，预览和导出共用。
- 演示照片来自 Unsplash，按 [Unsplash License](https://unsplash.com/license) 使用。[建筑](https://images.unsplash.com/photo-1487958449943-2429e8be8625) · [人像](https://images.unsplash.com/photo-1531123897727-8f129e1688ce) · [风景](https://images.unsplash.com/photo-1472396961693-142e6e269027) · [夜景](https://images.unsplash.com/photo-1519608487953-e999c86e7455)
