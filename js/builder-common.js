// ════════════════════════════════════════════════════════════════════
//  BUILDER KIT — shared by map-builder-2.html and map-builder-3.html
//    BK.makeViewport()   pan / zoom / pinch / tap canvas (mouse + touch)
//    BK.pointInPoly(), BK.segDist(), BK.polyBBox()
//    BK.pack()           assemble the map JSON the game loads
//    BK.save(), BK.download(), BK.toast()
//  The map JSON is the same shape as the original builder's, plus a few
//  extras (see pack()), so Dad's mode loads it with the same code.
// ════════════════════════════════════════════════════════════════════
const BK = (function () {

  // ── Geometry ─────────────────────────────────────────────────────
  function pointInPoly(x, y, pts) {
    let inside = false;
    for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
      const xi = pts[i][0], yi = pts[i][1], xj = pts[j][0], yj = pts[j][1];
      if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) inside = !inside;
    }
    return inside;
  }
  function segDist(px, py, a, b) {
    const dx = b[0] - a[0], dy = b[1] - a[1], len2 = dx * dx + dy * dy;
    if (!len2) return Math.hypot(px - a[0], py - a[1]);
    const t = Math.max(0, Math.min(1, ((px - a[0]) * dx + (py - a[1]) * dy) / len2));
    return Math.hypot(px - (a[0] + t * dx), py - (a[1] + t * dy));
  }
  function polyBBox(pts) {
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const [x, y] of pts) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
    return { x0, y0, x1, y1 };
  }
  function centroid(pts) {
    let x = 0, y = 0;
    for (const p of pts) { x += p[0]; y += p[1]; }
    return [x / pts.length, y / pts.length];
  }

  // Merge the "on" cells of a grid into few rectangles: runs along each row,
  // then identical runs on consecutive rows are stacked.  on(c,r) → bool.
  // Returns [{c0,r0,c1,r1,k}] with c1/r1 exclusive; k = on()'s return value.
  function gridToRects(on, cols, rows) {
    const out = [], open = new Map();    // key "c0,c1,k" → rect still growing
    for (let r = 0; r <= rows; r++) {
      const seen = new Set();
      if (r < rows) {
        let c = 0;
        while (c < cols) {
          const k = on(c, r);
          if (!k) { c++; continue; }
          let c1 = c + 1;
          while (c1 < cols && on(c1, r) === k) c1++;
          const key = c + ',' + c1 + ',' + k;
          seen.add(key);
          const rc = open.get(key);
          if (rc) rc.r1 = r + 1;
          else open.set(key, { c0: c, r0: r, c1, r1: r + 1, k });
          c = c1;
        }
      }
      for (const [key, rc] of open) if (!seen.has(key)) { out.push(rc); open.delete(key); }
    }
    return out;
  }

  // ── Toast / download ─────────────────────────────────────────────
  let toastEl = null, toastT = 0;
  function toast(msg, ms) {
    if (!toastEl) {
      toastEl = document.createElement('div');
      toastEl.style.cssText = 'position:fixed;left:50%;bottom:64px;transform:translateX(-50%);background:#0d0d1a;' +
        'color:#00f5c4;border:1px solid #00f5c4;border-radius:6px;padding:8px 14px;font:0.7rem "Courier New",monospace;' +
        'z-index:9999;max-width:90vw;text-align:center;pointer-events:none;transition:opacity .2s;opacity:0';
      document.body.appendChild(toastEl);
    }
    toastEl.textContent = msg;
    toastEl.style.opacity = '1';
    clearTimeout(toastT);
    toastT = setTimeout(() => { toastEl.style.opacity = '0'; }, ms || 2600);
  }
  function download(filename, text, type) {
    const blob = new Blob([text], { type: type || 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
  }
  function slug(s) {
    return String(s || 'map').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'map';
  }

  // ── Map JSON ─────────────────────────────────────────────────────
  // canvas: the baked ground texture, exactly gridCols*carPixels wide.
  // Extras over the original format:
  //   format:2, kind:'world'|'maze', name, scale (overrides CFG_DAD.SCALE),
  //   exact (collision samples cell centres, so walls are as thick as drawn),
  //   cellMeters (world maps), objects[].color / .texture ('hatch')
  function pack(o) {
    const imageDataURL = o.canvas.toDataURL(o.mime || 'image/png', o.quality || 0.9);
    return Object.assign({
      format: 2,
      image: '',
      imageDataURL,
      carPixels: o.carPixels,
      imageWidth: o.canvas.width,
      imageHeight: o.canvas.height,
      exact: true,
    }, {
      id: o.id, name: o.name, kind: o.kind,
      gridCols: o.gridCols, gridRows: o.gridRows,
      scale: o.scale,
      objects: o.objects,
    }, o.extra || {});
  }
  async function save(map) {
    if (!window.MapStore || !MapStore.available) throw new Error('This browser blocks local storage for maps — use DOWNLOAD instead.');
    await MapStore.put(map);
  }

  // ── Viewport: pan / zoom / pinch / tap ───────────────────────────
  // h = { draw(ctx), claim(ix,iy,ev)→bool, onDrag(ix,iy), onDragEnd(), onTap(ix,iy,ev),
  //       onHover(ix,iy), onDouble() }
  // One finger on empty canvas pans; two fingers pan + pinch; wheel zooms.
  // claim() lets a tool take over a one-finger drag (move a tree, paint walls).
  function makeViewport(canvas, wrap, h) {
    const vp = { x: 0, y: 0, scale: 1, w: 0, h: 0, dpr: 1, spaceDown: false };
    const ctx = canvas.getContext('2d');
    const ptrs = new Map();
    let gesture = null;     // { mode:'pan'|'claim'|'pinch', moved, ... }

    vp.toImg = (sx, sy) => ({ x: (sx - vp.x) / vp.scale, y: (sy - vp.y) / vp.scale });
    vp.toScr = (ix, iy) => ({ x: ix * vp.scale + vp.x, y: iy * vp.scale + vp.y });
    vp.resize = () => {
      vp.dpr = Math.min(window.devicePixelRatio || 1, 2);
      vp.w = wrap.clientWidth; vp.h = wrap.clientHeight;
      canvas.width = Math.round(vp.w * vp.dpr);
      canvas.height = Math.round(vp.h * vp.dpr);
      canvas.style.width = vp.w + 'px';
      canvas.style.height = vp.h + 'px';
      vp.redraw();
    };
    vp.fit = (iw, ih, pad) => {
      const p = pad == null ? 0.9 : pad;
      vp.scale = Math.min(vp.w / iw, vp.h / ih) * p;
      vp.x = (vp.w - iw * vp.scale) / 2;
      vp.y = (vp.h - ih * vp.scale) / 2;
    };
    vp.redraw = () => {
      ctx.setTransform(vp.dpr, 0, 0, vp.dpr, 0, 0);
      ctx.clearRect(0, 0, vp.w, vp.h);
      h.draw(ctx);
    };
    function zoomAt(mx, my, f) {
      const ns = Math.max(0.03, Math.min(40, vp.scale * f));
      f = ns / vp.scale;
      vp.x = mx - (mx - vp.x) * f;
      vp.y = my - (my - vp.y) * f;
      vp.scale = ns;
    }
    function pos(e) {
      const r = canvas.getBoundingClientRect();
      return { x: e.clientX - r.left, y: e.clientY - r.top };
    }
    function pinchState() {
      const [a, b] = [...ptrs.values()];
      return { cx: (a.x + b.x) / 2, cy: (a.y + b.y) / 2, d: Math.hypot(a.x - b.x, a.y - b.y) || 1 };
    }

    canvas.addEventListener('pointerdown', e => {
      canvas.setPointerCapture(e.pointerId);
      const p = pos(e);
      ptrs.set(e.pointerId, p);
      if (ptrs.size === 2) {
        const s = pinchState();
        if (gesture && gesture.mode === 'claim' && h.onDragEnd) h.onDragEnd();
        gesture = { mode: 'pinch', moved: true, cx: s.cx, cy: s.cy, d: s.d };
        return;
      }
      if (ptrs.size > 2) return;
      const im = vp.toImg(p.x, p.y);
      const forcePan = e.button === 1 || e.button === 2 || vp.spaceDown;
      const claimed = !forcePan && h.claim && h.claim(im.x, im.y, e);
      gesture = { mode: claimed ? 'claim' : 'pan', moved: false, sx: p.x, sy: p.y, vx: vp.x, vy: vp.y };
    });
    canvas.addEventListener('pointermove', e => {
      const p = pos(e);
      const im = vp.toImg(p.x, p.y);
      if (h.onHover) h.onHover(im.x, im.y, p.x, p.y);
      if (!ptrs.has(e.pointerId)) return;
      ptrs.set(e.pointerId, p);
      if (!gesture) return;
      if (gesture.mode === 'pinch' && ptrs.size >= 2) {
        const s = pinchState();
        vp.x += s.cx - gesture.cx; vp.y += s.cy - gesture.cy;
        zoomAt(s.cx, s.cy, s.d / gesture.d);
        gesture.cx = s.cx; gesture.cy = s.cy; gesture.d = s.d;
        vp.redraw();
      } else if (gesture.mode === 'claim') {
        gesture.moved = true;
        if (h.onDrag) h.onDrag(im.x, im.y);
      } else if (gesture.mode === 'pan') {
        const dx = p.x - gesture.sx, dy = p.y - gesture.sy;
        if (!gesture.moved && Math.hypot(dx, dy) > 6) gesture.moved = true;
        if (gesture.moved) { vp.x = gesture.vx + dx; vp.y = gesture.vy + dy; vp.redraw(); }
      }
    });
    function up(e) {
      if (!ptrs.has(e.pointerId)) return;
      const p = pos(e);
      ptrs.delete(e.pointerId);
      const g = gesture;
      if (ptrs.size === 0) gesture = null;
      else if (ptrs.size === 1 && g && g.mode === 'pinch') {   // lift one finger: keep panning with the other
        const q = [...ptrs.values()][0];
        gesture = { mode: 'pan', moved: true, sx: q.x, sy: q.y, vx: vp.x, vy: vp.y };
        return;
      }
      if (!g || e.type === 'pointercancel') return;
      if (g.mode === 'claim') { if (h.onDragEnd) h.onDragEnd(); }
      else if (g.mode === 'pan' && !g.moved && e.button === 0) {
        const im = vp.toImg(p.x, p.y);
        if (h.onTap) h.onTap(im.x, im.y, e);
      }
    }
    canvas.addEventListener('pointerup', up);
    canvas.addEventListener('pointercancel', up);
    canvas.addEventListener('wheel', e => {
      e.preventDefault();
      const p = pos(e);
      zoomAt(p.x, p.y, e.deltaY < 0 ? 1.13 : 1 / 1.13);
      vp.redraw();
    }, { passive: false });
    canvas.addEventListener('dblclick', e => { if (h.onDouble) h.onDouble(); });
    canvas.addEventListener('contextmenu', e => { e.preventDefault(); if (h.onDouble) h.onDouble(); });
    window.addEventListener('keydown', e => {
      if (e.code === 'Space' && !/INPUT|SELECT|TEXTAREA/.test(e.target.tagName)) { vp.spaceDown = true; e.preventDefault(); }
    });
    window.addEventListener('keyup', e => { if (e.code === 'Space') vp.spaceDown = false; });
    window.addEventListener('resize', vp.resize);
    canvas.style.touchAction = 'none';
    return vp;
  }

  return { gridToRects, pointInPoly, segDist, polyBBox, centroid, toast, download, slug, pack, save, makeViewport };
})();
