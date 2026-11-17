"""Local stdin/stdout inference worker. Never fetch URLs supplied by clients."""
import sys, os, json, base64, io, importlib.util
from pathlib import Path
from PIL import Image, ImageOps
import numpy as np
import torch

model_dir = Path(os.environ.get('R11_AI_MODELS', Path(__file__).resolve().parents[2] / 'work' / 'ai-color-evaluation'))
spec = importlib.util.spec_from_file_location('r11_models', model_dir / 'evaluate.py')
model = importlib.util.module_from_spec(spec)
spec.loader.exec_module(model)
Image.MAX_IMAGE_PIXELS = 24000000
for line in sys.stdin:
    try:
        request = json.loads(line)
        data = request['image']
        if not data.startswith(('data:image/jpeg;base64,', 'data:image/png;base64,', 'data:image/webp;base64,')):
            raise ValueError('Unsupported image format')
        raw = base64.b64decode(data.split(',', 1)[1], validate=True)
        if len(raw) > 12000000:
            raise ValueError('Image too large')
        img = ImageOps.exif_transpose(Image.open(io.BytesIO(raw))).convert('RGB')
        img.thumbnail((1600, 1600))
        x = torch.from_numpy(np.asarray(img).copy().astype(np.float32) / 255).permute(2,0,1)[None]
        y = model.enhance(x, 'adaint')
        if not torch.isfinite(y).all():
            raise ValueError('Non-finite output')
        strength = max(0, min(1, float(request.get('strength', .6))))
        y = x.lerp(y.clamp(0,1), strength)
        result = Image.fromarray(y[0].permute(1,2,0).mul(255).round().byte().numpy())
        out = io.BytesIO()
        result.save(out, format='JPEG', quality=94)
        print(json.dumps({'src':'data:image/jpeg;base64,'+base64.b64encode(out.getvalue()).decode(), 'width':img.width, 'height':img.height}), flush=True)
    except Exception as exc:
        print(json.dumps({'error':str(exc)}), flush=True)
