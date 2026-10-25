// ════════════════════════════════════════════════════════════════════
//  FELIX'S SNAKE CUBES — v3.1.1
//  Architecture, data-flow, key objects, and section map:
//  → schematic.html
// ════════════════════════════════════════════════════════════════════

// ════════════════════════════════════════
//  TWEAK ZONE
// ════════════════════════════════════════
const CFG_AUDIO = {
  FOLDER:       'music/',
  PLAYLIST:     ['felix_piano_1.mp4', 'ying_piano_1.mp4', 'athena_piano_1.mp4', 'athena_piano_2.mp4', 'athena_piano_3.mp4'],
  VOLUME:       0.55,
  AUTO_SHUFFLE: true,
};
let WORLD_DENSITY = 1.5;
const CFG = {
  COLS: 160, ROWS: 160,
  TILE_W: 64, TILE_H: 32,
  CUBE_H: 26,
  TICK_MS: 174,
  BOT_SPEED: 0.30,
  NUM_BOTS: Math.round(16 * WORLD_DENSITY),
  BOT_MAX: Math.round(27 * WORLD_DENSITY),
  BOT_MIN: Math.round(10 * WORLD_DENSITY),
  BOT_LEN: 5,
  PLAYER_LEN: 1,
  FOOD_MAX: 80,
  FOOD_MS: 8000,            // snack drop every 8s
  FOOD_BATCH_PCT: 0.15,     // each drop = 15% of (FOOD_FIELD_MAX - current)
  FOOD_FIELD_MAX: Math.round(180 * WORLD_DENSITY),      // max snacks — bigger world
  BOT_SPAWN_MS: Math.round(15000 / WORLD_DENSITY),
  DIFFICULTY: 1.0,
  MERGE_EVERY: 4,
  ROUND_SEC: 180,           // 3 min default; harder modes and other modes add 2 min (see DIFF in multiplayer.js)
  BOT_RANGE: 56,            // bigger world → longer visible range
  BOT_CHASE_RANGE: 96,       // how far bots will chase before giving up
  BOT_FOOD_SCAN_MULT: 2.0,  // bots scan for food/specials within this × BOT_CHASE_RANGE (1–3)
  SPEED_LEN_FACTOR: 0.028,  // was 0.04 → -30%
  X2_INTERVAL_MS: 6000,   // was 20000 — more frequent
  BOOST_INTERVAL_MS: 12000, // was 25000 — more frequent
  BOOST_DURATION_MS: 30000,
  BOOST_FACTOR: 0.25,
  INVINC_INTERVAL_MS: 30000, // Pac-Man super orb spawn interval
  INVINC_DURATION_MS: 10000, // 10s invincibility
  INVINC_SPEED: 0.85,        // 15% speed boost during invincibility
  LEVEL_THRESHOLD: 1024,   // base, but milestones override below
  LEVEL_SPEED_MULT: 0.92,   // gentler speed increase per milestone
  RADAR_INTERVAL_MS: 8000,
  DOMINANCE_RATIO: 8,       // player head ≥ this × typical (median) bot head → growth boost for everyone else
  DOMINANCE_FOOD_MULT: 2,   // snack batch size multiplier while dominant (snacks also get bigger)
  BURST_DIST: 3.0,
  BURST_RECHARGE_MS: 5000,
  // ── Multiplayer ──
  MP_COOP_ROUND_SEC: 300,          // 5 min co-op
  MP_COMP_ROUND_SEC: 300,          // 5 min competitive
  MP_COMP_SPEED_ADV: 0.02,         // 2% speed advantage per level gap (competitive)
  MP_COMP_SPEED_ADV_MAX: 5,        // max level gap counted (max 10% bonus)
  MP_COOP_LARGE_BOT_VAL: 64,       // bot headVal threshold for co-op "big kill" bonus
  // ── Hook ──
  HOOK_TRAVEL_SEC: 1,              // seconds hook travels at full range
  HOOK_SPEED: 1.0,                 // world units per hook-tick (~60fps)
  HOOK_REEL_SPEED: 2.0,            // reel-in speed multiplier vs outward
  HOOK_COOLDOWN_MS: 4000,          // cooldown between hooks per snake
  JUMP_COOLDOWN_MS: 4000,          // cooldown between voluntary jumps
  // ── Tail Bullet ──
  TAIL_BULLET_SPEED: 3.5,
  TAIL_BULLET_COOLDOWN_MS: 1500,
  // ── Vacuum ──
  VACUUM_RANGE: 12.0,
  VACUUM_DURATION_MS: 15000,
  VACUUM_SPEED: 1.1,
  VACUUM_INTERVAL_MS: 3000,
  // ── Terrain ──
  TERRAIN_Z_SCALE: 5.0,            // Athena rolling hills vertical scale (dev slider)
  // ── Player start value ──
  PLAYER_START_VAL: 2,            // player's starting head value, endgame updates this inside game-core.js
};
const CFG_EXPERT = {
  NUM_BOTS: Math.round(24 * WORLD_DENSITY),
  BOT_MAX: Math.round(40 * WORLD_DENSITY),
  BOT_MIN: Math.round(16 * WORLD_DENSITY),
  BOT_SPAWN_MS: Math.round(15000 / WORLD_DENSITY),
  DIFF_MIN: 2.0,
  DIFF_MAX: 8.0,
};
let EXPERT_MODE = false;
let HOOK_ENABLED = false;
let TAILBULLET_ENABLED = false;
let RADAR_ALWAYS_ON = false;
let BONUS_SIZE_MULT = 2.0;
// Density multiplier: 0.5–2.0, default 1.0 — set by slider
let DENSITY_MULT = 1.0;
// ════════════════════════════════════════



