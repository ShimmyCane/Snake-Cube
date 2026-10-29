// ════════════════════════════════════════
//  GAME STATE
// ════════════════════════════════════════

// A snake is: { segs:[{col,row,val},...], dir:{dc,dr}, dead:bool,
//               isPlayer:bool, palette:{t,l,r,tx}, mergeTimer:int }
// segs[0] = head

let G = {}; // whole game state lives here

// ── Timer handles — live outside G so restart can't orphan them ──
let _TID = { pt:0, bt:0, hbt:0, gs:0, ft:0, st:0, x2:0, bst:0, rdr:0, inv:0, ct:0, wd:0, vac:0, clk:0 };

function clearTimers() {
  Object.keys(_TID).forEach(k => { clearTimeout(_TID[k]); clearInterval(_TID[k]); _TID[k]=0; });
}

// newSnake: col/row are floats, dir is {dx,dy} unit vector
// Each segment has {col, row, prevCol, prevRow, val}
// The snake also keeps a trail[] of recent head positions for body following
function newSnake(col, row, dx, dy, len, startVal, isPlayer, palette) {
  const segs = [];
  // Normalize dir
  const mag = Math.sqrt(dx*dx+dy*dy)||1;
  dx /= mag; dy /= mag;
  const TRAIL_SPACING = 1.0; // grid units between body segments

  if(isPlayer) {
    segs.push({ col, row, prevCol:col, prevRow:row, val:startVal });
  } else {
    let v = startVal;
    for(let i = 0; i < Math.min(len, 5); i++) {
      if(i > 0 && v <= 2) break;
      const sc = col - dx*i*TRAIL_SPACING;
      const sr = row - dy*i*TRAIL_SPACING;
      segs.push({ col:sc, row:sr, prevCol:sc, prevRow:sr, val:v });
      v = Math.max(2, v >> 1);
      if(i > 0 && v === segs[segs.length-2].val) break;
    }
  }

  const initAngle = Math.atan2(dy, dx);

  // Each segment tracks its own facing angle for linked-chain rotation
  const segAngles = segs.map(() => initAngle);

  // Trail: ring buffer of head positions — body segments follow this
  const TRAIL_LEN = 120;
  const trail = [];
  for(let i=0; i<TRAIL_LEN; i++) trail.push({col, row});

  return {
    segs, dir:{dx, dy},
    trail, trailHead:0,
    dead:false, isPlayer, palette,
    mergeTimer:0, mergeTick:0,
    tickAt: performance.now(),
    angle: initAngle,
    segAngles,   // per-segment facing angles, updated each tick
  };
}

