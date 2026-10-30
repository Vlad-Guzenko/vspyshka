/* ---------- дорожная сеть: граф из узлов и рёбер-ломаных ---------- */
// узел — перекрёсток, изгиб или выезд за карту; ребро — ломаная между двумя узлами с полушириной hw и типом:
// hw — загородное шоссе, av — проспект, st — улица, ln — переулок, ring — кольцо развязки (одностороннее)
// полосы: по одной в каждую сторону со смещением вправо по ходу движения; у кольца одна полоса по оси
let RN = [], RE = [], RL = [], rounds = [];
const SW = 8; // ширина тротуара
const roadMask = new Uint8Array(GMAX); // 1 проезжая часть, 2 тротуар, 3 обочина за городом
const regionOf = new Int32Array(GMAX);  // номер квартала клетки, −1 — дорога

/* ---------- ломаные ---------- */
function plCum(pts) { const c = [0]; for (let i = 1; i < pts.length; i++) c.push(c[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1])); return c; }
function plPos(pts, cum, t) {
  const L = cum[cum.length - 1]; t = t < 0 ? 0 : t > L ? L : t;
  let lo = 1, hi = cum.length - 1;
  while (lo < hi) { const m = (lo + hi) >> 1; if (cum[m] < t) lo = m + 1; else hi = m; }
  const i = lo, a = pts[i - 1], b = pts[i], sl = cum[i] - cum[i - 1] || 1, k = (t - cum[i - 1]) / sl;
  return { x: a[0] + (b[0] - a[0]) * k, y: a[1] + (b[1] - a[1]) * k, tx: (b[0] - a[0]) / sl, ty: (b[1] - a[1]) / sl };
}
function plNearest(pts, cum, x, y) {
  let bd = 1e9, bt = 0, bx = 0, by = 0;
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1], b = pts[i], dx = b[0] - a[0], dy = b[1] - a[1], L2 = dx * dx + dy * dy || 1;
    const k = clamp(((x - a[0]) * dx + (y - a[1]) * dy) / L2, 0, 1), px = a[0] + dx * k, py = a[1] + dy * k, d = Math.hypot(px - x, py - y);
    if (d < bd) { bd = d; bt = cum[i - 1] + Math.sqrt(L2) * k; bx = px; by = py; }
  }
  return { d: bd, t: bt, x: bx, y: by };
}
// кусок ломаной от t0 до t1
function plCut(pts, cum, t0, t1) {
  const out = [], a = plPos(pts, cum, t0); out.push([a.x, a.y]);
  for (let i = 1; i < pts.length - 1; i++) if (cum[i] > t0 + .01 && cum[i] < t1 - .01) out.push([pts[i][0], pts[i][1]]);
  const b = plPos(pts, cum, t1); out.push([b.x, b.y]); return out;
}
// пересечение отрезков: параметры u на первом и v на втором
function segX(ax, ay, bx, by, cx, cy, dx, dy) {
  const rx = bx - ax, ry = by - ay, sx = dx - cx, sy = dy - cy, den = rx * sy - ry * sx;
  if (Math.abs(den) < 1e-9) return null;
  const qx = cx - ax, qy = cy - ay, u = (qx * sy - qy * sx) / den, v = (qx * ry - qy * rx) / den;
  if (u < -1e-6 || u > 1 + 1e-6 || v < -1e-6 || v > 1 + 1e-6) return null;
  return { u, v, x: ax + rx * u, y: ay + ry * u };
}
function distSeg(px, py, ax, ay, bx, by) { const dx = bx - ax, dy = by - ay, L2 = dx * dx + dy * dy || 1, k = clamp(((px - ax) * dx + (py - ay) * dy) / L2, 0, 1); return Math.hypot(ax + dx * k - px, ay + dy * k - py); }
// гладкая кривая через опорные точки (Катмулл — Ром), шаг около step
function spline(ctrl, step = 14) {
  if (ctrl.length < 3) return ctrl.map(p => [p[0], p[1]]);
  const out = [], P = i => ctrl[clamp(i, 0, ctrl.length - 1)];
  for (let i = 0; i < ctrl.length - 1; i++) {
    const p0 = P(i - 1), p1 = P(i), p2 = P(i + 1), p3 = P(i + 2), n = Math.max(2, Math.ceil(Math.hypot(p2[0] - p1[0], p2[1] - p1[1]) / step));
    for (let k = 0; k < n; k++) {
      const t = k / n, t2 = t * t, t3 = t2 * t;
      const f = (a, b, c, d) => .5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
      out.push([f(p0[0], p1[0], p2[0], p3[0]), f(p0[1], p1[1], p2[1], p3[1])]);
    }
  }
  out.push([ctrl[ctrl.length - 1][0], ctrl[ctrl.length - 1][1]]);
  return out;
}
function arcPts(cx, cy, r, a0, a1, step = 16) { const n = Math.max(2, Math.ceil(Math.abs(a1 - a0) * r / step)), out = []; for (let i = 0; i <= n; i++) { const a = a0 + (a1 - a0) * i / n; out.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]); } return out; }
// часть ломаной внутри карты (концы подрезаются точно по краю)
function clipMap(pts, m = 0) {
  const inside = p => p[0] >= m && p[1] >= m && p[0] <= W - m && p[1] <= H - m, parts = []; let cur = [];
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i], q = pts[i - 1];
    if (inside(p)) { if (!cur.length && q) cur.push(edgeCut(q, p, m)); cur.push([p[0], p[1]]); }
    else if (cur.length) { cur.push(edgeCut(p, q, m)); parts.push(cur); cur = []; }
  }
  if (cur.length) parts.push(cur);
  return parts.filter(p => p.length >= 2);
}
function edgeCut(out, inn, m) { let a = out, b = inn; for (let k = 0; k < 24; k++) { const mid = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]; if (mid[0] >= m && mid[1] >= m && mid[0] <= W - m && mid[1] <= H - m) b = mid; else a = mid; } return [clamp(b[0], m, W - m), clamp(b[1], m, H - m)]; }
// часть ломаной, где inside(x, y) истинно
function clipBy(pts, inside, step = 6) {
  const parts = []; let cur = [], prev = null;
  const dense = []; for (let i = 1; i < pts.length; i++) { const a = pts[i - 1], b = pts[i], n = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / step)); for (let k = i === 1 ? 0 : 1; k <= n; k++) dense.push([a[0] + (b[0] - a[0]) * k / n, a[1] + (b[1] - a[1]) * k / n]); }
  for (const p of dense) { if (inside(p[0], p[1])) cur.push(p); else if (cur.length) { parts.push(cur); cur = []; } }
  if (cur.length) parts.push(cur);
  return parts.filter(p => p.length >= 2).map(simplifyPts);
}
// убираем лишние точки на прямых участках
function simplifyPts(pts, tol = .6) {
  if (pts.length < 3) return pts;
  const out = [pts[0]];
  for (let i = 1; i < pts.length - 1; i++) { const a = out[out.length - 1], b = pts[i + 1]; if (distSeg(pts[i][0], pts[i][1], a[0], a[1], b[0], b[1]) > tol) out.push(pts[i]); }
  out.push(pts[pts.length - 1]); return out;
}

