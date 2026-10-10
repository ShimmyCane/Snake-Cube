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
  el.id = 'mp-overlay'; el.className = 'hidden';
  el.innerHTML = `
    <div id="mp-screen-main">
      <h2 style="margin-bottom:6px;text-align:center">FELIX'S<br>SNAKE CUBES</h2>
      <div id="mp-name-row" style="display:flex;align-items:center;gap:8px;margin-bottom:8px">
        <input id="mp-name-input" type="text" maxlength="12" placeholder="Your name" autocomplete="off" autocorrect="off" spellcheck="false">
      </div>
      <div style="width:100%;max-width:300px;display:flex;flex-direction:column;gap:5px;">
        <p class="menu-section-label">Solo Play</p>
        <div style="display:flex;gap:8px">
          <button class="mp-btn" id="mp-btn-easy" style="flex:1;padding:9px 4px;font-size:0.66rem;line-height:1.35">😌 GUEST<br><span style="font-size:0.56rem;opacity:0.55">Easy · 3 min</span></button>
          <button class="mp-btn" id="mp-btn-hard" style="flex:1;padding:9px 4px;font-size:0.66rem;line-height:1.35">😤 FELIX<br><span style="font-size:0.56rem;opacity:0.55">Hard · 5 min</span></button>
          <button class="mp-btn" id="mp-btn-insane" style="flex:1;padding:9px 4px;font-size:0.66rem;line-height:1.35;border-color:#ff4444;color:#ff4444">💀 INSANE<br><span style="font-size:0.56rem;opacity:0.55">∞ · no limit</span></button>
        </div>
        <p class="menu-section-label" style="color:#bf5fff;margin-top:4px">Athena's Challenge</p>
        <div style="display:flex;gap:15px">
          <button class="mp-btn" id="mp-btn-athena-easy" style="flex:1;padding:9px 4px;font-size:0.66rem;line-height:1.35;border-color:#bf5fff;color:#bf5fff">🦉 EASY<br><span style="font-size:0.56rem;opacity:0.55">Slower · shrinking world</span></button>
          <button class="mp-btn" id="mp-btn-athena-hard" style="flex:1;padding:9px 4px;font-size:0.66rem;line-height:1.35;border-color:#ff6b35;color:#ff6b35">🦉 HARD<br><span style="font-size:0.56rem;opacity:0.55">Dense · multiple levels</span></button>
        </div>
        <p class="menu-section-label" style="color:#22aaff;margin-top:4px">Dad's Mode</p>
        <div id="mp-dad-btns" style="display:flex;gap:8px;flex-wrap:wrap"></div>
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
      <div style="width:100%;max-width:300px;margin-top:6px">
        <p class="menu-section-label">Controls</p>
        <div style="display:flex;gap:8px">
          <button class="ctrl-pill" id="ctrl-felix-btn">🎮 FELIX<br><span style="font-size:0.5rem;opacity:0.6">hold &amp; steer</span></button>
          <button class="ctrl-pill" id="ctrl-joy-btn">🕹️ JOYSTICK<br><span style="font-size:0.5rem;opacity:0.6">pad + hook</span></button>
        </div>
      </div>
      <p id="mp-status" style="font-size:0.65rem;color:#555570;min-height:1.1em;margin-top:4px;text-align:center"></p>
    </div>
    <audio id="a1" preload="auto"></audio>
    <audio id="a2" preload="auto"></audio>
    <div class="audio-controls">
      <button id="startBtn">Start 30-Minute Audio Loop</button>
      <h2 id="timerDisplay">30:00</h2>
      <p id="trackInfo">Stopped</p>
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

// ── Screen helpers ──
function showMPScreen(name) {
  document.getElementById('mp-overlay').classList.remove('hidden');
  const main    = document.getElementById('mp-screen-main');
  const conn    = document.getElementById('mp-screen-connecting');
  const waiting = document.getElementById('mp-screen-waiting');
  if(main)    main.classList.toggle('hidden', name !== 'main');
  if(conn)    conn.classList.toggle('hidden', name !== 'connecting');
  if(waiting) waiting.classList.toggle('hidden', name !== 'waiting');
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
  easy:   { ROUND_SEC:180, NUM_BOTS: Math.round(16 * WORLD_DENSITY), BOT_MAX: Math.round(26 * WORLD_DENSITY),  DIFFICULTY:0.9,  BOT_CHASE_RANGE:72  }, // 3 min
  hard:   { ROUND_SEC:300, NUM_BOTS: Math.round(32 * WORLD_DENSITY), BOT_MAX: Math.round(60 * WORLD_DENSITY),  DIFFICULTY:1.8,  BOT_CHASE_RANGE:104 }, // 5 min
  insane: { ROUND_SEC:0,   NUM_BOTS: Math.round(44 * WORLD_DENSITY), BOT_MAX: Math.round(88 * WORLD_DENSITY),  DIFFICULTY:3.0,  BOT_CHASE_RANGE:144 }, // unlimited
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

  // Dad's Mode — populate one button per loaded map bundle
  const mpDadContainer = document.getElementById('mp-dad-btns');
  if (mpDadContainer) {
    const dadMaps = Object.keys(window._DAD_MAPS_DATA || {});
    if (dadMaps.length === 0) {
      mpDadContainer.innerHTML = '<span style="font-size:0.65rem;opacity:0.4;padding:6px">No maps loaded</span>';
    }
    dadMaps.forEach(function(path) {
      const data  = window._DAD_MAPS_DATA[path];
      const raw   = (data && data.id) || path.replace(/^assets\//, '').replace(/\.json$/i, '');
      const label = (raw.charAt(0).toUpperCase() + raw.slice(1)).toUpperCase();
      const btn   = document.createElement('button');
      btn.className   = 'mp-btn';
      btn.style.cssText = 'flex:1;padding:9px 4px;font-size:0.66rem;line-height:1.35;border-color:#22aaff;color:#22aaff';
      btn.innerHTML = '🏘️ ' + label + '<br><span style="font-size:0.56rem;opacity:0.55">satellite world</span>';
      btn.addEventListener('click', async function() {
        if (typeof loadDadMap === 'undefined') {
          alert('Dad\'s Mode not loaded.\nCheck the ℹ panel — js/dad.js may have failed.');
          return;
        }
        btn.disabled    = true;
        btn.textContent = 'Loading…';
        try {
          await loadDadMap(path);
          hideMPOverlay();
          document.getElementById('s-start').classList.add('hidden');
          startDad();
        } catch (err) {
          console.error('DAD:', err);
          btn.disabled  = false;
          btn.innerHTML = '🏘️ ' + label + '<br><span style="font-size:0.56rem;opacity:0.55">satellite world</span>';
          alert('Dad\'s Mode failed:\n' + err.message + '\n\nIf using file://, open via a local server instead (npx serve .)');
        }
      });
      mpDadContainer.appendChild(btn);
    });
  }

  document.getElementById('mp-btn-athena-easy').addEventListener('click', () => {
    ATHENA.diffMode = 'easy'; startAthena();
  });
  document.getElementById('mp-btn-athena-hard').addEventListener('click', () => {
    ATHENA.diffMode = 'hard'; startAthena();
  });
  document.getElementById('mp-btn-easy').addEventListener('click', () => {
    applyDifficulty('easy'); updateGameTitle('GUEST MODE'); startSolo();
  });
  document.getElementById('mp-btn-hard').addEventListener('click', () => {
    applyDifficulty('hard'); updateGameTitle('FELIX MODE'); startSolo();
  });
  document.getElementById('mp-btn-insane').addEventListener('click', () => {
    applyDifficulty('insane'); updateGameTitle('INSANE MODE'); startSolo();
  });

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
