// ════════════════════════════════════════════════════════════════════
//  DAD'S MODE — satellite image ground (WebGL) + map system
//  v3.2.0  •  Loads after main.js  •  No external dependencies
//
//  Public API:
//    loadDadMap(jsonPath) → Promise  — fetch JSON + image, resize world
//    startDad()                       — activate mode, init WebGL, start game
//    DAD.drawBg()                     — called from main.js draw() each frame
//    DAD._isWall(col, row) → bool     — building/boundary collision query
// ════════════════════════════════════════════════════════════════════

// ── Tree appearance config ────────────────────────────────────────────
const CFG_DAD_TREES = {
  TRUNK_H: 1.4,   // trunk height in world units
  TRUNK_W: 0.22,  // trunk diameter in world units (billboard width)
  CANOPY_R: 1.1,  // canopy sphere radius in world units
};

// ── Hard-mode bot config (mirrors CFG_EXPERT) ─────────────────────────
const CFG_DAD_HARD = {
  NUM_BOTS:    Math.round(24 * (typeof WORLD_DENSITY !== 'undefined' ? WORLD_DENSITY : 1.5)),
  BOT_MAX:     Math.round(40 * (typeof WORLD_DENSITY !== 'undefined' ? WORLD_DENSITY : 1.5)),
  BOT_MIN:     Math.round(16 * (typeof WORLD_DENSITY !== 'undefined' ? WORLD_DENSITY : 1.5)),
  BOT_SPAWN_MS:Math.round(15000 / (typeof WORLD_DENSITY !== 'undefined' ? WORLD_DENSITY : 1.5)),
  DIFF_MIN:    2.0,
  DIFF_MAX:    8.0,
};

const DAD = {
  active:     false,
  map:        null,    // loaded JSON: { id, image, carPixels, gridCols, gridRows, objects[] }
  maps:       [],      // populated from CFG_DAD.MAPS in startDad()
  currentMap: 0,
  mapScale:   1.0,     // global map scale — increase to zoom in (snake smaller vs map), decrease to zoom out
  _img:       null,    // HTMLImageElement for the satellite texture

  // ── WebGL state ──────────────────────────────────────────────────
  _bgCanvas:  null,
  _gl:        null,
  _prog:      null,
  _tex:       null,
  _posBuf:    null,
  _uvBuf:     null,
  _idxBuf:    null,
  _triCount:  0,
  _aPos:      -1,
  _aUV:       -1,
  _u:         {},    // uniform locations

  // ── Collision grid (rasterised building polygons) ─────────────────
  _collGrid:  null,   // Uint8Array, col-major: [row * cols + col]
  _collCols:  0,
  _collRows:  0,

  // ── Pre-computed building world-coords for 3D rendering ───────────
  _buildings: [],     // [{ height, worldPts: [[col,row], …] }, …]

  // ── Pre-computed tree world-coords ────────────────────────────────
  _trees: [],         // [{ wc, wr }, …]  (world col / row)

  // ── Pre-computed road segments for speed-boost check ──────────────
  _roads: [],         // [{ halfW, segs:[{ax,az,bx,bz},…] }, …]
};

// ══════════════════════════════════════════════════════════════════════
//  GLSL SHADERS
//  Replicates render.js project3() exactly, so the texture aligns
//  with the 2-D canvas snake/food drawn on top.
// ══════════════════════════════════════════════════════════════════════

const _DAD_VERT = `
attribute vec2 aPos;   /* world (col, row)  — flat ground, y=0 */
attribute vec2 aUV;    /* texture coords 0..1 */

uniform float uCamX, uCamY, uCamZ;
uniform float uCosY, uSinY, uCosP, uSinP;
uniform float uCamF, uW, uH;

varying vec2  vUV;
varying float vCamZ;

void main() {
  /* Translate */
  float dx = aPos.x - uCamX;
  float dy = 0.0    - uCamY;   /* ground is y=0 */
  float dz = aPos.y - uCamZ;

  /* Yaw rotation (around Y) */
  float rx = dx * uCosY - dz * uSinY;
  float ry = dy;
  float rz = dx * uSinY + dz * uCosY;

  /* Pitch rotation (around X) */
  float cx = rx;
  float cy =  ry * uCosP + rz * uSinP;
  float cz = -ry * uSinP + rz * uCosP;

  vUV   = aUV;
  vCamZ = cz;

  if (cz < 0.1) {
    /* Behind camera — discard by pushing far into clip space */
    gl_Position = vec4(0.0, 0.0, 2.0, 1.0);
    return;
  }

  /* Project to screen coords then NDC.
     Setting w=cz enables WebGL's built-in perspective-correct
     varying interpolation so the texture maps correctly. */
  float sx = uW * 0.5 + cx * uCamF / cz;
  float sy = uH * 0.5 - cy * uCamF / cz;
  float nx =  sx / uW * 2.0 - 1.0;
  float ny = 1.0 - sy / uH * 2.0;

  gl_Position = vec4(nx * cz, ny * cz, 0.0, cz);
}
`;

