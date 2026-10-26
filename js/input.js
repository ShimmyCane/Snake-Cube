// ════════════════════════════════════════
//  INPUT — 360° steering
// ════════════════════════════════════════

// ── Joystick DOM — injected here so index.html stays slim ──
(function() {
  const jz = document.createElement('div');
  jz.id = 'joy-zone'; jz.className = 'hidden';
  jz.innerHTML = '<div id="joy-base"><div id="joy-knob"></div></div>';
  document.body.appendChild(jz);

  const jab = document.createElement('div');
  jab.id = 'joy-action-btns'; jab.className = 'hidden';
  jab.innerHTML = `
    <button class="joy-btn" id="joy-hook-btn" title="Hook">🪝<div class="joy-btn-cd" id="joy-hook-cd"></div></button>
    <button class="joy-btn" id="joy-tailbullet-btn" title="TailBullet">🏹<div class="joy-btn-cd" id="joy-tailbullet-cd"></div></button>
    <button class="joy-btn" id="joy-bomb-btn" title="Tail Bomb (B)">💣<div class="joy-btn-cd" id="joy-bomb-cd"></div></button>
    <button class="joy-btn" id="joy-boost-btn" title="Burst">⚡<div class="joy-btn-cd" id="joy-boost-cd"></div></button>`;
  document.body.appendChild(jab);
})();
// Player direction is a unit vector {dx, dy} in grid space.
// Touch: hold finger → snake steers toward finger position each frame.
// Keyboard: hold key → rotate direction at TURN_SPEED rad/tick.

const TURN_SPEED = 0.32; // radians per tick — much tighter turning radius
let _pointer = null;     // current steering target {x,y}
let _pointerIsTouch = false; // true = touch (finger must be down), false = mouse (persists after click)
const _keys = {};

// ── Touch — pointer lives only while finger is down ──
canvas.addEventListener('touchstart', e => {
  e.preventDefault();
  _pointerIsTouch = true;
  _pointer = { x: e.touches[0].clientX, y: e.touches[0].clientY };
}, { passive: false });
canvas.addEventListener('touchmove', e => {
  e.preventDefault();
  _pointer = { x: e.touches[0].clientX, y: e.touches[0].clientY };
}, { passive: false });
canvas.addEventListener('touchend', e => {
  if(e.touches.length) {
    _pointer = { x: e.touches[0].clientX, y: e.touches[0].clientY };
  } else {
    _pointer = null; // lift all fingers = stop overriding
  }
}, { passive: false });

// ── Mouse — move to steer (no click needed), click also works ──
let _mouseDown = false;
canvas.addEventListener('mousedown', e => {
  if(e.button !== 0) return;
  _mouseDown = true;
  _pointer = { x: e.clientX, y: e.clientY };
});
canvas.addEventListener('mousemove', e => {
  _pointer = { x: e.clientX, y: e.clientY };
});
canvas.addEventListener('mouseup',   e => { if(e.button !== 0) return; _mouseDown = false; });
canvas.addEventListener('mouseleave',() => { _mouseDown = false; _pointer = null; });

// ── Keyboard ──
document.addEventListener('keydown', e => {
  _keys[e.key] = true;
  if(e.key === ' ' || e.code === 'Space') {
    e.preventDefault();
    triggerBurst();
  }
  if((e.key === 'h' || e.key === 'H') && playerHookOn()) {
    e.preventDefault();
    firePlayerHook();
  }
  if((e.key === 'b' || e.key === 'B') && G && G.running) {
    e.preventDefault();
    fireTailBomb();
  }
  if((e.key === 'j' || e.key === 'J') && typeof ATHENA !== 'undefined' && ATHENA.active) {
    e.preventDefault();
    voluntaryJump();
  }
  if((e.key === 'f' || e.key === 'F') && G && G.running && G.player && !G.player.dead) {
    e.preventDefault();
    fireTailBullet();
  }
});
document.addEventListener('keyup',   e => { _keys[e.key] = false; });

