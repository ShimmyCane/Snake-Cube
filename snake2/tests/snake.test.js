const test = require('node:test');
const assert = require('node:assert/strict');
const { load, plain } = require('./load');

const ctx = load();
const { newSnake2, setValue, bodyLenFor, advanceSnake, turnToward, romanLength, CFG2 } = ctx;

const make = (value = 1) => {
  const s = newSnake2({ id: 'x', name: 'x', colour: '#000', x: 10, y: 10, angle: 0 });
  if (value !== 1) { setValue(s, value); s.bodyLen = s.targetLen; }
  return s;
};

test('a new snake is I: a head and no body', () => {
  const s = make();
  assert.equal(s.value, 1);
  assert.equal(s.bodyLen, 0);
  assert.equal(s.symPts.length, 1);
});

test('the body length a numeral needs: one symbol per step after the head', () => {
  assert.equal(bodyLenFor(1), 0);
  assert.equal(bodyLenFor(2), CFG2.SYMBOL_STEP);
  assert.equal(bodyLenFor(4), 0, 'IV is one symbol: one head, no body');
  assert.equal(bodyLenFor(3), 2 * CFG2.SYMBOL_STEP);
});

test('growing: a longer numeral lengthens the body over the next steps', () => {
  const s = make();
  assert.equal(setValue(s, 2), null, 'no collapse on growth');
  assert.equal(s.bodyLen, 0, 'the body grows over time, not at once');
  for (let i = 0; i < 4; i++) advanceSnake(s);
  assert.equal(s.bodyLen, bodyLenFor(2));
});

test('collapse: III eats I and becomes IV, so the body drops at once', () => {
  const s = make(3);
  const c = plain(setValue(s, 4));
  assert.deepEqual(c, { from: 3, to: 4, dropped: 2 });
  assert.equal(s.bodyLen, 0);
  assert.equal(s.targetLen, 0);
});

test('the body settles to the numeral: bodyLen reaches the target and stays there', () => {
  const s = make();
  setValue(s, 21);
  for (let i = 0; i < 30; i++) advanceSnake(s);
  assert.equal(s.bodyLen, bodyLenFor(21));
  assert.equal(s.targetLen, romanLength(21) - 1 === 0 ? 0 : (romanLength(21) - 1) * CFG2.SYMBOL_STEP);
});

test('a head faces its target at once, with no easing', () => {
  const s = make();
  s.target = 1.0;
  turnToward(s);
  assert.equal(s.angle, 1.0);
  s.target = -2.5;
  turnToward(s);
  assert.equal(s.angle, -2.5);
});

test('a step moves the head SPEED along its heading and keeps the trail trimmed', () => {
  const s = make();
  advanceSnake(s);
  assert.ok(Math.abs(s.x - (10 + CFG2.SPEED)) < 1e-9);
  assert.ok(Math.abs(s.y - 10) < 1e-9);
  setValue(s, 3);
  s.bodyLen = s.targetLen;
  for (let i = 0; i < 50; i++) advanceSnake(s);
  let arc = 0;
  for (let i = 0; i + 1 < s.trail.length; i++) {
    arc += Math.hypot(s.trail[i + 1].x - s.trail[i].x, s.trail[i + 1].y - s.trail[i].y);
  }
  assert.ok(arc <= s.bodyLen + 3, 'the trail does not grow without limit');
});