// Tiered city pools — bots named by difficulty/context
const CITIES_US = [
  'Austin','Denver','Boston','Seattle','Phoenix','Dallas','Chicago',
  'Atlanta','Detroit','Miami','Portland','Houston','Memphis','Nashville',
  'Vegas','Raleigh','Tampa','Tucson','Fresno','Omaha','Tulsa','Reno',
  'Boise','Salem','Albany','Trenton','Helena','Pierre','Juneau','Dover',
];
const CITIES_WORLD = [
  'London','Paris','Berlin','Madrid','Rome','Sydney','Toronto','Tokyo',
  'Seoul','Mumbai','Cairo','Lagos','Moscow','Beijing','Dubai','Bangkok',
  'Lima','Bogota','Jakarta','Manila','Nairobi','Accra','Kinshasa',
  'Tehran','Riyadh','Athens','Vienna','Warsaw','Lisbon','Prague',
];
const CITIES_OBSCURE = [
  'Tbilisi','Ulaanbaatar','Dushanbe','Ashgabat','Bishkek','Vientiane',
  'Paramaribo','Libreville','Ouagadougou','Conakry','Bangui','Niamey',
  'Ndjamena','Asmara','Djibouti','Antananarivo','Lilongwe','Blantyre',
  'Windhoek','Gaborone','Maseru','Mbabane','Banjul','Monrovia','Freetown',
  'Abuja','Lome','Cotonou','Yamoussoukro','Nouakchott','Praia','Moroni',
];
// Legacy pool for backward compat
const CITY_NAMES = [...CITIES_US, ...CITIES_WORLD];
let _cityPoolUS = [...CITIES_US];
let _cityPoolWorld = [...CITIES_WORLD];
let _cityPoolObscure = [...CITIES_OBSCURE];

function _pickFrom(pool, refill) {
  if(!pool.length) pool.push(...refill);
  const i = Math.floor(Math.random()*pool.length);
  return pool.splice(i,1)[0];
}
// pickCity: context-aware — called with optional tier
// tier: 'us' (default early), 'world' (advanced), 'obscure' (multiplayer/deep levels)
function pickCity(tier) {
  if(tier === 'world')   return _pickFrom(_cityPoolWorld,   CITIES_WORLD);
  if(tier === 'obscure') return _pickFrom(_cityPoolObscure, CITIES_OBSCURE);
  return _pickFrom(_cityPoolUS, CITIES_US);
}

// Format: whole numbers only, K/M/B/T/Q/P suffix
const SUFFIXES = ['', 'K', 'M', 'B', 'T', 'Q', 'P'];

function fmtVal(v) {
  if (v < 1000) return String(v);

  const tier = Math.floor(Math.log10(v) / 3);
  const scaled = v / Math.pow(1000, tier);

  return Math.round(scaled) + SUFFIXES[tier];
}

// ── Level backgrounds ──
// Light pastel palettes — solo play starts at a random index (G.bgPalIdx) and cycles as level rises
const LEVEL_BG = [
  { bg:'#e8f4fd', grid:'#bcd8f0', edge:'#a0c6e4' },  // sky blue
  { bg:'#e8f8f0', grid:'#b0e4c8', edge:'#90d0b0' },  // mint
  { bg:'#f0e8f8', grid:'#d0b0ec', edge:'#bc98e0' },  // lavender
  { bg:'#fdf0e8', grid:'#f0ccaa', edge:'#e0b890' },  // peach
  { bg:'#e8f8f8', grid:'#a8e0e0', edge:'#88cccc' },  // seafoam
  { bg:'#f8f8e8', grid:'#e4dca0', edge:'#d0c880' },  // cream/gold
];
function currentBG() {
  if(typeof DAD !== 'undefined' && DAD.active) return DAD_BG;
  if(typeof ATHENA !== 'undefined' && ATHENA.active) {
    const idx = Math.min(ATHENA.level - 1, ATHENA_BG.length - 1);
    return ATHENA_BG[idx];
  }
  const base = (G && G.bgPalIdx != null) ? G.bgPalIdx : 0;
  const shift = (G && G.level != null) ? G.level : 0;
  return LEVEL_BG[(base + shift) % LEVEL_BG.length];
}

