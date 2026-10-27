const test = require('node:test');
const assert = require('node:assert/strict');
const { load, plain } = require('./load');

const ctx = load();
const { createGame, stepGame, setPlayerTurn, advanceClock, romanLength, CFG2, addSnack } = ctx;

const invariant = s => s.cells.length + s.pendingGrow === romanLength(s.value);

// Put a snack right in front of the player, so the next tick eats it.
function snackAhead(G, value) {
  const h = G.player.cells[0];
  const d = G.player.dir;
  G.snacks = G.snacks.filter(s => !(s.c === h.c + d.dc && s.r === h.r + d.dr));
  G.snacks.push({ c: h.c + d.dc, r: h.r + d.dr, value });
}

test('createGame: player in the middle, 3 bots, field stocked, same seed gives the same field', () => {
  const a = createGame({ seed: 42, mode: 'timed' });
  const b = createGame({ seed: 42, mode: 'timed' });
  assert.equal(a.player.value, 1);
  assert.equal(a.snakes.length, 1 + CFG2.BOTS);
  assert.equal(a.snacks.length, CFG2.SNACKS_ON_FIELD);
  assert.deepEqual(plain(a.snacks), plain(b.snacks));
});

test('the player moves one cell per tick', () => {
  const G = createGame({ seed: 1, mode: 'endless' });
  const before = plain(G.player.cells[0]);
  // Clear the path so nothing is in front.
  G.snacks = G.snacks.filter(s => s.r !== before.r);
  stepGame(G, 0);
  assert.equal(G.player.cells[0].c, before.c + 1);
  assert.equal(G.player.cells[0].r, before.r);
});

test('eating a I snack grows the body to II', () => {
  const G = createGame({ seed: 2, mode: 'endless' });
  snackAhead(G, 1);
  const events = stepGame(G, 0);
  assert.ok(events.some(e => e.type === 'eat'));
  assert.equal(G.player.value, 2);
  assert.ok(invariant(G.player));
});

test('III eating I collapses to IV: the body shrinks to a lone head and a collapse event fires', () => {
  const G = createGame({ seed: 3, mode: 'endless' });
  G.player.value = 3;
  G.player.cells = [{ c: 25, r: 25 }, { c: 24, r: 25 }, { c: 23, r: 25 }];
  G.player.dir = { dc: 1, dr: 0 };
  snackAhead(G, 1);
  const events = stepGame(G, 0);
  assert.ok(events.some(e => e.type === 'collapse' && e.from === 3 && e.to === 4));
  assert.equal(G.player.value, 4);
  assert.equal(G.player.cells.length, 1);
  assert.ok(invariant(G.player));
  assert.ok(G.pops.some(p => p.text === 'III + I → IV'), 'pop label');
});

test('hitting a wall ends the game in crash', () => {
  const G = createGame({ seed: 4, mode: 'endless' });
  G.player.cells = [{ c: 1, r: 25 }];
  G.player.dir = { dc: -1, dr: 0 };
  const events = stepGame(G, 0);
  assert.equal(G.state, 'over');
  assert.equal(G.result, 'crash');
  assert.ok(events.some(e => e.type === 'over'));
});

test('reaching 2021 wins, and the value is capped at the goal', () => {
  const G = createGame({ seed: 5, mode: 'endless' });
  G.player.value = 2020;
  G.player.cells = Array.from({ length: romanLength(2020) }, (_, i) => ({ c: 25 - i, r: 25 }));
  G.player.pendingGrow = 0;
  G.player.dir = { dc: 1, dr: 0 };
  snackAhead(G, 10);
  stepGame(G, 0);
  assert.equal(G.state, 'won');
  assert.equal(G.result, 'won');
  assert.equal(G.player.value, CFG2.GOAL);
});

test('a crashed bot breaks apart: its body symbols become coins of the same value, nearby', () => {
  const G = createGame({ seed: 6, mode: 'endless' });
  const bot = G.snakes[1];
  bot.value = 38;                                  // XXXVIII: seven symbols
  bot.cells = Array.from({ length: 7 }, (_, i) => ({ c: 1 + i, r: 10 }));
  bot.pendingGrow = 0;
  // Pin the bot's choice to face the wall, so the test is about the crash, not the AI.
  const realChoose = ctx.botChooseDir;
  ctx.botChooseDir = () => ({ dc: -1, dr: 0 });
  try {
    stepGame(G, 1000);
    assert.equal(bot.alive, false);
    const pieces = G.snacks.filter(sn => sn.piece);
    assert.equal(pieces.length, 7);
    assert.equal(pieces.reduce((sum, sn) => sum + sn.value, 0), 38, 'value is conserved');
    for (const sn of pieces) {
      assert.ok(Math.hypot(sn.c - 1, sn.r - 10) <= CFG2.SHATTER_RADIUS + 0.001, 'within the radius');
      assert.equal(sn.born, 1000);
    }
    assert.equal(G.bursts.length, 1, 'a small explosion');
    assert.equal(bot.respawnAt, 1000 + CFG2.BOT_RESPAWN_MS);
    stepGame(G, 1000 + CFG2.BOT_RESPAWN_MS + 1);
    assert.equal(bot.alive, true);
    assert.equal(bot.value, 1);
  } finally {
    ctx.botChooseDir = realChoose;
  }
});

