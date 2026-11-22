const test = require('node:test');
const assert = require('node:assert/strict');
const { load } = require('./load');

const ctx = load();
const { createGame, botChooseAim, angleDiff, CFG2 } = ctx;

// A quiet board: the player parked far away, one bot, the snacks placed by the test.
function quiet(botAt, botAngle) {
  const G = createGame({ seed: 3, bots: 1 });
  G.player.x = 25; G.player.y = 10;
  G.player.trail = [{ x: 25, y: 10 }];
  const bot = G.snakes[1];
  bot.x = botAt.x; bot.y = botAt.y; bot.angle = botAngle; bot.target = botAngle;
  bot.trail = [{ x: botAt.x, y: botAt.y }];
  G.snacks = [];
  return { G, bot };
}

test('a bot near the stone border turns away from it', () => {
  const { G, bot } = quiet({ x: 2.5, y: 25 }, Math.PI);   // heading left, into the wall
  const a = botChooseAim(bot, G);
  assert.ok(Math.cos(a) > -0.2, `chose ${a}, which still points into the wall`);
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
