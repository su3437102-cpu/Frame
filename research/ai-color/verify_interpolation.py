import json
import numpy as np
import torch
from evaluate import transform, OUT

# Independent scalar eight-corner interpolation, following upstream CPU indexing.
torch.manual_seed(7)
lut=torch.rand(1,3,33,33,33)
image=torch.rand(1,3,8,8)
image[0,:,0,0]=0
image[0,:,0,1]=1
vertices=torch.cat([torch.zeros(1,3,1),torch.softmax(torch.rand(1,3,32),-1).cumsum(-1)],-1)
errors={}
for mode in ['3dlut','adaint']:
    grid=np.tile(np.linspace(0,1.0001,33),(3,1)) if mode=='3dlut' else vertices[0].numpy()
    ref=np.zeros((3,8,8),dtype=np.float64)
    table=lut[0].numpy()
    for y in range(8):
        for x in range(8):
            values=image[0,:,y,x].numpy()
            ids=[max(0,min(31,np.searchsorted(grid[c],values[c],side='left')-1)) for c in range(3)]
            f=[(values[c]-grid[c,ids[c]])/(grid[c,ids[c]+1]-grid[c,ids[c]]) for c in range(3)]
            for r in [0,1]:
                for g in [0,1]:
                    for b in [0,1]:
                        w=(f[0] if r else 1-f[0])*(f[1] if g else 1-f[1])*(f[2] if b else 1-f[2])
                        ref[:,y,x]+=table[:,ids[2]+b,ids[1]+g,ids[0]+r]*w
    actual=transform(lut,image,None if mode=='3dlut' else vertices)[0].numpy()
    errors[mode]=float(np.max(np.abs(actual-ref)))
    assert errors[mode]<1e-5,errors
report=json.loads((OUT/'report.json').read_text(encoding='utf-8'))
report['scalar_interpolation_max_error']=errors
(OUT/'report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
print(errors)
