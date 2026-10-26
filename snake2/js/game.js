// ════════════════════════════════════════════════════════════════════
//  GAME — state, one tick, snacks, bots, timer. Pure, no DOM.
//  The UI calls createGame(), setPlayerTurn(), stepGame(), advanceClock().
// ════════════════════════════════════════════════════════════════════

const BOT_START = [
  { c: 4, r: 4, dc: 1, dr: 0 },
  { c: 45, r: 4, dc: -1, dr: 0 },
  { c: 4, r: 45, dc: 1, dr: 0 },
];

function createGame(opts) {
  const seed = opts.seed != null ? opts.seed : Date.now();
  const rng = makeRng(seed);
  const mid = Math.floor(CFG2.COLS / 2);
  const player = newSnake2({
    id: 'player', name: 'Felix', isPlayer: true, colour: PLAYER_COLOUR,
    c: mid, r: mid, dc: 1, dr: 0,
  });
  const bots = [];
  for (let i = 0; i < CFG2.BOTS; i++) {
    const b = BOT_START[i % BOT_START.length];
    bots.push(newSnake2({
      id: 'bot' + i, name: BOT_NAMES[i % BOT_NAMES.length], isPlayer: false,
      colour: BOT_COLOURS[i % BOT_COLOURS.length], c: b.c, r: b.r, dc: b.dc, dr: b.dr,
    }));
  }
  const G = {
    state: 'playing',
    mode: opts.mode === 'endless' ? 'endless' : 'timed',
    snackSet: SNACK_SETS[opts.snackSet] ? opts.snackSet : 'classic',
    seed,
    rng,
    timeLeftMs: CFG2.ROUND_MS,   // Timed mode countdown
    elapsedMs: 0,                // Endless mode clock (also used for the win time)
    snakes: [player, ...bots],
    player,
    snacks: [],                  // { c, r, value }
    pops: [],                    // { c, r, text, at }
    best: CFG2.START_VALUE,
    result: null,                // 'won' | 'crash' | 'time'
    tickCount: 0,
  };
  while (G.snacks.length < CFG2.SNACKS_ON_FIELD) addSnack(G);
  return G;
}

// Cells that snakes and snacks occupy. Used to place new things safely.
function allBodyCells(G) {
  const set = new Set();
  for (const s of G.snakes) {
    if (!s.alive) continue;
    for (const c of s.cells) set.add(cellKey(c.c, c.r));
  }
  return set;
}

function snackKeySet(G) {
  return new Set(G.snacks.map(s => cellKey(s.c, s.r)));
}

// One snack value from the chosen odds.
function sampleSnackValue(G) {
  const odds = SNACK_SETS[G.snackSet].odds;
  let roll = G.rng();
  for (const v of Object.keys(odds).map(Number)) {
    roll -= odds[v];
    if (roll < 0) return v;
  }
  return Number(Object.keys(odds)[0]);
}

function addSnack(G, value) {
  const blocked = allBodyCells(G);
  for (const s of G.snacks) blocked.add(cellKey(s.c, s.r));
  const cell = randomFreeCell(G.rng, blocked);
  if (!cell) return null;
  const snack = { c: cell.c, r: cell.r, value: value != null ? value : sampleSnackValue(G) };
  G.snacks.push(snack);
  return snack;
}

// Queue a turn for the player. Called from keys, swipes and the d-pad.
function setPlayerTurn(G, dir) {
  if (!G || G.state !== 'playing' || !G.player.alive) return false;
  return queueTurn(G.player, dir);
}

// Add value to a snake, capped at the goal. Returns { won, collapse }.
function growBy(G, s, amount) {
  const next = Math.min(s.value + amount, CFG2.GOAL);
  const collapse = setValue(s, next);
  return { won: s.isPlayer && next >= CFG2.GOAL, collapse };
}

function bodyPops(G, s, collapse, eaten, now) {
  if (!collapse) return;
  const h = snakeHead(s);
  G.pops.push({ c: h.c, r: h.r, text: popLabel(collapse.from, eaten, collapse.to), at: now });
}

