// ══════════════════════════════════════════════════════
//  ATHENA'S CHALLENGE ENGINE
// ══════════════════════════════════════════════════════

// Athena world palettes — light pastels, each level shifts hue
const ATHENA_BG = [
  { bg:'#f0eaff', grid:'#cdb0f8', edge:'#bc98f0', acc:'#7a3fc8' }, // L1 — soft violet
  { bg:'#fff4e6', grid:'#ffd0a0', edge:'#f0ba80', acc:'#c07020' }, // L2 — soft amber
  { bg:'#e6fff8', grid:'#94f0d4', edge:'#78e0c0', acc:'#189870' }, // L3 — soft teal
  { bg:'#ffe8ea', grid:'#ffa8b4', edge:'#f0909c', acc:'#c01830' }, // L4 — soft rose
  { bg:'#e8ecff', grid:'#a8b4ff', edge:'#9098f0', acc:'#2838c8' }, // L5 — soft indigo
  { bg:'#eafee6', grid:'#a4f090', edge:'#88e070', acc:'#309820' }, // L6 — soft lime
];

// Athena snake cube color shifts per level — progressively alien
const ATHENA_CUBE_TINT = [
  null,           // L1 — normal colors
  0.18,           // L2 — warm tint
  0.36,           // L3 — teal tint
  0.55,           // L4 — red shift
  0.72,           // L5 — indigo
  0.9,            // L6 — acid
];

const ATHENA = {
  active: false,
  level: 1,             // current level (1-based)
  boundary: 1.0,        // fraction of original size (1.0 → 0.75 → 0.5 → 0.25)
  baseSize: 160,        // starting map size for level 1 (2× original for both modes)
  shrinkInterval: null,
  shrinkStep: 0.25,     // shrink by 25% every 30s
  shrinkEvery: 30000,
  falling: false,
  fallStart: 0,
  fallDuration: 2000,
  fadingOut: false,
  fadingIn: false,
  decorObjects: [],
  jumpBtnVisible: false,
  diffMode: 'hard',     // 'easy' or 'hard'
  baseSpeedMult: 1.0,   // accumulates 10% per level
  warnTimer: null,      // 3-second warning before auto-fall
  warnAt: 0,            // timestamp when warning started
  warned: false,        // currently showing proximity warning
};

// Level size: each level is 20% larger than base
function athenaLevelSize(level) {
  return Math.round(ATHENA.baseSize * Math.pow(1.2, level - 1));
}

// Athena bot difficulty constants — absolute table values, not player-relative
// L1=2^1=2, L2=2^5=32, L3=2^10=1024 — prevents farm-exploit of staying weak
const ATHENA_BOT_EXP = 5;  // exponent jump per level
const ATHENA_BOT_VAR = 3;  // max exponents below target — spread for bot-vs-bot predation

// Per-level CFG overrides — merged via Object.assign(CFG, athenaLevelCFG(...))
// Level 1 = entry; level 2+ escalate density, difficulty, speed, chase range
function athenaLevelCFG(level, isEasy) {
  const sz = athenaLevelSize(level);
  if(level === 1) return {
    COLS: sz, ROWS: sz,
    ROUND_SEC: isEasy ? 300 : 420, FOOD_MS: 8000, FOOD_FIELD_MAX: 80,   // easy 5 min · hard 7 min
    NUM_BOTS: Math.round((isEasy ? 24 : 40) * WORLD_DENSITY), BOT_MAX: Math.round((isEasy ? 40 : 64) * WORLD_DENSITY),
    DIFFICULTY: isEasy ? 0.8 : 1.2,
    BOT_CHASE_RANGE: isEasy ? 72 : 96,
  };
  return {
    COLS: sz, ROWS: sz,
    ROUND_SEC: isEasy ? 300 : 420,
    NUM_BOTS: Math.round((40 + level * 4) * WORLD_DENSITY),
    BOT_MAX:  Math.round((64 + level * 6) * WORLD_DENSITY),
    DIFFICULTY: 1.2 + level * 0.4,
    FOOD_FIELD_MAX: Math.round(80 * Math.pow(1.15, level - 1)),
    BOT_CHASE_RANGE: 96 + level * 16,
  };
}

