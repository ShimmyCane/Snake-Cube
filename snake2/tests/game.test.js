const test = require('node:test');
const assert = require('node:assert/strict');
const { load, plain } = require('./load');

const ctx = load();
const { createGame, stepGame, setPlayerAim, romanLength, bodyLenFor, setValue, CFG2, TAU } = ctx;

const invariant = s => Math.abs(s.targetLen - bodyLenFor(s.value)) < 1e-9 && s.bodyLen <= s.targetLen + 1e-9;

// Put a snack right in front of the player, so the next step eats it.
function snackAhead(G, value) {
  const p = G.player;
  G.snacks = G.snacks.filter(s => Math.hypot(s.x - p.x, s.y - p.y) > 2);
  G.snacks.push({ x: p.x + Math.cos(p.angle) * 0.6, y: p.y + Math.sin(p.angle) * 0.6, value });
}

// Set the player's numeral and body, as if it had already grown there.
function growPlayer(G, value) {
  setValue(G.player, value);
  G.player.bodyLen = G.player.targetLen;
  G.player.symPts = ctx.symbolPoints(G.player);
}

test('createGame: player in the middle, bots on their starts, field stocked, same seed same field', () => {
  const a = createGame({ seed: 42 });
  const b = createGame({ seed: 42 });
  assert.equal(a.player.value, 1);
  assert.equal(a.snakes.length, 1 + CFG2.BOTS);
  assert.equal(a.snacks.length, CFG2.SNACKS_ON_FIELD);
  assert.deepEqual(plain(a.snacks), plain(b.snacks));
});

test('the player moves smoothly: one SPEED step along its heading per step', () => {
  const G = createGame({ seed: 1, bots: 1 });
  G.snacks = [];
  const x0 = G.player.x, y0 = G.player.y;
  stepGame(G, 0);
  assert.ok(Math.abs(G.player.x - (x0 + CFG2.SPEED)) < 1e-9);
  assert.ok(Math.abs(G.player.y - y0) < 1e-9);
});

test('aiming turns the head there, but only at TURN_RATE a step', () => {
  const G = createGame({ seed: 2, bots: 1 });
  G.snacks = [];
  setPlayerAim(G, Math.PI / 2);     // straight down the screen
  stepGame(G, 0);
  assert.ok(Math.abs(G.player.angle - CFG2.TURN_RATE) < 1e-9);
  for (let i = 0; i < 20; i++) stepGame(G, 0);
  assert.ok(Math.abs(G.player.angle - Math.PI / 2) < 1e-9);
});

test('eating a I snack grows the body toward II', () => {
  const G = createGame({ seed: 3, bots: 1 });
  snackAhead(G, 1);
  stepGame(G, 0);
  assert.equal(G.player.value, 2);
  assert.equal(G.player.targetLen, bodyLenFor(2));
});

test('III eating I collapses to IV: the body shrinks to a lone head and a collapse event fires', () => {
  const G = createGame({ seed: 4, bots: 1 });
  growPlayer(G, 3);
  snackAhead(G, 1);
  const events = stepGame(G, 0);
  assert.equal(G.player.value, 4);
  assert.equal(G.player.bodyLen, 0);
  assert.ok(events.some(e => e.type === 'collapse' && e.from === 3 && e.to === 4));
  assert.ok(G.pops.some(p => p.text === 'III + I → IV'), 'pop label');
});

test('hitting a wall ends the game in crash', () => {
  const G = createGame({ seed: 5, bots: 1 });
  G.player.x = 1.6; G.player.y = 25; G.player.angle = Math.PI; G.player.target = Math.PI;
  G.player.trail = [{ x: 1.6, y: 25 }];
  const events = stepGame(G, 0);
  assert.equal(G.state, 'over');
  assert.equal(G.result, 'crash');
  assert.ok(events.some(e => e.type === 'over'));
});

test('FreePlay has no goal: past MMXXI the snake keeps going, up to the largest numeral', () => {
  const G = createGame({ seed: 6, bots: 1 });
  growPlayer(G, 2020);
  snackAhead(G, 10);
  stepGame(G, 0);
  assert.equal(G.state, 'playing', 'no win state');
  assert.equal(G.player.value, 2030);
  assert.ok(invariant(G.player));

  growPlayer(G, 3995);
  snackAhead(G, 10);
  stepGame(G, 0);
  assert.equal(G.player.value, CFG2.MAX_VALUE, 'capped at the largest numeral');
});

