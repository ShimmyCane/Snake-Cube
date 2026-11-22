// ════════════════════════════════════════════════════════════════════
//  RULES — what happens to each snake this step. Pure, no DOM.
//  - A stone border kills a head.
//  - Two heads that touch: the smaller dies. Equal sizes both die.
//  - A head that touches another snake's body bumps it: the body is cut at the
//    contact point and the pieces beyond it fall away. The bumper is not hurt.
//  - A snake's own body never hurts it. Overlapping your own body is allowed.
// ════════════════════════════════════════════════════════════════════

// The other snake whose body a point at (x, y) touches, and where on that body.
// Returns { victim, arc } or null. `self` is never a victim.
function bodyContact(x, y, snakes, self, margin) {
  const reach = CFG2.HEAD_R + CFG2.BODY_R + (margin || 0);
  for (const o of snakes) {
    if (!o.alive || o === self) continue;
    const c = closestOnBody(o.trail, o.bodyLen, x, y);
    if (c.dist < reach) return { victim: o, arc: c.arc };
  }
  return null;
}

// Decide one step's outcome after every snake has moved.
// Returns { dead: [{ snake, reason }], bumps: [{ bumper, victim, arc }] }.
// reason: 'wall' | 'headon'.
function resolveTick(snakes) {
  const live = snakes.filter(s => s.alive);
  const dead = new Map();

  for (const s of live) {
    if (!inPlayArea(s.x, s.y, CFG2.HEAD_R)) dead.set(s, 'wall');
  }

  // Two heads that touch: the smaller dies. Equal sizes both die.
  for (let i = 0; i < live.length; i++) {
    for (let j = i + 1; j < live.length; j++) {
      const a = live[i], b = live[j];
      if (dead.has(a) || dead.has(b)) continue;
      if (Math.hypot(a.x - b.x, a.y - b.y) >= 2 * CFG2.HEAD_R) continue;
      if (a.value === b.value) {
        dead.set(a, 'headon');
        dead.set(b, 'headon');
      } else {
        dead.set(a.value < b.value ? a : b, 'headon');
      }
    }
  }

  // A head that touches another body bumps it.
  const bumps = [];
  for (const s of live) {
    if (dead.has(s)) continue;
    const hit = bodyContact(s.x, s.y, live, s, 0);
    if (hit) bumps.push({ bumper: s, victim: hit.victim, arc: hit.arc });
  }

  return {
    dead: [...dead.entries()].map(([snake, reason]) => ({ snake, reason })),
    bumps,
  };
}
