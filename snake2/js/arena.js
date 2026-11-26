// ════════════════════════════════════════════════════════════════════
//  ARENA — the endless world: artifacts scattered over it, random spots, and a seeded
//  random source. Pure, no DOM.
//
//  There is no border. The world is cut into square cells, and each cell may hold one
//  artifact (a broken column or an amphora). Artifacts are made from the seed and the
//  cell's position, so the same seed always gives the same map, and it never runs out.
// ════════════════════════════════════════════════════════════════════

// The artifact kinds. `r` is the radius of the obstacle, in tiles.
const ARTIFACT_KINDS = {
  column:  { r: 0.8 },   // a stone column: broad and heavy
  amphora: { r: 0.6 },   // a clay jar: narrower
};

// A random point in the disc of `radius` around centre c, spread evenly over its area.
function randomPointNear(rng, c, radius) {
  const r = Math.sqrt(rng()) * radius;
  const a = rng() * TAU;
  return { x: c.x + Math.cos(a) * r, y: c.y + Math.sin(a) * r };
}

// A seed for one cell, mixed from the world seed and the cell's column and row.
function cellSeed(seed, cx, cy) {
  let h = Math.imul((seed | 0) ^ 0x9e3779b9, 0x85ebca6b);
  h = Math.imul(h ^ (cx | 0), 0xc2b2ae35);
  h = Math.imul(h ^ (h >>> 13), 0x27d4eb2f);
  h = Math.imul(h ^ (cy | 0), 0x165667b1);
  h = Math.imul(h ^ (h >>> 16), 0x85ebca6b);
  return (h ^ (h >>> 15)) >>> 0;
}

// The artifacts in one cell of the world. Same seed and cell, same artifacts. The start stays clear.
function artifactsInCell(seed, cx, cy) {
  const rng = makeRng(cellSeed(seed, cx, cy));
  if (rng() >= CFG2.ARTIFACT_CHANCE) return [];
  const x = cx * CFG2.CELL + 1.5 + rng() * (CFG2.CELL - 3);
  const y = cy * CFG2.CELL + 1.5 + rng() * (CFG2.CELL - 3);
  if (Math.hypot(x, y) < CFG2.ARTIFACT_SAFE) return [];
  const kind = rng() < 0.5 ? 'column' : 'amphora';
  return [{ x, y, r: ARTIFACT_KINDS[kind].r, kind }];
}

// The artifacts in cell (cx, cy) of this game, made once and then remembered.
function cellArtifacts(G, cx, cy) {
  const key = cx + ',' + cy;
  let list = G.cells.get(key);
  if (!list) {
    list = artifactsInCell(G.seed, cx, cy);
    G.cells.set(key, list);
  }
  return list;
}

// The artifact a point is touching, if any. `margin` is the reach of the thing being
// checked (a head's radius, or some clearance). Returns the artifact or null.
function obstacleAt(G, x, y, margin) {
  const pad = margin + CFG2.ARTIFACT_MAX_R;
  const c0 = Math.floor((x - pad) / CFG2.CELL), c1 = Math.floor((x + pad) / CFG2.CELL);
  const r0 = Math.floor((y - pad) / CFG2.CELL), r1 = Math.floor((y + pad) / CFG2.CELL);
  for (let cx = c0; cx <= c1; cx++) {
    for (let cy = r0; cy <= r1; cy++) {
      for (const ob of cellArtifacts(G, cx, cy)) {
        if (Math.hypot(ob.x - x, ob.y - y) < margin + ob.r) return ob;
      }
    }
  }
  return null;
}

// Every artifact whose cell overlaps the box x0..x1, y0..y1. Used to draw the view and the minimap.
function artifactsBetween(G, x0, y0, x1, y1) {
  const out = [];
  for (let cx = Math.floor(x0 / CFG2.CELL) - 1; cx <= Math.floor(x1 / CFG2.CELL) + 1; cx++) {
    for (let cy = Math.floor(y0 / CFG2.CELL) - 1; cy <= Math.floor(y1 / CFG2.CELL) + 1; cy++) {
      for (const ob of cellArtifacts(G, cx, cy)) out.push(ob);
    }
  }
  return out;
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