// Effective boundary cols/rows (shrinks over time on level 1)
function athenaBoundary() {
  const sz = athenaLevelSize(ATHENA.level);
  return Math.max(20, Math.round(sz * ATHENA.boundary));
}

// ── Start Athena mode ──
function startAthena() {
  hideMPOverlay();
  document.getElementById('s-start').classList.add('hidden');
  ATHENA.active = true;
  ATHENA.level = 1;
  ATHENA.boundary = 1.0;
  ATHENA.falling = false;
  ATHENA.fadingOut = false;
  ATHENA.fadingIn = false;
  ATHENA.fadeAlpha = 0;
  ATHENA.jumpBtnVisible = false;
  MP.mode = 'solo';

  const isEasy = ATHENA.diffMode === 'easy';
  Object.assign(CFG, athenaLevelCFG(1, isEasy));
  ATHENA.baseSpeedMult = isEasy ? 1.1 : 1.0; // easy starts 10% slower
  EXPERT_MODE = false;
  HOOK_ENABLED = !isEasy;
  updateGameTitle(isEasy ? "ATHENA'S CHALLENGE · EASY" : "ATHENA'S CHALLENGE · HARD");

  initGame();

  // Show mode badge with Athena accent
  const badge = document.getElementById('mode-badge');
  badge.textContent = '🦉 LVL 1';
  badge.className = 'mode-badge coop';
  badge.style.background = ATHENA_BG[0].acc + '22';
  badge.style.color = ATHENA_BG[0].acc;
  badge.style.borderColor = ATHENA_BG[0].acc + '55';
  badge.classList.remove('hidden');

  // Generate floor objects for level 1
  athenaGenObjects();

  // Start shrink timer
  clearInterval(ATHENA.shrinkInterval);
  ATHENA.shrinkInterval = setInterval(athenaShrink, ATHENA.shrinkEvery);

  // Show jump button
  showJumpButton(true);
}

// ── Shrink boundary ──
function athenaShrink() {
  if(!ATHENA.active || !G.running) return;
  ATHENA.boundary = Math.max(0.25, ATHENA.boundary - ATHENA.shrinkStep);
  const b = athenaBoundary();
  // Check if player is outside new boundary
  if(G.player && !G.player.dead && G.player.segs.length) {
    const h = G.player.segs[0];
    const half = b / 2;
    const cx = CFG.COLS / 2, cz = CFG.ROWS / 2;
    if(Math.abs(h.col - cx) > half || Math.abs(h.row - cz) > half) {
      triggerFall(); // pushed off edge
    }
  }
  if(ATHENA.boundary <= 0.25) {
    // Minimum reached — force fall for everyone still alive
    clearInterval(ATHENA.shrinkInterval);
    if(G.running && G.player && !G.player.dead) triggerFall();
  }
}

// ── Voluntary jump ──
function voluntaryJump() {
  if(!ATHENA.active || ATHENA.falling || !G.running) return;
  const now = performance.now();
  if(G.player && G.player.jumpCooldownUntil && now < G.player.jumpCooldownUntil) {
    const secs = Math.ceil((G.player.jumpCooldownUntil - now) / 1000);
    showFlash(`Jump cooldown: ${secs}s`, '#bf5fff');
    return;
  }
  // Only allow if near boundary
  const b = athenaBoundary();
  const half = b / 2;
  const cx = CFG.COLS / 2, cz = CFG.ROWS / 2;
  const h = G.player && G.player.segs[0];
  if(!h) return;
  const nearEdge = Math.abs(h.col - cx) > half * 0.7 || Math.abs(h.row - cz) > half * 0.7;
  if(nearEdge) {
    triggerFall();
    if(G.player) G.player.jumpCooldownUntil = performance.now() + CFG.JUMP_COOLDOWN_MS;
  } else showFlash('Move to the edge to jump!', '#bf5fff');
}

// ── Fall transition ──
function triggerFall() {
  if(ATHENA.falling) return;
  ATHENA.falling = true;
  ATHENA.warned = false;
  clearTimeout(ATHENA.warnTimer);
  ATHENA.fadingOut = true;
  ATHENA.fadingIn  = false;
  ATHENA.fallStart = performance.now();
  clearInterval(ATHENA.shrinkInterval);
  showFlash('🦉 FALLING TO LEVEL ' + (ATHENA.level+1), '#bf5fff');

  // After fall duration → load next level
  setTimeout(() => {
    athenaNextLevel();
  }, ATHENA.fallDuration);
}