const _DAD_FRAG = `
precision mediump float;
uniform sampler2D uTex;
varying vec2  vUV;
varying float vCamZ;

void main() {
  vec4 c = texture2D(uTex, vUV);
  /* Subtle distance fog — blend toward near-black at far tiles */
  float fog = clamp((vCamZ - 16.0) / 20.0, 0.0, 0.55);
  c.rgb = mix(c.rgb, vec3(0.03, 0.04, 0.06), fog);
  gl_FragColor = c;
}
`;

// ══════════════════════════════════════════════════════════════════════
//  WebGL helpers
// ══════════════════════════════════════════════════════════════════════

function _dadMakeShader(gl, type, src) {
  const s = gl.createShader(type);
  gl.shaderSource(s, src);
  gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS))
    throw new Error('DAD shader compile: ' + gl.getShaderInfoLog(s));
  return s;
}

function _dadMakeProgram(gl) {
  const p = gl.createProgram();
  gl.attachShader(p, _dadMakeShader(gl, gl.VERTEX_SHADER,   _DAD_VERT));
  gl.attachShader(p, _dadMakeShader(gl, gl.FRAGMENT_SHADER, _DAD_FRAG));
  gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS))
    throw new Error('DAD program link: ' + gl.getProgramInfoLog(p));
  return p;
}

// Build a subdivided grid mesh over the map footprint.
// subDiv = quads per world cell. Higher = better perspective accuracy at steep angles.
// Uses Uint32 indices automatically when vertex count exceeds Uint16 limit (65535).
function _dadBuildMesh(gridCols, gridRows, subDiv) {
  const vc = gridCols * subDiv;   // quad columns
  const vr = gridRows * subDiv;   // quad rows
  const vtx = (vc + 1) * (vr + 1);

  // Vertex and UV buffers
  const pos = new Float32Array(vtx * 2);
  const uv  = new Float32Array(vtx * 2);

  let pi = 0, ui = 0;
  for (let r = 0; r <= vr; r++) {
    for (let c = 0; c <= vc; c++) {
      pos[pi++] = c / subDiv;   // world col (0..gridCols)
      pos[pi++] = r / subDiv;   // world row (0..gridRows)
      // u 0..1 follows world col, so image x lines up with building x.
      // The old flip (1 - c/vc) mirrored the satellite against the buildings.
      uv[ui++]  = CFG_DAD.MIRROR_MAP ? 1.0 - c / vc : c / vc;
      uv[ui++]  = r / vr;       // v 0..1 (image top = v=0)
    }
  }

  // Index buffer — two triangles per quad.
  // Use Uint32 when vertex count exceeds Uint16 limit (65535).
  const triCount  = vc * vr * 2;
  const use32     = vtx > 65535;
  const idx       = use32 ? new Uint32Array(triCount * 3) : new Uint16Array(triCount * 3);
  const idxGLType = use32 ? 'UNSIGNED_INT' : 'UNSIGNED_SHORT';  // resolved to gl constant later
  let ii = 0;
  for (let r = 0; r < vr; r++) {
    for (let c = 0; c < vc; c++) {
      const tl = r * (vc + 1) + c;
      const tr = tl + 1;
      const bl = tl + (vc + 1);
      const br = bl + 1;
      idx[ii++] = tl; idx[ii++] = bl; idx[ii++] = tr;
      idx[ii++] = tr; idx[ii++] = bl; idx[ii++] = br;
    }
  }

  return { pos, uv, idx, triCount, idxGLType };
}

