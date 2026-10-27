/* ---------- планировки: сначала сеть дорог, потом застройка по кварталам ---------- */
// каждая планировка строит граф: проспекты, улицы, кольца; пересечения становятся перекрёстками сами
const RHW = { hw: 18, av: 24, st: 16, ln: 11, ring: 12 };
let presets = [], zoneAt = () => null, plazas = [];
// часть обычных улиц — широкие, на две полосы в каждую сторону. Решение зависит от прямой, на которой лежит улица,
// поэтому улица, проложенная кусками между перекрёстками, не меняет ширину от квартала к кварталу
let WIDE_SEED = Math.random() * 1000;
function wideStreet(pts) {
  const a = pts[0], b = pts[pts.length - 1], ang = Math.atan2(b[1] - a[1], b[0] - a[0]), A = ((ang % Math.PI) + Math.PI) % Math.PI;
  const ka = Math.round(A / (Math.PI / 24)), d = Math.round((a[0] * Math.sin(A) - a[1] * Math.cos(A)) / 36);
  return Math.abs(Math.sin(ka * 12.9898 + d * 78.233 + WIDE_SEED) * 43758.5453) % 1 < .22;
}
function road(pts, kind, opt) {
  let hw = (opt && opt.hw) || RHW[kind];
  if (kind === "st" && !(opt && opt.hw) && pts.length >= 2 && wideStreet(pts)) hw = 23;
  return addRoad(pts, hw, kind, opt);
}
// замкнутая дорога из нескольких дуг: концы дуг сходятся в общих узлах
function loopRoad(pts, kind, opt) {
  const n = pts.length, parts = Math.max(4, Math.round(n / 10));
  for (let k = 0; k < parts; k++) { const i0 = Math.floor(k * n / parts), i1 = Math.floor((k + 1) * n / parts), seg = []; for (let i = i0; i <= i1; i++) seg.push(pts[i % n]); road(seg, kind, opt); }
}
function circlePts(cx, cy, r, step = 16, wob = 0, ph = 0, dir = 1, ry) {
  const n = Math.max(12, Math.ceil(TAU * r / step)), out = [];
  for (let i = 0; i < n; i++) { const a = dir * i / n * TAU, k = 1 + wob * (Math.sin(2 * a + ph) * .6 + Math.sin(5 * a + ph * 2) * .4); out.push([cx + Math.cos(a) * r * k, cy + Math.sin(a) * (ry || r) * k]); }
  return out;
}
// развязка: одностороннее кольцо против часовой стрелки (если смотреть сверху), в середине — островок с фонтаном
function roundabout(cx, cy, R) {
  loopRoad(circlePts(cx, cy, R, 9, 0, 0, -1), "ring", { oneway: true });
  rounds.push({ x: cx, y: cy, R }); presets.push({ x: cx, y: cy, kind: "island" });
}
// дорога наружу от точки на кольце/площади
function rayRoad(cx, cy, a, r0, r1, kind, wob = 0) {
  const ctrl = []; for (let r = r0; r < r1; r += 120) { const w = r > r0 + 60 ? rnd(-wob, wob) : 0; ctrl.push([cx + Math.cos(a) * r - Math.sin(a) * w, cy + Math.sin(a) * r + Math.cos(a) * w]); }
  ctrl.push([cx + Math.cos(a) * r1, cy + Math.sin(a) * r1]);
  for (const p of clipMap(wob ? spline(ctrl, 16) : ctrl)) road(p, kind);
}
// до края карты: луч от центра под углом a
function toEdgeR(cx, cy, a) { const c = Math.cos(a), s = Math.sin(a); const tx = c > 0 ? (W - cx) / c : c < 0 ? -cx / c : 1e9, ty = s > 0 ? (H - cy) / s : s < 0 ? -cy / s : 1e9; return Math.min(tx, ty); }
const urbanAt = (x, y, k = .48) => x > 24 && y > 24 && x < W - 24 && y < H - 24 && cityK(x, y) > k;

/* ---------- рост улиц: от проспектов ответвляются улицы, те ветвятся дальше, упираясь в соседние ---------- */
function firstHit(x0, y0, x1, y1) {
  let best = null; const L = Math.hypot(x1 - x0, y1 - y0);
  for (const e of RE) {
    if (e.dead) continue; const b = e.bb;
    if (Math.max(x0, x1) < b[0] - 1 || Math.min(x0, x1) > b[2] + 1 || Math.max(y0, y1) < b[1] - 1 || Math.min(y0, y1) > b[3] + 1) continue;
    for (let j = 1; j < e.pts.length; j++) {
      const p = e.pts[j - 1], q = e.pts[j], h = segX(x0, y0, x1, y1, p[0], p[1], q[0], q[1]); if (!h) continue;
      const d = h.u * L; if (d < 3) continue;
      if (!best || d < best.d) { const l = Math.hypot(q[0] - p[0], q[1] - p[1]) || 1; best = { d, e, x: h.x, y: h.y, tx: (q[0] - p[0]) / l, ty: (q[1] - p[1]) / l }; }
    }
  }
  return best;
}
// нет ли рядом чужой дороги (кроме тех, что проходят через начало или конец — там стык)
function roomFor(x0, y0, x1, y1, sep) {
  const L = Math.hypot(x1 - x0, y1 - y0), n = Math.max(2, Math.ceil(L / 10));
  const skip = new Set(); for (const e of RE) if (!e.dead && (edgeNearest(e, x0, y0).d < 3 || edgeNearest(e, x1, y1).d < 3)) skip.add(e);
  for (let i = 0; i <= n; i++) {
    const x = x0 + (x1 - x0) * i / n, y = y0 + (y1 - y0) * i / n;
    for (const e of RE) { if (e.dead || skip.has(e)) continue; const b = e.bb; if (x < b[0] - sep || x > b[2] + sep || y < b[1] - sep || y > b[3] + sep) continue; if (edgeNearest(e, x, y).d < sep) return false; }
  }
  return true;
}
function grow(seeds, o) {
  const Q = seeds.slice(), maxN = o.maxN || 1500, minS = Math.sin(o.minAng || .75); let made = 0, guard = 0;
  const angOk = (dx, dy, tx, ty) => Math.abs(dx * ty - dy * tx) > minS;
  while (Q.length && made < maxN && guard++ < maxN * 10) {
    const p = o.shuffle ? Q.splice(Math.floor(Math.random() * Math.min(Q.length, 6)), 1)[0] : Q.shift();
    const L = rnd(o.seg[0], o.seg[1]), dx = Math.cos(p.ang), dy = Math.sin(p.ang);
    if (!o.inside(p.x + dx * 14, p.y + dy * 14)) continue;
    let ex = p.x + dx * L, ey = p.y + dy * L, term = false;
    if (!o.inside(ex, ey)) { let a = 0, b = 1; for (let k = 0; k < 14; k++) { const m = (a + b) / 2; if (o.inside(p.x + dx * L * m, p.y + dy * L * m)) a = m; else b = m; } if (a * L < o.seg[0] * .5) continue; ex = p.x + dx * L * a; ey = p.y + dy * L * a; }
    let hit = firstHit(p.x, p.y, ex, ey);
    // впереди близко другая дорога — дотягиваем до неё, чтобы не оставлять щель
    if (!hit) { const far = firstHit(p.x, p.y, ex + dx * o.sep * 1.05, ey + dy * o.sep * 1.05); if (far && o.inside(far.x, far.y)) hit = far; }
    if (hit) { if (hit.d < o.seg[0] * .4 || !angOk(dx, dy, hit.tx, hit.ty)) continue; ex = hit.x; ey = hit.y; term = true; }
    else {
      const n = gNodeNear(ex, ey, o.snap || 26);
      if (n && Math.hypot(n.x - p.x, n.y - p.y) > o.seg[0] * .45) {
        const ddx = n.x - p.x, ddy = n.y - p.y, l = Math.hypot(ddx, ddy);
        const okA = n.ed.every(e => { const v = edgeDirFrom(e, n); return -(ddx / l * v[0] + ddy / l * v[1]) < .8; });
        const h2 = firstHit(p.x, p.y, n.x, n.y);
        if (okA && (!h2 || h2.d > l - 4)) { ex = n.x; ey = n.y; term = true; }
      }
    }
    const segL = Math.hypot(ex - p.x, ey - p.y); if (segL < o.seg[0] * .4) continue;
    if (!roomFor(p.x, p.y, ex, ey, o.sep)) continue;
    if (!term && gNodeNear(ex, ey, o.sep * .62)) continue;
    const r = road([[p.x, p.y], [ex, ey]], p.kind || o.kind, { hw: p.hw || o.hw }); if (!r || !r.edges.length) continue;
    made++;
    if (term) continue;
    const kind = p.kind || o.kind, hw = p.hw || o.hw;
    if (Math.random() < (o.contP ?? .9)) Q.push({ x: ex, y: ey, ang: p.ang + rnd(-o.drift, o.drift), kind, hw });
    for (const s of [-1, 1]) if (Math.random() < o.branchP) Q.push({ x: ex, y: ey, ang: p.ang + s * (Math.PI / 2 + rnd(-o.jit, o.jit)), kind: o.branchKind || kind, hw: o.branchHw || hw });
  }
  return made;
}
// ответвления от готовых дорог: точки вдоль рёбер, в обе стороны (со сдвигом — так получаются Т-перекрёстки)
function seedsAlong(edges, gap, o = {}) {
  const out = [];
  for (const e of edges) {
    if (e.dead) continue;
    for (const s of o.sides || [-1, 1]) {
      let t = 34 + gap * (o.stagger && s > 0 ? rnd(.55, .8) : rnd(.25, .5));
      for (; t < e.len - 34; t += gap * rnd(1 - (o.jit || .15), 1 + (o.jit || .15))) { const p = edgePos(e, t); out.push({ x: p.x, y: p.y, ang: Math.atan2(p.ty, p.tx) + s * (Math.PI / 2 + rnd(-(o.aj || 0), o.aj || 0)), kind: o.kind, hw: o.hw }); }
    }
  }
  return out;
}

