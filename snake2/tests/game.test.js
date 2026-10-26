const test = require('node:test');
const assert = require('node:assert/strict');
const { load, plain } = require('./load');

const ctx = load();
const { createGame, stepGame, setPlayerTurn, advanceClock, romanLength, CFG2 } = ctx;

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

test('III eating I collapses to IV: body drops a cell and a collapse event fires', () => {
  const G = createGame({ seed: 3, mode: 'endless' });
  G.player.value = 3;
  G.player.cells = [{ c: 25, r: 25 }, { c: 24, r: 25 }, { c: 23, r: 25 }];
  G.player.dir = { dc: 1, dr: 0 };
  snackAhead(G, 1);
  const events = stepGame(G, 0);
  assert.ok(events.some(e => e.type === 'collapse' && e.from === 3 && e.to === 4));
  assert.equal(G.player.value, 4);
  assert.equal(G.player.cells.length, 2);
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

test('a bot crash turns its body into I snacks, and the bot comes back later', () => {
  const G = createGame({ seed: 6, mode: 'endless' });
  const bot = G.snakes[1];
  bot.cells = [{ c: 1, r: 10 }, { c: 2, r: 10 }];
  // Pin the bot's choice to face the wall, so the test is about the crash, not the AI.
  const realChoose = ctx.botChooseDir;
  ctx.botChooseDir = () => ({ dc: -1, dr: 0 });
  try {
    const before = G.snacks.length;
    stepGame(G, 1000);
    assert.equal(bot.alive, false);
    assert.ok(G.snacks.length > before, 'bot cells added as snacks');
    assert.ok(G.snacks.filter(sn => sn.value === 1).length >= 2);
    assert.equal(bot.respawnAt, 1000 + CFG2.BOT_RESPAWN_MS);
    stepGame(G, 1000 + CFG2.BOT_RESPAWN_MS + 1);
    assert.equal(bot.alive, true);
    assert.equal(bot.value, 1);
  } finally {
    ctx.botChooseDir = realChoose;
  }
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
