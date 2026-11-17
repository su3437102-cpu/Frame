"""Export the official AdaInt predictor; interpolation stays in a browser worker."""
import os, importlib.util, json
from pathlib import Path
import torch
import numpy as np
import onnxruntime as ort
root=Path(__file__).resolve().parents[2]
source=Path(os.environ.get('R11_AI_MODELS', root.parent/'ai-color-evaluation'))
spec=importlib.util.spec_from_file_location('models',source/'evaluate.py')
m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
out=root/'ai-web';out.mkdir(exist_ok=True)
x=torch.rand(1,3,256,256)
torch.onnx.export(m.adaptive,x,str(out/'adaint.onnx'),input_names=['image'],output_names=['lut','vertices'],opset_version=17,dynamo=False)
session=ort.InferenceSession(str(out/'adaint.onnx'),providers=['CPUExecutionProvider'])
with torch.inference_mode():expected=m.adaptive(x)
actual=session.run(None,{'image':x.numpy()})
errors=[float(np.max(np.abs(a-b.numpy()))) for a,b in zip(actual,expected)]
assert max(errors)<1e-4,errors
(out/'validation.json').write_text(json.dumps({'predictor_max_absolute_errors':errors,'opset':17,'input':[1,3,256,256]},indent=2))
print(errors)
