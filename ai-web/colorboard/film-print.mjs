import { applyGlow } from './glow-engine.mjs';

export const FILMS = [
  {id:'daylight', name:'日光彩负', paper:'warm', saturation:.92, toe:.018, shoulder:.91, tint:[.017,.004,-.013], grain:27, halation:12},
  {id:'cinema', name:'夜景电影负片', paper:'neutral', saturation:.86, toe:.012, shoulder:.95, tint:[-.021,.008,.028], grain:36, halation:34},
  {id:'silver', name:'黑白银盐', paper:'silver', saturation:0, toe:.008, shoulder:.94, tint:[0,0,0], grain:45, halation:0}
];

export const PAPERS = [
  {id:'neutral', name:'中性彩色相纸', contrast:1.06, tint:[0,0,0]},
  {id:'warm', name:'暖调哑光相纸', contrast:.92, tint:[.022,.008,-.017]},
  {id:'silver', name:'黑白银盐相纸', contrast:1.14, tint:[0,0,0], mono:true}
];

export const FILM_CONTROLS = [
  ['exposure','显影前曝光',-2,2,.05,' EV'],
  ['whiteBalance','显影前白平衡',-100,100,1],
  ['contrast','相纸反差',-100,100,1],
  ['grain','颗粒强度',0,100,1,'%'],
  ['grainSize','颗粒大小',1,5,.25],
  ['halation','片基光晕',0,100,1,'%'],
  ['halationRadius','光晕范围',0,100,1,'%']
];

export function filmDefaults(id = FILMS[0].id) {
  const film = FILMS.find(item => item.id === id) ?? FILMS[0];
  return {enabled:false, film:film.id, paper:film.paper, exposure:0, whiteBalance:0, contrast:0,
    grain:film.grain, grainSize:1.75, halation:film.halation, halationRadius:24};
}

const clamp = (value, low = 0, high = 1) => Math.min(high, Math.max(low, value));

export function normalizeFilmPrint(input) {
  const result = filmDefaults(input?.film);
  result.enabled = input?.enabled === true;
  if (PAPERS.some(item => item.id === input?.paper)) result.paper = input.paper;
  for (const [key,,min,max] of FILM_CONTROLS) {
    if (Number.isFinite(input?.[key])) result[key] = clamp(input[key],min,max);
  }
  return result;
}

const linear = Float32Array.from({length:256},(_,i) => {
  const value = i/255;
  return value <= .04045 ? value/12.92 : ((value+.055)/1.055)**2.4;
});
const encode = value => value <= .0031308 ? value*12.92 : 1.055*value**(1/2.4)-.055;

function noise(x,y) {
  let hash = Math.imul(x+100003, 1597334677) ^ Math.imul(y+140009, 3812015801);
  hash = Math.imul(hash ^ (hash >>> 16), 0x45d9f3b);
  return ((hash ^ (hash >>> 16)) >>> 0)/4294967296-.5;
}

export function renderFilmPrint(image, settings) {
  if (!settings.enabled) return image;
  const film = FILMS.find(item => item.id === settings.film);
  const paper = PAPERS.find(item => item.id === settings.paper);
  const {width,height} = image;
  const output = new ImageData(width,height);
  const saturation = paper.mono ? 0 : film.saturation;
  const exposure = 2**settings.exposure;
  const temperature = settings.whiteBalance*.004;
  const contrast = paper.contrast*2**(settings.contrast/125);
  const tables = [temperature,0,-temperature].map(balance =>
    Float32Array.from(linear,value => {
      const exposed = value*exposure*2**balance;
      const compressed = exposed/(.91+.09*exposed);
      return encode(clamp(compressed));
    }));
  const dot = Math.max(1,settings.grainSize*Math.min(width,height)/740);
  const grain = settings.grain*.0019;
  const range = film.shoulder-film.toe;
  const tints = film.tint.map((value,i) => paper.mono ? 0 : value+paper.tint[i]);
  const tableSize = 2048;
  const response = tints.map(tint => Float32Array.from({length:tableSize+1},(_,i) => {
    const density = i/tableSize;
    const developed = density*density*(3-2*density);
    return (film.toe+(density*.68+developed*.32)*range-.5)*contrast+.5+Math.sin(density*Math.PI)*tint;
  }));
  const data = image.data, target = output.data;
  for (let y=0,index=0; y<height; y++) {
    const gy = y/dot, row = Math.floor(gy), fy = gy-row;
    let cell = -1, left = 0, right = 0;
    for (let x=0; x<width; x++,index+=4) {
      target[index+3] = data[index+3];
      if (!target[index+3]) continue;
      const red = tables[0][data[index]], green = tables[1][data[index+1]], blue = tables[2][data[index+2]];
      const luma = red*.2126+green*.7152+blue*.0722;
      let dust = 0;
      if (grain) {
        const gx = x/dot, column = Math.floor(gx);
        if (column !== cell) {
          left = noise(column,row)*(1-fy)+noise(column,row+1)*fy;
          right = noise(column+1,row)*(1-fy)+noise(column+1,row+1)*fy;
          cell = column;
        }
        dust = (left+(right-left)*(gx-column))*grain*(.35+.65*(1-luma));
      }
      target[index] = (response[0][Math.round(clamp(luma+(red-luma)*saturation)*tableSize)]+dust)*255;
      target[index+1] = (response[1][Math.round(clamp(luma+(green-luma)*saturation)*tableSize)]+dust)*255;
      target[index+2] = (response[2][Math.round(clamp(luma+(blue-luma)*saturation)*tableSize)]+dust)*255;
    }
  }
  if (!settings.halation) return output;
  return applyGlow(output,{amount:settings.halation*.58,threshold:78,radius:settings.halationRadius*.60,
    warmth:saturation ? 85 : 0});
}
