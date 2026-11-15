"""Local comparison using upstream pretrained sRGB weights. No training or uploads."""
import ast
import json
import time
import hashlib
import os
from pathlib import Path
import numpy as np
from PIL import Image, ImageOps
import torch
from torch import nn
from torch.nn import functional as F

ROOT = Path(__file__).parent
OUT = Path(os.environ.get('R11_AI_OUTPUT', ROOT.parent.parent / 'outputs' / 'AI-Color-Evaluation'))
ASSETS = Path(os.environ.get('R11_AI_ASSETS', ROOT.parent / 'Frame-cloud' / 'assets'))
OUT.mkdir(parents=True, exist_ok=True)
torch.set_num_threads(4)

def upstream_classes(filename, names):
    tree = ast.parse((ROOT / 'sources' / filename).read_text(encoding='utf-8'))
    selected = [n for n in tree.body if isinstance(n, (ast.ClassDef, ast.FunctionDef)) and n.name in names]
    namespace = {'torch': torch, 'nn': nn, 'F': F}
    exec(compile(ast.Module(body=selected, type_ignores=[]), filename, 'exec'), namespace)
    return namespace

lut_code = upstream_classes('lut-models.py', {'discriminator_block', 'Classifier'})
ada_code = upstream_classes('adaint-model.py', {'BasicBlock', 'TPAMIBackbone', 'LUTGenerator', 'AdaInt'})

def load_weights(name):
    return torch.load(ROOT / 'weights' / name, map_location='cpu', weights_only=True)

classifier = lut_code['Classifier']().eval()
classifier.load_state_dict(load_weights('classifier.pth'), strict=True)
bases = torch.stack([load_weights('luts.pth')[str(i)]['LUT'] for i in range(3)])

class Adaptive(nn.Module):
    def __init__(self):
        super().__init__()
        self.backbone = ada_code['TPAMIBackbone'](extra_pooling=True)
        self.lut_generator = ada_code['LUTGenerator'](3, 33, 512, 3)
        self.adaint = ada_code['AdaInt'](3, 33, 512)
    def forward(self, image):
        features = self.backbone(image)
        _, lut = self.lut_generator(features)
        return lut, self.adaint(features)

adaptive = Adaptive().eval()
adaptive.load_state_dict(load_weights('adaint.pth')['state_dict'], strict=True)

def transform(lut, image, vertices=None):
    # LUT axes are B,G,R; grid_sample takes the coordinates R,G,B.
    coords = image.permute(0, 2, 3, 1).contiguous()
    if vertices is None:
        # Match upstream TPAMI trilinear binsize = 1.0001 / (D-1).
        coords = coords / 1.0001
    else:
        mapped = []
        for c in range(3):
            v = vertices[0, c].contiguous()
            values = coords[..., c].contiguous()
            upper = torch.searchsorted(v, values, right=True).clamp(1, len(v)-1)
            lower = upper-1
            fraction = (values-v[lower])/(v[upper]-v[lower]).clamp_min(1e-8)
            mapped.append((lower+fraction)/(len(v)-1))
        coords = torch.stack(mapped, dim=-1)
    return F.grid_sample(lut, (coords*2-1).unsqueeze(1), mode='bilinear', padding_mode='border', align_corners=True).squeeze(2)

@torch.inference_mode()
def enhance(image, mode):
    if mode == '3dlut':
        coefficients = classifier(image).reshape(3)
        lut = (bases * coefficients[:, None, None, None, None]).sum(0).unsqueeze(0)
        return transform(lut, image)
    lut, vertices = adaptive(image)
    return transform(lut, image, vertices)

def check_interpolation():
    torch.manual_seed(12)
    vertices = torch.stack([torch.linspace(0, 1, 33)**p for p in [1.2, .8, 1.5]])[None]
    b,g,r = torch.meshgrid(vertices[0,2],vertices[0,1],vertices[0,0],indexing='ij')
    identity = torch.stack([r,g,b])[None]
    pixels = torch.rand(1,3,9,7)
    error = float((transform(identity,pixels,vertices)-pixels).abs().max())
    assert error < 2e-6, error
    return error