// ── Next level ──
function athenaNextLevel() {
  ATHENA.level++;
  ATHENA.boundary = 1.0;
  ATHENA.falling = false;
  ATHENA.fadingOut = false;
  ATHENA.fadingIn = true;

  Object.assign(CFG, athenaLevelCFG(ATHENA.level, ATHENA.diffMode === 'easy'));
  ATHENA.baseSpeedMult = (ATHENA.baseSpeedMult || 1.0) * 0.95; // 5% faster each level

  // Save player state
  const savedSegs = G.player ? G.player.segs.map(s=>({...s})) : [];
  const savedAngle = G.player ? G.player.angle : 0;
  const playerHeadVal = savedSegs.length ? savedSegs[0].val : 2;

  // Bot sizing: absolute table value — L1=2^1=2, L2=2^5=32, L3=2^10=1024
  // Independent of player — prevents farm-exploit of staying weak
  const targetExp = Math.max(1, (ATHENA.level - 1) * ATHENA_BOT_EXP);
  const botMax = Math.pow(2, targetExp);

  // Pre-seed worldMax so snack sizes are relative to bots (not 2)
  _worldMax = Math.max(botMax, playerHeadVal * 4);

  // Reinit game (no speed burst — ATHENA.active suppresses levelSpeedMult)
  initGame();

  // Restore player
  if(G.player && savedSegs.length) {
    G.player.segs = savedSegs.map((s,i) => ({
      col: G.player.segs[0]?.col + (Math.random()-0.5)*2 || 40,
      row: G.player.segs[0]?.row + (Math.random()-0.5)*2 || 40,
      prevCol: G.player.segs[0]?.col || 40,
      prevRow: G.player.segs[0]?.row || 40,
      val: s.val
    }));
    if(G.player.segs[0]) {
      G.player.segs[0].col = CFG.COLS/2;
      G.player.segs[0].row = CFG.ROWS/2;
    }
    G.player.angle = savedAngle;
    G.player.dir = { dx: Math.cos(savedAngle), dy: Math.sin(savedAngle) };
  }

  // Scale bots: each gets target exponent minus random offset [0, ATHENA_BOT_VAR]
  // Spread creates weaker bots as prey for stronger ones and the player
  G.bots.forEach(b => {
    if(!b.dead && b.segs.length) {
      const expOffset = Math.floor(Math.random() * (ATHENA_BOT_VAR + 1));
      const bv = Math.pow(2, Math.max(1, targetExp - expOffset));
      b.segs.forEach((s,i) => { s.val = Math.max(2, Math.round(bv / Math.pow(2,i))); });
    }
  });

  // Update badge with level accent color
  const badge = document.getElementById('mode-badge');
  const bgPal = ATHENA_BG[Math.min(ATHENA.level-1, ATHENA_BG.length-1)];
  badge.textContent = '🦉 LVL ' + ATHENA.level;
  badge.style.background = bgPal.acc + '22';
  badge.style.color = bgPal.acc;
  badge.style.borderColor = bgPal.acc + '55';

  // Generate floor objects (2 new per level)
  athenaGenObjects();

  // No bot respawn on level 1; new bots spawn on deeper levels via normal wave
  // Restart shrink timer
  ATHENA.shrinkInterval = setInterval(athenaShrink, ATHENA.shrinkEvery);

  // Fade in
  setTimeout(() => { ATHENA.fadingIn = false; }, 800);
}

// ── 3D Decorative Objects ──
// Objects: cup, ball, shoe, pencil, dice — 2 per level cumulative
const DECO_TYPES = ['cup','ball','pencil','dice'];