// Put a crashed bot back as I, far enough from the player to be fair.
function respawnBot(G, bot) {
  const blocked = allBodyCells(G);
  for (const sn of G.snacks) blocked.add(cellKey(sn.c, sn.r));
  const ph = snakeHead(G.player);
  for (let i = 0; i < 200; i++) {
    const cell = randomFreeCell(G.rng, blocked);
    if (!cell) return false;
    if (Math.abs(cell.c - ph.c) + Math.abs(cell.r - ph.r) < CFG2.BOT_SAFE_DISTANCE) continue;
    const dir = DIRS[Math.floor(G.rng() * DIRS.length)];
    bot.cells = [{ c: cell.c, r: cell.r }];
    bot.prevCells = null;
    bot.value = CFG2.START_VALUE;
    bot.pendingGrow = 0;
    bot.dir = { dc: dir.dc, dr: dir.dr };
    bot.turnQueue = [];
    bot.alive = true;
    return true;
  }
  return false;
}

// Advance the game by one tick. Returns a list of events for the UI.
// Events: { type: 'eat' | 'collapse' | 'crash' | 'botRespawn' | 'won' | 'over', ... }
function stepGame(G, now) {
  const events = [];
  if (G.state !== 'playing') return events;
  G.tickCount += 1;

  // 1. Turns. The player uses its queue; bots choose from the board.
  takeTurn(G.player);
  for (const bot of G.snakes) {
    if (bot.isPlayer || !bot.alive) continue;
    bot.dir = botChooseDir(bot, G.snakes, snackKeySet(G), occupiedCells(G.snakes));
  }

  // 2. Crashes, decided on the planned heads.
  const { dead, next } = resolveTick(G.snakes);
  const deadSet = new Set(dead.map(d => d.snake));
  for (const d of dead) {
    const s = d.snake;
    s.alive = false;
    if (s.isPlayer) {
      events.push({ type: 'crash', reason: d.reason });
    } else {
      // A crashed bot's body becomes I snacks, and it comes back after a delay.
      for (const c of s.cells) {
        if (G.snacks.length < CFG2.MAX_SNACKS) G.snacks.push({ c: c.c, r: c.r, value: 1 });
      }
      s.respawnAt = now + CFG2.BOT_RESPAWN_MS;
      events.push({ type: 'crash', reason: d.reason, bot: s.name });
    }
  }
  if (deadSet.has(G.player)) {
    G.result = 'crash';
    G.state = 'over';
    events.push({ type: 'over', reason: 'crash' });
    return events;
  }

  // 3. Survivors eat (if a snack is on the new head) and move.
  for (const s of G.snakes) {
    if (!s.alive) continue;
    const nh = next.get(s);
    const idx = G.snacks.findIndex(sn => sn.c === nh.c && sn.r === nh.r);
    const eaten = idx >= 0 ? G.snacks.splice(idx, 1)[0] : null;
    moveSnake(s, nh, !!eaten);
    if (eaten) {
      const { won, collapse } = growBy(G, s, eaten.value);
      bodyPops(G, s, collapse, eaten.value, now);
      if (s.isPlayer) {
        G.best = Math.max(G.best, s.value);
        events.push({ type: 'eat', value: eaten.value });
        if (collapse) events.push({ type: 'collapse', from: collapse.from, to: collapse.to });
      }
      if (won) {
        G.result = 'won';
        G.state = 'won';
        events.push({ type: 'won' });
        return events;
      }
      addSnack(G);
    }
  }

  // 4. Bots waiting to come back.
  for (const bot of G.snakes) {
    if (bot.isPlayer || bot.alive || now < bot.respawnAt) continue;
    if (respawnBot(G, bot)) events.push({ type: 'botRespawn', bot: bot.name });
  }

  // Keep the field stocked, and drop any stale snacks that landed under a body.
  G.snacks = G.snacks.filter(sn => !G.snakes.some(s => s.alive && s.cells.some(c => c.c === sn.c && c.r === sn.r)));
  while (G.snacks.length < CFG2.SNACKS_ON_FIELD) addSnack(G);

  G.pops = G.pops.filter(p => now - p.at < 900);
  return events;
}

// Clock: the Timed countdown, or the Endless count-up. Ends the round in Timed mode.
function advanceClock(G, dtMs) {
  if (G.state !== 'playing') return;
  G.elapsedMs += dtMs;
  if (G.mode === 'timed') {
    G.timeLeftMs = Math.max(0, G.timeLeftMs - dtMs);
    if (G.timeLeftMs === 0) {
      G.result = 'time';
      G.state = 'over';
    }
  }
}

// Score shown on the game-over screen and stored in best scores.
function finalScore(G) {
  return { value: G.best, timeMs: G.elapsedMs, won: G.result === 'won', mode: G.mode };
}
