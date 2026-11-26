// ════════════════════════════════════════════════════════════════════
//  RULES — what goes wrong for each snake this step. Pure, no DOM.
//  - There is no border. The world goes on forever.
//  - A head that touches an artifact crashes.
//  - Two heads that touch: the smaller crashes. Equal sizes both crash.
//  - A head that touches another snake's body bumps it: the body is cut at the
//    contact point and the pieces beyond it fall away. The bumper is not hurt.
//  - A snake's own body never hurts it. Overlapping your own body is allowed.
//  A crash is not a death. The game (game.js) takes one or two symbols off the head
//  instead, and a snake dies only when no symbol is left. A snake that has just crashed
//  has a short grace (`grace` steps), so one crash cannot be counted twice.
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

// Decide one step's crashes and bumps after every snake has moved.
// `obstacleAt(x, y, margin)` returns the artifact a head of that margin touches, or null.
// Returns { crashes: [{ snake, reason }], bumps: [{ bumper, victim, arc }] }.
// reason: 'artifact' | 'headon'.
function resolveTick(snakes, obstacleAt) {
  const live = snakes.filter(s => s.alive);
  const hit = new Map();
  const crash = (s, reason) => {
    if (s.grace > 0 || hit.has(s)) return;
    hit.set(s, reason);
  };

  for (const s of live) {
    if (obstacleAt && obstacleAt(s.x, s.y, CFG2.HEAD_R)) crash(s, 'artifact');
  }

  // Two heads that touch: the smaller crashes. Equal sizes both crash.
  for (let i = 0; i < live.length; i++) {
    for (let j = i + 1; j < live.length; j++) {
      const a = live[i], b = live[j];
      if (Math.hypot(a.x - b.x, a.y - b.y) >= 2 * CFG2.HEAD_R) continue;
      if (a.value === b.value) {
        crash(a, 'headon');
        crash(b, 'headon');
      } else {
        crash(a.value < b.value ? a : b, 'headon');
      }
    }
  }

  // A head that touches another body bumps it.
  const bumps = [];
  for (const s of live) {
    if (hit.has(s)) continue;
    const contact = bodyContact(s.x, s.y, live, s, 0);
    if (contact) bumps.push({ bumper: s, victim: contact.victim, arc: contact.arc });
  }

  return {
    crashes: [...hit.entries()].map(([snake, reason]) => ({ snake, reason })),
    bumps,
  };
}
