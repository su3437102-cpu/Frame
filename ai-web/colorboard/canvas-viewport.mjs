const MIN_ZOOM = .12;
const MAX_ZOOM = 16;
const radians = Math.PI / 180;
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const normalizeRotation = angle => ((angle + 180) % 360 + 360) % 360 - 180;

function clientPoint(value) {
  if (Number.isFinite(value?.clientX) && Number.isFinite(value?.clientY)) {
    return { x: value.clientX, y: value.clientY };
  }
  return Number.isFinite(value?.x) && Number.isFinite(value?.y) ? { x: value.x, y: value.y } : null;
}

function rotate(x, y, degrees) {
  const cosine = Math.cos(degrees * radians);
  const sine = Math.sin(degrees * radians);
  return { x: x * cosine - y * sine, y: x * sine + y * cosine };
}

function midpoint(a, b) {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

function isControl(event) {
  return Boolean(event.target?.closest?.('input,textarea,select,button,a,[contenteditable]:not([contenteditable="false"])'));
}

function isEditingControl(event) {
  return Boolean(event.target?.closest?.('input,textarea,select,[contenteditable]:not([contenteditable="false"])'));
}

export function installCanvasViewport({ viewport, stage, onChange, keyboardRoot = viewport.ownerDocument }) {
  const document = viewport.ownerDocument;
  const window = document.defaultView;
  const listeners = new AbortController();
  const listenerOptions = { signal: listeners.signal };
  const captureOptions = { ...listenerOptions, capture: true };
  const touches = new Map();
  let imageWidth = 0;
  let imageHeight = 0;
  let viewportWidth = viewport.clientWidth;
  let viewportHeight = viewport.clientHeight;
  let scale = 1;
  let rotation = 0;
  let pan = { x: 0, y: 0 };
  let tool = null;
  let space = false;
  let pointerOverViewport = false;
  let gesture = null;

  Object.assign(stage.style, {
    position: 'absolute',
    left: '50%',
    top: '50%',
    transformOrigin: 'center'
  });

  function availableScale(angle = rotation) {
    if (!imageWidth || !imageHeight) return 1;
    const cosine = Math.abs(Math.cos(angle * radians));
    const sine = Math.abs(Math.sin(angle * radians));
    const padding = viewportWidth > 550 ? 24 : 10;
    return Math.min(
      Math.max(1, viewportWidth - 2 * padding) / (imageWidth * cosine + imageHeight * sine),
      Math.max(1, viewportHeight - 2 * padding) / (imageWidth * sine + imageHeight * cosine)
    );
  }

  function viewportCenter() {
    const bounds = viewport.getBoundingClientRect();
    return {
      x: bounds.left + viewport.clientLeft + viewport.clientWidth / 2,
      y: bounds.top + viewport.clientTop + viewport.clientHeight / 2
    };
  }

  function toImagePoint(eventOrPoint) {
    const point = clientPoint(eventOrPoint);
    if (!point || !imageWidth || !imageHeight) return { x: .5, y: .5 };
    const center = viewportCenter();
    const offset = rotate(point.x - center.x - pan.x, point.y - center.y - pan.y, -rotation);
    return { x: offset.x / (imageWidth * scale) + .5, y: offset.y / (imageHeight * scale) + .5 };
  }

  function toClientPoint(point) {
    const center = viewportCenter();
    const offset = rotate((point.x - .5) * imageWidth * scale, (point.y - .5) * imageHeight * scale, rotation);
    return { x: center.x + pan.x + offset.x, y: center.y + pan.y + offset.y };
  }

  // The photo must stay reachable even when only a rotated corner lies on screen.
  function constrainPan() {
    const screenX = Math.max(0, viewportWidth / 2 - Math.min(38, viewportWidth / 4));
    const screenY = Math.max(0, viewportHeight / 2 - Math.min(38, viewportHeight / 4));
    const photoX = imageWidth * scale / 2;
    const photoY = imageHeight * scale / 2;
    const axis = rotate(1, 0, rotation);
    const cosine = Math.abs(axis.x);
    const sine = Math.abs(axis.y);
    const imagePan = rotate(pan.x, pan.y, -rotation);
    const overflow = Math.max(
      1,
      Math.abs(pan.x) / (screenX + photoX * cosine + photoY * sine),
      Math.abs(pan.y) / (screenY + photoX * sine + photoY * cosine),
      Math.abs(imagePan.x) / (photoX + screenX * cosine + screenY * sine),
      Math.abs(imagePan.y) / (photoY + screenX * sine + screenY * cosine)
    );
    if (overflow > 1) pan = { x: pan.x / overflow, y: pan.y / overflow };
  }

  function getState() {
    return {
      zoom: scale / availableScale(),
      rotation,
      scale,
      panX: pan.x,
      panY: pan.y,
      panMode: tool === 'pan',
      rotateMode: tool === 'rotate',
      panning: gesture?.kind === 'pan' || gesture?.kind === 'pinch',
      gesture: gesture?.kind ?? '',
      spacePan: space
    };
  }

  function render() {
    if (imageWidth && imageHeight) constrainPan();
    stage.style.width = imageWidth * scale + 'px';
    stage.style.height = imageHeight * scale + 'px';
    stage.style.transform = `translate(-50%, -50%) translate(${pan.x}px, ${pan.y}px) rotate(${rotation}deg)`;
    const state = getState();
    viewport.style.touchAction = tool ? 'none' : 'pan-y';
    viewport.dataset.panMode = String(state.panMode);
    viewport.dataset.rotateMode = String(state.rotateMode);
    viewport.dataset.spacePan = String(state.spacePan);
    viewport.dataset.gesture = state.gesture;
    onChange?.(state);
  }

  function transformAround(point, anchor, nextScale, nextRotation) {
    rotation = normalizeRotation(nextRotation);
    const fitScale = availableScale();
    scale = clamp(nextScale, fitScale * MIN_ZOOM, fitScale * MAX_ZOOM);
    const center = viewportCenter();
    const offset = rotate((anchor.x - .5) * imageWidth * scale, (anchor.y - .5) * imageHeight * scale, rotation);
    pan = { x: point.x - center.x - offset.x, y: point.y - center.y - offset.y };
    render();
  }

  function fit() {
    pan = { x: 0, y: 0 };
    scale = availableScale();
    render();
  }

  function zoomBy(factor, about) {
    if (!imageWidth || !imageHeight || !Number.isFinite(factor) || factor <= 0) return;
    const point = clientPoint(about) ?? viewportCenter();
    transformAround(point, toImagePoint(point), scale * factor, rotation);
  }

  function rotateBy(degrees, about) {
    if (!imageWidth || !imageHeight || !Number.isFinite(degrees)) return;
    const point = clientPoint(about) ?? viewportCenter();
    transformAround(point, toImagePoint(point), scale, rotation + degrees);
  }

  function setRotation(degrees) {
    if (Number.isFinite(degrees)) rotateBy(degrees - rotation);
  }

  function setImageSize(width, height, { reset = true } = {}) {
    const previousFit = availableScale();
    imageWidth = Number.isFinite(width) && width > 0 ? width : 0;
    imageHeight = Number.isFinite(height) && height > 0 ? height : 0;
    if (reset) {
      endGesture();
      rotation = 0;
      pan = { x: 0, y: 0 };
      scale = availableScale();
    } else {
      scale *= availableScale() / previousFit;
    }
    render();
  }

  function resize() {
    if (viewportWidth === viewport.clientWidth && viewportHeight === viewport.clientHeight) return;
    const previousFit = availableScale();
    viewportWidth = viewport.clientWidth;
    viewportHeight = viewport.clientHeight;
    const ratio = availableScale() / previousFit;
    scale *= ratio;
    pan = { x: pan.x * ratio, y: pan.y * ratio };
    render();
  }

  function capture(pointerId) {
    if (!viewport.hasPointerCapture(pointerId)) viewport.setPointerCapture(pointerId);
  }

  function release(pointerId) {
    if (viewport.hasPointerCapture(pointerId)) viewport.releasePointerCapture(pointerId);
  }

  function endGesture() {
    if (!gesture) return;
    const ids = gesture.ids ?? [gesture.id];
    gesture = null;
    for (const id of ids) release(id);
  }

  function stopEvent(event) {
    if (event.cancelable) event.preventDefault();
    event.stopPropagation();
  }

  function startPinch(event) {
    const ids = [...touches.keys()].slice(0, 2);
    const [a, b] = ids.map(id => touches.get(id));
    const center = midpoint(a, b);
    gesture = {
      kind: 'pinch',
      ids,
      anchor: toImagePoint(center),
      scale,
      rotation,
      distance: Math.max(1, Math.hypot(b.x - a.x, b.y - a.y)),
      angle: Math.atan2(b.y - a.y, b.x - a.x) / radians
    };
    for (const id of ids) capture(id);
    stopEvent(event);
    render();
  }

  function startSingle(event, kind, point) {
    const center = viewportCenter();
    const x = point.x - center.x;
    const y = point.y - center.y;
    gesture = {
      kind, id: event.pointerId, start: point, pan: { ...pan },
      center, anchor: toImagePoint(center), scale, rotation,
      angle: Math.atan2(y, x) / radians, circular: Math.hypot(x, y) > 35
    };
    capture(event.pointerId);
    stopEvent(event);
    render();
  }

  viewport.addEventListener('pointerdown', event => {
    if (!imageWidth || !imageHeight || isControl(event)) return;
    const point = clientPoint(event);
    const primary = event.button === 0;
    const kind = event.button === 1 || (primary && (space || tool === 'pan')) ? 'pan' :
      primary && (event.altKey || tool === 'rotate') ? 'rotate' : null;
    if (event.pointerType === 'touch') {
      const editing = stage.matches('.comparing, .brushing') || stage.querySelector('#box-selection[data-active="true"]');
      if (kind || !editing) {
        touches.set(event.pointerId, point);
        if (touches.size === 2) {
          startPinch(event);
          return;
        }
      }
    }
    if (!gesture && kind) startSingle(event, kind, point);
  }, captureOptions);

  viewport.addEventListener('pointermove', event => {
    const point = clientPoint(event);
    if (touches.has(event.pointerId)) touches.set(event.pointerId, point);
    if (!gesture) return;
    if (gesture.kind === 'pinch') {
      if (!gesture.ids.includes(event.pointerId)) return;
      const [a, b] = gesture.ids.map(id => touches.get(id));
      if (!a || !b) return;
      const distance = Math.max(1, Math.hypot(b.x - a.x, b.y - a.y));
      const angle = Math.atan2(b.y - a.y, b.x - a.x) / radians;
      transformAround(midpoint(a, b), gesture.anchor, gesture.scale * distance / gesture.distance,
        gesture.rotation + normalizeRotation(angle - gesture.angle));
    } else if (gesture.id === event.pointerId) {
      if (gesture.kind === 'pan') {
        pan = { x: gesture.pan.x + point.x - gesture.start.x, y: gesture.pan.y + point.y - gesture.start.y };
        render();
      } else {
        const angle = Math.atan2(point.y - gesture.center.y, point.x - gesture.center.x) / radians;
        const delta = gesture.circular ? normalizeRotation(angle - gesture.angle) : (point.x - gesture.start.x) * .5;
        transformAround(gesture.center, gesture.anchor, gesture.scale, gesture.rotation + delta);
      }
    } else {
      return;
    }
    stopEvent(event);
  }, captureOptions);

  function endPointer(event) {
    if (event.type === 'lostpointercapture' && event.target !== viewport) return;
    touches.delete(event.pointerId);
    if (gesture?.id === event.pointerId || gesture?.ids?.includes(event.pointerId)) {
      stopEvent(event);
      endGesture();
      render();
    }
  }

  for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) {
    viewport.addEventListener(type, endPointer, captureOptions);
  }

  viewport.addEventListener('wheel', event => {
    if (!imageWidth || !imageHeight || isControl(event)) return;
    const multiplier = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? viewportHeight : 1;
    const delta = clamp((event.deltaY || event.deltaX) * multiplier, -300, 300);
    if (!delta) return;
    event.preventDefault();
    if (event.altKey || event.shiftKey) rotateBy(delta * .13, event);
    else zoomBy(Math.exp(-delta * .0018), event);
  }, { ...listenerOptions, passive: false });

  viewport.addEventListener('pointerenter', () => { pointerOverViewport = true; }, listenerOptions);
  viewport.addEventListener('pointerleave', () => { pointerOverViewport = false; }, listenerOptions);
  keyboardRoot.addEventListener('keydown', event => {
    if (event.code !== 'Space' || !imageWidth || !imageHeight ||
        event.altKey || event.ctrlKey || event.metaKey || isEditingControl(event) ||
        (isControl(event) && !pointerOverViewport) || keyboardRoot.querySelector('dialog[open]')) return;
    event.preventDefault();
    if (!space) {
      space = true;
      render();
    }
  }, listenerOptions);
  keyboardRoot.addEventListener('keyup', event => {
    if (event.code === 'Space' && space) {
      event.preventDefault();
      space = false;
      render();
    }
  }, listenerOptions);
  window.addEventListener('blur', () => {
    pointerOverViewport = false;
    if (!space && !gesture && touches.size === 0) return;
    space = false;
    touches.clear();
    endGesture();
    render();
  }, listenerOptions);

  const observer = new window.ResizeObserver(resize);
  observer.observe(viewport);
  render();
  return {
    fit,
    zoomBy,
    rotateBy,
    setRotation,
    setImageSize,
    resize,
    toImagePoint,
    toClientPoint,
    getState,
    setPanMode(on) {
      if (on || tool === 'pan') tool = on ? 'pan' : null;
      render();
    },
    setRotateMode(on) {
      if (on || tool === 'rotate') tool = on ? 'rotate' : null;
      render();
    },
    isPanning: () => gesture?.kind === 'pan' || gesture?.kind === 'pinch',
    destroy() {
      endGesture();
      observer.disconnect();
      listeners.abort();
    }
  };
}
