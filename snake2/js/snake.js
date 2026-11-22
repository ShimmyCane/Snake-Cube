// ════════════════════════════════════════════════════════════════════
//  SNAKE — the snake model. Pure, no DOM.
//
//  Invariant (checked by the tests): once the body has settled,
//     bodyLen === targetLen === (romanLength(value) - 1) * SYMBOL_STEP
//  The body is the trail behind the head. Each symbol sits SYMBOL_STEP further back.
// ════════════════════════════════════════════════════════════════════

function newSnake2(opts) {
  const s = {
    id: opts.id,
    name: opts.name,
    isPlayer: !!opts.isPlayer,
    colour: opts.colour,
    value: CFG2.START_VALUE,
    x: opts.x,
    y: opts.y,
    angle: opts.angle,            // where the head points now
    target: opts.angle,           // where the head is turning to
    trail: [{ x: opts.x, y: opts.y }],
    bodyLen: 0,                   // how far back the body reaches right now
    targetLen: 0,                 // how far back it must reach for the current numeral
    symPts: null,                 // where each symbol is, after the last step
    prevSymPts: null,             // where they were one step earlier, for smooth drawing
    alive: true,
    respawnAt: 0,                 // bots only
  };
  s.symPts = symbolPoints(s);
  return s;
}

// Body length a numeral needs: one symbol per SYMBOL_STEP, the head counts as the first.
function bodyLenFor(value) {
  return (romanLength(value) - 1) * CFG2.SYMBOL_STEP;
}

// Where each symbol is drawn: index 0 is the head. Symbols past the body's reach are left out.
function symbolPoints(s) {
  const n = romanLength(s.value);
  const pts = [];
  for (let k = 0; k < n; k++) {
    const arc = k * CFG2.SYMBOL_STEP;
    if (arc > s.bodyLen + 1e-6) break;
    pts.push(pointAtArc(s.trail, arc));
  }
  return pts;
}

// Set a new value. A longer numeral grows the body over the next steps (growBody).
// A shorter one drops the extra body at once: a collapse. Returns { from, to, dropped } then.
function setValue(s, newValue) {
  const from = s.value;
  s.value = newValue;
  s.targetLen = bodyLenFor(newValue);
  if (s.targetLen < s.bodyLen) {
    s.bodyLen = s.targetLen;
    return { from, to: newValue, dropped: romanLength(from) - romanLength(newValue) };
  }
  return null;
}

// Turn toward the target heading, by at most TURN_RATE.
function turnToward(s) {
  const d = angleDiff(s.angle, s.target);
  const step = Math.max(-CFG2.TURN_RATE, Math.min(CFG2.TURN_RATE, d));
  s.angle = wrapAngle(s.angle + step);
}

// Grow the body toward its target, a little each step.
function growBody(s) {
  if (s.bodyLen < s.targetLen) s.bodyLen = Math.min(s.targetLen, s.bodyLen + CFG2.GROW_PER_TICK);
}

// Move one step along the current heading, then grow and trim the trail.
function advanceSnake(s) {
  s.prevSymPts = s.symPts;
  s.x += Math.cos(s.angle) * CFG2.SPEED;
  s.y += Math.sin(s.angle) * CFG2.SPEED;
  s.trail.unshift({ x: s.x, y: s.y });
  growBody(s);
  trimTrail(s.trail, s.bodyLen + 2);
  s.symPts = symbolPoints(s);
}