def save_tensor(tensor, path):
    arr = tensor[0].permute(1,2,0).clamp(0,1).mul(255).round().byte().numpy()
    Image.fromarray(arr).save(path)

def main():
    report={'device':'CPU / 4 threads','torch':torch.__version__,'interpolation_identity_max_error':check_interpolation(),'weights_sha256':{p.name:hashlib.sha256(p.read_bytes()).hexdigest() for p in (ROOT/'weights').glob('*.pth')},'samples':[]}
    samples=[ROOT/'sources'/'adaint-demo.jpg',*sorted(ASSETS.glob('photo-*.jpg'))]
    for i,path in enumerate(samples):
        image=ImageOps.exif_transpose(Image.open(path)).convert('RGB')
        image.thumbnail((1600,1600))
        x=torch.from_numpy(np.array(image).astype(np.float32)/255).permute(2,0,1)[None]
        prefix=f'{i:02}'
        image.save(OUT/f'{prefix}-original.png')
        entry={'name':path.name,'size':list(image.size),'source':str(path),'results':{}}
        for mode in ['3dlut','adaint']:
            enhance(x,mode)  # warm up separately; excludes load time
            times=[]
            for _ in range(3):
                start=time.perf_counter();result=enhance(x,mode);times.append((time.perf_counter()-start)*1000)
            assert torch.isfinite(result).all()
            save_tensor(result,OUT/f'{prefix}-{mode}.png')
            entry['results'][mode]={'median_ms':round(float(np.median(times)),1),'clipped_channels_pct':round(float(((result<0)|(result>1)).float().mean()*100),3),'mean_absolute_change':round(float((result.clamp(0,1)-x).abs().mean()),4)}
        report['samples'].append(entry)
        print(json.dumps(entry,ensure_ascii=False),flush=True)
    (OUT/'report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
    rows=''.join(f'<section><h2>{i+1}. {s["name"]} <small>{s["size"][0]} × {s["size"][1]}</small></h2><div class="grid">'+''.join(f'<figure><img loading="lazy" src="{i:02}-{m}.png"><figcaption>{label}'+('' if m=='original' else f' · {s["results"][m]["median_ms"]} ms')+'</figcaption></figure>' for m,label in [('original','原图'),('3dlut','Image-Adaptive-3DLUT'),('adaint','AdaInt')])+'</div></section>' for i,s in enumerate(report['samples']))
    (OUT/'index.html').write_text('''<!doctype html><html lang="zh"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>FrameLab · AI 调色实测</title><style>body{font:15px system-ui;background:#eee;color:#222;margin:28px}h1{font-size:26px}p{max-width:950px;line-height:1.7}small{font-size:12px;color:#777}section{margin:32px 0}h2{font-size:16px}.grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}figure{margin:0}img{width:100%;height:340px;object-fit:contain;background:#ddd}figcaption{padding:10px 0}button{padding:10px;border:1px solid #aaa;background:white;cursor:pointer}@media(max-width:700px){.grid{grid-template-columns:1fr}}</style><h1>AI 自动调色 · 本机实测对照</h1><p>相同输入、原始预训练 sRGB 权重、100% 强度。CPU / 4 线程，耗时为预热后 3 次中位数，不含模型加载和图片读写。首张为 AdaInt 官方演示素材，其余为 FrameLab 示例照片（已经过调色，不能用来判定模型整体优劣）。此处是两套模型实际计算的结果。</p><p>观察高光、肤色/中性色、暗部层次和整体饱和度。单张耗时及颜色截断统计见 <a href="report.json">报告</a>。</p>'''+rows,encoding='utf-8')

if __name__=='__main__':main()
