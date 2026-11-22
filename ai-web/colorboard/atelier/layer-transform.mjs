export const LayerTransform = (() => {
  const CIRCLE = Math.PI * 2;
  const DEGREES = 180 / Math.PI;

  function points(box) {
    const cos = Math.cos(box.angle);
    const sin = Math.sin(box.angle);
    const right = box.w / 2;
    const bottom = box.h / 2;
    const project = (x, y) => [box.x + cos * x - sin * y, box.y + sin * x + cos * y];
    return {resize: project(right, bottom), rotate: project(right, -bottom), tape: project(right, 0)};
  }

  function angleAt(point, x, y) {
    const dx = point[0] - x;
    const dy = point[1] - y;
    return Math.abs(dx) + Math.abs(dy) <= Number.EPSILON ? null : Math.atan2(dy, dx);
  }

  function begin({layer, box, handle, point, width, height}) {
    return {
      handle,
      start: [...point],
      x: layer.x,
      y: layer.y,
      w: box.w,
      h: box.h,
      layerWidth: layer.w,
      scaleX: layer.scaleX ?? 1,
      scaleY: layer.scaleY ?? 1,
      rotation: layer.rotation,
      centerX: box.x,
      centerY: box.y,
      cos: Math.cos(box.angle),
      sin: Math.sin(box.angle),
      width,
      height,
      lastAngle: handle === 'rotate' ? angleAt(point, box.x, box.y) : null,
      turned: 0
    };
  }

  function rotationPatch(session, point) {
    const angle = angleAt(point, session.centerX, session.centerY);
    if (angle !== null) {
      if (session.lastAngle !== null) {
        let step = angle - session.lastAngle;
        if (step > Math.PI) step -= CIRCLE;
        if (step < -Math.PI) step += CIRCLE;
        session.turned += step;
      }
      session.lastAngle = angle;
    }
    return {rotation: session.rotation + session.turned * DEGREES};
  }

  function update(session, point, {lock = false} = {}) {
    if (session.handle === 'rotate') return rotationPatch(session, point);

    const dx = point[0] - session.start[0];
    const dy = point[1] - session.start[1];
    const localX = dx * session.cos + dy * session.sin;
    const localY = -dx * session.sin + dy * session.cos;
    const tape = session.handle === 'tape';
    let horizontal = 1 + localX / session.w;
    let vertical = tape ? 1 : 1 + localY / session.h;
    if (lock && !tape) {
      // Project the pointer displacement onto the original resize diagonal.
      const unit = Math.max(session.w, session.h);
      const w = session.w / unit;
      const h = session.h / unit;
      horizontal = vertical = 1 + (localX / unit * w + localY / unit * h) / (w * w + h * h);
    }
    // A handle can reach the opposite side without flipping the layer.
    horizontal = Math.max(Number.EPSILON, horizontal);
    vertical = Math.max(Number.EPSILON, vertical);
    const halfX = (horizontal - 1) * (session.w / 2);
    const halfY = (vertical - 1) * (session.h / 2);
    const center = {
      x: session.x + (session.cos * halfX - session.sin * halfY) * (1200 / session.width),
      y: session.y + (session.sin * halfX + session.cos * halfY) * (800 / session.height)
    };
    return tape ? {...center, w: Math.max(Number.MIN_VALUE, session.layerWidth * horizontal)} : {
      ...center,
      scaleX: Math.max(Number.MIN_VALUE, session.scaleX * horizontal),
      scaleY: Math.max(Number.MIN_VALUE, session.scaleY * vertical)
    };
  }

  return {begin, points, update};
})();
