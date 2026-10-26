// ════════════════════════════════════════
//  MUSIC PLAYER  —  js/music.js
//  Track list and volume come from CFG_AUDIO in config.js.
//  Attempts autoplay on load; falls back to first user interaction.
//  MUS.toggle() — flip muted state + persist to localStorage
//  MUS.setMuted(bool) — set it explicitly
// ════════════════════════════════════════

const MUS = (() => {
  // Build full paths from config; shuffle if AUTO_SHUFFLE is set
  function _buildTracks() {
    const folder = (CFG_AUDIO.FOLDER  || 'music/');
    let list     = (CFG_AUDIO.PLAYLIST || []).map(f => folder + f);
    if (CFG_AUDIO.AUTO_SHUFFLE && list.length > 1) {
      for (let i = list.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [list[i], list[j]] = [list[j], list[i]];
      }
    }
    return list;
  }

  const _tracks = _buildTracks();
  const _el     = new Audio();
  _el.volume    = CFG_AUDIO.VOLUME != null ? CFG_AUDIO.VOLUME : 0.55;
  _el.muted     = localStorage.getItem('felixSnakeMute') === '1';

  let _idx     = 0;
  let _started = false;

  function _load(i) {
    _idx    = ((i % _tracks.length) + _tracks.length) % _tracks.length;
    _el.src = _tracks[_idx];
    _el.load();
  }

  function _advance() { _load(_idx + 1); _el.play().catch(() => {}); }

  _el.addEventListener('ended', _advance);
  _el.addEventListener('error', _advance);   // skip missing / unplayable tracks

  function _tryStart() {
    if (_started) return;
    const p = _el.play();
    if (p) p.then(() => { _started = true; _removeLis(); }).catch(() => {});
  }

  function _onInteraction() { _tryStart(); }

  function _addLis() {
    document.addEventListener('click',      _onInteraction);
    document.addEventListener('keydown',    _onInteraction);
    document.addEventListener('touchstart', _onInteraction, { passive: true });
  }
  function _removeLis() {
    document.removeEventListener('click',      _onInteraction);
    document.removeEventListener('keydown',    _onInteraction);
    document.removeEventListener('touchstart', _onInteraction);
  }

  function _updateBtn() {
    const btn = document.getElementById('music-btn');
    if (btn) btn.textContent = _el.muted ? '🔇' : '🔊';
  }

  function init() {
    _load(0);
    _tryStart();
    _addLis();
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', _updateBtn);
    } else {
      _updateBtn();
    }
  }

  function toggle() {
    _el.muted = !_el.muted;
    localStorage.setItem('felixSnakeMute', _el.muted ? '1' : '0');
    _updateBtn();
    if (!_el.muted && !_started) {
      _el.play().then(() => { _started = true; _removeLis(); }).catch(() => {});
    }
  }

  function skip() {
    _advance();
  }

  // Set the mute state explicitly (used by the menu and settings checkboxes).
  function setMuted(on) {
    if (_el.muted !== on) toggle();
  }

  return { init, toggle, skip, setMuted, get muted() { return _el.muted; } };
})();

window.addEventListener('load', () => MUS.init());