/* ---------- деление кварталов: слишком большой квартал режется улицей поперёк длинной оси ---------- */
// грани плоского графа: обход «по правой руке» вокруг каждого квартала
function graphFaces() {
  const order = new Map();
  for (const n of RN) { if (n.dead) continue; order.set(n, n.ed.filter(e => !e.dead).map(e => { const d = edgeDirFrom(e, n); return { e, a: Math.atan2(d[1], d[0]), out: e.a === n }; }).sort((p, q) => p.a - q.a)); }
  const used = new Set(), faces = [];
  for (const e0 of RE) {
    if (e0.dead || e0.a === e0.b) continue;
    for (const f0 of [true, false]) {
      if (used.has(e0.id * 2 + (f0 ? 0 : 1))) continue;
      const poly = []; let e = e0, f = f0, ok = false;
      for (let g = 0; g < 4000; g++) {
        const key = e.id * 2 + (f ? 0 : 1); if (used.has(key)) { ok = e === e0 && f === f0; break; } used.add(key);
        const pts = f ? e.pts : e.pts.slice().reverse(); for (let i = 0; i < pts.length - 1; i++) poly.push(pts[i]);
        const v = f ? e.b : e.a, arr = order.get(v), idx = arr.findIndex(o => o.e === e && o.out === !f);
        const nx = arr[(idx - 1 + arr.length) % arr.length]; e = nx.e; f = nx.out;
      }
      if (!ok || poly.length < 3) continue;
      let A = 0, cx = 0, cy = 0; for (let i = 0; i < poly.length; i++) { const p = poly[i], q = poly[(i + 1) % poly.length], cr = p[0] * q[1] - q[0] * p[1]; A += cr; cx += (p[0] + q[0]) * cr; cy += (p[1] + q[1]) * cr; }
      A /= 2; if (Math.abs(A) < 1) continue;
      faces.push({ poly, area: A, cx: cx / (6 * A), cy: cy / (6 * A) });
    }
  }
  // внешняя граница каждого куска сети обходится в другую сторону — её отбрасываем
  const pos = faces.filter(f => f.area > 0).length, sign = pos >= faces.length / 2 ? 1 : -1;
  return faces.filter(f => f.area * sign > 0).map(f => ({ ...f, area: Math.abs(f.area) }));
}
function inPoly(poly, x, y) { let c = false; for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) { const a = poly[i], b = poly[j]; if ((a[1] > y) !== (b[1] > y) && x < (b[0] - a[0]) * (y - a[1]) / (b[1] - a[1]) + a[0]) c = !c; } return c; }
// главная ось многоугольника и его протяжённость вдоль неё и поперёк
function polyAxis(F) {
  let sxx = 0, syy = 0, sxy = 0, n = 0;
  for (let i = 0; i < F.poly.length; i++) { const p = F.poly[i], q = F.poly[(i + 1) % F.poly.length], L = Math.hypot(q[0] - p[0], q[1] - p[1]), k = Math.max(1, Math.ceil(L / 8)); for (let j = 0; j < k; j++) { const x = p[0] + (q[0] - p[0]) * j / k - F.cx, y = p[1] + (q[1] - p[1]) * j / k - F.cy; sxx += x * x; syy += y * y; sxy += x * y; n++; } }
  const a = .5 * Math.atan2(2 * sxy, sxx - syy), ux = Math.cos(a), uy = Math.sin(a);
  let u0 = 1e9, u1 = -1e9, v0 = 1e9, v1 = -1e9; for (const p of F.poly) { const u = (p[0] - F.cx) * ux + (p[1] - F.cy) * uy, v = -(p[0] - F.cx) * uy + (p[1] - F.cy) * ux; u0 = Math.min(u0, u); u1 = Math.max(u1, u); v0 = Math.min(v0, v); v1 = Math.max(v1, v); }
  return { ux, uy, major: u1 - u0, minor: v1 - v0, u0, u1 };
}
// прямая через точку: ближайшие пересечения с границей по обе стороны
function chordThrough(poly, x, y, dx, dy) {
  let tn = -1e9, tp = 1e9;
  for (let i = 0; i < poly.length; i++) {
    const p = poly[i], q = poly[(i + 1) % poly.length], ex = q[0] - p[0], ey = q[1] - p[1], den = dx * ey - dy * ex; if (Math.abs(den) < 1e-9) continue;
    const t = ((p[0] - x) * ey - (p[1] - y) * ex) / den, s = ((p[0] - x) * dy - (p[1] - y) * dx) / den;
    if (s < 0 || s > 1) continue;
    if (t > 0 && t < tp) tp = t; if (t < 0 && t > tn) tn = t;
  }
  return tn > -1e8 && tp < 1e8 ? [tn, tp] : null;
}
function subdivide(o) {
  for (let pass = 0; pass < 14; pass++) {
    let cuts = 0;
    for (const F of graphFaces()) {
      if (!o.inside(F.cx, F.cy) || F.area < o.area(F.cx, F.cy)) continue;
      const ax = polyAxis(F); if (ax.major < o.minW * 2) continue;
      for (let tr = 0; tr < (o.avoid ? 16 : 6); tr++) {
        // поперёк длинной оси, чуть в сторону от середины и чуть наискосок; если середину занимает озеро — пробуем и дальше от неё
        const shift = rnd(-1, 1) * (o.avoid && tr >= 6 ? .4 : .14) * ax.major + (ax.u0 + ax.u1) / 2, ang = rnd(-o.jit, o.jit);
        const px = F.cx + ax.ux * shift, py = F.cy + ax.uy * shift; if (!inPoly(F.poly, px, py)) continue;
        const dx = -ax.uy * Math.cos(ang) + ax.ux * Math.sin(ang), dy = ax.ux * Math.cos(ang) + ax.uy * Math.sin(ang);
        const ch = chordThrough(F.poly, px, py, dx, dy); if (!ch) continue;
        const L = ch[1] - ch[0]; if (L < 40) continue;
        const a = [px + dx * (ch[0] - 3), py + dy * (ch[0] - 3)], b = [px + dx * (ch[1] + 3), py + dy * (ch[1] + 3)];
        // обе части не уже minW: расстояние от разреза до краёв вдоль оси
        const s0 = shift - ax.u0, s1 = ax.u1 - shift; if (Math.min(s0, s1) < o.minW) continue;
        let pts = [a, b];
        if (o.curve) { const m = rnd(-o.curve, o.curve) * L; pts = spline([a, [(a[0] + b[0]) / 2 - dy * m, (a[1] + b[1]) / 2 + dx * m], b], 10); }
        if (!pts.every(p => o.inside(p[0], p[1]) || Math.hypot(p[0] - a[0], p[1] - a[1]) < 6 || Math.hypot(p[0] - b[0], p[1] - b[1]) < 6)) continue;
        if (o.avoid && pts.some(p => o.avoid(p[0], p[1]))) continue; // через озеро улицу не режем
        // с углом к краю не острее 35°
        if (!cutAngleOk(pts)) continue;
        const kind = typeof o.kind === "function" ? o.kind(L, F) : o.kind;
        if (road(pts, kind, { hw: o.hw, extra: o.extra })) { cuts++; break; }
      }
    }
    if (!cuts) break;
  }
}
function cutAngleOk(pts) {
  for (const [p, q] of [[pts[0], pts[1]], [pts[pts.length - 1], pts[pts.length - 2]]]) {
    const h = gEdgeNear(p[0], p[1], 8); if (!h) continue; const t = edgePos(h.e, h.t), dx = q[0] - p[0], dy = q[1] - p[1], l = Math.hypot(dx, dy) || 1;
    if (Math.abs(dx / l * t.ty - dy / l * t.tx) < .74) return false;
  }
  return true;
}
// тупики-разъезды в больших кварталах пригорода
function culDeSacs(o) {
  for (const F of graphFaces()) {
    if (!o.inside(F.cx, F.cy) || F.area < o.area) continue;
    const n = F.area > o.area * 2 ? 2 : 1;
    for (let k = 0; k < n; k++) {
      const i = Math.floor(Math.random() * F.poly.length), p = F.poly[i], q = F.poly[(i + 1) % F.poly.length], t = rnd(.3, .7), sx = p[0] + (q[0] - p[0]) * t, sy = p[1] + (q[1] - p[1]) * t;
      let dx = F.cx - sx, dy = F.cy - sy; const L0 = Math.hypot(dx, dy); if (L0 < 70) continue; dx /= L0; dy /= L0;
      const ch = chordThrough(F.poly, sx + dx * 2, sy + dy * 2, dx, dy); if (!ch) continue;
      const len = Math.min(ch[1] - 70, 220); if (len < 60) continue;
      const pts = spline([[sx - dx * 3, sy - dy * 3], [sx + dx * len * .5 - dy * rnd(-20, 20), sy + dy * len * .5 + dx * rnd(-20, 20)], [sx + dx * len, sy + dy * len]], 10);
      if (!cutAngleOk(pts)) continue;
      const r = road(pts, o.kind, { noSnap: true }); if (r && r.nodes.length) r.nodes[r.nodes.length - 1].cul = true;
    }
  }
}

