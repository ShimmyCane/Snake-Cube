// ════════════════════════════════════════════════════════════════════
//  INPUT — keys, taps and swipes on the board, and the corner stick.
//  Each one becomes a turn request via `onTurn(dir)`, or a pause via `onPause()`.
// ════════════════════════════════════════════════════════════════════

const KEY_DIRS = {
  ArrowUp: 0, w: 0, W: 0,
  ArrowDown: 1, s: 1, S: 1,
  ArrowLeft: 2, a: 2, A: 2,
  ArrowRight: 3, d: 3, D: 3,
};
const SWIPE_MIN_PX = 24;   // a move at least this long is a swipe; a shorter press is a tap

function installInput(canvas, stick, handlers) {
  document.addEventListener('keydown', e => {
    if (e.key in KEY_DIRS) {
      e.preventDefault();
      handlers.onTurn(DIRS[KEY_DIRS[e.key]]);
    } else if (e.key === 'p' || e.key === 'P' || e.key === 'Escape') {
      handlers.onPause();
    }
  });

  // Board. A tap turns Felix toward where you tapped, measured from the middle of the screen
  // (the camera keeps Felix near the middle). A swipe turns the way it was swiped.
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
    const d = Math.max(Math.abs(dx), Math.abs(dy)) >= SWIPE_MIN_PX
      ? directionFromOffset(dx, dy)
      : directionFromOffset(from.x - window.innerWidth / 2, from.y - window.innerHeight / 2);
    if (d) handlers.onTurn(d);
  });
  canvas.addEventListener('pointercancel', () => { press = null; });

  // Corner stick. Push it and Felix turns toward the bigger axis. Each new push turns once;
  // holding the stick in one direction does not repeat the turn.
  if (stick) {
    const knob = stick.querySelector('.joy-knob');
    let id = null, cx = 0, cy = 0, lastDir = null;
    const aim = (x, y) => {
      const dx = x - cx, dy = y - cy;
      const dist = Math.hypot(dx, dy);
      const k = dist > CFG2.JOY_MAX_PX ? CFG2.JOY_MAX_PX / dist : 1;
      knob.style.transform = `translate(calc(-50% + ${dx * k}px), calc(-50% + ${dy * k}px))`;
      const d = dist >= CFG2.JOY_DEAD_PX ? directionFromOffset(dx, dy) : null;
      if (!d) { lastDir = null; return; }
      if (d !== lastDir) { lastDir = d; handlers.onTurn(d); }
    };
    stick.addEventListener('pointerdown', e => {
      if (id !== null) return;                       // one finger on the stick at a time
      const r = stick.getBoundingClientRect();
      cx = r.left + r.width / 2;
      cy = r.top + r.height / 2;
      id = e.pointerId;
      lastDir = null;
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
      lastDir = null;
      knob.style.transform = 'translate(-50%, -50%)';
    };
    stick.addEventListener('pointerup', release);
    stick.addEventListener('pointercancel', release);
  }
}