function _dadInitGL() {
  const bg = document.getElementById('dad-bg');
  DAD._bgCanvas = bg;
  bg.width  = W;
  bg.height = H;
  // Keep hidden — satellite is composited onto the 2D canvas each frame via drawImage

  const gl = bg.getContext('webgl', {
    alpha:              false,
    antialias:          false,
    depth:              false,
    premultipliedAlpha: false,
    preserveDrawingBuffer: true,  // must be true so drawImage can read pixels after rendering
  });
  if (!gl) {
    console.error('DAD: WebGL not supported — dad\'s mode requires WebGL');
    return false;
  }
  DAD._gl = gl;

  try {
    DAD._prog = _dadMakeProgram(gl);
  } catch (e) {
    console.error(e.message);
    return false;
  }
  gl.useProgram(DAD._prog);

  // Attribute locations
  DAD._aPos = gl.getAttribLocation(DAD._prog, 'aPos');
  DAD._aUV  = gl.getAttribLocation(DAD._prog, 'aUV');

  // Uniform locations
  const names = ['uCamX','uCamY','uCamZ','uCosY','uSinY','uCosP','uSinP','uCamF','uW','uH','uTex'];
  for (const n of names) DAD._u[n] = gl.getUniformLocation(DAD._prog, n);
  gl.uniform1i(DAD._u.uTex, 0);

  // Enable 32-bit index support for large meshes (mapScale > 1 can exceed Uint16 limit)
  gl.getExtension('OES_element_index_uint');

  window.addEventListener('resize', _dadResize);
  return true;
}

function _dadResize() {
  if (!DAD._bgCanvas || !DAD._gl) return;
  DAD._bgCanvas.width  = W;
  DAD._bgCanvas.height = H;
  DAD._gl.viewport(0, 0, W, H);
}

function _dadBuildGeom() {
  const gl = DAD._gl;
  if (!gl || !DAD.map) return;

  const subDiv = 4;
  const sc = DAD.mapScale || 1.0;
  const mesh = _dadBuildMesh(
    Math.max(4, Math.round(DAD.map.gridCols * sc)),
    Math.max(4, Math.round(DAD.map.gridRows * sc)),
    subDiv
  );
  DAD._triCount = mesh.triCount;

  // Free the previous buffers — this also runs when the mirror test toggle changes
  for (const b of [DAD._posBuf, DAD._uvBuf, DAD._idxBuf]) if (b) gl.deleteBuffer(b);

  DAD._posBuf  = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, DAD._posBuf);
  gl.bufferData(gl.ARRAY_BUFFER, mesh.pos, gl.STATIC_DRAW);

  DAD._uvBuf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, DAD._uvBuf);
  gl.bufferData(gl.ARRAY_BUFFER, mesh.uv, gl.STATIC_DRAW);

  DAD._idxBuf  = gl.createBuffer();
  DAD._idxType = gl[mesh.idxGLType];   // gl.UNSIGNED_SHORT or gl.UNSIGNED_INT
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, DAD._idxBuf);
  gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, mesh.idx, gl.STATIC_DRAW);
}

function _dadUploadTex(img) {
  const gl = DAD._gl;
  if (!gl) return;

  DAD._tex = gl.createTexture();
  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, DAD._tex);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
  // Use LINEAR (no mipmaps) — safe for non-POT images in WebGL1
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
}

function _dadRender() {
  const gl = DAD._gl;
  if (!gl || !DAD._tex || !DAD._posBuf) return;

  gl.viewport(0, 0, DAD._bgCanvas.width, DAD._bgCanvas.height);
  gl.clearColor(0.03, 0.04, 0.06, 1.0);
  gl.clear(gl.COLOR_BUFFER_BIT);

  gl.useProgram(DAD._prog);
  const u = DAD._u;

  // Camera uniforms — these globals come from render.js (shared scope)
  gl.uniform1f(u.uCamX, CAM.x);
  gl.uniform1f(u.uCamY, CAM.y);
  gl.uniform1f(u.uCamZ, CAM.z);
  // Cached trig from _updateCamTrig() in render.js
  gl.uniform1f(u.uCosY, _cosY);
  gl.uniform1f(u.uSinY, _sinY);
  gl.uniform1f(u.uCosP, _cosP);
  gl.uniform1f(u.uSinP, _sinP);
  gl.uniform1f(u.uCamF, _camF);
  gl.uniform1f(u.uW, W);
  gl.uniform1f(u.uH, H);

  // Bind satellite texture
  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, DAD._tex);

  // Position attribute
  gl.bindBuffer(gl.ARRAY_BUFFER, DAD._posBuf);
  gl.enableVertexAttribArray(DAD._aPos);
  gl.vertexAttribPointer(DAD._aPos, 2, gl.FLOAT, false, 0, 0);

  // UV attribute
  gl.bindBuffer(gl.ARRAY_BUFFER, DAD._uvBuf);
  gl.enableVertexAttribArray(DAD._aUV);
  gl.vertexAttribPointer(DAD._aUV, 2, gl.FLOAT, false, 0, 0);

  // Draw indexed — type is UNSIGNED_SHORT or UNSIGNED_INT depending on mesh size
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, DAD._idxBuf);
  gl.drawElements(gl.TRIANGLES, DAD._triCount * 3, DAD._idxType, 0);
}

