// ════════════════════════════════════════
//  THIRD-PERSON PERSPECTIVE CAMERA + 3D RENDERER
// ════════════════════════════════════════

const canvas = document.getElementById('c');
const ctx = canvas.getContext('2d');
let W, H;
function resize(){ W = canvas.width = canvas.offsetWidth; H = canvas.height = canvas.offsetHeight; }
window.addEventListener('resize', resize); resize();

const CAM = {
  x:0, y:0, z:0,
  yaw: Math.PI * 0.25,  // fixed diagonal NW view
  pitch: 0.78,          // steeper tilt = more zoomed in feel
  fov: 65,
  dist: 8,              // was 14, closer = bigger
  height: 14,           // raised from 8 — reduces perspective distortion on Athena terrain
};

// Cached trig
let _cosY, _sinY, _cosP, _sinP, _camF;
function _updateCamTrig() {
  // Rotate so camera's world-forward (cos(yaw),0,sin(yaw)) maps to camera +Z
  _cosY = Math.cos(CAM.yaw); _sinY = Math.sin(CAM.yaw);
  _cosP = Math.cos(CAM.pitch); _sinP = Math.sin(CAM.pitch);
  _camF = (H * 0.5) / Math.tan(CAM.fov * Math.PI / 360);
}
_updateCamTrig();
window.addEventListener('resize', () => { resize(); _updateCamTrig(); });

function project3(wx, wy, wz) {
  const dx = wx-CAM.x, dy = wy-CAM.y, dz = wz-CAM.z;
  // Yaw: rotate around Y axis
  const rx =  dx*_cosY - dz*_sinY;
  const ry =  dy;
  const rz =  dx*_sinY + dz*_cosY;
  // Pitch: rotate around X axis (tilt camera down to look at ground)
  // cx unchanged, cy = ry*cosP + rz*sinP (flip sign vs before), cz = -ry*sinP + rz*cosP
  const cx =  rx;
  const cy =  ry*_cosP + rz*_sinP;
  const cz = -ry*_sinP + rz*_cosP;
  if(cz <= 0.1) return null;
  return { x: W*0.5 + cx*_camF/cz, y: H*0.5 - cy*_camF/cz, z: cz };
}

// Unproject screen point → world XZ angle (for click steering)
function unprojectAngle(screenX, screenY) {
  // Build world-space ray from screen pixel, intersect with ground plane (y=0)
  // Returns the angle from head to hit point
  const ndcX = (screenX - W*0.5) / _camF;
  const ndcY = -(screenY - H*0.5) / _camF;
  // Screen ray in camera space (right-handed, +Z into screen)
  const rCx = ndcX, rCy = ndcY, rCz = 1.0;
  // Inverse pitch: cy = ry*cosP + rz*sinP, cz = -ry*sinP + rz*cosP
  // So: ry = rCy*cosP - rCz*sinP,  rz_world = rCy*sinP + rCz*cosP
  const rWy_pitch = rCy*_cosP - rCz*_sinP;
  const rWz_pitch = rCy*_sinP + rCz*_cosP;
  // Inverse yaw: rx = dx*cosY - dz*sinY,  rz = dx*sinY + dz*cosY
  // So: dx = rx*cosY + rz*sinY, dz = -rx*sinY + rz*cosY
  const rWx = rCx*_cosY + rWz_pitch*_sinY;
  const rWz = -rCx*_sinY + rWz_pitch*_cosY;
  const rWy = rWy_pitch;
  // Intersect ray with y=0 plane: CAM.y + t*rWy = 0 → t = -CAM.y/rWy
  if(Math.abs(rWy) < 0.001) return G.player.angle; // nearly horizontal ray
  const t = -CAM.y / rWy;
  const hitX = CAM.x + rWx * t;
  const hitZ = CAM.z + rWz * t;
  // Direction from snake head to ground hit point
  const head = G.player.segs[0];
  return Math.atan2(hitZ - head.row, hitX - head.col);
}

function depth3(wx, wz) {
  // Camera-space Z after yaw+pitch — larger = further from camera = draw first
  const dx = wx-CAM.x, dz = wz-CAM.z;
  const rz = dx*_sinY + dz*_cosY;          // after yaw
  return -(-CAM.y)*_sinP + rz*_cosP;        // after pitch (ry≈-CAM.y for ground)
}

