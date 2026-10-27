const test = require('node:test');
const assert = require('node:assert/strict');
const { load } = require('./load');

// camera.js and ui.js are loaded too: their pure helpers need no DOM at load time.
const ctx = load(['camera', 'ui']);
const { cellSizeFor, minimapSizeFor, formatClock, clampBots, viewCells } = ctx;

test('cells are the same size on a phone, a tablet and a laptop', () => {
  const sizes = [[390, 844], [820, 1180], [1366, 1024], [1440, 900], [3000, 2000]].map(([w, h]) => cellSizeFor(w, h));
  assert.deepEqual([...new Set(sizes)], [35]);
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

test('the clock is Roman: minutes then seconds, zero is N', () => {
  assert.equal(formatClock(180000), 'III:N');
  assert.equal(formatClock(179000), 'II:LIX');
  assert.equal(formatClock(61000), 'I:I');
  assert.equal(formatClock(60000), 'I:N');
  assert.equal(formatClock(0), 'N:N');
  assert.equal(formatClock(-5), 'N:N');
});

test('Rival snakes setting stays between 1 and 10', () => {
  assert.equal(clampBots(0), 1);
  assert.equal(clampBots(11), 10);
  assert.equal(clampBots(5), 5);
  assert.equal(clampBots(NaN), 3, 'bad data falls back to the default');
});