function initGame() {
  const numBots = EXPERT_MODE ? CFG_EXPERT.NUM_BOTS : CFG.NUM_BOTS;
  const spawnMs = EXPERT_MODE ? CFG_EXPERT.BOT_SPAWN_MS : CFG.BOT_SPAWN_MS;
  const pc = Math.floor(CFG.COLS/2), pr = Math.floor(CFG.ROWS/2);

  // Dad's mode: find nearest non-wall spawn if the map centre is inside a building
  let safePC = pc, safePR = pr;
  if (typeof DAD !== 'undefined' && DAD.active && DAD._isWall(pc, pr)) {
    outer: for (let r = 1; r <= 30; r++) {
      for (let dc = -r; dc <= r; dc++) {
        for (let dr = -r; dr <= r; dr++) {
          if (Math.abs(dc) !== r && Math.abs(dr) !== r) continue; // ring only
          const tc = pc + dc, tr = pr + dr;
          if (tc >= 1 && tc < CFG.COLS - 1 && tr >= 1 && tr < CFG.ROWS - 1 && !DAD._isWall(tc, tr)) {
            safePC = tc; safePR = tr; break outer;
          }
        }
      }
    }
  }

  _worldMax = CFG.PLAYER_START_VAL || 2; // seed from starting value so food/size scales correctly
  const _bgPalIdx = (typeof ATHENA !== 'undefined' && ATHENA.active && G && G.bgPalIdx != null)
    ? G.bgPalIdx : Math.floor(Math.random() * LEVEL_BG.length);
  _terrainSeed = Math.random() * Math.PI * 6;
  G = {
    player: newSnake(safePC, safePR, 1, 0, CFG.PLAYER_LEN, CFG.PLAYER_START_VAL || 2, true, PLAYER_PAL),
    bots: [],
    food: [],
    specials: [],
    score: 0,
    level: 0,
    levelSpeedMult: 1.0,
    boostUntil: 0,
    burstAt: 0,
    bgPalIdx: _bgPalIdx,
    timeLeft: CFG.ROUND_SEC || 9999, // 0 = unlimited — use 9999 as working counter
    spawnCountdown: Math.round(spawnMs / 1000),
    running: true,
    paused: false,
    camC: safePC, camR: safePR,
    tgtC: safePC, tgtR: safePR,
    pendingDir: {dc:1, dr:0},
    botDensity: (G && G.botDensity != null) ? G.botDensity : 1.0,
    hooks: [],
    tailBullets: [],
  };
  showJoystickUI(true);

  // initial bots — spread around the map, fill to 50% of density-adjusted max
  const initBotCount = Math.max(
    EXPERT_MODE ? CFG_EXPERT.BOT_MIN : CFG.BOT_MIN,
    Math.ceil(Math.round((EXPERT_MODE ? CFG_EXPERT.BOT_MAX : CFG.BOT_MAX) * DENSITY_MULT) * 0.5)
  );
  const actualInit = Math.max(numBots, initBotCount);
  for(let i = 0; i < actualInit; i++) {
    const angle = (i / actualInit) * Math.PI * 2;
    const dist = 30 + Math.floor(Math.random() * 20);
    let bc = Math.max(2, Math.min(CFG.COLS-3, Math.round(pc + Math.cos(angle) * dist)));
    let br = Math.max(2, Math.min(CFG.ROWS-3, Math.round(pr + Math.sin(angle) * dist)));
    if (typeof DAD !== 'undefined' && DAD.active && DAD._isWall(bc, br)) {
      for (let t = 0; t < 20; t++) {
        const tc = 2 + Math.floor(Math.random() * (CFG.COLS - 4));
        const tr = 2 + Math.floor(Math.random() * (CFG.ROWS - 4));
        if (!DAD._isWall(tc, tr)) { bc = tc; br = tr; break; }
      }
    }
    const botAngle = angle + Math.PI; // face toward center
    const bot = newSnake(bc, br, Math.cos(botAngle), Math.sin(botAngle), CFG.BOT_LEN, CFG.PLAYER_START_VAL || 2, false, BOT_PAL[i%BOT_PAL.length]);
    bot.name = pickCity('us'); // early bots always US cities
    G.bots.push(bot);
  }

  for(let i = 0; i < 4; i++) spawnFood();

  clearTimers();
  // Watchdog: if game appears hung (no playerTick for >2s), recover by re-scheduling
  let _lastPlayerTickAt = performance.now();
  _TID.wd = setInterval(() => {
    if(!G.running) return;
    if(performance.now() - _lastPlayerTickAt > 2000) {
      console.warn('[watchdog] playerTick stalled — rescheduling');
      clearTimeout(_TID.pt);
      schedulePlayerTick();
    }
  }, 1000);

  function schedulePlayerTick() {
    const ms = Math.max(MIN_TICK_MS, snakeTickMs(G.player));
    _TID.pt = setTimeout(() => {
      if(!G.running) return;
      _lastPlayerTickAt = performance.now();
      playerTick();
      schedulePlayerTick();
    }, ms);
  }
  function scheduleBotTick() {
    const ms = Math.max(MIN_TICK_MS, Math.round(CFG.TICK_MS * (G.levelSpeedMult||1) / CFG.BOT_SPEED));
    _TID.bt = setTimeout(() => {
      if(!G.running) return;
      G.bots.forEach(b => { b._tickMs = ms; });
      botTick();
      scheduleBotTick();
    }, ms);
  }
  // Human guest bots tick at player rate, independent of G.player.dead
  function scheduleHumanBotTick() {
    const ms = Math.max(MIN_TICK_MS, snakeTickMs(G.player));
    _TID.hbt = setTimeout(() => {
      if(!G.running) return;
      const now_h = performance.now();
      for(const b of G.bots) {
        if(b.isHuman && !b.dead) { stepSnake(b); b.tickAt = now_h; }
      }
      scheduleHumanBotTick();
    }, ms);
  }
  schedulePlayerTick();
  scheduleBotTick();
  scheduleHumanBotTick();
  _TID.ft  = setInterval(spawnFood,     CFG.FOOD_MS);
  _TID.st  = setInterval(spawnBotWave,  spawnMs);
  _TID.x2  = setInterval(spawnX2,       CFG.X2_INTERVAL_MS);
  _TID.bst = setInterval(spawnBoost,    CFG.BOOST_INTERVAL_MS);
  _TID.rdr = setInterval(spawnRadar,    CFG.RADAR_INTERVAL_MS);
  _TID.inv = setInterval(spawnInvinc,   CFG.INVINC_INTERVAL_MS);
  _TID.vac = setInterval(spawnVacuum,   CFG.VACUUM_INTERVAL_MS);
  _TID.clk = setInterval(spawnClock,    CFG.CLOCK_INTERVAL_MS);
  _TID.ct  = setInterval(() => {
    if(G.paused) return;
    G.timeLeft--;
    G.spawnCountdown--;
    if(G.spawnCountdown <= 0) G.spawnCountdown = Math.round(spawnMs / 1000);
    updateHUD();
    if(G.timeLeft <= 0 && CFG.ROUND_SEC) endGame("Time's up!", false);
  }, 1000);

  updateHUD();
}


function spawnBotWave() {
  if(!G.running) return;
  const botMax = Math.round((EXPERT_MODE ? CFG_EXPERT.BOT_MAX : CFG.BOT_MAX) * DENSITY_MULT);
  // Population ramp: 50% at start, reaching 100% over 90 seconds
  const elapsed = CFG.ROUND_SEC > 0 ? CFG.ROUND_SEC - G.timeLeft : 9999 - G.timeLeft;
  const rampT = Math.min(1, elapsed / 90);
  const targetPct = 0.5 + 0.5 * rampT;
  const target = Math.ceil(botMax * targetPct);
  const alive = G.bots.filter(b=>!b.dead).length;
  const toSpawn = Math.min(4, target - alive);
  for(let s=0; s<Math.max(0,toSpawn); s++) spawnBot();
}

