// ════════════════════════════════════════════════════════════════════
//  BOTS — choose where to turn. Pure, no DOM.
//  Each step a bot looks at directions it could turn to, measures how far it can go
//  clear in each, and leans toward the nearest snack it can eat. Bots never chase the player.
// ════════════════════════════════════════════════════════════════════

const BOT_HEADINGS = 24;           // candidate headings, evenly spaced
const BOT_LOOK = 6;            // how far ahead a bot checks, in tiles
const BOT_PROBE = 0.5;         // spacing of the checks along that line
const BOT_SNACK_RANGE = 12;    // a bot goes for snacks this close
const BOT_TURN_LIMIT = 2.1;    // no candidate turns more than this (about 120 degrees) in one go

// How far from (x, y) along `angle` the way stays clear, up to BOT_LOOK.
function clearance(x, y, angle, snakes, self) {
  const dx = Math.cos(angle), dy = Math.sin(angle);
  for (let t = BOT_PROBE; t <= BOT_LOOK; t += BOT_PROBE) {
    const px = x + dx * t, py = y + dy * t;
    if (!inPlayArea(px, py, CFG2.HEAD_R + 0.2) || bodyContact(px, py, snakes, self, 0.2)) return t - BOT_PROBE;
  }
  return BOT_LOOK;
}

// The heading a bot should aim for this step.
function botChooseAim(bot, G) {
  let desired = null, nearest = BOT_SNACK_RANGE;
  const minValue = minEatable(bot.value);
  for (const sn of G.snacks) {
    if (sn.value < minValue) continue;
    const d = Math.hypot(sn.x - bot.x, sn.y - bot.y);
    if (d < nearest) { nearest = d; desired = Math.atan2(sn.y - bot.y, sn.x - bot.x); }
  }

  let pick = null, score = -Infinity;
  for (let i = 0; i < BOT_HEADINGS; i++) {
    const a = (i / BOT_HEADINGS) * TAU;
    if (Math.abs(angleDiff(bot.angle, a)) > BOT_TURN_LIMIT) continue;
    const room = clearance(bot.x, bot.y, a, G.snakes, bot);
    if (room < 1) continue;
    let sc = room;
    if (desired !== null) sc -= 2 * Math.abs(angleDiff(a, desired));
    if (sc > score) { score = sc; pick = a; }
  }
  return pick === null ? bot.angle : pick;
}