// ── Dynamic speed ──
// CRITICAL: minimum tick is clamped to 30ms to prevent event-loop starvation.
const MIN_TICK_MS = 30;

// Returns the highest head value among all live human players (host + guests).
function _compMaxHumanVal() {
  let m = (G.player && !G.player.dead && G.player.segs.length) ? (G.player.segs[0].val ?? 2) : 2;
  if(G.bots) for(const b of G.bots) if(b.isHuman && !b.dead && b.segs.length) m = Math.max(m, b.segs[0].val ?? 2);
  return m;
}

function snakeTickMs(sn) {
  if(!G || !G.running) return CFG.TICK_MS;
  if(sn._netTickMs) return sn._netTickMs; // guest-side: lerp over network broadcast interval
  // Athena per-level speed increase (10% per level)
  const athenaMult = (typeof ATHENA !== 'undefined' && ATHENA.active && ATHENA.baseSpeedMult) ? ATHENA.baseSpeedMult : 1.0;
  const base = CFG.TICK_MS * (G.levelSpeedMult || 1) * athenaMult;
  // Road boost (Dad's mode): streets shorten tick time for the player
  const roadBoost = (sn.isPlayer && typeof DAD !== 'undefined' && DAD.active && sn.segs[0] &&
                     DAD._isOnRoad(sn.segs[0].col, sn.segs[0].row))
                    ? 1 / (1 + CFG_DAD.ROAD_BOOST)
                    : 1.0;
  const lenMs = base * roadBoost * (1 + CFG.SPEED_LEN_FACTOR * Math.max(0, sn.segs.length - 1));
  // Small snake bonus: <1/16 of world max head → 2x speed (half tick time)
  const headVal = sn.segs[0]?.val ?? 2;
  const smallBoost = (!sn.isPlayer && headVal < _worldMax / 16) ? 0.5 : 1.0;
  if(!sn.isPlayer && sn._tickMs) return Math.max(MIN_TICK_MS, sn._tickMs * smallBoost);
  // Invincibility: 15% speed boost
  const now_t = performance.now();
  if(sn.isPlayer && G.invincUntil && now_t < G.invincUntil)
    return Math.max(MIN_TICK_MS, lenMs * CFG.INVINC_SPEED);
  // Boost: use a faster tick for the player, still clamped
  if(sn.isPlayer && G.boostUntil && now_t < G.boostUntil)
    return Math.max(MIN_TICK_MS, lenMs * CFG.BOOST_FACTOR);
  // Player also gets small-snake speed boost
  const playerSmall = (sn.isPlayer && headVal < _worldMax / 16) ? 0.5 : 1.0;
  let ms = lenMs * playerSmall;
  // Competitive mode: smaller human gets speed advantage vs the largest human
  // 2% per level gap (capped at MP_COMP_SPEED_ADV_MAX levels = up to 10% faster)
  if((sn.isPlayer || sn.isHuman) && MP.mode === 'competitive' && MP.enabled) {
    const maxHumanVal = _compMaxHumanVal();
    if(headVal < maxHumanVal) {
      const myL  = Math.max(1, Math.round(Math.log2(Math.max(2, headVal))));
      const maxL = Math.max(1, Math.round(Math.log2(Math.max(2, maxHumanVal))));
      const gap  = Math.min(CFG.MP_COMP_SPEED_ADV_MAX, maxL - myL);
      if(gap > 0) ms *= (1 - CFG.MP_COMP_SPEED_ADV * gap);
    }
  }
  return Math.max(MIN_TICK_MS, ms);
}

// ── Scaling ──
// All visual sizes derive from one formula:
//   scale(val, segIdx) = SCALE_BASE * SCALE_STEP ^ (log2RankFromMax + segIdx)
// where log2RankFromMax = log2(worldMax) - log2(val)
// So world's biggest head = SCALE_BASE (1.0). Each halving of value = *SCALE_STEP.
// Each body segment index adds another *SCALE_STEP on top.
const SCALE_BASE = 1.6;   // size of the world's largest head
const SCALE_STEP = 0.92;  // shrink per log2 rank OR per body segment index

