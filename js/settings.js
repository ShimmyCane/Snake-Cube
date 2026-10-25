// ════════════════════════════════════════
//  SETTINGS PANEL
// ════════════════════════════════════════

// ── Settings panel DOM — injected here so index.html stays slim ──
(function() {
  const el = document.createElement('div');
  el.id = 'settings-panel';
  el.innerHTML = `
    <div style="font-family:'Courier New',monospace;font-size:0.55rem;color:#00f5c4;letter-spacing:2px;text-transform:uppercase;margin-bottom:2px;border-bottom:1px solid rgba(0,245,196,0.15);padding-bottom:6px">⚙️ Dev Controls</div>
    <div style="font-size:0.48rem;color:#444;text-transform:uppercase;letter-spacing:1px;margin-bottom:-4px">Camera</div>
    <div class="sp-row"><label>Height</label><input class="sp-slider" id="cam-slider" type="range" min="0" max="100" value="47" step="1" style="--pct:47%"><span class="sp-val" id="cam-val">47</span></div>
    <div style="font-size:0.48rem;color:#444;text-transform:uppercase;letter-spacing:1px;margin-bottom:-4px;margin-top:2px">Snake</div>
    <div class="sp-row"><label>Spacing</label><input class="sp-slider" id="gap-slider" type="range" min="10" max="200" value="55" step="5" style="--pct:24%"><span class="sp-val" id="gap-val">55</span></div>
    <div class="sp-row"><label>Merge</label><input class="sp-slider" id="merge-slider" type="range" min="5" max="100" value="36" step="1" style="--pct:33%"><span class="sp-val" id="merge-val">36</span></div>
    <div style="font-size:0.48rem;color:#444;text-transform:uppercase;letter-spacing:1px;margin-bottom:-4px;margin-top:2px">World</div>
    <div class="sp-row"><label>Density</label><input class="sp-slider" id="density-slider" type="range" min="25" max="200" value="100" step="5" style="--pct:40%"><span class="sp-val" id="density-val">100%</span></div>
    <div class="sp-row"><label>Snacks</label><input class="sp-slider" id="snack-slider" type="range" min="20" max="400" value="120" step="10" style="--pct:33%"><span class="sp-val" id="snack-val">120</span></div>
    <div class="sp-row"><label>SnackHz</label><input class="sp-slider" id="food-ms-slider" type="range" min="1" max="30" value="8" step="1" style="--pct:25%"><span class="sp-val" id="food-ms-val">8s</span></div>
    <div style="font-size:0.48rem;color:#444;text-transform:uppercase;letter-spacing:1px;margin-bottom:-4px;margin-top:2px">Speed</div>
    <div class="sp-row"><label>TickMs</label><input class="sp-slider" id="tick-slider" type="range" min="60" max="400" value="174" step="6" style="--pct:39%"><span class="sp-val" id="tick-val">174</span></div>
    <div class="sp-row"><label>BotSpd</label><input class="sp-slider" id="botspeed-slider" type="range" min="10" max="200" value="50" step="5" style="--pct:21%"><span class="sp-val" id="botspeed-val">30%</span></div>
    <div style="font-size:0.48rem;color:#444;text-transform:uppercase;letter-spacing:1px;margin-bottom:-4px;margin-top:2px">Bots</div>
    <div class="sp-row"><label>BotMax</label><input class="sp-slider" id="botmax-slider" type="range" min="0" max="120" value="27" step="1" style="--pct:23%"><span class="sp-val" id="botmax-val">27</span></div>
    <div class="sp-row"><label>Range</label><input class="sp-slider" id="range-slider" type="range" min="8" max="80" value="28" step="2" style="--pct:29%"><span class="sp-val" id="range-val">28</span></div>
    <div class="sp-row"><label>Chase</label><input class="sp-slider" id="chase-slider" type="range" min="10" max="120" value="48" step="2" style="--pct:35%"><span class="sp-val" id="chase-val">48</span></div>
    <div class="sp-row"><label>Diffclt</label><input class="sp-slider" id="diff-slider" type="range" min="10" max="400" value="100" step="5" style="--pct:23%"><span class="sp-val" id="diff-val">1.0×</span></div>
    <div style="font-size:0.48rem;color:#444;text-transform:uppercase;letter-spacing:1px;margin-bottom:-4px;margin-top:2px">Round</div>
    <div class="sp-row"><label>Time</label><input class="sp-slider" id="roundtime-slider" type="range" min="1" max="20" value="5" step="1" style="--pct:22%"><span class="sp-val" id="roundtime-val">5m</span></div>
    <div style="font-size:0.48rem;color:#444;text-transform:uppercase;letter-spacing:1px;margin-bottom:-4px;margin-top:2px">Terrain</div>
    <div class="sp-row"><label>Z-Scale</label><input class="sp-slider" id="terrainz-slider" type="range" min="1" max="50" value="10" step="1" style="--pct:18%"><span class="sp-val" id="terrainz-val">1.0×</span></div>
    <div style="font-size:0.48rem;color:#444;text-transform:uppercase;letter-spacing:1px;margin-bottom:-4px;margin-top:2px">Dad's Mode</div>
    <div class="sp-row"><label>RoadBoost</label><input class="sp-slider" id="roadboost-slider" type="range" min="0" max="100" value="50" step="5" style="--pct:50%"><span class="sp-val" id="roadboost-val">50%</span></div>
    <div style="font-size:0.48rem;color:#444;text-transform:uppercase;letter-spacing:1px;margin-bottom:-4px;margin-top:2px">Player</div>
    <div class="sp-row"><label>Start Val</label><input class="sp-slider" id="startval-slider" type="range" min="1" max="11" value="1" step="1" style="--pct:0%"><span class="sp-val" id="startval-val">2</span></div>
    <div style="font-size:0.48rem;color:#444;text-transform:uppercase;letter-spacing:1px;margin-bottom:-4px;margin-top:2px">Debug</div>
    <div class="sp-row" style="gap:10px;align-items:center"><label style="flex:unset">Radar</label><input type="checkbox" id="radar-always-on" style="width:14px;height:14px;accent-color:#00f5c4;cursor:pointer"><span class="sp-val" id="radar-always-val" style="color:#555570">off</span></div>
    <div class="sp-row" style="gap:10px;align-items:center"><label style="flex:unset">MirrorMap</label><input type="checkbox" id="mirror-map" style="width:14px;height:14px;accent-color:#22aaff;cursor:pointer"><span class="sp-val" id="mirror-map-val" style="color:#555570">off</span></div>`;
  document.body.appendChild(el);
})();

