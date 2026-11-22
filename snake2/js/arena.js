// ════════════════════════════════════════════════════════════════════
//  ARENA — the stone border, random spots, and a seeded random source. Pure, no DOM.
// ════════════════════════════════════════════════════════════════════

// Inside the playing area, with `margin` to spare from the stone border.
function inPlayArea(x, y, margin) {
  const lo = CFG2.WALL_T + margin;
  const hi = CFG2.COLS - CFG2.WALL_T - margin;
  return x >= lo && x <= hi && y >= lo && y <= hi;
}

// The stone border, as whole tiles. Used only to draw the walls.
function isWallCell(c, r) {
  return c < CFG2.WALL_T || r < CFG2.WALL_T || c >= CFG2.COLS - CFG2.WALL_T || r >= CFG2.ROWS - CFG2.WALL_T;
}

// A random point inside the playing area, `margin` from the border.
function randomPoint(rng, margin) {
  const lo = CFG2.WALL_T + margin;
  const hi = CFG2.COLS - CFG2.WALL_T - margin;
  return { x: lo + rng() * (hi - lo), y: lo + rng() * (hi - lo) };
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
