import { Collage } from './artwork.mjs';
import { JournalArt } from './journal.mjs';
import { JournalMarks } from './journal-marks.mjs';
import { BrushArt } from './brush.mjs';
export const Renderer = (() => {
  const sizes = {landscape: [1200, 800], square: [1200, 1200], portrait: [960, 1200], journal: [900, 1200], wide: [1200, 675]};
  const tones = {
    original: 'none',
    mono: 'grayscale(1) contrast(1.09)',
    warm: 'grayscale(.76) sepia(.34) saturate(.78) contrast(1.04)'
  };
  const tile = document.createElement('canvas');
  tile.width = 256;
  tile.height = 256;
  const grainContext = tile.getContext('2d');
  const noise = grainContext.createImageData(256, 256);
  const grainRng = Collage.random(59012);
  for (let i = 0; i < noise.data.length; i += 4) {
    const brightness = grainRng() > .5 ? 250 : 24;
    noise.data[i] = brightness;
    noise.data[i + 1] = brightness;
    noise.data[i + 2] = brightness;
    noise.data[i + 3] = Math.floor(grainRng() ** 2 * 67);
  }
  grainContext.putImageData(noise, 0, 0);

  function dimensions(scene) {
    const [panelWidth, height] = sizes[scene.aspect];
    return [scene.split === true ? panelWidth * 2 : panelWidth, height];
  }

  // Layer coordinates always use one panel as their reference, even across the seam.
  function placement(layer, width, height) {
    const scale = Math.min(width / 1200, height / 800) * (layer.scale / 100);
    const sx = layer.scaleX ?? 1;
    const sy = layer.scaleY ?? 1;
    const contentW = layer.w * scale;
    const contentH = layer.h * scale;
    return {
      x: layer.x * (width / 1200), y: layer.y * (height / 800),
      w: contentW * sx, h: contentH * sy,
      contentW, contentH, sx, sy, angle: (layer.rotation % 360) * Math.PI / 180
    };
  }

  function validBox(box) {
    return Number.isFinite(box.x) && Number.isFinite(box.y) &&
      Number.isFinite(box.w) && Number.isFinite(box.h) && box.w > 0 && box.h > 0;
  }

  function cutPath(mask, w, h, outline) {
    const path = new Path2D();
    if (mask === 'circle') {
      path.ellipse(0, 0, w / 2, h / 2, 0, 0, Math.PI * 2);
    } else if (mask === 'rect') {
      path.rect(-w / 2, -h / 2, w, h);
    } else {
      const points = mask === 'polygon' && outline?.length >= 3 ? outline : mask === 'cut'
        ? [[.05,.02],[.98,.08],[.87,.99],[0,.84]]
        : [[.015,.04],[.094,.062],[.163,.015],[.23,.045],[.32,.014],[.41,.048],[.479,.023],
           [.55,.05],[.62,0],[.677,.051],[.738,.026],[.81,.075],[.866,.037],[.95,.067],
           [.982,.034],[.972,.195],[1,.315],[.974,.44],[.998,.555],[.972,.733],[.985,.853],
           [.962,.943],[.875,.961],[.817,.926],[.752,.975],[.678,.944],[.602,.983],[.52,.954],
           [.47,.991],[.385,.96],[.327,.987],[.244,.958],[.172,.978],[.108,.942],[.02,.952],
           [.028,.838],[0,.711],[.019,.609],[.005,.477],[.026,.347],[0,.248],[.026,.149]];
      points.forEach(([x,y], i) => {
        const px = (x - .5) * w;
        const py = (y - .5) * h;
        if (i === 0) path.moveTo(px, py);
        else path.lineTo(px, py);
      });
      path.closePath();
    }
    return path;
  }

  function grain(ctx, x, y, w, h, alpha = .65) {
    ctx.save();
    ctx.globalAlpha *= alpha;
    ctx.fillStyle = ctx.createPattern(tile, 'repeat');
    ctx.fillRect(x, y, w, h);
    ctx.restore();
  }

  function photoDimensions(image, layer, w, h) {
    const iw = image.naturalWidth || image.width;
    const ih = image.naturalHeight || image.height;
    if (!iw || !ih) return [0, 0];
    const fit = layer.fit === 'contain' ? Math.min : Math.max;
    const ratio = fit(w / iw, h / ih);
    return [iw * ratio, ih * ratio];
  }

  function photoOffset(layer, dw, dh, w, h) {
    return [
      Math.max(0, dw - w) * (.5 - (layer.focusX ?? .5)),
      Math.max(0, dh - h) * (.5 - (layer.focusY ?? .5))
    ];
  }

  function drawPhoto(ctx, image, layer, w, h) {
    if (!image) return;
    const [dw, dh] = photoDimensions(image, layer, w, h);
    if (!dw || !dh) return;
    ctx.filter = tones[layer.tone] || 'none';
    const [dx, dy] = photoOffset(layer, dw, dh, w, h);
    ctx.drawImage(image, dx - dw / 2, dy - dh / 2, dw, dh);
    ctx.filter = 'none';
  }

  function textFont(ctx, layer, lineHeight) {
    const artistic = layer.font && JournalArt.fonts.find(font => font.id === layer.font);
    const brush = layer.style === 'brush';
    const family = artistic?.family || (brush ? '"Template Brush", KaiTi, STKaiti, "Noto Serif CJK SC", serif'
      : layer.mono ? 'monospace' : 'Arial Black, Arial, sans-serif');
    const bend = Math.abs(layer.curve || 0) / 100;
    const pathHeight = layer.curvePath ? Math.max(...layer.curvePath.map(point => Math.abs(point.y))) : 0;
    const shrink = Math.min(.43, Math.max(.37 * bend, .65 * pathHeight));
    const size = Math.max(1, lineHeight * (1 - shrink) * (artistic?.size ?? (brush ? .90 : layer.mono ? .77 : 1.25)));
    const weight = artistic?.weight ?? (brush ? 400 : layer.mono ? 700 : 950);
    ctx.font = (artistic?.italic ? 'italic ' : '') + weight + ' ' + size + 'px ' + family;
    return !(artistic || brush || layer.mono);
  }

  function defaultPath(ctx, layer, line, width, stretch) {
    const measured = ctx.measureText(line).width;
    const span = stretch ? .90 : Math.min(.90, Math.max(.07, measured * 1.09 / width));
    const left = layer.align === 'left' ? -.45 : layer.align === 'right' ? .45 - span : -span/2;
    const bump = (layer.curve || 0) * .0032;
    return [{x:left,y:bump/2}, {x:left+span/2,y:-1.5*bump}, {x:left+span,y:bump/2}];
  }

  function textPathControls(ctx, layer, w, h) {
    const lines = layer.text.split('\n');
    const lineHeight = h / lines.length;
    const baseline = -h/2 + .55*lineHeight;
    ctx.save();
    const stretch = textFont(ctx, layer, lineHeight);
    const path = layer.curvePath || defaultPath(ctx,layer,lines[0],w,stretch);
    ctx.restore();
    return {path, lineHeight, baseline, points:path.map(point=>[point.x*w, baseline+point.y*lineHeight])};
  }

  function drawCurvedLine(ctx, line, points, stretch) {
    const glyphs = typeof Intl.Segmenter === 'function'
      ? [...new Intl.Segmenter(undefined,{granularity:'grapheme'}).segment(line)].map(item=>item.segment)
      : Array.from(line);
    const advances = glyphs.map(glyph=>ctx.measureText(glyph).width);
    const total = advances.reduce((sum,value)=>sum+value,0);
    if (!total) return;
    const [start, control, end] = points;
    const samples = [{x:start[0],y:start[1],length:0}];
    for (let i=1;i<=64;i++) {
      const t=i/64, u=1-t;
      const x=u*u*start[0]+2*u*t*control[0]+t*t*end[0];
      const y=u*u*start[1]+2*u*t*control[1]+t*t*end[1];
      const previous=samples.at(-1);
      samples.push({x,y,length:previous.length+Math.hypot(x-previous.x,y-previous.y)});
    }
    const length=samples.at(-1).length;
    if (!length || !Number.isFinite(length)) return;
    const scale=stretch ? length/total : Math.min(1,length/total);
    let offset=ctx.textAlign==='left'?0:ctx.textAlign==='right'?length-total*scale:(length-total*scale)/2;
    let index=1;
    ctx.textAlign='center';
    glyphs.forEach((glyph,i)=>{
      const step=advances[i]*scale;
      const at=offset+step/2;
      while (index<64 && samples[index].length<at) index++;
      const previous=samples[index-1], next=samples[index];
      const fraction=(at-previous.length)/(next.length-previous.length || 1);
      const t=Math.max(0,Math.min(1,(index-1+fraction)/64));
      const u=1-t;
      const x=u*u*start[0]+2*u*t*control[0]+t*t*end[0];
      const y=u*u*start[1]+2*u*t*control[1]+t*t*end[1];
      const dx=u*(control[0]-start[0])+t*(end[0]-control[0]);
      const dy=u*(control[1]-start[1])+t*(end[1]-control[1]);
      ctx.save();
      ctx.translate(x,y);
      ctx.rotate(Math.atan2(dy,dx));
      ctx.scale(scale,1);
      ctx.fillText(glyph,0,0);
      ctx.restore();
      offset+=step;
    });
  }

  function drawType(ctx, layer, w, h) {
    const lines = layer.text.split('\n');
    const lineHeight = h / lines.length;
    const stretch=textFont(ctx,layer,lineHeight);
    ctx.fillStyle = layer.color;
    ctx.textAlign = layer.align || 'center';
    ctx.textBaseline = 'middle';
    lines.forEach((line, i) => {
      const baseline = -h/2+(i+.55)*lineHeight;
      ctx.save();
      if (layer.curve || layer.curvePath) {
        const path=layer.curvePath || defaultPath(ctx,layer,line,w,stretch);
        drawCurvedLine(ctx,line,path.map(point=>[point.x*w,baseline+point.y*lineHeight]),stretch);
        ctx.restore();
        return;
      }
      const available = w * .96;
      const natural = Math.max(1, ctx.measureText(line).width);
      const scale = stretch ? available / natural : Math.min(available / natural, 1);
      const x = ctx.textAlign === 'left' ? -available / (2 * scale)
        : ctx.textAlign === 'right' ? available / (2 * scale) : 0;
      ctx.scale(scale, 1);
      ctx.fillText(line, x, baseline);
      ctx.restore();
    });
  }

  function visiblePatternBounds(box,width,height) {
    const sin=Math.sin(box.angle), cos=Math.cos(box.angle);
    const corners=[[0,0],[width,0],[0,height],[width,height]].map(([x,y])=>[
      (x-box.x)*cos+(y-box.y)*sin+box.w/2,
      -(x-box.x)*sin+(y-box.y)*cos+box.h/2
    ]);
    const xs=corners.map(point=>point[0]), ys=corners.map(point=>point[1]);
    return [Math.max(0,Math.min(...xs)-16),Math.max(0,Math.min(...ys)-20),
      Math.min(box.w,Math.max(...xs)+16),Math.min(box.h,Math.max(...ys)+20)];
  }

  function drawLayer(ctx, layer, panelWidth, width, height, images) {
    if (layer.hidden || layer.opacity === 0) return;
    const box = placement(layer, panelWidth, height);
    if (!validBox(box)) return;
    const {x, y, contentW: w, contentH: h, sx, sy, angle} = box;
    const path = cutPath(layer.mask, w, h, layer.points);
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    ctx.scale(sx, sy);
    ctx.globalAlpha = layer.opacity / 100;
    ctx.globalCompositeOperation = layer.blend;
    if (layer.ring) {
      ctx.strokeStyle = layer.color;
      ctx.lineWidth = 1.35;
      ctx.stroke(path);
      ctx.stroke(cutPath(layer.mask, w * 1.024, h * 1.024));
    } else {
      ctx.clip(path);
      if (layer.kind === 'photo') drawPhoto(ctx, images.get(layer.asset)?.image, layer, w, h);
      if (layer.kind === 'type') drawType(ctx, layer, w, h);
      if (layer.kind === 'mark') {
        if (layer.markGroup === 'fill' && ['halftone','contours','code'].includes(layer.pattern)) {
          ctx.scale(1/sx,1/sy);
          JournalMarks.draw(ctx,layer,box.w,box.h,visiblePatternBounds(box,width,height));
        } else JournalMarks.draw(ctx, layer, w, h);
      }
      if (layer.kind === 'stroke') BrushArt.draw(ctx, layer, w, h);
      if (layer.kind === 'paper') {
        ctx.fillStyle = layer.color;
        ctx.fillRect(-w / 2, -h / 2, w, h);
        if (layer.grain) grain(ctx, -w / 2, -h / 2, w, h, .82);
      }
    }
    ctx.restore();
  }

  function paint(canvas, scene, images, {ratio = 1, selected, showTextBoxes = false, draft, drawSelection = true, showCurve = false} = {}) {
    const [width, height] = dimensions(scene);
    const panelWidth = sizes[scene.aspect][0];
    const rasterWidth = Math.max(1, Math.round(panelWidth * ratio)) * (width / panelWidth);
    const rasterHeight = Math.max(1, Math.round(height * ratio));
    if (canvas.width !== rasterWidth) canvas.width = rasterWidth;
    if (canvas.height !== rasterHeight) canvas.height = rasterHeight;
    const ctx = canvas.getContext('2d');
    ctx.setTransform(rasterWidth / width, 0, 0, rasterHeight / height, 0, 0);
    ctx.fillStyle = scene.bg;
    ctx.fillRect(0, 0, width, height);
    if (!scene.flat) {
      const light = ctx.createLinearGradient(0, 0, width, height);
      light.addColorStop(0, '#fffaf24d');
      light.addColorStop(.55, '#c69d5c00');
      light.addColorStop(1, '#99733b22');
      ctx.fillStyle = light;
      ctx.fillRect(0, 0, width, height);
      grain(ctx, 0, 0, width, height, .8);
    }
    for (const layer of scene.layers) drawLayer(ctx, layer, panelWidth, width, height, images);
    if (!scene.flat) grain(ctx, 0, 0, width, height, .36);
    if (draft) drawLayer(ctx, draft, panelWidth, width, height, images);
    if (showTextBoxes) {
      for (const layer of scene.layers) {
        if (layer.kind !== 'type' || layer.hidden || !layer.opacity || layer === selected) continue;
        const box = placement(layer, panelWidth, height);
        if (!validBox(box)) continue;
        ctx.save();
        ctx.translate(box.x, box.y);
        ctx.rotate(box.angle);
        ctx.setLineDash([5, 5]);
        ctx.strokeStyle = '#76735880';
        ctx.lineWidth = 1.25;
        ctx.strokeRect(-box.w / 2, -box.h / 2, box.w, box.h);
        ctx.restore();
      }
    }
    if (showCurve && selected?.kind==='type' && !selected.hidden) {
      const box=placement(selected,panelWidth,height);
      if (validBox(box)) {
        const {points}=textPathControls(ctx,selected,box.contentW,box.contentH);
        const [start,control,end]=points.map(([x,y])=>[x*box.sx,y*box.sy]);
        ctx.save();
        ctx.translate(box.x,box.y);
        ctx.rotate(box.angle);
        ctx.strokeStyle='#1673bc';
        ctx.lineWidth=1.5;
        ctx.setLineDash([5,4]);
        ctx.beginPath();
        ctx.moveTo(...start);
        ctx.quadraticCurveTo(...control,...end);
        ctx.stroke();
        ctx.strokeStyle='#1673bc80';
        ctx.setLineDash([2,4]);
        ctx.beginPath();
        ctx.moveTo(...start);
        ctx.lineTo(...control);
        ctx.lineTo(...end);
        ctx.stroke();
        ctx.restore();
      }
    }
    if (drawSelection && selected && !selected.hidden) {
      const box = placement(selected, panelWidth, height);
      if (!validBox(box)) return;
      const {x, y, w, h, angle} = box;
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(angle);
      ctx.strokeStyle = '#fffdf3';
      ctx.lineWidth = 4;
      ctx.strokeRect(-w / 2, -h / 2, w, h);
      ctx.strokeStyle = '#bb3319';
      ctx.lineWidth = 2;
      ctx.setLineDash([7, 5]);
      ctx.strokeRect(-w / 2, -h / 2, w, h);
      ctx.restore();
    }
  }

  function hitTest(ctx, scene, x, y, images) {
    const [panelWidth, height] = sizes[scene.aspect];
    return scene.layers.findLast(layer => {
      if (layer.hidden || !layer.opacity) return false;
      const box = placement(layer, panelWidth, height);
      if (!validBox(box)) return false;
      const dx = x - box.x;
      const dy = y - box.y;
      const sin = Math.sin(box.angle);
      const cos = Math.cos(box.angle);
      const localX = (dx * cos + dy * sin) / box.sx;
      const localY = (-dx * sin + dy * cos) / box.sy;
      const path = cutPath(layer.mask, box.contentW, box.contentH, layer.points);
      if (!ctx.isPointInPath(path, localX, localY)) return false;
      if (layer.kind === 'stroke') return BrushArt.hit(layer, box.contentW, box.contentH, localX, localY);
      const asset = images?.get(layer.asset);
      if (!asset?.alpha) return true;
      const [dw, dh] = photoDimensions(asset.image, layer, box.contentW, box.contentH);
      if (!dw || !dh) return false;
      const {width: aw, height: ah, pixels} = asset.alpha;
      const [offsetX, offsetY] = photoOffset(layer, dw, dh, box.contentW, box.contentH);
      const ax = Math.floor(((localX - offsetX) / dw + .5) * aw);
      const ay = Math.floor(((localY - offsetY) / dh + .5) * ah);
      return ax >= 0 && ax < aw && ay >= 0 && ay < ah && pixels[(ay * aw + ax) * 4 + 3] >= 28;
    });
  }

  function cropPanel(canvas, area) {
    const width = canvas.width / 2;
    if ((area !== 'left' && area !== 'right') || !Number.isInteger(width) || width <= 0 || !canvas.height) {
      throw new Error('无法裁切导出选区。');
    }
    const panel = document.createElement('canvas');
    panel.width = width;
    panel.height = canvas.height;
    panel.getContext('2d').drawImage(canvas, area === 'right' ? -width : 0, 0);
    return panel;
  }

  return {sizes, dimensions, placement, paint, hitTest, cropPanel, textPathControls};
})();
