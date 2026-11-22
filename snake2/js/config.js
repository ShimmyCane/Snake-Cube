// ════════════════════════════════════════════════════════════════════
//  SNAKE II — config. Plain script: every snake2/js file shares one global scope.
//  Movement is smooth, not on a grid. One tile is one unit of board space.
// ════════════════════════════════════════════════════════════════════

// Read by ../js/music.js (shared with the main game)
const CFG_AUDIO = {
  FOLDER:       '../music/',
  PLAYLIST:     ['felix_piano_1.mp4', 'ying_piano_1.mp4', 'athena_piano_1.mp4', 'athena_piano_2.mp4'],
  VOLUME:       0.55,
  AUTO_SHUFFLE: true,
};

const CFG2 = {
  COLS: 50, ROWS: 50,          // board size in tiles, including the stone border
  WALL_T: 1,                   // stone border thickness, in tiles
  CELL_PX: 35,                 // drawn size of one tile: the same on every device, bigger screens show more map
  MINI_PX_MIN: 110,            // minimap size on a phone
  MINI_PX_MAX: 260,            // ...and on a big screen (it scales up with the screen)
  TICK_MS: 243,                // one simulation step
  SPEED: 1.0,                  // tiles a snake moves per step
  HEAD_R: 0.42,                // head radius, in tiles
  BODY_R: 0.42,                // body radius, in tiles: a head this close to a body crashes
  SYMBOL_STEP: 0.85,           // distance between symbols along the body
  GROW_PER_TICK: 0.5,          // body length gained per step while a numeral grows
  NECK_ARC: 2.0,               // a snake's own first tiles are its neck: they cannot crash it
  EAT_R: 0.8,                  // a head this close to a snack eats it
  MAX_VALUE: 3999,             // MMXXI is not a goal in FreePlay; 3999 (MMMCMXCIX) is the largest numeral
  START_VALUE: 1,              // every snake starts as I
  SNACKS_ON_FIELD: 20,         // snacks kept on the board with the default number of bots
  SNACKS_PER_EXTRA_BOT: 4,     // more rivals eat more, so the field grows with them
  BOTS: 3,                     // default rival snakes
  BOTS_MIN: 1,
  BOTS_MAX: 10,                // the settings stepper stops here
  SHATTER_RADIUS: 3,           // a crashed snake's pieces land within this many tiles
  SHATTER_FLY_MS: 420,         // how long the pieces take to fly out
  BURST_MS: 520,               // the little explosion
  END_HOLD_MS: 1100,           // after a crash, before fading to the end screen
  BOT_RESPAWN_MS: 3000,
  BOT_SAFE_DISTANCE: 8,        // a respawning bot needs this much room from you
  COUNTDOWN_STEP_MS: 700,
  MAX_SNACKS: 90,              // bot wrecks add snacks; keep the field readable
  RECLAIM_MS: 8000,            // pieces cut from a bumped snake are its own for this long
};

// Snack value odds. Values never scale up as the snake grows.
const SNACK_SETS = {
  classic:  { label: 'Classic',  odds: { 1: 0.80, 5: 0.15, 10: 0.05 } },
  extended: { label: 'Extended', odds: { 1: 0.60, 5: 0.20, 10: 0.12, 50: 0.06, 100: 0.02 } },
  imperial: { label: 'Imperial', odds: { 1: 0.50, 5: 0.20, 10: 0.15, 50: 0.08, 100: 0.05, 500: 0.015, 1000: 0.005 } },
};

// Colour for each numeral symbol. Used by the body tiles and snack coins.
const SYMBOL_COLOURS = {
  I: '#2ecc71', V: '#f1c40f', X: '#e67e22', L: '#e74c3c',
  C: '#9b59b6', D: '#3498db', M: '#d4a017',
};

const BOT_NAMES = ['Marcus', 'Julia', 'Livia', 'Gaius', 'Octavia', 'Lucius', 'Cornelia', 'Tiberius', 'Flavia', 'Aurelius', 'Claudia', 'Brutus'];
const BOT_COLOURS = ['#e17055', '#6c5ce7', '#fdcb6e', '#0984e3', '#e84393', '#00cec9', '#d63031', '#636e72', '#a29bfe', '#55efc4'];
const PLAYER_COLOUR = '#00b894';
