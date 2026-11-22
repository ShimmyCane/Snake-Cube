// ════════════════════════════════════════════════════════════════════
//  UI — screens, HUD, settings, countdown. DOM only. FreePlay: nothing is graded or saved.
//  Reads game state; the game itself lives in game.js.
// ════════════════════════════════════════════════════════════════════

const SETTINGS_KEY = 'snake2.settings';
const SETTINGS_DEFAULT = { showNumbers: false, snackSet: 'classic', music: true, hint: true, bots: CFG2.BOTS };

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

function clampBots(n) {
  const v = Number.isFinite(n) ? Math.round(n) : CFG2.BOTS;   // 0 is a real value, not 'missing'
  return Math.max(CFG2.BOTS_MIN, Math.min(CFG2.BOTS_MAX, v));
}

function numeralText(value, showNumbers) {
  return showNumbers ? toRoman(value) + '  ·  ' + value : toRoman(value);
}

// ── Screens ──
const SCREENS = ['s-menu', 's-settings', 's-count', 's-pause', 's-over'];
const PLAY_ELEMENTS = ['hud', 'board', 'minimap', 'stick'];

function showScreen(name) {
  for (const id of SCREENS) $(id).classList.toggle('hidden', id !== name);
  const playing = name === null;
  for (const id of PLAY_ELEMENTS) $(id).classList.toggle('hidden', !playing);
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
}

let flashTimer = null;
function flash(text) {
  const el = $('flash');
  el.textContent = text;
  el.classList.remove('hidden');
  clearTimeout(flashTimer);
  flashTimer = setTimeout(() => el.classList.add('hidden'), 1200);
}

// ── Game over. FreePlay has no grade: it shows the numeral you reached, and nothing is saved. ──
function showEnd(G) {
  $('over-title').textContent = 'CRASH!';
  $('over-score').textContent = toRoman(G.player.value);
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