function spawnBot() {
  if(!G.running) return;
  const playerHeadVal = G.player.dead ? 2 : G.player.segs[0].val;

  let startVal;
  if(EXPERT_MODE) {
    // Expert: 2x–8x player head, pick a random power-of-2 in that range
    const minV = playerHeadVal * CFG_EXPERT.DIFF_MIN;
    const maxV = playerHeadVal * CFG_EXPERT.DIFF_MAX;
    const minExp = Math.ceil(Math.log2(Math.max(2, minV)));
    const maxExp = Math.floor(Math.log2(Math.max(2, maxV)));
    const exp = minExp + Math.floor(Math.random() * Math.max(1, maxExp - minExp + 1));
    startVal = Math.pow(2, exp);
  } else {
    const target = playerHeadVal * CFG.DIFFICULTY;
    startVal = VALS.reduce((a,b) => Math.abs(b-target)<Math.abs(a-target)?b:a, 2);
  }

  const ph = G.player.segs[0];
  let col, row, attempts = 0;
  do {
    col = 2 + Math.floor(Math.random()*(CFG.COLS-4));
    row = 2 + Math.floor(Math.random()*(CFG.ROWS-4));
    attempts++;
  } while(attempts < 20 && (Math.abs(col-ph.col)+Math.abs(row-ph.row) < 12 ||
    (typeof DAD !== 'undefined' && DAD.active && DAD._isWall(col, row))));

  const spawnAngle = Math.random() * Math.PI * 2;
  const pal = BOT_PAL[Math.floor(Math.random()*BOT_PAL.length)];
  const len = Math.max(3, Math.round(Math.log2(startVal)) + 2);
  const bot = newSnake(col, row, Math.cos(spawnAngle), Math.sin(spawnAngle), len, startVal, false, pal);
  // Name tier by world size — US cities early, world cities when things get big
  const worldTier = _worldMax >= 1024 ? 'world' : 'us';
  bot.name = pickCity(typeof ATHENA !== 'undefined' && ATHENA.active && ATHENA.level >= 3 ? 'world' : worldTier);
  G.bots.push(bot);
}

// ── Food ──
function minSnackVal() {
  // Minimum snack = worldMax/64 — always edible by the weakest player
  return Math.max(2, Math.pow(2, Math.floor(Math.log2(Math.max(2, _worldMax / 64)))));
}
// Median head value of the live bots — the "typical" snake on the board.
function typicalBotVal() {
  const vals = (G.bots || []).filter(b => !b.dead && b.segs.length).map(b => b.segs[0].val).sort((a, b) => a - b);
  return vals.length ? vals[Math.floor(vals.length / 2)] : 2;
}
// True when the player's head is DOMINANCE_RATIO × the typical bot head or more.
function playerDominant() {
  if(!G.player || G.player.dead || !G.player.segs.length) return false;
  return G.player.segs[0].val >= typicalBotVal() * CFG.DOMINANCE_RATIO;
}
function spawnFood() {
  if(!G || !G.food) return;
  const fieldMax = CFG.FOOD_FIELD_MAX;
  if(G.food.length >= fieldMax) return;
  // Dominant player: feed everyone else faster, with bigger snacks, so the field stays worth eating
  const dominant = playerDominant();
  const deficit = fieldMax - G.food.length;
  const count = Math.max(1, Math.round(deficit * CFG.FOOD_BATCH_PCT)) * (dominant ? CFG.DOMINANCE_FOOD_MULT : 1);
  // Fast occupation check: random probe, max 20 tries per food item
  const occ = new Set();
  allSnakes().forEach(sn => sn.segs.forEach(s => occ.add(s.col+','+s.row)));
  G.food.forEach(f => occ.add(f.col+','+f.row));
  const loFood = minSnackVal();
  const hiFood = Math.max(loFood, Math.pow(2, Math.floor(Math.log2(Math.max(2, _worldMax / (dominant ? 4 : 16))))));
  const logRange = Math.log2(Math.max(2, hiFood / loFood));
  for(let i=0; i<count && G.food.length<fieldMax; i++) {
    let col, row, found=false;
    for(let t=0;t<20;t++){
      col=1+Math.floor(Math.random()*(CFG.COLS-2));
      row=1+Math.floor(Math.random()*(CFG.ROWS-2));
      if(!occ.has(col+','+row) && !(typeof DAD !== 'undefined' && DAD.active && DAD._isWall(col, row))){found=true;break;}
    }
    if(!found) break;
    occ.add(col+','+row);
    const rawVal = loFood * Math.pow(2, Math.random() * logRange);
    const exp    = Math.round(Math.log2(Math.max(2, rawVal)));
    const val    = Math.max(loFood, Math.pow(2, Math.max(1, Math.min(exp, Math.log2(hiFood)))));
    G.food.push({col, row, val});
  }
  // Upgrade stale snacks below current minimum
  for(const f of G.food) { if(f.val < loFood) f.val = loFood; }
}

// ── Special food ──
function spawnX2() {
  if(!G || !G.running) return;
  G.specials = (G.specials||[]).filter(s=>s.type!=='x2');
  const pos = randomFreeCell();
  if(pos) G.specials.push({col:pos.col, row:pos.row, type:'x2', expiresAt: performance.now()+15000});
}
function spawnBoost() {
  if(!G || !G.running) return;
  G.specials = (G.specials||[]).filter(s=>s.type!=='boost');
  const pos = randomFreeCell();
  if(pos) G.specials.push({col:pos.col, row:pos.row, type:'boost', expiresAt: performance.now()+15000});
}
function spawnRadar() {
  if(!G || !G.running) return;
  G.specials = (G.specials||[]).filter(s=>s.type!=='radar');
  const pos = randomFreeCell();
  if(pos) G.specials.push({col:pos.col, row:pos.row, type:'radar', expiresAt: performance.now()+20000});
}
function spawnInvinc() {
  if(!G || !G.running) return;
  G.specials = (G.specials||[]).filter(s=>s.type!=='invinc');
  const pos = randomFreeCell();
  if(pos) G.specials.push({col:pos.col, row:pos.row, type:'invinc', expiresAt: performance.now()+20000});
}
function spawnVacuum() {
  if(!G || !G.running) return;
  if(!skillUnlocked('vacuum')) return;
  // G.specials = (G.specials||[]).filter(s=>s.type!=='vacuum');
  const pos = randomFreeCell();
  if(pos) G.specials.push({col:pos.col, row:pos.row, type:'vacuum', expiresAt: performance.now()+20000});
}
function spawnClock() {
  if(!G || !G.running) return;
  G.specials = (G.specials||[]).filter(s=>s.type!=='clock');
  const pos = randomFreeCell();
  if(pos) G.specials.push({col:pos.col, row:pos.row, type:'clock', expiresAt: performance.now()+20000});
}
// Used by Dad's mission rewards: drop a bonus tile at a given cell
function spawnBonusAt(col, row, type, ms) {
  G.specials.push({col, row, type, expiresAt: performance.now()+ms});
}
function randomFreeCell() {
  // Fast: random probe up to 30 attempts, avoid known occupied cells
  const occ = new Set();
  allSnakes().forEach(sn => sn.segs.forEach(s => occ.add(s.col+','+s.row)));
  (G.food||[]).forEach(f => occ.add(f.col+','+f.row));
  (G.specials||[]).forEach(s => occ.add(s.col+','+s.row));
  for(let i=0;i<30;i++){
    const col=2+Math.floor(Math.random()*(CFG.COLS-4));
    const row=2+Math.floor(Math.random()*(CFG.ROWS-4));
    if(!occ.has(col+','+row) && !(typeof DAD !== 'undefined' && DAD.active && DAD._isWall(col, row))) return {col,row};
  }
  return null; // give up rather than scan full grid
}