function athenaGenObjects() {
  const isEasy = ATHENA.diffMode === 'easy';
  // Easy: sparse scatter (2–4 objects per level). Hard: dense field.
  const count = isEasy
    ? 2 + (ATHENA.level - 1)          // easy: 2, 3, 4, 5 … per level
    : ATHENA.level * 8;               // hard: dense (8, 16, 24 …)
  ATHENA.decorObjects = [];
  const occ = new Set((G.food||[]).map(f=>Math.round(f.col)+','+Math.round(f.row)));
  for(let i=0; i<count; i++) {
    let col, row, tries=0;
    do {
      col = 5 + Math.floor(Math.random()*(CFG.COLS-10));
      row = 5 + Math.floor(Math.random()*(CFG.ROWS-10));
      tries++;
    } while(occ.has(col+','+row) && tries<20);
    occ.add(col+','+row);
    const type = DECO_TYPES[i % DECO_TYPES.length];
    const hue  = Math.random()*360;
    // 2–4× durability multiplier — varied per object so some are fragile, some tanks
    const hpMult = 2 + Math.floor(Math.random() * 3);
    const maxHp  = (3 + Math.max(0, ATHENA.level - 1)) * hpMult;
    ATHENA.decorObjects.push({ col, row, type, hue,
      angle: Math.random()*Math.PI*2,
      scale: 7.2 + Math.random()*1.6,
      hp: maxHp, maxHp
    });
  }
}

// ── Draw decorative objects ──
function drawDecoObjects(now) {
  for(const obj of ATHENA.decorObjects) {
    const gY = terrainH(obj.col, obj.row);
    const p = project3(obj.col, gY, obj.row);
    if(!p) continue;
    ctx.save();
    switch(obj.type) {
      case 'cup':    drawDecoCup(obj.col, obj.row, obj.scale, obj.hue, obj.angle, gY); break;
      case 'ball':   drawDecoBall(obj.col, obj.row, obj.scale, obj.hue, gY); break;
      case 'pencil': drawDecoPencil(obj.col, obj.row, obj.scale, obj.hue, obj.angle, gY); break;
      case 'dice':   drawDecoDice(obj.col, obj.row, obj.scale, obj.hue, obj.angle, gY); break;
    }
    // Crack overlay when damaged
    if(obj.hp !== undefined && obj.maxHp && obj.hp < obj.maxHp) {
      ctx.globalAlpha = 0.6 * (1 - obj.hp / obj.maxHp);
      ctx.fillStyle = '#ffffff';
      ctx.font = `${Math.round(p.z ? 40/p.z*200 : 20)}px serif`;
      ctx.textAlign = 'center';
      ctx.fillText('💥', p.x, p.y);
    }
    ctx.restore();
  }
}

// Helper: HSL color strings
function hsl(h,s,l) { return `hsl(${h},${s}%,${l}%)`; }

// Helper: paint a flat polygon face
function _face(pts, fill, stroke) {
  ctx.beginPath();
  pts.forEach((p,i) => i ? ctx.lineTo(p.x,p.y) : ctx.moveTo(p.x,p.y));
  ctx.closePath();
  ctx.fillStyle = fill; ctx.fill();
  ctx.strokeStyle = stroke || 'rgba(0,0,0,0.22)'; ctx.lineWidth = 1; ctx.stroke();
}
// Helper: sort faces far-first by average projected z depth, then paint
function _paintSorted(faces) {
  faces
    .map(f => ({ ...f, d: f.pts.reduce((s,p) => s + p.z, 0) / f.pts.length }))
    .sort((a,b) => b.d - a.d)
    .forEach(f => _face(f.pts, f.fill, f.stroke));
}

