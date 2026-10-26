const test = require('node:test');
const assert = require('node:assert/strict');
const { load, plain } = require('./load');

const ctx = load();
const { newSnake2, setValue, moveSnake, queueTurn, takeTurn, romanLength, DIRS, makeRng } = ctx;

function snakeWith(value, cellCount) {
  const s = newSnake2({ id: 't', name: 't', isPlayer: true, colour: '#000', c: 20, r: 20, dc: 1, dr: 0 });
  s.cells = Array.from({ length: cellCount }, (_, i) => ({ c: 20 - i, r: 20 }));
  s.value = value;
  return s;
}

const invariant = s => s.cells.length + s.pendingGrow === romanLength(s.value);

test('a new snake is I: one cell, invariant holds', () => {
  const s = newSnake2({ id: 't', name: 't', isPlayer: true, colour: '#000', c: 5, r: 5, dc: 1, dr: 0 });
  assert.equal(s.value, 1);
  assert.equal(s.cells.length, 1);
  assert.ok(invariant(s));
});

test('IV collapse: III eats I and the tail drops one cell at once', () => {
  const s = snakeWith(3, 3);
  const collapse = setValue(s, 4);
  assert.deepEqual(plain(collapse), { from: 3, to: 4, dropped: 1 });
  assert.equal(s.cells.length, 2);
  assert.equal(s.pendingGrow, 0);
  assert.ok(invariant(s));
});

test('growing: II from I adds one cell over the next tick', () => {
  const s = snakeWith(1, 1);
  assert.equal(setValue(s, 2), null);
  assert.equal(s.cells.length, 1);
  assert.equal(s.pendingGrow, 1);
  assert.ok(invariant(s));
  moveSnake(s, { c: 21, r: 20 }, false);      // growing: the tail stays
  assert.equal(s.cells.length, 2);
  assert.equal(s.pendingGrow, 0);
  assert.ok(invariant(s));
});

test('eating skips the tail pop, so the body grows out of the tail', () => {
  const s = snakeWith(1, 2);
  moveSnake(s, { c: 21, r: 20 }, true);
  assert.equal(s.cells.length, 3);
});

test('a plain move keeps the length', () => {
  const s = snakeWith(1, 3);
  moveSnake(s, { c: 21, r: 20 }, false);
  assert.equal(s.cells.length, 3);
  assert.deepEqual(plain(s.cells[0]), { c: 21, r: 20 });
});

test('the invariant holds through a long random run of eats and moves', () => {
  const rng = makeRng(7);
  const s = snakeWith(1, 1);
  for (let i = 0; i < 4000; i++) {
    const head = s.cells[0];
    const nh = { c: head.c + 1, r: head.r };
    if (rng() < 0.3) {
      // Mirrors the game: move (eating skips the pop), then rewrite the value.
      const amount = [1, 5, 10][Math.floor(rng() * 3)];
      moveSnake(s, nh, true);
      setValue(s, Math.min(s.value + amount, 2021));
    } else {
      moveSnake(s, nh, false);
    }
    assert.ok(invariant(s), 'step ' + i + ' value ' + s.value);
  }
});

test('queueTurn refuses a reversal and a repeat, and caps the queue', () => {
  const s = snakeWith(1, 1);                     // facing right
  const [up, down, left, right] = [DIRS[0], DIRS[1], DIRS[2], DIRS[3]];
  assert.equal(queueTurn(s, left), false, 'reverse of right');
  assert.equal(queueTurn(s, right), false, 'same as current');
  assert.equal(queueTurn(s, up), true);
  assert.equal(queueTurn(s, down), false, 'reverse of the queued up');
  assert.equal(queueTurn(s, left), true, 'second slot');
  assert.equal(queueTurn(s, down), false, 'queue full (only 2 turns allowed)');
  takeTurn(s);
  assert.deepEqual(plain(s.dir), { dc: 0, dr: -1 });
});
