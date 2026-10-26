const test = require('node:test');
const assert = require('node:assert/strict');
const { load } = require('./load');

const ctx = load();
const { newSnake2, resolveTick } = ctx;

function snake(id, cells, dir, opts = {}) {
  const s = newSnake2({ id, name: id, isPlayer: !!opts.isPlayer, colour: '#000', c: cells[0].c, r: cells[0].r, dc: dir.dc, dr: dir.dr });
  s.cells = cells.map(c => ({ c: c.c, r: c.r }));
  s.value = opts.value || 1;
  s.pendingGrow = opts.pendingGrow || 0;
  return s;
}

const reasonOf = (result, s) => {
  const hit = result.dead.find(d => d.snake === s);
  return hit ? hit.reason : null;
};

test('a head stepping into the wall crashes', () => {
  const s = snake('a', [{ c: 1, r: 10 }], { dc: -1, dr: 0 });
  assert.equal(reasonOf(resolveTick([s]), s), 'wall');
});

test('a head stepping into its own body crashes (self)', () => {
  // Head at (5,5) heads down into (5,6), which is body cell 3 and not the leaving tail.
  const s = snake('a', [{ c: 5, r: 5 }, { c: 6, r: 5 }, { c: 6, r: 6 }, { c: 5, r: 6 }, { c: 4, r: 6 }], { dc: 0, dr: 1 });
  assert.equal(reasonOf(resolveTick([s]), s), 'self');
});

test('moving into your own tail that is leaving is allowed', () => {
  const s = snake('a', [{ c: 5, r: 5 }, { c: 6, r: 5 }, { c: 6, r: 6 }, { c: 5, r: 6 }], { dc: 0, dr: 1 });
  assert.equal(reasonOf(resolveTick([s]), s), null);
});

test('the tail is not leaving while growing, so the same move crashes', () => {
  const s = snake('a', [{ c: 5, r: 5 }, { c: 6, r: 5 }, { c: 6, r: 6 }, { c: 5, r: 6 }], { dc: 0, dr: 1 }, { pendingGrow: 1 });
  assert.equal(reasonOf(resolveTick([s]), s), 'self');
});

test('running into another snake body crashes (body)', () => {
  const a = snake('a', [{ c: 5, r: 5 }], { dc: 1, dr: 0 });
  const b = snake('b', [{ c: 6, r: 5 }, { c: 7, r: 5 }, { c: 8, r: 5 }], { dc: 0, dr: -1 });
  const result = resolveTick([a, b]);
  assert.equal(reasonOf(result, a), 'body');
  assert.equal(reasonOf(result, b), null);
});

test('two heads entering the same cell both crash (headon)', () => {
  const a = snake('a', [{ c: 5, r: 5 }], { dc: 1, dr: 0 });
  const b = snake('b', [{ c: 7, r: 5 }], { dc: -1, dr: 0 });
  const result = resolveTick([a, b]);
  assert.equal(reasonOf(result, a), 'headon');
  assert.equal(reasonOf(result, b), 'headon');
});

test('two heads swapping cells both crash (headon)', () => {
  const a = snake('a', [{ c: 5, r: 5 }], { dc: 1, dr: 0 });
  const b = snake('b', [{ c: 6, r: 5 }], { dc: -1, dr: 0 });
  const result = resolveTick([a, b]);
  assert.equal(reasonOf(result, a), 'headon');
  assert.equal(reasonOf(result, b), 'headon');
});

test('a head may step into a cell another head is leaving (no crash)', () => {
  const a = snake('a', [{ c: 5, r: 5 }], { dc: 1, dr: 0 });
  const b = snake('b', [{ c: 6, r: 5 }], { dc: 0, dr: 1 });
  const result = resolveTick([a, b]);
  assert.equal(reasonOf(result, a), null);
  assert.equal(reasonOf(result, b), null);
});

test('dead snakes are ignored in later checks', () => {
  const a = snake('a', [{ c: 1, r: 10 }], { dc: -1, dr: 0 });
  const b = snake('b', [{ c: 5, r: 5 }], { dc: 1, dr: 0 });
  b.alive = false;
  const result = resolveTick([a, b]);
  assert.equal(result.dead.length, 1);
});