// Settings panel toggle
const _settingsBtn   = document.getElementById('settings-btn');
const _settingsPanel = document.getElementById('settings-panel');
function setSettingsPanelOpen(open) {
  _settingsPanel.classList.toggle('open', open);
  if(G && G.running) G.paused = open;
}
_settingsBtn.addEventListener('click', e => {
  e.stopPropagation();
  setSettingsPanelOpen(!_settingsPanel.classList.contains('open'));
});
document.addEventListener('click', () => setSettingsPanelOpen(false));
_settingsPanel.addEventListener('click', e => e.stopPropagation());

// HUD subtitle / game mode title
function updateGameTitle(label) {
  const el = document.getElementById('hud-subtitle');
  if(el) el.textContent = label || '';
}

function resetMPState() {
  if(MP.peer) { try { MP.peer.destroy(); } catch(e){} MP.peer = null; }
  MP.enabled = false; MP.isHost = false; MP.mode = 'solo';
  MP.conns = []; MP.waitingGuests = {}; MP.players = {};
  MP.hostCode = ''; MP.hostPeerId = '';
}

// Home button — stop game and return to main menu
document.getElementById('home-btn').addEventListener('click', () => {
  setSettingsPanelOpen(false);
  if(G) G.running = false;
  clearTimers();
  if(typeof ATHENA !== 'undefined' && ATHENA.active) athenaCleanup();
  resetMPState();
  document.getElementById('s-over').classList.add('hidden');
  updateGameTitle('');
  showJoystickUI(false);
  showMPScreen('main');
});