function drawDecoCup(col, row, scale, hue, angle, groundY = 0) {
  const h = scale * 1.4;
  const wTop = scale * 0.9, wBot = scale * 0.55;
  const ptop = [
    project3(col - wTop*0.5, groundY + h, row - wTop*0.5),
    project3(col + wTop*0.5, groundY + h, row - wTop*0.5),
    project3(col + wTop*0.5, groundY + h, row + wTop*0.5),
    project3(col - wTop*0.5, groundY + h, row + wTop*0.5),
  ];
  const pbot = [
    project3(col - wBot*0.5, groundY, row - wBot*0.5),
    project3(col + wBot*0.5, groundY, row - wBot*0.5),
    project3(col + wBot*0.5, groundY, row + wBot*0.5),
    project3(col - wBot*0.5, groundY, row + wBot*0.5),
  ];
  if(ptop.some(p=>!p)||pbot.some(p=>!p)) return;
  _paintSorted([
    { pts:[pbot[0],pbot[3],ptop[3],ptop[0]], fill:hsl(hue,55,28) },
    { pts:[pbot[0],pbot[1],ptop[1],ptop[0]], fill:hsl(hue,55,30) },
    { pts:[pbot[0],pbot[1],pbot[2],pbot[3]], fill:hsl(hue,45,22) },
    { pts:[pbot[1],pbot[2],ptop[2],ptop[1]], fill:hsl(hue,65,42) },
    { pts:[pbot[2],pbot[3],ptop[3],ptop[2]], fill:hsl(hue,55,36) },
    { pts:[pbot[3],pbot[0],ptop[0],ptop[3]], fill:hsl(hue,55,30) }, // -X side (two-sided)
  ]);
  // Top rim
  const cx2=(ptop[0].x+ptop[1].x+ptop[2].x+ptop[3].x)/4;
  const cy2=(ptop[0].y+ptop[1].y+ptop[2].y+ptop[3].y)/4;
  const rw=Math.hypot(ptop[1].x-ptop[0].x,ptop[1].y-ptop[0].y)/2;
  const rh=rw*0.3;
  ctx.beginPath(); ctx.ellipse(cx2,cy2,rw,rh,0,0,Math.PI*2);
  ctx.fillStyle=hsl(hue,55,55); ctx.fill();
  const hx=ptop[1].x+rw*0.5, hy=(ptop[1].y+pbot[1].y)/2;
  ctx.beginPath(); ctx.arc(hx,hy,rw*0.35,Math.PI*1.5,Math.PI*0.5,false);
  ctx.strokeStyle=hsl(hue,60,38); ctx.lineWidth=rw*0.18; ctx.stroke();
}

function drawDecoBall(col, row, scale, hue, groundY = 0) {
  const r3d = scale * 0.7;
  const p = project3(col, groundY + r3d, row);
  if(!p) return;
  const p2 = project3(col+r3d, groundY + r3d, row);
  if(!p2) return;
  const r = Math.abs(p2.x - p.x);
  if(r<2) return;
  // Sphere gradient
  const g = ctx.createRadialGradient(p.x-r*0.3,p.y-r*0.35,r*0.05,p.x,p.y,r);
  g.addColorStop(0,hsl(hue,80,75)); g.addColorStop(0.5,hsl(hue,70,50)); g.addColorStop(1,hsl(hue,60,25));
  ctx.beginPath(); ctx.arc(p.x,p.y,r,0,Math.PI*2);
  ctx.fillStyle=g; ctx.fill();
  // Seam lines
  ctx.strokeStyle=hsl(hue,40,35); ctx.lineWidth=r*0.07;
  ctx.beginPath(); ctx.ellipse(p.x,p.y,r,r*0.35,0,0,Math.PI*2); ctx.stroke();
  ctx.beginPath(); ctx.ellipse(p.x,p.y,r*0.35,r,Math.PI/2,0,Math.PI*2); ctx.stroke();
  // Shine
  ctx.beginPath(); ctx.arc(p.x-r*0.28,p.y-r*0.3,r*0.2,0,Math.PI*2);
  ctx.fillStyle='rgba(255,255,255,0.4)'; ctx.fill();
}

function drawDecoPencil(col, row, scale, hue, angle, groundY = 0) {
  const len=scale*2.2, r=scale*0.18;
  const cos=Math.cos(angle), sin=Math.sin(angle);
  function wpt(lx,lz,y) { return project3(col+lx*cos-lz*sin, groundY + y, row+lx*sin+lz*cos); }
  const b = [wpt(-len*0.5,-r,0),wpt(len*0.5,-r,0),wpt(len*0.5,r,0),wpt(-len*0.5,r,0)];
  const t = [wpt(-len*0.5,-r,r*2),wpt(len*0.5,-r,r*2),wpt(len*0.5,r,r*2),wpt(-len*0.5,r,r*2)];
  if([...b,...t].some(p=>!p)) return;
  _paintSorted([
    { pts:[b[0],b[3],t[3],t[0]], fill:hsl(hue,75,35) }, // -X end
    { pts:[b[1],b[0],t[0],t[1]], fill:hsl(hue,75,35) }, // +X end (two-sided)
    { pts:[b[0],b[1],b[2],b[3]], fill:hsl(hue,65,30) }, // bottom
    { pts:[b[3],b[2],t[2],t[3]], fill:hsl(hue,75,38) }, // +Z side
    { pts:[b[0],b[1],t[1],t[0]], fill:hsl(hue,75,38) }, // -Z side
    { pts:t,                      fill:hsl(hue,85,55) }, // top
  ]);
  const tip=wpt(len*0.5+r*1.5,0,r), tb1=wpt(len*0.5,-r,0), tb2=wpt(len*0.5,r,r*2);
  if(tip&&tb1&&tb2) {
    ctx.beginPath(); ctx.moveTo(tb1.x,tb1.y); ctx.lineTo(tb2.x,tb2.y); ctx.lineTo(tip.x,tip.y);
    ctx.closePath(); ctx.fillStyle='#e8c060'; ctx.fill();
  }
  const ep1=wpt(-len*0.5,-r,0), ep2=wpt(-len*0.5,r,r*2);
  if(ep1&&ep2) {
    ctx.beginPath(); ctx.moveTo(ep1.x,ep1.y); ctx.lineTo(ep2.x,ep2.y);
    ctx.strokeStyle='#ff8888'; ctx.lineWidth=r*8; ctx.stroke();
  }
}

