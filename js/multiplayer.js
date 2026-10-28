// ══════════════════════════════════════════════════════════════════════
//  CHANGELOG
// ══════════════════════════════════════════════════════════════════════
//  v2.3.0 — 2026-05-03
//  ─ Multiplayer lobby: peer IDs now encode mode (snakecubes-cXX coop,
//    snakecubes-vXX versus). Lobby list shows 🤝/⚔️ mode badge + description.
//    Manual code entry auto-tries both prefixes before failing.
//    Lobby auto-scan interval bug fixed (was referencing non-existent screen ID).
//  ─ Co-op mode (5 min): players cannot eat each other (friendly-fire off).
//    When a human player kills a bot with headVal ≥ MP_COOP_LARGE_BOT_VAL (64),
//    bonus food is scattered near every live human player ("big kill" mechanic).
//    Individual scores still compete for leaderboard ranking.
//  ─ Competitive mode (8 min, CFG.MP_COMP_ROUND_SEC): players CAN eat each
//    other and all bots. Respawn formula changed to 2^(x-2) (lose 2 exponent
//    levels, floor at 2). Host player now respawns instead of ending the game.
//  ─ Competitive speed handicap: smaller human player gains 2%×(level gap)
//    speed advantage over the largest human (max 5-level gap = 10% bonus).
//    Constants: CFG.MP_COMP_SPEED_ADV=0.02, CFG.MP_COMP_SPEED_ADV_MAX=5.
//  ─ Terrain Z scale: CFG.TERRAIN_Z_SCALE added as a dev-slider constant
//    (Terrain → Z-Scale, range 0.1×–5.0×, default 1.0×). Athena rolling
//    hills amplitude is multiplied by this value.
// ══════════════════════════════════════════════════════════════════════

// ── MP overlay DOM — injected here so index.html stays slim ──
(function() {
  const el = document.createElement('div');
  el.id = 'mp-overlay'; el.className = 'hidden masonry';
  el.innerHTML = `
    <div id="mp-screen-main">
      <h2 style="margin-bottom:8px;text-align:center">FELIX'S<br>SNAKE CUBES</h2>
      <button class="mp-btn" id="menu-music" style="margin-bottom:8px;padding:8px 18px;font-size:0.7rem">🔊 MUSIC ON</button>
      <div class="stone-wall">
        <button class="stone s1" id="menu-felix" style="--c:#00f5c4">🐍 FELIX</button>
        <button class="stone s2" id="menu-athena" style="--c:#bf5fff">🦉 ATHENA</button>
        <button class="stone s3" id="menu-dad" style="--c:#22aaff">🏘️ DAD</button>
        <button class="stone s4" id="menu-others" style="--c:#ff6b35">👥 OTHERS</button>
      </div>
      <div id="menu-opts" style="width:100%;max-width:300px;display:flex;flex-direction:column;gap:6px;margin-top:6px"></div>
      <div style="width:100%;max-width:300px;margin-top:6px">
        <p class="menu-section-label">Controls</p>
        <div style="display:flex;gap:8px">
          <button class="ctrl-pill" id="ctrl-felix-btn">🎮 FELIX<br><span style="font-size:0.5rem;opacity:0.6">hold &amp; steer</span></button>
          <button class="ctrl-pill" id="ctrl-joy-btn">🕹️ JOYSTICK<br><span style="font-size:0.5rem;opacity:0.6">pad + hook</span></button>
        </div>
      </div>
      <div class="stone-wall" style="margin-top:12px;grid-template-columns:1fr">
        <button class="stone s2" id="menu-start" style="--c:#ffb02e">START</button>
      </div>
    </div>
    <div id="mp-screen-others" class="hidden">
      <h2 style="margin-bottom:8px;text-align:center">OTHERS</h2>
      <div id="mp-name-row" style="display:flex;align-items:center;gap:8px;margin-bottom:8px">
        <input id="mp-name-input" type="text" maxlength="12" placeholder="Your name" autocomplete="off" autocorrect="off" spellcheck="false">
      </div>
      <div style="width:100%;max-width:300px;display:flex;flex-direction:column;gap:5px;">
        <p class="menu-section-label" style="margin-top:4px">Multiplayer</p>
        <div style="display:flex;gap:8px">
          <button class="mp-btn solid" id="mp-btn-host-coop" style="flex:1;padding:9px 4px;font-size:0.66rem;line-height:1.35">🤝 CO-OP<br><span style="font-size:0.56rem;opacity:0.7">create room</span></button>
          <button class="mp-btn orange" id="mp-btn-host-comp" style="flex:1;padding:9px 4px;font-size:0.66rem;line-height:1.35">⚔️ VERSUS<br><span style="font-size:0.56rem;opacity:0.7">create room</span></button>
        </div>
        <p class="menu-section-label" style="margin-top:4px">Join a Room</p>
        <div style="display:flex;gap:8px">
          <button class="mp-btn" id="mp-btn-join-coop" style="flex:1;padding:9px 4px;font-size:0.66rem;line-height:1.35">🤝 TRY JOIN<br><span style="font-size:0.56rem;opacity:0.55">CO-OP</span></button>
          <button class="mp-btn orange" id="mp-btn-join-comp" style="flex:1;padding:9px 4px;font-size:0.66rem;line-height:1.35">⚔️ TRY JOIN<br><span style="font-size:0.56rem;opacity:0.55">VERSUS</span></button>
        </div>
      </div>
      <p class="menu-section-label" style="margin-top:4px">Another game</p>
      <a class="mp-btn" href="snake2/" style="display:block;text-align:center;text-decoration:none;padding:10px">🏛️ SNAKE II<br><span style="font-size:0.56rem;opacity:0.7">Roman numerals · grid snake</span></a>
      <a class="mp-btn" href="map-builder.html" style="display:block;text-align:center;text-decoration:none;padding:10px;margin-top:6px">🛠 MAP BUILDERS<br><span style="font-size:0.56rem;opacity:0.7">images · real world · mazes</span></a>
      <p id="mp-status" style="font-size:0.65rem;color:#555570;min-height:1.1em;margin-top:4px;text-align:center"></p>
      <button class="mp-btn" id="mp-btn-others-back" style="width:100%;max-width:300px;margin-top:10px;padding:10px">← BACK</button>
    </div>
    <div id="mp-screen-connecting" class="hidden">
      <h2>CONNECTING</h2>
      <p id="mp-status-conn" style="color:#555570;text-align:center">Joining game...</p>
      <button class="mp-btn red" id="mp-btn-cancel">CANCEL</button>
    </div>
    <div id="mp-screen-waiting" class="hidden">
      <h2 style="font-size:1.1rem;letter-spacing:2px;margin-bottom:2px">ROOM</h2>
      <div id="mp-room-code-display">--</div>
      <p id="mp-waiting-subtitle"></p>
      <div id="mp-waiting-players"></div>
      <button class="mp-btn solid" id="mp-btn-start-game" disabled>START GAME</button>
      <button class="mp-btn red" id="mp-btn-leave-waiting">LEAVE</button>
    </div>`;
  document.body.appendChild(el);
})();