function allSnakes() {
  const a = [];
  if(G.player && !G.player.dead) a.push(G.player);
  if(G.bots) G.bots.forEach(b => { if(!b.dead) a.push(b); });
  return a;
}

// ── Core move — free 360° float movement ──
// Cube width in world units = segScale * 0.88
// Spacing between centers = average of two adjacent cube widths (edge-touching)
const CUBE_UNIT = 0.88;

function segSpacing(sn, i) {
  // Use each segment's actual value for its physical size — prevents gaps mid-chain
  const valA = sn.segs[i-1]?.val ?? sn.segs[0]?.val ?? 2;
  const valB = sn.segs[i]?.val   ?? valA;
  const sA = segScale(valA, 0) * CUBE_UNIT;  // size of seg i-1
  const sB = segScale(valB, 0) * CUBE_UNIT;  // size of seg i
  return (sA + sB) * SPACING_MULT;
}

function stepSnake(sn) {
  if(sn.dead) return;

  const head = sn.segs[0];
  const {dx, dy} = sn.dir;

  // Advance head position by 1 unit in current direction
  let nc = head.col + dx;
  let nr = head.row + dy;

  // Wall bounce: reflect direction and clamp
  const MARGIN = 0.5;
  let ndx = dx, ndy = dy;
  if(nc < MARGIN)            { nc = MARGIN;            ndx = Math.abs(ndx); }
  if(nc > CFG.COLS-1-MARGIN) { nc = CFG.COLS-1-MARGIN; ndx = -Math.abs(ndx); }
  if(nr < MARGIN)            { nr = MARGIN;            ndy = Math.abs(ndy); }
  if(nr > CFG.ROWS-1-MARGIN) { nr = CFG.ROWS-1-MARGIN; ndy = -Math.abs(ndy); }
  if(ndx !== dx || ndy !== dy) {
    sn.dir = {dx:ndx, dy:ndy};
    sn.angle = Math.atan2(ndy, ndx);
  }
  // Dad's mode: building polygon collision — reflect off the blocking axis
  if(typeof DAD !== 'undefined' && DAD.active && DAD._isWall(nc, nr)) {
    const hitByX = DAD._isWall(head.col + ndx, head.row);  // X alone causes hit?
    const hitByY = DAD._isWall(head.col,        head.row + ndy);  // Y alone causes hit?
    if(hitByX && !hitByY) {
      // Hit a vertical wall — reflect X, slide in Y
      nc = head.col; nr = head.row + ndy; ndx = -ndx;
    } else if(!hitByX && hitByY) {
      // Hit a horizontal wall — reflect Y, slide in X
      nc = head.col + ndx; nr = head.row; ndy = -ndy;
    } else {
      // Corner or ambiguous — full reverse, stay put this tick
      nc = head.col; nr = head.row; ndx = -ndx; ndy = -ndy;
    }
    sn.dir = {dx: ndx, dy: ndy};
    sn.angle = Math.atan2(ndy, ndx);
  }

  // Athena: shrinking boundary + deco object collision
  if(typeof ATHENA !== 'undefined' && ATHENA.active) {
    athenaCheckBoundary(sn);
    if(sn.dead) return;
    athenaDecoCollision(sn);
  }

  // Push new head pos into trail ring buffer
  sn.trailHead = (sn.trailHead + 1) % sn.trail.length;
  sn.trail[sn.trailHead] = {col: nc, row: nr};

  // Check food — proximity based on head scale
  const myHeadScale = segScale(sn.segs[0].val, 0);
  const fi = G.food.findIndex(f => {
    const d = Math.hypot(f.col-nc, f.row-nr);
    return d <= myHeadScale * 0.75;
  });
  const ateFood = fi !== -1;
  let ateVal = 0;
  if(ateFood) {
    ateVal = G.food[fi].val;
    G.food.splice(fi, 1);
    if(sn.isPlayer) { G.score += ateVal; updateHUD(); }
    sn.lastEatTime = performance.now();
  }

  // Bots also pick up specials on proximity (x2 doubles their head, boost speeds them, radar ignored)
  if(!sn.isPlayer && G.specials) {
    const now2 = performance.now();
    for(let si = G.specials.length-1; si >= 0; si--) {
      const sp = G.specials[si];
      if(sp.expiresAt <= now2) continue;
      const d = Math.hypot(sp.col-nc, sp.row-nr);
      if(d <= myHeadScale * 0.75) {
        G.specials.splice(si, 1);
        if(sp.type === 'x2') { for(const seg of sn.segs) seg.val *= 2; }
        // boost and radar: bots ignore the effect but consume the item
        break;
      }
    }
  }

  // Move head, body segments follow trail with spacing
  const oldHeadCol = head.col, oldHeadRow = head.row;
  sn.segs[0].prevCol = oldHeadCol;
  sn.segs[0].prevRow = oldHeadRow;
  sn.segs[0].col = nc;
  sn.segs[0].row = nr;

  // Each body segment targets a trail position behind the head
  // Use fractional trail interpolation to eliminate integer-rounding gaps
  const trailLen = sn.trail.length;
  let cumulative = 0;
  for(let i = 1; i < sn.segs.length; i++) {
    const seg = sn.segs[i];
    // Always accumulate spacing (even for merging segs) so trailing segs stay tight
    cumulative += segSpacing(sn, i);
    if(seg._mergeTarget !== undefined) continue; // position driven by merge anim
    // Fractional trail lookup: interpolate between two adjacent trail samples
    const fIdx = cumulative;
    const iLo = Math.floor(fIdx);
    const iHi = iLo + 1;
    const frac = fIdx - iLo;
    const idxLo = (sn.trailHead - iLo + trailLen * 10) % trailLen;
    const idxHi = (sn.trailHead - iHi + trailLen * 10) % trailLen;
    const tpLo = sn.trail[idxLo];
    const tpHi = sn.trail[idxHi];
    seg.prevCol = seg.col;
    seg.prevRow = seg.row;
    seg.col = tpLo.col + (tpHi.col - tpLo.col) * frac;
    seg.row = tpLo.row + (tpHi.row - tpLo.row) * frac;
  }

  // If ate food, grow: add new tail segment at old tail position
  if(ateFood) {
    const tail = sn.segs[sn.segs.length-1];
    sn.segs.push({ col:tail.col, row:tail.row, prevCol:tail.col, prevRow:tail.row, val:ateVal });
    // Grow segAngles to match
    if(!sn.segAngles) sn.segAngles = [];
    sn.segAngles.push(sn.segAngles[sn.segAngles.length-1] ?? sn.angle);
  }

  // Collisions with other snakes — proximity using Euclidean distance
  const myScale = segScale(sn.segs[0].val, 0);
  const others = (G.player && G.player !== sn && !G.player.dead ? [G.player] : [])
    .concat((G.bots||[]).filter(b => b !== sn && !b.dead));

  const oldSegs = sn.segs.map(s=>({...s})); // snapshot for undo

  for(const other of others) {
    let hitIdx = -1;
    for(let i = 0; i < other.segs.length; i++) {
      const s = other.segs[i];
      const theirScale = segScale(other.segs[0].val, i);
      const threshold = (myScale + theirScale) * 0.45;
      const dist = Math.hypot(s.col - nc, s.row - nr);
      if(dist <= threshold) { hitIdx = i; break; }
    }
    if(hitIdx === -1) continue;

    const myHead = sn.segs[0].val;
    const hitVal = other.segs[hitIdx].val;
    // Invincibility: can eat anyone regardless of size
    const isInvinc = sn.isPlayer && G.invincUntil && performance.now() < G.invincUntil;
    const otherInvinc = other.isPlayer && G.invincUntil && performance.now() < G.invincUntil;

    if(otherInvinc && !isInvinc) { kill(sn, other); return; } // other player is invincible, we die
    if(isFriendlyFire(sn, other)) continue; // co-op: humans pass through each other
    if(isInvinc || myHead > hitVal) {
      if(hitIdx === 0) {
        // Ate the head! Body becomes loose food snacks scattered on the ground
        const bodySegs = other.segs.splice(1); // keep head for one frame, remove body
        other.segs[0].val = 0; // mark head as eaten
        other.dead = true;
        mpOnKill(sn, other);
        // Scatter all body segments as food on the map
        for(const bs of bodySegs) {
          if(G.food.length < CFG.FOOD_MAX * 2) { // allow temporary overflow
            G.food.push({ col: bs.col + (Math.random()-0.5)*0.5, row: bs.row + (Math.random()-0.5)*0.5, val: bs.val });
          }
        }
        // Eater only absorbs the head value
        absorbVals(sn, [hitVal]);
        sn.lastEatTime = performance.now();
        if(sn.isPlayer) { G.score += hitVal; updateHUD(); }
        if(other.isPlayer) {
          if(MP.enabled && MP.isHost && (MP.mode === 'competitive' || MP.mode === 'coop')) {
            mpHostDied(sn, hitVal);
          } else {
            endGame('You were destroyed!', true, hitVal);
          }
        }
      } else {
        // Ate a body segment — absorb from that point onward
        const eaten = other.segs.splice(hitIdx);
        absorbVals(sn, eaten.map(s => s.val));
        sn.lastEatTime = performance.now();
        if(sn.isPlayer) { G.score += eaten.reduce((a,s) => a + s.val, 0); updateHUD(); }
        if(other.segs.length === 0) {
          other.dead = true;
          if(other.isPlayer) {
            if(MP.enabled && MP.isHost && (MP.mode === 'competitive' || MP.mode === 'coop')) {
              mpHostDied(sn, 0);
            } else {
              endGame('You were destroyed!', true, 0);
            }
          }
        }
      }
    } else if(myHead === hitVal) {
      // Equal: restore head to old position
      sn.segs[0].col = oldHeadCol; sn.segs[0].row = oldHeadRow;
      return;
    } else {
      kill(sn, other); return;
    }

    if(sn.dead) return;
    break;
  }

  // Gradual merge: find the highest-value matching adjacent pair, merge rear toward front
  sn.mergeTick = (sn.mergeTick || 0) + 1;
  if(sn.mergeTick >= CFG.MERGE_EVERY) {
    sn.mergeTick = 0;
    if(!sn.merging) {
      // Find highest-value adjacent matching pair
      let bestI = -1, bestVal = -1;
      for(let i = 0; i < sn.segs.length-1; i++) {
        if(sn.segs[i].val === sn.segs[i+1].val && !sn.segs[i+1]._mergeTarget) {
          if(sn.segs[i].val > bestVal) { bestVal = sn.segs[i].val; bestI = i; }
        }
      }
      if(bestI >= 0) {
        sn.segs[bestI+1]._mergeTarget = bestI;
        sn.segs[bestI+1]._mergeT = 0;
        sn.merging = true;
      }
    }
  }

  // Advance any active merges
  if(sn.merging) {
    let anyMerging = false;
    for(let i = sn.segs.length-1; i >= 1; i--) {
      const seg = sn.segs[i];
      if(seg._mergeTarget === undefined) continue;
      anyMerging = true;
      seg._mergeT = Math.min(1, (seg._mergeT||0) + MERGE_SPEED);
      const tgt = sn.segs[seg._mergeTarget];
      if(!tgt) { delete seg._mergeTarget; delete seg._mergeT; continue; }
      // Interpolate position toward target
      seg.col = seg.col + (tgt.col - seg.col) * 0.25;
      seg.row = seg.row + (tgt.row - seg.row) * 0.25;
      if(seg._mergeT >= 1) {
        // Combine: double the target value
        tgt.val *= 2;
        if(sn.isPlayer) { G.score += tgt.val; updateHUD(); }
        sn.segs.splice(i, 1);
        sn.merging = false;
        // Check if head needs updating
        if(seg._mergeTarget === 0) showFlash && sn.isPlayer && showFlash('MERGE! '+fmtVal(tgt.val), tgt.val > 64 ? '#ffcc00' : '#00f5c4');
        break;
      }
    }
    if(!anyMerging) sn.merging = false;
  }

  // Enforce head is always max
  if(!sn.merging) {
    const vals = sn.segs.map(s => s.val).sort((a,b) => b-a);
    for(let i = 0; i < sn.segs.length; i++) sn.segs[i].val = vals[i];
  }

  // ── Propagate per-segment facing angles (linked-chain, ±15° constraint) ──
  // Head angle = snake's travel angle. Each body segment follows the one ahead,
  // clamped to MAX_SEG_BEND radians difference.
  const MAX_SEG_BEND = Math.PI / 12; // 15°
  if(!sn.segAngles) sn.segAngles = sn.segs.map(() => sn.angle);
  // Ensure array length matches segs
  while(sn.segAngles.length < sn.segs.length) sn.segAngles.push(sn.angle);
  sn.segAngles[0] = sn.angle;
  for(let i = 1; i < sn.segs.length; i++) {
    const parentAngle = sn.segAngles[i-1];
    const cur = sn.segAngles[i];
    // Clamp difference to ±MAX_SEG_BEND
    let diff = ((parentAngle - cur) % (Math.PI*2) + Math.PI*3) % (Math.PI*2) - Math.PI;
    diff = Math.max(-MAX_SEG_BEND, Math.min(MAX_SEG_BEND, diff));
    sn.segAngles[i] = cur + diff * 0.35; // lag factor — body lags behind head changes
  }
}

