// ════════════════════════════════════════════════════════════════════
//  RULES — who crashes this tick. Pure, no DOM.
//  Plan: schematic_snake2.md sections 3, 4 and 10.
// ════════════════════════════════════════════════════════════════════

// Cells that will still be occupied after this tick, mapped to their owner.
// A tail that is about to leave is excluded, so moving into it is allowed.
function occupiedCells(snakes) {
  const map = new Map();
  for (const s of snakes) {
    if (!s.alive) continue;
    const leavingTail = s.pendingGrow === 0 ? 1 : 0;
    const keep = s.cells.length - leavingTail;
    for (let i = 0; i < keep; i++) map.set(cellKey(s.cells[i].c, s.cells[i].r), s);
  }
  return map;
}

// Decide crashes for one tick. Each snake's dir must already be set.
// Returns { dead: [{ snake, reason }], next: Map(snake -> planned head) }.
// reason: 'wall' | 'self' | 'body' | 'headon'
function resolveTick(snakes) {
  const live = snakes.filter(s => s.alive);
  const next = new Map();
  for (const s of live) next.set(s, plannedHead(s));

  const owners = occupiedCells(live);
  const dead = new Map();

  for (const s of live) {
    const nh = next.get(s);
    if (isWall(nh.c, nh.r)) {
      dead.set(s, 'wall');
      continue;
    }
    const owner = owners.get(cellKey(nh.c, nh.r));
    if (owner) dead.set(s, owner === s ? 'self' : 'body');
  }

  // Two or more heads entering the same cell: all of them crash.
  const byCell = new Map();
  for (const s of live) {
    if (dead.has(s)) continue;
    const k = cellKey(next.get(s).c, next.get(s).r);
    if (!byCell.has(k)) byCell.set(k, []);
    byCell.get(k).push(s);
  }
  for (const group of byCell.values()) {
    if (group.length > 1) for (const s of group) dead.set(s, 'headon');
  }

  // Two heads swapping cells pass through each other: also a head-on.
  for (const a of live) {
    for (const b of live) {
      if (a === b || dead.has(a) || dead.has(b)) continue;
      const na = next.get(a), nb = next.get(b);
      if (sameCell(na, snakeHead(b)) && sameCell(nb, snakeHead(a))) {
        dead.set(a, 'headon');
        dead.set(b, 'headon');
      }
    }
  }

  return {
    dead: [...dead.entries()].map(([snake, reason]) => ({ snake, reason })),
    next,
  };
}
