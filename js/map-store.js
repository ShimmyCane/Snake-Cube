// ════════════════════════════════════════════════════════════════════
//  MAP STORE — maps saved in this browser (IndexedDB)
//  Shared by map-builder-2.html, map-builder-3.html and the game's
//  Dad's-mode menu, so a map saved in a builder shows up in the game on
//  the same device with no file juggling (handy on an iPad).
//
//    MapStore.put(map)   → Promise<id>   (map needs .id; stamps .saved)
//    MapStore.get(id)    → Promise<map|null>
//    MapStore.list()     → Promise<[{id,name,kind,saved,gridCols,gridRows}]>
//    MapStore.del(id)    → Promise
//    MapStore.available  → false when IndexedDB is blocked (private mode)
//
//  MapCloud — favourite maps in the family database (Supabase table snake_maps).
//    MapCloud.list()     → Promise<[{id,name,kind,created_at}]>
//    MapCloud.get(id)    → Promise<map|null>
//    MapCloud.save(map)  → Promise   (upsert by map.id)
//    MapCloud.del(id)    → Promise
//  Anyone with the page can use it (the family's choice; RLS is open on this table only).
// ════════════════════════════════════════════════════════════════════
(function () {
  const DB = 'felix-snake-maps', STORE = 'maps';
  let dbp = null;

  function open() {
    if (dbp) return dbp;
    dbp = new Promise((resolve, reject) => {
      if (!window.indexedDB) { reject(new Error('IndexedDB is not available')); return; }
      const req = indexedDB.open(DB, 1);
      req.onupgradeneeded = () => req.result.createObjectStore(STORE, { keyPath: 'id' });
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error || new Error('IndexedDB open failed'));
    });
    return dbp;
  }

  function run(mode, fn) {
    return open().then(db => new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, mode);
      const out = fn(tx.objectStore(STORE));
      tx.oncomplete = () => resolve(out.result);
      tx.onerror = tx.onabort = () => reject(tx.error || new Error('IndexedDB transaction failed'));
    }));
  }

  const MapStore = {
    available: !!window.indexedDB,
    put(map) {
      if (!map || !map.id) return Promise.reject(new Error('map needs an id'));
      map.saved = Date.now();
      return run('readwrite', s => s.put(map)).then(() => map.id);
    },
    get(id) {
      return run('readonly', s => s.get(id)).then(r => r || null);
    },
    list() {
      return run('readonly', s => s.getAll()).then(all => all
        .map(m => ({ id: m.id, name: m.name || m.id, kind: m.kind || 'classic',
                     saved: m.saved || 0, gridCols: m.gridCols, gridRows: m.gridRows }))
        .sort((a, b) => b.saved - a.saved));
    },
    del(id) {
      return run('readwrite', s => s.delete(id));
    },
  };
  window.MapStore = MapStore;
})();

// ── Family database: favourite maps ─────────────────────────────────
(function () {
  const BASE = 'https://twvqvutrcobedvuhnzxq.supabase.co/rest/v1/snake_maps';
  const KEY  = 'sb_publishable_eqUo8HEdEB1hMQM4CpSVqA_9i6b0qCo';   // publishable key: safe in a browser
  const HEAD = { apikey: KEY, Authorization: 'Bearer ' + KEY, 'Content-Type': 'application/json' };

  async function req(query, opts) {
    const r = await fetch(BASE + query, Object.assign({ headers: HEAD }, opts || {}));
    const text = await r.text();
    if (!r.ok) throw new Error('Family database: HTTP ' + r.status + (text ? ' — ' + text.slice(0, 160) : ''));
    return text ? JSON.parse(text) : null;
  }
  const enc = s => encodeURIComponent(s);

  window.MapCloud = {
    list() {
      return req('?select=id,name,kind,created_at&order=created_at.desc');
    },
    get(id) {
      return req('?select=data&id=eq.' + enc(id)).then(rows => (rows && rows[0] ? rows[0].data : null));
    },
    save(map) {
      const body = JSON.stringify({ id: map.id, name: map.name || map.id, kind: map.kind || 'world', data: map, updated_at: new Date().toISOString() });
      return req('?on_conflict=id', { method: 'POST', body,
                                      headers: Object.assign({}, HEAD, { Prefer: 'resolution=merge-duplicates,return=minimal' }) });
    },
    del(id) {
      return req('?id=eq.' + enc(id), { method: 'DELETE', headers: Object.assign({}, HEAD, { Prefer: 'return=minimal' }) });
    },
  };
})();
