const test = require('node:test');
const assert = require('node:assert/strict');
const { load } = require('./load');

const ctx = load();
const { createGame, botChooseAim, angleDiff, artifactsInCell, CFG2 } = ctx;

// A quiet world: the player parked far away, one bot, the snacks and artifacts placed by the test.
function quiet(botAt, botAngle) {
  const G = createGame({ seed: 3, bots: 1 });
  G.player.x = 0; G.player.y = -200;
  G.player.trail = [{ x: 0, y: -200 }];
  const bot = G.snakes[1];
  bot.x = botAt.x; bot.y = botAt.y; bot.angle = botAngle; bot.target = botAngle;
  bot.trail = [{ x: botAt.x, y: botAt.y }];
  G.snacks = [];
  G.cells.clear();          // no artifacts from the seed: the test places its own
  return { G, bot };
}

// Put an artifact in the world at (x, y), in the cell the world would look in.
function placeArtifact(G, x, y, r = 0.8) {
  const cx = Math.floor(x / CFG2.CELL), cy = Math.floor(y / CFG2.CELL);
  const key = cx + ',' + cy;
  if (!G.cells.has(key)) G.cells.set(key, []);
  G.cells.get(key).push({ x, y, r, kind: 'column' });
}

test('a bot heading into an artifact turns away from it', () => {
  const { G, bot } = quiet({ x: 0, y: 0 }, 0);
  placeArtifact(G, 3, 0);                 // straight ahead, three tiles off
  const a = botChooseAim(bot, G);
  assert.ok(Math.abs(angleDiff(0, a)) > 0.3, `chose ${a}, which still runs into the artifact`);
});

test('a bot heads straight for a snack in an open room', () => {
  const { G, bot } = quiet({ x: 10, y: 25 }, 0);
  G.snacks.push({ x: 15, y: 25, value: 1 });
  assert.ok(Math.abs(angleDiff(0, botChooseAim(bot, G))) < 0.3);
});

test('a bot never turns back on itself in one go', () => {
  const { G, bot } = quiet({ x: 25, y: 25 }, 0);
  const a = botChooseAim(bot, G);
  assert.ok(Math.abs(angleDiff(bot.angle, a)) <= 2.1 + 1e-9);
});

test('the same seed makes the same artifacts, and the start is kept clear of them', () => {
  const a = artifactsInCell(7, 3, -2);
  const b = artifactsInCell(7, 3, -2);
  assert.deepEqual(JSON.parse(JSON.stringify(a)), JSON.parse(JSON.stringify(b)));
  for (let cx = -3; cx <= 3; cx++) {
    for (let cy = -3; cy <= 3; cy++) {
      for (const ob of artifactsInCell(7, cx, cy)) {
        assert.ok(Math.hypot(ob.x, ob.y) >= CFG2.ARTIFACT_SAFE, 'no artifact near the start');
      }
    }
  }
});

test('artifacts are scattered over the world, and there are some far out too', () => {
  let count = 0;
  for (let cx = 100; cx < 120; cx++) for (let cy = 100; cy < 120; cy++) count += artifactsInCell(9, cx, cy).length;
  const expected = 400 * CFG2.ARTIFACT_CHANCE;
  assert.ok(count > expected * 0.7 && count < expected * 1.3, `${count} artifacts, expected about ${expected}`);
});
