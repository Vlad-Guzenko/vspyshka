/* ---------- улицы: ровная сетка или живая застройка ---------- */
// улица — отрезок: v (вертикальная), p (координата оси), hw (полуширина), a0..a1 (протяжённость), wide (проспект), edge (граница карты)
const EDGE_HW = 18;
function edgeStreets() {
  streets.push({ v: true, p: 0, hw: EDGE_HW, wide: false, edge: true, a0: 0, a1: H }, { v: true, p: W, hw: EDGE_HW, wide: false, edge: true, a0: 0, a1: H });
  streets.push({ v: false, p: 0, hw: EDGE_HW, wide: false, edge: true, a0: 0, a1: W }, { v: false, p: H, hw: EDGE_HW, wide: false, edge: true, a0: 0, a1: W });
}
// классическая сетка: по два проспекта на каждую ось
function gridStreets() {
  const xs = [0], ys = [0];
  while (xs[xs.length - 1] < W - 250) xs.push(xs[xs.length - 1] + rnd(180, 230));
  xs.push(W);
  while (ys[ys.length - 1] < H - 210) ys.push(ys[ys.length - 1] + rnd(150, 185));
  ys.push(H);
  const avs = (arr) => { const s = new Set(); while (s.size < 2) s.add(1 + Math.floor(Math.random() * (arr.length - 2))); return s; };
  const avX = avs(xs), avY = avs(ys);
  const hx = xs.map((_, k) => avX.has(k) ? 28 : 18), hy = ys.map((_, k) => avY.has(k) ? 28 : 18);
  xs.forEach((p, k) => streets.push({ v: true, p, hw: hx[k], wide: avX.has(k), edge: k === 0 || k === xs.length - 1, a0: 0, a1: H, depth: avX.has(k) ? 1 : 2 }));
  ys.forEach((p, k) => streets.push({ v: false, p, hw: hy[k], wide: avY.has(k), edge: k === 0 || k === ys.length - 1, a0: 0, a1: W, depth: avY.has(k) ? 1 : 2 }));
  for (let i = 0; i < xs.length - 1; i++) for (let j = 0; j < ys.length - 1; j++) {
    const b = { x0: xs[i] + hx[i], y0: ys[j] + hy[j], x1: xs[i + 1] - hx[i + 1], y1: ys[j + 1] - hy[j + 1] };
    if (b.x1 - b.x0 > 50 && b.y1 - b.y0 > 50) { b.d = districtOf((b.x0 + b.x1) / 2, (b.y0 + b.y1) / 2); blocks.push(b); }
  }
}
// живая застройка: карту делят проспекты, их части — улицы, те — переулки; кварталы разного размера, улицы кончаются на перекрёстках
function bspStreets(irr) {
  edgeStreets();
  const MINB = 92;
  const maxBlock = (x, y) => { const d = districtOf(x, y); return (d === 0 ? 190 : d === 1 ? 235 : 285) * (L.blockK || 1); };
  const rec = (x0, y0, x1, y1, hL, hR, hT, hB, depth) => {
    const w = x1 - x0 - hL - hR, h = y1 - y0 - hT - hB, MAXB = maxBlock((x0 + x1) / 2, (y0 + y1) / 2);
    const canX = w > 2 * MINB + 40, canY = h > 2 * MINB + 40, mustX = canX && w > MAXB, mustY = canY && h > MAXB;
    let split = null;
    if (mustX || mustY) split = mustX && mustY ? (w > h * 1.2 ? "x" : h > w * 1.2 ? "y" : Math.random() < .5 ? "x" : "y") : mustX ? "x" : "y";
    else if ((canX || canY) && (depth < 2 || Math.random() > .3 + irr * .4)) split = canX && canY ? (w > h * 1.25 ? "x" : h > w * 1.25 ? "y" : Math.random() < .5 ? "x" : "y") : canX ? "x" : "y";
    if (!split) { blocks.push({ x0: x0 + hL, y0: y0 + hT, x1: x1 - hR, y1: y1 - hB, d: districtOf((x0 + x1) / 2, (y0 + y1) / 2) }); return; }
    const hw = depth === 0 ? 28 : depth === 1 && Math.random() < .6 ? 28 : depth >= 3 && Math.random() < .35 + irr * .4 ? 12 : 18, wide = hw === 28;
    if (split === "x") {
      const lo = x0 + hL + MINB + hw, hi = x1 - hR - MINB - hw, mid = (lo + hi) / 2;
      const p = clamp(mid + (Math.random() - .5) * (hi - lo) * Math.min(1, irr * 1.2), lo, hi);
      streets.push({ v: true, p, hw, wide, edge: false, a0: y0, a1: y1, depth });
      rec(x0, y0, p, y1, hL, hw, hT, hB, depth + 1); rec(p, y0, x1, y1, hw, hR, hT, hB, depth + 1);
    } else {
      const lo = y0 + hT + MINB + hw, hi = y1 - hB - MINB - hw, mid = (lo + hi) / 2;
      const p = clamp(mid + (Math.random() - .5) * (hi - lo) * Math.min(1, irr * 1.2), lo, hi);
      streets.push({ v: false, p, hw, wide, edge: false, a0: x0, a1: x1, depth });
      rec(x0, y0, x1, p, hL, hR, hT, hw, depth + 1); rec(x0, p, x1, y1, hL, hR, hw, hB, depth + 1);
    }
  };
  rec(0, 0, W, H, EDGE_HW, EDGE_HW, EDGE_HW, EDGE_HW, 0);
}
// есть ли перекрёсток двух улиц: отрезки должны покрывать друг друга
function streetsCross(a, b) {
  if (a.v === b.v) return false;
  const v = a.v ? a : b, h = a.v ? b : a;
  return v.p >= h.a0 - 1 && v.p <= h.a1 + 1 && h.p >= v.a0 - 1 && h.p <= v.a1 + 1;
}
// река должна иметь мосты: если улицы кончаются у воды, продлеваем 2–3 из них на другой берег и режем кварталы под них
function ensureBridges(wb) {
  const band = wb.v ? [wb.x0, wb.x1] : [wb.y0, wb.y1], L = wb.v ? W : H;
  const want = 3 - streets.filter(s => s.bridge).length; if (want <= 0) return;
  const cross = streets.filter(s => s.v !== wb.v && !s.edge && !s.bridge);
  // кандидаты: доходят до воды с одной стороны
  const cands = cross.map(s => {
    const endsBefore = s.a1 <= band[0] + 5 && s.a1 >= band[0] - 90, startsAfter = s.a0 >= band[1] - 5 && s.a0 <= band[1] + 90;
    return endsBefore ? { s, side: 1 } : startsAfter ? { s, side: 0 } : null;
  }).filter(Boolean).sort(() => Math.random() - .5);
  let made = 0;
  for (const c of cands) {
    if (made >= want) break;
    const s = c.s;
    if (streets.some(o => o.bridge && o.v === s.v && Math.abs(o.p - s.p) < 220)) continue; // мосты не рядом
    // до ближайшей параллельной реке улицы на том берегу, иначе до края
    const parallel = streets.filter(o => o.v === wb.v && !o.water && (c.side === 1 ? o.p > band[1] + 10 : o.p < band[0] - 10) && s.p >= o.a0 - 1 && s.p <= o.a1 + 1).sort((p, q) => c.side === 1 ? p.p - q.p : q.p - p.p);
    const to = parallel.length ? parallel[0].p : (c.side === 1 ? L : 0);
    const from = c.side === 1 ? s.a1 : s.a0;
    if (c.side === 1) s.a1 = to; else s.a0 = to;
    // кварталы на пути новой улицы режем
    const lo = Math.min(from, to), hi = Math.max(from, to), keep = [];
    for (const b of blocks) {
      const bx0 = s.v ? b.x0 : b.y0, bx1 = s.v ? b.x1 : b.y1, by0 = s.v ? b.y0 : b.x0, by1 = s.v ? b.y1 : b.x1; // bx: поперёк улицы, by: вдоль
      if (s.p - s.hw >= bx1 || s.p + s.hw <= bx0 || by1 <= lo || by0 >= hi) { keep.push(b); continue; }
      const parts = [[bx0, s.p - s.hw], [s.p + s.hw, bx1]];
      for (const [p0, p1] of parts) if (p1 - p0 > 50) keep.push(s.v ? { ...b, x0: p0, x1: p1 } : { ...b, y0: p0, y1: p1 });
    }
    blocks = keep;
    s.bridge = true; bridges.push(wb.v ? { x0: wb.x0 - 4, x1: wb.x1 + 4, y0: s.p - s.hw, y1: s.p + s.hw, v: false } : { y0: wb.y0 - 4, y1: wb.y1 + 4, x0: s.p - s.hw, x1: s.p + s.hw, v: true });
    made++;
  }
}

