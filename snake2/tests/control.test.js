const test = require('node:test');
const assert = require('node:assert/strict');
const { load } = require('./load');

const ctx = load();
const { directionFromOffset } = ctx;

// The corner stick and taps relative to the middle both use this: the bigger axis wins.
test('a push or a tap turns toward its bigger axis', () => {
  assert.equal(directionFromOffset(0, -10).name, 'up');
  assert.equal(directionFromOffset(0, 10).name, 'down');
  assert.equal(directionFromOffset(-10, 0).name, 'left');
  assert.equal(directionFromOffset(10, 0).name, 'right');
  assert.equal(directionFromOffset(30, -20).name, 'right', 'horizontal wins when it is longer');
  assert.equal(directionFromOffset(-5, -9).name, 'up', 'vertical wins when it is longer');
});

test('no offset means no direction, so a tap on the middle does nothing', () => {
  assert.equal(directionFromOffset(0, 0), null);
});