/* ---------- граф ---------- */
function rnNew(x, y) { const n = { id: RN.length, x, y, ed: [], exit: false, sig: false, round: null, occ: [], keep: false }; RN.push(n); return n; }
function reNew(a, b, pts, hw, kind, oneway, extra) {
  pts[0] = [a.x, a.y]; pts[pts.length - 1] = [b.x, b.y];
  const e = { id: RE.length, a, b, pts, hw, kind, oneway: !!oneway, cum: null, len: 0, ra: 0, rb: 0, L: [null, null], rural: false, sw: SW, blockT: -999, ...(extra || {}) };
  reCum(e); a.ed.push(e); b.ed.push(e); RE.push(e); return e;
}
function reCum(e) {
  e.cum = plCum(e.pts); e.len = e.cum[e.cum.length - 1];
  let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9; for (const p of e.pts) { x0 = Math.min(x0, p[0]); y0 = Math.min(y0, p[1]); x1 = Math.max(x1, p[0]); y1 = Math.max(y1, p[1]); }
  e.bb = [x0, y0, x1, y1];
}
function reKill(e) { e.dead = true; for (const n of [e.a, e.b]) { const i = n.ed.indexOf(e); if (i >= 0) n.ed.splice(i, 1); } }
function edgePos(e, t) { return plPos(e.pts, e.cum, t); }
function edgeNearest(e, x, y) { return plNearest(e.pts, e.cum, x, y); }
// делим ребро в точке t: само ребро становится первой частью, вторая — новое ребро
function gSplit(e, t) {
  if (t < 1.5) return e.a; if (t > e.len - 1.5) return e.b;
  const p = edgePos(e, t), n = rnNew(p.x, p.y), first = plCut(e.pts, e.cum, 0, t), second = plCut(e.pts, e.cum, t, e.len), b = e.b;
  b.ed.splice(b.ed.indexOf(e), 1);
  e.b = n; e.pts = first; e.pts[e.pts.length - 1] = [n.x, n.y]; reCum(e); n.ed.push(e);
  reNew(n, b, second, e.hw, e.kind, e.oneway, { rural: e.rural, boulevard: e.boulevard, tag: e.tag, sw: e.sw, mountain: e.mountain });
  return n;
}
function gNodeNear(x, y, r, skip) { let best = null, bd = r; for (const n of RN) { if (n.dead || n === skip) continue; const d = Math.hypot(n.x - x, n.y - y); if (d < bd) { bd = d; best = n; } } return best; }
function gEdgeNear(x, y, r, skipFn) {
  let best = null, bd = r;
  for (const e of RE) { if (e.dead || (skipFn && skipFn(e))) continue; const b = e.bb; if (x < b[0] - r || x > b[2] + r || y < b[1] - r || y > b[3] + r) continue; const q = edgeNearest(e, x, y); if (q.d < bd) { bd = q.d; best = { e, t: q.t, x: q.x, y: q.y, d: q.d }; } }
  return best;
}
// направление ребра от узла n
function edgeDirFrom(e, n) {
  const k = Math.min(14, e.len / 2), p = n === e.a ? edgePos(e, k) : edgePos(e, e.len - k);
  const dx = p.x - n.x, dy = p.y - n.y, l = Math.hypot(dx, dy) || 1; return [dx / l, dy / l];
}
const SNAP = 14;
// новая дорога: пересечения с существующими становятся перекрёстками, концы притягиваются к узлам и рёбрам
function addRoad(pts, hw, kind, opt = {}) {
  pts = pts.filter((p, i) => i === 0 || Math.hypot(p[0] - pts[i - 1][0], p[1] - pts[i - 1][1]) > .5);
  if (pts.length < 2) return null;
  const cum = plCum(pts), len = cum[cum.length - 1]; if (len < 10) return null;
  let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9; for (const p of pts) { x0 = Math.min(x0, p[0]); y0 = Math.min(y0, p[1]); x1 = Math.max(x1, p[0]); y1 = Math.max(y1, p[1]); }
  // точки разреза: { s — где на новой дороге, e/t — где на старом ребре или n — готовый узел }
  const cuts = [];
  for (const e of RE) {
    if (e.dead) continue; const b = e.bb;
    if (b[2] < x0 - 1 || b[0] > x1 + 1 || b[3] < y0 - 1 || b[1] > y1 + 1) continue;
    for (let i = 1; i < pts.length; i++) {
      const a = pts[i - 1], c = pts[i]; const sl = cum[i] - cum[i - 1];
      for (let j = 1; j < e.pts.length; j++) {
        const p = e.pts[j - 1], q = e.pts[j];
        if (Math.max(a[0], c[0]) < Math.min(p[0], q[0]) - 1 || Math.min(a[0], c[0]) > Math.max(p[0], q[0]) + 1 || Math.max(a[1], c[1]) < Math.min(p[1], q[1]) - 1 || Math.min(a[1], c[1]) > Math.max(p[1], q[1]) + 1) continue;
        const h = segX(a[0], a[1], c[0], c[1], p[0], p[1], q[0], q[1]); if (!h) continue;
        cuts.push({ s: cum[i - 1] + sl * h.u, e, t: e.cum[j - 1] + (e.cum[j] - e.cum[j - 1]) * h.v, x: h.x, y: h.y });
      }
    }
  }
  // концы: если рядом нет пересечения — притягиваем к узлу или ребру
  for (const end of [0, 1]) {
    const s = end ? len : 0, p = end ? pts[pts.length - 1] : pts[0];
    if (cuts.some(c => Math.abs(c.s - s) < SNAP)) continue;
    if (opt.noSnap) { cuts.push({ s, n: null, x: p[0], y: p[1], free: true }); continue; }
    const n = gNodeNear(p[0], p[1], SNAP);
    if (n) { cuts.push({ s, n, x: n.x, y: n.y }); continue; }
    const q = gEdgeNear(p[0], p[1], SNAP);
    if (q) { cuts.push({ s, e: q.e, t: q.t, x: q.x, y: q.y }); continue; }
    cuts.push({ s, n: null, x: p[0], y: p[1], free: true });
  }
  cuts.sort((a, b) => a.s - b.s);
  // близкие разрезы — один перекрёсток
  const groups = [];
  for (const c of cuts) { const g = groups[groups.length - 1]; if (g && c.s - g[0].s < 9) g.push(c); else groups.push([c]); }
  // узлы: готовые, у концов старого ребра, иначе делим ребро (по каждому ребру — с конца, чтобы t не сдвигались)
  for (const g of groups) {
    for (const c of g) if (!c.n && c.e) { if (c.t < 9) c.n = c.e.a; else if (c.t > c.e.len - 9) c.n = c.e.b; else { const near = gNodeNear(c.x, c.y, 8); if (near) c.n = near; } }
  }
  const splits = cuts.filter(c => !c.n && c.e).sort((a, b) => a.e === b.e ? b.t - a.t : a.e.id - b.e.id);
  for (const c of splits) {
    // ребро могло укоротиться от прежнего деления: ищем часть, на которой лежит точка
    let e = c.e; if (c.t > e.len + .5) { const q = gEdgeNear(c.x, c.y, 2); if (q) { e = q.e; c.t = q.t; } }
    const done = cuts.find(o => o !== c && o.n && Math.hypot(o.n.x - c.x, o.n.y - c.y) < 8);
    c.n = done ? done.n : gSplit(e, c.t);
  }
  const seq = [];
  for (const g of groups) {
    let n = g.find(c => c.n)?.n;
    if (!n) { const c = g[0]; n = rnNew(c.x, c.y); }
    for (const c of g) c.n = n;
    const s = g.reduce((a, c) => a + c.s, 0) / g.length;
    if (seq.length && seq[seq.length - 1].n === n) continue;
    seq.push({ s, n });
  }
  // если первый/последний разрез не у самого конца — хвосты до свободных концов уже учтены как свободные узлы
  const made = [];
  for (let i = 1; i < seq.length; i++) {
    const A = seq[i - 1], B = seq[i];
    if (A.n === B.n) continue;
    const piece = plCut(pts, cum, A.s, B.s); if (piece.length < 2) continue;
    const plen = Math.max(1, plCum(piece).pop());
    // такое ребро уже есть — не дублируем
    if (A.n.ed.some(e => !e.dead && ((e.a === A.n && e.b === B.n) || (e.b === A.n && e.a === B.n)) && Math.abs(e.len - plen) < plen * .2 + 4)) continue;
    made.push(reNew(A.n, B.n, piece, hw, kind, opt.oneway, opt.extra));
  }
  return { nodes: seq.map(q => q.n), edges: made };
}
// чистка: короткие рёбра схлопываются, цепочки из одинаковых рёбер через узлы степени 2 сливаются
function finishGraph() {
  for (let pass = 0; pass < 3; pass++) {
    for (const e of RE) {
      if (e.dead || e.a === e.b || e.kind === "ring") continue;
      // короткое ребро схлопывается; между двумя перекрёстками — и до 24: иначе между ними не помещается машина, и оба запираются.
      // Так же до 24 — изгиб (узел степени 2) у самого перекрёстка: там меняется ширина улицы или ломаная, и узел торчит рядом с перекрёстком
      const jn = n => n.ed.length >= 3 && !n.round, bend = n => n.ed.length === 2 && !n.round && !n.exit && !n.keep;
      if (e.len >= (jn(e.a) && jn(e.b) || jn(e.a) && bend(e.b) || bend(e.a) && jn(e.b) ? 24 : 9)) continue;
      const keep = e.a.exit || e.a.round ? e.a : e.b.exit || e.b.round ? e.b : e.a.ed.length > e.b.ed.length ? e.a : e.b, gone = keep === e.a ? e.b : e.a;
      if (gone.exit || gone.round) continue;
      reKill(e);
      for (const f of gone.ed.slice()) {
        if (f.dead) continue;
        if (f.a === gone) { f.a = keep; f.pts[0] = [keep.x, keep.y]; }
        if (f.b === gone) { f.b = keep; f.pts[f.pts.length - 1] = [keep.x, keep.y]; }
        if (f.a === f.b) { f.dead = true; const i = keep.ed.indexOf(f); if (i >= 0) keep.ed.splice(i, 1); continue; }
        reCum(f); if (!keep.ed.includes(f)) keep.ed.push(f);
      }
      gone.ed = []; gone.dead = true;
    }
  }
  // дубли между одной парой узлов
  for (const n of RN) { if (n.dead) continue; for (const e of n.ed.slice()) { if (e.dead) continue; for (const f of n.ed.slice()) { if (f === e || f.dead) continue; const same = (f.a === e.a && f.b === e.b) || (f.a === e.b && f.b === e.a); if (same && Math.abs(f.len - e.len) < Math.max(f.len, e.len) * .2 + 4) reKill(f.hw > e.hw ? e : f); } } }
  // слияние через узлы степени 2
  let merged = true;
  while (merged) {
    merged = false;
    for (const n of RN) {
      if (n.dead || n.exit || n.round || n.keep || n.ed.length !== 2) continue;
      const [e1, e2] = n.ed; if (e1 === e2 || e1.hw !== e2.hw || e1.kind !== e2.kind || e1.oneway !== e2.oneway || e1.rural !== e2.rural || e1.sw !== e2.sw || !!e1.mountain !== !!e2.mountain) continue;
      const o1 = e1.a === n ? e1.b : e1.a, o2 = e2.a === n ? e2.b : e2.a; if (o1 === o2 || o1 === n || o2 === n) continue;
      if (e1.oneway && !(e1.b === n && e2.a === n)) continue;
      const p1 = e1.b === n ? e1.pts : e1.pts.slice().reverse(), p2 = e2.a === n ? e2.pts : e2.pts.slice().reverse();
      // острый излом не сглаживаем: там остаётся перекрёсток-поворот
      const d1 = edgeDirFrom(e1, n), d2 = edgeDirFrom(e2, n); if (d1[0] * d2[0] + d1[1] * d2[1] > -.35) continue;
      reKill(e1); reKill(e2);
      reNew(o1, o2, p1.concat(p2.slice(1)), e1.hw, e1.kind, e1.oneway, { rural: e1.rural, boulevard: e1.boulevard || e2.boulevard, tag: e1.tag || e2.tag, sw: e1.sw, mountain: e1.mountain });
      n.dead = true; n.ed = []; merged = true;
    }
  }
  // переиндексация
  RE = RE.filter(e => !e.dead && e.len > 2); RN = RN.filter(n => !n.dead && n.ed.length);
  RE.forEach((e, i) => { e.id = i; e.pts = simplifyPts(e.pts, .25); e.pts[0] = [e.a.x, e.a.y]; e.pts[e.pts.length - 1] = [e.b.x, e.b.y]; reCum(e); });
  RN.forEach((n, i) => { n.id = i; n.ed = n.ed.filter(e => !e.dead); });
  prepareGraph();
}
// полосы, отступы стоп-линий, выезды за карту, светофоры
function prepareGraph() {
  RL = [];
  for (const e of RE) {
    const off = e.oneway ? 0 : e.hw * .45;
    e.L = [{ e, d: 1, from: e.a, to: e.b, off, id: RL.length }, null];
    RL.push(e.L[0]);
    if (!e.oneway) { e.L[1] = { e, d: -1, from: e.b, to: e.a, off, id: RL.length }; RL.push(e.L[1]); }
  }
  for (const n of RN) { n.occ = []; n.round = n.ed.some(e => e.kind === "ring"); n.exit = n.ed.length === 1 && (n.x < 3 || n.y < 3 || n.x > W - 3 || n.y > H - 3); }
  // светофоры: где сходятся проспекты или проспект с несколькими улицами
  const sigs = [];
  for (const n of RN) {
    n.sig = false; if (n.ed.length < 3 || n.round || n.ed.every(e => e.rural)) continue;
    const av = n.ed.filter(e => e.hw >= 22).length, st = n.ed.filter(e => e.hw >= 15).length;
    // проспект с проспектом или проспект, пересечённый улицей насквозь; Т-примыкания улиц — без светофора, «уступи дорогу»
    if (av >= 3 || (av >= 2 && n.ed.length >= 4 && st >= 4)) sigs.push(n);
  }
  sigs.sort((a, b) => Math.max(...b.ed.map(e => e.hw)) - Math.max(...a.ed.map(e => e.hw)));
  for (const n of sigs) {
    if (RN.some(o => o.sig && Math.hypot(o.x - n.x, o.y - n.y) < 70)) continue;
    n.sig = true; if (n.off === undefined) n.off = rnd(0, 30);
    const main = n.ed.reduce((a, e) => e.hw > a.hw ? e : a, n.ed[0]), ax = edgeDirFrom(main, n);
    n.grpA = new Set(n.ed.filter(e => { const v = edgeDirFrom(e, n); return Math.abs(ax[0] * v[1] - ax[1] * v[0]) < .5; }));
  }
  // соседние светофоры (короткое ребро между ними, как на бульваре из двух проспектов) работают в один такт:
  // ведущий — узел с меньшим номером, остальные повторяют его фазу, с переворотом, если главная ось у них поперёк
  for (const n of RN) { n.sigLead = n.sig ? n : null; n.sigFlip = false; }
  for (const n of RN) {
    if (!n.sig || n.sigLead !== n) continue;
    const q = [n];
    while (q.length) { const a = q.pop(); for (const e of a.ed) { if (e.len > 110) continue; const b = e.a === a ? e.b : e.a; if (!b.sig || b.sigLead === n) continue; if (b.sigLead !== b) continue; b.sigLead = n; b.sigFlip = a.sigFlip !== (a.grpA.has(e) !== b.grpA.has(e)); q.push(b); } }
  }
  // стоп-линии и начало застройки от каждого узла: зависят от ширины и угла соседних улиц
  for (const n of RN) {
    const deg = n.ed.length;
    n.cw = n.sig; // зебры — у светофоров
    for (const e of n.ed) {
      let r = 0, fs = 0;
      if (deg === 1) { r = n.exit ? 0 : 4; fs = n.exit ? 0 : e.hw + 10; }
      else {
        const u = edgeDirFrom(e, n);
        for (const f of n.ed) {
          if (f === e) continue;
          const v = edgeDirFrom(f, n), dot = u[0] * v[0] + u[1] * v[1];
          if (deg === 2 && dot < -.6) continue; // прямое продолжение
          if (dot < -.92) continue;
          const sn = Math.max(.42, Math.sqrt(Math.max(0, 1 - dot * dot)));
          r = Math.max(r, f.hw / sn + (n.cw ? 13 : n.round ? 3 : 3));
          fs = Math.max(fs, f.hw / sn + f.sw + 3);
        }
        if (n.round && e.kind === "ring") r = Math.min(r, 6);
        r = Math.min(r, e.len * .42);
      }
      if (e.a === n) { e.ra = r; e.fa = fs; } if (e.b === n) { e.rb = r; e.fb = fs; }
    }
  }
  // короткая полоса между близкими перекрёстками: от стоп-линии до стоп-линии не помещается машина (traffic.js, shortLane)
  for (const l of RL) l.short = !l.to.exit && laneEnd(l) - laneStart(l) < 26;
}
function buildCrossMask() {
  crossMask.fill(0);
  const band = (e, t) => { const p = edgePos(e, t); for (let o = -e.hw; o <= e.hw; o += CS / 2) for (let s = -5; s <= 5; s += CS / 2) { const x = p.x - p.ty * o + p.tx * s, y = p.y + p.tx * o + p.ty * s, gx = Math.floor(x / CS), gy = Math.floor(y / CS); if (gx >= 0 && gy >= 0 && gx < GW && gy < GH && roadMask[gy * GW + gx] === 1) crossMask[gy * GW + gx] = 1; } };
  for (const n of RN) { if (n.ed.length < 3) continue; for (const e of n.ed) { if (e.rural) continue; const r = e.a === n ? e.ra : e.rb; band(e, e.a === n ? r - 6 : e.len - r + 6); } }
  for (const e of RE) if (!e.rural && e.kind !== "ring" && e.len > 260) band(e, e.len / 2);
}
function laneFrom(e, n) { return e.a === n ? e.L[0] : e.L[1]; }
function laneStart(l) { return l.d > 0 ? l.e.ra : l.e.rb; }
function laneEnd(l) { return l.e.len - (l.d > 0 ? l.e.rb : l.e.ra); }
function laneLen(l) { return l.e.len; }
function oppLane(l) { return l.d > 0 ? l.e.L[1] : l.e.L[0]; }
// точка полосы на расстоянии s от её начала: координаты и направление движения
function lanePos(l, s) {
  const e = l.e, t = l.d > 0 ? s : e.len - s, p = plPos(e.pts, e.cum, t), tx = p.tx * l.d, ty = p.ty * l.d;
  return { x: p.x - ty * l.off, y: p.y + tx * l.off, tx, ty };
}
function edgeTOfLane(l, s) { return l.d > 0 ? s : l.e.len - s; }
function laneSOfT(l, t) { return l.d > 0 ? t : l.e.len - t; }
// светофор: фазы 0 — зелёный по главной оси, 1 — жёлтый, 2 — зелёный поперечной, 3 — жёлтый; в конце жёлтого секунда общего красного
// (n.ar), чтобы успели проехать въехавшие на жёлтый. Переключает signalTick по спросу: зелёный не уходит с улицы, к которой подъезжают
// машины, и не отдаётся пустой поперечной; ждущим поперёк — не дольше SIG.max
const SIG = { min: 6, max: 18, yel: 2.5, red: 1, look: 110 };
function lightFor(n, e) {
  if (!n.sig) return "g";
  const ph = n.ph === undefined ? ((simT + (n.off || 0)) % 30 < 15 ? 0 : 2) : n.ph, A = n.grpA.has(e);
  if ((ph === 1 || ph === 3) && n.ar) return "r";
  return ph === 0 ? (A ? "g" : "r") : ph === 1 ? (A ? "y" : "r") : ph === 2 ? (A ? "r" : "g") : (A ? "r" : "y");
}
let sigT = 0;
function signalTick(dt) {
  sigT -= dt; if (sigT > 0) return; sigT = .25;
  // спрос по осям: [ждут у линии главной, подъезжают по главной, ждут поперечной, подъезжают по поперечной]
  const q = new Map();
  for (const c of cars) {
    if (c.gone || !c.moving || !c.lane || c.turn || c.park || c.gas) continue;
    const l = c.lane, n = l.to; if (!n.sig) continue;
    const d = laneEnd(l) - c.s; if (d > SIG.look || d < -2) continue;
    let a = q.get(n); if (!a) q.set(n, a = [0, 0, 0, 0]);
    const k = n.grpA.has(l.e) ? 0 : 2;
    if (c.v < 4 && d < 70) a[k]++; else if (c.v >= 4) a[k + 1]++;
  }
  // спрос группы светофоров суммируется у ведущего (с учётом переворота осей)
  const qq = new Map();
  for (const [n, a] of q) { const L = n.sigLead || n, f = n.sigFlip; let b = qq.get(L); if (!b) qq.set(L, b = [0, 0, 0, 0]); for (let i = 0; i < 4; i++) b[i] += a[f ? (i + 2) % 4 : i]; }
  for (const n of RN) {
    if (!n.sig || (n.sigLead && n.sigLead !== n)) continue;
    if (n.ph === undefined) { n.ph = Math.random() < .5 ? 0 : 2; n.phT = simT - rnd(0, 8); }
    const t = simT - n.phT;
    if (n.ph === 1 || n.ph === 3) { n.ar = t >= SIG.yel; if (t >= SIG.yel + SIG.red) { n.ph = (n.ph + 1) % 4; n.phT = simT; n.ar = false; } continue; }
    if (t < SIG.min) continue;
    const a = qq.get(n) || [0, 0, 0, 0], k = n.ph === 0 ? 0 : 2, ownW = a[k], ownA = a[k + 1], othW = a[2 - k], othA = a[3 - k];
    if (!othW && !othA) continue; // поперёк никого — зелёный остаётся
    // своя улица пуста — сразу; поперёк ждут, а у нас только подъезжающие — после 12 с; иначе не дольше SIG.max
    if ((!ownW && !ownA) || (othW && !ownW && t >= 12) || (othW > ownW + ownA + 3 && t >= 12) || (othW && t >= SIG.max) || t >= SIG.max * 2) { n.ph = (n.ph + 1) % 4; n.phT = simT; n.ar = false; }
  }
  for (const n of RN) if (n.sig && n.sigLead && n.sigLead !== n && n.sigLead.ph !== undefined) { n.ph = n.sigFlip ? (n.sigLead.ph + 2) % 4 : n.sigLead.ph; n.phT = n.sigLead.phT; n.ar = n.sigLead.ar; }
}

