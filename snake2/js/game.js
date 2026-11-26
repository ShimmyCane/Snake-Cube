// ════════════════════════════════════════════════════════════════════
//  GAME — state, one step, snacks, bots, crashes. Pure, no DOM. FreePlay: no clock, no goal,
//  no edge. The UI calls createGame(), setPlayerAim(), stepGame().
// ════════════════════════════════════════════════════════════════════

// Bots start on a ring round the player's start, each turning round it.
function botStart(i, n) {
  const a = (i / n) * TAU + 0.3;
  return { x: Math.cos(a) * CFG2.BOT_START_R, y: Math.sin(a) * CFG2.BOT_START_R, a: a + Math.PI / 2 };
}

function createGame(opts) {
  const seed = opts.seed != null ? opts.seed : Date.now();
  const rng = makeRng(seed);
  const player = newSnake2({
    id: 'player', name: 'Felix', isPlayer: true, colour: PLAYER_COLOUR, x: 0, y: 0, angle: 0,
  });
  const botCount = Math.max(CFG2.BOTS_MIN, Math.min(CFG2.BOTS_MAX, opts.bots != null ? opts.bots : CFG2.BOTS));
  const bots = [];
  for (let i = 0; i < botCount; i++) {
    const b = botStart(i, botCount);
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
    cells: new Map(),            // artifacts of the world, cell by cell, made as they are first seen
    result: null,                // 'crash' when the player runs out of symbols
    tickCount: 0,
  };
  while (G.snacks.length < G.snackTarget) if (!addSnack(G)) break;
  return G;
}

// True if p is at least minDist from every trail point of a live snake (but not `skip`).
function clearOfBodies(G, p, minDist, skip) {
  for (const s of G.snakes) {
    if (!s.alive || s === skip) continue;
    for (const pt of s.trail) if (Math.hypot(pt.x - p.x, pt.y - p.y) < minDist) return false;
  }
  return true;
}

function nearSnack(G, p, minDist) {
  return G.snacks.some(sn => Math.hypot(sn.x - p.x, sn.y - p.y) < minDist);
}

// A free point within `radius` of centre c, clear of bodies, snacks and artifacts. Null if none turns up.
function freePoint(G, c, radius, minBody, skip) {
  for (let i = 0; i < 80; i++) {
    const p = randomPointNear(G.rng, c, radius);
    if (!clearOfBodies(G, p, minBody, skip) || nearSnack(G, p, 1.2) || obstacleAt(G, p.x, p.y, 0.6)) continue;
    return p;
  }
  return null;
}

// The tiers of snack the player can eat, smallest first: 1, 5, 10, 50, 100, … up to `lead`.
// Past M the tiers go on up the same pattern, so a big numeral still finds snacks to eat.
function snackTiersUpTo(lead) {
  const tiers = [];
  for (let p = 1; p <= lead; p *= 10) {
    tiers.push(p);
    if (5 * p <= lead) tiers.push(5 * p);
  }
  return tiers;
}

// A snake's leading symbol's value, e.g. 500 for D, 1000 for M, 4000 for IV̅.
function leadValue(value) {
  return numeralTokens(value)[0].value;
}

// The new snacks follow the player's size. The centre is about a tenth of the leading symbol,
// so a D (500) mostly finds L (50), and a C (100) mostly finds X (10). Sizes above the leading
// symbol never appear. Neighbouring sizes turn up less often, out to the set's spread.
function sampleSnackValue(G) {
  const lead = leadValue(G.player.value);
  const tiers = snackTiersUpTo(lead);
  const want = Math.max(1, lead / 10);
  let centre = 0;
  for (let i = 0; i < tiers.length; i++) if (tiers[i] <= want) centre = i;
  const spread = SNACK_SETS[G.snackSet].spread;
  const options = [];
  for (let i = Math.max(0, centre - spread); i <= Math.min(tiers.length - 1, centre + spread); i++) {
    options.push({ value: tiers[i], weight: Math.max(1, 4 - Math.abs(i - centre)) });
  }
  const total = options.reduce((sum, o) => sum + o.weight, 0);
  let roll = G.rng() * total;
  for (const o of options) {
    roll -= o.weight;
    if (roll < 0) return o.value;
  }
  return options[options.length - 1].value;
}