// ══════════════════════════════════════════════════════════════════════
//  Collision grid — rasterise building polygons
// ══════════════════════════════════════════════════════════════════════

function _dadBuildCollGrid() {
  const m = DAD.map;
  if (!m) return;
  // Use the scaled grid dims (CFG.COLS/ROWS already reflect mapScale)
  const cols = CFG.COLS, rows = CFG.ROWS;
  DAD._collCols = cols;
  DAD._collRows = rows;
  DAD._collGrid = new Uint8Array(cols * rows);

  // Divide carPixels by mapScale: at 2× scale each cell covers half as many image pixels
  const scaledCarPx = m.carPixels / (DAD.mapScale || 1.0);
  for (const obj of (m.objects || [])) {
    if (obj.type !== 'building' || !obj.pts || obj.pts.length < 3) continue;
    _dadRasterizePoly(obj.pts, scaledCarPx, cols, rows);
  }
}

// Scanline-fill a polygon onto the collision grid
function _dadRasterizePoly(pts, carPx, cols, rows) {
  // Convert image-pixel coords to grid-cell coords
  const gp = pts.map(([x, y]) => ({ x: x / carPx, y: y / carPx }));
  const n  = gp.length;

  let minR = Infinity, maxR = -Infinity;
  for (const p of gp) { minR = Math.min(minR, p.y); maxR = Math.max(maxR, p.y); }

  for (let row = Math.floor(minR); row <= Math.ceil(maxR); row++) {
    if (row < 0 || row >= rows) continue;
    const xs = [];
    for (let i = 0; i < n; i++) {
      const a = gp[i], b = gp[(i + 1) % n];
      if ((a.y <= row && b.y > row) || (b.y <= row && a.y > row)) {
        xs.push(a.x + (row - a.y) / (b.y - a.y) * (b.x - a.x));
      }
    }
    xs.sort((a, b) => a - b);
    for (let k = 0; k + 1 < xs.length; k += 2) {
      for (let col = Math.floor(xs[k]); col <= Math.ceil(xs[k + 1]); col++) {
        if (col >= 0 && col < cols)
          DAD._collGrid[row * cols + col] = 1;
      }
    }
  }
}

function _dadPrepBuildings() {
  DAD._buildings = [];
  DAD._trees = [];
  const m = DAD.map;
  if (!m || !m.objects) return;
  const scaledCarPx = m.carPixels / (DAD.mapScale || 1.0);
  for (const obj of m.objects) {
    if (obj.type === 'building' && obj.pts && obj.pts.length >= 3) {
      DAD._buildings.push({
        height:   obj.height != null ? obj.height : 2,
        worldPts: obj.pts.map(([px, py]) => [px / scaledCarPx, py / scaledCarPx]),
      });
    } else if (obj.type === 'tree') {
      DAD._trees.push({ wc: obj.x / scaledCarPx, wr: obj.y / scaledCarPx });
    }
  }
}

function _dadPrepRoads() {
  DAD._roads = [];
  const m = DAD.map;
  if (!m || !m.objects) return;
  const scaledCarPx = m.carPixels / (DAD.mapScale || 1.0);
  for (const obj of m.objects) {
    if (obj.type !== 'road' || !obj.pts || obj.pts.length < 2) continue;
    // Half-width in world units; fall back to 35% of a cell if not specified
    const halfW = ((obj.width != null ? obj.width : m.carPixels * 0.7) / scaledCarPx) * 0.5;
    const segs = [];
    for (let i = 0; i < obj.pts.length - 1; i++) {
      segs.push({
        ax: obj.pts[i][0]     / scaledCarPx, az: obj.pts[i][1]     / scaledCarPx,
        bx: obj.pts[i + 1][0] / scaledCarPx, bz: obj.pts[i + 1][1] / scaledCarPx,
      });
    }
    DAD._roads.push({ halfW, segs });
  }
}

// Squared distance from point (px,pz) to segment (ax,az)→(bx,bz)
function _ptSegDist2(px, pz, ax, az, bx, bz) {
  const dx = bx - ax, dz = bz - az;
  const len2 = dx * dx + dz * dz;
  if (len2 < 1e-10) return (px - ax) ** 2 + (pz - az) ** 2;
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (pz - az) * dz) / len2));
  return (px - (ax + t * dx)) ** 2 + (pz - (az + t * dz)) ** 2;
}

DAD._isOnRoad = function(col, row) {
  if (!DAD._roads.length) return false;
  const offset = CFG_DAD.ROAD_BOOST_OFFSET;
  for (const road of DAD._roads) {
    const thresh2 = (road.halfW + offset) ** 2;
    for (const seg of road.segs) {
      if (_ptSegDist2(col, row, seg.ax, seg.az, seg.bx, seg.bz) < thresh2) return true;
    }
  }
  return false;
};

