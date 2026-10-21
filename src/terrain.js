/* ---------- мир: рельеф, извилистая река, изрезанный берег, озёра, пятно города ---------- */
// высота в единицах мира (1 ед. = 25 см). Город стоит на пологих холмах, за ним хребты со снегом.
// Вода — ямы в рельефе под общей водной гладью. Клетка 10 — скала, по ней не пройти.
let terrainSeed = 1, hasHills = true, ridgeSides = [], rocks = [], river = null, shore = null, lakes = [], cityBlob = null;
const TH = new Float32Array(GW * GH); // высота по клеткам города
const MOUNT = { front: 320, span: 1000, hmax: 420 }, WATER_Y = -1.5, BED = -5.5, BANK = 10; // рельефа нет: земля ровная, у воды короткий откос
function tHash(ix, iy) { let n = (ix * 374761393 + iy * 668265263 + terrainSeed * 1442695041) | 0; n = Math.imul(n ^ (n >>> 13), 1274126177); return ((n ^ (n >>> 16)) >>> 0) / 4294967295; }
function vnoise(x, y) {
  const ix = Math.floor(x), iy = Math.floor(y), fx = x - ix, fy = y - iy, u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy);
  const a = tHash(ix, iy), b = tHash(ix + 1, iy), c = tHash(ix, iy + 1), d = tHash(ix + 1, iy + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
function fbm(x, y) { return vnoise(x, y) * .55 + vnoise(x * 2.1 + 7, y * 2.1 + 3) * .28 + vnoise(x * 4.3 + 19, y * 4.3 + 11) * .17; }
function ridged(x, y) { const n = fbm(x, y); return 1 - Math.abs(n * 2 - 1); }
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };
function outDist(x, y) { return Math.max(-y, y - H, -x, x - W); }
function seaSide() { return shore ? shore.side : -1; }

