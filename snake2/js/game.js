// ════════════════════════════════════════════════════════════════════
//  GAME — state, one step, snacks, bots. Pure, no DOM. FreePlay: no clock, no goal.
//  The UI calls createGame(), setPlayerAim(), stepGame().
// ════════════════════════════════════════════════════════════════════

// Ten start spots around the board, each facing inward. The first three are the default bots.
const BOT_START = [
  { x: 4.5, y: 4.5, a: 0 }, { x: 45.5, y: 4.5, a: Math.PI }, { x: 4.5, y: 45.5, a: 0 },
  { x: 45.5, y: 45.5, a: Math.PI }, { x: 25, y: 4.5, a: Math.PI / 2 }, { x: 25, y: 45.5, a: -Math.PI / 2 },
  { x: 4.5, y: 25, a: 0 }, { x: 45.5, y: 25, a: Math.PI }, { x: 14.5, y: 14.5, a: 0 }, { x: 35.5, y: 35.5, a: Math.PI },
];

function createGame(opts) {
  const seed = opts.seed != null ? opts.seed : Date.now();
  const rng = makeRng(seed);
  const mid = CFG2.COLS / 2;
  const player = newSnake2({
    id: 'player', name: 'Felix', isPlayer: true, colour: PLAYER_COLOUR, x: mid, y: mid, angle: 0,
  });
  const botCount = Math.max(CFG2.BOTS_MIN, Math.min(CFG2.BOTS_MAX, opts.bots != null ? opts.bots : CFG2.BOTS));
  const bots = [];
  for (let i = 0; i < botCount; i++) {
    const b = BOT_START[i % BOT_START.length];
    bots.push(newSnake2({
      id: 'bot' + i, name: BOT_NAMES[i % BOT_NAMES.length], isPlayer: false,
      colour: BOT_COLOURS[i % BOT_COLOURS.length], x: b.x, y: b.y, angle: b.a,
    }));
  }
  const G = {
    state: 'playing',
    snackSet: SNACK_SETS[opts.snackSet] ? opts.snackSet : 'classic',
    seed,
    rng,
    snakes: [player, ...bots],
    player,
    snacks: [],                  // { x, y, value } + { piece, fromX, fromY, born } for a crashed snake's coins
    snackTarget: CFG2.SNACKS_ON_FIELD + CFG2.SNACKS_PER_EXTRA_BOT * Math.max(0, botCount - CFG2.BOTS),
    pops: [],                    // { x, y, text, at }
    bursts: [],                  // { x, y, at } little explosions where a snake crashed
    result: null,                // 'crash' when the player's head hits something
    tickCount: 0,
  };
  while (G.snacks.length < G.snackTarget) if (!addSnack(G)) break;
  return G;
}

// True if p is at least minDist from every trail point of a live snake.
function clearOfBodies(G, p, minDist) {
  for (const s of G.snakes) {
    if (!s.alive) continue;
    for (const pt of s.trail) if (Math.hypot(pt.x - p.x, pt.y - p.y) < minDist) return false;
  }
  return true;
}

function nearSnack(G, p, minDist) {
  return G.snacks.some(sn => Math.hypot(sn.x - p.x, sn.y - p.y) < minDist);
}

// A free point in the playing area, away from bodies and other snacks. Null if none turns up.
function freePoint(G, margin, minBody) {
  for (let i = 0; i < 80; i++) {
    const p = randomPoint(G.rng, margin);
    if (!clearOfBodies(G, p, minBody) || nearSnack(G, p, 1.2)) continue;
    return p;
  }
  return null;
}

// A free point within `radius` of centre `c`. Null if none turns up.
function freePointNear(G, c, radius, minBody) {
  for (let i = 0; i < 80; i++) {
    const r = Math.sqrt(G.rng()) * radius;
    const a = G.rng() * TAU;
    const p = { x: c.x + Math.cos(a) * r, y: c.y + Math.sin(a) * r };
    if (!inPlayArea(p.x, p.y, 0.5)) continue;
    if (!clearOfBodies(G, p, minBody) || nearSnack(G, p, 0.8)) continue;
    return p;
  }
  return null;
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
  const p = freePoint(G, 1.5, 2.5);
  if (!p) return null;
  const snack = { x: p.x, y: p.y, value: value != null ? value : sampleSnackValue(G) };
  G.snacks.push(snack);
  return snack;
}

// Aim the player's head at an angle, in radians. It turns there at TURN_RATE.
function setPlayerAim(G, angle) {
  if (!G || G.state !== 'playing' || !G.player.alive) return false;
  G.player.target = angle;
  return true;
}

// Add value to a snake, capped at the largest numeral. Returns the collapse, if any.
function growBy(G, s, amount) {
  const next = Math.min(s.value + amount, CFG2.MAX_VALUE);
  const collapse = setValue(s, next);
  s.symPts = symbolPoints(s);
  return collapse;
}

function bodyPops(G, s, collapse, eaten, now) {
  if (!collapse) return;
  G.pops.push({ x: s.x, y: s.y, text: popLabel(collapse.from, eaten, collapse.to), at: now });
}

// What a body symbol is worth: I is 1, V is 5, IV is 4, XL is 40.
function tokenValue(text) {
  return fromRoman(text);
}

