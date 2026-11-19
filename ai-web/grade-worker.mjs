import {applyGrade, gradeLUT, gradeSettings, presets} from './grade-recipes.mjs';

let original, base, mask;
async function readPixels(blob, longestSide = 1600) {
  const image = await createImageBitmap(blob);
  try {
    const scale = Math.min(1, longestSide / Math.max(image.width, image.height));
    const canvas = new OffscreenCanvas(Math.max(1, Math.round(image.width * scale)), Math.max(1, Math.round(image.height * scale)));
    const ctx = canvas.getContext('2d', {willReadFrequently: true});
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
    return ctx.getImageData(0, 0, canvas.width, canvas.height);
  } finally {
    image.close();
  }
}
function canvasFromPixels(pixels) {
  const canvas = new OffscreenCanvas(pixels.width, pixels.height);
  canvas.getContext('2d').putImageData(pixels, 0, 0);
  return canvas;
}
async function gradeImage(source, edit, localMask, quality) {
  const data = new Uint8ClampedArray(source.data);
  applyGrade(data, gradeLUT(edit), edit.local, localMask);
  const canvas = canvasFromPixels(new ImageData(data, source.width, source.height));
  return canvas.convertToBlob({type: 'image/jpeg', quality});
}
function recommend(pixels) {
  let dark=0, bright=0, winter=0, blue=0, green=0, warm=0, skin=0;
  const {data, width, height} = pixels;
  const rows = 40, columns = 40;
  for (let y=0;y<rows;y++) for (let x=0;x<columns;x++) {
    const i = (Math.min(height-1,Math.floor(y*height/rows))*width+Math.min(width-1,Math.floor(x*width/columns)))*4;
    const [r,g,b] = [data[i],data[i+1],data[i+2]];
    const max = Math.max(r,g,b), min = Math.min(r,g,b), yL = .2126*r+.7152*g+.0722*b;
    dark += Number(yL < 72);
    bright += Number(yL > 222);
    winter += Number(yL > 182 && max-min < 26);
    blue += Number(b > r+16 && yL > 70);
    green += Number(g > r+9 && g > b+13);
    warm += Number(r > g+17 && g > b+19);
    skin += Number(x > 10 && x < 30 && y > 7 && y < 26 && r > 105 && r > g+12 && g > b+8 && r-b < 86);
  }
  const count = rows*columns;
  const global = {};
  if (dark/count > .43 && bright/count < .08) global.exposure=.1;
  if (dark/count > .57) global.shadows=6;
  if (bright/count > .2) global.highlights=-8;
  let preset='';
  if (dark/count > .39 && skin > 115) preset='portrait';
  else if (winter/count > .36) preset='winter';
  else if (blue/count > .29 && dark/count > .27) preset='blue';
  else if (green/count > .26 && warm/count > .13) preset='autumn';
  else if (green/count > .23) preset='spring';
  else if (blue/count > .32 && dark/count < .18) preset='summer';
  else if (warm/count > .33 && dark/count < .28) preset='golden';
  return {preset,global};
}

function thumbnailPixels(pixels) {
  const canvas = new OffscreenCanvas(212, 122);
  const ctx = canvas.getContext('2d');
  const scale = Math.max(canvas.width/pixels.width, canvas.height/pixels.height);
  const w = pixels.width*scale, h = pixels.height*scale;
  ctx.drawImage(canvasFromPixels(pixels), (canvas.width-w)/2, (canvas.height-h)*.35, w, h);
  return ctx.getImageData(0, 0, canvas.width, canvas.height);
}
self.onmessage = async ({data: {id,type,payload}}) => {
  try {
    let value;
    if (type === 'open') {
      original = await readPixels(payload);
      value = {width:original.width, height:original.height, suggested:recommend(original)};
    } else if (type === 'base') {
      base = payload ? await readPixels(payload) : null;
    } else if (type === 'mask') {
      mask = payload;
    } else if (type === 'thumbnail') {
      const pixels = thumbnailPixels(original);
      value = await Promise.all(Object.keys(presets).map(async key => [key, await gradeImage(pixels,gradeSettings({preset:key,strength:100}),null,.85)]));
    } else if (type === 'render') {
      const edit = gradeSettings(payload.edit);
      const source = payload.useBase && base ? base : original;
      value = await gradeImage(source, edit, mask?.length === source.width * source.height ? mask : null, payload.quality);
    }
    self.postMessage({id,value});
  } catch (error) {
    self.postMessage({id,error:error.message || '无法处理照片'});
  }
};
