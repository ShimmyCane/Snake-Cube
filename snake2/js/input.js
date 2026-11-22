// ════════════════════════════════════════════════════════════════════
//  INPUT — keys, taps and swipes on the board, and the corner stick.
//  Each one aims Felix with `onAim(angle)`, or pauses with `onPause()`.
//  An angle is in radians, measured the way the screen is drawn (0 = right, PI/2 = down).
// ════════════════════════════════════════════════════════════════════

const KEY_VEC = {
  arrowup: [0, -1], w: [0, -1],
  arrowdown: [0, 1], s: [0, 1],
  arrowleft: [-1, 0], a: [-1, 0],
  arrowright: [1, 0], d: [1, 0],
};
const SWIPE_MIN_PX = 24;   // a move at least this long is a swipe; a shorter press is a tap
const JOY_DEAD_PX = 14;    // the corner stick ignores pushes shorter than this
const JOY_MAX_PX = 42;     // how far the stick knob travels

function installInput(canvas, stick, handlers) {
  // Arrow keys and WASD. Two keys together aim diagonally.
  const held = new Set();
  const aimFromKeys = () => {
    let x = 0, y = 0;
    for (const k of held) { x += KEY_VEC[k][0]; y += KEY_VEC[k][1]; }
    if (x !== 0 || y !== 0) handlers.onAim(Math.atan2(y, x));
  };
  document.addEventListener('keydown', e => {
    const k = e.key.toLowerCase();
    if (k in KEY_VEC) {
      e.preventDefault();
      held.add(k);
      aimFromKeys();
    } else if (k === 'p' || k === 'escape') {
      handlers.onPause();
    }
  });
  document.addEventListener('keyup', e => { held.delete(e.key.toLowerCase()); });

  // Board. A tap aims Felix toward where you tapped, measured from the middle of the screen
  // (the camera keeps Felix near the middle). A swipe aims the way it was swiped.
  let press = null;
  canvas.addEventListener('pointerdown', e => {
    if (!e.isPrimary || (e.pointerType === 'mouse' && e.button !== 0)) return;
    press = { x: e.clientX, y: e.clientY };
  });
  canvas.addEventListener('pointerup', e => {
    if (!press || !e.isPrimary) return;
    const from = press;
    press = null;
    const dx = e.clientX - from.x, dy = e.clientY - from.y;
    const a = Math.max(Math.abs(dx), Math.abs(dy)) >= SWIPE_MIN_PX
      ? angleFromOffset(dx, dy)
      : angleFromOffset(from.x - window.innerWidth / 2, from.y - window.innerHeight / 2);
    if (a !== null) handlers.onAim(a);
  });
  canvas.addEventListener('pointercancel', () => { press = null; });

  // Corner stick. Push it in any direction and Felix aims that way. Let go and Felix keeps its heading.
  if (stick) {
    const knob = stick.querySelector('.joy-knob');
    let id = null, cx = 0, cy = 0;
    const aim = (x, y) => {
      const dx = x - cx, dy = y - cy;
      const dist = Math.hypot(dx, dy);
      const k = dist > JOY_MAX_PX ? JOY_MAX_PX / dist : 1;
      knob.style.transform = `translate(calc(-50% + ${dx * k}px), calc(-50% + ${dy * k}px))`;
      if (dist >= JOY_DEAD_PX) handlers.onAim(Math.atan2(dy, dx));
    };
    stick.addEventListener('pointerdown', e => {
      if (id !== null) return;                       // one finger on the stick at a time
      const r = stick.getBoundingClientRect();
      cx = r.left + r.width / 2;
      cy = r.top + r.height / 2;
      id = e.pointerId;
      stick.setPointerCapture(e.pointerId);
      aim(e.clientX, e.clientY);
      e.preventDefault();
    });
    stick.addEventListener('pointermove', e => {
      if (e.pointerId === id) aim(e.clientX, e.clientY);
    });
    const release = e => {
      if (e.pointerId !== id) return;
      id = null;
      knob.style.transform = 'translate(-50%, -50%)';
    };
    stick.addEventListener('pointerup', release);
    stick.addEventListener('pointercancel', release);
  }
}