/* ---------- мир вокруг улиц: берега, пятно города, окрестности ---------- */
function shapeWorld() {
  // память о воде для старых функций: прямоугольники-оценки
  if (river) { const xs = river.pts.map(p => river.v ? p[1] : p[0]), ys = river.pts.map(p => river.v ? p[0] : p[1]); waters.push({ x0: river.v ? Math.min(...xs) - river.w0 : -10, x1: river.v ? Math.max(...xs) + river.w0 : W + 10, y0: river.v ? -10 : Math.min(...ys) - river.w0, y1: river.v ? H + 10 : Math.max(...ys) + river.w0, v: river.v, poly: true }); }
  if (shore) { const s = shore.side, d = shore.base + shore.amp; waters.push(s === 0 ? { x0: -10, x1: W + 10, y0: -10, y1: d, v: false, sea: true } : s === 1 ? { x0: -10, x1: W + 10, y0: H - d, y1: H + 10, v: false, sea: true } : s === 2 ? { x0: -10, x1: d, y0: -10, y1: H + 10, v: true, sea: true } : { x0: W - d, x1: W + 10, y0: -10, y1: H + 10, v: true, sea: true }); }
  // кварталы: у воды — берег без домов, вне пятна города — сельская местность
  const wet = b => { for (let k = 0; k < 9; k++) { const x = b.x0 + (b.x1 - b.x0) * (k % 3) / 2, y = b.y0 + (b.y1 - b.y0) * Math.floor(k / 3) / 2; if (waterD(x, y) < 3) return true; } return false; };
  for (const b of blocks) {
    const cx = (b.x0 + b.x1) / 2, cy = (b.y0 + b.y1) / 2;
    if (wet(b)) { b.kind = "bank"; b.rural = true; continue; }
    const k = cityK(cx, cy);
    if (k < .5) {
      b.rural = true;
      const r = Math.random(), hilly = baseH(cx, cy) > 30;
      b.kind = k < .15 && (r < .3 || hilly) ? "forest" : r < .55 ? "field" : r < .8 ? "meadow" : "forest";
    }
  }
  // улицы: вдоль воды и в воде — убираем; в полях остаются только главные дороги
  for (const s of streets) {
    if (s.edge) continue;
    let wetN = 0, n = 0; for (let t = s.a0; t <= s.a1; t += 16) { n++; if (waterD(s.v ? s.p : t, s.v ? t : s.p) < 4) wetN++; }
    if (wetN / n > .3) { s.water = true; s.gone = true; continue; }
    const mid = cityK(s.v ? s.p : (s.a0 + s.a1) / 2, s.v ? (s.a0 + s.a1) / 2 : s.p);
    if (mid < .5 && s.depth >= 2) s.gone = true;
  }
  streets = streets.filter(s => !s.gone);
  makeBridges();
}
// мост там, где улица пересекает воду целиком; если мостов мало — продлеваем улицы через реку
function makeBridges() {
  const scan = s => { const out = []; let inW = false, t0 = 0; for (let t = s.a0; t <= s.a1; t += 4) { const w = waterD(s.v ? s.p : t, s.v ? t : s.p) < 2 || waterD(s.v ? s.p - s.hw : t, s.v ? t : s.p - s.hw) < 2 || waterD(s.v ? s.p + s.hw : t, s.v ? t : s.p + s.hw) < 2; if (w && !inW) { inW = true; t0 = t; } if (!w && inW) { inW = false; out.push([t0, t]); } } if (inW) out.push([t0, s.a1]); return out; };
  const add = (s, t0, t1) => { if (t0 - s.a0 < 20 || s.a1 - t1 < 20 || t1 - t0 > 260) return false; s.bridge = true; bridges.push(s.v ? { x0: s.p - s.hw, x1: s.p + s.hw, y0: t0 - 8, y1: t1 + 8, v: true } : { y0: s.p - s.hw, y1: s.p + s.hw, x0: t0 - 8, x1: t1 + 8, v: false }); return true; };
  for (const s of streets) { if (s.edge) continue; for (const [t0, t1] of scan(s)) if (Math.random() < .7) add(s, t0, t1); }
  if (!river) return;
  // мало мостов: продлеваем улицы, что упираются в реку, до ближайшей параллельной улицы на том берегу
  let tries = 0;
  while (bridges.length < 3 && tries++ < 40) {
    const cands = streets.filter(s => !s.edge && !s.bridge && s.v !== river.v);
    const s = pick(cands); if (!s) break;
    const endAt = (side) => { const t = side === 1 ? s.a1 : s.a0, d = waterD(s.v ? s.p : t + (side === 1 ? 30 : -30), s.v ? t + (side === 1 ? 30 : -30) : s.p); return d < 60; };
    const side = endAt(1) ? 1 : endAt(0) ? 0 : -1; if (side < 0) continue;
    const Lmax = s.v ? H : W;
    let t = side === 1 ? s.a1 : s.a0, crossed = false, to = -1;
    for (let k = 0; k < 120; k++) { t += side === 1 ? 10 : -10; if (t <= 0 || t >= Lmax) { to = clamp(t, 0, Lmax); break; } const w = waterD(s.v ? s.p : t, s.v ? t : s.p) < 0; if (w) crossed = true; else if (crossed) { const par = streets.find(o => o.v !== s.v && Math.abs(o.p - t) < 12 && s.p >= o.a0 - 1 && s.p <= o.a1 + 1); if (par) { to = par.p; break; } } }
    if (to < 0 || !crossed) continue;
    const from = side === 1 ? s.a1 : s.a0; if (side === 1) s.a1 = to; else s.a0 = to;
    const lo = Math.min(from, to), hi = Math.max(from, to), keep = [];
    for (const b of blocks) {
      const bx0 = s.v ? b.x0 : b.y0, bx1 = s.v ? b.x1 : b.y1, by0 = s.v ? b.y0 : b.x0, by1 = s.v ? b.y1 : b.x1;
      if (s.p - s.hw >= bx1 || s.p + s.hw <= bx0 || by1 <= lo || by0 >= hi) { keep.push(b); continue; }
      for (const [p0, p1] of [[bx0, s.p - s.hw], [s.p + s.hw, bx1]]) if (p1 - p0 > 50) keep.push(s.v ? { ...b, x0: p0, x1: p1 } : { ...b, y0: p0, y1: p1 });
    }
    blocks = keep;
    for (const [t0, t1] of scan(s)) add(s, t0, t1);
  }
}
// сельская местность: поля с полосами посевов, луга с цветами, леса, берега; изредка ферма
function buildRural() {
  for (const b of blocks) {
    if (!b.rural) continue;
    const w = b.x1 - b.x0, d = b.y1 - b.y0;
    fillCells(b.x0, b.y0, b.x1, b.y1, 2);
    if (b.kind === "forest") {
      const n = w * d / 420;
      for (let t = 0; t < n; t++) { const x = rnd(b.x0 + 4, b.x1 - 4), y = rnd(b.y0 + 4, b.y1 - 4); if (cellAt(x, y) !== 2 || waterD(x, y) < 10) continue; trees.push({ x, y, r: rnd(7, 13), h: rnd(18, 32) }); fillCells(x - 3, y - 3, x + 3, y + 3, 4); }
    } else if (b.kind === "field") {
      b.crop = Math.floor(Math.random() * 4); b.along = w > d ? "x" : "y";
      if (Math.random() < .35 && w > 60 && d > 60) {
        // ферма: дом и сарай у края поля
        const hx = rnd(b.x0 + 12, b.x1 - 34), hy = rnd(b.y0 + 12, b.y1 - 30);
        if (waterD(hx, hy) > 30) {
          addBuilding({ x0: hx, y0: hy, x1: hx + 20, y1: hy + 16, kind: "house", floors: 1, style: 11 + Math.floor(Math.random() * 4), ridge: "x" });
          if (Math.random() < .7) addBuilding({ x0: hx + 26, y0: hy - 2, x1: hx + 48, y1: hy + 14, kind: "barn", floors: 1, style: 26, ridge: "x" });
          for (let k = 0; k < 3; k++) { const x = hx + rnd(-8, 56), y = hy + rnd(-10, 26); if (cellAt(x, y) === 2) { trees.push({ x, y, r: rnd(6, 9), h: rnd(14, 22) }); fillCells(x - 2, y - 2, x + 2, y + 2, 4); } }
        }
      }
    } else if (b.kind === "meadow" || b.kind === "bank") {
      const n = w * d / (b.kind === "bank" ? 1800 : 3200);
      for (let t = 0; t < n; t++) { const x = rnd(b.x0 + 4, b.x1 - 4), y = rnd(b.y0 + 4, b.y1 - 4); if (cellAt(x, y) !== 2 || waterD(x, y) < 22) continue; trees.push({ x, y, r: rnd(6, 12), h: rnd(16, 28) }); fillCells(x - 3, y - 3, x + 3, y + 3, 4); }
    }
  }
}
// крепостная стена вокруг старого города: кольцо с башнями, ворота на лучах
function buildWalls() {
  if (!L.wall || !oldTown) return;
  const { x: cx, y: cy, R, spokes } = oldTown, r = R + 14, segs = 64, gateHalf = 13;
  for (let i = 0; i < segs; i++) {
    const a0 = i / segs * TAU, a1 = (i + 1) / segs * TAU, am = (a0 + a1) / 2;
    const gate = [...Array(spokes).keys()].some(k => { let d = am - k / spokes * TAU; d -= Math.round(d / TAU) * TAU; return Math.abs(d) * r < gateHalf; });
    const x0 = cx + Math.cos(a0) * r, y0 = cy + Math.sin(a0) * r, x1 = cx + Math.cos(a1) * r, y1 = cy + Math.sin(a1) * r;
    walls.push({ x0, y0, x1, y1, gate, tower: i % 8 === 0 });
    if (gate) continue;
    for (let t = 0; t <= 1; t += .25) { const x = x0 + (x1 - x0) * t, y = y0 + (y1 - y0) * t; fillCells(x - 3.5, y - 3.5, x + 3.5, y + 3.5, 3); }
  }
}
// холм поверх базового рельефа (после fillTerrain)
function hillBlock2(b) { hillBlock(b); }
