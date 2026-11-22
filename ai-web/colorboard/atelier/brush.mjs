import { Collage } from './artwork.mjs';
export const BrushArt = (() => {
  'use strict';

  const brushes = new Set(['ink', 'pencil', 'marker']);
  const markerAngle = -.31;
  const markerFlatness = .60;
  const markerCos = Math.cos(markerAngle);
  const markerSin = Math.sin(markerAngle);
  const cachedGeometry = new WeakMap();
  let nextId = 0;

  function pressureFor(sample, previous) {
    if (sample.pointerType === 'mouse') return .5;
    if (Number.isFinite(sample.pressure) && sample.pressure > 0) {
      return Math.min(1, Math.max(.05, sample.pressure));
    }
    return previous ?? .5;
  }

  function centerline(samples, size) {
    const raw = [];
    const minimumStep = Math.max(.32, Math.min(2.8, size * .09));
    for (const [index, sample] of samples.entries()) {
      if (!sample || !Number.isFinite(sample.x) || !Number.isFinite(sample.y)) continue;
      const previous = raw[raw.length - 1];
      const pressure = pressureFor(sample, previous?.pressure);
      const point = {
        x: sample.x,
        y: sample.y,
        pressure: previous ? .28 * previous.pressure + .72 * pressure : pressure
      };
      if (previous) {
        const span = Math.hypot(point.x - previous.x, point.y - previous.y);
        if (span < .08 || (span < minimumStep && index + 1 < samples.length &&
          Math.abs(point.pressure - previous.pressure) < .065)) continue;
      }
      raw.push(point);
    }
    if (raw.length < 3) return raw;

    const midpoint = (a, b) => ({
      x: (a.x + b.x) / 2,
      y: (a.y + b.y) / 2,
      pressure: (a.pressure + b.pressure) / 2
    });
    let start = midpoint(raw[0], raw[1]);
    const curve = [raw[0], start];
    for (let i = 1; i + 1 < raw.length; i++) {
      const control = raw[i];
      const end = midpoint(control, raw[i + 1]);
      const bend = Math.hypot(control.x - (start.x + end.x) * .5, control.y - (start.y + end.y) * .5);
      const steps = Math.max(1, Math.ceil(Math.sqrt(bend / .45)));
      for (let step = 1; step <= steps; step++) {
        const t = step / steps;
        const a = (1 - t) ** 2;
        const b = 2 * t * (1 - t);
        const c = t ** 2;
        curve.push({
          x: a * start.x + b * control.x + c * end.x,
          y: a * start.y + b * control.y + c * end.y,
          pressure: a * start.pressure + b * control.pressure + c * end.pressure
        });
      }
      start = end;
    }
    curve.push(raw[raw.length - 1]);
    return curve;
  }

  function create(samples, canvasWidth, canvasHeight, options = {}) {
    const scale = Math.min(canvasWidth / 1200, canvasHeight / 800);
    if (!Number.isFinite(scale) || scale <= 0 || !samples?.length) return null;
    const size = Number.isFinite(options.size) && options.size > 0 ? options.size : 12;
    const curve = centerline(samples, size);
    if (!curve.length) return null;
    const brushStyle = brushes.has(options.style) ? options.style : 'ink';
    const padding = Math.max(8, size * .69 + 2);
    let left = curve[0].x;
    let right = left;
    let top = curve[0].y;
    let bottom = top;
    for (const point of curve) {
      left = Math.min(left, point.x);
      right = Math.max(right, point.x);
      top = Math.min(top, point.y);
      bottom = Math.max(bottom, point.y);
    }
    const x = (left + right) / 2;
    const y = (top + bottom) / 2;
    const width = right - left + padding * 2;
    const height = bottom - top + padding * 2;
    const seed = Math.imul(Math.round(curve[0].x * 64), 73856093)
      ^ Math.imul(Math.round(curve[0].y * 64), 19349663)
      ^ Math.imul(Math.round(size * 64), 83492791);
    return {
      kind: 'stroke',
      id: options.id ?? ('stroke-' + ++nextId),
      name: '笔刷笔迹',
      x: x * 1200 / canvasWidth,
      y: y * 800 / canvasHeight,
      w: width / scale,
      h: height / scale,
      scale: 100,
      rotation: 0,
      opacity: Number.isFinite(options.opacity) ? Math.max(0, Math.min(100, options.opacity)) : 100,
      mask: 'rect',
      blend: 'source-over',
      hidden: false,
      color: options.color || '#262018',
      brushStyle,
      brushSize: size / scale,
      seed,
      points: curve.map(point => ({
        x: (point.x - x) / width,
        y: (point.y - y) / height,
        pressure: point.pressure
      }))
    };
  }

  function pressureScale(value) {
    return value <= .5 ? .34 + 1.32 * value : 1 + .56 * (value - .5);
  }

  function nibSpace(x, y) {
    return [x * markerCos + y * markerSin, (y * markerCos - x * markerSin) / markerFlatness];
  }

  function taperLandmarks(points, start, end) {
    const result = [points[0]];
    const marks = [start, end];
    for (let i = 1; i < points.length; i++) {
      const a = points[i - 1];
      const b = points[i];
      for (const distance of marks) {
        if (distance <= a.distance || distance >= b.distance) continue;
        const t = (distance - a.distance) / (b.distance - a.distance);
        result.push({
          x: a.x + (b.x - a.x) * t,
          y: a.y + (b.y - a.y) * t,
          distance,
          radius: a.radius + (b.radius - a.radius) * t
        });
      }
      result.push(b);
    }
    return result;
  }

  function strokeGeometry(layer) {
    const cached = cachedGeometry.get(layer);
    if (cached && cached.source === layer.points && cached.w === layer.w && cached.h === layer.h &&
      cached.style === layer.brushStyle && cached.size === layer.brushSize && cached.seed === layer.seed) return cached;
    let distance = 0;
    let points = layer.points.map((point, index) => {
      const x = point.x * layer.w;
      const y = point.y * layer.h;
      if (index) {
        const previous = layer.points[index - 1];
        distance += Math.hypot(x - previous.x * layer.w, y - previous.y * layer.h);
      }
      return {x, y, distance, radius: layer.brushSize * .5 * pressureScale(point.pressure)};
    });
    if (layer.brushStyle === 'ink' && distance > layer.brushSize * 1.4) {
      const taper = Math.min(layer.brushSize * 1.5, distance * .19);
      points = taperLandmarks(points, taper, distance - taper);
      for (const point of points) {
        const entrance = Math.min(1, Math.min(point.distance, distance - point.distance) / taper);
        point.radius *= (.74 + .26 * entrance) * (1 + .019 * Math.sin(point.distance / Math.max(2, layer.brushSize)));
      }
    }
    if (layer.brushStyle === 'marker') {
      for (const point of points) [point.x, point.y] = nibSpace(point.x, point.y);
    }
    const geometry = {points, distance, source: layer.points, w: layer.w, h: layer.h,
      style: layer.brushStyle, size: layer.brushSize, seed: layer.seed};
    cachedGeometry.set(layer, geometry);
    return geometry;
  }

  function disc(ctx, x, y, radius) {
    ctx.moveTo(x + radius, y);
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.closePath();
  }

  function outline(points, multiplier) {
    const path = new Path2D();
    let previous;
    for (const point of points) {
      const radius = point.radius * multiplier;
      if (previous) {
        const dx = point.x - previous.x;
        const dy = point.y - previous.y;
        const distance = Math.hypot(dx, dy);
        if (distance > .0001) {
          const nx = -dy / distance;
          const ny = dx / distance;
          const start = previous.radius * multiplier;
          path.moveTo(previous.x + nx * start, previous.y + ny * start);
          path.lineTo(previous.x - nx * start, previous.y - ny * start);
          path.lineTo(point.x - nx * radius, point.y - ny * radius);
          path.lineTo(point.x + nx * radius, point.y + ny * radius);
          path.closePath();
        }
      }
      disc(path, point.x, point.y, radius);
      previous = point;
    }
    return path;
  }

  function random(seed) {
    let state = (seed >>> 0) || 381941782;
    return () => {
      state ^= state << 13;
      state ^= state >>> 17;
      state ^= state << 5;
      return (state >>> 0) / 4294967296;
    };
  }

  function scatter(ctx, x, y, radius, rng) {
    for (let i = 0; i < 4; i++) {
      const angle = rng() * Math.PI * 2;
      const spread = radius * (.27 + .64 * rng());
      const grain = Math.min(1.3 + radius * .033, radius * (.033 + rng() * .125));
      disc(ctx, x + Math.cos(angle) * spread, y + Math.sin(angle) * spread, grain);
    }
  }

  function graphite(points, distance, size, seed) {
    const rng = random(seed);
    const step = Math.max(.82, Math.min(4.2, size * .19), distance / 1400);
    const path = new Path2D();
    scatter(path, points[0].x, points[0].y, points[0].radius, rng);
    let next = step;
    for (let i = 1; i < points.length; i++) {
      const a = points[i - 1];
      const b = points[i];
      const length = b.distance - a.distance;
      if (length <= 0) continue;
      while (next <= b.distance) {
        const t = (next - a.distance) / length;
        scatter(path, a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t,
          a.radius + (b.radius - a.radius) * t, rng);
        next += step;
      }
    }
    if (points.length === 1) {
      const count = Math.min(72, Math.max(13, Math.ceil(points[0].radius ** 2 / 18)));
      for (let i = 0; i < count; i++) scatter(path, points[0].x, points[0].y, points[0].radius, rng);
    }
    return path;
  }

  function draw(ctx, layer, w, h) {
    if (!layer.points?.length || w <= 0 || h <= 0 || layer.w <= 0 || layer.h <= 0) return;
    const geometry = strokeGeometry(layer);
    const {points, distance} = geometry;
    ctx.save();
    ctx.scale(w / layer.w, h / layer.h);
    ctx.fillStyle = layer.color;
    const opacity = ctx.globalAlpha;
    if (layer.brushStyle === 'pencil') {
      ctx.globalAlpha = opacity * .57;
      geometry.outline ??= outline(points, .61);
      ctx.fill(geometry.outline);
      ctx.globalAlpha = opacity * .48;
      geometry.grain ??= graphite(points, distance, layer.brushSize, layer.seed);
      ctx.fill(geometry.grain);
    } else {
      if (layer.brushStyle === 'marker') {
        ctx.rotate(markerAngle);
        ctx.scale(1, markerFlatness);
        ctx.globalAlpha = opacity * .52;
      }
      geometry.outline ??= outline(points, 1);
      ctx.fill(geometry.outline);
    }
    ctx.restore();
  }

  function hit(layer, w, h, x, y) {
    if (!layer.points?.length || w <= 0 || h <= 0 || layer.w <= 0 || layer.h <= 0) return false;
    const {points} = strokeGeometry(layer);
    const sx = w / layer.w;
    const sy = h / layer.h;
    let px = x / sx;
    let py = y / sy;
    if (layer.brushStyle === 'marker') [px, py] = nibSpace(px, py);
    const tolerance = 3.5 / Math.min(sx, sy);
    let previous;
    for (const point of points) {
      if (Math.hypot(px - point.x, py - point.y) <= point.radius + tolerance) return true;
      if (previous) {
        const dx = point.x - previous.x;
        const dy = point.y - previous.y;
        const projection = ((px - previous.x) * dx + (py - previous.y) * dy) / (dx * dx + dy * dy);
        if (projection > 0 && projection < 1) {
          const radius = previous.radius + (point.radius - previous.radius) * projection + tolerance;
          const distance = Math.hypot(px - (previous.x + dx * projection), py - (previous.y + dy * projection));
          if (distance <= radius) return true;
        }
      }
      previous = point;
    }
    return false;
  }

  return Object.freeze({create, draw, hit});
})();