// Double-tap on canvas = burst (mobile)
let _lastTap = 0;
canvas.addEventListener('touchstart', e => {
  const now2 = performance.now();
  if(now2 - _lastTap < 300) triggerBurst();
  _lastTap = now2;
}, { passive: true });

function triggerBurst() {
  if(!G || !G.running || !G.player || G.player.dead) return;
  if(!skillUnlocked('burst')) return;
  const now2 = performance.now();
  if(now2 - (G.burstAt||0) < CFG.BURST_RECHARGE_MS) return; // still recharging
  G.burstAt = now2;
  // Teleport head forward by BURST_DIST along current angle
  const p = G.player;
  const angle = p.angle ?? 0;
  const head = p.segs[0];
  const MARGIN = 0.5;
  head.col = Math.max(MARGIN, Math.min(CFG.COLS-1-MARGIN, head.col + Math.cos(angle)*CFG.BURST_DIST));
  head.row = Math.max(MARGIN, Math.min(CFG.ROWS-1-MARGIN, head.row + Math.sin(angle)*CFG.BURST_DIST));
  // Also push a trail point forward so body doesn't snap
  p.trailHead = (p.trailHead + 1) % p.trail.length;
  p.trail[p.trailHead] = { col: head.col, row: head.row };
  p.lastEatTime = now2; // trigger chomp face for fun
  showFlash('💨 BURST!', '#ffffff');
}

// ── Steer player ──
// Camera is fixed (no rotation), so controls are world-space.
// Up = world -Z (north), Down = world +Z, Left = world -X, Right = world +X.
// Mouse/touch: screen offset mapped through the fixed camera projection inverse.
function steerPlayer() {
  if(!G || !G.player || G.player.dead) return;
  const p = G.player;
  let angle = p.angle ?? Math.atan2(p.dir.dy ?? 0, p.dir.dx ?? 1);

  // Joystick mode: project joystick direction from canvas center through unprojectAngle
  // so screen-up on the stick = screen-up movement (same math as mouse steering)
  if(CTRL_MODE === 'joystick' && _joy.active) {
    const jx = W * 0.5 + _joy.ndx * W * 0.3;
    const jy = H * 0.5 + _joy.ndy * H * 0.3;
    const targetAngle = unprojectAngle(jx, jy);
    angle = lerpAngle(angle, targetAngle, TURN_SPEED * 5);
    p.angle = angle;
    p.dir = { dx: Math.cos(angle), dy: Math.sin(angle) };
    return;
  }

  const left  = _keys['ArrowLeft']  || _keys['a'] || _keys['A'];
  const right = _keys['ArrowRight'] || _keys['d'] || _keys['D'];
  const up    = _keys['ArrowUp']    || _keys['w'] || _keys['W'];
  const down  = _keys['ArrowDown']  || _keys['s'] || _keys['S'];
  const anyKey = left || right || up || down;

  if(anyKey) {
    // Keyboard takes priority — clear mouse pointer so it doesn't fight
    _pointer = null;
    const camRight = CAM.yaw + Math.PI/2;
    const camFwd   = CAM.yaw;
    let tx = 0, tz = 0;
    if(up)    { tx += Math.cos(camFwd);    tz += Math.sin(camFwd); }
    if(down)  { tx -= Math.cos(camFwd);    tz -= Math.sin(camFwd); }
    if(left)  { tx -= Math.cos(camRight);  tz -= Math.sin(camRight); }
    if(right) { tx += Math.cos(camRight);  tz += Math.sin(camRight); }
    if(tx !== 0 || tz !== 0) {
      angle = lerpAngle(angle, Math.atan2(tz, tx), TURN_SPEED * 3);
    }
  } else if(_pointer) {
    const sx = _pointer.x, sy = _pointer.y;
    if(Math.abs(sx - canvas.offsetWidth*0.5) > 8 || Math.abs(sy - canvas.offsetHeight*0.5) > 8) {
      const targetAngle = unprojectAngle(sx, sy);
      angle = lerpAngle(angle, targetAngle, TURN_SPEED * 4);
    }
  }

  p.angle = angle;
  p.dir = { dx: Math.cos(angle), dy: Math.sin(angle) };
}

