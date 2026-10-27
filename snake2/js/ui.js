// ════════════════════════════════════════════════════════════════════
//  UI — screens, HUD, settings, countdown, best scores. DOM only.
//  Reads game state; the game itself lives in game.js.
// ════════════════════════════════════════════════════════════════════

const SETTINGS_KEY = 'snake2.settings';
const BEST_KEYS = { timed: 'snake2.best.timed', endless: 'snake2.best.endless' };
const SETTINGS_DEFAULT = { showNumbers: false, snackSet: 'classic', music: true, hint: true, bots: CFG2.BOTS };
const BEST_LIMIT = 5;

const $ = id => document.getElementById(id);

// Settings and scores live in localStorage. Every access is guarded: private
// windows and blocked storage must not stop the game.
function loadSettings() {
  try {
    return Object.assign({}, SETTINGS_DEFAULT, JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}'));
  } catch (e) {
    return Object.assign({}, SETTINGS_DEFAULT);
  }
}
function saveSettings(s) {
  try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(s)); } catch (e) { /* ignore */ }
}

function loadBest(mode) {
  try { return JSON.parse(localStorage.getItem(BEST_KEYS[mode]) || '[]'); } catch (e) { return []; }
}

// Timed: higher number is better. Endless: wins first, then the quickest win;
// a run that did not win ranks by its number.
function rankBest(mode, list) {
  const cmp = mode === 'timed'
    ? (a, b) => b.value - a.value
    : (a, b) => (b.won - a.won) || (a.won ? a.timeMs - b.timeMs : b.value - a.value);
  return list.sort(cmp).slice(0, BEST_LIMIT);
}

function saveBest(mode, score) {
  const list = rankBest(mode, loadBest(mode).concat([Object.assign({ date: Date.now() }, score)]));
  try { localStorage.setItem(BEST_KEYS[mode], JSON.stringify(list)); } catch (e) { /* ignore */ }
  return list;
}

// Time in Roman numerals, minutes then seconds: 2:59 is II:LIX. Romans had no zero,
// so zero is written N, for nulla, as medieval scribes did: 3:00 is III:N.
function formatClock(ms) {
  const s = Math.max(0, Math.ceil(ms / 1000));
  const part = n => (n > 0 ? toRoman(n) : 'N');
  return part(Math.floor(s / 60)) + ':' + part(s % 60);
}

function clampBots(n) {
  const v = Number.isFinite(n) ? Math.round(n) : CFG2.BOTS;   // 0 is a real value, not 'missing'
  return Math.max(CFG2.BOTS_MIN, Math.min(CFG2.BOTS_MAX, v));
}

function numeralText(value, showNumbers) {
  return showNumbers ? toRoman(value) + '  ·  ' + value : toRoman(value);
}

// ── Screens ──
const SCREENS = ['s-menu', 's-settings', 's-count', 's-pause', 's-over'];
const PLAY_ELEMENTS = ['hud', 'board', 'minimap', 'dpad'];

function showScreen(name) {
  for (const id of SCREENS) $(id).classList.toggle('hidden', id !== name);
  const playing = name === null;
  for (const id of PLAY_ELEMENTS) $(id).classList.toggle('hidden', !playing);
}

function renderBestList(mode) {
  const list = rankBest(mode, loadBest(mode));
  const box = $('best-' + mode);
  if (!box) return;
  box.innerHTML = '';
  if (!list.length) {
    box.textContent = 'No runs yet';
    return;
  }
  for (const row of list) {
    const div = document.createElement('div');
    const extra = mode === 'endless' && row.won ? ' · won in ' + formatClock(row.timeMs) : '';
    div.textContent = toRoman(row.value) + extra;
    box.appendChild(div);
  }
}

// ── Countdown: III · II · I · IRE! ──
function runCountdown(onDone) {
  const steps = ['III', 'II', 'I', 'IRE!'];
  const el = $('count-text');
  showScreen('s-count');
  let i = 0;
  const tick = () => {
    el.textContent = steps[i];
    i += 1;
    if (i < steps.length) setTimeout(tick, CFG2.COUNTDOWN_STEP_MS);
    else setTimeout(() => { showScreen(null); onDone(); }, CFG2.COUNTDOWN_STEP_MS);
  };
  tick();
}

// ── HUD ──
function updateHud(G, settings) {
  $('v-numeral').textContent = toRoman(G.player.value);
  const arabic = $('v-arabic');
  arabic.textContent = settings.showNumbers ? String(G.player.value) : '';
  arabic.classList.toggle('hidden', !settings.showNumbers);
  $('v-timer').textContent = G.mode === 'timed' ? formatClock(G.timeLeftMs) : formatClock(G.elapsedMs);
  $('v-mode').textContent = G.mode === 'timed' ? 'TIMED' : 'ENDLESS';
  $('v-best').textContent = toRoman(G.best);
}

let flashTimer = null;
function flash(text) {
  const el = $('flash');
  el.textContent = text;
  el.classList.remove('hidden');
  clearTimeout(flashTimer);
  flashTimer = setTimeout(() => el.classList.add('hidden'), 1200);
}

// ── Game-over / win ──
function showEnd(G, list) {
  const won = G.result === 'won';
  const titles = { won: 'MMXXI — FELIX!', crash: 'CRASH!', time: "TIME'S UP" };
  $('over-title').textContent = titles[G.result] || 'GAME OVER';
  $('over-score').textContent = toRoman(G.best);
  $('over-detail').textContent = won && G.mode === 'endless' ? 'Won in ' + formatClock(G.elapsedMs) : '';
  const box = $('over-best');
  box.innerHTML = '';
  for (const row of list.slice(0, 3)) {
    const div = document.createElement('div');
    div.textContent = toRoman(row.value);
    box.appendChild(div);
  }
  $('over-wreath').classList.toggle('hidden', !won);
  showScreen('s-over');
  // Fade in: the board breaks apart first, then the end screen fades over it
  const el = $('s-over');
  el.classList.remove('fade-in');
  void el.offsetWidth;
  el.classList.add('fade-in');
}

// ── Settings wiring ──
function applySettingsToDom(s) {
  $('set-numbers').checked = !!s.showNumbers;
  $('set-music').checked = !!s.music;
  $('set-hint').checked = !!s.hint;
  $('bots-val').textContent = toRoman(clampBots(s.bots));
  document.querySelectorAll('[data-snack]').forEach(b => {
    b.classList.toggle('active', b.dataset.snack === s.snackSet);
  });
}

function bindSettings(settings, onMusic) {
  $('set-numbers').addEventListener('change', e => { settings.showNumbers = e.target.checked; saveSettings(settings); });
  $('set-hint').addEventListener('change', e => { settings.hint = e.target.checked; saveSettings(settings); });
  $('set-music').addEventListener('change', e => {
    settings.music = e.target.checked;
    saveSettings(settings);
    onMusic(settings.music);
  });
  const stepBots = delta => {
    settings.bots = clampBots(settings.bots + delta);
    saveSettings(settings);
    applySettingsToDom(settings);
  };
  $('bots-minus').addEventListener('click', () => stepBots(-1));
  $('bots-plus').addEventListener('click', () => stepBots(1));
  document.querySelectorAll('[data-snack]').forEach(b => {
    b.addEventListener('click', () => {
      settings.snackSet = b.dataset.snack;
      saveSettings(settings);
      applySettingsToDom(settings);
    });
  });
}