/* ---------- вода ---------- */
// река: ось вдоль карты, центр гуляет шумом, ширина меняется
function makeRiver(v) {
  const len = v ? H : W, across = v ? W : H, pts = [], c0 = across * rnd(.38, .62), wig = across * .16;
  for (let t = -2600; t <= len + 2600; t += 50) pts.push([t, c0 + (fbm(t / 760 + 3, 11.3) - .5) * 2 * wig + (fbm(t / 190 + 7, 5.1) - .5) * 70]);
  river = { v, pts, w0: rnd(72, 108) };
}
function riverCenter(t) {
  const p = river.pts, i = clamp(Math.floor((t - p[0][0]) / 50), 0, p.length - 2), k = clamp((t - p[i][0]) / 50);
  return p[i][1] + (p[i + 1][1] - p[i][1]) * k;
}
function riverWidth(t) { return river.w0 * (.7 + fbm(t / 420 + 1.7, 2.2) * .6); }
function riverD(x, y) { if (!river) return 1e9; const t = river.v ? y : x, c = river.v ? x : y; return Math.abs(c - riverCenter(t)) - riverWidth(t) / 2; }
// на каком берегу точка: -1, 1, 0 — в воде
function riverSideOf(x, y) { if (!river) return 0; const t = river.v ? y : x, c = river.v ? x : y, d = c - riverCenter(t), w = riverWidth(t) / 2; return d < -w ? -1 : d > w ? 1 : 0; }
// море: один край карты, береговая линия с бухтами и мысами
function makeShore() { shore = { side: Math.floor(rnd(0, 4)), base: rnd(250, 360), amp: 150 }; }
function shoreD(x, y) {
  if (!shore) return 1e9;
  const s = shore.side, along = s < 2 ? x : y, coord = s === 0 ? y : s === 1 ? H - y : s === 2 ? x : W - x;
  const limit = shore.base + (fbm(along / 520 + 2.1, s * 3.7) - .5) * 2 * shore.amp + (fbm(along / 140 + 9, 4.4) - .5) * 50;
  return coord - limit; // < 0 — море
}
function lakeD(x, y) {
  let best = 1e9;
  for (const l of lakes) { const dx = (x - l.x) / l.rx, dy = (y - l.y) / l.ry, r = Math.hypot(dx, dy) + (fbm(x / 120 + l.x, y / 120) - .5) * .5; best = Math.min(best, (r - 1) * Math.min(l.rx, l.ry)); }
  return best;
}
function waterD(x, y) { return Math.min(riverD(x, y), shoreD(x, y), lakeD(x, y)); }
function waterAt(x, y) { return waterD(x, y) < 0; }
// пятно города: не прямоугольник, а живой контур; за ним поля и леса
function cityK(x, y) {
  if (!cityBlob) return 1;
  const r = Math.hypot((x - cityBlob.x) / cityBlob.rx, (y - cityBlob.y) / cityBlob.ry) + (fbm(x / 640 + 2.3, y / 640 + 9.1) - .5) * .55 + (fbm(x / 210 + 4, y / 210 + 1) - .5) * .18;
  return 1 - smooth(.86, 1.08, r);
}
// вода и горы выключены по просьбе: функции остаются, но мир ровный и сухой
const WORLD_WATER = false, WORLD_MOUNTAINS = false;
function worldFlat() { return !river && !shore && !lakes.length && !ridgeSides.length; }
function prepareWater() {
  terrainSeed = Math.floor(Math.random() * 1e9); river = null; shore = null; lakes = []; rocks = [];
  ridgeSides = !WORLD_MOUNTAINS || L.ridges === 0 ? [] : L.ridges === "long" ? [0, 1] : L.ridges === 2 ? pick([[0, 2], [0, 3], [1, 2], [1, 3]]) : [pick([0, 1, 2, 3])];
  if (WORLD_WATER && L.sea) { makeShore(); ridgeSides = ridgeSides.filter(s => s !== shore.side); }
  ridgeSides.intrude = !!L.hills;
  if (WORLD_WATER && L.river) makeRiver(Math.random() < .5);
  cityBlob = { x: W / 2 + rnd(-120, 120), y: H / 2 + rnd(-80, 80), rx: W * (L.compact ? .38 : .48), ry: H * (L.compact ? .42 : .5) };
  if (WORLD_WATER) for (let k = 0; k < 2; k++) if (Math.random() < .6) { const x = rnd(60, W - 60), y = rnd(60, H - 60); if (cityK(x, y) < .2 && riverD(x, y) > 200 && shoreD(x, y) > 200) lakes.push({ x, y, rx: rnd(60, 130), ry: rnd(50, 100) }); }
}

