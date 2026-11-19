const here = name => new URL(name, import.meta.url).href;
let segmenter;
export async function subjectMask(image, [x, y]) {
  if (!segmenter) segmenter = import(here('mediapipe/vision_bundle.mjs')).then(async ({FilesetResolver, InteractiveSegmenter}) => {
    const runtime = await FilesetResolver.forVisionTasks(here('mediapipe/wasm/'));
    return InteractiveSegmenter.createFromOptions(runtime, {
      baseOptions: {modelAssetPath: here('magic-touch.tflite'), delegate: 'CPU'},
      outputConfidenceMasks: false, outputCategoryMask: true,
    });
  }).catch(error => {segmenter=null;throw error;});
  const model = await segmenter;
  return new Promise((resolve,reject) => {
    model.segment(image, {keypoint:{x,y}}, ({categoryMask}) => {
      if (!categoryMask) return reject(new Error('无法读取主体选区'));
      const {width,height} = categoryMask;
      const values = categoryMask.getAsUint8Array();
      const subject = values[Math.min(height-1, Math.floor(y*height))*width + Math.min(width-1, Math.floor(x*width))];
      const mask = new ImageData(width, height);
      let area = 0;
      for (let i=0;i<values.length;i++) {
        if (values[i] !== subject) continue;
        mask.data[i*4+3] = 255;
        area++;
      }
      if (area < 3 || area === values.length) return reject(new Error('未识别到主体，请点选主体内部或使用画笔'));
      resolve(mask);
    });
  });
}
export function drawMask(width,height,subject,strokes,feather) {
  const canvas = document.createElement('canvas');
  canvas.width=width; canvas.height=height;
  const ctx = canvas.getContext('2d',{willReadFrequently:true});
  if (subject) {
    const source = document.createElement('canvas');
    source.width=subject.width; source.height=subject.height;
    source.getContext('2d').putImageData(subject,0,0);
    ctx.drawImage(source,0,0,width,height);
  }
  const scalar = Math.min(width,height);
  for (const {erase, points, radius} of strokes) {
    ctx.globalCompositeOperation = erase ? 'destination-out' : 'source-over';
    ctx.lineCap = ctx.lineJoin = 'round';
    ctx.lineWidth = scalar * radius * 2;
    const [x,y] = points[0];
    ctx.beginPath();
    ctx.arc(x*width,y*height,scalar*radius,0,Math.PI*2);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(x*width,y*height);
    for (const [x,y] of points.slice(1)) ctx.lineTo(x*width,y*height);
    ctx.stroke();
  }
  if (!feather) return canvas;
  const softened = document.createElement('canvas');
  softened.width=width; softened.height=height;
  const soft = softened.getContext('2d',{willReadFrequently:true});
  soft.filter=`blur(${feather*scalar*.00025}px)`;
  soft.drawImage(canvas,0,0);
  return softened;
}