test('a crashed bot breaks apart: its body symbols become coins of the same value, nearby', () => {
  const G = createGame({ seed: 7, bots: 2 });
  const bot = G.snakes[1];
  bot.value = 38;                       // XXXVIII: seven symbols
  setValue(bot, 38); bot.bodyLen = bot.targetLen;
  bot.x = 1.6; bot.y = 30; bot.angle = Math.PI; bot.target = Math.PI;
  bot.trail = [{ x: 1.6, y: 30 }, { x: 2.6, y: 30 }, { x: 3.6, y: 30 }];
  G.snacks = [];
  G.snackTarget = 0;                    // no restocking, so only the pieces are on the field
  stepGame(G, 0);
  assert.equal(bot.alive, false);
  const pieces = G.snacks.filter(s => s.piece);
  assert.ok(pieces.length >= 5, `${pieces.length} pieces`);
  for (const p of pieces) {
    assert.ok([1, 5, 10].includes(p.value), `piece ${p.value} is a numeral symbol value`);
    assert.ok(Math.hypot(p.x - bot.x, p.y - bot.y) <= CFG2.SHATTER_RADIUS + 1e-6, 'thrown nearby');
  }
});

test('the player breaks apart too when they crash, then the game is over', () => {
  const G = createGame({ seed: 8, bots: 1 });
  G.player.x = 1.6; G.player.y = 25; G.player.angle = Math.PI; G.player.target = Math.PI;
  G.player.trail = [{ x: 1.6, y: 25 }];
  stepGame(G, 0);
  assert.equal(G.player.alive, false);
  assert.equal(G.state, 'over');
  assert.ok(G.bursts.length >= 1);
});

test('the Rival snakes setting: 1 to 10 bots, clamped, each on its own start', () => {
  assert.equal(createGame({ seed: 9, bots: 0 }).snakes.length, 1 + CFG2.BOTS_MIN);
  assert.equal(createGame({ seed: 9, bots: 99 }).snakes.length, 1 + CFG2.BOTS_MAX);
  const G = createGame({ seed: 9, bots: 10 });
  const starts = G.snakes.slice(1).map(b => b.x + ',' + b.y);
  assert.equal(new Set(starts).size, starts.length);
  assert.ok(G.snackTarget > createGame({ seed: 9, bots: 3 }).snackTarget, 'more rivals, more snacks');
});

test('eating only restocks while the field is below target, so crash coins run out', () => {
  const G = createGame({ seed: 10, bots: 1 });
  for (let i = 0; i < 6; i++) G.snacks.push({ x: 40 + i * 0.5, y: 40, value: 1 });
  const before = G.snacks.length;
  assert.ok(before > G.snackTarget);
  snackAhead(G, 1);
  stepGame(G, 0);
  assert.ok(G.snacks.length <= before, 'the field did not keep growing');
});

test('FreePlay has no clock: the game stays in play until a crash', () => {
  const G = createGame({ seed: 11, bots: 1 });
  G.snacks = [];
  for (let t = 1; t <= 200; t++) stepGame(G, t * CFG2.TICK_MS);
  assert.ok(G.state === 'playing' || (G.state === 'over' && G.result === 'crash'));
});

test('setPlayerAim takes an angle only while the player is alive and playing', () => {
  const G = createGame({ seed: 12, bots: 1 });
  assert.equal(setPlayerAim(G, 1.0), true);
  assert.equal(G.player.target, 1.0);
  G.state = 'over';
  assert.equal(setPlayerAim(G, 2.0), false);
});

test('random play for many steps never breaks the body invariant or throws', () => {
  for (let seed = 1; seed <= 6; seed++) {
    const G = createGame({ seed, bots: 3 });
    let now = 0;
    for (let t = 0; t < 1500 && G.state === 'playing'; t++) {
      if (G.rng() < 0.2) setPlayerAim(G, G.rng() * TAU);
      now += CFG2.TICK_MS;
      stepGame(G, now);
      for (const s of G.snakes) {
        if (!s.alive) continue;
        assert.ok(Number.isFinite(s.x) && Number.isFinite(s.y), 'seed ' + seed + ' tick ' + t);
        assert.ok(invariant(s), 'seed ' + seed + ' tick ' + t);
      }
      assert.ok(G.snacks.length >= 1);
    }
  }
});