// Camera height slider
const _camSlider = document.getElementById('cam-slider');
const _camVal    = document.getElementById('cam-val');
function applySlider(v) {
  CAM.height = 4  + v * 0.14;
  CAM.dist   = 6  + v * 0.10;
  CAM.pitch  = 0.55 + v * 0.0046;
  _updateCamTrig();
  _camVal.textContent = v;
  _camSlider.style.setProperty('--pct', v + '%');
}
_camSlider.addEventListener('input', () => applySlider(parseInt(_camSlider.value)));
applySlider(47); // startup defaults

// Merge speed slider
const _mergeSlider = document.getElementById('merge-slider');
const _mergeVal    = document.getElementById('merge-val');
function applyMergeSlider(v) {
  MERGE_SPEED = v / 100;
  _mergeVal.textContent = v;
  const pct = Math.round((v-5)/(100-5)*100);
  _mergeSlider.style.setProperty('--pct', pct + '%');
  _mergeSlider.value = v;
}
_mergeSlider.addEventListener('input', () => applyMergeSlider(parseInt(_mergeSlider.value)));
applyMergeSlider(36);

// Spacing slider
const _gapSlider = document.getElementById('gap-slider');
const _gapVal    = document.getElementById('gap-val');
function applyGapSlider(v) {
  SPACING_MULT = v / 100;
  _gapVal.textContent = v;
  const pct = Math.round((v-10)/(200-10)*100);
  _gapSlider.style.setProperty('--pct', pct + '%');
  _gapSlider.value = v;
}
_gapSlider.addEventListener('input', () => applyGapSlider(parseInt(_gapSlider.value)));
applyGapSlider(55);

// Density slider — controls BOT_MAX multiplier, triggers immediate population check
const _densitySlider = document.getElementById('density-slider');
const _densityVal    = document.getElementById('density-val');
function applyDensitySlider(v) {
  DENSITY_MULT = v / 100;
  _densityVal.textContent = v + '%';
  const pct = Math.round((v-25)/(200-25)*100);
  _densitySlider.style.setProperty('--pct', pct + '%');
  _densitySlider.value = v;
  if(G && G.running) spawnBotWave(); // immediate population adjustment
}
_densitySlider.addEventListener('input', () => applyDensitySlider(parseInt(_densitySlider.value)));
// Default stays at 100% (as-is behavior)

// Snack field max slider
const _snackSlider = document.getElementById('snack-slider');
const _snackVal    = document.getElementById('snack-val');
function applySnackSlider(v) {
  CFG.FOOD_FIELD_MAX = v;
  _snackVal.textContent = v;
  const pct = Math.round((v-20)/(300-20)*100);
  _snackSlider.style.setProperty('--pct', pct + '%');
  _snackSlider.value = v;
}
_snackSlider.addEventListener('input', () => applySnackSlider(parseInt(_snackSlider.value)));
applySnackSlider(CFG.FOOD_FIELD_MAX); // startup: read CFG, don't overwrite it

// ── New dev sliders ──

// Food interval (SnackHz)
const _foodMsSlider = document.getElementById('food-ms-slider');
const _foodMsVal    = document.getElementById('food-ms-val');
_foodMsSlider.addEventListener('input', () => {
  const v = parseInt(_foodMsSlider.value);
  CFG.FOOD_MS = v * 1000;
  _foodMsVal.textContent = v + 's';
  const pct = Math.round((v-1)/(30-1)*100);
  _foodMsSlider.style.setProperty('--pct', pct + '%');
  // Restart food timer live
  if(_TID.ft) { clearInterval(_TID.ft); _TID.ft = setInterval(spawnFood, CFG.FOOD_MS); }
});

// Base tick speed
const _tickSlider = document.getElementById('tick-slider');
const _tickVal    = document.getElementById('tick-val');
_tickSlider.addEventListener('input', () => {
  const v = parseInt(_tickSlider.value);
  CFG.TICK_MS = v;
  _tickVal.textContent = v;
  const pct = Math.round((v-60)/(400-60)*100);
  _tickSlider.style.setProperty('--pct', pct + '%');
});

