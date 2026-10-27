// ════════════════════════════════════════════════════════════════════
//  GRID — board, walls, cell keys, and a seeded random source.
//  Pure, no DOM.
// ════════════════════════════════════════════════════════════════════

const DIRS = [
  { dc: 0, dr: -1, name: 'up' },
  { dc: 0, dr: 1, name: 'down' },
  { dc: -1, dr: 0, name: 'left' },
  { dc: 1, dr: 0, name: 'right' },
];

function isWall(c, r) {
  return c <= 0 || r <= 0 || c >= CFG2.COLS - 1 || r >= CFG2.ROWS - 1;
}

function cellKey(c, r) {
  return c + ',' + r;
}

function sameCell(a, b) {
  return a.c === b.c && a.r === b.r;
}

function isReverse(a, b) {
  return a.dc === -b.dc && a.dr === -b.dr;
}

// mulberry32: small, fast, and repeatable from a seed. Tests and replays use it.
function makeRng(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// A free playable cell within `radius` of `centre`, not in `blocked`. Null if none turns up.
function freeCellNear(rng, centre, radius, blocked) {
  for (let i = 0; i < 80; i++) {
    const dc = Math.round((rng() * 2 - 1) * radius);
    const dr = Math.round((rng() * 2 - 1) * radius);
    if (Math.hypot(dc, dr) > radius) continue;
    const c = centre.c + dc, r = centre.r + dr;
    if (isWall(c, r) || blocked.has(cellKey(c, r))) continue;
    return { c, r };
  }
  return null;
}

// A random free playable cell that is not in `blocked` (a Set of cell keys).
// Returns null if the board is too full to find one.
function randomFreeCell(rng, blocked) {
  for (let i = 0; i < 5000; i++) {
    const c = 1 + Math.floor(rng() * (CFG2.COLS - 2));
    const r = 1 + Math.floor(rng() * (CFG2.ROWS - 2));
    if (!blocked.has(cellKey(c, r))) return { c, r };
  }
  return null;
}