function updateCamera(headCol, headRow) {
  // Camera sits behind+above head along fixed yaw direction
  const tx = headCol - Math.cos(CAM.yaw) * CAM.dist;
  const tz = headRow  - Math.sin(CAM.yaw) * CAM.dist;
  // In Athena mode the camera gently follows terrain — 40% of full offset keeps
  // the horizon stable without the camera bobbing as much as the ground does.
  const camGroundY = terrainH(headCol, headRow) * 0.4;
  CAM.x += (tx                      - CAM.x) * 0.15;
  CAM.y += (CAM.height + camGroundY - CAM.y) * 0.08;
  CAM.z += (tz                      - CAM.z) * 0.15;
}

// 8 world-space corners of a Y-rotated cube.
// In Athena mode the cube tilts with terrain slope so it looks 3-D correct:
//   - Bottom ring: each corner on the locally-flat terrain plane (linear approx).
//   - Top ring: each bottom corner offset along the terrain surface normal N,
//     so the vertical edges tilt with the slope rather than always pointing world-up.
// In non-Athena mode terrainH=0 everywhere → sx=sz=0 → normal=(0,1,0) → flat cube.
function cubeWorldPts(cx, cz, h, s, angle) {
  const half = s * 0.5;
  const cos = Math.cos(angle), sin = Math.sin(angle);
  function rot(lx, lz) {
    return { wx: cx + lx*cos - lz*sin, wz: cz + lx*sin + lz*cos };
  }
  const corners = [
    rot(-half, -half), rot( half, -half),  // 0: -X-Z,  1: +X-Z
    rot( half,  half), rot(-half,  half),  // 2: +X+Z,  3: -X+Z
  ];

  // Terrain height and gradient at cube centre
  const h0 = terrainH(cx, cz);
  const sx = terrainH(cx + 0.5, cz) - terrainH(cx - 0.5, cz); // dH/dX
  const sz = terrainH(cx, cz + 0.5) - terrainH(cx, cz - 0.5); // dH/dZ

  // Bottom ring: corners lie on the locally-flat terrain plane through centre
  const bot = corners.map(c => ({
    wx: c.wx,
    wy: h0 + (c.wx - cx) * sx + (c.wz - cz) * sz,
    wz: c.wz,
  }));

  // Surface normal N = normalize(-sx, 1, -sz); top corners offset by h along N
  // This makes the side faces proper parallelograms (no 2-D shear distortion)
  const nLen = Math.sqrt(sx * sx + 1 + sz * sz);
  const top = bot.map(b => ({
    wx: b.wx - (sx / nLen) * h,
    wy: b.wy + h / nLen,
    wz: b.wz - (sz / nLen) * h,
  }));

  return [
    bot[0], bot[1], bot[2], bot[3],
    top[0], top[1], top[2], top[3],
  ];
}

// Draw a soft-edged face polygon — inset slightly, then overdraw a rounded highlight stroke
function drawSoftFace(fp, fillColor, edgeLight) {
  // Compute centroid
  let cx=0, cy=0;
  for(const p of fp) { cx+=p.x; cy+=p.y; }
  cx/=fp.length; cy/=fp.length;
  // Inset points 6% toward centroid for a soft chamfer look
  const inset = fp.map(p => ({ x: p.x+(cx-p.x)*0.06, y: p.y+(cy-p.y)*0.06 }));

  ctx.beginPath();
  ctx.moveTo(inset[0].x, inset[0].y);
  for(let i=1;i<inset.length;i++) ctx.lineTo(inset[i].x, inset[i].y);
  ctx.closePath();
  ctx.fillStyle = fillColor;
  ctx.fill();

  // Edge highlight — thin bright stroke around inset face
  ctx.strokeStyle = edgeLight;
  ctx.lineWidth = 1.4;
  ctx.lineJoin = 'round';
  ctx.stroke();

  // Dark gap between faces (outer polygon outline)
  ctx.beginPath();
  ctx.moveTo(fp[0].x, fp[0].y);
  for(let i=1;i<fp.length;i++) ctx.lineTo(fp[i].x, fp[i].y);
  ctx.closePath();
  ctx.strokeStyle = 'rgba(0,0,0,0.55)';
  ctx.lineWidth = 2.0;
  ctx.stroke();
}