// Append absorbed values as new tail segments on the eater
function absorbVals(sn, vals) {
  const tail = sn.segs[sn.segs.length-1];
  for(const v of vals) {
    sn.segs.push({ col: tail.col, row: tail.row, val: v });
  }
}

function kill(sn, by) {
  if(sn.dead) return;
  const headVal = sn.segs.length ? sn.segs[0].val : 0; // capture before segs cleared
  sn.dead = true;
  for(let i=0; i<sn.segs.length; i+=2) {
    if(G.food.length < CFG.FOOD_MAX)
      G.food.push({col:sn.segs[i].col, row:sn.segs[i].row, val:sn.segs[i].val});
  }
  if(sn.isPlayer) {
    if(MP.enabled && MP.isHost && (MP.mode === 'competitive' || MP.mode === 'coop')) {
      mpHostDied(by, headVal);
    } else {
      endGame(by ? 'A bigger snake got you!' : 'You were destroyed!', true, headVal);
    }
  }
}

// ── Ticks ──
function playerTick() {
  if(!G.running || G.paused || G.player.dead) return;

  // Steer based on input (360° continuous)
  steerPlayer();

  // Check & consume expired specials
  const now = performance.now();
  G.specials = G.specials.filter(s => s.expiresAt > now);

  // Check special food pickup (proximity same as regular food)
  const p = G.player;
  const head = p.segs[0];
  const myScale = segScale(head.val, 0);
  for(let i = G.specials.length-1; i >= 0; i--) {
    const sp = G.specials[i];
    const dist = Math.abs(sp.col - head.col) + Math.abs(sp.row - head.row);
    if(dist <= myScale * 0.7) {
      G.specials.splice(i, 1);
      if(sp.type === 'x2') {
        for(const seg of p.segs) seg.val *= 2;
        showFlash('✕2 ALL BLOCKS!', '#ffcc00');
      } else if(sp.type === 'boost') {
        G.boostUntil = now + CFG.BOOST_DURATION_MS;
        showFlash('⚡ SPEED BOOST!', '#00f5c4');
      } else if(sp.type === 'radar') {
        G.radarUntil = now + 15000;
        showFlash('📡 RADAR ACTIVE!', '#ff6b35');
      } else if(sp.type === 'invinc') {
        G.invincUntil = now + CFG.INVINC_DURATION_MS;
        showFlash('⚪ INVINCIBLE! 10s', '#ffffff');
      } else if(sp.type === 'vacuum') {
        G.vacuumUntil = now + CFG.VACUUM_DURATION_MS;
        G.boostUntil = now + CFG.VACUUM_DURATION_MS; // speed bonus
        showFlash('🌀 VACUUM ACTIVE!', '#4488ff');
      } else if(sp.type === 'clock') {
        G.timeLeft += CFG.CLOCK_BONUS_SEC;
        showFlash('⏱ +' + CFG.CLOCK_BONUS_SEC + 's', '#ff6b35');
      }
    }
  }

  stepSnake(G.player);
  G.player.tickAt = performance.now();

  // Level-up check — milestones at 1K, 1M, 1B
  if(p.segs.length && !p.dead) {
    const headVal = p.segs[0].val;
    const MILESTONES = [1000, 1000000, 1000000000];
    const newLevel = MILESTONES.filter(m => headVal >= m).length;
    if(newLevel > (G.level || 0)) {
      G.level = newLevel;
      if(!(typeof ATHENA !== 'undefined' && ATHENA.active)) {
        G.levelSpeedMult = Math.pow(CFG.LEVEL_SPEED_MULT, G.level);
        const labels = ['1K','1M','1B'];
        showFlash(`🚀 ${labels[newLevel-1]}! WORLD SPEEDS UP!`, '#ff6b35');
      }
    }
  }
}

