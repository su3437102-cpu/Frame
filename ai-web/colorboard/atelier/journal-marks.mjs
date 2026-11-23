export const JournalMarks = (() => {
  'use strict';

  const edge = [
    {id: 'tape', name: '半透撕边胶带'},
    {id: 'crop-left', name: '左裁切角标'},
    {id: 'crop-right', name: '右裁切角标'},
    {id: 'seam', name: '虚线缝迹'},
    {id: 'slash-seam', name: '斜线缝迹'},
    {id: 'thread', name: '穿越棉线'}
  ];

  const fill = [
    {id: 'code', name: '字码碎片'},
    {id: 'contours', name: '等高线'},
    {id: 'grid', name: '方格图线'},
    {id: 'halftone', name: '半调网点'},
    {id: 'coordinates', name: '坐标刻度'}
  ];

  function random(seed) {
    let state = (Number(seed) >>> 0) || 9132851;
    return () => {
      state ^= state << 13;
      state ^= state >>> 17;
      state ^= state << 5;
      return (state >>> 0) / 4294967296;
    };
  }

  function path(ctx, points, closed = false) {
    ctx.beginPath();
    ctx.moveTo(points[0][0], points[0][1]);
    for (const [x, y] of points.slice(1)) ctx.lineTo(x, y);
    if (closed) ctx.closePath();
  }

  function line(ctx, points) {
    path(ctx, points);
    ctx.stroke();
  }

  function dot(ctx, x, y, radius) {
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();
  }

  function alpha(ctx, value, paint) {
    ctx.save();
    ctx.globalAlpha *= value;
    paint();
    ctx.restore();
  }

  function isCrop(pattern) {
    return pattern === 'crop-left' || pattern === 'crop-right';
  }

  function canExtend(layer) {
    return layer?.kind === 'mark' && layer.markGroup === 'edge' &&
      ['tape','seam','slash-seam'].includes(layer.pattern);
  }

  function tornEnd(width, thickness, rng, fromRight) {
    // Use the thickness as the scale for the torn fibers, with room for both ends on short pieces.
    const depth = Math.min(thickness * .30, width * .22);
    const heights = [.09, .15, .21, .28, .33, .38, .44, .51, .57, .62, .69, .74, .81, .87, .92];
    const profile = fromRight
      ? [.53, .22, .46, .86, .47, .54, .13, .024, .28, .71, .41, .57, .24, .69, .35]
      : [.41, .78, .61, .30, .57, .83, .38, .17, .31, .55, .21, .62, .50, .88, .65];
    return heights.map((height, index) => {
      const scatter = (rng() - .5) * .22;
      const offset = depth * Math.max(.025, profile[index] + scatter * (index === 7 ? .15 : 1));
      const y = thickness * (height + (rng() - .5) * .022);
      return [fromRight ? width - offset : offset, y];
    });
  }

  function tapeSide(start, end, thickness, rng) {
    const steps = Math.max(2, Math.min(18, Math.ceil((end[0] - start[0]) / (2.1 * thickness))));
    return Array.from({length: steps - 1}, (_, index) => {
      const t = (index + 1) / steps;
      return [
        start[0] + (end[0] - start[0]) * t,
        start[1] + (end[1] - start[1]) * t + thickness * (rng() - .5) * .018
      ];
    });
  }

  function tape(ctx, w, h, rng) {
    const left = tornEnd(w, h, rng, false);
    const right = tornEnd(w, h, rng, true);
    const top = tapeSide(left[0], right[0], h, rng);
    const bottom = tapeSide(left[left.length - 1], right[right.length - 1], h, rng);
    path(ctx, [left[0], ...top, ...right, ...bottom.reverse(), ...left.slice(1).reverse()], true);
    ctx.save();
    ctx.clip();
    alpha(ctx, .55, () => ctx.fillRect(0, 0, w, h));

    const light = ctx.createLinearGradient(0, h * .075, 0, h * .93);
    light.addColorStop(0, '#fff3d54a');
    light.addColorStop(.15, '#fff6df1a');
    light.addColorStop(.35, '#fff6df00');
    light.addColorStop(.72, '#a0795106');
    light.addColorStop(1, '#79583e2b');
    ctx.fillStyle = light;
    ctx.fillRect(0, 0, w, h);

    ctx.lineCap = 'round';
    alpha(ctx, .23, () => {
      ctx.strokeStyle = '#fff5d8';
      ctx.lineWidth = Math.max(.55, h * .019);
      line(ctx, [[0, h * .187], [w * .38, h * .191], [w * .66, h * .173], [w, h * .184]]);
      line(ctx, [[0, h * .79], [w * .24, h * .811], [w * .59, h * .788], [w, h * .80]]);
    });
    alpha(ctx, .13, () => {
      ctx.strokeStyle = '#594630';
      ctx.lineWidth = Math.max(.45, h * .013);
      line(ctx, [[0, h * .875], [w * .32, h * .865], [w * .73, h * .875], [w, h * .859]]);
    });

    const fibers = Math.max(18, Math.min(210, Math.round(w / h * 12)));
    alpha(ctx, .20, () => {
      ctx.lineWidth = Math.max(.35, Math.min(.95, h * .013));
      for (let i = 0; i < fibers; i++) {
        const x = w * rng();
        const y = h * (.12 + .76 * rng());
        const length = h * (.06 + .40 * rng());
        ctx.strokeStyle = i % 4 === 0 ? '#8e6a4f' : '#fff5d8';
        line(ctx, [[x, y], [x + length, y + h * (rng() - .5) * .031]]);
      }
    });
    alpha(ctx, .29, () => {
      ctx.strokeStyle = '#fff6e3';
      ctx.lineWidth = Math.max(.44, h * .014);
      line(ctx, left);
      line(ctx, right);
    });
    ctx.restore();
  }

  function pencil(ctx, w, h, rng) {
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    for (let pass = 0; pass < 3; pass++) {
      const points = Array.from({length: 11}, (_, i) => [
        w * (.035 + i * (.089 - .003 * pass)),
        h * (.68 - i * .036 + (rng() - .5) * .18 + pass * .065)
      ]);
      const pressure = [.84, .32, .54][pass];
      alpha(ctx, pressure, () => {
        ctx.lineWidth = Math.min(w * .014, Math.max(.7, h * (.077 - pass * .014)));
        line(ctx, points);
      });
    }
    alpha(ctx, .68, () => {
      ctx.lineWidth = Math.min(w * .012, Math.max(.6, h * .066));
      line(ctx, [[w * .79, h * .50], [w * .91, h * .36], [w * .956, h * .40]]);
    });
  }

  function crop(ctx, w, h, rng) {
    const arm = Math.min(w, h);
    ctx.lineWidth = Math.max(.65, arm * .019);
    const offset = .065 + rng() * .032;
    const corners = [
      [w * offset, h * .21, 1, 1],
      [w * .91, h * .81, -1, -1]
    ];
    for (const [x, y, dx, dy] of corners) {
      line(ctx, [[x, y + dy * arm * .30], [x, y], [x + dx * arm * .30, y]]);
      alpha(ctx, .53, () => {
        const ix = x + dx * arm * .075;
        const iy = y + dy * arm * .075;
        line(ctx, [[ix, iy + dy * arm * .17], [ix, iy], [ix + dx * arm * .14, iy]]);
      });
    }
    alpha(ctx, .72, () => {
      const x = w * .73;
      const y = h * .27;
      const distance = arm * .043;
      line(ctx, [[x - distance, y], [x + distance, y]]);
      line(ctx, [[x, y - distance], [x, y + distance]]);
    });
  }

  function cropSide(ctx, w, h, direction) {
    const size = Math.min(w,h);
    const x = w/2, y = h/2;
    const arm = direction*size*.36;
    ctx.lineWidth = Math.max(.65,size*.019);
    line(ctx, [[x,y+arm],[x,y],[x+arm,y]]);
    alpha(ctx,.53,()=>{
      const inset = direction*size*.085;
      const short = arm*.50;
      line(ctx, [[x+inset,y+inset+short],[x+inset,y+inset],[x+inset+short,y+inset]]);
    });
  }

  function slashSeam(ctx, w, h, rng) {
    const pitch = Math.max(7,h*.65);
    const inset = Math.min(w*.12,pitch*.55);
    const phase = rng()*Math.PI;
    ctx.lineWidth = Math.max(.65,h*.055);
    ctx.lineCap = 'round';
    const step = Math.max(pitch,w/1500);
    for (let x = inset; x <= w-inset; x += step) {
      const y = h*(.50 + .13*Math.sin(x/(pitch*2.7)+phase) + (rng()-.5)*.15);
      const rise = h*(.12 + rng()*.075);
      const run = Math.min(w*.09,rise*(.31+rng()*.42));
      alpha(ctx,.62+rng()*.31,()=>line(ctx,[[x-run,y+rise],[x+run,y-rise]]));
    }
  }

  function seam(ctx, w, h, rng) {
    const unit = Math.max(5, h * .42);
    const start = Math.min(unit * .35, w * .08);
    const end = w - start;
    const phase = rng() * Math.PI;
    const wave = x => h * (.50 + .17 * Math.sin(x / (unit * 2.7) + phase)
      + .08 * Math.sin(x / (unit * .92) - phase));
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineWidth = Math.max(.65, h * .049);
    ctx.setLineDash([unit * .69, unit * .29]);
    ctx.beginPath();
    ctx.moveTo(start, wave(start));
    const step = Math.max(unit * .45, (end - start) / 1200);
    for (let x = start; x < end;) {
      const next = Math.min(x + step,end);
      const middle = (x + next) / 2;
      ctx.quadraticCurveTo(middle, 2*wave(middle)-(wave(x)+wave(next))/2, next, wave(next));
      x = next;
    }
    ctx.stroke();
  }

  function corner(ctx, w, h, rng) {
    const nick = .11 + rng() * .06;
    path(ctx, [
      [w * .05, h * .25], [w * .26, h * nick], [w * .49, h * .17], [w * .70, h * .10],
      [w * .95, h * .14], [w * .91, h * .47], [w * .74, h * .60], [w * .63, h * .53],
      [w * .40, h * .84], [w * .24, h * .92], [w * .21, h * .56], [w * .14, h * .50]
    ], true);
    alpha(ctx, .75, () => ctx.fill());
    ctx.save();
    ctx.clip();
    alpha(ctx, .37, () => {
      ctx.fillStyle = '#fff8e4';
      path(ctx, [[w * .05, h * .09], [w * .95, h * .14], [w * .59, h * .44], [w * .23, h * .57]], true);
      ctx.fill();
    });
    alpha(ctx, .47, () => {
      ctx.strokeStyle = '#5b4a35';
      ctx.lineWidth = Math.min(w, h) * .029;
      line(ctx, [[w * .22, h * .57], [w * .58, h * .445], [w * .92, h * .158]]);
    });
    alpha(ctx, .27, () => {
      ctx.fillStyle = '#fff7de';
      for (let i = 0; i < 20; i++) {
        dot(ctx, w * rng(), h * rng(), Math.min(w, h) * (.004 + .013 * rng()));
      }
    });
    ctx.restore();
  }

  function thread(ctx, w, h, rng) {
    const rise = .26 + rng() * .15;
    ctx.lineWidth = Math.max(.65, Math.min(h * .046, w * .016));
    ctx.lineCap = 'round';
    function strand(offset) {
      ctx.beginPath();
      ctx.moveTo(w * .035, h * (.72 + offset));
      ctx.bezierCurveTo(w * .19, h * rise, w * .45, h * .78, w * .59, h * (.52 + offset));
      ctx.bezierCurveTo(w * .75, h * .16, w * .68, h * .09, w * .60, h * (.37 + offset));
      ctx.bezierCurveTo(w * .46, h * .91, w * .86, h * .77, w * .967, h * (.28 + offset));
      ctx.stroke();
    }
    alpha(ctx, .88, () => strand(0));
    alpha(ctx, .42, () => {
      ctx.strokeStyle = '#fff7df';
      ctx.lineWidth *= .53;
      strand(.033);
    });
  }

  function code(ctx, w, h, rng, bounds) {
    const size=5.6;
    const columns=Math.floor(w/3.4);
    const rows=Math.floor(h/6.4);
    const seed=Math.floor(rng()*0xffffffff);
    const glyphs='.:;{}[]/01+_-*|<>%#';
    const prefixes=['let','fn','const','if','//','for','ret','log'];
    const [left,top,right,bottom]=bounds;
    ctx.font=size+'px monospace';
    ctx.textBaseline='middle';
    alpha(ctx,.77,()=>{
      const last=Math.min(rows,Math.ceil(bottom/6.4));
      const first=Math.max(0,Math.floor(top/6.4));
      for (let row=first,i=0;row<last&&i<360;row++,i++) {
        const rand=random(seed^Math.imul(row+1,0x9e3779b1));
        const indent=Math.floor(rand()*5);
        const count=Math.round(columns*(.51+rand()*.44));
        const prefix=prefixes[Math.floor(rand()*prefixes.length)];
        const firstCol=Math.max(indent,Math.floor(left/3.4)-1);
        const endCol=Math.min(count,Math.ceil(right/3.4)+1,firstCol+610);
        let fragment='';
        for (let col=firstCol,i=0;col<endCol&&i<610;col++,i++) {
          const position=col-indent;
          const variable=Math.imul((col+1)^seed^Math.imul(row+1,15731),48271)>>>0;
          fragment+=position<prefix.length?prefix[position]:variable%7<2?' ':glyphs[variable%glyphs.length];
        }
        if (fragment) ctx.fillText(fragment,firstCol*3.4,(row+.56)*6.4);
      }
    });
  }

  function traceContour(sink, x, y, step, corners, level) {
    const [a,b,c,d] = corners;
    const highA = a > level, highB = b > level, highC = c > level, highD = d > level;
    if (highA === highB && highB === highC && highC === highD) return;
    const crossings = [];
    if (highA !== highB) crossings.push([x+step*(level-a)/(b-a),y]);
    if (highB !== highC) crossings.push([x+step,y+step*(level-b)/(c-b)]);
    if (highC !== highD) crossings.push([x+step*(level-d)/(c-d),y+step]);
    if (highD !== highA) crossings.push([x,y+step*(level-a)/(d-a)]);
    const segment = (start,end) => {
      sink.moveTo(...crossings[start]);
      sink.lineTo(...crossings[end]);
    };
    if (crossings.length === 2) {
      segment(0,1);
    } else {
      // At an ambiguous cell, connect the regions separated by the interpolated saddle.
      const split = (a-level)*(c-level) > (b-level)*(d-level);
      segment(0,split ? 1 : 3);
      segment(2,split ? 3 : 1);
    }
  }

  function contours(ctx, w, h, rng, bounds) {
    const phase = rng()*Math.PI*2;
    const [left,top,right,bottom] = bounds;
    const step = 7;
    const start = Math.floor(left/step)*step, end = Math.ceil(right/step)*step;
    const first = Math.floor(top/step)*step, last = Math.ceil(bottom/step)*step;
    const levels = [-.83,-.65,-.47,-.30,-.14,.14,.30,.47,.65,.83];
    const bands = new Path2D(), valleys = new Path2D();
    const sample = (x,y) => {
      const ridge = Math.sin((x-43+17*Math.sin(y/42+phase)+9*Math.sin((x+y)/55))/36);
      const fold = Math.sin((y-24+18*Math.sin(x/68+phase*.65)+9*Math.sin((x-y)/39))/28);
      return [ridge*fold*(.84+.16*Math.sin(x/100-y/85+phase)),ridge,fold];
    };
    const row = y => Array.from({length: (end-start)/step+1}, (_,i) => sample(start+i*step,y));
    let above = row(first);
    for (let y = first; y < last; y += step) {
      const below = row(y+step);
      for (let i = 0; i < above.length-1; i++) {
        const x = start+i*step;
        const corners = [above[i],above[i+1],below[i+1],below[i]];
        const heights = corners.map(point=>point[0]);
        const min = Math.min(...heights), max = Math.max(...heights);
        for (const level of levels) {
          if (level > min && level <= max) traceContour(bands,x,y,step,heights,level);
        }
        // Both factors are zero at a saddle, so the zero contour can genuinely cross.
        traceContour(valleys,x,y,step,corners.map(point=>point[1]),0);
        traceContour(valleys,x,y,step,corners.map(point=>point[2]),0);
      }
      above = below;
    }
    ctx.lineWidth = .76;
    alpha(ctx,.59,()=>ctx.stroke(bands));
    ctx.lineWidth = .96;
    alpha(ctx,.75,()=>ctx.stroke(valleys));
  }

  function notes(ctx, w, h, rng) {
    const size = Math.min(w, h);
    const rows = Math.max(3, Math.min(8, Math.floor(h / 15)));
    ctx.lineWidth = Math.max(.5, Math.min(1.45, size * .014));
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    for (let row = 0; row < rows; row++) {
      const y = h * (.15 + row * .65 / rows);
      const offset = rng() * .12;
      const cols = 2 + Math.floor(rng() * 4);
      alpha(ctx, .32 + rng() * .26, () => {
        for (let col = 0; col < cols; col++) {
          const x = w * (.105 + offset + col * .69 / cols);
          const run = w * (.03 + .12 * rng());
          const swing = Math.min(h * .075, 6);
          line(ctx, [[x, y], [x + run * .22, y - swing], [x + run * .39, y + swing * .25],
            [x + run * .60, y - swing * .44], [x + run, y + (rng() - .5) * swing]]);
        }
      });
    }
    alpha(ctx, .58, () => {
      ctx.beginPath();
      ctx.ellipse(w * .66, h * .68, w * .19, h * .14, -Math.PI / 15, .09, 6.14);
      ctx.stroke();
      line(ctx, [[w * .12, h * .89], [w * .30, h * .86], [w * .42, h * .87]]);
    });
  }

  function grid(ctx, w, h, rng, bounds) {
    const pitch = 16;
    const [left,top,right,bottom] = bounds;
    ctx.lineWidth = .72;
    alpha(ctx,.29,()=>{
      ctx.beginPath();
      for (let x = Math.floor(left/pitch)*pitch; x < right; x+=pitch) {
        ctx.moveTo(x,top);
        ctx.lineTo(x,bottom);
      }
      for (let y = Math.floor(top/pitch)*pitch; y < bottom; y+=pitch) {
        ctx.moveTo(left,y);
        ctx.lineTo(right,y);
      }
      ctx.stroke();
    });

    const bandHeight = pitch*4, period = 7;
    const first = Math.max(0,Math.floor(left/pitch)-1);
    const last = Math.ceil(right/pitch)+1;
    const steps = Array.from({length:period},(_,i)=>Math.sin(i/period*2*Math.PI)*pitch*.94+(rng()-.5)*pitch*.55);
    ctx.lineWidth = 1.08;
    alpha(ctx,.55,()=>{
      const start = Math.max(0,Math.floor(top/bandHeight)*bandHeight);
      for (let y = start; y < bottom; y+=bandHeight) {
        const points = Array.from({length:last-first+1},(_,i)=>{
          const column = first+i;
          return [column*pitch,y+bandHeight/2+steps[column%period]];
        });
        line(ctx,points);
        for (const [x,py] of points) dot(ctx,x,py,1.45);
      }
    });
  }

  function halftone(ctx, w, h, rng, bounds) {
    const spacing=8;
    const seed=Math.floor(rng()*0xffffffff);
    const offset=rng()*.14;
    const [left,top,right,bottom]=bounds;
    const firstRow=Math.max(0,Math.floor(top/spacing)-1);
    const lastRow=Math.min(Math.ceil(h/spacing),Math.ceil(bottom/spacing)+1);
    const firstColumn=Math.max(0,Math.floor(left/spacing)-1);
    const lastColumn=Math.min(Math.ceil(w/spacing),Math.ceil(right/spacing)+1);
    alpha(ctx,.67,()=>{
      for (let row=firstRow,i=0;row<lastRow&&i<320;row++,i++) {
        const y=spacing*(row+.5);
        if (y>=h) continue;
        for (let column=firstColumn,j=0;column<lastColumn&&j<320;column++,j++) {
          const x=spacing*(column+(row%2?.73:.32));
          if (x>=w) continue;
          const weight=Math.max(.08,.79-x/w*.55-y/h*.41+offset);
          const variation=(Math.imul(seed^Math.imul(row+1,12149)^Math.imul(column+1,50177),48271)>>>0)/4294967296;
          dot(ctx,x,y,spacing*(.075+weight*.26)*(.78+.22*variation));
        }
      }
    });
  }

  function stamps(ctx, w, h, rng) {
    const units = w > h * 1.8 ? 2 : 1;
    const cellWidth = w / units;
    const span = Math.min(cellWidth * .77, h * 1.15);
    const height = Math.min(h * .74, span * .61);
    ctx.lineWidth = Math.max(.55, Math.min(1.35, span * .013));
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'center';
    for (let i = 0; i < units; i++) {
      const x = cellWidth * (i + .5);
      const y = h * (.50 + (rng() - .5) * .07);
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate((rng() - .5) * .22);
      alpha(ctx, .64, () => {
        ctx.strokeRect(-span / 2, -height / 2, span, height);
        ctx.strokeRect(-span * .46, -height * .39, span * .92, height * .78);
      });
      alpha(ctx, .57, () => {
        ctx.font = Math.min(11, height * .31) + 'px ui-monospace, monospace';
        const code = String(i + 1 + Math.floor(rng() * 25)).padStart(2, '0');
        ctx.fillText('ARCH. ' + code, 0, -height * .10, span * .76);
        for (let mark = 0; mark < 5; mark++) {
          const x1 = span * (-.20 + mark * .10);
          line(ctx, [[x1 - span * .021, height * .18], [x1 + span * .025, height * .18]]);
        }
      });
      ctx.restore();
    }
  }

  function coordinates(ctx, w, h, rng, bounds) {
    const pitch=10, rowHeight=26, inset=12;
    const [left,top,right,bottom]=bounds;
    const ticks=Math.max(0,1+Math.floor((w-2*inset)/pitch));
    if (!ticks) return;
    const first=Math.max(0,Math.floor((left-inset)/pitch)-3);
    const last=Math.min(ticks,Math.ceil((right-inset)/pitch)+3,first+780);
    const firstRow=Math.max(0,Math.floor(top/rowHeight)-1);
    const lastRow=Math.min(Math.floor(h/rowHeight),Math.ceil(bottom/rowHeight)+1,firstRow+360);
    ctx.lineWidth=.85;
    ctx.font='8px ui-monospace, monospace';
    ctx.textAlign='center';
    for (let row=firstRow; row<lastRow; row++) {
      const y=row*rowHeight+14;
      alpha(ctx,.45,()=>line(ctx,[[inset,y],[Math.max(inset,w-inset),y]]));
      alpha(ctx,.80,()=>{
        for (let tick=first; tick<last; tick++) {
          const number=row*ticks+tick;
          const x=inset+tick*pitch;
          const major=number%5===0;
          line(ctx,[[x,y],[x,y+(major ? 8 : 4)]]);
          if (major) ctx.fillText(String(number),x,y-3);
        }
      });
    }
  }

  const edgePaint = {
    tape, pencil, crop, seam, corner, thread, 'slash-seam':slashSeam,
    'crop-left':(ctx,w,h)=>cropSide(ctx,w,h,1),
    'crop-right':(ctx,w,h)=>cropSide(ctx,w,h,-1)
  };
  const fillPaint = {code, contours, notes, grid, halftone, stamps, coordinates};

  function draw(ctx, layer, w, h, bounds = [0,0,w,h]) {
    const patterns = layer.markGroup === 'edge' ? edgePaint : fillPaint;
    if (!Object.hasOwn(patterns, layer.pattern) || w < 1 || h < 1 || bounds[0]>=bounds[2] || bounds[1]>=bounds[3] ||
        !Number.isSafeInteger(Math.ceil(Math.max(bounds[2],bounds[3])))) return;
    ctx.save();
    ctx.translate(-w / 2, -h / 2);
    ctx.beginPath();
    ctx.rect(0, 0, w, h);
    ctx.clip();
    ctx.strokeStyle = layer.color || '#3f3a32';
    ctx.fillStyle = ctx.strokeStyle;
    patterns[layer.pattern](ctx, w, h, random(layer.seed), bounds);
    ctx.restore();
  }

  return Object.freeze({edge, fill, draw, canExtend, isCrop});
})();