function drawCube3(col, row, _cc, _cr, c, alpha, scale, angle, label) {
  const h = CFG.CUBE_H / CFG.TILE_W * scale * 2.2;
  const s = CFG.CUBE_H / CFG.TILE_W * scale * 2.17; // width & depth scale with CUBE_H
  const world = cubeWorldPts(col, row, h, s, angle);
  const pts = world.map(w => project3(w.wx, w.wy, w.wz));

  // All 6 faces — correct CCW winding from outside
  // pts[0..3]=bottom ring, pts[4..7]=top ring
  // corners: 0=-X-Z, 1=+X-Z, 2=+X+Z, 3=-X+Z (same for top 4..7)
  const faces = [
    { idx:[7,6,5,4], fill:c.t,                        edge:'rgba(255,255,255,0.35)' }, // top
    { idx:[0,1,2,3], fill:c.l,                        edge:'rgba(0,0,0,0.2)'        }, // bottom
    { idx:[2,1,5,6], fill:c.r,                        edge:'rgba(255,255,255,0.18)' }, // right +X
    { idx:[0,3,7,4], fill:c.l,                        edge:'rgba(255,255,255,0.10)' }, // left  -X
    { idx:[3,2,6,7], fill:lighten(c.r, 0.08),         edge:'rgba(255,255,255,0.18)' }, // front +Z
    { idx:[1,0,4,5], fill:darken(c.l, 0.08),          edge:'rgba(0,0,0,0.1)'        }, // back  -Z
  ];

  ctx.globalAlpha = alpha;
  for(const f of faces) {
    if(f.idx.some(i => !pts[i])) continue;
    const fp = f.idx.map(i => pts[i]);
    const ax=fp[1].x-fp[0].x, ay=fp[1].y-fp[0].y,bx=fp[2].x-fp[0].x,by=fp[2].y-fp[0].y;
    if(ax*by - ay*bx < 0) continue;
    drawSoftFace(fp, f.fill, f.edge);
  }

  // Label on top face
  const tp = [pts[4],pts[5],pts[6],pts[7]];
  if(label !== undefined && tp.every(p=>p)) {
    const lx=(tp[0].x+tp[1].x+tp[2].x+tp[3].x)/4;
    const ly=(tp[0].y+tp[1].y+tp[2].y+tp[3].y)/4;
    const topW=Math.hypot(tp[1].x-tp[0].x,tp[1].y-tp[0].y);
    const str=String(label);
    const fs=Math.max(5, topW*(str.length>=4?0.28:str.length===3?0.34:0.42));
    ctx.fillStyle=c.tx;
    ctx.font=`900 ${fs}px 'Courier New',Courier,monospace`;
    ctx.textAlign='center'; ctx.textBaseline='middle';
    ctx.fillText(str,lx,ly);
  }
  ctx.globalAlpha=1;
}

// Lighten/darken a hex color by factor
function lighten(hex, f) { return shiftColor(hex,  f); }
function darken (hex, f) { return shiftColor(hex, -f); }
function shiftColor(hex, f) {
  // Handle both #rrggbb and rgb(...) formats
  let r,g,b;
  if(hex.startsWith('#')) {
    r=parseInt(hex.slice(1,3),16); g=parseInt(hex.slice(3,5),16); b=parseInt(hex.slice(5,7),16);
  } else {
    const m=hex.match(/\d+/g); r=+m[0]; g=+m[1]; b=+m[2];
  }
  r=Math.max(0,Math.min(255,Math.round(r+f*255)));
  g=Math.max(0,Math.min(255,Math.round(g+f*255)));
  b=Math.max(0,Math.min(255,Math.round(b+f*255)));
  return `rgb(${r},${g},${b})`;
}
function lerpColor(a, b, t) {
  // Lerp two #rrggbb hex colors
  const pa = a.startsWith('#') ? [parseInt(a.slice(1,3),16),parseInt(a.slice(3,5),16),parseInt(a.slice(5,7),16)]
    : a.match(/\d+/g).map(Number);
  const pb = b.startsWith('#') ? [parseInt(b.slice(1,3),16),parseInt(b.slice(3,5),16),parseInt(b.slice(5,7),16)]
    : b.match(/\d+/g).map(Number);
  const r=Math.round(pa[0]+(pb[0]-pa[0])*t);
  const g=Math.round(pa[1]+(pb[1]-pa[1])*t);
  const bl2=Math.round(pa[2]+(pb[2]-pa[2])*t);
  return `rgb(${r},${g},${bl2})`;
}