function botTick() {
  if(!G.running || G.paused) return;
  const now = performance.now();
  G.specials = G.specials.filter(s => s.expiresAt > now); // prune expired
  for(let i=0; i<G.bots.length; i++) {
    const bot = G.bots[i];
    if(bot.dead || bot.isHuman) continue; // human bots stepped in playerTick at player rate
    steerBot(bot);
    stepSnake(bot);
    bot.tickAt = now;
    // Bots pick up specials
    if(bot.segs.length) {
      const bh = bot.segs[0];
      const bScale = segScale(bh.val, 0);
      for(let si = G.specials.length-1; si >= 0; si--) {
        const sp = G.specials[si];
        const dist = Math.hypot(sp.col - bh.col, sp.row - bh.row);
        if(dist <= bScale * 0.7) {
          G.specials.splice(si, 1);
          if(sp.type === 'x2') { for(const seg of bot.segs) seg.val *= 2; }
          if(sp.type === 'invinc') { bot.invincUntil = performance.now() + CFG.INVINC_DURATION_MS; }
          // boost/radar ignored by bots
        }
      }
    }
  }
  // Prune dead bots every tick to keep array lean
  if(G.bots.length > 60) G.bots = G.bots.filter(b=>!b.dead);
}

function steerBot(bot) {
  const head = bot.segs[0];
  const myVal = head.val;

  const snakes = (G.player&&!G.player.dead?[G.player]:[])
    .concat(G.bots.filter(b=>b!==bot&&!b.dead));

  let prey=null, preyDsq=Infinity;
  let threat=null, threatDsq=Infinity;
  let tailTarget=null, tailDsq=Infinity;
  const chaseRangeSq = (CFG.BOT_CHASE_RANGE||96)**2;
  const snipeRangeSq = ((CFG.BOT_RANGE||56)*2)**2;

  for(const o of snakes) {
    const oh = o.segs[0];
    const dsq = (oh.col-head.col)**2 + (oh.row-head.row)**2;
    if(oh.val < myVal && dsq < chaseRangeSq && dsq < preyDsq)   { prey=oh;  preyDsq=dsq; }
    if(oh.val > myVal && dsq < chaseRangeSq && dsq < threatDsq) { threat=oh; threatDsq=dsq; }
    if(o.segs.length > 2) {
      const tail = o.segs[o.segs.length-1];
      const tdq = (tail.col-head.col)**2 + (tail.row-head.row)**2;
      if(tail.val <= myVal && tdq < snipeRangeSq && tdq < tailDsq) {
        tailTarget=tail; tailDsq=tdq;
      }
    }
  }

  // Growth-first: scan for food/specials in BOT_FOOD_SCAN_MULT × chase range
  const foodScanRangeSq = ((CFG.BOT_FOOD_SCAN_MULT||2.0) * (CFG.BOT_CHASE_RANGE||96)) ** 2;

  let foodT=null, foodScore=-Infinity, foodDsq=Infinity;
  for(const f of G.food) {
    const dsq=(f.col-head.col)**2+(f.row-head.row)**2;
    if(dsq > foodScanRangeSq) continue;
    const sc = f.val / (Math.sqrt(dsq)+1);
    if(sc > foodScore){ foodT=f; foodScore=sc; foodDsq=dsq; }
  }

  let bonusT=null, bonusDsq=Infinity;
  const now_b = performance.now();
  for(const sp of (G.specials||[])) {
    if(sp.expiresAt <= now_b) continue;
    const dsq=(sp.col-head.col)**2+(sp.row-head.row)**2;
    if(dsq < foodScanRangeSq && dsq < bonusDsq){ bonusT=sp; bonusDsq=dsq; }
  }

  // Growth-first scoring: specials >> snacks >> opportunistic kills
  const bonusScore = bonusT     ? 200000 / (Math.sqrt(bonusDsq)+1) : -Infinity;
  const snackScore = foodT      ? foodScore * 400                   : -Infinity;
  const snipeScore = tailTarget ?   6000   / (Math.sqrt(tailDsq)+1) : -Infinity;
  const preyScore  = prey       ?   3000   / (Math.sqrt(preyDsq)+1) : -Infinity;

  let targetAngle = bot.angle ?? Math.atan2(bot.dir.dy, bot.dir.dx);
  // Flee only when threat is very close (50% of BOT_RANGE); bots brave risk for food
  const fleeThresh = (CFG.BOT_RANGE||56) * 0.5;

  if(threat && threatDsq < fleeThresh**2) {
    // Still brave a nearby bonus or snack rather than fleeing
    if(bonusT && bonusDsq < threatDsq * 0.7) {
      targetAngle = Math.atan2(bonusT.row-head.row, bonusT.col-head.col);
    } else if(foodT && foodDsq < threatDsq * 0.4) {
      targetAngle = Math.atan2(foodT.row-head.row, foodT.col-head.col);
    } else {
      targetAngle = Math.atan2(head.row - threat.row, head.col - threat.col);
    }
  } else {
    const best = Math.max(bonusScore, snackScore, snipeScore, preyScore);
    if(best > -Infinity) {
      if     (bonusScore >= best) targetAngle = Math.atan2(bonusT.row-head.row,     bonusT.col-head.col);
      else if(snackScore >= best) targetAngle = Math.atan2(foodT.row-head.row,      foodT.col-head.col);
      else if(snipeScore >= best) targetAngle = Math.atan2(tailTarget.row-head.row, tailTarget.col-head.col);
      else if(preyScore  >= best) targetAngle = Math.atan2(prey.row-head.row,       prey.col-head.col);
    } else {
      targetAngle = (bot.angle||0) + (Math.random()-0.5)*0.25; // wander
    }
  }

  // Wall avoidance
  const EDGE = 4;
  if(head.col < EDGE)            targetAngle = lerpAngle(targetAngle, 0, 0.5);
  if(head.col > CFG.COLS-1-EDGE) targetAngle = lerpAngle(targetAngle, Math.PI, 0.5);
  if(head.row < EDGE)            targetAngle = lerpAngle(targetAngle, Math.PI/2, 0.5);
  if(head.row > CFG.ROWS-1-EDGE) targetAngle = lerpAngle(targetAngle, -Math.PI/2, 0.5);

  const curAngle = bot.angle ?? Math.atan2(bot.dir.dy, bot.dir.dx);
  const newAngle = lerpAngle(curAngle, targetAngle, BOT_TURN_SPEED);
  bot.angle = newAngle;
  bot.dir = { dx: Math.cos(newAngle), dy: Math.sin(newAngle) };

  // Bot hook: occasionally fire at nearby smaller snakes
  maybeBotHook(bot);
  updateBotHook(bot);
}

