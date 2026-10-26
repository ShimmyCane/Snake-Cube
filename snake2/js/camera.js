// ════════════════════════════════════════════════════════════════════
//  CAMERA — follows the player, never shows past the walls.
//  The board is bigger than a phone screen (plan section 9).
// ════════════════════════════════════════════════════════════════════

// Cell size that keeps about 15 cells across and 22 down, within the limits.
function cellSizeFor(width, height) {
  const fit = Math.floor(Math.min(width / 15, height / 22));
  return Math.max(CFG2.CELL_PX_MIN, Math.min(CFG2.CELL_PX_MAX, fit));
}

// Cells that fit on screen at this cell size.
function viewCells(width, height, cellPx) {
  return { w: width / cellPx, h: height / cellPx };
}

// Smoothly move the camera so the player's head sits near the middle.
// cam.x / cam.y are the top-left cell of the view, in board cells.
function updateCamera(cam, G, view) {
  const h = snakeHead(G.player);
  const tx = h.c + 0.5 - view.w / 2;
  const ty = h.r + 0.5 - view.h / 2;
  const clampAxis = (t, size, board) => {
    if (size >= board) return (board - size) / 2;   // whole board fits: centre it
    return Math.max(0, Math.min(board - size, t));
  };
  const goalX = clampAxis(tx, view.w, CFG2.COLS);
  const goalY = clampAxis(ty, view.h, CFG2.ROWS);
  if (cam.x === undefined) { cam.x = goalX; cam.y = goalY; }
  cam.x += (goalX - cam.x) * 0.25;
  cam.y += (goalY - cam.y) * 0.25;
}