// Draw sphere (food, loose body segments)
function drawSphere(col, row, c, alpha, scale, wobble) {
  const gY = terrainH(col, row);
  const p = project3(col, gY + scale*0.5, row);
  if(!p) return;
  // Project another point to get approximate screen radius
  const p2 = project3(col + scale*0.5, gY + scale*0.5, row);
  if(!p2) return;
  const r = Math.abs(p2.x - p.x) * 1.1;
  if(r < 1) return;
  ctx.globalAlpha = alpha;
  // Sphere body
  const grad = ctx.createRadialGradient(p.x - r*0.3, p.y - r*0.35, r*0.05, p.x, p.y, r);
  grad.addColorStop(0, lighten(c.t, 0.3));
  grad.addColorStop(0.5, c.t);
  grad.addColorStop(1, c.l);
  ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, Math.PI*2);
  ctx.fillStyle = grad; ctx.fill();
  // Shine
  ctx.beginPath(); ctx.arc(p.x - r*0.28, p.y - r*0.3, r*0.22, 0, Math.PI*2);
  ctx.fillStyle = 'rgba(255,255,255,0.4)'; ctx.fill();
  // Value label — wobble can be a number (food value) or string (special item label)
  if(wobble !== undefined) {
    const str = typeof wobble === 'string' ? wobble : fmtVal(wobble);
    const fs = Math.max(5, r*(str.length>=4?0.52:str.length===3?0.6:0.72));
    ctx.fillStyle = c.tx;
    ctx.font = `900 ${fs}px system-ui,-apple-system,sans-serif`;
    ctx.textAlign='center'; ctx.textBaseline='middle';
    ctx.fillText(str, p.x, p.y + r*0.08);
  }
  ctx.globalAlpha = 1;
}

