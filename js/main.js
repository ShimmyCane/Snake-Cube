// ════════════════════════════════════════
//  MAIN LOOP + DRAW + RADAR
// ════════════════════════════════════════

let lastTs = 0, lbFrame = 0;
function loop(ts) {
  requestAnimationFrame(loop);
  lastTs = ts;
  if(G && G.running) {
    if(++lbFrame % 18 === 0) updateLeaderboard();
    tickHooks(ts);
    tickTailBullets(ts);
    tickVacuum(ts);
    updateJoystickUI(ts);
  }
  draw(ts);
  if(MP.enabled && MP.isHost) broadcastState(ts);
}

// Lerp a segment between its prev and current position for butter-smooth rendering
function lerpSeg(seg, sn, now) {
  const tickMs = snakeTickMs(sn);
  const elapsed = sn.tickAt ? (now - sn.tickAt) : tickMs;
  const t = Math.min(1, Math.max(0, elapsed / tickMs));
  const pc = (seg.prevCol !== undefined) ? seg.prevCol : seg.col;
  const pr = (seg.prevRow !== undefined) ? seg.prevRow : seg.row;
  return {
    col: pc + (seg.col - pc) * t,
    row: pr + (seg.row - pr) * t,
  };
}

function draw(now) {
  now = now || performance.now();
  const bg = currentBG();
  if(typeof DAD !== 'undefined' && DAD.active) {
    ctx.clearRect(0, 0, W, H);
    DAD.drawBg();
  } else {
    ctx.fillStyle = bg.bg; ctx.fillRect(0, 0, W, H);
  }
  if(!G || !G.player) return;
  refreshWorldMax();

  // Animate terrain seed in Athena mode — makes the hills roll
  if(typeof ATHENA !== 'undefined' && ATHENA.active) {
    _terrainSeed = now * 0.0006;
  }

  // Update third-person camera — follows lerped head
  if(G.player.segs.length) {
    const lh = lerpSeg(G.player.segs[0], G.player, now);
    const headAngle = G.player.angle ?? 0;
    updateCamera(lh.col, lh.row);
    // Also update legacy G.camC/R for radar overlay
    G.camC = lh.col; G.camR = lh.row;
  }

  const cc = G.camC, cr = G.camR;

  // Extended range — draw more tiles to prevent pop-in at edges
  const range = 30;
  const c0=Math.max(0,Math.floor(cc-range)), c1=Math.min(CFG.COLS-1,Math.ceil(cc+range));
  const r0=Math.max(0,Math.floor(cr-range)), r1=Math.min(CFG.ROWS-1,Math.ceil(cr+range));

  if(!(typeof DAD !== 'undefined' && DAD.active)) {
    // Ground tiles — back-to-front (larger depth3 = further = draw first)
    const groundTiles = [];
    for(let r=r0;r<=r1;r++) for(let c=c0;c<=c1;c++) {
      groundTiles.push({ c, r, d: depth3(c, r) });
    }
    groundTiles.sort((a,b) => b.d - a.d);  // far first
    for(const t of groundTiles) {
      // Fog: tiles further from player fade to bg color
      const distFromPlayer = Math.max(Math.abs(t.c - cc), Math.abs(t.r - cr));
      const fogStart = 12, fogEnd = 30;
      const fogT = Math.min(1, Math.max(0, (distFromPlayer - fogStart) / (fogEnd - fogStart)));

      // Dark wall at real boundary (outermost 2 tiles)
      const isBoundary = t.c<=1||t.c>=CFG.COLS-2||t.r<=1||t.r>=CFG.ROWS-2;
      const isEdge     = t.c===0||t.c===CFG.COLS-1||t.r===0||t.r===CFG.ROWS-1;
      // Athena: tiles outside shrinking boundary get darkened
      let athenaOob = false;
      if(typeof ATHENA !== 'undefined' && ATHENA.active) {
        const ab=athenaBoundary(), half=ab/2, acx=CFG.COLS/2, acz=CFG.ROWS/2;
        athenaOob = Math.abs(t.c-acx)>half || Math.abs(t.r-acz)>half;
      }

      let tileColor;
      if(athenaOob) {
        tileColor = '#030306';  // void beyond boundary
      } else if(isEdge) {
        tileColor = '#050508';
      } else if(isBoundary) {
        tileColor = darken(bg.edge, 0.12);
      } else {
        tileColor = fogT > 0.01 ? lerpColor(bg.grid, bg.bg, fogT * 0.85) : bg.grid;
      }
      ground(t.c, t.r, cc, cr, tileColor);
    }
  }

  // Collect non-ground items
  const items = [];

  // food
  for(const f of G.food) {
    if(f.col<c0||f.col>c1||f.row<r0||f.row>r1) continue;
    const p = project3(f.col, terrainH(f.col, f.row) + 0.35, f.row);
    if(!p) continue;
    items.push({d: p.z, type:'f', col:f.col, row:f.row, val:f.val});
  }

  // special food
  for(const sp of (G.specials||[])) {
    if(sp.expiresAt <= now) continue;
    if(sp.col<c0||sp.col>c1||sp.row<r0||sp.row>r1) continue;
    const p = project3(sp.col, terrainH(sp.col, sp.row) + 0.35, sp.row);
    if(!p) continue;
    items.push({d: p.z, type:'sp', col:sp.col, row:sp.row, sp});
  }


  // snake segments — all snakes
  const snakes = [];
  if(!G.player.dead) snakes.push(G.player);
  G.bots.forEach(b=>{ if(!b.dead) snakes.push(b); });

  for(const sn of snakes) {
    const snHeadVal = sn.segs[0].val;
    for(let i=sn.segs.length-1;i>=0;i--) {
      const s=sn.segs[i];
      const lp = lerpSeg(s, sn, now);
      if(lp.col<c0||lp.col>c1||lp.row<r0||lp.row>r1) continue;
      const isHead = i===0;
      const p = project3(lp.col, terrainH(lp.col, lp.row), lp.row);
      if(!p) continue;
      items.push({
        d: p.z,  // actual camera-space Z — larger = further = draw first
        type:'s', col:lp.col, row:lp.row, val:s.val, isHead, sn, idx:i, headVal:snHeadVal
      });
    }
  }

  items.sort((a,b) => b.d - a.d);  // far-first (painter's algorithm)

  for(const it of items) {
    if(it.type==='f') {
      // Food = sphere — 2x larger than before
      const c=gc(it.val);
      drawSphere(it.col, it.row, c, 0.85, 1.4, it.val);
    } else if(it.type==='sp') {
      const sp=it.sp;
      const pulse = 0.80 + 0.20 * Math.sin(now * 0.006);
      if(sp.type==='x2') {
        const c={t:'#ffcc00',l:'#aa8800',r:'#ccaa00',tx:'#000'};
        drawSphere(it.col, it.row, c, 1.0, 3.0 * BONUS_SIZE_MULT * pulse, '✕2');
      } else if(sp.type==='boost') {
        const c={t:'#00f5c4',l:'#007a62',r:'#009e7c',tx:'#000'};
        drawSphere(it.col, it.row, c, 1.0, 3.0 * BONUS_SIZE_MULT * pulse, '⚡');
      } else if(sp.type==='radar') {
        const c={t:'#ff6b35',l:'#993d18',r:'#cc5228',tx:'#fff'};
        drawSphere(it.col, it.row, c, 1.0, 3.0 * BONUS_SIZE_MULT * pulse, '📡');
      } else if(sp.type==='invinc') {
        // Glowing white power orb
        const ci={t:'#ffffff',l:'#aaaacc',r:'#ccccff',tx:'#220044'};
        const glow = 0.9 + 0.2*Math.sin(now*0.008);
        drawSphere(it.col, it.row, ci, 1.0, 3.3 * BONUS_SIZE_MULT * glow, '✦');
      } else if(sp.type==='vacuum') {
        const cv={t:'#4488ff',l:'#1144aa',r:'#2266cc',tx:'#fff'};
        const pulse2 = 0.80 + 0.20 * Math.sin(now * 0.007);
        drawSphere(it.col, it.row, cv, 1.0, 3.5 * BONUS_SIZE_MULT * pulse2, '🌀');
      }
    } else {
      const sn=it.sn;
      const isHead=it.isHead;
      const c = gc(it.val);
      const scale = segScale(it.headVal, it.idx);
      const alpha = isHead ? 1.0 : Math.max(0.45, 1 - it.idx*0.04);
      const segAngle = sn.angle ?? 0;
      if(isHead) {
        // Mouth: multi-chomp animation — 3 quick bites over 1200ms
        const timeSinceEat = now - (sn.lastEatTime||0);
        const chompDur = 1200; // total chomp window
        const chompCycles = 3; // number of bites
        let mouthOpen = 0;
        if(timeSinceEat < chompDur) {
          const t = timeSinceEat / chompDur;
          mouthOpen = Math.max(0, Math.sin(t * Math.PI * chompCycles)) * (1 - t * 0.6);
        }
        // Bot emotion: hungry if bigger than player, scared if smaller
        const playerVal = G.player && !G.player.dead ? G.player.segs[0].val : 2;
        const botEmotion = !sn.isPlayer ? (it.val > playerVal * 1.5 ? 'hungry' : it.val < playerVal * 0.66 ? 'scared' : 'neutral') : null;
        // Invincibility aura: pulsing white glow ring around head
        const isInvincActive = (sn.isPlayer && G.invincUntil && now < G.invincUntil) ||
                                (!sn.isPlayer && sn.invincUntil && now < sn.invincUntil);
        if(isInvincActive) {
          const hp = project3(it.col, terrainH(it.col, it.row), it.row);
          if(hp) {
            const auraR = scale * 28 * (1 + 0.15*Math.sin(now*0.012));
            const grad = ctx.createRadialGradient(hp.x,hp.y,auraR*0.4,hp.x,hp.y,auraR);
            grad.addColorStop(0,'rgba(255,255,255,0.55)');
            grad.addColorStop(1,'rgba(200,180,255,0)');
            ctx.beginPath(); ctx.arc(hp.x,hp.y,auraR,0,Math.PI*2);
            ctx.fillStyle=grad; ctx.fill();
          }
        }
        drawHead(it.col, it.row, c, alpha, scale, segAngle, fmtVal(it.val),
                 mouthOpen, !sn.isPlayer, botEmotion);
      } else {
        drawCube3(it.col, it.row, cc, cr, c, alpha, scale, segAngle, fmtVal(it.val));
      }
    }
  }

  // Tail bullets
  drawTailBullets(now);

  // Hook ropes and tips
  drawHooks(now);

  // Bot warning icons
  drawBotHookWarnings(ctx);


  // Athena: boundary wall + decorative objects + fade overlay
  if(typeof ATHENA !== 'undefined' && ATHENA.active) {
    drawAthenaBoundary(now);
    drawDecoObjects(now);
  }

  // Screen-space fog vignette — fades edges toward bg color
  {
    const fogColor = bg.bg;
    const vg = ctx.createRadialGradient(W/2, H/2, Math.min(W,H)*0.25, W/2, H/2, Math.min(W,H)*0.72);
    vg.addColorStop(0, 'rgba(0,0,0,0)');
    vg.addColorStop(1, bg.bg + 'cc');  // semi-transparent bg color
    ctx.globalAlpha = 1;
    ctx.fillStyle = vg;
    ctx.fillRect(0, 0, W, H);
  }

  // Boost timer bar
  if(G.boostUntil && now < G.boostUntil) {
    const rem = (G.boostUntil - now) / CFG.BOOST_DURATION_MS;
    ctx.fillStyle='rgba(0,245,196,0.18)'; ctx.fillRect(0,H-6,W,6);
    ctx.fillStyle='#00f5c4'; ctx.fillRect(0,H-6,W*rem,6);
  }

  // Flash message
  if(_flashUntil > now) {
    const age = 1 - ((_flashUntil - now) / 2500);
    const alpha = age < 0.7 ? 1 : 1 - (age-0.7)/0.3;
    const y = H*0.35 - age*30;
    ctx.globalAlpha = alpha;
    ctx.font = `900 ${Math.round(W*0.045)}px 'Courier New',Courier,monospace`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillStyle = _flashColor;
    ctx.shadowColor = _flashColor; ctx.shadowBlur = 20;
    ctx.fillText(_flashMsg, W/2, y);
    ctx.shadowBlur = 0; ctx.globalAlpha = 1;
  }

  // Radar overlay (lower right)
  if(RADAR_ALWAYS_ON || (G.radarUntil && now < G.radarUntil)) {
    drawRadar(now);
  }

  // Paused overlay
  if(G.paused) {
    ctx.globalAlpha = 0.55;
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, W, H);
    ctx.globalAlpha = 1;
    ctx.font = `900 ${Math.round(W*0.07)}px 'Courier New',Courier,monospace`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillStyle = '#00f5c4';
    ctx.shadowColor = '#00f5c4'; ctx.shadowBlur = 24;
    ctx.fillText('PAUSED', W/2, H/2);
    ctx.shadowBlur = 0;
  }

  // Athena level-transition fade — drawn over all game elements
  if(typeof ATHENA !== 'undefined' && ATHENA.active) drawAthenaFade(now);

  // Action cooldown display (H / J keys)
  drawActionCooldowns(now);

  // Dad's mode mission status + arrow
  if(typeof DAD !== 'undefined' && DAD.active) _dadDrawMissionHUD();

  // Vacuum range indicator
  if(G && G.player && !G.player.dead && G.vacuumUntil && now < G.vacuumUntil) {
    const rem = ((G.vacuumUntil - now) / CFG.VACUUM_DURATION_MS);
    ctx.save();
    ctx.globalAlpha = 0.3 * rem;
    ctx.strokeStyle = '#4488ff';
    ctx.lineWidth = 2;
    const ph2 = G.player.segs[0];
    const vcp = project3(ph2.col, 0, ph2.row);
    if(vcp) {
      const vsr = CFG.VACUUM_RANGE * 20;
      ctx.beginPath();
      ctx.arc(vcp.x, vcp.y, vsr, 0, Math.PI*2);
      ctx.stroke();
    }
    ctx.restore();
  }

  ctx.globalAlpha = 1;

  // Burst recharge bar (bottom center)
  const burstFill = document.getElementById('burst-fill');
  const burstLabel = document.getElementById('burst-label');
  const burstBar = document.getElementById('burst-bar');
  const burstUnlocked = skillUnlocked('burst');   // Dad's mode: hidden until the BURST skill is earned
  if(burstBar)   burstBar.style.display   = burstUnlocked ? '' : 'none';
  if(burstLabel) burstLabel.style.display = burstUnlocked ? '' : 'none';
  document.getElementById('joy-boost-btn')?.classList.toggle('hidden', !burstUnlocked);
  if(burstFill && G) {
    const elapsed = now - (G.burstAt || 0);
    const pct = Math.min(1, elapsed / CFG.BURST_RECHARGE_MS);
    burstFill.style.width = (pct * 100) + '%';
    burstFill.style.background = pct >= 1 ? '#00f5c4' : `rgba(255,255,255,${0.3 + pct*0.4})`;
    if(burstLabel) burstLabel.style.color = pct >= 1 ? 'rgba(0,245,196,0.7)' : 'rgba(255,255,255,0.25)';
  }
}

