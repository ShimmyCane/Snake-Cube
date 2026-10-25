// ══════════════════════════════════════════════════════
//  HOOK SYSTEM
// ══════════════════════════════════════════════════════

// Max distance a hook can travel (world units), recalculated at fire time
function _hookMaxDist() {
  // At 60fps hook ticks, HOOK_SPEED units/tick, HOOK_TRAVEL_SEC seconds
  return Math.round(CFG.HOOK_TRAVEL_SEC * (1000 / 60) * CFG.HOOK_SPEED);
}

function fireHook(sn) {
  if(!G || !G.running || sn.dead || !sn.segs.length) return;
  const now = performance.now();
  if(sn.hookCooldownUntil && now < sn.hookCooldownUntil) return;
  if(!G.hooks) G.hooks = [];
  if(G.hooks.some(h => h.firer === sn && !h._done)) return; // one at a time
  const head = sn.segs[0];
  const angle = sn.angle ?? 0;
  G.hooks.push({
    firer: sn,
    col: head.col, row: head.row,
    dx: Math.cos(angle), dy: Math.sin(angle),
    distTraveled: 0,
    maxDist: _hookMaxDist(),
    phase: 'flying',   // 'flying' | 'reeling' | 'done'
    target: null,
    _done: false,
  });
  sn.hookCooldownUntil = now + CFG.HOOK_COOLDOWN_MS;
}

function firePlayerHook() {
  if(!HOOK_ENABLED) return;
  if(!G || !G.running || !G.player || G.player.dead) return;
  if(MP.enabled && !MP.isHost) {
    // Guest: ask the host to fire the hook in the authoritative simulation
    if(MP.conns[0]) try { MP.conns[0].send({ type:'fire_hook' }); } catch(e) {}
    showFlash('🪝 HOOK!', '#ff6b35');
    return;
  }
  fireHook(G.player);
  showFlash('🪝 HOOK!', '#ff6b35');
}

let _lastHookTick = 0;
function tickHooks(now) {
  if(!G || !G.hooks || !G.hooks.length) return;
  if(now - _lastHookTick < 60) return; // ~16fps hook tick
  _lastHookTick = now;

  for(const h of G.hooks) {
    if(h._done || h.firer.dead) { h._done = true; continue; }

    if(h.phase === 'flying') {
      h.col += h.dx * CFG.HOOK_SPEED;
      h.row += h.dy * CFG.HOOK_SPEED;
      h.distTraveled += CFG.HOOK_SPEED;
      // Boundary or max range → recall
      if(h.col<0.5 || h.col>CFG.COLS-1.5 || h.row<0.5 || h.row>CFG.ROWS-1.5 ||
         h.distTraveled >= h.maxDist) { h._done = true; continue; }
      // Collision check
      const candidates = [G.player, ...(G.bots||[])].filter(s => {
        if(!s || s.dead || s === h.firer) return false;
        if(isFriendlyFire(h.firer, s)) return false;
        // Only hook snakes smaller than firer
        return (s.segs[0]?.val ?? 2) < (h.firer.segs[0]?.val ?? 2);
      });
      outer: for(const sn of candidates) {
        for(let si = 0; si < sn.segs.length; si++) {
          const s = sn.segs[si];
          if(Math.hypot(s.col - h.col, s.row - h.row) <= segScale(sn.segs[0].val, si) * 0.75 + 0.4) {
            h.phase  = 'reeling';
            h.target = sn;
            break outer;
          }
        }
      }
    } else if(h.phase === 'reeling') {
      const tgt = h.target;
      if(!tgt || tgt.dead || !tgt.segs.length) { h._done = true; continue; }
      const fHead = h.firer.segs[0];
      const tHead = tgt.segs[0];
      const dx = fHead.col - tHead.col, dy = fHead.row - tHead.row;
      const dist = Math.hypot(dx, dy);
      const step = CFG.HOOK_SPEED * CFG.HOOK_REEL_SPEED;
      if(dist > step + 0.5) {
        const r = step / dist;
        tHead.col += dx * r; tHead.row += dy * r;
        if(tHead.prevCol !== undefined) { tHead.prevCol = tHead.col; tHead.prevRow = tHead.row; }
        h.col = tHead.col; h.row = tHead.row;
      } else {
        // Eat: absorb target
        _hookEat(h.firer, tgt);
        h._done = true;
      }
    }
  }
  G.hooks = G.hooks.filter(h => !h._done);
}

