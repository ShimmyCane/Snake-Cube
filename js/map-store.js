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
