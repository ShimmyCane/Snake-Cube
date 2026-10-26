// ════════════════════════════════════════════════════════════════════
//  SNAKE — the snake model. Pure, no DOM.
//
//  Invariant (checked by the tests after every step):
//     cells.length + pendingGrow === romanLength(value)
//  The body is never stored as symbols; the numeral is read from value.
// ════════════════════════════════════════════════════════════════════

function newSnake2(opts) {
  return {
    id: opts.id,
    name: opts.name,
    isPlayer: !!opts.isPlayer,
    colour: opts.colour,
    value: CFG2.START_VALUE,
    cells: [{ c: opts.c, r: opts.r }],        // head first
    prevCells: null,                          // last tick's cells, for smooth drawing
    dir: { dc: opts.dc, dr: opts.dr },
    turnQueue: [],                            // player only
    pendingGrow: 0,
    alive: true,
    respawnAt: 0,                             // bots only
  };
}

function snakeHead(s) {
  return s.cells[0];
}

function snakeTail(s) {
  return s.cells[s.cells.length - 1];
}

// The numeral symbol drawn on body cell i (0 = head).
function symbolAt(s, i) {
  return toRoman(s.value)[i] || '';
}

// Set a new value and rewrite the body to match the numeral.
// Longer numeral: cells are added from the tail over the next ticks (pendingGrow).
// Shorter numeral: the extra tail cells drop off at once (a collapse).
// Returns { from, to, dropped } when cells were dropped, otherwise null.
function setValue(s, newValue) {
  const from = s.value;
  s.value = newValue;
  const target = romanLength(newValue);
  if (target >= s.cells.length) {
    s.pendingGrow = target - s.cells.length;
    return null;
  }
  const dropped = s.cells.length - target;
  s.cells.length = target;
  s.pendingGrow = 0;
  return { from, to: newValue, dropped };
}

// Where the head will be after this tick, before collisions are checked.
function plannedHead(s) {
  const h = snakeHead(s);
  return { c: h.c + s.dir.dc, r: h.r + s.dir.dr };
}

// Apply a queued player turn. Reversals are refused. The queue is capped.
function queueTurn(s, dir) {
  const last = s.turnQueue.length ? s.turnQueue[s.turnQueue.length - 1] : s.dir;
  if (isReverse(last, dir)) return false;
  if (last.dc === dir.dc && last.dr === dir.dr) return false;
  if (s.turnQueue.length >= CFG2.TURN_QUEUE) return false;
  s.turnQueue.push(dir);
  return true;
}

// Take the next queued turn, if any, as the snake's direction for this tick.
function takeTurn(s) {
  if (s.turnQueue.length) {
    const d = s.turnQueue.shift();
    s.dir = { dc: d.dc, dr: d.dr };
  }
}

// Move the snake one cell to `nh`. Eating skips the tail pop, so the body grows.
// Otherwise the tail pops, unless growth is still pending.
function moveSnake(s, nh, eating) {
  s.prevCells = s.cells.map(c => ({ c: c.c, r: c.r }));
  s.cells.unshift({ c: nh.c, r: nh.r });
  if (eating) return;
  if (s.pendingGrow > 0) s.pendingGrow -= 1;
  else s.cells.pop();
}
