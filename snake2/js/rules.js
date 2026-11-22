// ════════════════════════════════════════════════════════════════════
//  RULES — who crashes this step. Pure, no DOM.
//  A crash is a head that comes too close to a stone wall, another head,
//  or a body. A snake's own neck (its first tiles) never counts against it.
// ════════════════════════════════════════════════════════════════════

// The first snake body that a point at (x, y) touches, or null.
// `self` is the snake the point belongs to: its neck is skipped.
// Returns 'self', 'body', or null.
function bodyHit(x, y, snakes, self, margin) {
  const reach = CFG2.HEAD_R + CFG2.BODY_R + (margin || 0);
  for (const o of snakes) {
    if (!o.alive) continue;
    const skip = o === self ? CFG2.NECK_ARC : 0;
    for (const seg of trailSegments(o.trail, o.bodyLen, skip)) {
      if (segDist(x, y, seg.ax, seg.ay, seg.bx, seg.by) < reach) return o === self ? 'self' : 'body';
    }
  }
  return null;
}

// Decide crashes for one step, after every snake has moved.
// Returns { dead: [{ snake, reason }] }. reason: 'wall' | 'self' | 'body' | 'headon'.
function resolveTick(snakes) {
  const live = snakes.filter(s => s.alive);
  const dead = new Map();

  for (const s of live) {
    if (!inPlayArea(s.x, s.y, CFG2.HEAD_R)) dead.set(s, 'wall');
  }

  // Two heads that touch: both crash.
  for (let i = 0; i < live.length; i++) {
    for (let j = i + 1; j < live.length; j++) {
      const a = live[i], b = live[j];
      if (dead.has(a) || dead.has(b)) continue;
      if (Math.hypot(a.x - b.x, a.y - b.y) < 2 * CFG2.HEAD_R) {
        dead.set(a, 'headon');
        dead.set(b, 'headon');
      }
    }
  }

  // A head that touches a body: the head's snake crashes.
  for (const s of live) {
    if (dead.has(s)) continue;
    const hit = bodyHit(s.x, s.y, live, s, 0);
    if (hit) dead.set(s, hit);
  }

  return {
    dead: [...dead.entries()].map(([snake, reason]) => ({ snake, reason })),
  };
}