// Cache world max so it's computed once per frame, not per segment
let _worldMax = 2;
function refreshWorldMax() {
  let m = (G && G.player && !G.player.dead && G.player.segs.length) ? G.player.segs[0].val : 2;
  if(G && G.bots) for(const b of G.bots) if(!b.dead && b.segs.length) m = Math.max(m, b.segs[0].val);
  _worldMax = m;
}

function segScale(val, segIdx) {
  const log2rank = Math.max(0, Math.log2(Math.max(2, _worldMax)) - Math.log2(Math.max(2, val)));
  return SCALE_BASE * Math.pow(SCALE_STEP, log2rank + segIdx);
}

// color palette — cycles through for 2,4,8,16,32,64,128,256,512,1024,2048
// Each entry: top face, left face, right face, text
const VALS = [2,4,8,16,32,64,128,256,512,1024,2048];


const ROYGBIV = [
  {t:'#44dd44',l:'#118811',r:'#229922',tx:'#fff'},   // 2    Green
  {t:'#aaee00',l:'#669900',r:'#88bb00',tx:'#222'},   // 4    Yellow-Green
  {t:'#ffee00',l:'#aaaa00',r:'#cccc00',tx:'#222'},   // 8    Yellow
  {t:'#ffaa00',l:'#aa6600',r:'#cc8800',tx:'#fff'},   // 16   Orange
  {t:'#ff7700',l:'#b34400',r:'#d96600',tx:'#fff'},   // 32   Orange-Red
  {t:'#ff2222',l:'#aa0000',r:'#cc1111',tx:'#fff'},   // 64   Red
  {t:'#ff44cc',l:'#aa1188',r:'#cc22aa',tx:'#fff'},   // 128  Pink
  {t:'#7755ff',l:'#331199',r:'#5533cc',tx:'#fff'},   // 256  Purple
  {t:'#00aaff',l:'#005599',r:'#0077cc',tx:'#fff'},   // 512  Blue
  {t:'#00ccaa',l:'#007766',r:'#009988',tx:'#fff'},   // 1024 Teal
];
function gc(v) {
  // cycle by log2(v) so color advances as values double
  const idx = Math.max(0, Math.round(Math.log2(Math.max(1, v)))) - 1;
  return ROYGBIV[((idx % ROYGBIV.length) + ROYGBIV.length) % ROYGBIV.length];
}

const BOT_PAL = [
  {t:'#ff8fab',l:'#b04060',r:'#d05878',tx:'#fff'},
  {t:'#90e0ef',l:'#3080a8',r:'#5098c0',tx:'#fff'},
  {t:'#b7e4c7',l:'#3a8a58',r:'#50a870',tx:'#fff'},
  {t:'#ffd166',l:'#a07010',r:'#c09020',tx:'#1a1200'},
  {t:'#ef476f',l:'#801030',r:'#a02048',tx:'#fff'},
];
const PLAYER_PAL = {t:'#00f5c4',l:'#007a62',r:'#009e7c',tx:'#001a15'};
// Human player palettes — visually distinct from bot colours
const HUMAN_PALS = [
  {t:'#00f5c4',l:'#007a62',r:'#009e7c',tx:'#001a15'}, // teal (local player)
  {t:'#ff6b35',l:'#993d18',r:'#cc5228',tx:'#fff'},     // orange
  {t:'#bf5fff',l:'#7020aa',r:'#9030cc',tx:'#fff'},     // purple
  {t:'#ffdd00',l:'#aa8800',r:'#ccaa00',tx:'#222'},     // gold
  {t:'#ff4488',l:'#aa1144',r:'#cc2266',tx:'#fff'},     // pink
];

const BOT_TURN_SPEED = 0.28; // radians per tick

let MERGE_SPEED = 0.36; // per tick — 50% faster than v1.0.1's 0.24
let SPACING_MULT = 0.55; // default matches gap slider value=55

// ── Dad's mode ──
const CFG_DAD = {
  CAR_PIXELS:        20,                    // image pixels per grid cell (≈ 1 small vehicle width)
  SCALE:             6.0,                   // map scale multiplier — >1 zooms in
  ROAD_BOOST:        0.50,                  // fractional speed bonus when on a road (0.5 = 50% faster)
  ROAD_BOOST_OFFSET: 0.6,                   // extra world-units beyond road half-width that count as "on road"
  MIRROR_MAP:        false,                 // test only: mirror the satellite texture (left-handed map). Also ?mirror=1
};
if (/[?&]mirror=1\b/.test(location.search)) CFG_DAD.MIRROR_MAP = true;

// Dad's mode gates weapons behind missions. Every other mode keeps all skills on.
function skillUnlocked(name) {
  if (typeof DAD === 'undefined' || !DAD.active) return true;
  return !!DAD.skills[name];
}
const DAD_BG = { bg: '#0a0c0f', grid: '#0a0c0f', edge: '#000000' };
