# Subject segmentation

U²-NetP runs in a local browser worker and generates a continuous foreground mask. Its 320 × 320 prediction is resized to the photo editing canvas. The compact model is suited to interactive editing. Detailed hair, busy scenes, and photos with no salient subject can need mask brush corrections.

- Research model and source code, Apache 2.0: [U-2-Net](https://github.com/xuebinqin/U-2-Net).
- ONNX checkpoint and color normalization reference, MIT repository: [rembg U²-NetP session](https://github.com/danielgatis/rembg/blob/main/rembg/sessions/u2netp.py) and [release asset](https://github.com/danielgatis/rembg/releases/download/v0.0.0/u2netp.onnx).
- Bundled WebAssembly runtime, MIT: [onnxruntime-web 1.22.0](https://www.npmjs.com/package/onnxruntime-web/v/1.22.0); see `../ort/LICENSE` and `../ort/ThirdPartyNotices.txt`.

Checkpoint SHA-256: `309c8469258dda742793dce0ebea8e6dd393174f89934733ecc8b14c76f4ddd8`.
