const test = require('node:test');
const assert = require('node:assert/strict');
const { load } = require('./load');

const ctx = load();
const { newSnake2, botChooseDir, occupiedCells, makeRng, DIRS, isWall, cellKey } = ctx;

test('a bot never steps into a wall when a safe move exists', () => {
  const rng = makeRng(11);
  for (let i = 0; i < 300; i++) {
    const c = 2 + Math.floor(rng() * 46), r = 2 + Math.floor(rng() * 46);
    const bot = newSnake2({ id: 'b', name: 'b', isPlayer: false, colour: '#000', c, r, dc: 1, dr: 0 });
    const snakes = [bot];
    const d = botChooseDir(bot, snakes, new Set(), occupiedCells(snakes));
    assert.ok(!isWall(c + d.dc, r + d.dr), 'picked a wall at ' + c + ',' + r);
  }
});

test('a bot heads straight for a snack in an open room', () => {
  const bot = newSnake2({ id: 'b', name: 'b', isPlayer: false, colour: '#000', c: 10, r: 25, dc: 0, dr: -1 });
  const snakes = [bot];
  const snacks = new Set([cellKey(16, 25)]);
  const d = botChooseDir(bot, snakes, snacks, occupiedCells(snakes));
  assert.deepEqual({ dc: d.dc, dr: d.dr }, { dc: 1, dr: 0 });
});

test('a bot never reverses onto its own neck', () => {
  const bot = newSnake2({ id: 'b', name: 'b', isPlayer: false, colour: '#000', c: 10, r: 25, dc: 1, dr: 0 });
  const d = botChooseDir(bot, [bot], new Set([cellKey(11, 25)]), occupiedCells([bot]));
  assert.ok(!(d.dc === -1 && d.dr === 0));
});
