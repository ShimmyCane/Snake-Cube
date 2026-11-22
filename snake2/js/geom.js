// ════════════════════════════════════════════════════════════════════
//  GEOM — angles, distances and trails, in board units. Pure, no DOM.
//  A trail is an array of {x, y} points: trail[0] is the head, and the
//  body follows the path back from it. Arc length is measured from the head.
// ════════════════════════════════════════════════════════════════════

const TAU = Math.PI * 2;

// An angle in (-PI, PI].
function wrapAngle(a) {
  let x = (a + Math.PI) % TAU;
  if (x < 0) x += TAU;
  return x - Math.PI;
}

// The signed turn from angle `from` to angle `to`, in (-PI, PI].
function angleDiff(from, to) {
  return wrapAngle(to - from);
}

// The angle of a screen or board offset, or null for no offset.
function angleFromOffset(dx, dy) {
  if (dx === 0 && dy === 0) return null;
  return Math.atan2(dy, dx);
}

// Distance from point p to segment a-b.
function segDist(px, py, ax, ay, bx, by) {
  const vx = bx - ax, vy = by - ay;
  const len2 = vx * vx + vy * vy;
  let t = len2 > 0 ? ((px - ax) * vx + (py - ay) * vy) / len2 : 0;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (ax + vx * t), py - (ay + vy * t));
}

// The point the given arc length from the head along the trail. Past the end, the last point.
function pointAtArc(trail, arc) {
  let travelled = 0;
  for (let i = 0; i + 1 < trail.length; i++) {
    const a = trail[i], b = trail[i + 1];
    const len = Math.hypot(b.x - a.x, b.y - a.y);
    if (travelled + len >= arc) {
      const t = len > 0 ? (arc - travelled) / len : 0;
      return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
    }
    travelled += len;
  }
  const last = trail[trail.length - 1];
  return { x: last.x, y: last.y };
}

// Drop the trail points beyond `maxArc` from the head. Changes the array in place.
function trimTrail(trail, maxArc) {
  let travelled = 0;
  for (let i = 0; i + 1 < trail.length; i++) {
    travelled += Math.hypot(trail[i + 1].x - trail[i].x, trail[i + 1].y - trail[i].y);
    if (travelled >= maxArc) {
      trail.length = i + 2;
      break;
    }
  }
  return trail;
}

// The segments of the body that can touch something: those that start before `bodyLen`
// and end after `skipArc` (the neck, for a snake's own body). Each is { ax, ay, bx, by }.
function trailSegments(trail, bodyLen, skipArc) {
  const out = [];
  let travelled = 0;
  for (let i = 0; i + 1 < trail.length; i++) {
    const a = trail[i], b = trail[i + 1];
    const len = Math.hypot(b.x - a.x, b.y - a.y);
    if (travelled >= bodyLen) break;
    if (travelled + len > skipArc) out.push({ ax: a.x, ay: a.y, bx: b.x, by: b.y });
    travelled += len;
  }
  return out;
}
