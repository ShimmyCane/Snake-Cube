// ════════════════════════════════════════════════════════════════════
//  RENDER — the cartoon world on a 2-D canvas. Reads G, never changes it.
//  Positions are in world tiles; cam.x / cam.y is the world point at the top-left.
// ════════════════════════════════════════════════════════════════════

const FLOOR = '#f4e7c5';
const STONE = '#8c8273';
const STONE_EDGE = '#5b5246';
const INK = '#2b2118';
const COIN = '#f7c948';
const FLOOR_DOT = '#e6d6ad';

// Whether a symbol is a ligature (IV, CM…) once its overlines are taken off. Those get a smaller font.
const isLigature = text => text.replace(/\u0305/g, '').length === 2;

// Floor: plain, with a dot every two tiles so the scrolling shows. The world has no edge.
function drawFloor(ctx, cam, cellPx, view) {
  ctx.fillStyle = FLOOR;
  ctx.fillRect(0, 0, view.w * cellPx, view.h * cellPx);
  ctx.fillStyle = FLOOR_DOT;
  for (let c = Math.ceil(cam.x / 2) * 2; c <= cam.x + view.w; c += 2) {
    for (let r = Math.ceil(cam.y / 2) * 2; r <= cam.y + view.h; r += 2) {
      ctx.fillRect((c - cam.x) * cellPx - 1.5, (r - cam.y) * cellPx - 1.5, 3, 3);
    }
  }
}

// An artifact: a broken stone column, or a clay amphora. Its shadow sits under it.
function drawArtifact(ctx, ob, cam, cellPx) {
  const cx = (ob.x - cam.x) * cellPx, cy = (ob.y - cam.y) * cellPx;
  const r = ob.r * cellPx;
  ctx.fillStyle = 'rgba(43, 33, 24, 0.18)';
  ctx.beginPath(); ctx.ellipse(cx, cy + r * 0.8, r * 0.95, r * 0.4, 0, 0, Math.PI * 2); ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = INK;
  if (ob.kind === 'column') {
    ctx.fillStyle = STONE;
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.strokeStyle = STONE_EDGE;
    ctx.beginPath(); ctx.arc(cx, cy, r * 0.55, 0, Math.PI * 2); ctx.stroke();
  } else {
    ctx.fillStyle = '#c0703f';
    ctx.beginPath(); ctx.ellipse(cx, cy, r * 0.8, r, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cx - r * 0.3, cy - r * 0.95); ctx.lineTo(cx + r * 0.3, cy - r * 0.95); ctx.lineTo(cx + r * 0.25, cy - r * 1.3); ctx.lineTo(cx - r * 0.25, cy - r * 1.3); ctx.closePath(); ctx.fill(); ctx.stroke();
  }
}

// The artifacts on screen. They are the obstacles a head can crash into.
function drawArtifacts(ctx, G, cam, cellPx, view) {
  for (const ob of artifactsBetween(G, cam.x, cam.y, cam.x + view.w, cam.y + view.h)) drawArtifact(ctx, ob, cam, cellPx);
}

// White text on the dark symbol colours, ink on the light ones.
function textColourFor(text) {
  const c = text[0];
  return c === 'X' || c === 'L' || c === 'C' || c === 'D' ? '#ffffff' : INK;
}

// Colour for a symbol. A ligature takes the colour of its first letter (IV is green like I).
function symbolColour(text) {
  return SYMBOL_COLOURS[text[0]] || '#999999';
}

