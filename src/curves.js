/* ---------- изогнутые и диагональные дороги поверх осевой сетки: кольца, лучи, извилины ---------- */
let curves = [], junctions = [];
function curveBuild(pts, hw, closed) {
  if (closed) pts = pts.concat([pts[0]]);
  const cum = [0]; for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  return { pts, hw, cum, len: cum[cum.length - 1], closed };
}
function curvePos(cv, t) {
  const { pts, cum } = cv; t = clamp(t, 0, cv.len);
  let i = 1; while (i < cum.length - 1 && cum[i] < t) i++;
  const a = pts[i - 1], b = pts[i], L = cum[i] - cum[i - 1] || 1, k = (t - cum[i - 1]) / L;
  return { x: a[0] + (b[0] - a[0]) * k, y: a[1] + (b[1] - a[1]) * k, tx: (b[0] - a[0]) / L, ty: (b[1] - a[1]) / L };
}
// ближайшая точка дороги к точке: расстояние и параметр
function curveNearest(cv, x, y) {
  let bd = 1e9, bt = 0;
  for (let i = 1; i < cv.pts.length; i++) {
    const a = cv.pts[i - 1], b = cv.pts[i], dx = b[0] - a[0], dy = b[1] - a[1], L2 = dx * dx + dy * dy || 1;
    const k = clamp(((x - a[0]) * dx + (y - a[1]) * dy) / L2, 0, 1), px = a[0] + dx * k, py = a[1] + dy * k, d = Math.hypot(px - x, py - y);
    if (d < bd) { bd = d; bt = cv.cum[i - 1] + Math.sqrt(L2) * k; }
  }
  return { d: bd, t: bt };
}
// дорога не должна резать особые здания (больницу, часть, станции)
function curveClear(cv) {
  for (const k in special) { const b = special[k].b; if (!b) continue; const cx = (b.x0 + b.x1) / 2, cy = (b.y0 + b.y1) / 2, r = Math.hypot(b.x1 - b.x0, b.y1 - b.y0) / 2 + cv.hw + 8; if (curveNearest(cv, cx, cy).d < r) return false; }
  return true;
}
// прорезаем дорогу в сетке: асфальт, тротуары, снос домов и деревьев в коридоре, фонари вдоль обочины
function rasterCurve(cv) {
  const road = new Set(), side = new Set(), R = cv.hw + 7;
  for (let t = 0; t <= cv.len; t += 3) {
    const p = curvePos(cv, t);
    for (let gy = Math.floor((p.y - R) / CS); gy <= Math.floor((p.y + R) / CS); gy++) for (let gx = Math.floor((p.x - R) / CS); gx <= Math.floor((p.x + R) / CS); gx++) {
      if (gx < 0 || gy < 0 || gx >= GW || gy >= GH) continue;
      const d = Math.hypot(gx * CS + 4 - p.x, gy * CS + 4 - p.y), i = gy * GW + gx;
      if (d < cv.hw) road.add(i); else if (d < R) side.add(i);
    }
  }
  const inCorridor = (x0, y0, x1, y1) => { for (let gy = Math.floor(y0 / CS); gy <= Math.floor(y1 / CS); gy++) for (let gx = Math.floor(x0 / CS); gx <= Math.floor(x1 / CS); gx++) { const i = gy * GW + gx; if (road.has(i) || side.has(i)) return true; } return false; };
  const isSpecial = b => Object.values(special).some(s => s.b === b);
  buildings = buildings.filter(b => { if (!inCorridor(b.x0, b.y0, b.x1, b.y1) || isSpecial(b)) return true; fillCells(b.x0, b.y0, b.x1, b.y1, 2); return false; });
  trees = trees.filter(t => { if (curveNearest(cv, t.x, t.y).d > R + 3) return true; fillCells(t.x - 3, t.y - 3, t.x + 3, t.y + 3, 2); return false; });
  lamps = lamps.filter(l => curveNearest(cv, l.x, l.y).d > R);
  fences = fences.filter(f => curveNearest(cv, (f[0] + f[2]) / 2, (f[1] + f[3]) / 2).d > R + 6 && curveNearest(cv, f[0], f[1]).d > R && curveNearest(cv, f[2], f[3]).d > R);
  fountains = fountains.filter(f => curveNearest(cv, f.x, f.y).d > R + f.r);
  for (const i of side) { const c = grid[i]; if (c === 2 || c === 7 || c === 8 || c === 3 || c === 4) grid[i] = 1; }
  for (const i of road) grid[i] = 0;
  for (let t = 40; t < cv.len - 20; t += 64) { const p = curvePos(cv, t); for (const s of [-1, 1]) { const x = p.x + s * (-p.ty) * (cv.hw + 3), y = p.y + s * p.tx * (cv.hw + 3); if (x > 10 && y > 10 && x < W - 10 && y < H - 10 && cellAt(x, y) === 1) lamps.push({ x, y, f: Math.abs(p.tx) > Math.abs(p.ty) ? (s < 0 ? 0 : 1) : (s < 0 ? 2 : 3) }); } }
}
function addCurve(pts, hw, closed) {
  pts = pts.filter(p => p[0] > 4 && p[1] > 4 && p[0] < W - 4 && p[1] < H - 4);
  if (pts.length < 2) return null;
  const cv = curveBuild(pts, hw, closed);
  if (cv.len < 60 || !curveClear(cv)) return null;
  rasterCurve(cv); curves.push(cv); return cv;
}
// стыки с осевыми улицами: концы дорог, с которых машины съезжают на обычную полосу и наоборот
function buildJunctions() {
  junctions = [];
  for (const cv of curves) { if (cv.closed) continue; for (const t of [0, cv.len]) { const p = curvePos(cv, t); const l = nearestLanePoint(p.x, p.y); if (l && Math.hypot((l.l.s.v ? l.l.c : l.along) - p.x, (l.l.s.v ? l.along : l.l.c) - p.y) < 40) junctions.push({ cv, t, x: p.x, y: p.y }); } }
}
function ringPts(cx, cy, r, n, wob) { const pts = []; for (let i = 0; i < n; i++) { const a = i / n * TAU, rr = r + rnd(-wob, wob); pts.push([cx + Math.cos(a) * rr, cy + Math.sin(a) * rr]); } return pts; }
function spokePts(cx, cy, a, r0, r1) { return [[cx + Math.cos(a) * r0, cy + Math.sin(a) * r0], [cx + Math.cos(a) * r1, cy + Math.sin(a) * r1]]; }
function windingPts(x0, y0, x1, y1, amp, waves) {
  const pts = [], n = 24, L = Math.hypot(x1 - x0, y1 - y0), ux = (x1 - x0) / L, uy = (y1 - y0) / L, ph = rnd(0, TAU);
  for (let i = 0; i <= n; i++) { const k = i / n, off = Math.sin(k * waves * TAU + ph) * amp * Math.sin(k * Math.PI); pts.push([x0 + ux * L * k - uy * off, y0 + uy * L * k + ux * off]); }
  return pts;
}
function genCurves() {
  curves = []; junctions = [];
  const kind = L.curves; if (!kind) return;
  const cx = W / 2, cy = H / 2;
  if (kind === "ring" || kind === "radial") {
    const rings = kind === "ring" ? [250, 520] : [200, 400, 620], spokes = kind === "ring" ? 8 : 12;
    for (const r of rings) for (let k = 0; k < 4; k++) if (addCurve(ringPts(cx, cy, r + k * 14, Math.round(r / 18), r * .03), r > 450 ? 22 : 18, true)) break;
    for (let i = 0; i < spokes; i++) for (let k = 0; k < 3; k++) { const a = i / spokes * TAU + rnd(-.06, .06) + k * .08; const r1 = Math.min(W / 2 - 40, H / 2 - 40) / Math.max(Math.abs(Math.cos(a)), Math.abs(Math.sin(a)) * H / W) * .98; if (addCurve(spokePts(cx, cy, a, 70, Math.min(r1, kind === "ring" ? 760 : 700)), 16, false)) break; }
    fillCells(cx - 56, cy - 56, cx + 56, cy + 56, 7); fountains.push({ x: cx, y: cy, r: 14 }); fillCells(cx - 12, cy - 12, cx + 12, cy + 12, 3);
  } else if (kind === "diag") {
    for (const [sx, sy] of [[1, 1], [1, -1]]) { const k = Math.min(W / 2, H / 2) - 30; addCurve([[cx - k * sx, cy - k * sy], [cx + k * sx, cy + k * sy]], 20, false); }
    for (const a of [Math.PI / 6, Math.PI * 5 / 6, -Math.PI / 6, -Math.PI * 5 / 6]) addCurve(spokePts(cx, cy, a, 60, 560), 14, false);
    fillCells(cx - 64, cy - 64, cx + 64, cy + 64, 7); fountains.push({ x: cx, y: cy, r: 16 }); fillCells(cx - 14, cy - 14, cx + 14, cy + 14, 3);
  } else if (kind === "winding") {
    for (let i = 0; i < 4; i++) for (let k = 0; k < 4; k++) { const y = H * (.2 + .2 * i) + rnd(-40, 40); if (addCurve(windingPts(20, y, W - 20, y + rnd(-200, 200), rnd(90, 160), rnd(1.5, 3)), 16, false)) break; }
    for (let i = 0; i < 3; i++) for (let k = 0; k < 4; k++) { const x = W * (.25 + .25 * i) + rnd(-60, 60); if (addCurve(windingPts(x, 20, x + rnd(-250, 250), H - 20, rnd(80, 140), rnd(1.5, 2.5)), 14, false)) break; }
  }
}
/* ---------- машины на изогнутых дорогах ---------- */
function curveDirOf(tx, ty) { return ((Math.round(Math.atan2(ty, tx) / (Math.PI / 2)) % 4) + 4) % 4; }
function placeOnCurve(c, cv, t, cdir) {
  c.curve = cv; c.ct = t; c.cdir = cdir;
  const p = curvePos(cv, t), tx = p.tx * cdir, ty = p.ty * cdir, lat = cv.hw * .5;
  c.x = p.x - ty * lat; c.y = p.y + tx * lat; c.ang = Math.atan2(ty, tx); c.dir = curveDirOf(tx, ty);
}
function stepCurveCar(c, dt) {
  const cv = c.curve, p = curvePos(cv, c.ct), tx = p.tx * c.cdir, ty = p.ty * c.cdir, lat = cv.hw * .5;
  const x = p.x - ty * lat, y = p.y + tx * lat;
  let clear = 1e9, people = false, zNear = 0;
  nearCars(x + tx * 25, y + ty * 25, 32, o => { if (o === c || o.gone || o.towedBy || (!o.moving && !o.stopped && !o.tank)) return; const al = (o.x - x) * tx + (o.y - y) * ty, lt = Math.abs((o.x - x) * ty - (o.y - y) * tx); if (al > 0 && lt < 5.5 && al < clear) clear = al; else if (al > 2 && al < 22 && lt < 9 && o.moving && o.v > 2 && al + 6 < clear) clear = al + 6; });
  near(x + tx * 18, y + ty * 18, 30, a => { if (a.state !== "alive") return; const al = (a.x - x) * tx + (a.y - y) * ty, lt = Math.abs((a.x - x) * ty - (a.y - y) * tx); if (a.role === "zombie" && Math.hypot(a.x - x, a.y - y) < 30) zNear++; if (al > 4 && al < 34 && lt < 5.5 && (a.role !== "zombie" || !c.panic)) { people = a.role !== "zombie"; clear = Math.min(clear, al + 2); if (al < 12 && !c.panic) c.v = Math.min(c.v, 2); } });
  for (let k = 10; k < 36; k += 6) { const cc = cellAt(x + tx * k, y + ty * k); if (cc === 3 || cc === 4 || cc === 6 || cc === 8 || cc === 5) { clear = Math.min(clear, k - 4); break; } }
  if (zNear > 0 && !c.panic && !c.service) { c.panic = true; c.spd *= 1.35; }
  if (c.goal) { c.svcT = (c.svcT || 0) + dt; if (!c.leaving && c.svcT > 70) { deployCrew(c); return; } }
  const target = clear < 13 ? 0 : clear < 40 ? c.spd * (clear - 13) / 27 : c.spd * .85;
  c.v += clamp(target - c.v, -70 * dt, 22 * dt);
  if (c.v < 1) c.wait += dt; else c.wait = 0;
  if (people && c.wait > 1.5 && Math.random() < dt * .6) sfx.horn(c);
  // наезд в панике
  if (c.v > 12 && c.panic) near(x + tx * 9, y + ty * 9, 6, a => { if (a.state === "alive" && !a.hidden && Math.hypot(a.x - x, a.y - y) < 7) { a.vx = tx * c.v * .9; a.vy = ty * c.v * .9; a.vz = 9; a.z = Math.max(a.z, .1); a.hp -= c.v * 2.2; if (a.hp <= 0) kill(a, false, "car"); c.v *= .8; } });
  c.ct += c.v * dt * c.cdir;
  if (c.ct < 0 || c.ct > cv.len) {
    if (cv.closed) { c.ct = (c.ct + cv.len) % cv.len; }
    else {
      const e = curvePos(cv, c.ct < 0 ? 0 : cv.len), l = nearestLanePoint(e.x, e.y);
      if (l && Math.hypot((l.l.s.v ? l.l.c : l.along) - e.x, (l.l.s.v ? l.along : l.l.c) - e.y) < 40 && Math.random() < .8) { c.curve = null; placeOnLane(c, l.l, l.along); c.ang = Math.atan2(DY[c.dir], DX[c.dir]); c.plan = -1; c.planAt = null; return; }
      c.cdir = -c.cdir; c.ct = clamp(c.ct, 0, cv.len); c.v = 0;
    }
  }
  const q = curvePos(cv, c.ct), qx = q.tx * c.cdir, qy = q.ty * c.cdir;
  c.x = q.x - qy * lat; c.y = q.y + qx * lat;
  let want = Math.atan2(qy, qx), dd = want - c.ang; dd -= Math.round(dd / TAU) * TAU; c.ang += dd * Math.min(1, dt * 6);
  c.dir = curveDirOf(qx, qy);
}
// машина на осевой полосе у стыка сворачивает на изогнутую дорогу
function tryEnterCurve(c) {
  if (!junctions.length || c.goal || c.tank) return false;
  for (const j of junctions) {
    if (c.jAt === j) continue;
    if (Math.abs(j.x - c.x) > 9 || Math.abs(j.y - c.y) > 9) continue;
    c.jAt = j; if (Math.random() > .45) return false;
    placeOnCurve(c, j.cv, j.t === 0 ? 0 : j.cv.len, j.t === 0 ? 1 : -1); return true;
  }
  return false;
}
