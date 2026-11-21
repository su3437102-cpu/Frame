const curveColors = {
  rgb: '#7656d1',
  red: '#ce526b',
  green: '#35976d',
  blue: '#4e78c6',
};
const identityCurve = [[0, 0], [1, 1]];
const minimumPointGap = 0.008;
const clamp = (value, min = 0, max = 1) => Math.max(min, Math.min(max, value));

function plotBounds(canvas) {
  const inset = 16;
  return {
    left: inset,
    top: inset,
    width: canvas.width - inset * 2,
    height: canvas.height - inset * 2,
  };
}

function drawPlotGrid(context, bounds) {
  const { left, top, width, height } = bounds;
  context.strokeStyle = '#eae4ed';
  context.lineWidth = 1;
  context.beginPath();
  for (let division = 1; division < 4; division++) {
    const x = left + width * division / 4;
    const y = top + height * division / 4;
    context.moveTo(x, top);
    context.lineTo(x, top + height);
    context.moveTo(left, y);
    context.lineTo(left + width, y);
  }
  context.stroke();
  context.strokeStyle = '#e1dbe7';
  context.strokeRect(left, top, width, height);
}

function curveAsObject(curve) {
  if (Array.isArray(curve)) return { rgb: curve };
  return curve ?? {};
}

export function installCurveEditor({ canvas, channels, reset, getCurve, setCurve }) {
  const context = canvas.getContext('2d');
  const buttons = [...channels.querySelectorAll('button[data-channel]')];
  let currentChannel = 'rgb';
  let selectedPoint = null;
  let drag;

  function pointsForChannel() {
    return curveAsObject(getCurve())[currentChannel] ?? identityCurve;
  }

  function screenPoint(point, bounds) {
    return {
      x: bounds.left + bounds.width * point[0],
      y: bounds.top + bounds.height * (1 - point[1]),
    };
  }

  function draw() {
    const bounds = plotBounds(canvas);
    const points = pointsForChannel();
    const color = curveColors[currentChannel];
    context.clearRect(0, 0, canvas.width, canvas.height);
    drawPlotGrid(context, bounds);

    context.save();
    context.strokeStyle = '#cdc4d6';
    context.lineWidth = 1.5;
    context.setLineDash([5, 5]);
    context.beginPath();
    context.moveTo(bounds.left, bounds.top + bounds.height);
    context.lineTo(bounds.left + bounds.width, bounds.top);
    context.stroke();
    context.restore();

    context.strokeStyle = color;
    context.lineWidth = 3;
    context.lineJoin = 'round';
    context.beginPath();
    points.forEach((point, index) => {
      const { x, y } = screenPoint(point, bounds);
      if (index === 0) context.moveTo(x, y);
      else context.lineTo(x, y);
    });
    context.stroke();

    points.forEach((point, index) => {
      const { x, y } = screenPoint(point, bounds);
      const active = index === selectedPoint;
      context.fillStyle = active ? color : '#fff';
      context.lineWidth = 2;
      context.beginPath();
      context.arc(x, y, active ? 6.5 : 5.5, 0, Math.PI * 2);
      context.fill();
      context.stroke();
    });
  }

  function setChannel(channel) {
    currentChannel = channel;
    selectedPoint = null;
    buttons.forEach(button => {
      const active = button.dataset.channel === channel;
      button.classList.toggle('active', active);
      button.setAttribute('aria-pressed', String(active));
    });
    draw();
  }

  function toCurvePoint(event) {
    const rect = canvas.getBoundingClientRect();
    const bounds = plotBounds(canvas);
    const x = (event.clientX - rect.left) * canvas.width / rect.width;
    const y = (event.clientY - rect.top) * canvas.height / rect.height;
    return [
      clamp((x - bounds.left) / bounds.width),
      clamp(1 - (y - bounds.top) / bounds.height),
    ];
  }

  function hitPoint(point) {
    const rect = canvas.getBoundingClientRect();
    const bounds = plotBounds(canvas);
    const plotWidth = rect.width * bounds.width / canvas.width;
    const plotHeight = rect.height * bounds.height / canvas.height;
    let nearest = -1;
    let minimumDistance = 10;
    pointsForChannel().forEach(([x, y], index) => {
      const distance = Math.hypot((point[0] - x) * plotWidth, (point[1] - y) * plotHeight);
      if (distance < minimumDistance) {
        nearest = index;
        minimumDistance = distance;
      }
    });
    return nearest;
  }

  function updatePoints(points, phase) {
    setCurve({ ...curveAsObject(getCurve()), [currentChannel]: points }, { phase });
    draw();
  }

  function movePoint(index, position, phase) {
    const points = pointsForChannel().map(point => [...point]);
    if (index === 0 || index === points.length - 1) {
      position[0] = points[index][0];
    } else {
      position[0] = clamp(position[0], points[index - 1][0] + minimumPointGap, points[index + 1][0] - minimumPointGap);
    }
    const [x, y] = points[index];
    if (x === position[0] && y === position[1]) return false;
    points[index] = position;
    updatePoints(points, phase);
    return true;
  }

  function removePoint(index) {
    const points = pointsForChannel();
    if (index <= 0 || index >= points.length - 1) return;
    selectedPoint = null;
    updatePoints(points.filter((_, pointIndex) => pointIndex !== index), 'commit');
  }

  buttons.forEach(button => button.addEventListener('click', () => {
    if (Object.hasOwn(curveColors, button.dataset.channel)) setChannel(button.dataset.channel);
  }));
  reset.addEventListener('click', () => {
    selectedPoint = null;
    setCurve(null, { phase: 'commit' });
    draw();
  });

  canvas.tabIndex = 0;
  canvas.title = '点击添加曲线点，拖动调整，双击删除中间点';
  canvas.addEventListener('pointerdown', event => {
    if (event.button !== 0 || drag) return;
    const point = toCurvePoint(event);
    const existing = hitPoint(point);
    const points = [...pointsForChannel()];
    const insertion = points.findIndex(([x]) => x > point[0]);
    if (existing === -1) {
      if (insertion <= 0 || points.length >= 24) return;
      const previousX = points[insertion - 1][0];
      const nextX = points[insertion][0];
      if (nextX - previousX < minimumPointGap * 2) return;
      point[0] = clamp(point[0], previousX + minimumPointGap, nextX - minimumPointGap);
      points.splice(insertion, 0, point);
    }
    selectedPoint = existing === -1 ? insertion : existing;
    drag = { pointerId: event.pointerId, previous: getCurve(), changed: existing === -1 };
    canvas.setPointerCapture(event.pointerId);
    if (existing === -1) updatePoints(points, 'preview');
    else draw();
  });
  canvas.addEventListener('pointermove', event => {
    if (drag?.pointerId !== event.pointerId) return;
    drag.changed = movePoint(selectedPoint, toCurvePoint(event), 'preview') || drag.changed;
  });
  canvas.addEventListener('pointerup', event => {
    if (drag?.pointerId !== event.pointerId) return;
    const { changed } = drag;
    drag = undefined;
    if (changed) setCurve(getCurve(), { phase: 'commit' });
  });
  canvas.addEventListener('lostpointercapture', event => {
    if (drag?.pointerId !== event.pointerId) return;
    const { previous, changed } = drag;
    drag = undefined;
    if (changed) setCurve(previous, { phase: 'cancel' });
    draw();
  });
  canvas.addEventListener('dblclick', event => removePoint(hitPoint(toCurvePoint(event))));
  canvas.addEventListener('keydown', event => {
    const points = pointsForChannel();
    if (event.key === 'Delete' || event.key === 'Backspace') {
      event.preventDefault();
      if (selectedPoint !== null) removePoint(selectedPoint);
      return;
    }
    const step = event.shiftKey ? 0.04 : 0.01;
    const changes = {
      ArrowLeft: [-step, 0], ArrowRight: [step, 0],
      ArrowUp: [0, step], ArrowDown: [0, -step],
    };
    const change = changes[event.key];
    if (!change) return;
    event.preventDefault();
    if (selectedPoint === null || selectedPoint >= points.length) selectedPoint = 0;
    const [x, y] = points[selectedPoint];
    movePoint(selectedPoint, [clamp(x + change[0]), clamp(y + change[1])], 'commit');
  });

  setChannel(currentChannel);
  return { draw };
}