document.getElementById('b-beginner').onclick = () => {
  EXPERT_MODE = false;
  document.getElementById('s-start').classList.add('hidden');
  showMPScreen('menu');
};
document.getElementById('b-expert').onclick = () => {
  EXPERT_MODE = true;
  document.getElementById('s-start').classList.add('hidden');
  showMPScreen('menu');
};
document.getElementById('b-restart').onclick = () => {
  document.getElementById('s-over').classList.add('hidden');
  if(MP.isHost || MP.mode==='solo') initGame();
  else showMPScreen('menu');
};

// ══════════════════════════════════════════════════════
//  CONTROL MODE  (felix = touch-to-steer, joystick = d-pad + hook)
// ══════════════════════════════════════════════════════

function isMobileDevice() {
  return /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent) || window.innerWidth < 640;
}
let CTRL_MODE = localStorage.getItem('ctrl_mode') || (isMobileDevice() ? 'joystick' : 'felix');

function setCtrlMode(mode) {
  CTRL_MODE = mode;
  localStorage.setItem('ctrl_mode', mode);
  document.getElementById('ctrl-felix-btn').classList.toggle('active', mode === 'felix');
  document.getElementById('ctrl-joy-btn').classList.toggle('active', mode === 'joystick');
  // Burst bar / label: hide in joystick mode (boost btn replaces it)
  const bb = document.getElementById('burst-bar');
  const bl = document.getElementById('burst-label');
  if(bb) bb.style.opacity = mode === 'joystick' ? '0' : '1';
  if(bl) bl.style.opacity = mode === 'joystick' ? '0' : '1';
  if(G && G.running) showJoystickUI(true);   // switch the pad and buttons on or off mid-game
}

// Action buttons show in every control mode. Outside Dad's mode they are always live;
// in Dad's mode a locked skill stays visible but dimmed until a mission unlocks it.
function setActionBtn(id, visible, locked) {
  const b = document.getElementById(id);
  if(!b) return;
  b.classList.toggle('hidden', !visible);
  b.classList.toggle('locked', !!locked);
}
function updateActionButtons() {
  const dad = typeof DAD !== 'undefined' && DAD.active;
  setActionBtn('joy-hook-btn',      dad || HOOK_ENABLED, dad && !DAD.skills.hook);
  setActionBtn('joy-tailbullet-btn', true,               dad && !DAD.skills.tail);
  setActionBtn('joy-bomb-btn',       true,               dad && !DAD.skills.bomb);
  setActionBtn('joy-boost-btn',      true,               dad && !DAD.skills.burst);
}
function updateHookVisibility() { updateActionButtons(); }
function updateTailBulletVisibility() { updateActionButtons(); }

function showJoystickUI(show) {
  const jz  = document.getElementById('joy-zone');
  const jab = document.getElementById('joy-action-btns');
  // The pad only exists in joystick mode; the action buttons exist in both modes
  if(jz)  jz.classList.toggle('hidden', !(show && CTRL_MODE === 'joystick'));
  if(jab) jab.classList.toggle('hidden', !show);
  updateActionButtons();
}

// ── Joystick state ──
const _joy = {
  active: false, touchId: -1,
  cx: 0, cy: 0,     // center of joy-base on screen
  angle: 0,
  maxR: 44,          // max knob travel (px)
};