/* ---------- высоты ---------- */
// пологие холмы под городом и вокруг
// земля ровная: холмы убраны по просьбе, остались только горы на горизонте у горных планировок
function baseH(x, y) { return 0; }
// берега: к воде земля плавно опускается, дно уходит вглубь постепенно
function withWater(h, x, y) {
  const d = waterD(x, y);
  if (d < 0) return WATER_Y - .4 + (BED - WATER_Y + .4) * smooth(0, 36, -d);
  if (d < BANK) return WATER_Y + .9 + (h - WATER_Y - .9) * smooth(0, BANK, d);
  return h;
}
// за городом: холмы, хребты по выбранным сторонам, снег на вершинах
function wildH(x, y) {
  let h = baseH(x, y);
  for (const side of (L.hills ? ridgeSides : [])) {
    const ds = side === 0 ? -y : side === 1 ? y - H : side === 2 ? -x : x - W, along = side < 2 ? x : y;
    const front = ridgeSides.intrude ? 40 : MOUNT.front;
    const k = smooth(front, front + MOUNT.span, ds + (fbm(along / 600, side * 9.1) - .5) * 300);
    const n = .45 + fbm(x / 260 + side, y / 260) * .7 + ridged(x / 140, y / 140) * .55 * k + fbm(x / 55, y / 55) * .18;
    h = Math.max(h, MOUNT.hmax * k * k * n * smooth(0, 120, ds) + k * 40 + (fbm(x / 90, y / 90) - .5) * 24 * smooth(0, 80, ds));
  }
  return withWater(h, x, y);
}
function cityCellH(gx, gy) { return TH[clamp(gy, 0, GH - 1) * GW + clamp(gx, 0, GW - 1)]; }
function gY(x, y) {
  if (!hasHills) return 0;
  if (x >= 0 && x < W && y >= 0 && y < H) {
    const fx = x / CS - .5, fy = y / CS - .5, gx = Math.floor(fx), gy = Math.floor(fy), u = fx - gx, v = fy - gy;
    const a = cityCellH(gx, gy), b = cityCellH(gx + 1, gy), c = cityCellH(gx, gy + 1), d = cityCellH(gx + 1, gy + 1);
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
  }
  return wildH(x, y);
}
// карта высот города: холмы и вода; потом холмы кварталов, дороги и мосты
function fillTerrain() {
  hasHills = !worldFlat();
  for (let gy = 0; gy < GH; gy++) for (let gx = 0; gx < GW; gx++) { const x = gx * CS + 4, y = gy * CS + 4; TH[gy * GW + gx] = hasHills ? withWater(baseH(x, y), x, y) : 0; }
}
// кварталы у горных сторон и пара в глубине становятся холмами без застройки
function prepareTerrain() {
  return; // холмов в кварталах больше нет
  const near = b => ridgeSides.some(s => (s === 0 ? b.y0 : s === 1 ? H - b.y1 : s === 2 ? b.x0 : W - b.x1) < 150);
  for (const b of blocks) if (!b.kind && near(b) && Math.random() < .7) b.kind = "hill";
  const inner = blocks.filter(b => !b.kind && b.d > 0 && (b.x1 - b.x0) > 90 && (b.y1 - b.y0) > 90);
  for (let i = 0; i < 2 && inner.length; i++) { const b = inner.splice(Math.floor(Math.random() * inner.length), 1)[0]; b.kind = "hill"; }
}
function hillBlock(b) {
  const cx = (b.x0 + b.x1) / 2, cy = (b.y0 + b.y1) / 2, w = b.x1 - b.x0, d = b.y1 - b.y0;
  const amp = Math.min(Math.min(w, d) * .3, 22 + Math.min(w, d) * .22 + (ridgeSides.some(s => (s === 0 ? b.y0 : s === 1 ? H - b.y1 : s === 2 ? b.x0 : W - b.x1) < 200) ? 26 : 0));
  for (let gy = Math.floor(b.y0 / CS); gy < Math.ceil(b.y1 / CS); gy++) for (let gx = Math.floor(b.x0 / CS); gx < Math.ceil(b.x1 / CS); gx++) {
    const x = gx * CS + 4, y = gy * CS + 4;
    if (gx < 0 || gy < 0 || gx >= GW || gy >= GH || waterD(x, y) < BANK) continue;
    const inset = Math.min(x - b.x0, b.x1 - x, y - b.y0, b.y1 - y), k = smooth(0, 60, inset);
    const r = Math.hypot((x - cx) / (w / 2), (y - cy) / (d / 2));
    TH[gy * GW + gx] += amp * k * (.35 + .65 * (1 - Math.min(1, r * r))) * (.7 + fbm(x / 90, y / 90) * .6);
  }
  const n = w * d / 2600;
  for (let t = 0; t < n; t++) { const x = rnd(b.x0 + 10, b.x1 - 10), y = rnd(b.y0 + 10, b.y1 - 10); if (cellAt(x, y) !== 2) continue; trees.push({ x, y, r: rnd(6, 11), h: rnd(14, 26) }); fillCells(x - 3, y - 3, x + 3, y + 3, 4); }
  for (let t = 0; t < 2 + Math.random() * 4; t++) {
    const x = rnd(b.x0 + 14, b.x1 - 14), y = rnd(b.y0 + 14, b.y1 - 14), s = rnd(5, 11);
    if (cellAt(x, y) !== 2) continue;
    rocks.push({ x, y, s, rot: rnd(0, TAU) }); fillCells(x - s * .7, y - s * .7, x + s * .7, y + s * .7, 10);
  }
}
// дорога ровная поперёк своей оси; мост лежит на уровне берегов
function flattenRoads() {
  for (const s of streets) {
    const half = s.hw + 10;
    for (let t = s.a0; t <= s.a1; t += CS) {
      const x = s.v ? s.p : t, y = s.v ? t : s.p, i0 = clamp(Math.floor(y / CS), 0, GH - 1) * GW + clamp(Math.floor(x / CS), 0, GW - 1), h = TH[i0];
      if (h <= WATER_Y) continue;
      for (let o = -half; o <= half; o += CS) {
        const xx = s.v ? x + o : x, yy = s.v ? y : y + o, gx = Math.floor(xx / CS), gy = Math.floor(yy / CS); if (gx < 0 || gy < 0 || gx >= GW || gy >= GH) continue;
        const i = gy * GW + gx; if (TH[i] <= WATER_Y) continue;
        // у воды дорога не поднимает берег, только опускается к нему
        if (h > TH[i] && waterD(xx, yy) < BANK) continue;
        const k = 1 - smooth(s.hw, half, Math.abs(o)); TH[i] += (h - TH[i]) * k;
      }
    }
  }
  smoothTerrain(2);
  for (const b of bridges) {
    const t0 = b.v ? b.y0 : b.x0, t1 = b.v ? b.y1 : b.x1, c = b.v ? (b.x0 + b.x1) / 2 : (b.y0 + b.y1) / 2;
    const hA = gY(b.v ? c : t0 - 8, b.v ? t0 - 8 : c), hB = gY(b.v ? c : t1 + 8, b.v ? t1 + 8 : c), hh = Math.max(hA, hB, WATER_Y + 2.5);
    b.h = hh;
    for (let y = b.y0; y < b.y1 + CS; y += CS) for (let x = b.x0; x < b.x1 + CS; x += CS) { const gx = Math.floor(x / CS), gy = Math.floor(y / CS); if (gx >= 0 && gy >= 0 && gx < GW && gy < GH) TH[gy * GW + gx] = hh; }
  }
}
// пруды из парков: клетки воды без формулы — тоже дно и берега
function sinkPonds() {
  for (let gy = 0; gy < GH; gy++) for (let gx = 0; gx < GW; gx++) if (grid[gy * GW + gx] === 9 && TH[gy * GW + gx] > WATER_Y) {
    TH[gy * GW + gx] = BED;
    for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) { const x = gx + dx, y = gy + dy; if (x < 0 || y < 0 || x >= GW || y >= GH) continue; const j = y * GW + x; if (grid[j] === 9) continue; const d = Math.hypot(dx, dy); TH[j] = Math.min(TH[j], WATER_Y + .6 + d * 2.2); }
  }
}
// сглаживание: убирает ступеньки на перекрёстках и у берегов; вода и дно не трогаются
function smoothTerrain(passes) {
  const tmp = new Float32Array(TH.length);
  for (let p = 0; p < passes; p++) {
    tmp.set(TH);
    for (let gy = 1; gy < GH - 1; gy++) for (let gx = 1; gx < GW - 1; gx++) {
      const i = gy * GW + gx; if (TH[i] <= WATER_Y) continue;
      let s = 0, n = 0; for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const j = i + dy * GW + dx; if (TH[j] > WATER_Y) { s += TH[j]; n++; } }
      tmp[i] = s / n;
    }
    TH.set(tmp);
  }
}
function finishTerrain() {
  for (let gy = 1; gy < GH - 1; gy++) for (let gx = 1; gx < GW - 1; gx++) {
    const i = gy * GW + gx; if (grid[i] !== 2) continue;
    const sx = (TH[i + 1] - TH[i - 1]) / (2 * CS), sy = (TH[i + GW] - TH[i - GW]) / (2 * CS);
    if (Math.hypot(sx, sy) > 1.1 && TH[i] > WATER_Y) grid[i] = 10;
  }
}
function slopeK(x0, y0, x1, y1) {
  const d = Math.hypot(x1 - x0, y1 - y0); if (d < .01) return 1;
  const s = (gY(x1, y1) - gY(x0, y0)) / d;
  return clamp(1 - s * 1.3, .45, 1.15);
}
