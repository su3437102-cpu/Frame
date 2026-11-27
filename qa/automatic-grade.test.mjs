import assert from 'node:assert/strict';
import test from 'node:test';
import { planAutomaticGrade } from '../ai-web/colorboard/automatic-grade.mjs';
import { renderGrade } from '../ai-web/colorboard/grade-engine.mjs';
import { packLut, unpackLut } from '../ai-web/colorboard/framelab-project.mjs';

function ramp(low, high, { alpha = 255, colored = false } = {}) {
  const width = 256, height = 48;
  const data = new Uint8ClampedArray(width * height * 4);
  for (let pixel = 0; pixel < width * height; pixel++) {
    const value = low + (high - low) * (pixel % width) / (width - 1);
    const color = colored ? (pixel % 2 ? [1, .87, .79] : [.8, .94, 1]) : [1, 1, 1];
    data.set([...color.map(channel => value * channel), alpha], pixel * 4);
  }
  return { width, height, data };
}

test('histogram auto extends subdued highlights and keeps the color ordering and alpha', () => {
  const image = ramp(12, 222, { colored: true });
  const { lut, before, after } = planAutomaticGrade(image);
  assert.ok(before.p99 < .88);
  assert.ok(after.p99 >= .87);
  const serialized = unpackLut(packLut(lut));
  const rendered = renderGrade(image, undefined, { baseLut: serialized });
  let changed = 0;
  for (let i = 0; i < image.data.length; i += 4) {
    const red = image.data[i], blue = image.data[i + 2];
    const nextRed = rendered.data[i], nextBlue = rendered.data[i + 2];
    assert.ok((red - blue) * (nextRed - nextBlue) >= 0);
    assert.equal(rendered.data[i + 3], image.data[i + 3]);
    for (let channel = i; channel < i + 3; channel++) {
      assert.ok(rendered.data[channel] > 1 || image.data[channel] <= 1);
      assert.ok(rendered.data[channel] < 254 || image.data[channel] >= 254);
    }
    if (nextRed !== red) changed++;
  }
  assert.ok(changed > image.width * image.height / 5);
});

test('histogram auto corrects dark, bright and narrow distributions', () => {
  const dark = planAutomaticGrade(ramp(12, 115));
  assert.ok(dark.before.p50 < .26 && dark.after.p50 >= .34);
  const bright = planAutomaticGrade(ramp(175, 250));
  assert.ok(bright.before.p50 > .8 && bright.after.p50 <= .66);
  const flat = planAutomaticGrade(ramp(90, 150));
  assert.ok(flat.before.span < .25 && flat.after.span > .65);
  assert.ok(flat.after.p01 <= .13 && flat.after.p99 >= .87);
});

test('balanced images and images without readable detail return distinct reasons', () => {
  assert.deepEqual(planAutomaticGrade(ramp(12, 241)), { lut: null, reason: 'in-range' });
  assert.deepEqual(planAutomaticGrade(ramp(0, 255)), { lut: null, reason: 'in-range' });
  assert.deepEqual(planAutomaticGrade(ramp(0, 0)), { lut: null, reason: 'insufficient' });
  assert.deepEqual(planAutomaticGrade(ramp(12, 222, { alpha: 160 })), { lut: null, reason: 'insufficient' });
});