// A crashed snake breaks apart in a small explosion. Each body symbol becomes a coin of
// its own value, thrown to a free point within SHATTER_RADIUS of where the head crashed.
// The coins carry their start point and time so the renderer can fly them out.
function shatter(G, s, now) {
  G.bursts.push({ x: s.x, y: s.y, at: now });
  const tokens = numeralTokens(s.value);
  for (let i = 0; i < tokens.length; i++) {
    if (G.snacks.length >= CFG2.MAX_SNACKS) break;
    const from = pointAtArc(s.trail, i * CFG2.SYMBOL_STEP);
    const spot = freePointNear(G, s, CFG2.SHATTER_RADIUS, 0.9);
    if (!spot) continue;
    G.snacks.push({ x: spot.x, y: spot.y, value: tokenValue(tokens[i].text), piece: true, fromX: from.x, fromY: from.y, born: now });
  }
}

// Put a crashed bot back as I, far enough from the player to be fair.
function respawnBot(G, bot) {
  const ph = G.player;
  for (let i = 0; i < 200; i++) {
    const p = randomPoint(G.rng, 2);
    if (Math.hypot(p.x - ph.x, p.y - ph.y) < CFG2.BOT_SAFE_DISTANCE) continue;
    if (!clearOfBodies(G, p, 2.5)) continue;
    const a = G.rng() * TAU;
    Object.assign(bot, {
      x: p.x, y: p.y, angle: a, target: a, trail: [{ x: p.x, y: p.y }],
      value: CFG2.START_VALUE, bodyLen: 0, targetLen: 0, prevSymPts: null, alive: true,
    });
    bot.symPts = symbolPoints(bot);
    return true;
  }
  return false;
}

// A bump: the victim's body is cut at the contact point. Its numeral keeps the symbols before
// the contact; the rest become coins where they lay, owned by the victim for RECLAIM_MS.
// Returns true if anything was cut.
function bumpBody(G, victim, arc, now) {
  const tokens = numeralTokens(victim.value);
  const n = tokens.length;
  let keep = 1;
  for (let k = 1; k < n; k++) if (k * CFG2.SYMBOL_STEP < arc) keep = k + 1;
  if (keep >= n) return false;
  for (let k = keep; k < n; k++) {
    if (G.snacks.length >= CFG2.MAX_SNACKS) break;
    const p = pointAtArc(victim.trail, k * CFG2.SYMBOL_STEP);
    G.snacks.push({ x: p.x, y: p.y, value: tokenValue(tokens[k].text), owner: victim.id, born: now });
  }
  const prefix = tokens.slice(0, keep).map(t => t.text).join('');
  setValue(victim, fromRoman(prefix));
  victim.symPts = symbolPoints(victim);
  return true;
}

// Can snake s eat snack sn at time `now`? Its own cut pieces are its own for RECLAIM_MS.
// After that, or for anyone else's pieces, the usual size rule applies.
function canEat(s, sn, now) {
  if (sn.owner === s.id) return true;
  if (sn.owner && now - sn.born < CFG2.RECLAIM_MS) return false;
  return sn.value >= minEatable(s.value);
}

// Advance the game by one step. Returns a list of events for the UI.
// Events: { type: 'eat' | 'collapse' | 'crash' | 'bump' | 'botRespawn' | 'over', ... }
function stepGame(G, now) {
  const events = [];
  if (G.state !== 'playing') return events;
  G.tickCount += 1;
  G.now = now;

  // 1. Aim. Bots choose; everyone turns toward their target, then moves.
  for (const bot of G.snakes) {
    if (!bot.isPlayer && bot.alive) bot.target = botChooseAim(bot, G);
  }
  for (const s of G.snakes) if (s.alive) turnToward(s);
  for (const s of G.snakes) if (s.alive) advanceSnake(s);

  // 2. Crashes and bumps, decided on the new positions.
  const { dead, bumps } = resolveTick(G.snakes);
  for (const b of bumps) {
    if (!b.victim.alive || !b.bumper.alive) continue;
    if (bumpBody(G, b.victim, b.arc, now)) {
      events.push({ type: 'bump', bumper: b.bumper.name, victim: b.victim.name, isPlayer: b.bumper.isPlayer });
    }
  }
  for (const d of dead) {
    const s = d.snake;
    s.alive = false;
    shatter(G, s, now);   // the crashed snake breaks apart, you or a bot
    if (s.isPlayer) {
      events.push({ type: 'crash', reason: d.reason });
    } else {
      s.respawnAt = now + CFG2.BOT_RESPAWN_MS;
      events.push({ type: 'crash', reason: d.reason, bot: s.name });
    }
  }
  if (!G.player.alive) {
    G.result = 'crash';
    G.state = 'over';
    events.push({ type: 'over', reason: 'crash' });
    return events;
  }

  // 3. Heads that touch a snack eat it and grow.
  for (const s of G.snakes) {
    if (!s.alive) continue;
    const idx = G.snacks.findIndex(sn => canEat(s, sn, now) && Math.hypot(sn.x - s.x, sn.y - s.y) < CFG2.EAT_R);
    if (idx < 0) continue;
    const eaten = G.snacks.splice(idx, 1)[0];
    const collapse = growBy(G, s, eaten.value);
    bodyPops(G, s, collapse, eaten.value, now);
    if (s.isPlayer) {
      events.push({ type: 'eat', value: eaten.value });
      if (collapse) events.push({ type: 'collapse', from: collapse.from, to: collapse.to });
    }
    if (G.snacks.length < G.snackTarget) addSnack(G);
  }

  // 4. Bots waiting to come back.
  for (const bot of G.snakes) {
    if (bot.isPlayer || bot.alive || now < bot.respawnAt) continue;
    if (respawnBot(G, bot)) events.push({ type: 'botRespawn', bot: bot.name });
  }

  // Keep the field stocked.
  while (G.snacks.length < G.snackTarget) if (!addSnack(G)) break;

  G.pops = G.pops.filter(p => now - p.at < 900);
  G.bursts = G.bursts.filter(b => now - b.at < CFG2.BURST_MS);
  return events;
}