function _hookEat(firer, target) {
  if(target.dead) return;
  const headVal = target.segs[0]?.val || 2;
  const bodySegs = target.segs.splice(1);
  target.dead = true;
  mpOnKill(firer, target);
  for(const bs of bodySegs) {
    if(G.food.length < CFG.FOOD_MAX * 2)
      G.food.push({col:bs.col+(Math.random()-0.5)*0.5, row:bs.row+(Math.random()-0.5)*0.5, val:bs.val});
  }
  absorbVals(firer, [headVal]);
  firer.lastEatTime = performance.now();
  if(firer.isPlayer) { G.score += headVal; updateHUD(); showFlash('🪝 HOOKED!', '#ff6b35'); }
  if(target.isPlayer) {
    if(MP.enabled && MP.isHost && (MP.mode === 'competitive' || MP.mode === 'coop')) mpHostDied(firer, headVal);
    else endGame('You were hooked!', true, headVal);
  }
}

function drawHooks(now) {
  if(!G || !G.hooks || !G.hooks.length) return;
  ctx.save();
  for(const h of G.hooks) {
    if(h._done || h.firer.dead || !h.firer.segs.length) continue;
    const fh  = h.firer.segs[0];
    const p1  = project3(fh.col, 0, fh.row);
    const p2  = project3(h.col,  0, h.row);
    if(!p1 || !p2) continue;
    const pal  = h.firer.palette || PLAYER_PAL;
    const col  = h.phase === 'reeling' ? '#ff6b35' : pal.t;
    // Rope line
    ctx.globalAlpha = 0.65;
    ctx.strokeStyle = col;
    ctx.lineWidth   = 2;
    ctx.setLineDash([5, 4]);
    ctx.beginPath(); ctx.moveTo(p1.x, p1.y); ctx.lineTo(p2.x, p2.y); ctx.stroke();
    ctx.setLineDash([]);
    // Tip diamond
    ctx.globalAlpha = 1;
    ctx.fillStyle   = col;
    ctx.beginPath();
    ctx.moveTo(p2.x,   p2.y-7);
    ctx.lineTo(p2.x+5, p2.y);
    ctx.lineTo(p2.x,   p2.y+7);
    ctx.lineTo(p2.x-5, p2.y);
    ctx.closePath(); ctx.fill();
  }
  ctx.restore();
}

// ── Cooldown display (H key / J key) ──
function drawActionCooldowns(now) {
  if(!G || !G.running || !G.player || G.player.dead) return;
  const items = [];
  if(HOOK_ENABLED) {
    const hookUntil = G.player.hookCooldownUntil || 0;
    const hookRem = Math.max(0, hookUntil - now);
    if(hookRem > 0) items.push({ label: `H ${(hookRem/1000).toFixed(1)}s`, color: '#ff6b35' });
    else items.push({ label: 'H READY', color: '#ff6b35' });
  }
  if(typeof ATHENA !== 'undefined' && ATHENA.active) {
    const jumpUntil = G.player.jumpCooldownUntil || 0;
    const jumpRem = Math.max(0, jumpUntil - now);
    if(jumpRem > 0) items.push({ label: `J ${(jumpRem/1000).toFixed(1)}s`, color: '#bf5fff' });
    else items.push({ label: 'J READY', color: '#bf5fff' });
  }
  if(CTRL_MODE !== 'joystick') {
    ctx.save();
    ctx.font = '0.65rem "Courier New", monospace';
    ctx.textAlign = 'center';
    const y = H - 22;
    const spacing = 100;
    const startX = W / 2 - (items.length - 1) * spacing / 2;
    items.forEach((item, i) => {
      ctx.fillStyle = item.color;
      ctx.globalAlpha = 0.75;
      ctx.fillText(item.label, startX + i * spacing, y);
    });
    ctx.restore();
  }
}

// ── Tail Bullet ──
function fireTailBullet() {
  if(!G || !G.running || !G.player || G.player.dead) return;
  if(!skillUnlocked('tail')) return;
  const p = G.player;
  if(p.segs.length < 2) { showFlash('No tail to fire!', '#ff4444'); return; }
  const now = performance.now();
  if(now < (p.tailBulletCooldownUntil || 0)) {
    const rem = Math.ceil((p.tailBulletCooldownUntil - now) / 1000);
    showFlash(`F ${rem}s`, '#ff4444');
    return;
  }
  const tailSeg = p.segs.pop();
  const angle = p.angle ?? 0;
  if(!G.tailBullets) G.tailBullets = [];
  G.tailBullets.push({
    col: tailSeg.col, row: tailSeg.row,
    dx: Math.cos(angle), dy: Math.sin(angle),
    val: tailSeg.val,
    firer: p,
    age: 0,
  });
  p.tailBulletCooldownUntil = now + CFG.TAIL_BULLET_COOLDOWN_MS;
  showFlash('🔥 TAIL FIRED!', '#ff4444');
}