// ── Flash notifications ──
let _flashMsg='', _flashColor='#fff', _flashUntil=0;
function showFlash(msg, color) {
  _flashMsg = msg; _flashColor = color;
  _flashUntil = performance.now() + 2500;
}

// ── End / HUD ──
function endGame(reason, loss, knownHeadVal) {
  if(!G.running) return;
  G.running = false;
  // read before Athena cleanup below; family-scores.js may be missing if its script failed
  const gameInfo = typeof currentGameMode === 'function' ? currentGameMode() : { mode: 'felix', map: null };
  clearTimers();
  showJoystickUI(false);
  if(typeof ATHENA !== 'undefined' && ATHENA.active) athenaCleanup();
  const headVal = knownHeadVal !== undefined ? knownHeadVal
    : (G.player && G.player.segs.length ? G.player.segs[0].val : 0);
  let calculatedStart = headVal / 64;
  CFG.PLAYER_START_VAL = Math.max(2, Math.floor(calculatedStart));
  const date = new Date().toLocaleDateString('en-GB',{day:'2-digit',month:'short'});
  saveHS({score: headVal, date});       // local cache
  document.getElementById('ot').textContent = loss ? 'GAME OVER' : "TIME'S UP!";
  document.getElementById('os').textContent = `Head: ${fmtVal(headVal)}`;
  document.getElementById('or').textContent = reason;
  if (typeof submitGameScore === 'function') submitGameScore(headVal, gameInfo).catch(() => {}).then(() => showBoard('hsb'));
  else renderHS('hsb', loadHS());
  setTimeout(()=>document.getElementById('s-over').classList.remove('hidden'), 700);
}