// Bot speed ratio
const _botspeedSlider = document.getElementById('botspeed-slider');
const _botspeedVal    = document.getElementById('botspeed-val');
function applyBotSpeedSlider(v) {
  CFG.BOT_SPEED = v / 100;
  _botspeedVal.textContent = v + '%';
  const pct = Math.round((v-10)/(200-10)*100);
  _botspeedSlider.style.setProperty('--pct', pct + '%');
  _botspeedSlider.value = v;
}
_botspeedSlider.addEventListener('input', () => applyBotSpeedSlider(parseInt(_botspeedSlider.value)));
applyBotSpeedSlider(Math.round(CFG.BOT_SPEED * 100)); // startup: read CFG, don't overwrite it

// Bot max count
const _botmaxSlider = document.getElementById('botmax-slider');
const _botmaxVal    = document.getElementById('botmax-val');
function applyBotMaxSlider(v) {
  CFG.BOT_MAX = v;
  _botmaxVal.textContent = v;
  const pct = Math.round(v/120*100);
  _botmaxSlider.style.setProperty('--pct', pct + '%');
  _botmaxSlider.value = v;
  if(G && G.running) spawnBotWave();
}
_botmaxSlider.addEventListener('input', () => applyBotMaxSlider(parseInt(_botmaxSlider.value)));
applyBotMaxSlider(CFG.BOT_MAX); // startup: read CFG, don't overwrite it

// Bot range
const _rangeSlider = document.getElementById('range-slider');
const _rangeVal    = document.getElementById('range-val');
function applyRangeSlider(v) {
  CFG.BOT_RANGE = v;
  _rangeVal.textContent = v;
  const pct = Math.round((v-8)/(80-8)*100);
  _rangeSlider.style.setProperty('--pct', pct + '%');
  _rangeSlider.value = v;
}
_rangeSlider.addEventListener('input', () => applyRangeSlider(parseInt(_rangeSlider.value)));
applyRangeSlider(CFG.BOT_RANGE); // startup: read CFG, don't overwrite it

// Chase range
const _chaseSlider = document.getElementById('chase-slider');
const _chaseVal    = document.getElementById('chase-val');
function applyChaseSlider(v) {
  CFG.BOT_CHASE_RANGE = v;
  _chaseVal.textContent = v;
  const pct = Math.round((v-10)/(120-10)*100);
  _chaseSlider.style.setProperty('--pct', pct + '%');
  _chaseSlider.value = v;
}
_chaseSlider.addEventListener('input', () => applyChaseSlider(parseInt(_chaseSlider.value)));
applyChaseSlider(CFG.BOT_CHASE_RANGE); // startup: read CFG, don't overwrite it

// Difficulty multiplier
const _diffSlider = document.getElementById('diff-slider');
const _diffVal    = document.getElementById('diff-val');
_diffSlider.addEventListener('input', () => {
  const v = parseInt(_diffSlider.value);
  CFG.DIFFICULTY = v / 100;
  _diffVal.textContent = (v/100).toFixed(1) + '×';
  const pct = Math.round((v-10)/(400-10)*100);
  _diffSlider.style.setProperty('--pct', pct + '%');
});

// Round time
const _roundtimeSlider = document.getElementById('roundtime-slider');
const _roundtimeVal    = document.getElementById('roundtime-val');
_roundtimeSlider.addEventListener('input', () => {
  const v = parseInt(_roundtimeSlider.value);
  CFG.ROUND_SEC = v * 60;
  _roundtimeVal.textContent = v + 'm';
  const pct = Math.round((v-1)/(20-1)*100);
  _roundtimeSlider.style.setProperty('--pct', pct + '%');
  if(G) G.timeLeft = CFG.ROUND_SEC; // update current game if running
});

