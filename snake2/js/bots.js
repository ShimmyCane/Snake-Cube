// ════════════════════════════════════════════════════════════════════
//  BOTS — pick a direction. Pure, no DOM.
//  Plan: schematic_snake2.md section 12. Bots never chase the player.
// ════════════════════════════════════════════════════════════════════

const BOT_BFS_CAP = 600;   // visited cells per search
const BOT_FLOOD_CAP = 200; // flood-fill cells per candidate

// Cells next to any other live head: a bot avoids stepping there.
function headDanger(snakes, self) {
  const danger = new Set();
  for (const s of snakes) {
    if (s === self || !s.alive) continue;
    const h = snakeHead(s);
    for (const d of DIRS) danger.add(cellKey(h.c + d.dc, h.r + d.dr));
  }
  return danger;
}

// Number of free cells reachable from (c, r), capped. Measures how roomy a move is.
function floodCount(c, r, blocked) {
  const seen = new Set([cellKey(c, r)]);
  const queue = [[c, r]];
  let i = 0;
  while (i < queue.length && seen.size < BOT_FLOOD_CAP) {
    const [x, y] = queue[i++];
    for (const d of DIRS) {
      const nx = x + d.dc, ny = y + d.dr;
      const k = cellKey(nx, ny);
      if (isWall(nx, ny) || blocked.has(k) || seen.has(k)) continue;
      seen.add(k);
      queue.push([nx, ny]);
    }
  }
  return seen.size;
}

// First step of a shortest path from the head to any snack, or null.
function firstStepToSnack(head, snackKeys, blocked) {
  const start = cellKey(head.c, head.r);
  const firstDir = new Map();
  const seen = new Set([start]);
  const queue = [{ c: head.c, r: head.r, first: null }];
  let i = 0;
  while (i < queue.length && seen.size < BOT_BFS_CAP) {
    const cur = queue[i++];
    if (cur.first && snackKeys.has(cellKey(cur.c, cur.r))) return cur.first;
    for (const d of DIRS) {
      const nc = cur.c + d.dc, nr = cur.r + d.dr;
      const k = cellKey(nc, nr);
      if (isWall(nc, nr) || blocked.has(k) || seen.has(k)) continue;
      seen.add(k);
      const first = cur.first || d;
      queue.push({ c: nc, r: nr, first });
    }
  }
  return null;
}

// Pick the next direction for a bot. `blocked` is the set of occupied cells.
function botChooseDir(bot, snakes, snackKeys, blocked) {
  const head = snakeHead(bot);
  const danger = headDanger(snakes, bot);
  const options = DIRS.filter(d => !isReverse(d, bot.dir));
  const safe = options.filter(d => {
    const c = head.c + d.dc, r = head.r + d.dr, k = cellKey(c, r);
    return !isWall(c, r) && !blocked.has(k) && !danger.has(k);
  });
  if (!safe.length) return bot.dir;   // no safe move: it will crash and respawn

  const toSnack = firstStepToSnack(head, snackKeys, blocked);
  if (toSnack && safe.some(d => d.dc === toSnack.dc && d.dr === toSnack.dr)) return toSnack;

  let best = safe[0], bestRoom = -1;
  for (const d of safe) {
    const room = floodCount(head.c + d.dc, head.r + d.dr, blocked);
    if (room > bestRoom) { bestRoom = room; best = d; }
  }
  return best;
}