function updateHUD() {
  if(!G) return;
  const spEl = document.getElementById('spv');
  if(spEl) spEl.textContent = G.spawnCountdown > 0 ? G.spawnCountdown+'s' : '!';
  const el=document.getElementById('tv');
  if(!CFG.ROUND_SEC) {
    el.textContent='∞';
    el.classList.remove('urgent');
  } else {
    const m=Math.floor(G.timeLeft/60), s=G.timeLeft%60;
    el.textContent=`${m}:${String(s).padStart(2,'0')}`;
    el.classList.toggle('urgent',G.timeLeft<=30);
  }
  updateLeaderboard();
}

// ── High scores ──
function loadHS(){ try{return JSON.parse(localStorage.getItem('sn2048')||'[]')}catch{return[]} }
function saveHS(e){ let h=loadHS();h.push(e);h.sort((a,b)=>b.score-a.score);h=h.slice(0,8);localStorage.setItem('sn2048',JSON.stringify(h));return h; }
function renderHS(id,hs){
  const el=document.getElementById(id); if(!el)return;
  el.innerHTML=hs.slice(0,5).map((h,i)=>`<tr><td>${i+1}</td><td style="color:${i===0?'#ffcc00':'#e8e8f0'}">${fmtVal(h.score)}</td><td style="color:#555570">${h.date}</td></tr>`).join('');
}