function drawDecoDice(col, row, scale, hue, angle, groundY = 0) {
  const s=scale*0.85, h=s;
  const cos=Math.cos(angle), sin=Math.sin(angle);
  function wpt(lx,lz,y) { return project3(col+lx*cos-lz*sin, groundY + y, row+lx*sin+lz*cos); }
  const half=s*0.5;
  const top=[wpt(-half,-half,h),wpt(half,-half,h),wpt(half,half,h),wpt(-half,half,h)];
  const bot=[wpt(-half,-half,0),wpt(half,-half,0),wpt(half,half,0),wpt(-half,half,0)];
  if([...top,...bot].some(p=>!p)) return;
  _paintSorted([
    { pts:[bot[0],bot[3],top[3],top[0]], fill:'#b8b8b8' }, // -X
    { pts:[bot[1],bot[0],top[0],top[1]], fill:'#b0b0b0' }, // +X (two-sided)
    { pts:[bot[0],bot[1],top[1],top[0]], fill:'#c0c0c0' }, // -Z
    { pts:[bot[2],bot[3],top[3],top[2]], fill:'#d0d0d0' }, // +Z
    { pts:[bot[3],bot[2],bot[1],bot[0]], fill:'#a8a8a8' }, // bottom
    { pts:top,                           fill:'#f0f0f0' }, // top
  ]);
  // Dots on top face (showing 5)
  const dotC=(top[0].x+top[1].x+top[2].x+top[3].x)/4;
  const dotR=(top[0].y+top[1].y+top[2].y+top[3].y)/4;
  const dr=Math.hypot(top[1].x-top[0].x,top[1].y-top[0].y)/2;
  const dots=[[-0.5,-0.5],[0.5,-0.5],[0,0],[-0.5,0.5],[0.5,0.5]];
  ctx.fillStyle='#333';
  dots.forEach(([dx,dy])=>{
    ctx.beginPath();
    ctx.arc(dotC+dx*dr*0.55, dotR+dy*dr*0.55, dr*0.12, 0, Math.PI*2);
    ctx.fill();
  });
}

// ── Athena boundary collision check (called from stepSnake) ──
function athenaCheckBoundary(sn) {
  if(!ATHENA.active || ATHENA.falling) return;
  const b = athenaBoundary();
  const half = b / 2;
  const cx = CFG.COLS/2, cz = CFG.ROWS/2;
  const head = sn.segs[0];
  if(!head) return;
  const distX = Math.abs(head.col - cx);
  const distZ = Math.abs(head.row - cz);
  const atEdge = distX >= half || distZ >= half;
  const nearEdge = distX >= half * 0.82 || distZ >= half * 0.82; // within ~18% of edge

  if(atEdge) {
    if(sn.isPlayer) {
      ATHENA.warned = false;
      clearTimeout(ATHENA.warnTimer);
      triggerFall();
    } else {
      sn.dead = true;
    }
    return;
  }

  // 3-second warning when player approaches edge
  if(sn.isPlayer && nearEdge && !ATHENA.warned && !ATHENA.falling) {
    ATHENA.warned = true;
    ATHENA.warnAt = performance.now();
    ATHENA.warnTimer = setTimeout(() => {
      // If still near edge after 3s, auto-fall
      if(ATHENA.active && !ATHENA.falling && G.player && !G.player.dead) {
        const h2 = G.player.segs[0];
        if(h2 && (Math.abs(h2.col-cx) >= half*0.8 || Math.abs(h2.row-cz) >= half*0.8)) {
          triggerFall();
        }
      }
    }, 3000);
  } else if(sn.isPlayer && !nearEdge && ATHENA.warned) {
    ATHENA.warned = false;
    clearTimeout(ATHENA.warnTimer);
  }
}