// Terrain Z scale slider
const _terrainzSlider = document.getElementById('terrainz-slider');
const _terrainzVal    = document.getElementById('terrainz-val');
function applyTerrainZSlider(v) {
  CFG.TERRAIN_Z_SCALE = v / 10;
  _terrainzVal.textContent = (v/10).toFixed(1) + '×';
  const pct = Math.round((v-1)/(50-1)*100);
  _terrainzSlider.style.setProperty('--pct', pct + '%');
  _terrainzSlider.value = v;
}
_terrainzSlider.addEventListener('input', () => applyTerrainZSlider(parseInt(_terrainzSlider.value)));
applyTerrainZSlider(Math.round(CFG.TERRAIN_Z_SCALE * 10)); // startup: read CFG, don't overwrite it

// Dad's mode road boost (percent speed bonus on roads)
const _roadboostSlider = document.getElementById('roadboost-slider');
const _roadboostVal    = document.getElementById('roadboost-val');
function applyRoadBoostSlider(v) {
  CFG_DAD.ROAD_BOOST = v / 100;
  _roadboostVal.textContent = v + '%';
  _roadboostSlider.style.setProperty('--pct', v + '%');
  _roadboostSlider.value = v;
}
_roadboostSlider.addEventListener('input', () => applyRoadBoostSlider(parseInt(_roadboostSlider.value)));
applyRoadBoostSlider(Math.round(CFG_DAD.ROAD_BOOST * 100)); // startup: read CFG, don't overwrite it

// Radar always-on toggle
const _radarAlwaysChk = document.getElementById('radar-always-on');
const _radarAlwaysVal = document.getElementById('radar-always-val');
_radarAlwaysChk.addEventListener('change', () => {
  RADAR_ALWAYS_ON = _radarAlwaysChk.checked;
  _radarAlwaysVal.textContent = RADAR_ALWAYS_ON ? 'on' : 'off';
  _radarAlwaysVal.style.color = RADAR_ALWAYS_ON ? '#00f5c4' : '#555570';
});

// Mirror map test (Dad's mode) — flips the satellite texture to check a left-handed map
const _mirrorChk = document.getElementById('mirror-map');
const _mirrorVal = document.getElementById('mirror-map-val');
function applyMirrorToggle(on) {
  _mirrorChk.checked = on;
  _mirrorVal.textContent = on ? 'on' : 'off';
  _mirrorVal.style.color = on ? '#22aaff' : '#555570';
  if(typeof DAD !== 'undefined') DAD.setMirror(on);
  else CFG_DAD.MIRROR_MAP = on;
}
_mirrorChk.addEventListener('change', () => applyMirrorToggle(_mirrorChk.checked));
applyMirrorToggle(CFG_DAD.MIRROR_MAP); // startup: read CFG, don't overwrite it

// ── Start Val slider — exponent 1–11 maps to 2^exp (2 … 2048) ──
const _startvalSlider = document.getElementById('startval-slider');
const _startvalVal    = document.getElementById('startval-val');
function applyStartValSlider(exp) {
  const v = Math.pow(2, exp);
  CFG.PLAYER_START_VAL = v;
  _startvalVal.textContent = v;
  const pct = Math.round((exp - 1) / (11 - 1) * 100);
  _startvalSlider.style.setProperty('--pct', pct + '%');
  _startvalSlider.value = exp;
}
if(_startvalSlider) {
  _startvalSlider.addEventListener('input', () => applyStartValSlider(parseInt(_startvalSlider.value)));
  // Init from CFG — don't overwrite what config.js set
  const _initExp = Math.max(1, Math.min(11, Math.round(Math.log2(Math.max(2, CFG.PLAYER_START_VAL || 2)))));
  applyStartValSlider(_initExp);
}

// show existing high scores
const ehs=loadHS();
if(ehs.length){
  const el=document.getElementById('hs0');
  el.innerHTML='<table style="margin-top:8px"><thead><tr><th>#</th><th>Score</th><th>Date</th></tr></thead><tbody id="hs0b"></tbody></table>';
  renderHS('hs0b',ehs);
}

G = { player:null, bots:[], food:[], running:false, camC:20, camR:20, tgtC:20, tgtR:20 };
// MP overlay init handled by window 'load' event in multiplayer.js
// Loop kickoff is at the end of main.js (after loop() is defined)