// ══════════════════════════════════════════════════════
//  MULTIPLAYER ENGINE  (v2.3 — active lobby + full modes)
// ══════════════════════════════════════════════════════

// ── PeerJS loaded from CDN (graceful fallback if offline) ──
const PEERJS_CDN = 'https://unpkg.com/peerjs@1.5.2/dist/peerjs.min.js';

const MP = {
  enabled: false,       // true once game has started
  isHost: false,
  peer: null,           // PeerJS Peer object
  conns: [],            // DataConnection[] — host: all guests; guest: just host
  players: {},          // peerId → { name, pal, snake, score, conn }
  waitingGuests: {},    // peerId → { name, conn } — pre-game guests in waiting room
  localName: '',
  localPal: null,
  mode: 'solo',         // 'solo' | 'coop' | 'competitive'
  respawnTimer: null,
  graceUntil: 0,
  hostCode: '',
  hostPeerId: '',
};

// ── Human-readable peer IDs for lobby ──
// Peer IDs encode game mode as a prefix letter + 2-letter code (e.g. snakecubes-cAB)
//   c = co-op,  v = versus/competitive
// The displayed code to players is just the 2 uppercase letters (e.g. AB).
const LETTERS = 'ABCDEFGHJKLMNPQRSTUVWXYZ'; // no I/O to avoid confusion
function makePeerCode() {
  return LETTERS[Math.floor(Math.random()*LETTERS.length)] +
         LETTERS[Math.floor(Math.random()*LETTERS.length)];
}
function makePeerId(mode) {
  const m = (mode === 'competitive') ? 'v' : 'c';
  return 'snakecubes-' + m + makePeerCode(); // e.g. snakecubes-cAB
}

// Parse a full peer ID into { mode, code, fullId } — handles legacy 2-letter IDs too
function parseLobbyId(id) {
  const m1 = id.match(/^snakecubes-([cv])([A-Z]{2})$/i);
  if(m1) return { mode: m1[1].toLowerCase()==='v' ? 'competitive' : 'coop', code: m1[2].toUpperCase(), fullId: id };
  const m2 = id.match(/^snakecubes-([A-Z]{2})$/i); // legacy
  if(m2) return { mode: 'unknown', code: m2[1].toUpperCase(), fullId: id };
  return null;
}

const BROKER_PREFIX = 'snakecubes-';

// ── Load PeerJS dynamically ──
function loadPeerJS(cb) {
  if(window.Peer) { cb(); return; }
  const s = document.createElement('script');
  s.src = PEERJS_CDN;
  s.onload = cb;
  s.onerror = () => { setMPStatus('PeerJS unavailable — solo only'); cb(null); };
  document.head.appendChild(s);
}

// ── Music: one switch, shown on the start menu and in the in-game settings ──
function syncMusicUI() {
  const on = typeof MUS !== 'undefined' && !MUS.muted;
  const btn = document.getElementById('menu-music');
  if (btn) btn.textContent = on ? '🔊 MUSIC ON' : '🔇 MUSIC OFF';
  const chk = document.getElementById('music-chk');
  if (chk) chk.checked = on;
  const val = document.getElementById('music-val');
  if (val) { val.textContent = on ? 'on' : 'off'; val.style.color = on ? '#00f5c4' : '#555570'; }
}

// ── Screen helpers ──
function showMPScreen(name) {
  document.getElementById('mp-overlay').classList.remove('hidden');
  // Unknown names (e.g. legacy 'menu') fall back to the start menu
  const show = ['main', 'others', 'connecting', 'waiting'].includes(name) ? name : 'main';
  const screens = { main: 'mp-screen-main', others: 'mp-screen-others', connecting: 'mp-screen-connecting', waiting: 'mp-screen-waiting' };
  for(const key in screens) {
    const el = document.getElementById(screens[key]);
    if(el) el.classList.toggle('hidden', show !== key);
  }
}
function hideMPOverlay() {
  document.getElementById('mp-overlay').classList.add('hidden');
}
function setMPStatus(msg, id='mp-status') {
  const el = document.getElementById(id);
  if(el) el.textContent = msg;
}

// ── Player name persistence ──
function loadPlayerName() {
  return localStorage.getItem('mp_name') || pickCity();
}
function savePlayerName(n) {
  localStorage.setItem('mp_name', n);
}

// ── Difficulty presets — keys match CFG property names, merged via Object.assign ──
// ROUND_SEC:0 = unlimited play (no countdown, never ends by time)
const DIFF = {
  easy:   { ROUND_SEC:300, NUM_BOTS: Math.round(16 * WORLD_DENSITY), BOT_MAX: Math.round(26 * WORLD_DENSITY),  DIFFICULTY:0.9,  BOT_CHASE_RANGE:72  }, // 5 min
  hard:   { ROUND_SEC:420, NUM_BOTS: Math.round(32 * WORLD_DENSITY), BOT_MAX: Math.round(60 * WORLD_DENSITY),  DIFFICULTY:1.8,  BOT_CHASE_RANGE:104 }, // 7 min
  insane: { ROUND_SEC:540, NUM_BOTS: Math.round(44 * WORLD_DENSITY), BOT_MAX: Math.round(88 * WORLD_DENSITY),  DIFFICULTY:3.0,  BOT_CHASE_RANGE:144 }, // 9 min
};
let _diffPreset = 'hard';

function applyDifficulty(preset) {
  _diffPreset = preset;
  Object.assign(CFG, DIFF[preset] || DIFF.hard);
  EXPERT_MODE = (preset === 'insane');
  HOOK_ENABLED = (preset !== 'easy');
}