// ── Athena boundary wall collision for deco objects ──
function athenaDecoCollision(sn) {
  if(!ATHENA.active) return false;
  const head = sn.segs[0];
  if(!head) return false;
  for(let oi = ATHENA.decorObjects.length - 1; oi >= 0; oi--) {
    const obj = ATHENA.decorObjects[oi];
    const dx = head.col - obj.col, dz = head.row - obj.row;
    const dist = Math.sqrt(dx*dx+dz*dz);
    if(dist < obj.scale * 0.9) {
      // Bounce: reflect velocity away from object center
      const nx = dx/dist, nz = dz/dist;
      const angle = Math.atan2(nz, nx);
      sn.angle = angle;
      sn.dir = { dx: nx, dy: nz };
      // Damage the object on direct snake hit
      if(!obj._lastHitTime || performance.now() - obj._lastHitTime > 1000) {
        obj._lastHitTime = performance.now();
        obj.hp = (obj.hp || obj.maxHp || 3) - 1;
        if(obj.hp <= 0) {
          const types = ['x2', 'boost', 'radar', 'invinc', 'vacuum'];
          const bonusType = types[Math.floor(Math.random() * types.length)];
          G.specials.push({ col: obj.col, row: obj.row, type: bonusType, expiresAt: performance.now() + 20000 });
          ATHENA.decorObjects.splice(oi, 1);
          showFlash('💥 BROKEN! Bonus revealed!', '#ffcc00');
        }
      }
      return true;
    }
  }
  return false;
}

// ── Render Athena boundary — scrolling rainbow + 3s warning flash ──
function drawAthenaBoundary(now) {
  if(!ATHENA.active) return;
  const b = athenaBoundary();
  const half = b / 2;
  const cx = CFG.COLS/2, cz = CFG.ROWS/2;

  const corners = [
    project3(cx-half, 0, cz-half),
    project3(cx+half, 0, cz-half),
    project3(cx+half, 0, cz+half),
    project3(cx-half, 0, cz+half),
  ];
  const cornersTop = [
    project3(cx-half, 2.2, cz-half),
    project3(cx+half, 2.2, cz-half),
    project3(cx+half, 2.2, cz+half),
    project3(cx-half, 2.2, cz+half),
  ];
  if(corners.some(p=>!p)||cornersTop.some(p=>!p)) return;

  // Scrolling rainbow hue — cycles every 3 seconds
  const scroll = (now * 0.12) % 360;

  // 3-second warning: flash white/red urgently
  let warnFlash = 0;
  if(ATHENA.warned) {
    const warnAge = (now - ATHENA.warnAt) / 3000; // 0→1 over 3s
    warnFlash = Math.sin(now * 0.03 * (1 + warnAge * 6)) * 0.5 + 0.5; // accelerating blink
  }

  ctx.save();

  // Draw each wall segment with its own scrolling color
  const wallDefs = [
    [corners[0], corners[1], cornersTop[1], cornersTop[0]], // north
    [corners[1], corners[2], cornersTop[2], cornersTop[1]], // east
    [corners[2], corners[3], cornersTop[3], cornersTop[2]], // south
    [corners[3], corners[0], cornersTop[0], cornersTop[3]], // west
  ];

  wallDefs.forEach((wall, wi) => {
    const hue = (scroll + wi * 90) % 360; // each wall offset by 90° in hue
    const warnColor = `rgba(255,80,80,${0.6 + warnFlash * 0.4})`;
    const rainbowColor = `hsla(${hue},100%,65%,0.75)`;
    const color = ATHENA.warned ? warnColor : rainbowColor;
    const glowColor = ATHENA.warned ? '#ff3030' : `hsl(${hue},100%,65%)`;
    const pulse = ATHENA.warned ? (0.6 + warnFlash * 0.4) : (0.65 + 0.35*Math.sin(now*0.003 + wi));

    ctx.globalAlpha = pulse;
    ctx.strokeStyle = color;
    ctx.lineWidth = ATHENA.warned ? 4 : 3;
    ctx.shadowColor = glowColor;
    ctx.shadowBlur = ATHENA.warned ? 20 : 14;

    // Vertical pillar (left of this wall)
    ctx.beginPath();
    ctx.moveTo(wall[0].x, wall[0].y);
    ctx.lineTo(wall[3].x, wall[3].y);
    ctx.stroke();

    // Bottom edge of this wall
    ctx.beginPath();
    ctx.moveTo(wall[0].x, wall[0].y);
    ctx.lineTo(wall[1].x, wall[1].y);
    ctx.stroke();

    // Top edge
    ctx.beginPath();
    ctx.moveTo(wall[3].x, wall[3].y);
    ctx.lineTo(wall[2].x, wall[2].y);
    ctx.stroke();
  });

  // Screen-space warning text
  if(ATHENA.warned) {
    const warnAge = (now - ATHENA.warnAt) / 3000;
    const secsLeft = Math.max(0, Math.ceil(3 - warnAge * 3));
    ctx.globalAlpha = 0.7 + warnFlash * 0.3;
    ctx.fillStyle = '#ff4444';
    ctx.shadowColor = '#ff0000'; ctx.shadowBlur = 16;
    ctx.font = `bold ${Math.round(W*0.055)}px 'Courier New',monospace`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(`⚠ EDGE IN ${secsLeft}s ⚠`, W/2, H * 0.18);
  }

  ctx.globalAlpha = 1;
  ctx.shadowBlur = 0;
  ctx.restore();
}