function drawRadar(now) {
  const RW = 160, RH = 160, PAD = 12;
  const rx = PAD, ry = 58 + PAD;
  const rem = RADAR_ALWAYS_ON ? 1 : (G.radarUntil - now) / 15000;

  // Background
  ctx.globalAlpha = 0.88;
  ctx.fillStyle = '#060a10';
  ctx.strokeStyle = '#ff6b35';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.roundRect(rx, ry, RW, RH, 8);
  ctx.fill(); ctx.stroke();

  // Sweep line animation
  const sweep = ((now * 0.001) % (Math.PI*2));
  ctx.save();
  ctx.beginPath(); ctx.rect(rx, ry, RW, RH); ctx.clip();
  const cx2 = rx+RW/2, cy2 = ry+RH/2, rad = RW*0.46;
  const gradient = ctx.createConicalGradient
    ? null // fallback
    : null;
  ctx.globalAlpha = 0.18;
  ctx.fillStyle = '#ff6b35';
  ctx.beginPath();
  ctx.moveTo(cx2, cy2);
  ctx.arc(cx2, cy2, rad, sweep - 1.2, sweep, false);
  ctx.closePath(); ctx.fill();
  ctx.restore();

  // Concentric rings
  ctx.globalAlpha = 0.25;
  ctx.strokeStyle = '#ff6b35';
  ctx.lineWidth = 0.8;
  for(let r=1; r<=3; r++) {
    ctx.beginPath();
    ctx.arc(cx2, cy2, rad*r/3, 0, Math.PI*2);
    ctx.stroke();
  }
  // Crosshair
  ctx.beginPath();
  ctx.moveTo(rx, ry+RH/2); ctx.lineTo(rx+RW, ry+RH/2);
  ctx.moveTo(rx+RW/2, ry); ctx.lineTo(rx+RW/2, ry+RH);
  ctx.stroke();

  // Player dot (always center)
  ctx.globalAlpha = 1;
  ctx.fillStyle = '#00f5c4';
  ctx.beginPath(); ctx.arc(cx2, cy2, 3, 0, Math.PI*2); ctx.fill();

  // Sweep line
  ctx.strokeStyle = '#ff6b35';
  ctx.lineWidth = 1.5;
  ctx.globalAlpha = 0.7;
  ctx.beginPath();
  ctx.moveTo(cx2, cy2);
  ctx.lineTo(cx2 + Math.cos(sweep)*rad, cy2 + Math.sin(sweep)*rad);
  ctx.stroke();

  // Other snakes and food as dots — WORLD FIXED (no rotation)
  // World +X = radar right, world +Z (row) = radar UP (negated to match screen orientation).
  const pHead = G.player.segs[0];
  const mapScale = rad / (CFG.BOT_RANGE * 3.5);
  const allEnts = [];
  G.bots.forEach(b => { if(!b.dead) allEnts.push({col:b.segs[0].col, row:b.segs[0].row, color: b.segs[0].val > (G.player.segs[0]?.val||2) ? '#ff4444':'#ffcc00', r:2.5}); });
  G.food.forEach(f => allEnts.push({col:f.col, row:f.row, color:'#ffffff', r:1.2}));
  (G.specials||[]).forEach(s => allEnts.push({col:s.col, row:s.row, color:'#ff6b35', r:4}));

  for(const e of allEnts) {
    const dc = e.col - pHead.col, dr = e.row - pHead.row;
    // Rotate 45° to align with camera yaw: screen-right = +col−row, screen-up = +(col+row)
    const rx2 =  (dc - dr) * mapScale;
    const ry2 = -(dc + dr) * mapScale;
    if(Math.abs(rx2) > rad || Math.abs(ry2) > rad) continue;
    ctx.globalAlpha = 0.9;
    ctx.fillStyle = e.color;
    ctx.beginPath(); ctx.arc(cx2+rx2, cy2+ry2, e.r, 0, Math.PI*2); ctx.fill();
  }

  // Player heading arrow — apply same 45° rotation as dots
  if(G.player && !G.player.dead) {
    const pa = G.player.angle ?? 0;
    const arrowLen = rad * 0.32;
    const wdx = Math.cos(pa), wdy = Math.sin(pa);
    const ax =  (wdx - wdy) * arrowLen;
    const ay = -(wdx + wdy) * arrowLen;
    ctx.globalAlpha = 0.95;
    ctx.strokeStyle = '#00f5c4'; ctx.lineWidth = 2.5; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(cx2, cy2); ctx.lineTo(cx2+ax, cy2+ay); ctx.stroke();
    // Arrowhead
    const perpX = -ay/arrowLen*5, perpY = ax/arrowLen*5;
    ctx.beginPath();
    ctx.moveTo(cx2+ax, cy2+ay);
    ctx.lineTo(cx2+ax - ax/arrowLen*10 + perpX, cy2+ay - ay/arrowLen*10 + perpY);
    ctx.lineTo(cx2+ax - ax/arrowLen*10 - perpX, cy2+ay - ay/arrowLen*10 - perpY);
    ctx.closePath(); ctx.fillStyle='#00f5c4'; ctx.fill();
  }

  // Timer arc around edge
  ctx.globalAlpha = 0.5;
  ctx.strokeStyle = '#ff6b35';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.arc(cx2, cy2, rad+5, -Math.PI/2, -Math.PI/2 + rem*Math.PI*2, false);
  ctx.stroke();

  ctx.globalAlpha = 1;
}

// Kick off the render loop — must be last, after loop() is defined
requestAnimationFrame(loop);