// ── Initialise MP overlay on page load ──
function initMPOverlay() {
  MP.localName = loadPlayerName();
  if(!localStorage.getItem('mp_name')) MP.localName = pickCity('obscure');
  const inp = document.getElementById('mp-name-input');
  inp.value = MP.localName;
  inp.addEventListener('input', () => {
    const v = inp.value.trim();
    if(v) { MP.localName = v; savePlayerName(v); }
  });

  // ── Start menu ──
  // Four modes. Each mode has its own options (difficulty; map for Dad's).
  // START launches the selected mode with its current settings.
  const dadMaps = Object.keys(window._DAD_MAPS_DATA || {});
  const MENU = { mode: 'felix', felix: 'hard', athena: 'easy', dad: 'normal', map: dadMaps[0] || null,
                 src: 'classic', mine: [], mineSel: null, mineMsg: '',
                 favs: null, favSel: null, favMsg: '' };
  // The map picked for START, whichever WORLD source is showing
  const curMap = () => MENU.src === 'mine' ? MENU.mineSel : MENU.src === 'fav' ? MENU.favSel : MENU.map;
  // FAVORITES = maps saved to the family database from Map Builder 2.0 / 3.0
  async function loadFavs(selectId) {
    MENU.favs = null; renderMenu();
    try { MENU.favs = await MapCloud.list(); MENU.favMsg = ''; }
    catch (err) { MENU.favs = []; MENU.favMsg = 'Could not reach the family database: ' + err.message; }
    if (selectId) MENU.favSel = 'cloud:' + selectId;
    if (!MENU.favs.some(f => 'cloud:' + f.id === MENU.favSel)) MENU.favSel = MENU.favs[0] ? 'cloud:' + MENU.favs[0].id : null;
    renderMenu();
  }
  // MY MAPS = maps made in Map Builder 2.0 (real world) / 3.0 (mazes), saved in this browser
  async function refreshMine(selectId) {
    try {
      MENU.mine = (window.MapStore && MapStore.available) ? await MapStore.list() : [];
      MENU.mineMsg = '';
    } catch (err) { MENU.mine = []; MENU.mineMsg = 'Saved maps are unavailable in this browser.'; }
    for (const id of Object.keys(DAD.fileMaps)) {
      const m = DAD.fileMaps[id];
      MENU.mine.push({ id: id, name: m.name || m.id, kind: m.kind, fromFile: true });
    }
    const ids = MENU.mine.map(m => (m.fromFile ? '' : 'store:') + m.id);
    if (selectId) MENU.mineSel = selectId;
    if (!ids.includes(MENU.mineSel)) MENU.mineSel = ids[0] || null;
    renderMenu();
  }
  function loadMapFile() {
    const inp = document.createElement('input');
    inp.type = 'file'; inp.accept = '.json,application/json';
    inp.addEventListener('change', async () => {
      const f = inp.files[0]; if (!f) return;
      try {
        const data = JSON.parse(await f.text());
        if (!data.imageDataURL || !data.gridCols || !data.gridRows || !Array.isArray(data.objects)) throw new Error('This is not a map made by Map Builder 2.0 / 3.0.');
        data.id = data.id || ('file-' + Date.now().toString(36));
        let sel;
        try { await MapStore.put(data); sel = 'store:' + data.id; }
        catch (e) { DAD.fileMaps['file:' + data.id] = data; sel = 'file:' + data.id; }
        MENU.src = 'mine';
        await refreshMine(sel);
      } catch (err) { alert('Could not load that map:\n' + err.message); }
    });
    inp.click();
  }
  const dadLabel = path => {
    const data = window._DAD_MAPS_DATA && window._DAD_MAPS_DATA[path];
    const raw  = (data && data.id) || path.replace(/^assets\//, '').replace(/\.json$/i, '');
    return (raw.charAt(0).toUpperCase() + raw.slice(1)).toUpperCase();
  };
  function renderMenu() {
    const tiles = { felix: 'menu-felix', athena: 'menu-athena', dad: 'menu-dad' };
    for (const m in tiles) document.getElementById(tiles[m]).classList.toggle('active', MENU.mode === m);
    const box = document.getElementById('menu-opts');
    box.innerHTML = '';
    const pills = (rowLabel, items, selected, onPick) => {
      const lbl = document.createElement('p');
      lbl.className = 'menu-section-label';
      lbl.textContent = rowLabel;
      box.appendChild(lbl);
      const row = document.createElement('div');
      row.style.cssText = 'display:flex;gap:8px';
      for (const [key, text] of items) {
        const b = document.createElement('button');
        b.className = 'ctrl-pill' + (key === selected ? ' active' : '');
        b.textContent = text;
        b.addEventListener('click', () => { onPick(key); renderMenu(); });
        row.appendChild(b);
      }
      box.appendChild(row);
    };
    if (MENU.mode === 'felix') {
      pills('DIFFICULTY', [['easy', 'EASY · 5 min'], ['hard', 'HARD · 7 min'], ['insane', 'INSANE · 9 min']], MENU.felix, v => { MENU.felix = v; });
    } else if (MENU.mode === 'athena') {
      pills('DIFFICULTY', [['easy', 'EASY · 7 min'], ['hard', 'HARD · 9 min']], MENU.athena, v => { MENU.athena = v; });
    } else if (MENU.mode === 'dad') {
      pills('WORLD', [['classic', 'CLASSIC'], ['mine', 'MY MAPS'], ['fav', '★ FAVORITES']], MENU.src,
            v => { MENU.src = v; if (v === 'mine') refreshMine(); if (v === 'fav') loadFavs(); });
      if (MENU.src === 'classic') {
        pills('MAP', dadMaps.map(p => [p, dadLabel(p)]), MENU.map, v => { MENU.map = v; });
      } else if (MENU.src === 'fav') {
        const icon = k => k === 'maze' ? '🧩 ' : k === 'world' ? '🌍 ' : '';
        if (MENU.favs === null) {
          const note = document.createElement('p');
          note.className = 'menu-section-label'; note.textContent = 'Loading favorites…';
          box.appendChild(note);
        } else if (MENU.favs.length) {
          pills('FAMILY FAVORITES', MENU.favs.map(m => ['cloud:' + m.id, icon(m.kind) + String(m.name).toUpperCase().slice(0, 18)]),
                MENU.favSel, v => { MENU.favSel = v; });
        } else {
          const note = document.createElement('p');
          note.className = 'menu-section-label';
          note.textContent = MENU.favMsg || 'No favorites yet. Make a map in a Map Builder and tap ★ SAVE FAVORITE.';
          box.appendChild(note);
        }
        const row = document.createElement('div');
        row.style.cssText = 'display:flex;gap:8px;margin-top:6px';
        const refresh = document.createElement('button');
        refresh.className = 'ctrl-pill'; refresh.textContent = '↻ REFRESH';
        refresh.addEventListener('click', () => loadFavs());
        row.appendChild(refresh);
        box.appendChild(row);
      } else {
        const mineIcon = k => k === 'maze' ? '🧩 ' : k === 'world' ? '🌍 ' : '';
        if (MENU.mine.length) {
          pills('YOUR MAPS', MENU.mine.map(m => [(m.fromFile ? '' : 'store:') + m.id, mineIcon(m.kind) + String(m.name).toUpperCase().slice(0, 18)]),
                MENU.mineSel, v => { MENU.mineSel = v; });
        } else {
          const note = document.createElement('p');
          note.className = 'menu-section-label';
          note.textContent = MENU.mineMsg || 'No saved maps yet — make one in a Map Builder, or load a file.';
          box.appendChild(note);
        }
        const row = document.createElement('div');
        row.style.cssText = 'display:flex;gap:8px;margin-top:6px';
        const load = document.createElement('button');
        load.className = 'ctrl-pill'; load.textContent = '📂 LOAD MAP FILE';
        load.addEventListener('click', loadMapFile);
        row.appendChild(load);
        if (MENU.mineSel && /^store:/.test(MENU.mineSel)) {
          const del = document.createElement('button');
          del.className = 'ctrl-pill'; del.textContent = '🗑 DELETE';
          del.addEventListener('click', async () => {
            if (!confirm('Delete this saved map from this device?')) return;
            try { await MapStore.del(MENU.mineSel.slice(6)); } catch (e) {}
            MENU.mineSel = null; refreshMine();
          });
          row.appendChild(del);
        }
        box.appendChild(row);
      }
      pills('DIFFICULTY', [['normal', 'NORMAL · 7 min'], ['hard', 'HARD · 9 min']], MENU.dad, v => { MENU.dad = v; });
      const bl = document.createElement('a');
      bl.className = 'ctrl-pill'; bl.href = 'map-builder.html';
      bl.style.cssText = 'display:block;text-align:center;text-decoration:none;margin-top:6px';
      bl.innerHTML = '🛠 MAP BUILDERS<br><span style="font-size:0.5rem;opacity:0.6">1.0 images · 2.0 real world · 3.0 mazes</span>';
      box.appendChild(bl);
    }
  }
  async function startSelected() {
    if (MENU.mode === 'felix') {
      applyDifficulty(MENU.felix);
      updateGameTitle(MENU.felix === 'easy' ? 'GUEST MODE' : MENU.felix === 'insane' ? 'INSANE MODE' : 'FELIX MODE');
      startSolo();
    } else if (MENU.mode === 'athena') {
      ATHENA.diffMode = MENU.athena;
      startAthena();
    } else if (MENU.mode === 'dad' && curMap()) {
      const btn = document.getElementById('menu-start');
      btn.disabled = true;
      btn.textContent = 'LOADING…';
      try {
        await launchDadMode(curMap(), MENU.dad === 'hard');
      } catch (err) {
        console.error('DAD:', err);
        alert('Could not load Dad\'s Mode:\n' + err.message);
      } finally {
        btn.disabled = false;
        btn.textContent = 'START';
      }
    }
  }
  document.getElementById('menu-felix').addEventListener('click',  () => { MENU.mode = 'felix';  renderMenu(); });
  document.getElementById('menu-athena').addEventListener('click', () => { MENU.mode = 'athena'; renderMenu(); });
  document.getElementById('menu-dad').addEventListener('click',    () => { MENU.mode = 'dad';    renderMenu(); if (MENU.src === 'mine') refreshMine(); if (MENU.src === 'fav') loadFavs(); });
  document.getElementById('menu-others').addEventListener('click', () => showMPScreen('others'));
  document.getElementById('menu-start').addEventListener('click',  startSelected);
  document.getElementById('menu-music').addEventListener('click', () => {
    if (typeof MUS !== 'undefined') MUS.setMuted(!MUS.muted);
    syncMusicUI();
  });
  syncMusicUI();
  document.getElementById('mp-btn-others-back').addEventListener('click', () => showMPScreen('main'));
  renderMenu();

  // Create room
  document.getElementById('mp-btn-host-coop').addEventListener('click', () => {
    applyDifficulty('hard'); createRoom('coop');
  });
  document.getElementById('mp-btn-host-comp').addEventListener('click', () => {
    applyDifficulty('hard'); createRoom('competitive');
  });

  // TRY JOIN buttons
  document.getElementById('mp-btn-join-coop').addEventListener('click', () => {
    joinGame('snakecubes-cFX', null);
  });
  document.getElementById('mp-btn-join-comp').addEventListener('click', () => {
    joinGame('snakecubes-vFX', null);
  });

  // Cancel connecting
  document.getElementById('mp-btn-cancel').addEventListener('click', () => {
    if(MP.peer) { MP.peer.destroy(); MP.peer = null; }
    MP.isHost = false;
    showMPScreen('main');
  });

  // Waiting room: START and LEAVE buttons
  document.getElementById('mp-btn-start-game').addEventListener('click', () => {
    hostGame(MP.mode);
  });
  document.getElementById('mp-btn-leave-waiting').addEventListener('click', () => {
    resetMPState();
    showMPScreen('main');
  });

  // Control mode toggle
  document.getElementById('ctrl-felix-btn').addEventListener('click', () => setCtrlMode('felix'));
  document.getElementById('ctrl-joy-btn').addEventListener('click',   () => setCtrlMode('joystick'));
  setCtrlMode(CTRL_MODE);

  showMPScreen('main');
  initJoystickHandlers();
}

// ── Solo start (wraps existing initGame) ──
function startSolo() {
  MP.mode = 'solo';
  MP.isHost = false;
  MP.enabled = false;
  hideMPOverlay();
  document.getElementById('s-start').classList.add('hidden');
  initGame();
}

// ── Create room — host registers on PeerJS then moves to waiting room screen ──
function createRoom(mode) {
  MP.localName = document.getElementById('mp-name-input').value.trim() || MP.localName;
  savePlayerName(MP.localName);
  if(MP.peer) { MP.peer.destroy(); MP.peer = null; }
  MP.mode = mode;
  MP.isHost = true;
  MP.localPal = HUMAN_PALS[0];
  MP.waitingGuests = {};
  setMPStatus('Creating room...', 'mp-status');

  CFG.ROUND_SEC = mode === 'competitive' ? CFG.MP_COMP_ROUND_SEC : CFG.MP_COOP_ROUND_SEC;

  loadPeerJS(() => {
    if(!window.Peer) { setMPStatus('Network unavailable — check internet connection', 'mp-status'); return; }
    const pid = (mode === 'competitive') ? 'snakecubes-vFX' : 'snakecubes-cFX';
    const createdPeer = new Peer(pid, { debug: 0 });
    MP.peer = createdPeer;
    MP.peer.on('open', id => {
      const code = id.replace('snakecubes-', '').toUpperCase();
      MP.hostCode = code;
      MP.hostPeerId = id;
      MP.enabled = false;
      const displayCode = code.slice(-2);
      // Show waiting room
      document.getElementById('mp-room-code-display').textContent = displayCode;
      const modeLabel = mode === 'coop' ? '🤝 CO-OP' : '⚔️ VERSUS';
      document.getElementById('mp-waiting-subtitle').textContent =
        modeLabel + ' · Share this code with friends';
      document.getElementById('mp-btn-start-game').disabled = true;
      updateWaitingPlayers();
      showMPScreen('waiting');
      setupHostListeners();
    });
    createdPeer.on('error', e => {
      if(MP.peer !== createdPeer) return; // stale event — a newer peer has taken over
      setMPStatus('Error: ' + e.type, 'mp-status');
      MP.isHost = false; MP.peer = null;
      showMPScreen('main');
    });
  });
}

// ── Enter the game as host — called from START button in waiting room ──
function hostGame(mode) {
  if(!MP.peer || !MP.hostPeerId) return;
  MP.mode = mode;
  MP.enabled = true;
  MP.localPal = HUMAN_PALS[0];
  HOOK_ENABLED = true;
  updateHookVisibility();
  hideMPOverlay();
  document.getElementById('s-start').classList.add('hidden');
  const badge = document.getElementById('mode-badge');
  const displayCode = (MP.hostCode||'').slice(-2);
  badge.textContent = (mode === 'coop' ? '🤝' : '⚔️') + ' ' + displayCode;
  badge.className = 'mode-badge ' + (mode === 'coop' ? 'coop' : 'comp');
  badge.classList.remove('hidden');
  updateGameTitle(mode === 'coop' ? 'CO-OP' : 'VERSUS');
  initGame();

  // Spawn a snake for each waiting guest and send full game state
  Object.values(MP.waitingGuests).forEach((guest, i) => {
    const palIdx = i + 1;
    const pal = HUMAN_PALS[palIdx % HUMAN_PALS.length];
    const spawnPos = edgeSpawnPos();
    const sn = newSnake(spawnPos.col, spawnPos.row,
      Math.cos(spawnPos.angle), Math.sin(spawnPos.angle),
      CFG.PLAYER_LEN, 2, false, pal);
    sn.isHuman = true;
    sn.peerId = guest.conn.peer;
    sn.name = guest.name;
    sn.palette = pal;
    G.bots.push(sn);
    MP.players[guest.conn.peer] = { id: guest.conn.peer, name: sn.name, palIdx, pal, snake: sn, score: 0, conn: guest.conn };
    try {
      guest.conn.send({ type:'game_start', pal, palIdx, mode,
        food: G.food, specials: G.specials,
        bots: G.bots.filter(b=>!b.dead).map(serializeSnake),
        players: Object.values(MP.players).map(p=>({id:p.id,name:p.name,palIdx:p.palIdx})),
        hookEnabled: HOOK_ENABLED,
      });
    } catch(e) {}
  });
  MP.waitingGuests = {};
  updateHUDPlayers();
}

// ── Host: listen for incoming connections ──
function setupHostListeners() {
  MP.peer.on('connection', conn => {
    if(MP.conns.length >= 4) { conn.close(); return; } // max 5 total
    MP.conns.push(conn);
    conn.on('open', () => {
      if(MP.enabled && G && G.running) {
        // Late join after game started — send full game state immediately
        const palIdx = Object.keys(MP.players).length + 1;
        const pal = HUMAN_PALS[palIdx % HUMAN_PALS.length];
        conn.send({ type:'game_start', pal, palIdx, mode: MP.mode,
          food: G.food, specials: G.specials,
          bots: G.bots.filter(b=>!b.dead).map(serializeSnake),
          players: Object.values(MP.players).map(p=>({id:p.id,name:p.name,palIdx:p.palIdx})),
          hookEnabled: HOOK_ENABLED,
        });
      }
      // Pre-game: wait for guest's 'join' message to get their name
    });
    conn.on('data', d => hostReceive(conn, d));
    conn.on('close', () => {
      MP.conns = MP.conns.filter(c => c !== conn);
      delete MP.waitingGuests[conn.peer];
      if(MP.enabled) hostPlayerLeft(conn);
      else { broadcastWaitingLobby(); updateWaitingPlayers(); }
    });
    conn.on('error', () => {
      MP.conns = MP.conns.filter(c => c !== conn);
      delete MP.waitingGuests[conn.peer];
      if(MP.enabled) hostPlayerLeft(conn);
      else { broadcastWaitingLobby(); updateWaitingPlayers(); }
    });
  });
}

// ── Waiting room helpers ──
function renderWaitingPlayers(players) {
  const el = document.getElementById('mp-waiting-players');
  if(!el) return;
  if(!players.length) {
    el.innerHTML = '<div style="color:#444;font-size:0.7rem;font-family:\'Courier New\',monospace">Waiting for players to join...</div>';
    return;
  }
  el.innerHTML = players.map((p, i) => {
    const pal = HUMAN_PALS[i % HUMAN_PALS.length];
    const color = pal ? pal[0] : '#00f5c4';
    const tag = p.isYou ? ' <span style="color:#555570;font-size:0.6rem">(you)</span>' : '';
    return `<div class="mp-waiting-player${p.isYou ? ' is-you' : ''}">
      <div class="wp-dot" style="background:${color}"></div>
      <span>${p.name}${tag}</span>
    </div>`;
  }).join('');
}

function updateWaitingPlayers() {
  const players = [{ name: MP.localName, isYou: true },
    ...Object.values(MP.waitingGuests).map(g => ({ name: g.name }))];
  renderWaitingPlayers(players);
  const btn = document.getElementById('mp-btn-start-game');
  if(btn) btn.disabled = Object.keys(MP.waitingGuests).length === 0;
}

function broadcastWaitingLobby() {
  const players = [{ name: MP.localName },
    ...Object.values(MP.waitingGuests).map(g => ({ name: g.name }))];
  const msg = { type:'lobby', mode: MP.mode, hostName: MP.localName, players };
  MP.conns.forEach(c => { try { c.send(msg); } catch(e) {} });
}

// ── Host receives data from a guest ──
function hostReceive(conn, d) {
  if(!d || !d.type) return;
  if(d.type === 'join') {
    const name = d.name || ('Player' + (MP.conns.indexOf(conn) + 2));
    if(!MP.enabled) {
      // Pre-game: add to waiting room
      MP.waitingGuests[conn.peer] = { name, conn };
      broadcastWaitingLobby();
      updateWaitingPlayers();
      return;
    }
    // Mid-game late join: create snake immediately
    const palIdx = Object.keys(MP.players).length + 1;
    const pal = HUMAN_PALS[palIdx % HUMAN_PALS.length];
    const spawnPos = edgeSpawnPos();
    const sn = newSnake(spawnPos.col, spawnPos.row,
      Math.cos(spawnPos.angle), Math.sin(spawnPos.angle),
      CFG.PLAYER_LEN, 2, false, pal);
    sn.isHuman = true;
    sn.peerId = conn.peer;
    sn.name = name;
    sn.palette = pal;
    G.bots.push(sn);
    MP.players[conn.peer] = { id: conn.peer, name: sn.name, palIdx, pal, snake: sn, score: 0, conn };
    broadcastToAll({ type:'player_join', peerId: conn.peer, name: sn.name, palIdx });
    updateHUDPlayers();
  } else if(d.type === 'input') {
    // Guest sends their steering angle
    const p = MP.players[conn.peer];
    if(p && p.snake && !p.snake.dead) {
      p.snake.angle = d.angle;
      p.snake.dir = { dx: Math.cos(d.angle), dy: Math.sin(d.angle) };
    }
  } else if(d.type === 'fire_hook') {
    const p = MP.players[conn.peer];
    if(p && p.snake && !p.snake.dead) fireHook(p.snake);
  } else if(d.type === 'respawn_ready') {
    respawnGuest(conn.peer);
  }
}

// ── Host: guest disconnected ──
function hostPlayerLeft(conn) {
  MP.conns = MP.conns.filter(c => c !== conn);
  const p = MP.players[conn.peer];
  if(p && p.snake) p.snake.dead = true;
  delete MP.players[conn.peer];
  broadcastToAll({ type:'player_left', peerId: conn.peer });
  updateHUDPlayers();
}

// ── Guest: connect to a specific peer ID ──
function joinGame(hostPeerId) {
  MP.localName = document.getElementById('mp-name-input').value.trim() || MP.localName;
  savePlayerName(MP.localName);
  if(MP.peer) { MP.peer.destroy(); MP.peer = null; }
  MP.isHost = false;
  MP.conns = [];
  showMPScreen('connecting');
  setMPStatus('Connecting...', 'mp-status-conn');

  loadPeerJS(() => {
    if(!window.Peer) { setMPStatus('PeerJS unavailable', 'mp-status-conn'); return; }
    MP.peer = new Peer(makePeerId(), { debug: 0 });
    MP.peer.on('open', () => {
      const conn = MP.peer.connect(hostPeerId, { reliable: true });
      MP.conns = [conn];
      conn.on('open', () => {
        setMPStatus('Connected! Waiting for host...', 'mp-status-conn');
        conn.send({ type:'join', name: MP.localName });
      });
      conn.on('data', d => guestReceive(d));
      conn.on('close', () => guestDisconnected());
      conn.on('error', () => guestDisconnected());
    });
    MP.peer.on('error', e => {
      if(e.type === 'peer-unavailable') {
        setMPStatus('No room open — host one first', 'mp-status');
        showMPScreen('main');
        return;
      }
      setMPStatus('Connection failed: ' + e.type, 'mp-status-conn');
      showMPScreen('main');
    });
  });
}

// ── Guest receives data from host ──
function guestReceive(d) {
  if(!d || !d.type) return;
  if(d.type === 'lobby') {
    // Host put us in the waiting room
    MP.mode = d.mode;
    const modeLabel = d.mode === 'coop' ? '🤝 CO-OP' : '⚔️ VERSUS';
    document.getElementById('mp-room-code-display').textContent =
      (MP.conns[0]?.peer || '').replace('snakecubes-','').toUpperCase().slice(-2);
    document.getElementById('mp-waiting-subtitle').textContent =
      modeLabel + ' · Waiting for ' + d.hostName + ' to start...';
    renderWaitingPlayers(d.players.map((p, i) => ({
      ...p, isYou: p.name === MP.localName && i > 0
    })));
    showMPScreen('waiting');
    return;
  }
  if(d.type === 'game_start' || d.type === 'welcome') {
    MP.mode = d.mode;
    MP.localPal = d.pal;
    MP.enabled = true;
    if(d.hookEnabled !== undefined) { HOOK_ENABLED = d.hookEnabled; updateHookVisibility(); }
    hideMPOverlay();
    document.getElementById('s-start').classList.add('hidden');
    const badge = document.getElementById('mode-badge');
    badge.textContent = d.mode === 'coop' ? 'CO-OP' : 'VERSUS';
    badge.className = 'mode-badge ' + (d.mode === 'coop' ? 'coop' : 'comp');
    badge.classList.remove('hidden');
    updateGameTitle(d.mode === 'coop' ? 'CO-OP' : 'VERSUS');
    initGuestGame(d);
    return;
  }
  if(d.type === 'state') {
    applyHostState(d);
  } else if(d.type === 'player_join') {
    updateHUDPlayers();
  } else if(d.type === 'player_left') {
    updateHUDPlayers();
  } else if(d.type === 'killfeed') {
    showKillFeed(d.msg, d.color);
  } else if(d.type === 'you_died') {
    startRespawnCountdown(d.killerName, d.respawnVal);
  }
}

function guestDisconnected() {
  if(MP.enabled) showFlash('Host disconnected — returning to menu', '#ff4444');
  const wasEnabled = MP.enabled;
  setTimeout(() => {
    if(G) G.running = false;
    clearTimers();
    resetMPState();
    showMPScreen('main');
  }, wasEnabled ? 2000 : 0);
}

// ── Host broadcasts state to all guests every 50ms ──
let _lastStateBroadcast = 0;
function broadcastState(now) {
  if(!MP.enabled || !MP.isHost || !MP.conns.length) return;
  if(now - _lastStateBroadcast < 50) return;
  _lastStateBroadcast = now;
  const snakes = [];
  if(G.player && !G.player.dead)
    snakes.push({ ...serializeSnake(G.player), peerId: '__host', isHuman: true, name: MP.localName || 'Host' });
  G.bots.forEach(b => { if(!b.dead) snakes.push(serializeSnake(b)); });
  const state = {
    type: 'state',
    snakes,
    food: G.food,
    specials: G.specials,
    timeLeft: G.timeLeft,
    players: Object.values(MP.players).map(p => ({
      id: p.id, name: p.name, palIdx: p.palIdx,
      score: p.snake ? (p.snake.segs[0]?.val||0) : 0
    })),
    teamScore: G.score,
  };
  broadcastToAll(state);
}
function broadcastToAll(msg) {
  MP.conns.forEach(conn => { try { conn.send(msg); } catch(e){} });
}

// ── Serialize snake for network ──
function serializeSnake(sn) {
  return {
    peerId: sn.peerId || null,
    isHuman: sn.isHuman || false,
    name: sn.name || '?',
    palIdx: HUMAN_PALS.indexOf(sn.palette),
    angle: sn.angle || 0,
    segs: sn.segs.slice(0,30).map(s=>({ col:Math.round(s.col*10)/10, row:Math.round(s.row*10)/10, val:s.val })),
    lastEatTime: sn.lastEatTime || 0,
    invincUntil: sn.invincUntil || 0,
  };
}

// ── Apply host state on guest side ──
function applyHostState(d) {
  if(!G || !G.running) return;
  G.food = d.food || [];
  G.specials = d.specials || [];
  G.timeLeft = d.timeLeft;
  G.score = d.teamScore || 0;
  updateHUD();

  const now = performance.now();
  const myPeerId = MP.peer?.id;
  const newBots = [];
  for(const s of (d.snakes||[])) {
    // Our own snake: local prediction runs it smoothly; reconcile only on divergence
    if(myPeerId && s.peerId === myPeerId) {
      const hHead = s.segs[0];
      const lHead = G.player.segs[0];
      const dist = (hHead && lHead) ? Math.hypot(hHead.col - lHead.col, hHead.row - lHead.row) : 99;
      if(dist > 3) {
        // Significant divergence (death, collision correction) — snap to host
        G.player.segs = s.segs.map(sg => ({col:sg.col, row:sg.row, prevCol:sg.col, prevRow:sg.row, val:sg.val}));
        G.player.tickAt = now;
      } else {
        // Local prediction is on track — just sync values (eating, invinc, etc.)
        s.segs.forEach((sg, i) => { if(G.player.segs[i]) G.player.segs[i].val = sg.val; });
      }
      G.player.angle = s.angle;
      G.player.dir = {dx: Math.cos(s.angle), dy: Math.sin(s.angle)};
      G.player.lastEatTime = s.lastEatTime;
      G.player.invincUntil = s.invincUntil;
      G.player.dead = false;
      continue;
    }

    let sn = G.bots.find(b => b.peerId === (s.peerId||'__'+s.name) && !b.dead);
    if(!sn) {
      const pal = HUMAN_PALS[s.palIdx] || BOT_PAL[0];
      const head = s.segs[0] || {col:40,row:40,val:2};
      sn = newSnake(head.col, head.row, Math.cos(s.angle), Math.sin(s.angle), 1, head.val, false, pal);
      sn.isHuman = s.isHuman;
      sn.peerId = s.peerId || ('__'+s.name);
      sn.name = s.name;
    }
    // Measure inter-packet time; preserve visual pos for smooth lerp
    const elapsed_b = sn._lastNetAt ? (now - sn._lastNetAt) : 50;
    sn._netTickMs = Math.min(120, Math.max(16, elapsed_b));
    sn._lastNetAt = now;
    sn.segs = s.segs.map((sg, i) => {
      const vis = sn.segs[i] ? lerpSeg(sn.segs[i], sn, now) : null;
      return { col:sg.col, row:sg.row, prevCol:vis?vis.col:sg.col, prevRow:vis?vis.row:sg.row, val:sg.val };
    });
    sn.angle = s.angle;
    sn.dir = {dx: Math.cos(s.angle), dy: Math.sin(s.angle)};
    sn.lastEatTime = s.lastEatTime;
    sn.invincUntil = s.invincUntil;
    sn.tickAt = now;
    sn.dead = false;
    newBots.push(sn);
  }
  G.bots = newBots;
  updateHUDPlayers();
}

// ── Guest-side dead-reckoning: move snake locally without collision physics ──
function localGuestStep(sn) {
  if(!sn || sn.dead || !sn.segs.length) return;
  const a = sn.angle ?? 0;
  for(let i = sn.segs.length-1; i > 0; i--) {
    sn.segs[i].prevCol = sn.segs[i].col;
    sn.segs[i].prevRow = sn.segs[i].row;
    sn.segs[i].col = sn.segs[i-1].col;
    sn.segs[i].row = sn.segs[i-1].row;
  }
  sn.segs[0].prevCol = sn.segs[0].col;
  sn.segs[0].prevRow = sn.segs[0].row;
  sn.segs[0].col += Math.cos(a);
  sn.segs[0].row += Math.sin(a);
  sn.tickAt = performance.now();
}

// ── Guest game init (no simulation, just render) ──
function initGuestGame(welcomeData) {
  _worldMax = 2;
  G = {
    player: newSnake(40, 40, 1, 0, 1, 2, true, MP.localPal || PLAYER_PAL),
    bots: [],
    food: welcomeData.food || [],
    specials: welcomeData.specials || [],
    score: 0,
    level: 0,
    levelSpeedMult: 1.0,
    boostUntil: 0,
    burstAt: 0,
    timeLeft: CFG.ROUND_SEC,
    running: true,
    camC: 40, camR: 40,
    tgtC: 40, tgtR: 40,
    pendingDir: {dc:1,dr:0},
    hooks: [],
  };
  G.player.isHuman = true;
  G.player.name = MP.localName;
  showJoystickUI(true);
  G.player.peerId = MP.peer?.id;

  clearTimers();
  // Fast loop: steer + send angle to host for responsiveness
  function scheduleGuestSteer() {
    _TID.gs = setTimeout(() => {
      if(!G.running) return;
      steerPlayer();
      if(MP.conns[0]) {
        try { MP.conns[0].send({ type:'input', angle: G.player.angle }); } catch(e){}
      }
      scheduleGuestSteer();
    }, Math.max(MIN_TICK_MS, 50));
  }
  // Slow loop: advance snake locally at the same rate as the host player tick
  function scheduleGuestStep() {
    const ms = Math.max(MIN_TICK_MS, snakeTickMs(G.player));
    _TID.pt = setTimeout(() => {
      if(!G.running) return;
      localGuestStep(G.player);
      scheduleGuestStep();
    }, ms);
  }
  scheduleGuestSteer();
  scheduleGuestStep();
  _TID.ct = setInterval(() => { updateHUD(); }, 1000);
}

// ── Spawn position on map edge ──
function edgeSpawnPos() {
  const edge = Math.floor(Math.random() * 4);
  let col, row, angle;
  const m = 3;
  if(edge===0)      { col=m; row=m+Math.floor(Math.random()*(CFG.ROWS-m*2)); angle=0; }
  else if(edge===1) { col=CFG.COLS-m; row=m+Math.floor(Math.random()*(CFG.ROWS-m*2)); angle=Math.PI; }
  else if(edge===2) { col=m+Math.floor(Math.random()*(CFG.COLS-m*2)); row=m; angle=Math.PI/2; }
  else              { col=m+Math.floor(Math.random()*(CFG.COLS-m*2)); row=CFG.ROWS-m; angle=-Math.PI/2; }
  return {col,row,angle};
}

// ── Spawn near a live teammate for co-op respawn ──
function coopSpawnPos() {
  const refs = [];
  if(G.player && !G.player.dead && G.player.segs.length) refs.push(G.player.segs[0]);
  for(const b of G.bots) if(b.isHuman && !b.dead && b.segs.length) refs.push(b.segs[0]);
  if(!refs.length) return edgeSpawnPos();
  const ref = refs[Math.floor(Math.random() * refs.length)];
  for(let i = 0; i < 20; i++) {
    const a = Math.random() * Math.PI * 2;
    const d = 5 + Math.random() * 4;
    const col = Math.round(ref.col + Math.cos(a) * d);
    const row = Math.round(ref.row + Math.sin(a) * d);
    if(col >= 2 && col < CFG.COLS-2 && row >= 2 && row < CFG.ROWS-2)
      return { col, row, angle: a + Math.PI };
  }
  return edgeSpawnPos();
}

// ── Respawn countdown ──
// onDone: optional callback — if provided, called instead of sending respawn_ready to host
function startRespawnCountdown(killerName, respawnVal, onDone) {
  const overlay = document.getElementById('respawn-overlay');
  const timerEl = document.getElementById('respawn-timer');
  const msgEl   = document.getElementById('respawn-msg');
  overlay.classList.remove('hidden');
  timerEl.style.opacity = '1';
  msgEl.textContent = killerName ? `eaten by ${killerName}` : 'you were destroyed';
  let t = 3;
  timerEl.textContent = t;
  if(MP.respawnTimer) clearInterval(MP.respawnTimer);
  MP.respawnTimer = setInterval(() => {
    t--;
    if(t <= 0) {
      clearInterval(MP.respawnTimer);
      timerEl.style.opacity = '0';
      overlay.classList.add('hidden');
      if(onDone) { onDone(); return; }
      // Tell host we're ready to respawn
      if(MP.conns[0]) try { MP.conns[0].send({ type:'respawn_ready' }); } catch(e){}
    } else {
      timerEl.textContent = t;
    }
  }, 1000);
}

// ── Compute respawn value for competitive mode: 2^(x-2) where x = log2(deathVal) ──
function competitiveRespawnVal(deathVal) {
  const x = Math.max(1, Math.round(Math.log2(Math.max(2, deathVal))));
  return Math.max(2, Math.pow(2, Math.max(0, x - 2)));
}

// ── Respawns a guest player ──
function respawnGuest(peerId) {
  const p = MP.players[peerId];
  if(!p) return;
  const isCoop = MP.mode === 'coop';
  const respawnVal = isCoop ? Math.max(2, p.lastDeathVal || 2) : competitiveRespawnVal(p.lastDeathVal || 2);
  const pos = isCoop ? coopSpawnPos() : edgeSpawnPos();
  const sn = newSnake(pos.col, pos.row, Math.cos(pos.angle), Math.sin(pos.angle),
    Math.max(2, Math.round(Math.log2(Math.max(2, respawnVal)))), respawnVal, false, p.pal);
  sn.isHuman = true;
  sn.peerId = peerId;
  sn.name = p.name;
  sn.invincUntil = performance.now() + 2000;
  G.bots.push(sn);
  p.snake = sn;
  broadcastToAll({ type:'state_delta', respawn: { peerId, col:pos.col, row:pos.row } });
}

// ── Host player dies in MP — respawn instead of game over ──
function mpHostDied(killer, headVal) {
  if(!G.running) return;
  const isCoop = MP.mode === 'coop';
  const killerName = killer ? (killer.name || (killer.isPlayer ? MP.localName : '?')) : null;
  const respawnVal = isCoop ? Math.max(2, headVal) : competitiveRespawnVal(headVal);
  G.player.dead = true;
  const msg = killerName ? `${killerName} ate ${MP.localName}!` : `${MP.localName} was destroyed!`;
  showKillFeed(msg, '#ff4444');
  broadcastToAll({ type:'killfeed', msg, color:'#ff4444' });
  startRespawnCountdown(killerName, respawnVal, () => {
    if(!G.running) return;
    const pos = isCoop ? coopSpawnPos() : edgeSpawnPos();
    const sn = newSnake(pos.col, pos.row, Math.cos(pos.angle), Math.sin(pos.angle),
      Math.max(2, Math.round(Math.log2(Math.max(2, respawnVal)))), respawnVal, true, MP.localPal || PLAYER_PAL);
    sn.isHuman = true;
    sn.name = MP.localName;
    sn.invincUntil = performance.now() + 2000;
    G.player = sn;
  });
}

// ── Kill feed ──
function showKillFeed(msg, color) {
  const kf = document.getElementById('killfeed');
  if(!kf) return;
  const el = document.createElement('div');
  el.className = 'kf-item';
  el.style.color = color || '#e8e8f0';
  el.textContent = msg;
  kf.appendChild(el);
  setTimeout(() => el.remove(), 3200);
}

// ── HUD player pills ──
function updateHUDPlayers() {
  const el = document.getElementById('hud-players');
  if(!el || MP.mode === 'solo') return;
  const pills = [];
  // Local player
  const lp = G.player;
  if(lp && !lp.dead) {
    const pal = MP.localPal || PLAYER_PAL;
    pills.push(`<div class="hud-pill">
      <div class="hp-dot" style="background:${pal.t}"></div>
      <span class="hp-name">${MP.localName}</span>
      <span class="hp-val">${fmtVal(lp.segs[0]?.val||0)}</span>
    </div>`);
  }
  // Remote players
  Object.values(MP.players).forEach(p => {
    const pal = p.pal || HUMAN_PALS[1];
    const val = p.snake && !p.snake.dead ? (p.snake.segs[0]?.val||0) : 0;
    pills.push(`<div class="hud-pill">
      <div class="hp-dot" style="background:${pal.t}"></div>
      <span class="hp-name">${p.name}</span>
      <span class="hp-val">${fmtVal(val)}</span>
    </div>`);
  });
  el.innerHTML = pills.join('');
}

// ── Lobby scan: find open PeerJS hosts ──
// We use PeerJS's list API to find peers with our prefix
// ── Lobby discovery ──
// Two-track: (1) PeerJS REST peer list filtered by prefix, (2) 2-letter manual code.
// Host shows their 2-letter code in the HUD badge — guests can always type it.

// ── Co-op: friendly fire prevention ──
// Called from stepSnake — if mode is coop, humans pass through each other
function isFriendlyFire(snA, snB) {
  if(MP.mode !== 'coop') return false;
  return (snA.isHuman || snA.isPlayer) && (snB.isHuman || snB.isPlayer);
}

// ── Co-op: bonus food scatter when humans down a large bot together ──
function mpCoopLargeBotKill(killer, victim) {
  const botHead = victim.segs[0]?.val ?? 2;
  if(botHead < CFG.MP_COOP_LARGE_BOT_VAL) return;
  const humans = [G.player, ...Object.values(MP.players).map(p=>p.snake)].filter(s=>s&&!s.dead&&s.segs.length);
  if(!humans.length) return;
  const bonusVal = Math.max(2, Math.floor(botHead / Math.max(1, humans.length)));
  for(const h of humans) {
    const hc = h.segs[0].col, hr = h.segs[0].row;
    for(let b=0; b<3; b++) {
      G.food.push({
        col: hc + (Math.random()-0.5)*10,
        row: hr + (Math.random()-0.5)*10,
        val: bonusVal
      });
    }
  }
  const killerName = killer.name || (killer.isPlayer ? MP.localName : '?');
  const msg = `💥 ${killerName} took down ${victim.name||'a giant'}! Bonus for all!`;
  showKillFeed(msg, '#ffcc00');
  broadcastToAll({ type:'killfeed', msg, color:'#ffcc00' });
}

// ── Hook into host game over / kill detection ──
function mpOnKill(killer, victim) {
  if(MP.mode === 'solo' || !MP.isHost) return;
  const killerName = killer.name || (killer.isPlayer ? MP.localName : '?');
  const victimName = victim.name || '?';
  const isLocalVictim = victim.isPlayer;
  const victimPeerId  = victim.peerId;

  const msg = `${killerName} ate ${victimName}`;
  const color = (victim.isPlayer || victim.isHuman) ? '#ff4444' : '#ffcc00';
  showKillFeed(msg, color);
  broadcastToAll({ type:'killfeed', msg, color });

  // Co-op: bonus food scatter when a human takes down a large bot
  if(MP.mode === 'coop' && (killer.isPlayer || killer.isHuman) &&
     !victim.isHuman && !victim.isPlayer) {
    mpCoopLargeBotKill(killer, victim);
  }

  if(victimPeerId && MP.players[victimPeerId] && (MP.mode === 'competitive' || MP.mode === 'coop')) {
    const p = MP.players[victimPeerId];
    p.lastDeathVal = victim.segs[0]?.val || 2;
    const respawnVal = MP.mode === 'coop' ? Math.max(2, p.lastDeathVal) : competitiveRespawnVal(p.lastDeathVal);
    broadcastToAll({ type:'you_died', peerId: victimPeerId, killerName, respawnVal });
  }
}

// ── Replace start screen with MP menu ──
// The old beginner/expert buttons now go through the MP overlay
document.getElementById('b-beginner').addEventListener('click', () => {
  // If MP overlay showing, ignore (handled there). Otherwise shortcut to solo.
}, true);

// ── Init on load ──
// Guard: on file:// protocol scripts load from disk instantly, so window.load
// may have already fired by the time this listener registers. Check readyState
// first and call directly if so.
function _startApp() {
  document.getElementById('s-start').classList.add('hidden');
  initMPOverlay();
}
if (document.readyState === 'complete') {
  _startApp();
} else {
  window.addEventListener('load', _startApp);
}
