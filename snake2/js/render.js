// ════════════════════════════════════════════════════════════════════
//  RENDER — the cartoon board on a 2-D canvas. Reads G, never changes it.
// ════════════════════════════════════════════════════════════════════

const FLOOR = '#f4e7c5';
const FLOOR_LINE = '#e6d4a6';
const STONE = '#8c8273';
const STONE_EDGE = '#5b5246';
const INK = '#2b2118';
const COIN = '#f7c948';
const COIN_EDGE = '#b8860b';

// Position of body cell i this frame: eased between last tick and this one.
function cellPoint(s, i, t) {
  const cur = s.cells[i];
  const prev = s.prevCells && s.prevCells[i];
  if (!prev) return { c: cur.c, r: cur.r };
  return { c: prev.c + (cur.c - prev.c) * t, r: prev.r + (cur.r - prev.r) * t };
}

function drawFloor(ctx, cam, cellPx, view) {
  ctx.fillStyle = FLOOR;
  ctx.fillRect(0, 0, view.w * cellPx, view.h * cellPx);
  ctx.strokeStyle = FLOOR_LINE;
  ctx.lineWidth = 1;
  const x0 = Math.floor(cam.x), y0 = Math.floor(cam.y);
  for (let c = x0; c <= x0 + view.w + 1; c++) {
    const x = (c - cam.x) * cellPx;
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, view.h * cellPx); ctx.stroke();
  }
  for (let r = y0; r <= y0 + view.h + 1; r++) {
    const y = (r - cam.y) * cellPx;
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(view.w * cellPx, y); ctx.stroke();
  }
}

// The stone wall ring: chunky blocks with a darker edge.
function drawWalls(ctx, cam, cellPx, view) {
  const x0 = Math.floor(cam.x), y0 = Math.floor(cam.y);
  for (let c = x0; c <= x0 + view.w + 1; c++) {
    for (let r = y0; r <= y0 + view.h + 1; r++) {
      if (!isWall(c, r)) continue;
      const x = (c - cam.x) * cellPx, y = (r - cam.y) * cellPx;
      ctx.fillStyle = STONE;
      ctx.strokeStyle = STONE_EDGE;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(x + 1, y + 1, cellPx - 2, cellPx - 2, cellPx * 0.18);
      ctx.fill();
      ctx.stroke();
    }
  }
}