// Per-frame: project building polygons and draw on the 2D canvas using painter's sort.
function _dadDrawBuildings() {
  if (!DAD._buildings.length) return;

  const quads = [];
  for (const bld of DAD._buildings) {
    const { height: h, worldPts: wpts } = bld;
    const n = wpts.length;

    // Wall quads
    for (let i = 0; i < n; i++) {
      const [cA, rA] = wpts[i];
      const [cB, rB] = wpts[(i + 1) % n];
      const pA0 = project3(cA, 0, rA);
      const pB0 = project3(cB, 0, rB);
      const pA1 = project3(cA, h, rA);
      const pB1 = project3(cB, h, rB);
      if (!pA0 || !pB0 || !pA1 || !pB1) continue;
      const depth = (pA0.z + pB0.z + pA1.z + pB1.z) * 0.25;
      quads.push({ wall: true, pA0, pB0, pA1, pB1, depth });
    }

    // Roof polygon
    const roof = wpts.map(([c, r]) => project3(c, h, r)).filter(Boolean);
    if (roof.length >= 3) {
      const depth = roof.reduce((s, p) => s + p.z, 0) / roof.length;
      quads.push({ wall: false, pts: roof, depth });
    }
  }

  // Far-first painter sort
  quads.sort((a, b) => b.depth - a.depth);

  ctx.save();
  for (const q of quads) {
    if (q.wall) {
      const { pA0, pB0, pA1, pB1 } = q;
      ctx.beginPath();
      ctx.moveTo(pA0.x, pA0.y);
      ctx.lineTo(pB0.x, pB0.y);
      ctx.lineTo(pB1.x, pB1.y);
      ctx.lineTo(pA1.x, pA1.y);
      ctx.closePath();
      ctx.fillStyle   = 'rgba(155,125,90,0.72)';
      ctx.strokeStyle = 'rgba(190,155,110,0.85)';
      ctx.lineWidth   = 1;
      ctx.fill();
      ctx.stroke();
    } else {
      ctx.beginPath();
      ctx.moveTo(q.pts[0].x, q.pts[0].y);
      for (let i = 1; i < q.pts.length; i++) ctx.lineTo(q.pts[i].x, q.pts[i].y);
      ctx.closePath();
      ctx.fillStyle   = 'rgba(215,180,135,0.82)';
      ctx.strokeStyle = 'rgba(240,205,155,0.95)';
      ctx.lineWidth   = 1;
      ctx.fill();
      ctx.stroke();
    }
  }
  ctx.restore();
}