function initJoystickHandlers() {
  const zone = document.getElementById('joy-zone');
  if(!zone) return;

  zone.addEventListener('touchstart', e => {
    e.preventDefault();
    if(_joy.active) return;
    const t = e.changedTouches[0];
    const r = zone.getBoundingClientRect();
    _joy.cx   = r.left + r.width / 2;
    _joy.cy   = r.top  + r.height / 2;
    _joy.maxR = r.width * 0.38;  // 38% of diameter scales with element size
    _joy.touchId = t.identifier;
    _joy.active  = true;
    _joyUpdateKnob(t.clientX, t.clientY);
  }, { passive: false });

  document.addEventListener('touchmove', e => {
    if(!_joy.active) return;
    for(const t of e.changedTouches) {
      if(t.identifier === _joy.touchId) {
        e.preventDefault();
        _joyUpdateKnob(t.clientX, t.clientY);
        break;
      }
    }
  }, { passive: false });

  document.addEventListener('touchend', e => {
    for(const t of e.changedTouches) {
      if(t.identifier === _joy.touchId) {
        _joy.active  = false;
        _joy.touchId = -1;
        _joySetKnobDOM(0, 0);
        break;
      }
    }
  });

  // Action buttons
  document.getElementById('joy-boost-btn').addEventListener('touchstart', e => {
    e.preventDefault(); triggerBurst();
  }, { passive: false });
  document.getElementById('joy-hook-btn').addEventListener('touchstart', e => {
    e.preventDefault(); firePlayerHook();
  }, { passive: false });
  document.getElementById('joy-tailbullet-btn').addEventListener('touchstart', e => {
    e.preventDefault(); fireTailBullet();
  }, { passive: false });
  document.getElementById('joy-bomb-btn').addEventListener('touchstart', e => {
    e.preventDefault(); fireTailBomb();
  }, { passive: false });
}

function _joyUpdateKnob(tx, ty) {
  const dx = tx - _joy.cx, dy = ty - _joy.cy;
  const dist = Math.hypot(dx, dy);
  const c = Math.min(dist, _joy.maxR);
  const nx = dist > 0 ? dx / dist * c : 0;
  const ny = dist > 0 ? dy / dist * c : 0;
  // Store normalized screen-space direction; world angle derived via unprojectAngle in steerPlayer
  _joy.ndx = dist > 0 ? dx / dist : 0;
  _joy.ndy = dist > 0 ? dy / dist : 0;
  _joySetKnobDOM(nx, ny);
}

function _joySetKnobDOM(nx, ny) {
  const k = document.getElementById('joy-knob');
  if(k) k.style.transform = `translate(calc(-50% + ${nx}px), calc(-50% + ${ny}px))`;
}

function updateJoystickUI(now) {
  const hookCd = document.getElementById('joy-hook-cd');
  const tailbulletCd = document.getElementById('joy-tailbullet-cd');
  const boostCd = document.getElementById('joy-boost-cd');
  const hookBtn = document.getElementById('joy-hook-btn');
  const tailbulletBtn = document.getElementById('joy-tailbullet-btn');
  const boostBtn = document.getElementById('joy-boost-btn');
  if(!G) return;
  if(hookCd && G.player) {
    const until = G.player.hookCooldownUntil || 0;
    const cd = Math.max(0, (until - now) / CFG.HOOK_COOLDOWN_MS);
    hookCd.style.setProperty('--cd', Math.round(cd * 360) + 'deg');
    if(hookBtn) hookBtn.classList.toggle('ready', cd <= 0);
  }
    if(tailbulletCd && G.player) {
    const until = G.player.tailBulletCooldownUntil || 0;
    const cd = Math.max(0, (until - now) / CFG.TAIL_BULLET_COOLDOWN_MS);
    tailbulletCd.style.setProperty('--cd', Math.round(cd * 360) + 'deg');
    if(tailbulletBtn) tailbulletBtn.classList.toggle('ready', cd <= 0);
  }
  const bombCd = document.getElementById('joy-bomb-cd');
  const bombBtn = document.getElementById('joy-bomb-btn');
  if(bombCd && G.player) {
    const cd = Math.max(0, ((G.player.bombCooldownUntil || 0) - now) / CFG.BOMB_COOLDOWN_MS);
    bombCd.style.setProperty('--cd', Math.round(cd * 360) + 'deg');
    if(bombBtn) bombBtn.classList.toggle('ready', cd <= 0);
  }
  if(boostCd) {
    const elapsed = now - (G.burstAt || 0);
    const cd = Math.max(0, 1 - elapsed / CFG.BURST_RECHARGE_MS);
    boostCd.style.setProperty('--cd', Math.round(cd * 360) + 'deg');
    if(boostBtn) boostBtn.classList.toggle('ready', cd <= 0);
  }
}
