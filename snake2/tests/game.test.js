const test = require('node:test');
const assert = require('node:assert/strict');
const { load, plain } = require('./load');

const ctx = load();
const { createGame, stepGame, setPlayerAim, romanLength, bodyLenFor, setValue, numeralTokens, fromRoman, toRoman, CFG2, TAU } = ctx;
const BAR = '\u0305';

// Put an artifact in the world at (x, y).
function placeArtifact(G, x, y, r = 0.8) {
  const cx = Math.floor(x / CFG2.CELL), cy = Math.floor(y / CFG2.CELL);
  const key = cx + ',' + cy;
  if (!G.cells.has(key)) G.cells.set(key, []);
  G.cells.get(key).push({ x, y, r, kind: 'column' });
}

// A quiet world for the crash tests: no seeded artifacts, the player at the start, heading right.
function clearWorld(seed) {
  const G = createGame({ seed, bots: 1 });
  G.cells.clear();
  G.snacks = [];
  return G;
}

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

test('createGame: player at the start, bots on their starts, field stocked, same seed same field', () => {
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

test('aiming turns the head at once: the next step moves that way', () => {
  const G = createGame({ seed: 2, bots: 1 });
  G.snacks = [];
  setPlayerAim(G, Math.PI / 2);     // straight down the screen
  const y0 = G.player.y;
  stepGame(G, 0);
  assert.equal(G.player.angle, Math.PI / 2);
  assert.ok(Math.abs(G.player.y - (y0 + CFG2.SPEED)) < 1e-9, 'one full step down');
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

test('an artifact costs one or two symbols from the head, and the game goes on', () => {
  const G = clearWorld(5);
  growPlayer(G, 3);                              // III
  G.player.trail = [{ x: 0, y: 0 }, { x: -1, y: 0 }, { x: -2, y: 0 }];
  G.player.bodyLen = G.player.targetLen;
  placeArtifact(G, 1.3, 0);                      // one step ahead
  const events = stepGame(G, 0);
  assert.equal(G.state, 'playing', 'a crash is not the end');
  assert.ok([1, 2].includes(G.player.value), `now ${toRoman(G.player.value)}`);
  assert.ok(events.some(e => e.type === 'crash' && e.reason === 'artifact' && e.isPlayer && !e.dead));
  assert.ok(G.pops.some(p => p.text.startsWith('−')), 'the loss is shown');
  assert.ok(G.player.grace > 0, 'a short grace after the crash');
  assert.ok(invariant(G.player));
});

test('the head moves back onto the first symbol left after a crash', () => {
  // III on a trail running left from the head. After the step the head is at x = 1, and the
  // artifact at 1.3 catches it. Losing one symbol (II) puts the head 0.85 back, at x = 0.15;
  // losing two (I) puts it 1.7 back, at x = -0.7.
  const G = clearWorld(5);
  growPlayer(G, 3);
  G.player.trail = [{ x: 0, y: 0 }, { x: -1, y: 0 }, { x: -2, y: 0 }];
  G.player.bodyLen = G.player.targetLen;
  placeArtifact(G, 1.3, 0);
  stepGame(G, 0);
  const expected = { 2: 1 - CFG2.SYMBOL_STEP, 1: 1 - 2 * CFG2.SYMBOL_STEP };
  assert.ok(G.player.value in expected, `value ${G.player.value}`);
  assert.ok(Math.abs(G.player.x - expected[G.player.value]) < 1e-9, `head at ${G.player.x}`);
  assert.ok(Math.abs(G.player.y) < 1e-9);
});

test('an artifact cannot crash the same snake again while it is in grace', () => {
  const G = clearWorld(5);
  growPlayer(G, 5);                              // V
  placeArtifact(G, 1.3, 0);
  stepGame(G, 0);
  const after = G.player.value;
  G.player.x = 1.3; G.player.y = 0;              // still touching it
  stepGame(G, 1);
  assert.equal(G.player.value, after, 'no second penalty during grace');
});

test('a snake with one symbol that crashes into an artifact has nothing left: game over', () => {
  const G = clearWorld(8);
  placeArtifact(G, 1.3, 0);
  const events = stepGame(G, 0);
  assert.equal(G.player.alive, false);
  assert.equal(G.state, 'over');
  assert.equal(G.result, 'crash');
  assert.ok(events.some(e => e.type === 'over'));
  assert.ok(G.bursts.length >= 1);
});

test('FreePlay has no goal and no cap: the numeral goes on past MMMCMXCIX', () => {
  const G = clearWorld(6);
  growPlayer(G, 3999);
  snackAhead(G, 1);
  stepGame(G, 0);
  assert.equal(G.state, 'playing', 'no win state');
  assert.equal(G.player.value, 4000, 'carries on into the overlines');
  assert.equal(toRoman(4000), 'I' + BAR + 'V' + BAR);
  assert.ok(invariant(G.player));

  growPlayer(G, 2020);
  snackAhead(G, 50);
  stepGame(G, 0);
  assert.equal(G.player.value, 2070);
  assert.ok(invariant(G.player));
});

test('the world has no edge: a snake far out is not stopped, and bots stay near the player', () => {
  const G = clearWorld(17);
  G.player.x = -500; G.player.y = 900; G.player.angle = 0; G.player.target = 0;
  G.player.trail = [{ x: -500, y: 900 }];
  stepGame(G, 0);
  assert.equal(G.player.alive, true);
  assert.equal(G.state, 'playing');
});

test('a bot that wanders out of sight is started again near the player', () => {
  const G = clearWorld(18);
  const bot = G.snakes[1];
  bot.x = 400; bot.y = 400; bot.trail = [{ x: 400, y: 400 }];
  stepGame(G, 0);
  assert.ok(Math.hypot(bot.x - G.player.x, bot.y - G.player.y) <= CFG2.BOT_SPAWN_R + 2, 'back near the player');
  assert.equal(bot.value, CFG2.START_VALUE);
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
  // Crash it directly: the shatter is what happens when a snake runs out of symbols.
  bot.alive = false;
  ctx.shatter(G, bot, 0);
  const pieces = G.snacks.filter(s => s.piece);
  assert.ok(pieces.length >= 5, `${pieces.length} pieces`);
  for (const p of pieces) {
    assert.ok([1, 5, 10].includes(p.value), `piece ${p.value} is a numeral symbol value`);
    assert.ok(Math.hypot(p.x - bot.x, p.y - bot.y) <= CFG2.SHATTER_RADIUS + 1e-6, 'thrown nearby');
  }
});

test('the Rival snakes setting: 1 to 10 bots, clamped, each on its own start', () => {
  assert.equal(createGame({ seed: 9, bots: 0 }).snakes.length, 1 + CFG2.BOTS_MIN);
  assert.equal(createGame({ seed: 9, bots: 99 }).snakes.length, 1 + CFG2.BOTS_MAX);
  const G = createGame({ seed: 9, bots: 10 });
  const starts = G.snakes.slice(1).map(b => b.x.toFixed(3) + ',' + b.y.toFixed(3));
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

test('the snacks scale with the player: a D mostly finds L, a C mostly finds X, and nothing above the leading symbol', () => {
  const count = value => {
    const G = createGame({ seed: 21, bots: 1 });
    growPlayer(G, value);
    const tally = {};
    for (let i = 0; i < 3000; i++) {
      const v = ctx.sampleSnackValue(G);
      tally[v] = (tally[v] || 0) + 1;
    }
    return tally;
  };
  const d = count(500);
  assert.ok(d[50] > d[10] && d[50] > d[100], 'L is the most common for a D, with X and C beside it');
  assert.ok(!d[1000], 'no M snacks for a D');
  const c = count(100);
  assert.ok(c[10] > c[5] && c[10] > c[50], 'X is the most common for a C, with V and L beside it');
  assert.ok(!c[100], 'no C snacks for a C');
  const i = count(1);
  assert.ok(i[1] > 0 && !i[5] && !i[10], 'a I only finds I');
});

test('a C eats an I snack: any snake eats any snack', () => {
  const G = createGame({ seed: 13, bots: 1 });
  growPlayer(G, 100);
  snackAhead(G, 1);
  stepGame(G, 0);
  assert.equal(G.player.value, 101);
});

test('a bump cuts the victim body at the contact: the rest falls away as coins', () => {
  const G = createGame({ seed: 14, bots: 1 });
  const v = G.snakes[1];
  growVictim(G, v, 38);      // XXXVIII
  G.snacks = [];
  G.snackTarget = 0;
  // Put the player's head onto the victim's body, two tiles back from its head.
  const at = ctx.pointAtArc(v.trail, 2 * CFG2.SYMBOL_STEP);
  G.player.x = at.x; G.player.y = at.y; G.player.angle = 0; G.player.target = 0;
  G.player.trail = [{ x: at.x, y: at.y }];
  G.player.value = 1; G.player.bodyLen = 0; G.player.targetLen = 0;
  const events = stepGame(G, 0);
  assert.equal(G.player.alive, true, 'the bumper survives');
  assert.ok(events.some(e => e.type === 'bump' && e.victim === v.name));
  assert.ok(v.alive);
  assert.ok(v.value < 38, 'the victim lost symbols');
  assert.equal(toRoman(v.value), numeralTokens(v.value).map(t => t.text).join(''));
});

test('the cut-off symbols become coins of their own values, and the victim keeps the symbols before the cut', () => {
  const G = createGame({ seed: 15, bots: 1 });
  const v = G.snakes[1];
  growVictim(G, v, 38);      // XXXVIII: X X X V I I I
  G.snacks = [];
  G.snackTarget = 0;
  ctx.bumpBody(G, v, 2 * CFG2.SYMBOL_STEP);
  assert.equal(v.value, 20, 'XX remains');
  assert.deepEqual(G.snacks.map(s => s.value), [10, 5, 1, 1, 1], 'the cut X V I I I become coins');
});

test('a bumped snake can reclaim its own cut pieces, and no one else can until the window closes', () => {
  const G = createGame({ seed: 16, bots: 2 });
  const v = G.snakes[1], other = G.snakes[2];
  growVictim(G, v, 38);
  G.snacks = [];
  G.snackTarget = 0;
  ctx.bumpBody(G, v, 2 * CFG2.SYMBOL_STEP, 1000);
  const piece = G.snacks[0];
  assert.equal(piece.owner, v.id);
  assert.equal(ctx.canEat(other, piece, 1000 + 100), false, 'a rival cannot take it yet');
  assert.equal(ctx.canEat(v, piece, 1000 + 100), true, 'the owner can');
  assert.equal(ctx.canEat(other, piece, 1000 + CFG2.RECLAIM_MS), true, 'after the window it is a normal snack');
});

test('the numeral left after a bump is always canonical, for every value', () => {
  for (let v = 1; v <= 3999; v++) {
    const tokens = numeralTokens(v);
    for (let keep = 1; keep <= tokens.length; keep++) {
      const prefix = tokens.slice(0, keep).map(t => t.text).join('');
      assert.equal(fromRoman(prefix) > 0, true, `${prefix} from ${v}`);
    }
  }
});

function growVictim(G, v, value) {
  setValue(v, value);
  v.bodyLen = v.targetLen;
  v.trail = Array.from({ length: 40 }, (_, i) => ({ x: 20 - i * 0.5, y: 45 }));
  v.x = v.trail[0].x; v.y = v.trail[0].y;
  v.symPts = ctx.symbolPoints(v);
}