/* ---------- сами планировки ---------- */
// объездная по краю города: замыкает кварталы между лучами
function cityEdgeLoop(cx, cy, k = .55, kind = "av", inset = 10) {
  const n = 80, rs = [], lim = [];
  for (let i = 0; i < n; i++) {
    const a = i / n * TAU, c = Math.cos(a), sn = Math.sin(a), rmax = toEdgeR(cx, cy, a) - 48;
    let r = 140; while (r < rmax && cityK(cx + c * r, cy + sn * r) > k) r += 8;
    rs.push(Math.min(r, rmax) - inset); lim.push(rmax);
  }
  for (let it = 0; it < 4; it++) { const t = rs.slice(); for (let i = 0; i < n; i++) rs[i] = Math.min(lim[i], (t[(i + n - 1) % n] + 2 * t[i] + t[(i + 1) % n]) / 4); }
  const pts = rs.map((r, i) => [cx + Math.cos(i / n * TAU) * r, cy + Math.sin(i / n * TAU) * r]);
  loopRoad(spline(pts.concat([pts[0], pts[1]]), 16).slice(0, -Math.ceil(Math.hypot(pts[1][0] - pts[0][0], pts[1][1] - pts[0][1]) / 16)), kind);
  return (x, y) => { const a = Math.atan2(y - cy, x - cx), i = ((Math.round(a / TAU * n) % n) + n) % n; return Math.hypot(x - cx, y - cy) < rs[i] - 6; };
}
// тип прорезанной улицы по её длине: длинные — проспекты, короткие — переулки
function cutKind(L) { return L > 520 ? "av" : L < 100 ? "ln" : "st"; }
const LAYOUT_GEN = {
  // прямоугольная сетка с проспектами; часть улиц обрывается Т-перекрёстками
  grid(big) {
    const xs = [], ys = [], sx = big ? [230, 300] : [170, 225], sy = big ? [190, 240] : [140, 180];
    const bx0 = Math.max(60, cityBlob.x - cityBlob.rx - 40), bx1 = Math.min(W - 60, cityBlob.x + cityBlob.rx + 40), by0 = Math.max(50, cityBlob.y - cityBlob.ry - 40), by1 = Math.min(H - 50, cityBlob.y + cityBlob.ry + 40);
    for (let x = bx0 + rnd(0, 80); x < bx1; x += rnd(sx[0], sx[1])) xs.push(x);
    for (let y = by0 + rnd(0, 70); y < by1; y += rnd(sy[0], sy[1])) ys.push(y);
    const avX = new Set([Math.floor(xs.length * .33), Math.floor(xs.length * .68)]), avY = new Set([Math.floor(ys.length * .3), Math.floor(ys.length * .7)]);
    // проспекты — через всю карту, за городом становятся шоссе
    xs.forEach((x, i) => { if (avX.has(i)) road([[x, 0], [x, H]], "av"); });
    ys.forEach((y, i) => { if (avY.has(i)) road([[0, y], [W, y]], "av"); });
    // улицы — отрезками между перекрёстками, только в городе
    const segs = [];
    xs.forEach((x, i) => { if (avX.has(i)) return; for (let j = 0; j < ys.length - 1; j++) segs.push([[x, ys[j]], [x, ys[j + 1]]]); });
    ys.forEach((y, j) => { if (avY.has(j)) return; for (let i = 0; i < xs.length - 1; i++) segs.push([[xs[i], y], [xs[i + 1], y]]); });
    for (const s of segs) { const mx = (s[0][0] + s[1][0]) / 2, my = (s[0][1] + s[1][1]) / 2; if (!urbanAt(mx, my, .44)) continue; if (Math.random() < .1 && urbanAt(mx, my, .7)) continue; road(s, "st"); }
    // концы сетки соединяются с краем карты парой загородных дорог
    for (const [x, y] of [[xs[0], ys[Math.floor(ys.length / 2)]], [xs[xs.length - 1], ys[Math.floor(ys.length / 2) - 1]]]) if (urbanAt(x, y, .3)) road([[x, y], [x < W / 2 ? 0 : W, y]], "st");
  },
  // плотная сетка, бродвей наискосок, центральный парк без улиц
  mega() {
    const xs = [], ys = [];
    const bx0 = Math.max(40, cityBlob.x - cityBlob.rx - 20), bx1 = Math.min(W - 40, cityBlob.x + cityBlob.rx + 20), by0 = Math.max(40, cityBlob.y - cityBlob.ry - 20), by1 = Math.min(H - 40, cityBlob.y + cityBlob.ry + 20);
    for (let x = bx0 + rnd(0, 50); x < bx1; x += rnd(128, 152)) xs.push(x);
    for (let y = by0 + rnd(0, 40); y < by1; y += rnd(98, 118)) ys.push(y);
    const ci = Math.floor(xs.length / 2) - 1, cj = Math.floor(ys.length / 2) - 1, park = { x0: xs[ci - 1], x1: xs[ci + 2], y0: ys[cj], y1: ys[cj + 2] };
    const inPark = (x, y) => x > park.x0 + 2 && x < park.x1 - 2 && y > park.y0 + 2 && y < park.y1 - 2;
    const avX = new Set([2, ci - 1, ci + 2, xs.length - 3]), avY = new Set([1, cj, cj + 2, ys.length - 2]);
    xs.forEach((x, i) => { if (avX.has(i)) { if (x > park.x0 + 2 && x < park.x1 - 2) { road([[x, 0], [x, park.y0]], "av"); road([[x, park.y1], [x, H]], "av"); } else road([[x, 0], [x, H]], "av"); } });
    ys.forEach((y, j) => { if (avY.has(j)) { if (y > park.y0 + 2 && y < park.y1 - 2) { road([[0, y], [park.x0, y]], "av"); road([[park.x1, y], [W, y]], "av"); } else road([[0, y], [W, y]], "av"); } });
    xs.forEach((x, i) => { if (avX.has(i)) return; for (let j = 0; j < ys.length - 1; j++) { const s = [[x, ys[j]], [x, ys[j + 1]]]; if (inPark(x, (ys[j] + ys[j + 1]) / 2) || !urbanAt(x, (ys[j] + ys[j + 1]) / 2, .3)) continue; road(s, "st"); } });
    ys.forEach((y, j) => { if (avY.has(j)) return; for (let i = 0; i < xs.length - 1; i++) { const s = [[xs[i], y], [xs[i + 1], y]]; if (inPark((xs[i] + xs[i + 1]) / 2, y) || !urbanAt((xs[i] + xs[i + 1]) / 2, y, .3)) continue; road(s, "st"); } });
    // бродвей: плавная диагональ в обход парка
    const side = Math.random() < .5 ? -1 : 1, by = side < 0 ? park.y0 - 70 : park.y1 + 70, mx = (park.x0 + park.x1) / 2;
    for (const p of clipMap(spline([[mx - 1000, by - side * 980], [park.x0 - 220, by - side * 200], [mx, by + side * 10], [park.x1 + 220, by + side * 200], [mx + 1000, by + side * 980]], 18))) road(p, "av", { extra: { boulevard: true } });
    presets.push({ x: (park.x0 + park.x1) / 2, y: (park.y0 + park.y1) / 2, kind: "bigpark" });
    bigPark = { ...park, cx: (park.x0 + park.x1) / 2, cy: (park.y0 + park.y1) / 2 };
  },
  // живой город: площадь-развязка, изогнутые радиальные проспекты, бульварное кольцо, улицы растут между ними
  organic() {
    const cx = cityBlob.x, cy = cityBlob.y, R0 = 52;
    roundabout(cx, cy, R0);
    const n = 5 + Math.floor(Math.random() * 2), a0 = rnd(0, TAU);
    for (let i = 0; i < n; i++) { const a = a0 + i / n * TAU + rnd(-.2, .2); rayRoad(cx, cy, a, R0, toEdgeR(cx, cy, a), "av", 50); }
    loopRoad(circlePts(cx, cy, rnd(250, 290), 16, .12, rnd(0, TAU), 1, rnd(210, 240)), "av", { extra: { boulevard: true } });
    if (L.lakes === "city") cityLake(cx, cy, 330, Math.min(560, CITY_W * .22)); // озеро-парк в стороне от центра; улицы ниже его обходят
    const inCity = cityEdgeLoop(cx, cy);
    subdivide({ inside: inCity, avoid: (x, y) => lakes.length > 0 && lakeD(x, y) < 26, area: (x, y) => [36000, 34000, 44000][districtOf(x, y)], minW: 118, jit: .2, curve: .07, kind: cutKind });
  },
  // кольцевой город: паутина из колец и лучей вокруг развязки
  ring() {
    const cx = W / 2 + rnd(-40, 40), cy = H / 2 + rnd(-30, 30), R0 = 54, off = rnd(0, Math.PI / 4);
    roundabout(cx, cy, R0);
    const rings = [[205, "st"], [335, "av"], [470, "st"], [610, "av"], [760, "st"]];
    for (const [r, k] of rings) { const pts = circlePts(cx, cy, r, 16, 0, 0, 1, r * .86); const ins = (x, y) => urbanAt(x, y, .36) && x > 30 && y > 30 && x < W - 30 && y < H - 30; if (pts.every(p => ins(p[0], p[1]))) loopRoad(pts, k, { extra: k === "av" ? { boulevard: true } : undefined }); else for (const part of clipBy(pts.concat([pts[0]]), ins)) road(part, k); }
    // восемь проспектов-лучей от развязки до края карты (по тем же «сплюснутым» направлениям, что и кольца)
    for (let i = 0; i < 8; i++) { const a = off + i / 8 * TAU, pts = [[cx + Math.cos(a) * R0, cy + Math.sin(a) * R0]]; for (let r = 120; r < Math.hypot(W, H) / 2 + 80; r += 40) pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r * .86]); for (const p of clipMap(pts)) road(p, "av"); }
    subdivide({ inside: (x, y) => urbanAt(x, y, .45), area: () => 30000, minW: 108, jit: .04, curve: 0, kind: cutKind });
  },
  // город звёзд: несколько площадей-развязок, прямые бульвары между ними и к краям, кварталы растут вдоль бульваров
  radial() {
    const fx = f => W / 2 + CITY_W * (f - .5), fy = f => H / 2 + CITY_H * (f - .5), stars = [[fx(rnd(.3, .38)), fy(rnd(.38, .5))], [fx(rnd(.62, .7)), fy(rnd(.3, .42))], [fx(rnd(.5, .6)), fy(rnd(.66, .74))]], R0 = 44;
    for (const [x, y] of stars) roundabout(x, y, R0);
    const rays = new Map(stars.map(s => [s, []]));
    // бульвары между звёздами
    for (let i = 0; i < stars.length; i++) for (let j = i + 1; j < stars.length; j++) {
      const [ax, ay] = stars[i], [bx, by] = stars[j], a = Math.atan2(by - ay, bx - ax), L = Math.hypot(bx - ax, by - ay);
      road([[ax + Math.cos(a) * R0, ay + Math.sin(a) * R0], [bx - Math.cos(a) * R0, by - Math.sin(a) * R0]], "av", { extra: { boulevard: true } });
      rays.get(stars[i]).push(a); rays.get(stars[j]).push(a + Math.PI);
    }
    // лучи от звёзд, не ближе 34° к уже имеющимся; луч кончается на первой дороге, если пересекает её слишком остро
    for (const s of stars) {
      const have = rays.get(s), want = 7;
      for (let k = 0; k < 40 && have.length < want; k++) {
        const a = rnd(0, TAU); if (have.some(b => Math.abs(Math.atan2(Math.sin(a - b), Math.cos(a - b))) < .6)) continue;
        const x0 = s[0] + Math.cos(a) * R0, y0 = s[1] + Math.sin(a) * R0, L = toEdgeR(s[0], s[1], a);
        let x1 = s[0] + Math.cos(a) * L, y1 = s[1] + Math.sin(a) * L;
        const h = firstHit(x0 + Math.cos(a) * 4, y0 + Math.sin(a) * 4, x1, y1);
        if (h && Math.abs(Math.cos(a) * h.ty - Math.sin(a) * h.tx) < .55) { if (h.d < 180) continue; x1 = h.x; y1 = h.y; }
        for (const p of clipMap([[x0, y0], [x1, y1]])) road(p, "av");
        have.push(a);
      }
    }
    const inCity = cityEdgeLoop(W / 2, H / 2);
    subdivide({ inside: inCity, area: (x, y) => [36000, 34000, 44000][districtOf(x, y)], minW: 118, jit: .08, curve: .02, kind: cutKind });
  },
  // сетка-«эшампле» с двумя диагональными проспектами через площадь-развязку
  diag() {
    const cx = W / 2 + rnd(-60, 60), cy = H / 2 + rnd(-40, 40), R0 = 58, step = rnd(150, 165);
    roundabout(cx, cy, R0);
    const xs = [], ys = []; for (let x = cx - step * 9; x < W; x += step) if (x > 40) xs.push(x); for (let y = cy - step * 6; y < H; y += step) if (y > 40) ys.push(y);
    const avX = new Set(xs.map((x, i) => i).filter(i => i % 4 === 1)), avY = new Set(ys.map((y, i) => i).filter(i => i % 4 === 2));
    const inRound = (x, y) => Math.hypot(x - cx, y - cy) < R0 + 70;
    const add = (s, k) => { const mx = (s[0][0] + s[1][0]) / 2, my = (s[0][1] + s[1][1]) / 2; if (inRound(mx, my) || inRound(s[0][0], s[0][1]) || inRound(s[1][0], s[1][1])) return; if (!urbanAt(mx, my, .4)) return; road(s, k); };
    xs.forEach((x, i) => { for (let j = 0; j < ys.length - 1; j++) add([[x, ys[j]], [x, ys[j + 1]]], avX.has(i) ? "av" : "st"); });
    ys.forEach((y, j) => { for (let i = 0; i < xs.length - 1; i++) add([[xs[i], y], [xs[i + 1], y]], avY.has(j) ? "av" : "st"); });
    // диагонали от развязки к краям карты, через всю сетку под 45°
    const a0 = Math.PI / 4 + rnd(-.06, .06);
    for (const a of [a0, a0 + Math.PI / 2, a0 + Math.PI, a0 + Math.PI * 1.5]) rayRoad(cx, cy, a, R0, toEdgeR(cx, cy, a), "av");
    // главная ось с запада на восток через развязку
    for (const s of [-1, 1]) road([[cx + s * R0, cy], [s < 0 ? 0 : W, cy]], "av");
  },
  // улицы вдоль склонов: длинные извилистые «горизонтали» и короткие подъёмы между ними
  winding() {
    const rows = [], k1 = rnd(380, 520), k2 = rnd(160, 230), ph = rnd(0, TAU), ph2 = rnd(0, TAU);
    for (let y = Math.max(110, cityBlob.y - cityBlob.ry * .92) + rnd(0, 50), i = 0; y < Math.min(H - 90, cityBlob.y + cityBlob.ry * .92); y += rnd(160, 190), i++) rows.push({ y, A: rnd(50, 80), i });
    const yAt = (r, x) => r.y + r.A * (Math.sin(x / k1 + ph + r.i * .25) * .75 + Math.sin(x / k2 + ph2) * .25);
    for (const r of rows) {
      const ctrl = []; for (let x = -10; x <= W + 10; x += 60) ctrl.push([x, yAt(r, x)]);
      const pts = spline(ctrl, 14), kind = r.i % 2 ? "st" : "av";
      for (const p of kind === "av" ? clipMap(pts) : clipBy(pts, (x, y) => urbanAt(x, y, .42))) road(p, kind);
    }
    // подъёмы между соседними горизонталями, вразбежку
    for (let i = 0; i < rows.length - 1; i++) {
      const a = rows[i], b = rows[i + 1];
      for (let x = Math.max(60, cityBlob.x - cityBlob.rx) + rnd(0, 160); x < Math.min(W - 40, cityBlob.x + cityBlob.rx); x += rnd(170, 250)) {
        const x2 = x + rnd(-50, 50), y1 = yAt(a, x), y2 = yAt(b, x2), mx = (x + x2) / 2 + rnd(-24, 24), my = (y1 + y2) / 2;
        if (!urbanAt(mx, my, .46)) continue;
        road(spline([[x, y1 - 6], [mx, my], [x2, y2 + 6]], 12), "st");
      }
    }
    // серпантин через весь город сверху вниз
    const cx = cityBlob.x, ctrl = []; for (let y = -10, s = 1; y <= H + 10; y += 150, s = -s) ctrl.push([cx + s * rnd(60, 110), y]);
    for (const p of clipMap(spline(ctrl, 14))) road(p, "av");
  },
  // пригород: шоссе, собирающие улицы и петли с тупиками-разворотами
  suburb() {
    const cx = cityBlob.x, cy = cityBlob.y;
    for (const p of clipMap(spline([[-20, cy + rnd(-200, 200)], [cx - 400, cy + rnd(-80, 80)], [cx, cy + rnd(-40, 40)], [cx + 400, cy + rnd(-80, 80)], [W + 20, cy + rnd(-200, 200)]], 16))) road(p, "av");
    for (const p of clipMap(spline([[cx + rnd(-300, 300), -20], [cx + rnd(-120, 120), cy - 300], [cx + rnd(-60, 60), cy], [cx + rnd(-120, 120), cy + 300], [cx + rnd(-300, 300), H + 20]], 16))) road(p, "av");
    const inCity = cityEdgeLoop(cx, cy, .55, "st");
    subdivide({ inside: inCity, area: () => 60000, minW: 135, jit: .3, curve: .14, kind: L => L > 420 ? "st" : "ln" });
    culDeSacs({ inside: inCity, area: 30000, kind: "ln" });
  },
  // исторический центр: собор на площади, кривые переулки внутри стены, бульварное кольцо и сетка новых кварталов снаружи
  old() {
    const cx = W / 2 + rnd(-40, 40), cy = H / 2 + rnd(-30, 30), RW = 300, RB = RW + 52, RS = 78;
    oldTown = { x: cx, y: cy, R: RW, RS, RB };
    loopRoad(circlePts(cx, cy, RS, 12, .05, rnd(0, TAU)), "ln", { extra: { sw: 5 } });
    loopRoad(circlePts(cx, cy, RB, 16), "av", { extra: { boulevard: true } });
    const n = 6, a0 = rnd(0, TAU);
    for (let i = 0; i < n; i++) {
      const a = a0 + i / n * TAU + rnd(-.12, .12), ctrl = [];
      for (let r = RS; r <= RB; r += 56) { const w = r > RS && r < RB - 20 ? rnd(-26, 26) : 0; ctrl.push([cx + Math.cos(a) * r - Math.sin(a) * w, cy + Math.sin(a) * r + Math.cos(a) * w]); }
      ctrl.push([cx + Math.cos(a) * RB, cy + Math.sin(a) * RB]);
      road(spline(ctrl, 12), "st", { hw: 13, extra: { sw: 5 } });
      rayRoad(cx, cy, a + rnd(-.05, .05), RB, toEdgeR(cx, cy, a), "av");
    }
    // кривые переулки
    const inOld = (x, y) => { const r = Math.hypot(x - cx, y - cy); return r > RS + 14 && r < RW - 26; };
    // стена пока не дорога: внутренние переулки упираются в кольцо переулка вдоль стены
    loopRoad(circlePts(cx, cy, RW - 24, 14, .04, rnd(0, TAU)), "ln", { extra: { sw: 5 } });
    subdivide({ inside: (x, y) => { const r = Math.hypot(x - cx, y - cy); return r > RS + 6 && r < RW - 18; }, area: () => 14000, minW: 66, jit: .35, curve: .14, kind: "ln", hw: 10, extra: { sw: 5 } });
    // за стеной: сетка, повёрнутая к ближайшему лучу
    const rot = a0 + rnd(-.1, .1), ca = Math.cos(rot), sa = Math.sin(rot), step = rnd(165, 190), stepY = rnd(140, 160);
    const inCity = cityEdgeLoop(cx, cy, .5, "st", 0), out = (x, y) => Math.hypot(x - cx, y - cy) > RB - 1 && inCity(x, y + 0) ;
    for (let u = -1600; u <= 1600; u += step) { const pts = []; for (let v = -1200; v <= 1200; v += 20) pts.push([cx + ca * u - sa * v, cy + sa * u + ca * v]); for (const p of clipBy(pts, out, 5)) if (plCum(p).pop() > 60) road(p, "st"); }
    for (let v = -1200; v <= 1200; v += stepY) { const pts = []; for (let u = -1600; u <= 1600; u += 20) pts.push([cx + ca * u - sa * v, cy + sa * u + ca * v]); for (const p of clipBy(pts, out, 5)) if (plCum(p).pop() > 60) road(p, "st"); }
    presets.push({ x: cx, y: cy, kind: "square" });
    zoneAt = (x, y) => { const r = Math.hypot(x - cx, y - cy); return r < RS ? "square" : r < RW - 4 ? "old" : r < RB - 6 ? "glacis" : null; };
  },
  // город-парк: большой парк с озером в середине, кольцо вокруг, лучи наружу, улицы растут между ними
  park() {
    const cx = cityBlob.x, cy = cityBlob.y, rx = rnd(300, 340), ry = rnd(190, 220);
    if (L.lakes === "park") addLake(cx, cy, rx * rnd(.34, .44), ry * rnd(.36, .46), true); // настоящее озеро посреди парка
    loopRoad(circlePts(cx, cy, rx + 26, 16, .03, rnd(0, TAU), 1, ry + 26), "av", { extra: { boulevard: true } });
    for (let i = 0; i < 7; i++) { const a = i / 7 * TAU + rnd(-.15, .15), r0 = Math.hypot(Math.cos(a) * (rx + 26), Math.sin(a) * (ry + 26)); rayRoad(cx, cy, Math.atan2(Math.sin(a) * (ry + 26), Math.cos(a) * (rx + 26)), r0 - 2, toEdgeR(cx, cy, a), "av", 30); }
    const inCity = cityEdgeLoop(cx, cy), outP = (x, y) => Math.hypot((x - cx) / (rx + 60), (y - cy) / (ry + 60)) > 1 && inCity(x, y);
    subdivide({ inside: outP, area: (x, y) => [36000, 34000, 44000][districtOf(x, y)], minW: 118, jit: .15, curve: .05, kind: cutKind });
    presets.push({ x: cx, y: cy, kind: "bigpark" });
    bigPark = { x0: cx - rx, x1: cx + rx, y0: cy - ry, y1: cy + ry, cx, cy, rx, ry };
    zoneAt = (x, y) => Math.hypot((x - cx) / (rx + 8), (y - cy) / (ry + 8)) < 1 ? "bigpark" : null;
  },
  industry() { LAYOUT_GEN.grid(true); const side = Math.random() < .5; zoneAt = (x, y) => (side ? x > W / 2 + CITY_W * .06 : x < W / 2 - CITY_W * .06) && cityK(x, y) > .45 ? "industry" : null; },
};

