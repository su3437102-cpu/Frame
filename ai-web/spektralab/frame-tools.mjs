const header = 'FRAMELAB-SPEKTRA-1\n';
const marker = new TextEncoder().encode(header);
export const maxPhotoBytes = 128 * 1024 * 1024;
export const photoType = file => /^image\/(?:jpeg|png|webp|tiff)$/.test(file.type)
  || /\.(?:jpe?g|png|webp|tiff?|dng|cr[23w]|nef|nrw|arw|sr[2fw]|raf|orf|rw2|pef|raw)$/i.test(file.name || '');

export function encodeProject(photo, recipe) {
  const meta = new TextEncoder().encode(JSON.stringify({name:photo.name,type:photo.blob.type,recipe}));
  const length = new Uint8Array(4);
  new DataView(length.buffer).setUint32(0,meta.length,true);
  return new Blob([marker,length,meta,photo.blob],{type:'application/octet-stream'});
}

export async function decodeProject(file) {
  const start = new Uint8Array(await file.slice(0,marker.length+4).arrayBuffer());
  if (start.length !== marker.length+4 || !marker.every((value,index) => value === start[index])) {
    throw new Error('无法识别此 FrameLab 冲洗工程');
  }
  const length = new DataView(start.buffer).getUint32(marker.length,true);
  const offset = start.length+length;
  if (!length || length > 64*1024 || offset >= file.size || file.size-offset > maxPhotoBytes) {
    throw new Error('冲洗工程超过支持的大小或已损坏');
  }
  const info = JSON.parse(await file.slice(start.length,offset).text());
  if (typeof info.name !== 'string' || typeof info.type !== 'string' || !info.recipe || typeof info.recipe !== 'object') {
    throw new Error('冲洗工程缺少照片或配方');
  }
  const name = info.name.slice(0,180);
  const blob = file.slice(offset,file.size,info.type);
  if (!photoType({name,type:blob.type})) throw new Error('工程中的照片格式无法识别');
  return {name,blob,recipe:info.recipe};
}

export function geometryCanvas(frame, appearance) {
  const canvas = new OffscreenCanvas(frame.width,frame.height);
  canvas.getContext('2d').putImageData(new ImageData(new Uint8ClampedArray(frame.rgba),frame.width,frame.height),0,0);
  if (!appearance) return canvas;
  const angle = (Number(appearance.turn)*90 + Number(appearance.straighten)) * Math.PI/180;
  const c = Math.abs(Math.cos(angle)), s = Math.abs(Math.sin(angle));
  const turned = Number(appearance.turn)%2 !== 0;
  const baseWidth = turned ? frame.height : frame.width;
  const baseHeight = turned ? frame.width : frame.height;
  const ratio = {'1:1':1,'4:5':.8,'3:2':1.5,'16:9':16/9}[appearance.aspect] || baseWidth/baseHeight;
  const crop = Math.max(.3,Number(appearance.zoom) || 1);
  const width = Math.max(1,Math.min(baseWidth,baseHeight*ratio)*crop);
  const height = width/ratio;
  const cover = Math.max(1,(c*width+s*height)/frame.width,(s*width+c*height)/frame.height);
  const borderSize = appearance.border === 'none' ? 0 : Math.min(width,height)*(appearance.border === '135' ? .10 : .065);
  const output = new OffscreenCanvas(Math.round(width+2*borderSize),Math.round(height+2*borderSize));
  const ctx = output.getContext('2d');
  ctx.fillStyle = appearance.border === 'paper' ? '#eee9dd' : '#201810';
  ctx.fillRect(0,0,output.width,output.height);
  if (appearance.border === '135') {
    ctx.fillStyle = '#100e0d';
    const pitch = borderSize*.90;
    for (let x = pitch*.3; x < output.width-pitch; x += pitch) {
      ctx.beginPath();
      ctx.roundRect(x,borderSize*.28,pitch*.57,borderSize*.29,borderSize*.055);
      ctx.roundRect(x,output.height-borderSize*.57,pitch*.57,borderSize*.29,borderSize*.055);
      ctx.fill();
    }
  }
  ctx.save();
  ctx.beginPath();
  ctx.rect(borderSize,borderSize,width,height);
  ctx.clip();
  ctx.translate(output.width/2,output.height/2);
  ctx.rotate(angle);
  ctx.scale(appearance.flip ? -cover : cover,cover);
  ctx.drawImage(canvas,-frame.width/2,-frame.height/2);
  ctx.restore();
  if (appearance.imprint) {
    const fontSize = Math.max(10,Math.min(width,height)*.052);
    ctx.font = '600 '+fontSize+'px monospace';
    ctx.textAlign = appearance.corner === 'left' ? 'left' : 'right';
    ctx.textBaseline = 'bottom';
    ctx.fillStyle = '#efa252';
    ctx.fillText(String(appearance.imprint).slice(0,32),
      appearance.corner === 'left' ? borderSize+fontSize*.55 : borderSize+width-fontSize*.55,
      borderSize+height-fontSize*.36);
  }
  return output;
}

export function rgbaTiff(width,height,rgba) {
  // Baseline TIFF, little endian. One RGB strip, 8 bits per sample.
  const fields = 11, tail = 8+2+12*fields+4, data = tail+6;
  const bytes = new Uint8Array(data+width*height*3);
  const view = new DataView(bytes.buffer);
  const short = (offset,value) => view.setUint16(offset,value,true);
  const long = (offset,value) => view.setUint32(offset,value,true);
  short(0,0x4949);
  short(2,42);
  long(4,8);
  short(8,fields);
  const tags = [
    [256,4,1,width],[257,4,1,height],[258,3,3,tail],[259,3,1,1],[262,3,1,2],
    [273,4,1,data],[274,3,1,1],[277,3,1,3],[278,4,1,height],
    [279,4,1,width*height*3],[284,3,1,1]
  ];
  tags.forEach(([tag,type,count,value],index) => {
    const offset = 10+index*12;
    short(offset,tag); short(offset+2,type); long(offset+4,count); long(offset+8,value);
  });
  short(tail,8); short(tail+2,8); short(tail+4,8);
  for (let i=0,p=data; i<rgba.length; i+=4) {
    bytes[p++]=rgba[i]; bytes[p++]=rgba[i+1]; bytes[p++]=rgba[i+2];
  }
  return new Blob([bytes],{type:'image/tiff'});
}