function addSnack(G, value) {
  const p = freePoint(G, G.player, CFG2.SNACK_SPAWN_R, 2.5);
  if (!p) return null;
  const snack = { x: p.x, y: p.y, value: value != null ? value : sampleSnackValue(G) };
  G.snacks.push(snack);
  return snack;
}

// Aim the player's head at an angle, in radians. The head faces it at the next step.
function setPlayerAim(G, angle) {
  if (!G || G.state !== 'playing' || !G.player.alive) return false;
  G.player.target = angle;
  return true;
}

// Add value to a snake. There is no cap: the numeral goes on. Returns the collapse, if any.
function growBy(G, s, amount) {
  const collapse = setValue(s, s.value + amount);
  s.symPts = symbolPoints(s);
  return collapse;
}

function bodyPops(G, s, collapse, eaten, now) {
  if (!collapse) return;
  G.pops.push({ x: s.x, y: s.y, text: popLabel(collapse.from, eaten, collapse.to), at: now });
}

// Coins for the body symbols from index `from` up to `to` (index 0 is the head). Each is a coin
// of its own value, thrown to a free point near the snake, and it flies out from where it was.
function dropSymbols(G, s, from, to, now) {
  const tokens = numeralTokens(s.value);
  for (let k = from; k < Math.min(to, tokens.length); k++) {
    if (G.snacks.length >= CFG2.MAX_SNACKS) break;
    const at = pointAtArc(s.trail, k * CFG2.SYMBOL_STEP);
    const spot = freePoint(G, s, CFG2.SHATTER_RADIUS, 0.9, s);
    if (!spot) continue;
    G.snacks.push({ x: spot.x, y: spot.y, value: tokens[k].value, piece: true, fromX: at.x, fromY: at.y, born: now });
  }
}

// A snake that has run out of symbols breaks apart in a small explosion: every symbol is a coin.
function shatter(G, s, now) {
  G.bursts.push({ x: s.x, y: s.y, at: now });
  dropSymbols(G, s, 0, Infinity, now);
}

// A crash costs one or two symbols, from the head end. The lost symbols fall as coins, the head
// moves back to the first symbol left, and the numeral drops with them. A snake with no symbol
// left after the loss is dead. Returns { lostText, dead }.
function crashPenalty(G, s, now) {
  const tokens = numeralTokens(s.value);
  const want = 1 + Math.floor(G.rng() * CFG2.CRASH_LOSS_MAX);
  const lost = Math.min(want, tokens.length);
  const lostText = tokens.slice(0, lost).map(t => t.text).join('');
  dropSymbols(G, s, 0, lost, now);
  G.pops.push({ x: s.x, y: s.y, text: '−' + lostText, at: now });
  if (lost >= tokens.length) return { lostText, dead: true };

  // The head moves back onto the first symbol that is left, and the trail is cut to match.
  const arc = lost * CFG2.SYMBOL_STEP;
  const head = pointAtArc(s.trail, arc);
  s.trail = trailFrom(s.trail, arc);
  s.x = head.x;
  s.y = head.y;
  s.bodyLen = Math.max(0, s.bodyLen - arc);
  s.prevSymPts = null;
  setValue(s, tokensValue(tokens.slice(lost)));
  s.symPts = symbolPoints(s);
  s.grace = CFG2.CRASH_GRACE_TICKS;
  return { lostText, dead: false };
}

