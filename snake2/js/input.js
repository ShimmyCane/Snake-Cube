// ════════════════════════════════════════════════════════════════════
//  INPUT — keys, swipes, and the on-screen d-pad. Each one becomes a turn
//  request via `onTurn(dir)`, or a pause via `onPause()`.
// ════════════════════════════════════════════════════════════════════

const KEY_DIRS = {
  ArrowUp: 0, w: 0, W: 0,
  ArrowDown: 1, s: 1, S: 1,
  ArrowLeft: 2, a: 2, A: 2,
  ArrowRight: 3, d: 3, D: 3,
};
const SWIPE_MIN_PX = 24;

function installInput(canvas, dpad, handlers) {
  document.addEventListener('keydown', e => {
    if (e.key in KEY_DIRS) {
      e.preventDefault();
      handlers.onTurn(DIRS[KEY_DIRS[e.key]]);
    } else if (e.key === 'p' || e.key === 'P' || e.key === 'Escape') {
      handlers.onPause();
    }
  });

  let start = null;
  canvas.addEventListener('touchstart', e => {
    const t = e.changedTouches[0];
    start = { x: t.clientX, y: t.clientY };
  }, { passive: true });
  canvas.addEventListener('touchend', e => {
    if (!start) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - start.x, dy = t.clientY - start.y;
    start = null;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < SWIPE_MIN_PX) return;
    const d = Math.abs(dx) > Math.abs(dy)
      ? (dx > 0 ? DIRS[3] : DIRS[2])
      : (dy > 0 ? DIRS[1] : DIRS[0]);
    handlers.onTurn(d);
  }, { passive: true });

  if (dpad) {
    dpad.querySelectorAll('[data-dir]').forEach(btn => {
      const d = DIRS.find(x => x.name === btn.dataset.dir);
      const fire = e => { e.preventDefault(); handlers.onTurn(d); };
      btn.addEventListener('touchstart', fire, { passive: false });
      btn.addEventListener('mousedown', fire);
    });
  }
}
