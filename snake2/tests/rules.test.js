const test = require('node:test');
const assert = require('node:assert/strict');
const { load } = require('./load');

const ctx = load();
const { newSnake2, setValue, resolveTick, CFG2 } = ctx;

// A snake at (x, y) whose body is the given trail (head first), with bodyLen covering all of it.
function snakeWith(x, y, trail, bodyLen) {
  const s = newSnake2({ id: 'a', name: 'a', colour: '#000', x, y, angle: 0 });
  s.trail = trail.map(p => ({ x: p.x, y: p.y }));
  s.bodyLen = bodyLen;
  return s;
}
const reasonOf = (crashes, s) => (crashes.find(c => c.snake === s) || {}).reason;

// An artifact at (ax, ay) with radius r, as the world reports it to the rules.
const artifactAt = (ax, ay, r = 0.8) => (x, y, margin) => (Math.hypot(x - ax, y - ay) < margin + r ? { x: ax, y: ay, r } : null);

test('there is no border: a head far out in the world is safe', () => {
  const s = snakeWith(-500, 900, [{ x: -500, y: 900 }], 0);
  assert.equal(resolveTick([s]).crashes.length, 0);
});

test('a head that touches an artifact crashes (artifact)', () => {
  const s = snakeWith(10, 10, [{ x: 10, y: 10 }], 0);
  const { crashes } = resolveTick([s], artifactAt(10.9, 10));
  assert.equal(reasonOf(crashes, s), 'artifact');
});

test('a head in open space is safe', () => {
  const s = snakeWith(25, 25, [{ x: 25, y: 25 }], 0);
  assert.equal(resolveTick([s], artifactAt(0, 0)).crashes.length, 0);
});

test('a head that runs into another snake body bumps it and survives; the body is cut at the contact', () => {
  const a = snakeWith(10, 9.3, [{ x: 10, y: 9.3 }], 0);
  const b = snakeWith(12, 10, [{ x: 12, y: 10 }, { x: 11, y: 10 }, { x: 10, y: 10 }, { x: 9, y: 10 }], 3);
  const { crashes, bumps } = resolveTick([a, b]);
  assert.equal(reasonOf(crashes, a), undefined, 'the bumper lives');
  assert.equal(bumps.length, 1);
  assert.equal(bumps[0].victim, b);
  assert.ok(Math.abs(bumps[0].arc - 2) < 0.2, 'contact about two tiles back from the head');
});

test('two heads that touch and are the same size both crash (headon)', () => {
  const a = snakeWith(10, 10, [{ x: 10, y: 10 }], 0);
  const b = snakeWith(10.5, 10, [{ x: 10.5, y: 10 }], 0);
  const { crashes } = resolveTick([a, b]);
  assert.equal(reasonOf(crashes, a), 'headon');
  assert.equal(reasonOf(crashes, b), 'headon');
});

test('a smaller head that touches a bigger head crashes; the bigger one is not hurt', () => {
  const small = snakeWith(10, 10, [{ x: 10, y: 10 }], 0);
  const big = snakeWith(10.5, 10, [{ x: 10.5, y: 10 }], 0);
  big.value = 5;
  const { crashes } = resolveTick([small, big]);
  assert.equal(reasonOf(crashes, small), 'headon');
  assert.equal(reasonOf(crashes, big), undefined);
});

test('a snake in its grace period cannot crash again', () => {
  const s = snakeWith(10, 10, [{ x: 10, y: 10 }], 0);
  s.grace = 3;
  assert.equal(resolveTick([s], artifactAt(10.5, 10)).crashes.length, 0);
});

test('a head looping over its own body is never hurt by it', () => {
  const trail = [{ x: 10, y: 10 }, { x: 11, y: 10 }, { x: 11, y: 11 }, { x: 10, y: 11 }, { x: 9.6, y: 10.4 }];
  const s = snakeWith(10, 10, trail, 4);
  const { crashes, bumps } = resolveTick([s]);
  assert.equal(crashes.length, 0);
  assert.equal(bumps.length, 0);
});

test('the neck is safe: the first tiles of your own body never crash you', () => {
  const s = snakeWith(10, 10, [{ x: 10, y: 10 }, { x: 9, y: 10 }], 1);
  assert.equal(resolveTick([s]).crashes.length, 0);
});

test('a dead snake does not take part in later checks', () => {
  const a = snakeWith(10, 10, [{ x: 10, y: 10 }], 0);
  const b = snakeWith(10.2, 10, [{ x: 10.2, y: 10 }], 0);
  b.alive = false;
  assert.equal(resolveTick([a, b]).crashes.length, 0);
});