/* ---------- клетки: проезжая часть, тротуары, кварталы ---------- */
function rasterRoads() {
  roadMask.fill(0);
  for (const e of RE) {
    const side = e.rural ? 3 : e.sw - 3.5, R = e.hw + side;
    for (let i = 1; i < e.pts.length; i++) {
      const a = e.pts[i - 1], b = e.pts[i];
      const gx0 = Math.max(0, Math.floor((Math.min(a[0], b[0]) - R) / CS)), gx1 = Math.min(GW - 1, Math.floor((Math.max(a[0], b[0]) + R) / CS));
      const gy0 = Math.max(0, Math.floor((Math.min(a[1], b[1]) - R) / CS)), gy1 = Math.min(GH - 1, Math.floor((Math.max(a[1], b[1]) + R) / CS));
      for (let gy = gy0; gy <= gy1; gy++) for (let gx = gx0; gx <= gx1; gx++) {
        const d = distSeg(gx * CS + 4, gy * CS + 4, a[0], a[1], b[0], b[1]), j = gy * GW + gx;
        if (d < e.hw - .5) roadMask[j] = 1;
        else if (d < R) { const want = e.rural ? 3 : 2, cur = roadMask[j]; if (cur === 0 || (cur === 3 && want === 2)) roadMask[j] = want; }
      }
    }
  }
  // тупики: разворотная площадка с тротуаром вокруг
  for (const n of RN) if (n.ed.length === 1 && !n.exit) { const e = n.ed[0], R = e.hw + 6; for (let gy = Math.floor((n.y - R - e.sw) / CS); gy <= Math.floor((n.y + R + e.sw) / CS); gy++) for (let gx = Math.floor((n.x - R - e.sw) / CS); gx <= Math.floor((n.x + R + e.sw) / CS); gx++) { if (gx < 0 || gy < 0 || gx >= GW || gy >= GH) continue; const d = Math.hypot(gx * CS + 4 - n.x, gy * CS + 4 - n.y), j = gy * GW + gx; if (d < R - .5) roadMask[j] = 1; else if (d < R + e.sw - 3.5 && !roadMask[j]) roadMask[j] = e.rural ? 3 : 2; } n.cul = true; }
  // узлы: асфальт до самого широкого ребра
  for (const n of RN) if (n.ed.length >= 3 && !n.round) { const r = Math.max(...n.ed.map(e => e.hw)) - 1; for (let gy = Math.floor((n.y - r) / CS); gy <= Math.floor((n.y + r) / CS); gy++) for (let gx = Math.floor((n.x - r) / CS); gx <= Math.floor((n.x + r) / CS); gx++) if (gx >= 0 && gy >= 0 && gx < GW && gy < GH && Math.hypot(gx * CS + 4 - n.x, gy * CS + 4 - n.y) < r) roadMask[gy * GW + gx] = 1; }
  for (let i = 0; i < GW * GH; i++) { const m = roadMask[i]; if (m === 1) grid[i] = 0; else if (m === 2) grid[i] = 1; else if (m === 3) grid[i] = 2; }
}
// кварталы — связные куски клеток между дорогами
function computeRegions() {
  regionOf.fill(-1); blocks = [];
  const stack = new Int32Array(GW * GH);
  for (let s = 0; s < GW * GH; s++) {
    if (roadMask[s] || regionOf[s] >= 0) continue;
    const id = blocks.length; let sp = 0, n = 0, sx = 0, sy = 0, x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
    stack[sp++] = s; regionOf[s] = id;
    while (sp) {
      const i = stack[--sp], x = i % GW, y = (i / GW) | 0; n++; sx += x; sy += y;
      if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
      if (x > 0 && !roadMask[i - 1] && regionOf[i - 1] < 0) { regionOf[i - 1] = id; stack[sp++] = i - 1; }
      if (x < GW - 1 && !roadMask[i + 1] && regionOf[i + 1] < 0) { regionOf[i + 1] = id; stack[sp++] = i + 1; }
      if (y > 0 && !roadMask[i - GW] && regionOf[i - GW] < 0) { regionOf[i - GW] = id; stack[sp++] = i - GW; }
      if (y < GH - 1 && !roadMask[i + GW] && regionOf[i + GW] < 0) { regionOf[i + GW] = id; stack[sp++] = i + GW; }
    }
    const cx = (sx / n) * CS + 4, cy = (sy / n) * CS + 4;
    blocks.push({ id, n, area: n * CS * CS, x0: x0 * CS, y0: y0 * CS, x1: (x1 + 1) * CS, y1: (y1 + 1) * CS, cx, cy, d: districtOf(cx, cy), kind: null, rural: false, city: cityK(cx, cy) });
  }
}
function blockAt(x, y) { const gx = Math.floor(x / CS), gy = Math.floor(y / CS); if (gx < 0 || gy < 0 || gx >= GW || gy >= GH) return null; const r = regionOf[gy * GW + gx]; return r >= 0 ? blocks[r] : null; }