function drawSnacks(ctx, G, cam, cellPx, now) {
  const bob = Math.sin(now / 260) * cellPx * 0.04;
  for (const sn of G.snacks) {
    const cx = (sn.c + 0.5 - cam.x) * cellPx;
    const cy = (sn.r + 0.5 - cam.y) * cellPx + bob;
    const rad = cellPx * 0.38;
    ctx.fillStyle = COIN;
    ctx.strokeStyle = COIN_EDGE;
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(cx, cy, rad, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.fillStyle = INK;
    ctx.font = `bold ${Math.round(cellPx * 0.42)}px Georgia, serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(toRoman(sn.value), cx, cy + 1);
  }
}

// Eyes look the way the snake is heading.
function drawFace(ctx, cx, cy, size, dir) {
  const ex = dir.dc * size * 0.18, ey = dir.dr * size * 0.18;
  const px = -dir.dr * size * 0.18, py = dir.dc * size * 0.18;
  for (const side of [-1, 1]) {
    const x = cx + ex + px * side, y = cy + ey + py * side;
    ctx.fillStyle = '#ffffff';
    ctx.beginPath(); ctx.arc(x, y, size * 0.13, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = INK;
    ctx.beginPath(); ctx.arc(x + dir.dc * size * 0.04, y + dir.dr * size * 0.04, size * 0.06, 0, Math.PI * 2); ctx.fill();
  }
}

// Colour for a ligature: the colour of its first symbol (IV is green like I).
function ligatureColour(text) {
  return SYMBOL_COLOURS[text[0]] || '#999999';
}

// Draw one body token. A ligature covers two cells with one rounded tile.
function drawToken(ctx, s, tok, cam, cellPx, t, isHead, dir) {
  const a = cellPoint(s, tok.start, t);
  const b = cellPoint(s, tok.start + tok.len - 1, t);
  const x0 = Math.min(a.c, b.c) + 0.5, x1 = Math.max(a.c, b.c) + 0.5;
  const y0 = Math.min(a.r, b.r) + 0.5, y1 = Math.max(a.r, b.r) + 0.5;
  const scale = isHead ? 0.98 : 0.9;
  const size = cellPx * scale;
  // Centre of the token, in screen pixels, and its box.
  const cx = ((x0 + x1) / 2 - cam.x) * cellPx;
  const cy = ((y0 + y1) / 2 - cam.y) * cellPx;
  const w = (x1 - x0) * cellPx + size;
  const h = (y1 - y0) * cellPx + size;
  const isLig = tok.len === 2;
  const fill = isLig ? ligatureColour(tok.text) : (SYMBOL_COLOURS[tok.text] || '#999999');

  if (isHead) {
    ctx.strokeStyle = s.colour;
    ctx.lineWidth = Math.max(3, cellPx * 0.12);
    ctx.beginPath();
    ctx.roundRect(cx - w / 2 - 2, cy - h / 2 - 2, w + 4, h + 4, size * 0.3);
    ctx.stroke();
  }
  ctx.lineWidth = isHead ? 3 : 2;
  ctx.strokeStyle = INK;
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.roundRect(cx - w / 2, cy - h / 2, w, h, Math.min(w, h) * 0.25);
  ctx.fill();
  ctx.stroke();

  const dark = tok.text === 'I' || tok.text === 'V' || tok.text === 'M' || tok.text === 'IV' || tok.text === 'IX';
  ctx.fillStyle = dark ? INK : '#ffffff';
  ctx.font = `bold ${Math.round(cellPx * (isLig ? 0.42 : 0.55))}px Georgia, serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(tok.text, cx, cy + 1);
  if (isHead) drawFace(ctx, cx, cy, size, dir);
}

function drawSnake(ctx, G, s, cam, cellPx, t) {
  // Tokens are drawn tail first, so the head sits on top.
  const tokens = numeralTokens(s.value).filter(tok => tok.start + tok.len <= s.cells.length);
  for (let i = tokens.length - 1; i >= 0; i--) {
    const tok = tokens[i];
    drawToken(ctx, s, tok, cam, cellPx, t, tok.start === 0, s.dir);
  }
}

function drawPops(ctx, G, cam, cellPx, now) {
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for (const p of G.pops) {
    const age = (now - p.at) / 900;
    const x = (p.c + 0.5 - cam.x) * cellPx;
    const y = (p.r + 0.5 - cam.y) * cellPx - age * cellPx * 1.5;
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

// Draws one frame. `t` is how far between two ticks we are, 0..1.
function renderBoard(ctx, G, cam, cellPx, view, t, now) {
  drawFloor(ctx, cam, cellPx, view);
  drawWalls(ctx, cam, cellPx, view);
  drawSnacks(ctx, G, cam, cellPx, now);
  for (const s of G.snakes) if (s.alive) drawSnake(ctx, G, s, cam, cellPx, t);
  drawPops(ctx, G, cam, cellPx, now);
}

// Small overview of the whole 50 × 50 board (plan section 9).
function renderMinimap(ctx, G, size) {
  const k = size / CFG2.COLS;
  ctx.fillStyle = FLOOR;
  ctx.fillRect(0, 0, size, size);
  ctx.fillStyle = STONE;
  ctx.fillRect(0, 0, size, k);
  ctx.fillRect(0, size - k, size, k);
  ctx.fillRect(0, 0, k, size);
  ctx.fillRect(size - k, 0, k, size);
  ctx.fillStyle = COIN;
  for (const sn of G.snacks) ctx.fillRect(sn.c * k, sn.r * k, Math.max(2, k), Math.max(2, k));
  for (const s of G.snakes) {
    if (!s.alive) continue;
    ctx.fillStyle = s.isPlayer ? PLAYER_COLOUR : s.colour;
    const h = snakeHead(s);
    ctx.fillRect(h.c * k - 1, h.r * k - 1, 4, 4);
  }
}