test('the player breaks apart too when they crash, then the game is over', () => {
  const G = createGame({ seed: 12, mode: 'endless' });
  G.player.value = 6;                               // VI: two symbols
  G.player.cells = [{ c: 1, r: 25 }, { c: 2, r: 25 }];
  G.player.dir = { dc: -1, dr: 0 };
  stepGame(G, 500);
  assert.equal(G.state, 'over');
  assert.equal(G.result, 'crash');
  const pieces = G.snacks.filter(sn => sn.piece);
  assert.deepEqual(plain(pieces.map(p => p.value).sort((a, b) => a - b)), [1, 5]);
  assert.ok(G.bursts.length >= 1);
});

test('a crash into a wall, your own body, or another snake all shatter the crasher', () => {
  const G = createGame({ seed: 13, mode: 'endless' });
  const realChoose = ctx.botChooseDir;
  ctx.botChooseDir = () => ({ dc: -1, dr: 0 });
  try {
    const bot = G.snakes[2];
    bot.value = 2;
    bot.cells = [{ c: 10, r: 20 }, { c: 11, r: 20 }];
    // Another snake's body right in front of it
    const other = G.snakes[3];
    other.value = 3;
    other.cells = [{ c: 9, r: 19 }, { c: 9, r: 20 }, { c: 9, r: 21 }];
    other.dir = { dc: 0, dr: 1 };
    stepGame(G, 100);
    assert.equal(bot.alive, false, 'the crasher is gone');
    assert.equal(G.snacks.filter(sn => sn.piece).length >= 2, true);
  } finally {
    ctx.botChooseDir = realChoose;
  }
});

test('the Rival snakes setting: 1 to 10 bots, clamped, all on their own start cell', () => {
  for (const [asked, expected] of [[0, 1], [1, 1], [3, 3], [10, 10], [99, 10]]) {
    const G = createGame({ seed: 20, mode: 'endless', bots: asked });
    assert.equal(G.snakes.length, 1 + expected, 'bots asked ' + asked);
  }
  const G = createGame({ seed: 21, mode: 'endless', bots: 10 });
  const cells = new Set(G.snakes.map(s => s.cells[0].c + ',' + s.cells[0].r));
  assert.equal(cells.size, 11, 'no two snakes start on the same cell');
  assert.ok(G.snackTarget > createGame({ seed: 21, mode: 'endless', bots: 3 }).snackTarget, 'more rivals, more snacks');
});

test('eating only restocks while the field is below target, so crash coins run out', () => {
  const G = createGame({ seed: 22, mode: 'endless' });
  // Pile on extra coins, as after a crash
  for (let i = 0; i < 6; i++) addSnack(G, 1);
  const before = G.snacks.length;
  assert.ok(before > G.snackTarget);
  snackAhead(G, 1);
  stepGame(G, 0);
  assert.equal(G.snacks.length <= before, true, 'the field did not keep growing');
});

test('Timed mode ends at zero; Endless never does', () => {
  const timed = createGame({ seed: 7, mode: 'timed' });
  advanceClock(timed, CFG2.ROUND_MS);
  assert.equal(timed.state, 'over');
  assert.equal(timed.result, 'time');

  const endless = createGame({ seed: 8, mode: 'endless' });
  advanceClock(endless, CFG2.ROUND_MS * 2);
  assert.equal(endless.state, 'playing');
  assert.equal(endless.elapsedMs, CFG2.ROUND_MS * 2);
});

test('setPlayerTurn queues a turn only while playing', () => {
  const G = createGame({ seed: 9, mode: 'endless' });
  assert.equal(setPlayerTurn(G, { dc: 0, dr: -1 }), true);
  G.state = 'over';
  assert.equal(setPlayerTurn(G, { dc: 0, dr: 1 }), false);
});

test('random play for many ticks never breaks the invariant or throws', () => {
  for (let seed = 1; seed <= 6; seed++) {
    const G = createGame({ seed, mode: 'endless' });
    let now = 0;
    for (let t = 0; t < 1500 && G.state === 'playing'; t++) {
      if (G.rng() < 0.25) {
        const dirs = [{ dc: 0, dr: -1 }, { dc: 0, dr: 1 }, { dc: -1, dr: 0 }, { dc: 1, dr: 0 }];
        setPlayerTurn(G, dirs[Math.floor(G.rng() * 4)]);
      }
      now += CFG2.TICK_MS;
      stepGame(G, now);
      for (const s of G.snakes) if (s.alive) assert.ok(invariant(s), 'seed ' + seed + ' tick ' + t);
      assert.ok(G.snacks.length >= 1);
    }
  }
});