/* ---------- поиск пути по дорогам ---------- */
// расстояние от каждого узла до цели по направленным полосам (с учётом перекрытых недавно рёбер)
function edgeCost(e) { return e.len * (e.kind === "ln" ? 1.25 : e.kind === "ring" ? 2 : 1) + (simT - e.blockT < 90 ? 4000 : 0) + (e.closed ? 3000 : 0) + (e.quar && e.quarGate !== e.quar ? 3000 : e.quarGate ? 400 : 0) + (e.narrow ? 150 : 0) + (e.jamN || 0) * 110; }
function dijkstraTo(seeds, skipL) {
  const dist = new Float64Array(RN.length).fill(1e12), done = new Uint8Array(RN.length);
  const seedN = new Uint8Array(RN.length); for (const [n, d] of seeds) { dist[n.id] = Math.min(dist[n.id], d); seedN[n.id] = 1; }
  for (let k = 0; k < RN.length; k++) {
    let u = -1, bd = 1e12; for (let i = 0; i < RN.length; i++) if (!done[i] && dist[i] < bd) { bd = dist[i]; u = i; }
    if (u < 0) break; done[u] = 1;
    const n = RN[u]; if (n.exit && !seedN[u]) continue; // через выезд за карту не разворачиваются: там машина уезжает насовсем (сам выезд как цель — можно)
    // в узел n можно приехать по полосе, которая ведёт в n
    for (const e of n.ed) { const l = e.b === n ? e.L[0] : e.L[1]; if (!l || l.to !== n || l === skipL) continue; const m = l.from, nd = bd + edgeCost(e) + (e.checkCp && typeof postLaneShut === "function" && postLaneShut(e.checkCp, l) ? 6000 : 0); if (nd < dist[m.id]) dist[m.id] = nd; }
  }
  return dist;
}
const routeCache = new Map();
// маршрут к точке: цель — ближайшее место на дороге
function routeTo(x, y) {
  const key = Math.round(x / 24) + ":" + Math.round(y / 24), old = routeCache.get(key);
  if (old && simT - old.t < 20) return old;
  const q = gEdgeNear(x, y, 400) || gEdgeNear(x, y, 3000); if (!q) return null;
  const e = q.e, seeds = [];
  if (e.L[0]) seeds.push([e.a, q.t]); if (e.L[1]) seeds.push([e.b, e.len - q.t]);
  const r = { t: simT, e, et: q.t, x: q.x, y: q.y, dist: dijkstraTo(seeds) };
  if (routeCache.size > 60) routeCache.clear();
  routeCache.set(key, r); return r;
}
let exitRoute = null;
function exitDist() {
  if (exitRoute && simT - exitRoute.t < 15 && exitRoute.n === RN.length) return exitRoute.dist;
  const seeds = RN.filter(n => n.exit).map(n => { let q = 0; for (const c of cars) if (c.flee && !c.gone && c.moving && Math.abs(c.x - n.x) < 260 && Math.abs(c.y - n.y) < 260) q++; return [n, q * 35]; });
  exitRoute = { t: simT, n: RN.length, dist: dijkstraTo(seeds) }; return exitRoute.dist;
}
