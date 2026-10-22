/* ---------- изогнутые и диагональные дороги поверх осевой сетки: кольца, лучи, извилины ---------- */
let curves = [], junctions = [], clearedCells = new Set();
const urbanMask = new Uint8Array(GW * GH);
function buildUrbanMask() {
  urbanMask.fill(0);
  for (const b of blocks) { if (b.rural || ["field", "meadow", "forest", "bank", "hill", "bigpark"].includes(b.kind)) continue; for (let gy = Math.floor((b.y0 - 12) / CS); gy <= Math.floor((b.y1 + 12) / CS); gy++) for (let gx = Math.floor((b.x0 - 12) / CS); gx <= Math.floor((b.x1 + 12) / CS); gx++) if (gx >= 0 && gy >= 0 && gx < GW && gy < GH) urbanMask[gy * GW + gx] = 1; }
}
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
  buildings = buildings.filter(b => { if (!inCorridor(b.x0, b.y0, b.x1, b.y1) || isSpecial(b)) return true; fillCells(b.x0, b.y0, b.x1, b.y1, 2); for (let gy = Math.floor(b.y0 / CS); gy <= Math.floor((b.y1 - 1) / CS); gy++) for (let gx = Math.floor(b.x0 / CS); gx <= Math.floor((b.x1 - 1) / CS); gx++) clearedCells.add(gy * GW + gx); return false; });
  trees = trees.filter(t => { if (curveNearest(cv, t.x, t.y).d > R + 3) return true; fillCells(t.x - 3, t.y - 3, t.x + 3, t.y + 3, 2); return false; });
  lamps = lamps.filter(l => curveNearest(cv, l.x, l.y).d > R);
  fences = fences.filter(f => curveNearest(cv, (f[0] + f[2]) / 2, (f[1] + f[3]) / 2).d > R + 6 && curveNearest(cv, f[0], f[1]).d > R && curveNearest(cv, f[2], f[3]).d > R);
  fountains = fountains.filter(f => curveNearest(cv, f.x, f.y).d > R + f.r);
  for (const i of side) { const c = grid[i]; if (!urbanMask[i]) { if (c === 3 || c === 4) grid[i] = 2; continue; } if (c === 2 || c === 7 || c === 8 || c === 3 || c === 4) grid[i] = 1; }
  for (const i of road) grid[i] = 0;
  for (let t = 40; t < cv.len - 20; t += 64) { const p = curvePos(cv, t); for (const s of [-1, 1]) { const x = p.x + s * (-p.ty) * (cv.hw + 3), y = p.y + s * p.tx * (cv.hw + 3); if (x > 10 && y > 10 && x < W - 10 && y < H - 10 && cellAt(x, y) === 1 && urbanMask[Math.floor(y / CS) * GW + Math.floor(x / CS)]) lamps.push({ x, y, f: Math.abs(p.tx) > Math.abs(p.ty) ? (s < 0 ? 0 : 1) : (s < 0 ? 2 : 3) }); } }
}
// ближайшая точка на осевой улице (не краевой): концы открытых дорог притягиваются к ним, чтобы был стык
function nearestStreetPt(x, y, maxD) {
  let best = null, bd = maxD;
  for (const s of streets) { if (s.gone || s.edge) continue; const along = clamp(s.v ? y : x, s.a0 + 20, s.a1 - 20), px = s.v ? s.p : along, py = s.v ? along : s.p, d = Math.hypot(px - x, py - y); if (d < bd) { bd = d; best = [px, py]; } }
  return best;
}
function addCurve(pts, hw, closed) {
  pts = pts.filter(p => p[0] > 4 && p[1] > 4 && p[0] < W - 4 && p[1] < H - 4);
  if (pts.length < 2) return null;
  if (!closed) for (const k of [0, pts.length - 1]) { const q = nearestStreetPt(pts[k][0], pts[k][1], 200); if (q && Math.hypot(q[0] - pts[k][0], q[1] - pts[k][1]) > 6) { if (k === 0) pts.unshift(q); else pts.push(q); } }
  const cv = curveBuild(pts, hw, closed);
  if (cv.len < 60 || !curveClear(cv)) return null;
  rasterCurve(cv); curves.push(cv); return cv;
}
// стыки с осевыми улицами: концы дорог, с которых машины съезжают на обычную полосу и наоборот
// ближайшая точка любой полосы (по настоящему расстоянию, а не только поперёк)
function nearestLaneTo(x, y, maxD) {
  let best = null, bd = maxD;
  for (const l of lanes) { const along = clamp(l.s.v ? y : x, l.a0 + 20, l.a1 - 20), px = l.s.v ? l.c : along, py = l.s.v ? along : l.c, d = Math.hypot(px - x, py - y); if (d < bd && !blocked(px, py)) { bd = d; best = { l, along }; } }
  return best;
}
function buildJunctions() {
  junctions = [];
  for (const cv of curves) { if (cv.closed) continue; for (const t of [0, cv.len]) { const p = curvePos(cv, t); if (nearestLaneTo(p.x, p.y, 45)) junctions.push({ cv, t, x: p.x, y: p.y }); } }
}
function ringPts(cx, cy, r, n, wob) { const pts = []; for (let i = 0; i < n; i++) { const a = i / n * TAU, rr = r + rnd(-wob, wob); pts.push([cx + Math.cos(a) * rr, cy + Math.sin(a) * rr]); } return pts; }
function spokePts(cx, cy, a, r0, r1) { return [[cx + Math.cos(a) * r0, cy + Math.sin(a) * r0], [cx + Math.cos(a) * r1, cy + Math.sin(a) * r1]]; }
function windingPts(x0, y0, x1, y1, amp, waves) {
  const pts = [], n = 24, L = Math.hypot(x1 - x0, y1 - y0), ux = (x1 - x0) / L, uy = (y1 - y0) / L, ph = rnd(0, TAU);
  for (let i = 0; i <= n; i++) { const k = i / n, off = Math.sin(k * waves * TAU + ph) * amp * Math.sin(k * Math.PI); pts.push([x0 + ux * L * k - uy * off, y0 + uy * L * k + ux * off]); }
  return pts;
}
// дома вдоль кривой дороги: повёрнуты по касательной, стоят там, где снесли старую застройку
function buildAlongCurves() {
  for (const cv of curves) {
    for (let t = 14; t < cv.len - 14;) {
      const p = curvePos(cv, t), nx = -p.ty, ny = p.tx, lotW = rnd(14, 26), gap = rnd(3, 7);
      for (const side of [-1, 1]) {
        const cx0 = p.x + nx * side * (cv.hw + 10), cy0 = p.y + ny * side * (cv.hw + 10);
        const gi0 = Math.floor(cy0 / CS) * GW + Math.floor(cx0 / CS);
        if (cx0 < 20 || cy0 < 20 || cx0 > W - 20 || cy0 > H - 20 || !urbanMask[gi0]) continue;
        const dist = districtOf(cx0, cy0), floors = dist === 0 ? Math.floor(rnd(4, 9)) : dist === 1 ? Math.floor(rnd(2, 5)) : Math.floor(rnd(1, 3)), kind = floors <= 2 ? "house" : "apt";
        const depth = kind === "house" ? rnd(12, 18) : rnd(16, 24), off = cv.hw + 8 + depth / 2;
        const cx = p.x + nx * side * off, cy = p.y + ny * side * off;
        const hx = Math.abs(p.tx) * lotW / 2 + Math.abs(nx) * depth / 2, hy = Math.abs(p.ty) * lotW / 2 + Math.abs(ny) * depth / 2;
        const x0 = cx - hx, y0 = cy - hy, x1 = cx + hx, y1 = cy + hy;
        if (x0 < 12 || y0 < 12 || x1 > W - 12 || y1 > H - 12) continue;
        let ok = true, cleared = 0, total = 0;
        for (let gy = Math.floor(y0 / CS); gy <= Math.floor(y1 / CS) && ok; gy++) for (let gx = Math.floor(x0 / CS); gx <= Math.floor(x1 / CS); gx++) { const i = gy * GW + gx, c = grid[i]; total++; if (clearedCells.has(i)) cleared++; if (!(c === 1 || c === 2) || !urbanMask[i]) { ok = false; break; } }
        if (!ok || cleared < total * .35) continue;
        // не слишком близко к другой кривой дороге
        let nearRoad = false; for (const o of curves) if (o !== cv && curveNearest(o, cx, cy).d < o.hw + depth / 2 + 4) nearRoad = true; if (nearRoad) continue;
        const b = addBuilding({ x0, y0, x1, y1, kind, floors, style: kind === "house" ? 11 + Math.floor(Math.random() * 4) : Math.floor(Math.random() * 5), rot: Math.atan2(p.ty, p.tx), cx, cy, w: lotW, d: depth, ridge: "x" });
        b.doorPref = [p.x + nx * side * (cv.hw + 4), p.y + ny * side * (cv.hw + 4)];
        lamps = lamps.filter(l => l.x < x0 - 2 || l.x > x1 + 2 || l.y < y0 - 2 || l.y > y1 + 2);
      }
      t += lotW + gap;
    }
  }
}
function genCurves() {
  curves = []; junctions = []; clearedCells = new Set();
  const kind = L.curves; if (!kind) return;
  buildUrbanMask();
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
  buildAlongCurves();
}
/* ---------- машины на изогнутых дорогах ---------- */
function curveDirOf(tx, ty) { return ((Math.round(Math.atan2(ty, tx) / (Math.PI / 2)) % 4) + 4) % 4; }
function placeOnCurve(c, cv, t, cdir, blend) {
  c.curve = cv; c.ct = t; c.cdir = cdir;
  const p = curvePos(cv, t), tx = p.tx * cdir, ty = p.ty * cdir, lat = cv.hw * .5;
  const nx = p.x - ty * lat, ny = p.y + tx * lat;
  if (blend) { c.offx = c.x - nx; c.offy = c.y - ny; } else { c.offx = c.offy = 0; }
  c.x = nx; c.y = ny; c.ang = Math.atan2(ty, tx); c.dir = curveDirOf(tx, ty);
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
  carHitPeople(c, tx, ty, dt);
  c.ct += c.v * dt * c.cdir;
  if (c.ct < 0 || c.ct > cv.len) {
    if (cv.closed) { c.ct = (c.ct + cv.len) % cv.len; }
    else {
      const e = curvePos(cv, c.ct < 0 ? 0 : cv.len), l = nearestLaneTo(e.x, e.y, 45);
      if (l && Math.random() < .8) { const ox = c.x, oy = c.y; c.curve = null; placeOnLane(c, l.l, l.along); c.offx = ox - c.x; c.offy = oy - c.y; c.x = ox; c.y = oy; c.plan = -1; c.planAt = null; return; }
      c.cdir = -c.cdir; c.ct = clamp(c.ct, 0, cv.len); c.v = 0;
    }
  }
  const q = curvePos(cv, c.ct), qx = q.tx * c.cdir, qy = q.ty * c.cdir;
  if (c.offx || c.offy) { const k = Math.min(1, dt * 2.5); c.offx *= 1 - k; c.offy *= 1 - k; if (Math.abs(c.offx) + Math.abs(c.offy) < .05) c.offx = c.offy = 0; }
  c.x = q.x - qy * lat + c.offx; c.y = q.y + qx * lat + c.offy;
  let want = Math.atan2(qy, qx), dd = want - c.ang; dd -= Math.round(dd / TAU) * TAU; c.ang += dd * Math.min(1, dt * 6);
  c.dir = curveDirOf(qx, qy);
}
// машина на осевой полосе у стыка сворачивает на изогнутую дорогу
function tryEnterCurve(c) {
  if (!junctions.length || c.goal || c.tank) return false;
  for (const j of junctions) {
    if (c.jAt === j) continue;
    if (Math.abs(j.x - c.x) > 9 || Math.abs(j.y - c.y) > 9) continue;
    c.jAt = j; if (Math.random() > .6) return false;
    placeOnCurve(c, j.cv, j.t === 0 ? 0 : j.cv.len, j.t === 0 ? 1 : -1, true); return true;
  }
  return false;
}