// ── JUMP button ──
function showJumpButton(visible) {
  let btn = document.getElementById('athena-jump-btn');
  if(!btn) {
    btn = document.createElement('button');
    btn.id = 'athena-jump-btn';
    btn.textContent = '🦉 JUMP';
    btn.style.cssText = `position:fixed;bottom:72px;right:300px;
      background:rgba(191,95,255,0.18);border:2px solid #bf5fff;color:#bf5fff;
      border-radius:20px;padding:10px 18px;font-family:'Courier New',monospace;
      font-size:0.78rem;font-weight:700;letter-spacing:1.5px;cursor:pointer;
      touch-action:manipulation;z-index:70;display:none;
      -webkit-tap-highlight-color:transparent;box-shadow:0 0 16px rgba(191,95,255,0.3);`;
    btn.addEventListener('click', voluntaryJump);
    document.body.appendChild(btn);
  }
  btn.style.display = visible ? 'block' : 'none';
  ATHENA.jumpBtnVisible = visible;
}

// ── Draw fade overlay for level transitions ──
function drawAthenaFade(now) {
  if(!ATHENA.fadingOut && !ATHENA.fadingIn) return;
  if(ATHENA.fadingOut) {
    const t = Math.min(1, (now - ATHENA.fallStart) / ATHENA.fallDuration);
    ctx.globalAlpha = t;
    ctx.fillStyle = '#000';
    ctx.fillRect(0,0,W,H);
    // Falling text
    if(t > 0.2 && t < 0.8) {
      ctx.globalAlpha = Math.sin((t-0.2)/0.6*Math.PI);
      ctx.fillStyle = '#bf5fff';
      ctx.font = `bold ${Math.round(W*0.06)}px 'Courier New',monospace`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('🦉 LEVEL ' + (ATHENA.level + 1), W/2, H/2);
    }
    ctx.globalAlpha = 1;
  } else if(ATHENA.fadingIn) {
    ctx.globalAlpha = 0.6;
    ctx.fillStyle = '#000';
    ctx.fillRect(0,0,W,H);
    ctx.globalAlpha = 1;
  }
}

// ── Clean up Athena on game end ──
function athenaCleanup() {
  ATHENA.active = false;
  ATHENA.falling = false;
  ATHENA.warned = false;
  clearInterval(ATHENA.shrinkInterval);
  clearTimeout(ATHENA.warnTimer);
  showJumpButton(false);
  CFG.COLS = 160; CFG.ROWS = 160; // restore default
}
