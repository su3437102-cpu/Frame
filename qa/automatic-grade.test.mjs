import assert from 'node:assert/strict';
import test from 'node:test';
import { planAutomaticGrade } from '../ai-web/colorboard/automatic-grade.mjs';
import { renderGrade } from '../ai-web/colorboard/grade-engine.mjs';
import { packLut, unpackLut } from '../ai-web/colorboard/framelab-project.mjs';

function ramp(low, high, alpha = 255) {
  const width = 256, height = 48;
  const data = new Uint8ClampedArray(width * height * 4);
  for (let pixel = 0; pixel < width * height; pixel++) {
    const value = low + (high - low) * (pixel % width) / (width - 1);
    const color = pixel % 2 ? [1, .87, .79] : [.8, .94, 1];
    data.set([...color.map(channel => value * channel), alpha], pixel * 4);
  }
  return { width, height, data };
}

test('natural auto lifts a shadow candidate and keeps the color ordering and alpha', () => {
  const image = ramp(12, 222);
  const { lut, label } = planAutomaticGrade(image);
  assert.equal(label, '轻提暗部');
  const serialized = unpackLut(packLut(lut));
  const rendered = renderGrade(image, undefined, { baseLut: serialized, baseLutStrength: 70 });
  assert.ok(rendered.data[32] > image.data[32]);
  let changed = 0;
  for (let i = 0; i < image.data.length; i += 4) {
    const red = image.data[i], blue = image.data[i + 2];
    const nextRed = rendered.data[i], nextBlue = rendered.data[i + 2];
    assert.ok((red - blue) * (nextRed - nextBlue) >= 0);
    assert.equal(rendered.data[i + 3], image.data[i + 3]);
    if (nextRed !== red) changed++;
  }
  assert.ok(changed > image.width * image.height / 5);
});

test('natural auto leaves low-key, high-key, balanced and transparent input alone', () => {
  for (const image of [ramp(12, 112), ramp(205, 253), ramp(30, 230), ramp(12, 222, 160)]) {
    assert.equal(planAutomaticGrade(image).lut, null);
  }
});
