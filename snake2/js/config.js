// ════════════════════════════════════════════════════════════════════
//  SNAKE II — config. Plan: ../snake2/schematic_snake2.md (section 17)
//  Plain script: every snake2/js file shares one global scope.
// ════════════════════════════════════════════════════════════════════

// Read by ../js/music.js (shared with the main game)
const CFG_AUDIO = {
  FOLDER:       '../music/',
  PLAYLIST:     ['felix_piano_1.mp4', 'ying_piano_1.mp4', 'athena_piano_1.mp4', 'athena_piano_2.mp4'],
  VOLUME:       0.55,
  AUTO_SHUFFLE: true,
};

const CFG2 = {
  COLS: 50, ROWS: 50,          // board including the stone wall ring
  CELL_PX_MIN: 22,             // smallest drawn cell on a phone
  CELL_PX_MAX: 34,             // largest drawn cell on a big screen
  TICK_MS: 170,                // one step for every snake
  ROUND_MS: 180000,            // Timed mode: 3:00
  GOAL: 2021,                  // MMXXI — the cap and the win
  START_VALUE: 1,              // every snake starts as I
  SNACKS_ON_FIELD: 20,
  BOTS: 3,
  BOT_RESPAWN_MS: 3000,
  BOT_SAFE_DISTANCE: 8,        // a respawning bot needs this much room from you
  TURN_QUEUE: 2,               // buffered player turns
  COUNTDOWN_STEP_MS: 700,
  MAX_SNACKS: 90,              // bot wrecks add snacks; keep the field readable
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

const BOT_NAMES = ['Marcus', 'Julia', 'Livia', 'Gaius', 'Octavia', 'Lucius', 'Cornelia', 'Tiberius'];
const BOT_COLOURS = ['#e17055', '#6c5ce7', '#fdcb6e'];
const PLAYER_COLOUR = '#00b894';