function tickTailBullets(now) {
  if(!G || !G.tailBullets || !G.tailBullets.length) return;
  const toRemove = [];
  for(let bi = 0; bi < G.tailBullets.length; bi++) {
    const b = G.tailBullets[bi];
    b.col += b.dx * CFG.TAIL_BULLET_SPEED;
    b.row += b.dy * CFG.TAIL_BULLET_SPEED;
    b.age++;
    // Out of bounds
    if(b.col < 0 || b.col > CFG.COLS || b.row < 0 || b.row > CFG.ROWS || b.age > 180) {
      toRemove.push(bi); continue;
    }
    // Check decor objects (Athena mode)
    if(typeof ATHENA !== 'undefined' && ATHENA.active) {
      let hitDecor = false;
      for(let di = 0; di < ATHENA.decorObjects.length; di++) {
        const obj = ATHENA.decorObjects[di];
        if(Math.hypot(b.col - obj.col, b.row - obj.row) < obj.scale * 0.8) {
          obj.hp = (obj.hp || obj.maxHp || 3) - 1;
          if(obj.hp <= 0) {
            const types = ['x2', 'boost', 'radar', 'invinc'];
            const bonusType = types[Math.floor(Math.random() * types.length)];
            if(!G.specials) G.specials = [];
            G.specials.push({ col: obj.col, row: obj.row, type: bonusType, expiresAt: now + 20000 });
            ATHENA.decorObjects.splice(di, 1);
            showFlash('💥 OBJECT BROKEN!', '#ffcc00');
          } else {
            showFlash(`🔨 HIT! ${obj.hp} HP left`, '#ff8800');
          }
          toRemove.push(bi); hitDecor = true; break;
        }
      }
      if(hitDecor) continue;
    }
    // Check snake collisions
    const targets = [G.player, ...(G.bots||[])].filter(s => s && !s.dead && s !== b.firer && s.segs.length > 1);
    let hit = false;
    for(const sn of targets) {
      const head = sn.segs[0];
      if(Math.hypot(b.col - head.col, b.row - head.row) < segScale(head.val, 0) * 0.9) {
        // Hit head — remove all tail, leave only head
        const tailSegs = sn.segs.splice(1);
        for(const ts of tailSegs) {
          G.food.push({ col: ts.col + (Math.random()-0.5), row: ts.row + (Math.random()-0.5), val: ts.val });
        }
        showFlash('💥 TAIL STRIPPED!', '#ff4444');
        if(sn.isPlayer) showFlash('Your tail was stripped!', '#ff4444');
        hit = true; break;
      }
      // Check body segments
      for(let si = 1; si < sn.segs.length; si++) {
        const s = sn.segs[si];
        if(Math.hypot(b.col - s.col, b.row - s.row) < segScale(sn.segs[0].val, si) * 0.9) {
          const tailSegs = sn.segs.splice(si);
          for(const ts of tailSegs) {
            G.food.push({ col: ts.col + (Math.random()-0.5), row: ts.row + (Math.random()-0.5), val: ts.val });
          }
          showFlash('💥 TAIL HIT!', '#ff4444');
          hit = true; break;
        }
      }
      if(hit) break;
    }
    if(hit) toRemove.push(bi);
  }
  for(let i = toRemove.length - 1; i >= 0; i--) G.tailBullets.splice(toRemove[i], 1);
}

function drawTailBullets(now) {
  if(!G || !G.tailBullets || !G.tailBullets.length) return;
  ctx.save();
  for(const b of G.tailBullets) {
    const p = project3(b.col, 0.4, b.row);
    if(!p) continue;
    const c = gc(b.val);
    ctx.globalAlpha = 0.9;
    ctx.fillStyle = c.t;
    ctx.shadowColor = c.t;
    ctx.shadowBlur = 8;
    const sz = Math.max(4, 8 * (p.z ? 1/p.z * 200 : 1));
    ctx.beginPath();
    ctx.arc(p.x, p.y, sz, 0, Math.PI*2);
    ctx.fill();
  }
  ctx.restore();
}