// Draw snake head cube + floating face features in world space
// Eyes/mouth are projected as 3D world points slightly in front of the cube face
function drawHead(col, row, c, alpha, scale, angle, label, mouthOpen, isBot, botEmotion) {
  const h = CFG.CUBE_H / CFG.TILE_W * scale * 2.2;
  const s = CFG.CUBE_H / CFG.TILE_W * scale * 2.17; // width & depth scale with CUBE_H
  const groundY = terrainH(col, row);   // centre terrain height — used for face feature positions
  const world = cubeWorldPts(col, row, h, s, angle);
  const pts = world.map(w => project3(w.wx, w.wy, w.wz));

  ctx.globalAlpha = alpha;

  // Draw cube faces
  const faces = [
    { idx:[7,6,5,4], fill:c.t,               edge:'rgba(255,255,255,0.35)' },
    { idx:[0,1,2,3], fill:c.l,               edge:'rgba(0,0,0,0.2)'        },
    { idx:[2,1,5,6], fill:c.r,               edge:'rgba(255,255,255,0.18)' },
    { idx:[0,3,7,4], fill:c.l,               edge:'rgba(255,255,255,0.10)' },
    { idx:[3,2,6,7], fill:lighten(c.r,0.08), edge:'rgba(255,255,255,0.18)' },
    { idx:[1,0,4,5], fill:darken(c.l,0.08),  edge:'rgba(0,0,0,0.1)'        },
  ];
  for(const f of faces) {
    if(f.idx.some(i=>!pts[i])) continue;
    const fp=f.idx.map(i=>pts[i]);
    const ax=fp[1].x-fp[0].x,ay=fp[1].y-fp[0].y,bx=fp[2].x-fp[0].x,by=fp[2].y-fp[0].y;
    if(ax*by - ay*bx < 0) continue;
    drawSoftFace(fp, f.fill, f.edge);
  }

  // Label on top face
  const tp=[pts[4],pts[5],pts[6],pts[7]];
  if(label!==undefined && tp.every(p=>p)) {
    const lx=(tp[0].x+tp[1].x+tp[2].x+tp[3].x)/4;
    const ly=(tp[0].y+tp[1].y+tp[2].y+tp[3].y)/4;
    const topW=Math.hypot(tp[1].x-tp[0].x,tp[1].y-tp[0].y);
    const str=String(label);
    const fs=Math.max(5,topW*(str.length>=4?0.28:str.length===3?0.34:0.42));
    ctx.fillStyle=c.tx;
    ctx.font=`900 ${fs}px 'Courier New',Courier,monospace`;
    ctx.textAlign='center'; ctx.textBaseline='middle';
    ctx.fillText(str,lx,ly);
  }

  // ── Floating face features in world space ──
  // The face floats slightly in front of the head cube along its travel direction
  const fwd = s * 0.7; // further in front for more presence
  const faceCX = col + Math.cos(angle) * fwd;
  const faceCZ = row + Math.sin(angle) * fwd;
  const faceCY = groundY + h * 0.58;

  const faceCenter = project3(faceCX, faceCY, faceCZ);
  if(!faceCenter) { ctx.globalAlpha=1; return; }

  // Wider eye spacing for exaggerated expression
  const right = s * 0.30;  // was 0.22
  const rightX = -Math.sin(angle) * right;
  const rightZ =  Math.cos(angle) * right;

  const pEyeL = project3(faceCX - rightX, faceCY + h*0.10, faceCZ - rightZ);
  const pEyeR = project3(faceCX + rightX, faceCY + h*0.10, faceCZ + rightZ);
  const pMouth = project3(faceCX, faceCY - h*0.28, faceCZ);  // lower = bigger gap

  if(!pEyeL || !pEyeR || !pMouth) { ctx.globalAlpha=1; return; }

  // Eye radius — same world-space calculation, half the multiplier vs v1.0.2
  const eyeR = Math.hypot(pEyeR.x-faceCenter.x, pEyeR.y-faceCenter.y) * 0.7;  // was 1.4
  if(eyeR < 1.5) { ctx.globalAlpha=1; return; }

  ctx.globalAlpha = alpha;

  // ── Eyes ──
  const isHungry  = botEmotion === 'hungry';
  const isScared  = botEmotion === 'scared';

  for(const [pe, side] of [[pEyeL,-1],[pEyeR,1]]) {
    if(isBot) {
      if(isScared) {
        // Wide white eyes with tiny darting pupils — pure fear
        ctx.beginPath(); ctx.arc(pe.x,pe.y,eyeR*1.2,0,Math.PI*2);
        ctx.fillStyle='#ffffff'; ctx.fill();
        ctx.strokeStyle='rgba(0,0,0,0.4)'; ctx.lineWidth=eyeR*0.15; ctx.stroke();
        // Tiny offset pupil — looking away
        const dartX = pe.x + side*eyeR*0.38, dartY = pe.y - eyeR*0.25;
        ctx.beginPath(); ctx.arc(dartX,dartY,eyeR*0.3,0,Math.PI*2);
        ctx.fillStyle='#1a0030'; ctx.fill();
        // Shine (extra bright when scared)
        ctx.beginPath(); ctx.arc(dartX-eyeR*0.1,dartY-eyeR*0.12,eyeR*0.13,0,Math.PI*2);
        ctx.fillStyle='rgba(255,255,255,0.9)'; ctx.fill();
      } else if(isHungry) {
        // Large glowing hungry eye — orange-red, dilated pupil, intense glow
        const grd = ctx.createRadialGradient(pe.x,pe.y,0,pe.x,pe.y,eyeR*1.15);
        grd.addColorStop(0,'#ffaa00'); grd.addColorStop(0.35,'#ee4400'); grd.addColorStop(1,'#330000');
        ctx.beginPath(); ctx.arc(pe.x,pe.y,eyeR*1.15,0,Math.PI*2);
        ctx.fillStyle=grd; ctx.fill();
        // Round dilated pupil (hunger = big pupil)
        ctx.beginPath(); ctx.arc(pe.x,pe.y,eyeR*0.55,0,Math.PI*2);
        ctx.fillStyle='#050000'; ctx.fill();
        // Intense outer glow
        ctx.beginPath(); ctx.arc(pe.x,pe.y,eyeR*1.15,0,Math.PI*2);
        ctx.strokeStyle='rgba(255,120,0,0.8)'; ctx.lineWidth=eyeR*0.35; ctx.stroke();
        // Predator shine
        ctx.beginPath(); ctx.arc(pe.x-eyeR*0.2,pe.y-eyeR*0.25,eyeR*0.18,0,Math.PI*2);
        ctx.fillStyle='rgba(255,220,100,0.7)'; ctx.fill();
      } else {
        // Neutral bot — standard red slit eye
        const grd = ctx.createRadialGradient(pe.x,pe.y,0,pe.x,pe.y,eyeR);
        grd.addColorStop(0,'#ff6060'); grd.addColorStop(0.4,'#cc0000'); grd.addColorStop(1,'#440000');
        ctx.beginPath(); ctx.arc(pe.x,pe.y,eyeR,0,Math.PI*2);
        ctx.fillStyle=grd; ctx.fill();
        ctx.beginPath(); ctx.ellipse(pe.x,pe.y,eyeR*0.22,eyeR*0.72,0,0,Math.PI*2);
        ctx.fillStyle='#0a0000'; ctx.fill();
        ctx.beginPath(); ctx.arc(pe.x,pe.y,eyeR,0,Math.PI*2);
        ctx.strokeStyle='rgba(255,40,40,0.6)'; ctx.lineWidth=eyeR*0.25; ctx.stroke();
      }
    } else {
      // Player friendly eye
      ctx.beginPath(); ctx.arc(pe.x,pe.y,eyeR,0,Math.PI*2);
      ctx.fillStyle='#ffffff'; ctx.fill();
      ctx.strokeStyle='rgba(0,0,0,0.3)'; ctx.lineWidth=0.8; ctx.stroke();
      ctx.beginPath(); ctx.arc(pe.x+eyeR*0.12,pe.y+eyeR*0.1,eyeR*0.48,0,Math.PI*2);
      ctx.fillStyle='#1a1a3a'; ctx.fill();
      ctx.beginPath(); ctx.arc(pe.x-eyeR*0.18,pe.y-eyeR*0.22,eyeR*0.2,0,Math.PI*2);
      ctx.fillStyle='rgba(255,255,255,0.85)'; ctx.fill();
    }
  }

  // Bot eyebrows — angry for hungry/neutral, raised for scared
  if(isBot) {
    const pBrowLL = project3(faceCX - rightX*1.3, faceCY + h*0.08 + h*0.13, faceCZ - rightZ*1.3);
    const pBrowLR = project3(faceCX - rightX*0.3, faceCY + h*0.08 + h*0.07, faceCZ - rightZ*0.3);
    const pBrowRL = project3(faceCX + rightX*0.3, faceCY + h*0.08 + h*0.07, faceCZ + rightZ*0.3);
    const pBrowRR = project3(faceCX + rightX*1.3, faceCY + h*0.08 + h*0.13, faceCZ + rightZ*1.3);
    if(pBrowLL && pBrowLR && pBrowRL && pBrowRR) {
      if(isScared) {
        // Raised arched brows (inner corners UP = fear)
        ctx.strokeStyle='rgba(80,60,60,0.9)'; ctx.lineWidth=eyeR*0.35; ctx.lineCap='round';
        ctx.beginPath(); ctx.moveTo(pBrowLL.x,pBrowLL.y+eyeR*0.5); ctx.lineTo(pBrowLR.x,pBrowLR.y-eyeR*0.8); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(pBrowRR.x,pBrowRR.y+eyeR*0.5); ctx.lineTo(pBrowRL.x,pBrowRL.y-eyeR*0.8); ctx.stroke();
      } else {
        // Angry V-brows (inner corners DOWN = aggression) — deeper for hungry
        const angryDip = isHungry ? 1.2 : 0.6;
        ctx.strokeStyle = isHungry ? '#ff6600' : '#ff3030';
        ctx.lineWidth=eyeR*0.45; ctx.lineCap='round';
        ctx.beginPath(); ctx.moveTo(pBrowLL.x,pBrowLL.y); ctx.lineTo(pBrowLR.x,pBrowLR.y+eyeR*angryDip); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(pBrowRR.x,pBrowRR.y); ctx.lineTo(pBrowRL.x,pBrowRL.y+eyeR*angryDip); ctx.stroke();
      }
    }
  }

  // ── Mouth — 4x scale ──
  const mouthR = eyeR * 1.8;  // was 0.9, now 2x of already-doubled eyes = 4x total
  const mouthOpen01 = mouthOpen; // 0=closed,1=open

  if(mouthOpen01 > 0.04) {
    // Chomping — open jaw sized relative to eye radius (avoids camera-pitch inflation)
    const jawAngle = mouthOpen01 * 1.2;
    if(true) {
      const gapH = eyeR * jawAngle;
      // Dark mouth interior
      ctx.beginPath();
      ctx.ellipse(pMouth.x, pMouth.y, mouthR*0.9, Math.max(2, gapH), 0, 0, Math.PI*2);
      ctx.fillStyle='#050005'; ctx.fill();
      // Top teeth: 5 sharp triangles
      const nTop=5;
      const twTop = mouthR*1.85/nTop;
      const toothH = gapH * 0.82;
      for(let t=0;t<nTop;t++) {
        const tx2=pMouth.x-mouthR*0.925+twTop*(t+0.5);
        const hw=twTop*0.42;
        ctx.beginPath();
        ctx.moveTo(tx2-hw,pMouth.y-gapH*0.12);
        ctx.lineTo(tx2,pMouth.y-gapH*0.12-toothH);
        ctx.lineTo(tx2+hw,pMouth.y-gapH*0.12);
        ctx.closePath(); ctx.fillStyle=isBot?'#d0d0d0':'#f8f8f8'; ctx.fill();
      }
      // Bottom teeth: 4, staggered halfway between top teeth
      const nBot=4;
      const twBot=mouthR*1.85/nTop; // same width
      const toothHBot=gapH*0.65;
      for(let t=0;t<nBot;t++) {
        const tx2=pMouth.x-mouthR*0.925+twBot*(t+1.0); // offset by half tooth
        const hw=twBot*0.4;
        ctx.beginPath();
        ctx.moveTo(tx2-hw,pMouth.y+gapH*0.12);
        ctx.lineTo(tx2,pMouth.y+gapH*0.12+toothHBot);
        ctx.lineTo(tx2+hw,pMouth.y+gapH*0.12);
        ctx.closePath(); ctx.fillStyle=isBot?'#b0b0b0':'#ebebeb'; ctx.fill();
      }
    }
  } else {
    // Closed mouth
    if(!isBot) {
      // Player smile
      ctx.beginPath();
      ctx.arc(pMouth.x, pMouth.y - mouthR*0.1, mouthR*0.75, 0.1*Math.PI, 0.9*Math.PI);
      ctx.strokeStyle='rgba(0,0,0,0.55)'; ctx.lineWidth=mouthR*0.28; ctx.lineCap='round'; ctx.stroke();
    } else {
      // Bot grimace
      ctx.beginPath();
      ctx.moveTo(pMouth.x-mouthR*0.75, pMouth.y);
      ctx.lineTo(pMouth.x+mouthR*0.75, pMouth.y);
      ctx.strokeStyle='rgba(0,0,0,0.7)'; ctx.lineWidth=mouthR*0.3; ctx.lineCap='square'; ctx.stroke();
      // Tiny fangs
      ctx.fillStyle='#dddddd';
      for(const fx of [pMouth.x-mouthR*0.3, pMouth.x+mouthR*0.3]) {
        ctx.beginPath(); ctx.moveTo(fx-mouthR*0.12,pMouth.y);
        ctx.lineTo(fx,pMouth.y+mouthR*0.32); ctx.lineTo(fx+mouthR*0.12,pMouth.y);
        ctx.closePath(); ctx.fill();
      }
    }
  }

  ctx.globalAlpha=1;
}