// Coins carry the colour of their symbol, so I, V, X, L, C, D and M read at a glance.
// A crashed snake's pieces fly out from where the body was: eased, with a little arc.
function drawSnacks(ctx, G, cam, cellPx, now) {
  const bob = Math.sin(now / 260) * cellPx * 0.04;
  for (const sn of G.snacks) {
    let x = sn.x, y = sn.y, lift = 0;
    if (sn.piece) {
      const p = Math.min(1, (now - sn.born) / CFG2.SHATTER_FLY_MS);
      const ease = 1 - Math.pow(1 - p, 3);
      x = sn.fromX + (sn.x - sn.fromX) * ease;
      y = sn.fromY + (sn.y - sn.fromY) * ease;
      lift = Math.sin(Math.PI * p) * cellPx * 0.7;
    }
    const cx = (x - cam.x) * cellPx;
    const cy = (y - cam.y) * cellPx + bob - lift;
    const text = toRoman(sn.value);
    const rad = cellPx * 0.4;
    ctx.fillStyle = symbolColour(text);
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.arc(cx, cy, rad, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    // A thin gold rim marks it as a coin
    ctx.strokeStyle = COIN;
    ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(cx, cy, rad - 3, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = textColourFor(text);
    ctx.font = `bold ${Math.round(cellPx * (isLigature(text) ? 0.34 : 0.45))}px Georgia, serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, cx, cy + 1);
  }
}

// The small explosion where a snake crashed: a ring and a few sparks.
function drawBursts(ctx, G, cam, cellPx, now) {
  for (const b of G.bursts) {
    const age = (now - b.at) / CFG2.BURST_MS;
    if (age < 0 || age >= 1) continue;
    const cx = (b.x - cam.x) * cellPx;
    const cy = (b.y - cam.y) * cellPx;
    ctx.globalAlpha = 1 - age;
    ctx.strokeStyle = '#ff9f1c';
    ctx.lineWidth = 4;
    ctx.beginPath(); ctx.arc(cx, cy, cellPx * (0.4 + age * CFG2.SHATTER_RADIUS), 0, Math.PI * 2); ctx.stroke();
    ctx.strokeStyle = '#fff8e1';
    ctx.lineWidth = 3;
    for (let k = 0; k < 8; k++) {
      const ang = (k / 8) * Math.PI * 2 + 0.3;
      const r0 = cellPx * (0.3 + age * 1.6), r1 = r0 + cellPx * 0.35;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(ang) * r0, cy + Math.sin(ang) * r0);
      ctx.lineTo(cx + Math.cos(ang) * r1, cy + Math.sin(ang) * r1);
      ctx.stroke();
    }
  }
  ctx.globalAlpha = 1;
}

// Eyes look the way the snake is heading. (ux, uy) is the unit heading.
function drawFace(ctx, cx, cy, size, ux, uy) {
  const ex = ux * size * 0.18, ey = uy * size * 0.18;
  const px = -uy * size * 0.18, py = ux * size * 0.18;
  for (const side of [-1, 1]) {
    const x = cx + ex + px * side, y = cy + ey + py * side;
    ctx.fillStyle = '#ffffff';
    ctx.beginPath(); ctx.arc(x, y, size * 0.13, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = INK;
    ctx.beginPath(); ctx.arc(x + ux * size * 0.04, y + uy * size * 0.04, size * 0.06, 0, Math.PI * 2); ctx.fill();
  }
}

// One body symbol. The head is index 0 and carries the first symbol of the numeral.
function drawSymbol(ctx, s, text, cx, cy, cellPx, isHead) {
  const size = cellPx * (isHead ? 0.98 : 0.84);
  if (isHead) {
    // Coloured ring: tells the head's owner apart from the others
    ctx.strokeStyle = s.colour;
    ctx.lineWidth = Math.max(3, cellPx * 0.12);
    ctx.beginPath();
    ctx.roundRect(cx - size / 2 - 2, cy - size / 2 - 2, size + 4, size + 4, size * 0.3);
    ctx.stroke();
  }
  ctx.lineWidth = isHead ? 3 : 2;
  ctx.strokeStyle = INK;
  ctx.fillStyle = symbolColour(text);
  ctx.beginPath();
  ctx.roundRect(cx - size / 2, cy - size / 2, size, size, size * 0.25);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = textColourFor(text);
  // Two-letter ligatures get a smaller font so they fit one symbol. On the head, the
  // letter sits low and the eyes high, so the head still reads as part of the number.
  const font = isLigature(text) ? 0.4 : 0.55;
  ctx.font = `bold ${Math.round(cellPx * (isHead ? font * 0.85 : font))}px Georgia, serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, cx, cy + (isHead ? size * 0.17 : 1));
  if (isHead) drawFace(ctx, cx, cy - size * 0.17, size, Math.cos(s.angle), Math.sin(s.angle));
}

// Symbol k at time t: eased between the last step and this one.
function symbolAt(s, k, t, cam, cellPx) {
  const cur = s.symPts[k];
  const prev = s.prevSymPts && s.prevSymPts[k];
  const x = prev ? prev.x + (cur.x - prev.x) * t : cur.x;
  const y = prev ? prev.y + (cur.y - prev.y) * t : cur.y;
  return { cx: (x - cam.x) * cellPx, cy: (y - cam.y) * cellPx };
}

function drawSnake(ctx, G, s, cam, cellPx, t) {
  // One symbol per point. Tail first, so the head sits on top.
  const tokens = numeralTokens(s.value);
  for (let k = s.symPts.length - 1; k >= 0; k--) {
    const tok = tokens[k];
    const p = symbolAt(s, k, t, cam, cellPx);
    drawSymbol(ctx, s, tok ? tok.text : '', p.cx, p.cy, cellPx, k === 0);
  }
}

function drawPops(ctx, G, cam, cellPx, now) {
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for (const p of G.pops) {
    const age = (now - p.at) / 900;
    const x = (p.x - cam.x) * cellPx;
    const y = (p.y - cam.y) * cellPx - age * cellPx * 1.5;
    ctx.globalAlpha = Math.max(0, 1 - age);
    ctx.font = `bold ${Math.round(cellPx * 0.5)}px Georgia, serif`;
    ctx.lineWidth = 4;
    ctx.strokeStyle = INK;
    ctx.strokeText(p.text, x, y);
    ctx.fillStyle = '#fff8e1';
    ctx.fillText(p.text, x, y);
  }
  ctx.globalAlpha = 1;
}

// Draws one frame. `t` is how far between two steps we are, 0..1.
function renderBoard(ctx, G, cam, cellPx, view, t, now) {
  drawFloor(ctx, cam, cellPx, view);
  drawArtifacts(ctx, G, cam, cellPx, view);
  drawSnacks(ctx, G, cam, cellPx, now);
  for (const s of G.snakes) if (s.alive) drawSnake(ctx, G, s, cam, cellPx, t);
  drawBursts(ctx, G, cam, cellPx, now);
  drawPops(ctx, G, cam, cellPx, now);
}

// Small overview: a window of the world, centred on the player.
function renderMinimap(ctx, G, size) {
  const span = CFG2.MINI_SPAN;
  const k = size / span;
  const x0 = G.player.x - span / 2, y0 = G.player.y - span / 2;
  const inside = (x, y) => x >= x0 - 1 && x <= x0 + span + 1 && y >= y0 - 1 && y <= y0 + span + 1;
  ctx.fillStyle = FLOOR;
  ctx.fillRect(0, 0, size, size);
  ctx.fillStyle = STONE;
  for (const ob of artifactsBetween(G, x0, y0, x0 + span, y0 + span)) {
    ctx.fillRect((ob.x - x0) * k - 2, (ob.y - y0) * k - 2, 4, 4);
  }
  ctx.fillStyle = COIN;
  for (const sn of G.snacks) if (inside(sn.x, sn.y)) ctx.fillRect((sn.x - x0) * k - 1, (sn.y - y0) * k - 1, 2, 2);
  for (const s of G.snakes) {
    if (!s.alive || !inside(s.x, s.y)) continue;
    ctx.fillStyle = s.isPlayer ? PLAYER_COLOUR : s.colour;
    ctx.fillRect((s.x - x0) * k - 2, (s.y - y0) * k - 2, 4, 4);
  }
}