const histogramColors = [
  { line: '#c7798c', fill: '#dc819335' },
  { line: '#71a588', fill: '#7bbc9938' },
  { line: '#8a85c7', fill: '#9a8bdf47' },
];
const bins = 128;

function rgbHistograms(image) {
  const histogram = Array.from({ length: 3 }, () => new Float32Array(bins));
  const stride = Math.max(1, Math.floor(Math.sqrt(image.width * image.height / 40000)));
  const pixels = image.data;
  for (let y = 0; y < image.height; y += stride) {
    for (let x = (y / stride) % stride; x < image.width; x += stride) {
      const index = (y * image.width + x) * 4;
      const weight = pixels[index + 3] / 255;
      histogram[0][pixels[index] >> 1] += weight;
      histogram[1][pixels[index + 1] >> 1] += weight;
      histogram[2][pixels[index + 2] >> 1] += weight;
    }
  }
  return histogram.map(channel => channel.map((value, index) =>
    (value * 2 + channel[Math.max(0, index - 1)] + channel[Math.min(bins - 1, index + 1)]) / 4,
  ));
}

export function drawHistogram(canvas, imageData) {
  const context = canvas.getContext('2d');
  const { width, height } = canvas;
  const base = height - 2;
  context.clearRect(0, 0, width, height);
  context.strokeStyle = '#e9e3ee';
  context.lineWidth = 1;
  context.beginPath();
  for (let division = 1; division < 4; division++) {
    const x = width * division / 4;
    context.moveTo(x, 3);
    context.lineTo(x, base);
  }
  context.stroke();
  if (!imageData?.data.length) return;

  const histogram = rgbHistograms(imageData);
  const heights = histogram.flatMap(channel => [...channel]).sort((a, b) => a - b);
  const maximum = heights.at(-1);
  if (!maximum) return;
  const scale = Math.max(1, heights[Math.floor(heights.length * 0.98)], maximum / 3);
  histogram.forEach((channel, index) => {
    const { line, fill } = histogramColors[index];
    context.strokeStyle = line;
    context.fillStyle = fill;
    context.lineWidth = 1.45;
    context.beginPath();
    channel.forEach((value, bin) => {
      const x = bin * width / (bins - 1);
      const y = base - clamp(Math.sqrt(value / scale)) * (height - 9);
      if (bin === 0) context.moveTo(x, y);
      else context.lineTo(x, y);
    });
    context.stroke();
    context.lineTo(width, base);
    context.lineTo(0, base);
    context.closePath();
    context.fill();
  });
}
