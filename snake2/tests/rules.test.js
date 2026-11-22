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
const reasonOf = (dead, s) => (dead.find(d => d.snake === s) || {}).reason;

test('a head that reaches the stone border crashes (wall)', () => {
  const s = snakeWith(CFG2.WALL_T + CFG2.HEAD_R - 0.1, 25, [{ x: 1.3, y: 25 }], 0);
  const { dead } = resolveTick([s]);
  assert.equal(reasonOf(dead, s), 'wall');
});

test('a head in open space is safe', () => {
  const s = snakeWith(25, 25, [{ x: 25, y: 25 }], 0);
  assert.equal(resolveTick([s]).dead.length, 0);
});

test('a head that runs into another snake body bumps it and survives; the body is cut at the contact', () => {
  const a = snakeWith(10, 9.3, [{ x: 10, y: 9.3 }], 0);
  const b = snakeWith(12, 10, [{ x: 12, y: 10 }, { x: 11, y: 10 }, { x: 10, y: 10 }, { x: 9, y: 10 }], 3);
  const { dead, bumps } = resolveTick([a, b]);
  assert.equal(reasonOf(dead, a), undefined, 'the bumper lives');
  assert.equal(bumps.length, 1);
  assert.equal(bumps[0].victim, b);
  assert.ok(Math.abs(bumps[0].arc - 2) < 0.2, 'contact about two tiles back from the head');
});

test('two heads that touch and are the same size both crash (headon)', () => {
  const a = snakeWith(10, 10, [{ x: 10, y: 10 }], 0);
  const b = snakeWith(10.5, 10, [{ x: 10.5, y: 10 }], 0);
  const { dead } = resolveTick([a, b]);
  assert.equal(reasonOf(dead, a), 'headon');
  assert.equal(reasonOf(dead, b), 'headon');
});

test('a smaller head that touches a bigger head dies; the bigger one lives', () => {
  const small = snakeWith(10, 10, [{ x: 10, y: 10 }], 0);
  const big = snakeWith(10.5, 10, [{ x: 10.5, y: 10 }], 0);
  big.value = 5;
  const { dead } = resolveTick([small, big]);
  assert.equal(reasonOf(dead, small), 'headon');
  assert.equal(reasonOf(dead, big), undefined);
});

test('a head looping over its own body is never hurt by it', () => {
  const trail = [{ x: 10, y: 10 }, { x: 11, y: 10 }, { x: 11, y: 11 }, { x: 10, y: 11 }, { x: 9.6, y: 10.4 }];
  const s = snakeWith(10, 10, trail, 4);
  const { dead, bumps } = resolveTick([s]);
  assert.equal(dead.length, 0);
  assert.equal(bumps.length, 0);
});

test('the neck is safe: the first tiles of your own body never crash you', () => {
  const s = snakeWith(10, 10, [{ x: 10, y: 10 }, { x: 9, y: 10 }], 1);
  assert.equal(resolveTick([s]).dead.length, 0);
});

test('a dead snake does not take part in later checks', () => {
  const a = snakeWith(10, 10, [{ x: 10, y: 10 }], 0);
  const b = snakeWith(10.2, 10, [{ x: 10.2, y: 10 }], 0);
  b.alive = false;
  assert.equal(resolveTick([a, b]).dead.length, 0);
});