// Put a bot back as I, far enough from the player to be fair.
function respawnBot(G, bot) {
  const ph = G.player;
  for (let i = 0; i < 200; i++) {
    const p = randomPointNear(G.rng, ph, CFG2.BOT_SPAWN_R);
    if (Math.hypot(p.x - ph.x, p.y - ph.y) < CFG2.BOT_SAFE_DISTANCE) continue;
    if (!clearOfBodies(G, p, 2.5, bot) || obstacleAt(G, p.x, p.y, 1)) continue;
    const a = G.rng() * TAU;
    Object.assign(bot, {
      x: p.x, y: p.y, angle: a, target: a, trail: [{ x: p.x, y: p.y }],
      value: CFG2.START_VALUE, bodyLen: 0, targetLen: 0, prevSymPts: null, alive: true, grace: 0,
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
    G.snacks.push({ x: p.x, y: p.y, value: tokens[k].value, owner: victim.id, born: now });
  }
  setValue(victim, tokensValue(tokens.slice(0, keep)));
  victim.symPts = symbolPoints(victim);
  return true;
}

// Can snake s eat snack sn at time `now`? Any snake eats any snack, except that a bumped
// snake's own cut pieces belong to it for RECLAIM_MS: only it can take them during that time.
function canEat(s, sn, now) {
  if (sn.owner === s.id) return true;
  if (sn.owner && now - sn.born < CFG2.RECLAIM_MS) return false;
  return true;
}

// Advance the game by one step. Returns a list of events for the UI.
// Events: { type: 'eat' | 'collapse' | 'crash' | 'bump' | 'botRespawn' | 'over', ... }
function stepGame(G, now) {
  const events = [];
  if (G.state !== 'playing') return events;
  G.tickCount += 1;
  G.now = now;
  for (const s of G.snakes) if (s.grace > 0) s.grace -= 1;

  // 1. Aim. Bots choose; everyone turns toward their target, then moves.
  for (const bot of G.snakes) {
    if (!bot.isPlayer && bot.alive) bot.target = botChooseAim(bot, G);
  }
  for (const s of G.snakes) if (s.alive) turnToward(s);
  for (const s of G.snakes) if (s.alive) advanceSnake(s);

  // 2. Crashes and bumps, decided on the new positions. A bump cuts the victim first.
  const { crashes, bumps } = resolveTick(G.snakes, (x, y, margin) => obstacleAt(G, x, y, margin));
  for (const b of bumps) {
    if (!b.victim.alive || !b.bumper.alive) continue;
    if (bumpBody(G, b.victim, b.arc, now)) {
      events.push({ type: 'bump', bumper: b.bumper.name, victim: b.victim.name, isPlayer: b.bumper.isPlayer });
    }
  }
  for (const c of crashes) {
    const s = c.snake;
    if (!s.alive) continue;
    const { lostText, dead } = crashPenalty(G, s, now);
    if (dead) {
      s.alive = false;
      G.bursts.push({ x: s.x, y: s.y, at: now });
      if (!s.isPlayer) s.respawnAt = now + CFG2.BOT_RESPAWN_MS;
    }
    const e = { type: 'crash', reason: c.reason, lost: lostText, dead, isPlayer: s.isPlayer };
    if (!s.isPlayer) e.bot = s.name;
    events.push(e);
  }
  if (!G.player.alive) {
    G.result = 'crash';
    G.state = 'over';
    events.push({ type: 'over', reason: 'crash' });
    return events;
  }

  // 3. Heads that touch a snack eat it and grow. Snacks that have fallen far behind are taken off.
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
  G.snacks = G.snacks.filter(sn => Math.hypot(sn.x - G.player.x, sn.y - G.player.y) <= CFG2.SNACK_KEEP);

  // 4. Bots: one that has wandered out of sight starts again quietly, and one waiting to come back does.
  for (const bot of G.snakes) {
    if (bot.isPlayer) continue;
    if (bot.alive && Math.hypot(bot.x - G.player.x, bot.y - G.player.y) > CFG2.BOT_LEASH) {
      bot.alive = false;
      bot.respawnAt = now;
    }
    if (bot.alive || now < bot.respawnAt) continue;
    if (respawnBot(G, bot)) events.push({ type: 'botRespawn', bot: bot.name });
  }

  // Keep the field stocked.
  while (G.snacks.length < G.snackTarget) if (!addSnack(G)) break;

  G.pops = G.pops.filter(p => now - p.at < 900);
  G.bursts = G.bursts.filter(b => now - b.at < CFG2.BURST_MS);
  return events;
}
