const clamp = (value, min = 0, max = 1) => Math.min(max, Math.max(min, value));
const minimumDragPixels = 12;
const minimumBoxFraction = 0.015;
const handles = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'];
const keyboardSteps = {
  ArrowLeft: [-0.02, 0], ArrowRight: [0.02, 0],
  ArrowUp: [0, -0.02], ArrowDown: [0, 0.02],
};

function rectangle(start, end) {
  return {
    x: Math.min(start.x, end.x),
    y: Math.min(start.y, end.y),
    width: Math.abs(start.x - end.x),
    height: Math.abs(start.y - end.y),
  };
}

function normalize(box) {
  if (!box || ![box.x, box.y, box.width, box.height].every(Number.isFinite)) return null;
  const normalized = rectangle(
    { x: clamp(box.x), y: clamp(box.y) },
    { x: clamp(box.x + box.width), y: clamp(box.y + box.height) },
  );
  return normalized.width && normalized.height ? normalized : null;
}

function contains(box, point) {
  return box && point.x >= box.x && point.x <= box.x + box.width
    && point.y >= box.y && point.y <= box.y + box.height;
}

function move(box, dx, dy) {
  return {
    ...box,
    x: clamp(box.x + dx, 0, Math.max(0, 1 - box.width)),
    y: clamp(box.y + dy, 0, Math.max(0, 1 - box.height)),
  };
}

function resize(box, handle, dx, dy, minimum) {
  let { x, y } = box;
  let right = x + box.width;
  let bottom = y + box.height;
  const width = Math.min(box.width, minimum.width);
  const height = Math.min(box.height, minimum.height);
  if (handle.includes('w')) x = clamp(x + dx, 0, right - width);
  if (handle.includes('e')) right = clamp(right + dx, x + width, 1);
  if (handle.includes('n')) y = clamp(y + dy, 0, bottom - height);
  if (handle.includes('s')) bottom = clamp(bottom + dy, y + height, 1);
  return { x, y, width: right - x, height: bottom - y };
}

function createHandle(document, key) {
  const hit = document.createElement('span');
  const corner = key.length === 2;
  hit.className = 'box-selection-handle';
  hit.dataset.handle = key;
  if (corner) hit.dataset.corner = key;
  Object.assign(hit.style, {
    position: 'absolute',
    top: key.includes('n') ? '0' : key.includes('s') ? '100%' : '50%',
    left: key.includes('w') ? '0' : key.includes('e') ? '100%' : '50%',
    transform: 'translate(-50%, -50%)',
    width: '24px', height: '24px', zIndex: corner ? '2' : '1',
    display: 'grid', placeItems: 'center', cursor: key + '-resize',
  });
  const mark = document.createElement('i');
  mark.className = 'box-selection-handle-mark';
  Object.assign(mark.style, {
    display: 'block', pointerEvents: 'none', border: '1px solid #251c3a',
    backgroundColor: 'currentColor', borderRadius: '2px',
    width: corner || 'ns'.includes(key) ? '10px' : '6px',
    height: corner || 'we'.includes(key) ? '10px' : '6px',
    boxShadow: '0 0 1px #181526',
  });
  hit.append(mark);
  return hit;
}