// ── Rolling hills terrain ──
// Flat in Felix solo play; Athena starts 2x height, +25% per level, centered around y=0
const TERRAIN_HEIGHT_BASE = 0.35;     // world-unit amplitude
const TERRAIN_ATHENA_BASE_MULT = 2.0; // Athena L1 = 2x base
const TERRAIN_LEVEL_SCALE = 0.25;     // 25% taller per Athena level

let _terrainSeed = 0;

function terrainH(col, row) {
  if(!(typeof ATHENA !== 'undefined' && ATHENA.active)) return 0;
  const s = _terrainSeed;
  const levelMult = TERRAIN_ATHENA_BASE_MULT * (1 + TERRAIN_LEVEL_SCALE * (ATHENA.level - 1));
  const amp = TERRAIN_HEIGHT_BASE * levelMult * CFG.TERRAIN_Z_SCALE;
  const h = Math.sin(col * 0.17 + row * 0.11 + s)     * 0.5
           + Math.sin(col * 0.07 + row * 0.19 + s*1.3) * 0.3
           + Math.sin(col * 0.31 + row * 0.23 + s*0.7) * 0.2;
  return amp * h * 0.5; // centered: range [-amp/2, +amp/2]
}

function ground(col, row, _cc, _cr, color) {
  const h00=terrainH(col-0.5,row-0.5), h10=terrainH(col+0.5,row-0.5);
  const h11=terrainH(col+0.5,row+0.5), h01=terrainH(col-0.5,row+0.5);
  const pts=[
    project3(col-0.5,h00,row-0.5), project3(col+0.5,h10,row-0.5),
    project3(col+0.5,h11,row+0.5), project3(col-0.5,h01,row+0.5),
  ];
  if(pts.some(p=>!p)) return;
  ctx.beginPath(); ctx.moveTo(pts[0].x,pts[0].y);
  for(let i=1;i<4;i++) ctx.lineTo(pts[i].x,pts[i].y);
  ctx.closePath(); ctx.fillStyle=color; ctx.fill();
}