function _dadDrawTrees() {
  if (!DAD._trees || !DAD._trees.length) return;
  const cfg = CFG_DAD_TREES;

  // Project all trees, skip any behind camera, sort far-first
  const entries = [];
  for (const t of DAD._trees) {
    const pBase = project3(t.wc, 0,                              t.wr);
    const pTop  = project3(t.wc, cfg.TRUNK_H,                   t.wr);
    const pCan  = project3(t.wc, cfg.TRUNK_H + cfg.CANOPY_R * 0.6, t.wr);
    if (!pBase || !pTop || !pCan) continue;
    entries.push({ pBase, pTop, pCan, depth: pBase.z });
  }
  entries.sort((a, b) => b.depth - a.depth);

  ctx.save();
  for (const { pBase, pTop, pCan } of entries) {
    // _camF (focal length from render.js) converts world units → screen pixels at depth z
    const hw0 = Math.max(1.5, cfg.TRUNK_W * _camF / pBase.z * 0.5);
    const hw1 = Math.max(1.5, cfg.TRUNK_W * _camF / pTop.z  * 0.5);
    const cr  = Math.max(4,   cfg.CANOPY_R * _camF / pCan.z);

    // Ground shadow
    ctx.beginPath();
    ctx.ellipse(pBase.x + cr * 0.18, pBase.y + cr * 0.12, cr * 0.65, cr * 0.25, 0, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0,0,0,0.20)';
    ctx.fill();

    // Trunk — billboard quad (always faces camera; width from world-unit projection)
    ctx.beginPath();
    ctx.moveTo(pBase.x - hw0, pBase.y);
    ctx.lineTo(pBase.x + hw0, pBase.y);
    ctx.lineTo(pTop.x  + hw1, pTop.y);
    ctx.lineTo(pTop.x  - hw1, pTop.y);
    ctx.closePath();
    ctx.fillStyle   = 'rgba(100,62,28,0.92)';
    ctx.strokeStyle = 'rgba(58,32,8,0.80)';
    ctx.lineWidth   = 0.5;
    ctx.fill();
    ctx.stroke();

    // Canopy — screen-space sphere (billboard, correct from every angle)
    ctx.beginPath();
    ctx.arc(pCan.x, pCan.y, cr, 0, Math.PI * 2);
    ctx.fillStyle   = 'rgba(38,130,46,0.92)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(12,60,16,0.75)';
    ctx.lineWidth   = Math.max(0.5, cr * 0.10);
    ctx.stroke();

    // Specular highlight
    ctx.beginPath();
    ctx.arc(pCan.x - cr * 0.30, pCan.y - cr * 0.30, cr * 0.34, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(110,220,85,0.20)';
    ctx.fill();
  }
  ctx.restore();
}

DAD._isWall = function(col, row) {
  if (!DAD._collGrid) return false;
  const c = Math.round(col), r = Math.round(row);
  if (c < 0 || c >= DAD._collCols || r < 0 || r >= DAD._collRows) return true;
  return DAD._collGrid[r * DAD._collCols + c] === 1;
};

// ══════════════════════════════════════════════════════════════════════
//  PUBLIC API
// ══════════════════════════════════════════════════════════════════════

async function loadDadMap(jsonPath) {
  // 1. Load map JSON — use pre-bundled data first (works on file://) then fall back to fetch
  let data;
  const _bundled = window._DAD_MAPS_DATA && window._DAD_MAPS_DATA[jsonPath];
  if (_bundled) {
    data = _bundled;
  } else {
    // Diagnostics: tell the user exactly why the bundle wasn't found
    const _hasBundleObj   = typeof window._DAD_MAPS_DATA !== 'undefined';
    const _bundleKeys     = _hasBundleObj ? Object.keys(window._DAD_MAPS_DATA) : [];
    const _diagHint       = _hasBundleObj
      ? 'walteria-map.js loaded but key "' + jsonPath + '" not found.\nAvailable keys: ' + (_bundleKeys.join(', ') || '(none)')
      : 'window._DAD_MAPS_DATA is undefined — walteria-map.js failed to load or has a syntax error.';
    try {
      const res = await fetch(jsonPath);
      if (!res.ok) throw new Error('HTTP ' + res.status);
      data = await res.json();
    } catch (e) {
      throw new Error('loadDadMap: could not load map "' + jsonPath + '".\n\n' +
        'Fix: open map-builder.html → EXPORT JS → replace assets/walteria-map.js.\n\n' +
        'Bundle status: ' + _diagHint);
    }
  }
  DAD.map = data;

  // 2. Load satellite image — use embedded data URL if present (works on file://)
  await new Promise((resolve, reject) => {
    const img = new Image();
    img.onload  = () => { DAD._img = img; resolve(); };
    img.onerror = () => reject(new Error('loadDadMap: could not load image ' + data.image));
    img.src = data.imageDataURL || data.image;
  });

  // 3. Resize world — apply mapScale (read from CFG_DAD.SCALE if set)
  DAD.mapScale = (typeof CFG_DAD !== 'undefined' && CFG_DAD.SCALE) ? CFG_DAD.SCALE : DAD.mapScale;
  CFG.COLS = Math.max(4, Math.round(data.gridCols * DAD.mapScale));
  CFG.ROWS = Math.max(4, Math.round(data.gridRows * DAD.mapScale));

  // 4. Rasterise building polygons into collision grid
  _dadBuildCollGrid();

  // 5. Pre-compute building world-coords for 3D rendering
  _dadPrepBuildings();

  // 6. Pre-compute road segments for speed-boost queries
  _dadPrepRoads();

  return data;
}

function startDad() {
  if (!DAD.map || !DAD._img) {
    console.error('DAD: call loadDadMap() before startDad()');
    return;
  }

  DAD.active = true;
  DAD.maps   = (typeof CFG_DAD !== 'undefined' && CFG_DAD.MAPS)
               ? CFG_DAD.MAPS
               : ['assets/walteria.json'];

  const ok = _dadInitGL();
  if (!ok) { DAD.active = false; return; }

  _dadUploadTex(DAD._img);
  _dadBuildGeom();

  _dadResetProgress();
  initGame();
}

// Called from main.js draw() each frame instead of the normal ground-tile loop.
// Renders satellite to the WebGL canvas, then composites it onto the 2D canvas.
DAD.drawBg = function() {
  _dadTickMissions();
  _dadRender();
  if (DAD._bgCanvas) ctx.drawImage(DAD._bgCanvas, 0, 0, W, H);
  _dadDrawBuildings();
  _dadDrawTrees();
};

// Mirror test toggle (settings panel / ?mirror=1): rebuild the ground mesh with the new UV mapping.
DAD.setMirror = function(on) {
  CFG_DAD.MIRROR_MAP = !!on;
  if (DAD._gl && DAD.map) _dadBuildGeom();
};

// ══════════════════════════════════════════════════════════════════════
//  SKILLS & MISSIONS
//  Dad's mode starts with no skills. Each completed mission unlocks the
//  next locked skill, for the rest of the session. A mission that runs
//  out of time simply ends: no penalty, no message. A pause follows every
//  mission before the next one starts.
// ══════════════════════════════════════════════════════════════════════

const DAD_SKILL_ORDER = ['hook', 'tail', 'burst', 'vacuum'];
const DAD_SKILL_LABEL = { hook: 'HOOK', tail: 'TAIL BULLET', burst: 'BURST', vacuum: 'VACUUM' };

const CFG_DAD_MISSION = {
  REACH_RADIUS:  2.5,     // cells — how close the head must get to the target
  PAUSE_MS:      60000,   // pause between missions (after success or timeout)
  MIN_PATH:      40,      // target is at least this many steps away by road/open ground…
  MAX_PATH:      300,     // …and at most this many
  CELLS_PER_TICK: 1.0,    // assumed head speed, used for the time limit — tune if missions feel too tight/loose
  TIME_FACTOR:   1.5,     // allotted time = path length at that speed × this…
  TIME_BONUS_MS: 15000,   // …plus this flat allowance
};

function _dadAllUnlocked() { return DAD_SKILL_ORDER.every(s => DAD.skills[s]); }

function _dadResetProgress() {
  DAD.skills = { hook: false, tail: false, burst: false, vacuum: false };
  DAD.mission = null;
  DAD.missionNum = 0;
  DAD._pauseLeftMs = 0;   // first mission starts straight away
  DAD._lastTickAt = 0;
  HOOK_ENABLED = false;
  TAILBULLET_ENABLED = false;
  updateHookVisibility();
  updateTailBulletVisibility();
}

function _dadUnlockNextSkill() {
  const next = DAD_SKILL_ORDER.find(s => !DAD.skills[s]);
  if (!next) return;
  DAD.skills[next] = true;
  if (next === 'hook') HOOK_ENABLED = true;
  if (next === 'tail') TAILBULLET_ENABLED = true;
  updateHookVisibility();
  updateTailBulletVisibility();
  showFlash('SKILL UNLOCKED · ' + DAD_SKILL_LABEL[next], '#22aaff');
}

// Breadth-first search over the collision grid from the head. Targets are
// cells whose walking distance falls in the allowed range, so every mission
// is reachable and its time limit follows the real route, not a straight line.
function _dadPickMission() {
  const cols = CFG.COLS, rows = CFG.ROWS;
  const dist  = new Int32Array(cols * rows).fill(-1);
  const queue = new Int32Array(cols * rows);
  const h = G.player.segs[0];
  const start = Math.round(h.row) * cols + Math.round(h.col);
  dist[start] = 0;
  queue[0] = start;
  let qh = 0, qt = 1;
  const candidates = [];
  const { MIN_PATH, MAX_PATH } = CFG_DAD_MISSION;

  while (qh < qt) {
    const cur = queue[qh++];
    const d = dist[cur];
    if (d >= MIN_PATH) candidates.push(cur);
    if (d >= MAX_PATH) continue;
    const c = cur % cols, r = (cur - c) / cols;
    for (const [nc, nr] of [[c + 1, r], [c - 1, r], [c, r + 1], [c, r - 1]]) {
      if (nc < 0 || nr < 0 || nc >= cols || nr >= rows) continue;
      const ni = nr * cols + nc;
      if (dist[ni] >= 0 || DAD._isWall(nc, nr)) continue;
      dist[ni] = d + 1;
      queue[qt++] = ni;
    }
  }
  if (!candidates.length) return null;

  const pick = candidates[Math.floor(Math.random() * candidates.length)];
  const pc = pick % cols, pr = (pick - pc) / cols;
  const limitMs = dist[pick] / CFG_DAD_MISSION.CELLS_PER_TICK * CFG.TICK_MS * CFG_DAD_MISSION.TIME_FACTOR
                + CFG_DAD_MISSION.TIME_BONUS_MS;
  return { col: pc, row: pr, name: pickCity('us'), limitMs, elapsedMs: 0 };
}

function _dadTickMissions() {
  const now = performance.now();
  const dt = DAD._lastTickAt ? Math.min(100, now - DAD._lastTickAt) : 0;
  DAD._lastTickAt = now;
  if (!G || !G.running || G.paused || !G.player || G.player.dead) return;
  if (_dadAllUnlocked()) { DAD.mission = null; return; }

  if (!DAD.mission) {
    DAD._pauseLeftMs -= dt;
    if (DAD._pauseLeftMs > 0) return;
    DAD.mission = _dadPickMission();
    DAD._pauseLeftMs = CFG_DAD_MISSION.PAUSE_MS;  // used again if no route was found
    if (DAD.mission) DAD.missionNum++;
    return;
  }

  const m = DAD.mission;
  m.elapsedMs += dt;
  const h = G.player.segs[0];
  if (Math.hypot(h.col - m.col, h.row - m.row) <= CFG_DAD_MISSION.REACH_RADIUS) {
    _dadUnlockNextSkill();
    DAD.mission = null;
    DAD._pauseLeftMs = CFG_DAD_MISSION.PAUSE_MS;
  } else if (m.elapsedMs >= m.limitMs) {
    // Out of time: the mission ends quietly. No penalty.
    DAD.mission = null;
    DAD._pauseLeftMs = CFG_DAD_MISSION.PAUSE_MS;
  }
}

// Arrow from the head toward the target. Its direction comes from projecting
// a step toward the target, so it still points correctly when the target is
// behind the camera.
function _dadDrawArrow(m) {
  const h = G.player.segs[0];
  const hp = project3(h.col, 0, h.row);
  const dl = Math.hypot(m.col - h.col, m.row - h.row) || 1;
  const hp2 = project3(h.col + (m.col - h.col) / dl, 0, h.row + (m.row - h.row) / dl);
  if (!hp || !hp2) return;
  let sx = hp2.x - hp.x, sy = hp2.y - hp.y;
  const sl = Math.hypot(sx, sy) || 1;
  sx /= sl; sy /= sl;

  ctx.save();
  ctx.translate(hp.x + sx * 70, hp.y + sy * 70);
  ctx.rotate(Math.atan2(sy, sx));
  ctx.beginPath();
  ctx.moveTo(16, 0); ctx.lineTo(-10, -10); ctx.lineTo(-4, 0); ctx.lineTo(-10, 10); ctx.closePath();
  ctx.fillStyle   = '#22aaff';
  ctx.shadowColor = '#22aaff';
  ctx.shadowBlur  = 12;
  ctx.fill();
  ctx.restore();

  const tp = project3(m.col, 0, m.row);
  if (tp) {
    ctx.save();
    ctx.strokeStyle = '#22aaff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(tp.x, tp.y, 14, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }
}

// Status line under the HUD: current mission, pause countdown, or all-done.
function _dadDrawMissionHUD() {
  if (!G || !G.running) return;
  const m = DAD.mission;
  const fmt = ms => {
    const s = Math.max(0, Math.ceil(ms / 1000));
    return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
  };
  let line;
  if (m) line = `MISSION ${DAD.missionNum} · GO TO ${m.name.toUpperCase()} · ${fmt(m.limitMs - m.elapsedMs)}`;
  else if (_dadAllUnlocked()) line = 'ALL SKILLS UNLOCKED';
  else line = `NEXT MISSION IN ${fmt(DAD._pauseLeftMs)}`;
  const unlocked = DAD_SKILL_ORDER.filter(s => DAD.skills[s]).map(s => DAD_SKILL_LABEL[s]);

  ctx.save();
  ctx.textAlign = 'center';
  ctx.font = 'bold 12px "Courier New", monospace';
  ctx.fillStyle = '#22aaff';
  ctx.fillText(line, W / 2, 96);
  ctx.font = '10px "Courier New", monospace';
  ctx.fillStyle = 'rgba(200,200,216,0.75)';
  ctx.fillText('SKILLS: ' + (unlocked.join(' · ') || 'NONE'), W / 2, 112);
  ctx.restore();

  if (m) _dadDrawArrow(m);
}

// ══════════════════════════════════════════════════════════════════════
//  PUBLIC API — the start menu (multiplayer.js) launches Dad's mode.
// ══════════════════════════════════════════════════════════════════════

async function launchDadMode(path, hard) {
  await loadDadMap(path);
  EXPERT_MODE = !!hard;
  if (hard) Object.assign(CFG_EXPERT, CFG_DAD_HARD);
  CFG.ROUND_SEC = hard ? 420 : 300;   // 7 min hard, 5 min normal (3 min base + 2 per step)
  const ss = document.getElementById('s-start');
  if (ss) ss.classList.add('hidden');
  const mp = document.getElementById('mp-overlay');
  if (mp) mp.classList.add('hidden');
  startDad();
}
