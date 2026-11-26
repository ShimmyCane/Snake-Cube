const test = require('node:test');
const assert = require('node:assert/strict');
const { load } = require('./load');

// camera.js and ui.js are loaded too: their pure helpers need no DOM at load time.
const ctx = load(['camera', 'ui']);
const { cellSizeFor, minimapSizeFor, clampBots, clampZoom, viewCells } = ctx;

test('cells are the same size on a phone, a tablet and a laptop, at a given zoom', () => {
  const sizes = [[390, 844], [820, 1180], [1366, 1024], [1440, 900], [3000, 2000]].map(([w, h]) => cellSizeFor(w, h, 1.5));
  assert.deepEqual([...new Set(sizes)], [52.5]);
});

test('zoom 150% draws the board one and a half times bigger than 100%', () => {
  assert.equal(cellSizeFor(390, 844, 1), 35);
  assert.equal(cellSizeFor(390, 844, 1.5), 52.5);
});

test('the zoom setting is clamped and falls back to the default', () => {
  assert.equal(clampZoom(0.1), 0.75);
  assert.equal(clampZoom(9), 2.5);
  assert.equal(clampZoom(NaN), 1.5);
  assert.equal(clampZoom(1.2), 1.2);
});

test('a bigger screen shows more map, in whole proportion to its size', () => {
  const phone = viewCells(390, 844, 35);
  const laptop = viewCells(1440, 900, 35);
  assert.ok(laptop.w > phone.w * 3);
  assert.ok(Math.abs(phone.w - 11.14) < 0.1, 'about 11 cells across on an iPhone');
});

test('the minimap grows with the screen, between 110 and 260 px', () => {
  assert.equal(minimapSizeFor(390, 844), 110);
  assert.ok(minimapSizeFor(820, 1180) > 200);
  assert.equal(minimapSizeFor(3000, 2000), 260);
});

test('Rival snakes setting stays between 1 and 10', () => {
  assert.equal(clampBots(0), 1);
  assert.equal(clampBots(11), 10);
  assert.equal(clampBots(5), 5);
  assert.equal(clampBots(NaN), 3, 'bad data falls back to the default');
});
