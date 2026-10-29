// ════════════════════════════════════════════════════════════════════
//  FAMILY HIGH SCORES — shared board in the family database
//  Table: snake_highscores (see app_table_registry). Anon read + insert only.
//  Local cache: localStorage 'sn2048' (saveHS in game-core.js) stays as the
//  fallback board when the family database can't be reached. Scores that
//  fail to upload wait in 'sn2048_pending' and go up on the next game.
//
//    FamilyScores.submit(entry)  → Promise
//    FamilyScores.top(n)         → Promise<[{player,score,mode,map,created_at}]>
//    submitGameScore(headVal)    → called from endGame()
//    showBoard(elId)             → fills a board with family rows, else the local cache
// ════════════════════════════════════════════════════════════════════
const FamilyScores = (function () {
  const BASE = 'https://twvqvutrcobedvuhnzxq.supabase.co/rest/v1/snake_highscores';
  const KEY  = 'sb_publishable_eqUo8HEdEB1hMQM4CpSVqA_9i6b0qCo';   // publishable key: safe in a browser
  const HEAD = { apikey: KEY, Authorization: 'Bearer ' + KEY, 'Content-Type': 'application/json' };

  async function req(query, opts) {
    const r = await fetch(BASE + query, Object.assign({ headers: HEAD }, opts || {}));
    const text = await r.text();
    if (!r.ok) throw new Error('Family database: HTTP ' + r.status + (text ? ' — ' + text.slice(0, 160) : ''));
    return text ? JSON.parse(text) : null;
  }

  return {
    submit(entry) {
      return req('', { method: 'POST', body: JSON.stringify(entry),
                       headers: Object.assign({}, HEAD, { Prefer: 'return=minimal' }) });
    },
    top(n) {
      return req('?select=player,score,mode,map,created_at&order=score.desc,created_at.asc&limit=' + (n || 8));
    },
  };
})();

// ── Pending uploads (kept on this device until they reach the family board) ──
function loadPending() { try { return JSON.parse(localStorage.getItem('sn2048_pending') || '[]'); } catch { return []; } }
function savePending(list) {
  try { localStorage.setItem('sn2048_pending', JSON.stringify(list.slice(-50))); } catch (e) { /* storage full or blocked */ }
}
async function flushPending() {
  const queue = loadPending();
  const left = [];
  for (const e of queue) {
    try { await FamilyScores.submit(e); }
    catch (err) { left.push(e); }
  }
  savePending(left);
  return left.length;
}

// Which game is being played, read before endGame() shuts Athena down
function currentGameMode() {
  if (typeof DAD !== 'undefined' && DAD.active) return { mode: 'dad', map: (DAD.map && DAD.map.id) || null };
  if (typeof ATHENA !== 'undefined' && ATHENA.active) return { mode: 'athena', map: null };
  return { mode: 'felix', map: null };
}

// Called from endGame(). Multiplayer rounds stay off the family board.
async function submitGameScore(headVal, info) {
  if (typeof MP !== 'undefined' && MP.enabled) return 'skipped';
  const entry = {
    player: ((typeof loadPlayerName === 'function' ? loadPlayerName() : '') || 'Player').slice(0, 40),
    score: headVal,
    mode: info.mode,
    map: info.map,
  };
  savePending(loadPending().concat([entry]));
  const left = await flushPending();
  return left ? 'pending' : 'saved';
}

// Fill a board with the family's top scores, or the local cache when offline
async function showBoard(elId) {
  const el = document.getElementById(elId);
  if (!el) return;
  let rows;
  try {
    rows = await FamilyScores.top(8);
  } catch (err) {
    console.warn('Family high scores unavailable:', err.message);
    rows = loadHS().map(h => ({ player: '—', score: h.score, created_at: null, date: h.date, local: true }));
  }
  if (!rows.length) { el.innerHTML = ''; return; }
  el.innerHTML = '<table style="margin-top:8px"><thead><tr><th>#</th><th>Name</th><th>Score</th><th>Date</th></tr></thead><tbody>' +
    rows.slice(0, 8).map((h, i) => {
      const when = h.created_at
        ? new Date(h.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })
        : h.date;
      const name = String(h.player).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
      return `<tr><td>${i + 1}</td><td>${name}</td><td style="color:${i === 0 ? '#ffcc00' : '#e8e8f0'}">${fmtVal(h.score)}</td><td style="color:#555570">${when}</td></tr>`;
    }).join('') + '</tbody></table>';
}