/* ---------- застройка ---------- */
const distRoad = new Uint8Array(GMAX), usedMask = new Uint8Array(GMAX), laneMask = new Uint8Array(GMAX);
function computeDistRoad() {
  distRoad.fill(255); const q = []; for (let i = 0; i < GW * GH; i++) if (roadMask[i]) { distRoad[i] = 0; q.push(i); }
  for (let h = 0; h < q.length; h++) { const i = q[h], d = distRoad[i]; if (d >= 12) continue; const x = i % GW; for (const j of [x > 0 ? i - 1 : -1, x < GW - 1 ? i + 1 : -1, i - GW, i + GW]) if (j >= 0 && j < GW * GH && distRoad[j] > d + 1) { distRoad[j] = d + 1; q.push(j); } }
}
// клетки, по которым проходят оси полос: туда нельзя ставить припаркованные машины и деревья
function computeLaneMask() {
  laneMask.fill(0);
  for (const l of RL) for (let s = 0; s <= l.e.len; s += 2) { const p = lanePos(l, s), gx = Math.floor(p.x / CS), gy = Math.floor(p.y / CS); if (gx >= 0 && gy >= 0 && gx < GW && gy < GH) laneMask[gy * GW + gx] = 1; }
}
function rotCells(cx, cy, w, d, rot) {
  const out = [], r = Math.hypot(w, d) / 2 + CS, c = Math.cos(rot), s = Math.sin(rot);
  for (let y = cy - r; y <= cy + r; y += CS / 2) for (let x = cx - r; x <= cx + r; x += CS / 2) { const dx = x - cx, dy = y - cy, lx = dx * c + dy * s, lz = -dx * s + dy * c; if (Math.abs(lx) <= w / 2 && Math.abs(lz) <= d / 2) { const gx = Math.floor(x / CS), gy = Math.floor(y / CS); if (gx >= 0 && gy >= 0 && gx < GW && gy < GH) out.push(gy * GW + gx); } }
  return out;
}
// свободно ли место под повёрнутый прямоугольник: внутри одного квартала, без дорог, домов и деревьев
function footFree(cx, cy, w, d, rot, rid, okCell) {
  const c = Math.cos(rot), s = Math.sin(rot);
  for (let v = -d / 2 - 1; v <= d / 2 + 1.01; v += 2.5) for (let u = -w / 2 - 1; u <= w / 2 + 1.01; u += 2.5) {
    const x = cx + u * c - v * s, y = cy + u * s + v * c;
    if (x < 10 || y < 10 || x > W - 10 || y > H - 10) return false;
    const gx = Math.floor(x / CS), gy = Math.floor(y / CS), i = gy * GW + gx;
    if (roadMask[i] || usedMask[i] || regionOf[i] !== rid) return false;
    const g = grid[i]; if (okCell ? !okCell(g) : (g === 3 || g === 4 || g === 5 || g === 9 || g === 10 || g === 6)) return false;
  }
  return true;
}
function kindAt(x, y) { const b = blockAt(x, y); if (!b || b.rural) return b ? "rural" : null; return zoneAt(x, y) || b.kind; }
const SPEC = {
  towers: () => ({ w: rnd(30, 50), d: [30, 52], set: rnd(6, 14), gap: rnd(14, 28), kind: "tower", floors: Math.round(rnd(12, 34)), style: 8 + Math.floor(Math.random() * 3) }),
  mid: () => ({ w: rnd(26, 46), d: [18, 26], set: rnd(2, 6), gap: rnd(6, 12), kind: "apt", floors: Math.round(rnd(6, 14)), style: Math.floor(Math.random() * 5) }),
  apt: (x, y) => { const r = Math.hypot((x - W / 2) / (CITY_W / 2), (y - H / 2) / (CITY_H / 2)); return { w: rnd(24, 52), d: [12, 22], set: rnd(1, 4), gap: rnd(4, 10), kind: "apt", floors: clamp(Math.round(rnd(3, 12) * (1.25 - r * .7)), 3, 12), style: Math.floor(Math.random() * 5) }; },
  suburb: () => ({ lot: rnd(34, 46), w: rnd(16, 23), d: [14, 20], set: rnd(9, 14), kind: "house", floors: Math.random() < .55 ? 1 : 2, style: 11 + Math.floor(Math.random() * 4), ridge: "x" }),
  old: () => ({ w: rnd(13, 24), d: [13, 30], set: 0, gap: rnd(0, .8), kind: "oldhouse", floors: 3 + Math.floor(Math.random() * 3), style: 22 + Math.floor(Math.random() * 4), ridge: "x" }),
  industry: () => ({ w: rnd(40, 70), d: [28, 50], set: rnd(10, 18), gap: rnd(18, 30), kind: "warehouse", floors: Math.random() < .5 ? 2 : 3, style: 15 }),
};
// дом вдоль ребра: фасадом к улице, повёрнут по хорде участка
function placeAlong(e, t, side, w, d0, d1, set, props, rid) {
  const p0 = edgePos(e, t), p1 = edgePos(e, t + w), ch = Math.hypot(p1.x - p0.x, p1.y - p0.y);
  if (ch < w * .9) return null; // слишком крутой изгиб для такого фасада
  const ux = (p1.x - p0.x) / ch, uy = (p1.y - p0.y) / ch, nx = -uy * side, ny = ux * side;
  // дорога может выгибаться к участку: отступаем от самой выпуклой точки
  let bulge = 0; for (let k = 1; k < 4; k++) { const q = edgePos(e, t + w * k / 4); bulge = Math.max(bulge, (q.x - p0.x) * nx + (q.y - p0.y) * ny); }
  const front = e.hw + e.sw + 2.5 + set + Math.max(0, bulge), mx = (p0.x + p1.x) / 2, my = (p0.y + p1.y) / 2;
  const rot = Math.atan2(uy, ux) + (side > 0 ? Math.PI : 0);
  if (rid === undefined) { const b = blockAt(mx + nx * (front + 3), my + ny * (front + 3)); if (!b) return null; rid = b.id; }
  for (let d = d1; d >= d0; d -= 3) {
    const cx = mx + nx * (front + d / 2), cy = my + ny * (front + d / 2);
    if (!footFree(cx, cy, w, d, rot, rid)) continue;
    const b = addRotBuilding(cx, cy, w, d, rot, props);
    b.doorPref = [mx + nx * (front - Math.max(2, set * .5)), my + ny * (front - Math.max(2, set * .5))];
    b.front = { x: mx + nx * front, y: my + ny * front, nx: -nx, ny: -ny, ux, uy, set, rid };
    return b;
  }
  return null;
}
// большие учреждения: у проспекта или улицы, с площадкой
const SPECIAL = {
  hospital: { w: 66, d: 46, set: 10, floors: 7, style: 5, ok: k => k === "apt" || k === "towers", d0: 1 },
  mall: { w: 84, d: 56, set: 12, floors: 3, style: 7, ok: k => k === "apt" || k === "towers", d0: 1, av: true },
  police: { w: 44, d: 32, set: 6, floors: 3, style: 6, ok: k => k === "apt" || k === "towers" || k === "suburb", d0: 1 },
  fire: { w: 46, d: 30, set: 2, floors: 2, style: 20, lot: [72, 56, 0], ok: k => k === "apt" || k === "suburb" || k === "industry", d0: 2 },
  power: { w: 50, d: 36, set: 10, floors: 3, style: 15, lot: [80, 64, 0], ok: k => k === "industry" || k === "suburb" || k === "apt", d0: 2 },
  water: { w: 40, d: 30, set: 10, floors: 2, style: 15, lot: [66, 54, 0], ok: k => k === "industry" || k === "suburb" || k === "apt", d0: 2 },
  radio: { w: 22, d: 22, set: 14, floors: 2, style: 6, lot: [52, 52, 2], ok: k => k === "suburb" || k === "apt" || k === "industry" || k === "park", d0: 2 },
};
function placeSpecial(kind) {
  const S = SPECIAL[kind], cand = RE.filter(e => !e.rural && e.kind !== "ring" && e.kind !== "ln" && (!S.av || e.kind === "av") && e.len > S.w + 60);
  for (let k = 0; k < 400 && cand.length; k++) {
    const e = pick(cand), side = Math.random() < .5 ? 1 : -1, t = rnd(e.ra + 20, Math.max(e.ra + 21, e.len - e.rb - S.w - 20));
    const p = edgePos(e, t + S.w / 2), nx = -p.ty * side, ny = p.tx * side, probe = [p.x + nx * (e.hw + SW + 6), p.y + ny * (e.hw + SW + 6)];
    const b = blockAt(probe[0], probe[1]); if (!b || b.rural) continue;
    const kk = kindAt(probe[0], probe[1]); if (!S.ok(kk, b) || b.d > S.d0 + (k > 250 ? 1 : 0)) continue;
    const lw = S.lot ? S.lot[0] : S.w, ld = S.lot ? S.lot[1] : S.d;
    // участок целиком, потом здание в его глубине
    const lot = placeAlong(e, t, side, lw, ld, ld, S.lot ? 2 : S.set, { kind: "_probe", floors: 1, style: 0 }, b.id);
    if (!lot) continue;
    buildings.pop(); fillRotRect(lot.cx, lot.cy, lot.w, lot.d, lot.rot, S.lot ? S.lot[2] : 1);
    for (const i of rotCells(lot.cx, lot.cy, lot.w + 2, lot.d + 2, lot.rot)) usedMask[i] = 1;
    let cx = lot.cx, cy = lot.cy;
    if (S.lot) { const back = (lot.d - S.d) / 2 - 4; cx += -lot.front.nx * back; cy += -lot.front.ny * back; }
    const bb = addRotBuilding(cx, cy, S.w, S.d, lot.rot, { kind, floors: S.floors, style: S.style });
    bb.front = lot.front; bb.lotRect = { cx: lot.cx, cy: lot.cy, w: lot.w, d: lot.d, rot: lot.rot };
    if (kind === "fire" || S.lot) b.lot = true;
    const fx = lot.front.x + lot.front.nx * 4, fy = lot.front.y + lot.front.ny * 4;
    bb.doorPref = [fx, fy]; special[kind] = { x: fx, y: fy, b: bb };
    return true;
  }
  return false;
}
// застройка вдоль всех улиц
function buildFrontage() {
  for (const e of RE) {
    if (e.rural || e.kind === "ring") continue;
    for (const side of [-1, 1]) {
      let t = (e.fa || 0) + rnd(0, 4), lastKind = null;
      const tEnd = e.len - (e.fb || 0);
      while (t < tEnd - 10) {
        const p = edgePos(e, t + 6), nx = -p.ty * side, ny = p.tx * side, qx = p.x + nx * (e.hw + e.sw + 5), qy = p.y + ny * (e.hw + e.sw + 5), k = kindAt(qx, qy);
        const S = SPEC[k === "towers" && Math.random() < .3 ? "mid" : k];
        if (!S) { t += 8; continue; }
        const s = S(qx, qy); // точка внутри квартала: по ней SPEC узнаёт характер района
        if (k === "suburb") {
          const lot = Math.min(s.lot, tEnd - t); if (lot < s.w + 8) break;
          const hb = placeAlong(e, t + (lot - s.w) / 2 + rnd(-2, 2), side, s.w, s.d[0], s.d[1], s.set, { kind: s.kind, floors: s.floors, style: s.style, ridge: s.ridge, shape: s.shape });
          if (hb) suburbLot(e, t, side, lot, hb);
          t += lot; continue;
        }
        const minW = k === "old" ? 10 : k === "towers" ? 24 : 16, w = Math.min(s.w, tEnd - t); if (w < minW) break;
        // не влезает — пробуем уже, у острых углов квартала часто помещается только узкий дом
        let b = null; for (let ww = w; ww >= minW && !b; ww -= 6) b = placeAlong(e, t, side, ww, s.d[0], s.d[1], s.set, { kind: s.kind, floors: s.floors, style: s.style, ridge: s.ridge, shape: s.shape });
        if (b) { t += b.w + s.gap; lastKind = k; } else t += 4;
      }
    }
  }
}
// участок частного дома: заборы по бокам и сзади, дерево во дворе
function suburbLot(e, t, side, lot, hb) {
  const f = hb.front, depth = f.set + hb.d + rnd(8, 16);
  const pa = edgePos(e, t), pb = edgePos(e, t + lot);
  const pts = [pa, pb].map(p => { const nx = -p.ty * side, ny = p.tx * side; return [p.x + nx * (e.hw + SW + 1), p.y + ny * (e.hw + SW + 1), nx, ny]; });
  const inLot = (x, y) => { const g = grid[Math.floor(y / CS) * GW + Math.floor(x / CS)]; return (g === 2 || g === 1) && regionOf[Math.floor(y / CS) * GW + Math.floor(x / CS)] === f.rid; };
  for (const [x, y, nx, ny] of pts) { const x1 = x + nx * depth, y1 = y + ny * depth; if (inLot(x1, y1) && inLot((x + x1) / 2, (y + y1) / 2)) fences.push([x + nx * 2, y + ny * 2, x1, y1]); }
  const [ax, ay, anx, any] = pts[0], [bx, by, bnx, bny] = pts[1];
  const bx0 = ax + anx * depth, by0 = ay + any * depth, bx1 = bx + bnx * depth, by1 = by + bny * depth;
  if (inLot(bx0, by0) && inLot(bx1, by1) && inLot((bx0 + bx1) / 2, (by0 + by1) / 2)) fences.push([bx0, by0, bx1, by1]);
  if (Math.random() < .6) { const k = rnd(-.4, .4), x = hb.cx + f.ux * hb.w * k + f.nx * (hb.d / 2 + f.set * .55), y = hb.cy + f.uy * hb.w * k + f.ny * (hb.d / 2 + f.set * .55); if (cellAt(x, y) === 2 && distRoad[Math.floor(y / CS) * GW + Math.floor(x / CS)] >= 1) addTree(x, y, rnd(5, 9), rnd(12, 22)); }
}
function addTree(x, y, r, h, extra) {
  const gx = Math.floor(x / CS), gy = Math.floor(y / CS); if (gx < 1 || gy < 1 || gx >= GW - 1 || gy >= GH - 1) return false;
  for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (grid[(gy + dy) * GW + gx + dx] === 3) return false;
  trees.push({ x, y, r, h, ...(extra || {}) }); fillCells(x - 2, y - 2, x + 2, y + 2, 4); return true;
}
// случайная клетка квартала
function blockCells(b) { if (!b.cells) { b.cells = []; for (let gy = Math.floor(b.y0 / CS); gy < Math.ceil(b.y1 / CS); gy++) for (let gx = Math.floor(b.x0 / CS); gx < Math.ceil(b.x1 / CS); gx++) if (gx >= 0 && gy >= 0 && gx < GW && gy < GH && regionOf[gy * GW + gx] === b.id) b.cells.push(gy * GW + gx); } return b.cells; }
function nearestEdgeAng(x, y) { const q = gEdgeNear(x, y, 400); if (!q) return 0; const p = edgePos(q.e, q.t); return Math.atan2(p.ty, p.tx); }
// дворы, парки, площади, стоянки, промзоны
function fillInteriors() {
  for (const b of blocks) {
    if (b.rural) continue;
    const cells = blockCells(b), k = b.kind;
    const randCell = (test) => { for (let i = 0; i < 30; i++) { const c = cells[Math.floor(Math.random() * cells.length)]; if (!test || test(c)) return c; } return -1; };
    const cxy = c => [(c % GW) * CS + rnd(1, 7), Math.floor(c / GW) * CS + rnd(1, 7)];
    if (k === "apt" || k === "old" || k === "suburb") {
      const n = cells.length * CS * CS / (k === "suburb" ? 1500 : k === "old" ? 4000 : 1300);
      for (let i = 0; i < n; i++) { const c = randCell(c => grid[c] === 2 && distRoad[c] >= 2); if (c < 0) break; const [x, y] = cxy(c); addTree(x, y, rnd(6, 11), rnd(14, 26)); }
    } else if (k === "towers") {
      for (let i = 0; i < cells.length / 50; i++) { const c = randCell(c => grid[c] === 7 && distRoad[c] >= 2); if (c < 0) break; const [x, y] = cxy(c); addTree(x, y, rnd(5, 8), rnd(14, 20)); }
    } else if (k === "plaza" || k === "island" || k === "square") {
      // фонтан посередине, деревья по краю
      const [x, y] = [b.cx, b.cy];
      if (k !== "square" && blockAt(x, y) === b && cells.length > 20) { const r = k === "island" ? Math.min(14, Math.sqrt(cells.length) * 2.2) : Math.min(13, Math.sqrt(cells.length) * 1.6); if (footFree(x, y, r * 2, r * 2, 0, b.id, g => g === 7 || g === 1 || g === 2)) { fountains.push({ x, y, r }); fillDisc(x, y, r - 2, r - 2, 3); } }
      if (k === "island") fillDisc(x, y, 26, 26, 2, g => g === 3);
      for (let i = 0; i < cells.length / 30; i++) { const c = randCell(c => distRoad[c] === 1); if (c < 0) break; const [tx, ty] = cxy(c); addTree(tx, ty, rnd(5, 8), rnd(14, 20)); }
    } else if (k === "park" || k === "bigpark" || k === "green" || k === "glacis" || k === "lake") {
      if ((k === "park" || k === "bigpark") && cells.length > 300 && !b.lake) parkPond(b);
      if (k === "park" || k === "bigpark") parkPaths(b);
      const n = cells.length * CS * CS / (k === "green" ? 1500 : k === "glacis" ? 900 : 1000);
      for (let i = 0; i < n; i++) { const c = randCell(c => grid[c] === 2 && (k === "glacis" || distRoad[c] >= 1)); if (c < 0) break; const [x, y] = cxy(c); addTree(x, y, rnd(7, 13), rnd(16, 32)); }
    } else if (k === "lot") {
      const ang = nearestEdgeAng(b.cx, b.cy), ca = Math.cos(ang), sa = Math.sin(ang), R = Math.hypot(b.x1 - b.x0, b.y1 - b.y0) / 2;
      for (let v = -R; v < R; v += 30) for (let u = -R; u < R; u += 11) {
        if (Math.random() > .7) continue;
        const x = b.cx + u * ca - v * sa, y = b.cy + u * sa + v * ca;
        if (!footFree(x, y, 8, 18, ang, b.id, g => g === 0)) continue;
        const cells2 = rotCells(x, y, 7, 16, ang); for (const i of cells2) grid[i] = 5;
        { const M = pickCarModel(true); cars.push({ x, y, ang: ang + Math.PI / 2 + (Math.random() < .5 ? 0 : Math.PI), model: M.k, len: M.len, col: pick(M.cols || CARC), wreck: false, boomT: 0, burnT: 0 }); }
      }
    } else if (k === "industry") {
      const ang = nearestEdgeAng(b.cx, b.cy);
      for (let i = 0; i < 8; i++) { const c = randCell(c => grid[c] === 0 && distRoad[c] >= 2); if (c < 0) break; const [x, y] = cxy(c); if (footFree(x, y, 24, 8, ang, b.id, g => g === 0)) addRotBuilding(x, y, 24, 8, ang, { kind: "container", floors: 1, style: 16 + Math.floor(Math.random() * 4) }); }
    }
  }
}
function parkPond(b) {
  for (let k = 0; k < 12; k++) {
    const rx = Math.sqrt(blockCells(b).length) * CS * rnd(.16, .24), ry = rx * rnd(.6, .9), x = b.cx + rnd(-30, 30), y = b.cy + rnd(-20, 20);
    let ok = true; for (let a = 0; a < TAU && ok; a += .3) { const px = x + Math.cos(a) * (rx + 12), py = y + Math.sin(a) * (ry + 12); if (blockAt(px, py) !== b || grid[Math.floor(py / CS) * GW + Math.floor(px / CS)] === 3) ok = false; }
    if (!ok) continue;
    const p = { x, y, rx, ry }; ponds.push(p); fillDisc(x, y, rx, ry, 9); b.pond = p; return;
  }
}
// дорожки через парк: от края к краю мимо середины
function parkPaths(b) {
  const edge = blockCells(b).filter(c => distRoad[c] === 1); if (edge.length < 4) return;
  b.paths = [];
  const n = b.kind === "bigpark" ? 6 : 2;
  for (let k = 0; k < n; k++) {
    const a = edge[Math.floor(Math.random() * edge.length)], c = edge[Math.floor(Math.random() * edge.length)];
    const ax = (a % GW) * CS + 4, ay = Math.floor(a / GW) * CS + 4, cx2 = (c % GW) * CS + 4, cy2 = Math.floor(c / GW) * CS + 4;
    if (Math.hypot(ax - cx2, ay - cy2) < 80) continue;
    const m = b.pond ? [b.pond.x + rnd(-1, 1) * (b.pond.rx + 30), b.pond.y + rnd(-1, 1) * (b.pond.ry + 30)] : [b.cx + rnd(-40, 40), b.cy + rnd(-40, 40)];
    const pts = []; for (let t = 0; t <= 1.001; t += .025) { const u = 1 - t, x = u * u * ax + 2 * u * t * m[0] + t * t * cx2, y = u * u * ay + 2 * u * t * m[1] + t * t * cy2; if ((b.pond && Math.hypot((x - b.pond.x) / (b.pond.rx + 7), (y - b.pond.y) / (b.pond.ry + 7)) < 1) || (b.lake && lakeD(x, y) < 12)) { if (pts.length > 1) b.paths.push(pts.splice(0)); else pts.length = 0; continue; } pts.push([x, y]); }
    if (pts.length > 1) b.paths.push(pts);
  }
  for (const path of b.paths) for (const [x, y] of path) fillDisc(x, y, 4, 4, 7, g => g === 9 || g === 3 || g === 4);
}
// фонари вдоль тротуаров, деревья посреди бульваров, машины у бордюра на проспектах
function streetFurniture() {
  for (const e of RE) {
    if (e.rural) continue;
    for (const side of [-1, 1]) {
      if (e.kind === "ring" && side < 0) continue;
      for (let t = (e.ra || 0) + 14 + rnd(0, 20); t < e.len - (e.rb || 0) - 10; t += rnd(54, 64)) {
        const p = edgePos(e, t), nx = -p.ty * side, ny = p.tx * side, x = p.x + nx * (e.hw + 2.5), y = p.y + ny * (e.hw + 2.5);
        if (cellAt(x, y) !== 1) continue;
        lamps.push({ x, y, a: Math.atan2(-ny, -nx), f: 0 });
      }
    }
    // гидранты: у бордюра, через каждые ~140 м, не рядом с фонарём
    if (e.hw >= 15 && e.kind !== "ring") for (let t = (e.ra || 0) + 46 + rnd(0, 30); t < e.len - (e.rb || 0) - 20; t += rnd(130, 170)) {
      const side = Math.random() < .5 ? 1 : -1, p = edgePos(e, t), nx = -p.ty * side, ny = p.tx * side, x = p.x + nx * (e.hw + 1.8), y = p.y + ny * (e.hw + 1.8);
      if (cellAt(x, y) !== 1 || lamps.some(l => Math.abs(l.x - x) < 6 && Math.abs(l.y - y) < 6)) continue;
      hydrants.push({ x, y, a: Math.atan2(p.ty, p.tx) });
    }
    if (e.boulevard && e.hw >= 22) {
      e.trees = true;
      for (let t = (e.ra || 0) + 18; t < e.len - (e.rb || 0) - 18; t += 22) {
        const p = edgePos(e, t), cs = []; for (const [dx, dy] of [[-2, -2], [2, -2], [-2, 2], [2, 2]]) { const gx = Math.floor((p.x + dx) / CS), gy = Math.floor((p.y + dy) / CS); cs.push(gy * GW + gx); }
        if (cs.some(i => laneMask[i] || roadMask[i] !== 1)) continue;
        trees.push({ x: p.x, y: p.y, r: rnd(5, 8), h: rnd(16, 24), median: true }); for (const i of cs) grid[i] = 4;
      }
    }
    // припаркованные у бордюра: только где полоса движения не задета
    if (e.hw >= 22 && e.kind !== "hw" && !e.trees) {
      for (const l of e.L) {
        if (!l) continue;
        for (let s = laneStart(l) + 16; s < laneEnd(l) - 16; s += 22) {
          if (Math.random() > .35) continue;
          const p = lanePos(l, s), lat = e.hw - 5 - l.off, x = p.x - p.ty * lat, y = p.y + p.tx * lat, ang = Math.atan2(p.ty, p.tx);
          const cs = rotCells(x, y, 17, 7, ang); if (cs.some(i => laneMask[i] || grid[i] !== 0)) continue;
          for (const i of cs) grid[i] = 5;
          { const M = pickCarModel(true); cars.push({ x, y, ang, model: M.k, len: M.len, col: pick(M.cols || CARC), wreck: false, boomT: 0, burnT: 0 }); }
        }
      }
    }
  }
}
// загород: поля полосами, луга, перелески; изредка ферма у дороги
let patches = [];
const patchOf = new Int16Array(GMAX);
function buildRural() {
  patches = []; patchOf.fill(-1);
  for (const b of blocks) {
    if (!b.rural) continue;
    const cells = blockCells(b), n = Math.max(1, Math.round(cells.length * CS * CS / (170 * 170))), seeds = [];
    for (let k = 0; k < n; k++) { const c = cells[Math.floor(Math.random() * cells.length)]; const r = Math.random(), far = 1 - b.city; seeds.push({ x: (c % GW) * CS, y: Math.floor(c / GW) * CS, id: patches.length, kind: r < .25 + far * .25 ? "forest" : r < .62 ? "field" : r < .74 ? "orchard" : "meadow", crop: Math.floor(Math.random() * 4), ang: nearestEdgeAng((c % GW) * CS, Math.floor(c / GW) * CS) + (Math.random() < .5 ? 0 : Math.PI / 2) }); patches.push(seeds[seeds.length - 1]); }
    for (const c of cells) { const x = (c % GW) * CS, y = Math.floor(c / GW) * CS; let best = seeds[0], bd = 1e18; for (const s of seeds) { const d = (s.x - x) ** 2 + (s.y - y) ** 2; if (d < bd) { bd = d; best = s; } } patchOf[c] = best.id; }
    for (const c of cells) {
      const s = patches[patchOf[c]], x = (c % GW) * CS + rnd(1, 7), y = Math.floor(c / GW) * CS + rnd(1, 7);
      if (s.kind === "forest" && Math.random() < .17 && distRoad[c] >= 1) addTree(x, y, rnd(7, 13), rnd(18, 32));
      else if (s.kind === "meadow" && Math.random() < .012 && distRoad[c] >= 1) addTree(x, y, rnd(6, 12), rnd(16, 28));
      else if (s.kind === "orchard" && (c % GW) % 3 === 1 && Math.floor(c / GW) % 3 === 1 && distRoad[c] >= 2) addTree((c % GW) * CS + 4, Math.floor(c / GW) * CS + 4, rnd(4.5, 6.5), rnd(9, 14)); // сад: деревья рядами
    }
    // ферма у дороги в поле, ранчо у луга (buildFarm в layout2.js)
    for (const s of seeds) {
      if (s.kind === "field" && Math.random() < .45) buildFarm(s, b, false);
      else if (s.kind === "meadow" && Math.random() < .45) buildFarm(s, b, true);
    }
  }
}
// стена старого города: кольцо с башнями, ворота там, где её пересекают дороги
function buildWalls() {
  if (!L.wall || !oldTown) return;
  const { x: cx, y: cy, R } = oldTown, segs = 72, gates = [];
  for (const e of RE) for (let t = 0; t < e.len; t += 2) { const p = edgePos(e, t), q = edgePos(e, Math.min(e.len, t + 2)); const r0 = Math.hypot(p.x - cx, p.y - cy) - R, r1 = Math.hypot(q.x - cx, q.y - cy) - R; if (r0 * r1 <= 0) gates.push({ a: Math.atan2(p.y - cy, p.x - cx), half: (e.hw + SW + 6) / R }); }
  for (let i = 0; i < segs; i++) {
    const a0 = i / segs * TAU, a1 = (i + 1) / segs * TAU, am = (a0 + a1) / 2;
    const gate = gates.some(g => { let d = am - g.a; d -= Math.round(d / TAU) * TAU; return Math.abs(d) < g.half + (a1 - a0) / 2; });
    const x0 = cx + Math.cos(a0) * R, y0 = cy + Math.sin(a0) * R, x1 = cx + Math.cos(a1) * R, y1 = cy + Math.sin(a1) * R;
    walls.push({ x0, y0, x1, y1, gate, tower: i % 9 === 0 && !gate });
    if (gate) continue;
    for (let t = 0; t <= 1; t += .25) { const x = x0 + (x1 - x0) * t, y = y0 + (y1 - y0) * t, gx = Math.floor(x / CS), gy = Math.floor(y / CS), j = gy * GW + gx; if (!roadMask[j]) { grid[j] = 3; usedMask[j] = 1; } }
  }
}
// классификация кварталов и первичная заливка клеток
function classifyBlocks() {
  for (const p of presets) { const b = blockAt(p.x, p.y); if (b) b.kind = p.kind; }
  for (const b of blocks) {
    if (b.kind) continue;
    const z = zoneAt(b.cx, b.cy);
    if (b.city < .45 && z !== "old" && z !== "square" && z !== "glacis") { b.rural = true; b.kind = "rural"; continue; }
    // огромный кусок без улиц на краю города — это уже не квартал, а поля
    if (b.n > 2200 && !z) { b.rural = true; b.kind = "rural"; continue; }
    if (z) { b.kind = z; continue; }
    if (b.n < 14) { b.kind = "green"; continue; }
    if (b.n < 40) { b.kind = Math.random() < .5 ? "green" : "plaza"; continue; }
    const r = Math.random(), ind = L.industry || 0;
    const small = b.n < 420, mid = b.n < 900;
    b.kind = b.d === 0 ? (r < .07 && small ? "plaza" : r < .13 && mid ? "park" : r < .17 && small ? "lot" : "towers")
      : b.d === 1 ? (r < ind ? "industry" : r < ind + .09 && mid ? "park" : r < ind + .13 && small ? "lot" : r < ind + .16 && small ? "plaza" : "apt")
        : (r < .1 && mid ? "park" : r < .1 + ind * .5 ? "industry" : "suburb");
  }
  assignDistricts();
  // клетки: тротуарная плитка у фасадов, газоны во дворах, асфальт стоянок и гаражей
  for (let i = 0; i < GW * GH; i++) {
    const r = regionOf[i]; if (r < 0) continue;
    const b = blocks[r], x = (i % GW) * CS + 4, y = Math.floor(i / GW) * CS + 4, k = b.rural ? "rural" : zoneAt(x, y) || b.kind;
    grid[i] = k === "towers" || k === "plaza" || k === "island" || k === "square" || k === "old" ? 7 : k === "apt" ? (distRoad[i] <= 2 ? 1 : 2) : k === "industry" || k === "lot" || k === "garages" ? 0 : 2;
    if (k === "industry" || k === "lot" || k === "garages") b.lot = true;
  }
  markWater();
}
// всё вместе: сеть уже построена
function fillCity() {
  computeDistRoad(); computeLaneMask(); usedMask.fill(0);
  classifyBlocks();
  buildWalls();
  for (const k of ["hospital", "police", "mall", "fire", "power", "water", "radio"]) if (!placeSpecial(k)) placeSpecialFallback(k);
  placeLandmarks(true);
  placeDistrictBuildings();
  buildFrontage();
  placeLandmarks(false);
  if (oldTown) { addRotBuilding(oldTown.x, oldTown.y - 6, 44, 70, rnd(-.3, .3), { kind: "cathedral", floors: 4, style: 21 }); const fx = oldTown.x, fy = oldTown.y + 52; fountains.push({ x: fx, y: fy, r: 9 }); fillDisc(fx, fy, 7, 7, 3); }
  furnishLakes(); fillInteriors(); streetFurniture(); placeProps(); buildRural(); buildOutskirts(); buildMountainVillage();
}
// достопримечательности: храм, вокзал, школа, заправки, водонапорная башня — у улиц со своим участком;
// телебашня, стадион, колесо обозрения и стела с вечным огнём — внутри кварталов; каждой по одной, если нашлось место
Object.assign(SPECIAL, {
  church: { w: 26, d: 40, set: 10, floors: 2, style: 27, lot: [50, 62, 7], ok: k => k === "apt" || k === "old" || k === "suburb", d0: 2 },
  station: { w: 80, d: 28, set: 12, floors: 2, style: 22, lot: [104, 56, 7], ok: k => k === "apt" || k === "towers", d0: 1, av: true },
  school: { w: 64, d: 22, set: 8, floors: 3, style: 3, lot: [96, 96, 2], ok: k => k === "apt" || k === "suburb", d0: 2 },
  gas: { w: 18, d: 12, set: 34, floors: 1, style: 7, lot: [60, 56, 0], ok: k => k === "apt" || k === "suburb" || k === "industry", d0: 2 },
  wtower: { w: 14, d: 14, set: 18, floors: 3, style: 1, lot: [38, 38, 2], ok: k => k === "suburb" || k === "industry", d0: 2 },
});
function placeLandmarks(street) {
  if (street) {
    for (const k of ["church", "station", "school", "gas", "gas", "wtower"]) placeSpecial(k);
    // школьный стадион перед зданием: беговая дорожка и поле нарисованы на земле, вокруг сетка
    const sc = special.school && special.school.b;
    if (sc && sc.lotRect) {
      const L = sc.lotRect, f = sc.front, pd = L.d - SPECIAL.school.d - 18, pw = L.w - 16, k = SPECIAL.school.d / 2 + 6 + pd / 2;
      const px = sc.cx + f.nx * k, py = sc.cy + f.ny * k; sc.pitch = { x: px, y: py, w: pw, d: pd, rot: L.rot };
      for (const i of rotCells(px, py, pw, pd, L.rot)) if (grid[i] === 2) grid[i] = 7; // на поле не сажать деревья
      const c = Math.cos(L.rot), s = Math.sin(L.rot), P = (u, v) => [px + u * c - v * s, py + u * s + v * c];
      for (const [a, b2] of [[[-1, -1], [1, -1]], [[1, -1], [1, 1]], [[1, 1], [-1, 1]], [[-1, 1], [-1, -1]]]) { const [x0, y0] = P(a[0] * pw / 2, a[1] * pd / 2), [x1, y1] = P(b2[0] * pw / 2, b2[1] * pd / 2); fences.push([x0, y0, x1, y1]); }
    }
    return;
  }
  const inner = (kind, w, d, floors, style, pred) => {
    const cands = blocks.filter(b => !b.rural && pred(b)).sort(() => Math.random() - .5);
    for (const b of cands) for (let k = 0; k < 30; k++) {
      const x = b.cx + rnd(-1, 1) * (b.x1 - b.x0) * .22, y = b.cy + rnd(-1, 1) * (b.y1 - b.y0) * .22, rot = nearestEdgeAng(x, y);
      if (!footFree(x, y, w + 12, d + 12, rot, b.id)) continue;
      const bb = addRotBuilding(x, y, w, d, rot, { kind, floors, style });
      for (const i of rotCells(x, y, w + 8, d + 8, rot)) usedMask[i] = 1;
      return bb;
    }
    return null;
  };
  inner("stadium", 150, 104, 2, 3, b => b.kind === "park" || b.kind === "bigpark" || b.kind === "lot" || b.kind === "suburb" || b.kind === "apt");
  inner("tvtower", 14, 14, 16, 3, b => (b.kind === "park" || b.kind === "bigpark" || b.kind === "green" || b.kind === "apt") && b.d <= 1);
  inner("ferris", 36, 12, 1, 3, b => b.kind === "park" || b.kind === "bigpark");
  inner("monument", 12, 12, 3, 21, b => b.kind === "plaza" && b.n > 40);
}
// уличные мелочи: остановки у бордюра, ларьки у перекрёстков, щиты вдоль трасс на окраине, скамейки у дорожек, детские площадки во дворах;
// угол a — куда смотрит лицевая сторона; ларьки, щиты и горки занимают клетки, остальное проходимо
function placeProps() {
  const near = (arr, x, y, r) => arr.some(o => Math.abs(o.x - x) < r && Math.abs(o.y - y) < r);
  const clear = (x, y, r) => !near(lamps, x, y, r) && !near(hydrants, x, y, r) && !near(props, x, y, r * 1.5);
  const cellI = (x, y) => Math.floor(y / CS) * GW + Math.floor(x / CS);
  for (const e of RE) {
    if (e.rural || e.kind === "ring") continue;
    const sw = e.sw || SW;
    if (e.hw >= 15 && e.kind !== "ln") for (let t = (e.ra || 0) + 40 + rnd(0, 60); t < e.len - (e.rb || 0) - 48; t += rnd(240, 320)) {
      const side = Math.random() < .5 ? 1 : -1, p = edgePos(e, t), nx = -p.ty * side, ny = p.tx * side, off = e.hw + Math.min(sw, 8) * .55, x = p.x + nx * off, y = p.y + ny * off;
      if (cellAt(x, y) !== 1 || !clear(x, y, 9)) continue;
      props.push({ k: "stop", x, y, a: Math.atan2(-ny, -nx), e: e.id, t, side }); // ребро, положение и сторона — для маршрутов автобусов (sim20.js)
    }
    for (const end of [0, 1]) {
      if (Math.random() > .25) continue;
      const side = Math.random() < .5 ? 1 : -1, t = end ? e.len - (e.rb || 0) - 16 : (e.ra || 0) + 16; if (t < 12 || t > e.len - 12) continue;
      const p = edgePos(e, t), nx = -p.ty * side, ny = p.tx * side, off = e.hw + sw + 3.5, x = p.x + nx * off, y = p.y + ny * off, k = kindAt(x, y);
      if (!(k === "apt" || k === "towers" || k === "old" || k === "plaza")) continue;
      const cs = rotCells(x, y, 7, 5, Math.atan2(p.ty, p.tx)); if (!cs.length || cs.some(i => grid[i] === 3 || grid[i] === 4 || grid[i] === 5 || grid[i] === 9 || roadMask[i] === 1 || usedMask[i])) continue;
      if (!clear(x, y, 8)) continue;
      for (const i of cs) { grid[i] = 4; usedMask[i] = 1; }
      props.push({ k: "kiosk", x, y, a: Math.atan2(-ny, -nx), v: Math.floor(Math.random() * 4) });
    }
    if ((e.kind === "hw" || e.kind === "av") && e.len > 140) for (let t = (e.ra || 0) + 50; t < e.len - (e.rb || 0) - 50; t += rnd(300, 420)) {
      const side = Math.random() < .5 ? 1 : -1, p = edgePos(e, t), nx = -p.ty * side, ny = p.tx * side, off = e.hw + sw + 7, x = p.x + nx * off, y = p.y + ny * off, k = kindAt(x, y);
      if (!(k === "suburb" || k === "industry" || k === "park" || k === "green" || k === "lot")) continue;
      const legs = [-5, 5].map(u => cellI(x + p.tx * u, y + p.ty * u)); if (legs.some(i => grid[i] !== 2 && grid[i] !== 0 && grid[i] !== 7) || !clear(x, y, 14)) continue;
      for (const i of legs) grid[i] = 4;
      props.push({ k: "board", x, y, a: Math.atan2(-ny, -nx), v: Math.floor(Math.random() * 8) });
    }
  }
  for (const b of blocks) {
    if (b.rural) continue;
    if (b.paths) for (const path of b.paths) for (let i = 5; i < path.length - 5; i += 6) {
      if (Math.random() < .35) continue;
      const [x, y] = path[i], [x2, y2] = path[i + 1], pa = Math.atan2(y2 - y, x2 - x), s = Math.random() < .5 ? 1 : -1, px = -Math.sin(pa) * s, py = Math.cos(pa) * s, bx = x + px * 5.5, by = y + py * 5.5, g = grid[cellI(bx, by)];
      if ((g === 2 || g === 7) && !near(trees, bx, by, 4) && !near(props, bx, by, 4)) props.push({ k: "bench", x: bx, y: by, a: Math.atan2(-py, -px) });
    }
    if ((b.kind === "plaza" || b.kind === "square") && b.n > 40) for (let k = 0; k < 6; k++) {
      const a = k / 6 * TAU + rnd(-.2, .2), r = Math.sqrt(b.n) * CS * .28, x = b.cx + Math.cos(a) * r, y = b.cy + Math.sin(a) * r, g = grid[cellI(x, y)];
      if ((g === 7 || g === 2) && blockAt(x, y) === b && !near(props, x, y, 5)) props.push({ k: "bench", x, y, a: a + Math.PI });
    }
    if (b.kind === "apt" && b.n > 260) for (let k = 0; k < 20; k++) {
      const x = b.cx + rnd(-1, 1) * (b.x1 - b.x0) * .2, y = b.cy + rnd(-1, 1) * (b.y1 - b.y0) * .2, rot = rnd(0, TAU);
      if (!footFree(x, y, 26, 20, rot, b.id, g => g === 2)) continue;
      for (const i of rotCells(x, y, 26, 20, rot)) usedMask[i] = 1;
      const c = Math.cos(rot), s = Math.sin(rot);
      for (const [u, v] of [[-7, -3], [7, -3]]) { const i = cellI(x + u * c - v * s, y + u * s + v * c); if (grid[i] === 2) grid[i] = 4; }
      props.push({ k: "play", x, y, a: rot, v: Math.floor(Math.random() * 3) });
      break;
    }
  }
}
// ---------- пригороды: посты ДПС на въездах, посёлки вдоль трасс, дачи, военная часть, заправки на трассах ----------
// entries — въезды в город: где загородная трасса входит в городскую сеть; tx, ty — направление из города наружу.
// По ним штаб ставит рубеж обороны, к ним идут беженцы, на них внешнее оцепление закрывает город
let entries = [];
function buildOutskirts() {
  entries = [];
  const urbanNode = n => n.ed.some(e => !e.rural);
  for (const e of RE) {
    if (!e.rural || e.len < 80) continue;
    const atA = urbanNode(e.a), atB = urbanNode(e.b); if (atA === atB) continue;
    const t = atA ? Math.min(e.len * .4, (e.ra || 0) + 40) : Math.max(e.len * .6, e.len - (e.rb || 0) - 40), p = edgePos(e, t), dir = atA ? 1 : -1;
    if (entries.some(o => Math.hypot(o.x - p.x, o.y - p.y) < 160)) continue;
    entries.push({ e: e.id, t, dir, x: p.x, y: p.y, tx: p.tx * dir, ty: p.ty * dir, hw: e.hw });
  }
  // пост ДПС: будка и машина на обочине справа по ходу из города
  for (const en of entries) {
    const nx = -en.ty, ny = en.tx, off = en.hw + 14, x = en.x + nx * off, y = en.y + ny * off;
    if (cellAt(x, y) === 3) continue;
    props.push({ k: "dps", x, y, a: Math.atan2(-ny, -nx) });
    const cx = en.x + nx * (en.hw + 5) + en.tx * 14, cy = en.y + ny * (en.hw + 5) + en.ty * 14;
    if (cellAt(cx, cy) !== 3) cars.push({ x: cx, y: cy, ang: Math.atan2(en.ty, en.tx), model: "police", len: 1, col: "#e9e9ee", dps: true, wreck: false, boomT: 0, burnT: 0 });
  }
  const ruralEdges = RE.filter(e => e.rural && e.len > 260 && e.kind !== "ring");
  // воинская часть у одной из трасс недалеко от города: казармы, ангар, штаб, вертолётная площадка, грузовики; армия выезжает отсюда
  for (let k = 0; k < 40 && !special.base; k++) {
    const en = pick(entries); if (!en) break;
    const e = RE.find(x => x.id === en.e); if (!e) continue;
    const dt = rnd(140, 360) * (en.t < e.len / 2 ? 1 : -1), t = clamp(en.t + dt, 40, e.len - 40), p = edgePos(e, t), side = Math.random() < .5 ? 1 : -1, nx = -p.ty * side, ny = p.tx * side;
    const dist = e.hw + rnd(100, 180), cx = p.x + nx * dist, cy = p.y + ny * dist, b = blockAt(cx, cy); if (!b || !b.rural) continue;
    const ang = Math.atan2(p.ty, p.tx), cells = rotCells(cx, cy, 250, 180, ang);
    if (!cells.length || cells.some(i => roadMask[i] || usedMask[i] || regionOf[i] !== b.id || grid[i] === 3 || grid[i] === 9 || grid[i] === 10)) continue;
    // деревья на территории части вырубаются
    const inside = new Set(cells); trees = trees.filter(tr => !inside.has(Math.floor(tr.y / CS) * GW + Math.floor(tr.x / CS)));
    const ca = Math.cos(ang), sa = Math.sin(ang), at = (u, v) => [cx + ca * u + nx * v, cy + sa * u + ny * v];
    for (const i of cells) { usedMask[i] = 1; if (grid[i] === 2 || grid[i] === 4) grid[i] = 7; } // плац и площадки — бетон
    const put = (u, v, w, d, props2) => { const [x, y] = at(u, v); return addRotBuilding(x, y, w, d, ang, props2); };
    put(-70, 40, 64, 18, { kind: "barracks", floors: 3, style: 28 }); put(-70, -10, 64, 18, { kind: "barracks", floors: 3, style: 28 });
    put(50, 30, 60, 38, { kind: "hangar", floors: 2, style: 15 });
    const hq = put(-10, -60, 38, 20, { kind: "basehq", floors: 2, style: 28 });
    const [hx, hy] = at(60, -50); props.push({ k: "helipad", x: hx, y: hy, a: ang });
    for (let i = 0; i < 4; i++) { const [x, y] = at(-20 + i * 14, 10); cars.push({ x, y, ang: ang + Math.PI / 2, model: "army", len: 1.45, col: "#4d5634", wreck: false, boomT: 0, burnT: 0 }); for (const i2 of rotCells(x, y, 26, 8, ang + Math.PI / 2)) grid[i2] = 5; }
    // забор по периметру; ворота — в стороне, обращённой к трассе (v < 0)
    fences.push([...at(-120, 85), ...at(120, 85)], [...at(-120, -85), ...at(-120, 85)], [...at(120, -85), ...at(120, 85)], [...at(-120, -85), ...at(-20, -85)], [...at(20, -85), ...at(120, -85)]);
    const [gx, gy] = at(0, -85 - 12);
    special.base = { x: gx, y: gy, b: hq };
  }
  const farFromCity = (x, y) => cityK(x, y) < .2;
  // посёлок: частные дома с участками по обе стороны трассы, вдали от города
  const villages = ruralEdges.slice().sort(() => Math.random() - .5).slice(0, 2 + Math.floor(Math.random() * 2));
  for (const e of villages) {
    let t0 = -1; for (let t = 80; t < e.len - 200; t += 30) { const p = edgePos(e, t); if (farFromCity(p.x, p.y)) { t0 = t; break; } }
    if (t0 < 0) continue;
    const t1 = Math.min(e.len - 60, t0 + rnd(220, 340)); let n = 0;
    for (const side of [-1, 1]) for (let t = t0; t < t1; t += rnd(38, 46)) {
      const w = rnd(15, 21), hb = placeAlong(e, t, side, w, 14, 19, rnd(9, 14), { kind: "house", floors: Math.random() < .7 ? 1 : 2, style: 11 + Math.floor(Math.random() * 4), ridge: "x", village: true });
      if (hb) { suburbLot(e, t - 10, side, w + 20, hb); n++; }
    }
    if (n >= 4) { const p = edgePos(e, (t0 + t1) / 2); props.push({ k: "kiosk", x: p.x + (-p.ty) * (e.hw + 9), y: p.y + p.tx * (e.hw + 9), a: Math.atan2(-p.tx, p.ty), v: 0 }); }
  }
  // дачи: участки сеткой в стороне от трассы, у каждого домик и забор
  for (let k = 0; k < 2; k++) {
    const e = pick(ruralEdges); if (!e) break;
    const t = rnd(e.len * .25, e.len * .75), p = edgePos(e, t), side = Math.random() < .5 ? 1 : -1, nx = -p.ty * side, ny = p.tx * side;
    const b = blockAt(p.x + nx * (e.hw + 40), p.y + ny * (e.hw + 40)); if (!b || !b.rural) continue;
    const ang = Math.atan2(p.ty, p.tx), ca = Math.cos(ang), sa = Math.sin(ang);
    for (let i = -3; i <= 3; i++) for (let j = 0; j < 4; j++) {
      const lx = i * 26, lz = e.hw + 34 + j * 26, x = p.x + ca * lx + nx * lz, y = p.y + sa * lx + ny * lz;
      if (!footFree(x, y, 12, 10, ang, b.id)) continue;
      addRotBuilding(x, y, rnd(8, 11), rnd(7, 9), ang, { kind: "dacha", floors: 1, style: 11 + Math.floor(Math.random() * 4), ridge: "x" });
      for (const i2 of rotCells(x, y, 14, 12, ang)) usedMask[i2] = 1;
      const hw2 = 12, c0 = [x - ca * hw2 - nx * hw2, y - sa * hw2 - ny * hw2], c1 = [x + ca * hw2 - nx * hw2, y + sa * hw2 - ny * hw2], c2 = [x + ca * hw2 + nx * hw2, y + sa * hw2 + ny * hw2], c3 = [x - ca * hw2 + nx * hw2, y - sa * hw2 + ny * hw2];
      fences.push([...c1, ...c2], [...c2, ...c3], [...c3, ...c0]);
      if (Math.random() < .5) addTree(x + nx * 8 + ca * rnd(-6, 6), y + ny * 8 + sa * rnd(-6, 6), rnd(4, 6), rnd(10, 16));
    }
  }
  // заправка на трассе за городом
  for (let k = 0; k < 20; k++) {
    const e = pick(ruralEdges); if (!e) break;
    const t = rnd(e.len * .3, e.len * .7), side = Math.random() < .5 ? 1 : -1;
    const g = placeAlong(e, t, side, 18, 12, 12, 34, { kind: "gas", floors: 1, style: 7 });
    if (!g) continue;
    const f = g.front; for (const i of rotCells(g.cx + f.nx * 22, g.cy + f.ny * 22, 40, 30, g.rot)) if (grid[i] === 2) grid[i] = 0;
    break;
  }
}
// запасной вариант: учреждение хоть где-нибудь в городе
function placeSpecialFallback(kind) {
  const S = SPECIAL[kind], cand = RE.filter(e => !e.rural && e.kind !== "ring" && e.len > S.w + 40);
  for (let k = 0; k < 300 && cand.length; k++) {
    const e = pick(cand), side = Math.random() < .5 ? 1 : -1, t = rnd(e.ra + 10, Math.max(e.ra + 11, e.len - e.rb - S.w - 10));
    const b = placeAlong(e, t, side, S.w, S.d, S.d, S.set, { kind, floors: S.floors, style: S.style });
    if (b) { special[kind] = { x: b.doorPref[0], y: b.doorPref[1], b }; return true; }
  }
  return false;
}
