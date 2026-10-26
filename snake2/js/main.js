// ════════════════════════════════════════════════════════════════════
//  MAIN — boot, the round, and the frame loop.
//  Load order: see schematic_snake2.md section 8. Starts last.
// ════════════════════════════════════════════════════════════════════

const settings = loadSettings();
let G = null;
let paused = false;
let acc = 0;
let lastFrame = 0;
let cam = {};
let roundEnded = false;

const canvas = $('board');
const ctx = canvas.getContext('2d');
const miniCanvas = $('minimap');
const miniCtx = miniCanvas.getContext('2d');

// Canvas sized to the screen, sharp on high-DPI phones.
function resize() {
  const dpr = window.devicePixelRatio || 1;
  const w = window.innerWidth, h = window.innerHeight;
  canvas.width = Math.floor(w * dpr);
  canvas.height = Math.floor(h * dpr);
  canvas.style.width = w + 'px';
  canvas.style.height = h + 'px';
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const mini = Math.min(120, Math.floor(w * 0.28));
  miniCanvas.width = Math.floor(mini * dpr);
  miniCanvas.height = Math.floor(mini * dpr);
  miniCanvas.style.width = mini + 'px';
  miniCanvas.style.height = mini + 'px';
  miniCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

function startRound(mode) {
  G = createGame({ mode, snackSet: settings.snackSet, seed: Date.now() });
  G.state = 'countdown';
  roundEnded = false;
  paused = false;
  acc = 0;
  cam = {};
  $('v-mode').textContent = mode === 'timed' ? 'TIMED' : 'ENDLESS';
  showScreen(null);
  runCountdown(() => {
    if (!G) return;
    G.state = 'playing';
    lastFrame = performance.now();
    if (settings.hint) flash('Swipe, or use the arrows');
  });
}

function onEvents(events) {
  for (const e of events) {
    if (e.type === 'crash' && e.bot) flash(e.bot + ' crashed');
    if (e.type === 'botRespawn') { /* quiet: bots come back on their own */ }
    if (e.type === 'over' || e.type === 'won') endRound();
  }
}

function endRound() {
  if (roundEnded || !G) return;
  roundEnded = true;
  const list = saveBest(G.mode, finalScore(G));
  showEnd(G, list);
}

function quitToMenu() {
  G = null;
  paused = false;
  showScreen('s-menu');
  renderBestList('timed');
  renderBestList('endless');
}

function setPaused(on) {
  if (!G || G.state === 'over' || G.state === 'won' || G.state === 'countdown') return;
  paused = on;
  $('s-pause').classList.toggle('hidden', !on);
  if (!on) lastFrame = performance.now();
}

function frame(now) {
  requestAnimationFrame(frame);
  if (!G) return;
  const dt = Math.min(now - (lastFrame || now), 100);
  lastFrame = now;

  if (G.state === 'playing' && !paused) {
    acc += dt;
    advanceClock(G, dt);
    while (acc >= CFG2.TICK_MS && G.state === 'playing') {
      acc -= CFG2.TICK_MS;
      onEvents(stepGame(G, now));
    }
    if (G.state === 'over' || G.state === 'won') endRound();
  }

  const view = viewCells(window.innerWidth, window.innerHeight, cellSizeFor(window.innerWidth, window.innerHeight));
  const cellPx = cellSizeFor(window.innerWidth, window.innerHeight);
  updateCamera(cam, G, view);
  ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
  const t = G.state === 'playing' && !paused ? Math.min(1, acc / CFG2.TICK_MS) : 1;
  renderBoard(ctx, G, cam, cellPx, view, t, now);
  miniCtx.clearRect(0, 0, 200, 200);
  renderMinimap(miniCtx, G, parseFloat(miniCanvas.style.width) || 110);
  updateHud(G, settings);
}

function boot() {
  resize();
  window.addEventListener('resize', resize);

  $('btn-timed').addEventListener('click', () => startRound('timed'));
  $('btn-endless').addEventListener('click', () => startRound('endless'));
  $('btn-settings').addEventListener('click', () => { applySettingsToDom(settings); showScreen('s-settings'); });
  $('btn-settings-back').addEventListener('click', () => showScreen('s-menu'));
  $('btn-pause').addEventListener('click', () => setPaused(!paused));
  $('btn-resume').addEventListener('click', () => setPaused(false));
  $('btn-quit').addEventListener('click', quitToMenu);
  $('btn-again').addEventListener('click', () => startRound(G ? G.mode : 'timed'));
  $('btn-menu').addEventListener('click', quitToMenu);

  bindSettings(settings, on => {
    // Music is shared with the main game (music.js keeps one mute flag).
    if (typeof MUS !== 'undefined' && MUS.muted === on) MUS.toggle();
  });
  if (typeof MUS !== 'undefined' && !settings.music && !MUS.muted) MUS.toggle();

  installInput(canvas, $('dpad'), {
    onTurn: dir => { if (G) setPlayerTurn(G, dir); },
    onPause: () => { if (G && G.state === 'playing') setPaused(!paused); },
  });
  document.addEventListener('visibilitychange', () => { if (document.hidden) setPaused(true); });

  renderBestList('timed');
  renderBestList('endless');
  showScreen('s-menu');
  requestAnimationFrame(frame);
}

boot();