function iso(col, row) {
  return project3(col,0,row) || {x:W*2,y:H*2};
}

function lerpAngle(from, to, speed) {
  let da = to - from;
  while(da >  Math.PI) da -= Math.PI*2;
  while(da < -Math.PI) da += Math.PI*2;
  return from + Math.sign(da) * Math.min(Math.abs(da), speed);
}

function updateLeaderboard() {
  const el = document.getElementById('lb-rows');
  if(!el || !G || !G.player) return;
  const entries = [];
  
  // FIX: Include the player even if dead, pulling their current player_start_val or last known head value
  if (G.player.segs && G.player.segs.length > 0) {
    entries.push({name:'YOU', val:G.player.segs[0].val, isPlayer:true, color:'#00f5c4'});
  } else {
    // Fallback: If segments are cleared on death, use the current player_start_val or score tracking variable
    const finalVal = window.player_start_val || 2; 
    entries.push({name:'YOU', val:finalVal, isPlayer:true, color:'#00f5c4'});
  }

  if(G.bots) {
    for(const b of G.bots) {
      if(!b.dead && b.segs && b.segs.length) {
        entries.push({name:b.name||'?', val:b.segs[0].val, isPlayer:false, color:b.palette.t});
      }
    }
  }




  
  entries.sort((a,b)=>b.val-a.val);

  // Responsive: small screen = max 3 rows, else 8
  const maxRows = window.innerWidth < 480 ? 3 : 8;
  
  // Always include player if outside top maxRows
  let show = entries.slice(0, maxRows);
  const playerInShow = show.some(e=>e.isPlayer);
  if(!playerInShow && entries.find(e=>e.isPlayer)) {
    show = show.slice(0, maxRows-1);
    show.push(entries.find(e=>e.isPlayer));
  }
  
  el.innerHTML = show.map((e,i)=>{
    const rank = entries.indexOf(e)+1;
    return `<div class="lb-row${e.isPlayer?' is-player':''}">
      <span class="lb-rank">${rank}</span>
      <span class="lb-dot" style="background:${e.color}"></span>
      <span class="lb-name">${e.name}</span>
      <span class="lb-val" style="color:${gc(e.val).t}">${fmtVal(e.val)}</span>
    </div>`;
  }).join('');
}