// ── Vacuum effect ──
function tickVacuum(now) {
  if(!G || !G.vacuumUntil || now >= G.vacuumUntil) return;
  if(!G.player || G.player.dead || !G.player.segs.length) return;
  const ph = G.player.segs[0];
  const myVal = ph.val;
  const range = CFG.VACUUM_RANGE;
  // Suck in nearby food
  for(const f of (G.food||[])) {
    const d = Math.hypot(f.col - ph.col, f.row - ph.row);
    if(d < range && d > 0.1) {
      const speed = 0.3;
      f.col += (ph.col - f.col) / d * speed;
      f.row += (ph.row - f.row) / d * speed;
    }
  }
  // Suck in smaller bot tails
  for(const bot of (G.bots||[])) {
    if(bot.dead || !bot.segs.length) continue;
    if(bot.segs[0].val >= myVal) continue; // only smaller
    for(let si = bot.segs.length - 1; si >= 1; si--) {
      const s = bot.segs[si];
      const d = Math.hypot(s.col - ph.col, s.row - ph.row);
      if(d < range * 0.5) {
        const ripped = bot.segs.splice(si, 1)[0];
        G.food.push({ col: ripped.col, row: ripped.row, val: ripped.val });
        break;
      }
    }
  }
}

//new 2.5.3
// ── Bot hook AI: called from steerBot, low probability fire ──
function maybeBotHook(bot) {
  if(!HOOK_ENABLED) return;
  if(!G || !G.running || bot.dead || !bot.segs.length) return;

  const now = performance.now();

  // cooldown
  if(bot.hookCooldownUntil && now < bot.hookCooldownUntil) return;

  // already charging/firing
  if(bot.hookState === 'locking') return;

  // already has active hook
  if((G.hooks||[]).some(h => h.firer === bot && !h._done)) return;

  // rare chance per tick
  if(Math.random() > 0.008) return;

  const bh = bot.segs[0];
  const maxDist = _hookMaxDist() * 0.7;

  // find valid targets
  const candidates = [G.player, ...(G.bots||[])].filter(s => {
    if(!s || s.dead || s === bot || !s.segs.length) return false;
    if(isFriendlyFire(bot, s)) return false;

    const d = Math.hypot(
      s.segs[0].col - bh.col,
      s.segs[0].row - bh.row
    );

    return d < maxDist && s.segs[0].val < bh.val;
  });

  if(!candidates.length) return;

  // nearest target
  const tgt = candidates.reduce((a, b) =>
    Math.hypot(a.segs[0].col - bh.col, a.segs[0].row - bh.row) <
    Math.hypot(b.segs[0].col - bh.col, b.segs[0].row - bh.row)
      ? a
      : b
  );

  // begin lock-on
  bot.hookTarget = tgt;
  bot.hookState = 'locking';
  bot.hookLockUntil = now + 1000; // 1 second warning
}


// ── Update bot hook lock state ──
// call this once per bot during your bot update loop
function updateBotHook(bot) {
  if(bot.hookState !== 'locking') return;

  const now = performance.now();
  const tgt = bot.hookTarget;

  // invalid target
  if(!tgt || tgt.dead || !tgt.segs.length) {
    bot.hookState = null;
    bot.hookTarget = null;
    return;
  }

  const bh = bot.segs[0];

  const dx = tgt.segs[0].col - bh.col;
  const dy = tgt.segs[0].row - bh.row;

  const d = Math.hypot(dx, dy);

  if(d <= 0) return;

  // track target during lock
  bot.angle = Math.atan2(dy, dx);
  bot.dir = {
    dx: dx / d,
    dy: dy / d
  };

  // FIRE
  if(now >= bot.hookLockUntil) {
    fireHook(bot);

    bot.hookState = null;
    bot.hookTarget = null;

    // cooldown after firing
    bot.hookCooldownUntil = now + 4000;
  }
}


// ── Draw bot lock warning (!) ──
// call inside your render loop AFTER drawing snakes
function drawBotHookWarnings(ctx) {
  const now = performance.now();
  for(const bot of (G.bots || [])) {
    if(bot.dead || !bot.segs.length) continue;
    if(bot.hookState !== 'locking') continue;

    const lh = lerpSeg(bot.segs[0], bot, now);
    // project 2 world-units above the head (cube top ≈ 0.9 units)
    const p = project3(lh.col, 2.0, lh.row);
    if(!p) continue;

    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // animated bounce
    const bob = Math.sin(now * 0.015) * 4;

    // pulse as lock nears completion
    const remain = Math.max(0, bot.hookLockUntil - now);
    const t = 1 - (remain / 1000);
    const size = 20 + t * 10;

    ctx.font = `bold ${size}px Arial`;
    ctx.fillStyle = Math.floor(now / 120) % 2 ? '#ff3030' : '#ffffff';
    ctx.fillText('!', p.x, p.y + bob);
    ctx.restore();
  }
}

//end new 2.5.3