export function installBoxSelection({
  surface, onSelect, onCancel, onDraft, showGuide = true, clientToPoint,
}) {
  const document = surface.ownerDocument;
  const frame = document.createElement('div');
  frame.className = 'box-selection-frame';
  frame.setAttribute('aria-hidden', 'true');
  Object.assign(frame.style, { position: 'absolute', boxSizing: 'border-box' });
  const grip = handles.map(key => createHandle(document, key));
  frame.append(...grip);

  const guide = document.createElement('span');
  guide.className = 'box-selection-guide';
  guide.setAttribute('aria-hidden', 'true');
  Object.assign(guide.style, {
    position: 'absolute', top: '7px', left: '50%', transform: 'translateX(-50%)',
    maxWidth: 'calc(100% - 10px)', overflow: 'hidden', textOverflow: 'ellipsis',
    whiteSpace: 'nowrap', color: 'white', backgroundColor: '#211931e8', padding: '4px 7px',
    fontSize: '11px', borderRadius: '5px', pointerEvents: 'none',
  });
  Object.assign(surface.style, {
    position: 'absolute', inset: '0', zIndex: '3', overflow: 'hidden',
    touchAction: 'none', userSelect: 'none', cursor: 'crosshair',
  });
  surface.setAttribute('role', 'group');
  surface.setAttribute('aria-label', '框选主体。拖动选框可移动，拉动控制点可缩放。也可用方向键移动，Shift 加方向键缩放，回车确认，Esc 取消。');
  surface.append(frame, guide);

  let enabled = false;
  let box = null;
  let draft = null;
  let pointer = null;
  let focusBefore = null;

  function minimumBox() {
    return {
      width: Math.max(minimumBoxFraction, minimumDragPixels / Math.max(1, surface.clientWidth)),
      height: Math.max(minimumBoxFraction, minimumDragPixels / Math.max(1, surface.clientHeight)),
    };
  }

  function validSize(candidate) {
    return candidate && candidate.width >= minimumBoxFraction && candidate.height >= minimumBoxFraction;
  }

  function validDraw(candidate) {
    const minimum = minimumBox();
    return candidate.width >= minimum.width && candidate.height >= minimum.height;
  }

  function update() {
    const visibleBox = draft ?? box;
    surface.hidden = !enabled && !visibleBox;
    surface.dataset.active = String(enabled);
    surface.dataset.editing = String(Boolean(pointer));
    surface.style.pointerEvents = enabled ? 'auto' : 'none';
    surface.style.cursor = pointer?.kind === 'move' ? 'grabbing' : 'crosshair';
    surface.tabIndex = enabled ? 0 : -1;
    if (enabled) surface.removeAttribute('aria-hidden');
    else surface.setAttribute('aria-hidden', 'true');
    guide.hidden = !enabled || !showGuide;
    guide.textContent = box ? '拖动移动或缩放 · 回车确认' : '拖动框选主体';
    frame.hidden = !visibleBox;
    if (!visibleBox) return;
    Object.assign(frame.style, {
      left: visibleBox.x * 100 + '%', top: visibleBox.y * 100 + '%',
      width: visibleBox.width * 100 + '%', height: visibleBox.height * 100 + '%',
      color: enabled ? '#e0d3ff' : '#fff',
      border: enabled ? '2px solid currentColor' : '1px solid #ffffffe0',
      boxShadow: enabled ? '0 0 0 1px #251c3aaa, 0 0 0 200vmax #16131e65' : '0 0 0 1px #251c3a99',
      pointerEvents: enabled && !pointer ? 'auto' : 'none',
      cursor: pointer?.kind === 'move' ? 'grabbing' : 'move',
    });
    for (const handle of grip) {
      const corner = handle.dataset.handle.length === 2;
      handle.hidden = !enabled && !corner;
      handle.style.display = handle.hidden ? 'none' : 'grid';
      handle.style.pointerEvents = enabled && !pointer ? 'auto' : 'none';
    }
  }

  function notifyDraft() {
    const visibleBox = enabled && (draft ?? box);
    const valid = pointer?.kind === 'draw' ? visibleBox && validDraw(visibleBox) : validSize(visibleBox);
    onDraft?.(valid ? { ...visibleBox } : null);
  }

  function refresh() {
    update();
    notifyDraft();
  }

  function point(event) {
    if (clientToPoint) return clientToPoint(event);
    const bounds = surface.getBoundingClientRect();
    return {
      x: (event.clientX - bounds.left) / Math.max(1, bounds.width),
      y: (event.clientY - bounds.top) / Math.max(1, bounds.height),
    };
  }

  function stopPointer() {
    const id = pointer?.id;
    pointer = null;
    if (id !== undefined && surface.hasPointerCapture(id)) surface.releasePointerCapture(id);
  }

  function discardDraft() {
    stopPointer();
    draft = null;
    refresh();
  }

  function confirm() {
    if (!enabled || pointer || !validSize(box)) return false;
    onSelect?.({ ...box });
    return true;
  }

  surface.addEventListener('pointerdown', event => {
    if (!enabled || pointer || event.button !== 0 || !event.isPrimary) return;
    event.preventDefault();
    event.stopPropagation();
    surface.focus({ preventScroll: true });
    const position = point(event);
    const handle = event.target.closest('[data-handle]')?.dataset.handle;
    const kind = handle && box ? 'resize' : contains(box, position) ? 'move' : 'draw';
    const start = kind === 'draw' ? { x: clamp(position.x), y: clamp(position.y) } : position;
    pointer = { id: event.pointerId, kind, handle, start, box };
    draft = kind === 'draw' ? rectangle(start, start) : { ...box };
    surface.setPointerCapture(event.pointerId);
    refresh();
  });

  function movedBox(event) {
    const position = point(event);
    const { start, box: initial, handle, kind } = pointer;
    if (kind === 'draw') {
      return rectangle(start, { x: clamp(position.x), y: clamp(position.y) });
    }
    const dx = position.x - start.x;
    const dy = position.y - start.y;
    return kind === 'move' ? move(initial, dx, dy) : resize(initial, handle, dx, dy, minimumBox());
  }

  surface.addEventListener('pointermove', event => {
    if (pointer?.id !== event.pointerId) return;
    event.stopPropagation();
    draft = movedBox(event);
    refresh();
  });
  surface.addEventListener('pointerup', event => {
    if (pointer?.id !== event.pointerId) return;
    event.stopPropagation();
    const next = movedBox(event);
    if (pointer.kind !== 'draw' || validDraw(next)) box = next;
    discardDraft();
  });
  for (const type of ['pointercancel', 'lostpointercapture']) {
    surface.addEventListener(type, event => {
      if (pointer?.id !== event.pointerId) return;
      event.stopPropagation();
      discardDraft();
    });
  }

  function disable() {
    if (!enabled) return;
    if (document.activeElement === surface) {
      if (focusBefore?.isConnected && focusBefore !== surface && !focusBefore.disabled) {
        focusBefore.focus({ preventScroll: true });
      }
      if (document.activeElement === surface) surface.blur();
    }
    enabled = false;
    discardDraft();
    focusBefore = null;
  }

  document.addEventListener('keydown', event => {
    if (event.key !== 'Escape' || !enabled || event.defaultPrevented || document.querySelector('dialog[open]')) return;
    event.preventDefault();
    disable();
    onCancel?.();
  });

  surface.addEventListener('keydown', event => {
    if (!enabled || pointer || event.ctrlKey || event.metaKey || event.altKey) return;
    const delta = keyboardSteps[event.key];
    if (event.key !== 'Enter' && !delta) return;
    event.preventDefault();
    event.stopPropagation();
    if (event.key === 'Enter') {
      confirm();
      return;
    }
    const initial = box ?? { x: 0.25, y: 0.25, width: 0.5, height: 0.5 };
    const [dx, dy] = delta;
    box = event.shiftKey ? resize(initial, 'se', dx, dy, minimumBox()) : move(initial, dx, dy);
    refresh();
  });

  update();
  return {
    enable(initialBox) {
      if (!enabled) focusBefore = document.activeElement;
      enabled = true;
      if (initialBox !== undefined) box = normalize(initialBox);
      discardDraft();
      surface.focus({ preventScroll: true });
    },
    disable,
    clear() {
      box = null;
      discardDraft();
    },
    setBox(next) {
      box = normalize(next);
      discardDraft();
    },
    confirm,
  };
}
