/* ---------- мир: рельеф, извилистая река, изрезанный берег, озёра, пятно города ---------- */
// высота в единицах мира (1 ед. = 25 см). Город стоит на пологих холмах, за ним хребты со снегом.
// Вода — ямы в рельефе под общей водной гладью. Клетка 10 — скала, по ней не пройти.
let massif = null; // горная страна: сторона, ширина, центр плато по краю, озеро на полке
let terrainSeed = 1, hasHills = true, ridgeSides = [], ridgeFront = [330, 330, 330, 330], rocks = [], river = null, shore = null, lakes = [], cityBlob = null;
const TH = new Float32Array(GMAX); // высота по клеткам города
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
function lakeNear(x, y) {
  let best = 1e9, bl = null;
  for (const l of lakes) { const dx = (x - l.x) / l.rx, dy = (y - l.y) / l.ry, r = Math.hypot(dx, dy) + (fbm(x / 120 + l.x, y / 120) - .5) * .5, d = (r - 1) * Math.min(l.rx, l.ry); if (d < best) { best = d; bl = l; } }
  return { d: best, l: bl };
}
function lakeD(x, y) { return lakeNear(x, y).d; }
// уровень воды: у горного озера свой, у остальных общий
function lakeLevel(l) { return l && l.level != null ? l.level : WATER_Y; }
function waterD(x, y) { return Math.min(riverD(x, y), shoreD(x, y), lakeD(x, y)); }
function waterAt(x, y) { return waterD(x, y) < 0; }
// пятно города: не прямоугольник, а живой контур; за ним поля и леса
function cityK(x, y) {
  if (!cityBlob) return 1;
  const r = Math.hypot((x - cityBlob.x) / cityBlob.rx, (y - cityBlob.y) / cityBlob.ry) + (fbm(x / 640 + 2.3, y / 640 + 9.1) - .5) * .55 + (fbm(x / 210 + 4, y / 210 + 1) - .5) * .18;
  return 1 - smooth(.86, 1.08, r);
}
// реки и море выключены (функции остаются); горы — по выбору в диалоге новой игры (relief), озёра ставит layout2.js
const WORLD_WATER = false;
let relief = "mountains"; // "plain" — равнина, "mountains" — хребет с предгорьями за городом с одной-двух сторон, серпантин к перевалу
function worldFlat() { return !river && !shore && !lakes.length && !ridgeSides.length; }
function prepareWater() {
  terrainSeed = Math.floor(Math.random() * 1e9); river = null; shore = null; lakes = []; rocks = []; terraces = [];
  const mountains = relief === "mountains" && L.ridges !== 0;
  // горная страна: полоса MOUNT_W слева или справа от города (карта на неё шире). Граница предгорий гуляет, отроги выходят
  // в равнину; пики соединены гребнями, между двумя — долина к седловине; на умеренных склонах случайные полки с озёрами
  massif = null; ridgeSides = [];
  if (mountains) {
    const side = pick([2, 3]), BW = MOUNT_W, AL = H, P = (ds, along) => side === 3 ? [W - BW + ds, along] : [BW - ds, along];
    const spurs = []; for (let k = 0, n = Math.floor(rnd(1, 3)); k < n; k++) spurs.push({ a: rnd(AL * .15, AL * .85), r: rnd(260, 420), push: rnd(160, 300) });
    const peaks = [], np = Math.floor(rnd(4, 9));
    // холмы (colline), а не пики: невысокие, широкие, с мягкими гребнями
    for (let k = 0; k < np; k++) peaks.push({ a: AL * (k + rnd(.2, .8)) / np, d: rnd(BW * .4, BW + 200), h: rnd(90, 190), r: rnd(420, 800), rw: rnd(280, 440) });
    peaks.sort((p, q) => p.a - q.a);
    const vk = Math.floor(rnd(0, peaks.length - 1)), valley = { a0: (peaks[vk].a + peaks[vk + 1].a) / 2 + rnd(-120, 120), w: rnd(180, 280), depth: rnd(20, 45) };
    massif = { side, w: BW, spurs, peaks, valley, terraces: [], lakes: [] };
    // полки: первая высоко, в настоящих горах, остальные ниже; все на умеренных склонах и не ближе 200 друг к другу
    const raw = (x, y) => hillsH(x, y) + massifRaw(x, y), slope = (x, y) => Math.hypot(raw(x + 12, y) - raw(x - 12, y), raw(x, y + 12) - raw(x, y - 12)) / 24;
    const nt = Math.floor(rnd(2, 4));
    for (let tries = 0; tries < 700 && massif.terraces.length < nt; tries++) {
      const a = rnd(AL * .14, AL * .86), d = rnd(520, BW - 180), [x, y] = P(d, a); if (x < 220 || y < 220 || x > W - 220 || y > H - 220) continue;
      const h = raw(x, y), s = slope(x, y), lo = massif.terraces.length ? 45 : 90; if (h < lo || h > 220 || s < .07 || s > .3) continue; // только мягкие склоны
      const r = rnd(190, 270); if (massif.terraces.some(q => Math.hypot(q.x - x, q.y - y) < q.r + r + 200)) continue;
      const lake = { x: x + rnd(-r * .18, r * .18), y: y + rnd(-r * .18, r * .18), rx: r * rnd(.24, .32), ry: r * rnd(.2, .27), level: h - 4.5 };
      massif.terraces.push({ x, y, a, d, h: h - 2, r, lake }); massif.lakes.push(lake);
    }
    massif.terraces.sort((p, q) => p.d - q.d);
    ridgeSides = [side];
  }
  if (WORLD_WATER && L.sea) { makeShore(); ridgeSides = ridgeSides.filter(s => s !== shore.side); }
  ridgeSides.intrude = !!L.hills;
  if (WORLD_WATER && L.river) makeRiver(Math.random() < .5);
  const cx0 = !massif ? W / 2 : massif.side === 3 ? (W - MOUNT_W) / 2 : MOUNT_W + (W - MOUNT_W) / 2;
  cityBlob = { x: cx0 + rnd(-120, 120), y: H / 2 + rnd(-80, 80), rx: CITY_W * (L.compact ? .38 : .48), ry: CITY_H * (L.compact ? .42 : .5) };
  if (WORLD_WATER) for (let k = 0; k < 2; k++) if (Math.random() < .6) { const x = rnd(60, W - 60), y = rnd(60, H - 60); if (cityK(x, y) < .2 && riverD(x, y) > 200 && shoreD(x, y) > 200) lakes.push({ x, y, rx: rnd(60, 130), ry: rnd(50, 100) }); }
}

/* ---------- высоты ---------- */
// Город ровный. За его пятном — пологие холмы, у горных сторон холмы переходят в предгорья и хребет, который продолжается за
// край карты. Хребет — гребневый шум по искажённым координатам (складки, а не круглые бугры); подъём начинается за 300 ед.
// до края и к краю даёт 40–60 м, дальше растёт до MOUNT.hmax. Всё умножено на (1 − cityK), чтобы город остался ровным
// Горная страна: от внутренней границы полосы предгорья за 500 ед. набирают 70, дальше склон. В полосе плато (по краю
// ±pw от a0) склон выходит на полку высотой ~150 шириной 350 ед., за ней второй склон к хребту; вне полосы — сплошной склон.
// Складки гребневого шума сильнее на склонах и почти пропадают на полке; в полке — чаша озера
function massifBand(x, y) { const M = massif; return M.side === 3 ? [y, x - (W - M.w)] : [y, M.w - x]; } // [вдоль края, глубина в горы]
function massifDepth(x, y) { const M = massif, [a, d] = massifBand(x, y); return d + (fbm(a / 900 + 3.3, 5.1) - .5) * 300 + M.spurs.reduce((s, q) => s + q.push * smooth(q.r, 0, Math.abs(a - q.a)), 0); }
function segDistT(px, py, ax, ay, bx, by) { const vx = bx - ax, vy = by - ay, L = vx * vx + vy * vy || 1, t = clamp(((px - ax) * vx + (py - ay) * vy) / L); return { d: Math.hypot(px - ax - vx * t, py - ay - vy * t), t }; }
// сырой массив: пики с гауссовыми склонами и гребни между соседями, складки гребневого шума, к краю карты выше; долина к седловине
function massifRaw(x, y) {
  const M = massif, dIn = massifDepth(x, y), m = smooth(0, 600, dIn); if (m <= 0) return 0;
  const [a, d] = massifBand(x, y), P = M.peaks; let f = 0;
  for (let i = 0; i < P.length; i++) {
    const p = P[i], dd = Math.hypot(a - p.a, (d - p.d) * 1.15) / p.r; f = Math.max(f, p.h * Math.exp(-dd * dd * 1.3));
    if (i < P.length - 1) { const q = P[i + 1], s = segDistT(a, d, p.a, p.d, q.a, q.d), hh = p.h + (q.h - p.h) * s.t, rw = p.rw + (q.rw - p.rw) * s.t; f = Math.max(f, hh * .82 * Math.exp(-((s.d / rw) ** 2))); }
  }
  const wx = x + (fbm(x / 800 + 1, y / 800 + 2) - .5) * 240, wy = y + (fbm(x / 800 - 3, y / 800 + 4) - .5) * 240;
  const rg = ridged(wx / 300, wy / 300) * .6 + fbm(wx / 120, wy / 120) * .3 + fbm(x / 40, y / 40) * .1;
  let h = f * (.86 + rg * .24) + fbm(x / 90, y / 90) * 6 * m + 30 * smooth(0, M.w, d) * m; // складки мягкие: холмы, а не скалы
  const V = M.valley, dv = Math.abs(a - V.a0 + (fbm(d / 500 + 9, 2.2) - .5) * 160); h -= V.depth * Math.exp(-((dv / V.w) ** 2)) * smooth(150, 600, d) * (h / (h + 80));
  return h * m;
}
// полки: площадка неправильной формы выравнивается к своей высоте с мягким краем, в ней чаша озера
function massifH(x, y) {
  const M = massif; let h = massifRaw(x, y);
  for (const t of M.terraces) {
    // широкая пологая юбка: полка переходит в склон без обрыва
    const dd = Math.hypot(x - t.x, y - t.y) * (1 + (fbm(x / 90 + 7, y / 90) - .5) * .3); if (dd > t.r + 300) continue;
    const k = smooth(t.r + 280, t.r - 20, dd); h += (t.h - hillsH(x, y) - h) * k;
    const L = t.lake, dl = Math.hypot((x - L.x) / L.rx, (y - L.y) / L.ry); h -= 4 * smooth(1.7, 1, dl) * k;
  }
  return Math.max(0, h);
}
function mountainH(x, y) {
  if (massif) return massifH(x, y);
  if (!ridgeSides.length) return 0;
  const wx = x + (fbm(x / 900 + 3, y / 900 + 1) - .5) * 260, wy = y + (fbm(x / 900 - 2, y / 900 + 5) - .5) * 260;
  let h = 0;
  for (const side of ridgeSides) {
    const ds = sideDs(side, x, y), along = sideAlong(side, x, y);
    const u = smooth(-ridgeFront[side], 330, ds + (fbm(along / 1500 + side * 7, 2.2) - .5) * 200); // предгорья начинаются за ridgeFront до края
    if (u <= 0) continue;
    const ridge = ridged(wx / 330 + side, wy / 330) * .62 + fbm(wx / 140, wy / 140) * .26 + fbm(x / 48, y / 48) * .08;
    h = Math.max(h, MOUNT.hmax * Math.pow(u, 1.45) * (.4 + ridge * .85) + u * 40);
  }
  return h;
}
// холмы за городом: мягкие, без ям
function hillsH(x, y) { return 10 + (fbm(x / 560 + 1, y / 560 + 4) - .5) * 40 + (fbm(x / 170 + 8, y / 170) - .5) * 9; }
// суша без воды: ровный город, холмы и горы вокруг
function landH(x, y) { const k = 1 - cityK(x, y); if (k <= 0) return 0; return (hillsH(x, y) + mountainH(x, y)) * k * k; }
function baseH(x, y) { return landH(x, y); }
// берега: к воде земля плавно опускается, дно уходит вглубь постепенно
function withWater(h, x, y) {
  const q = lakeNear(x, y), d = Math.min(riverD(x, y), shoreD(x, y), q.d), Lv = d === q.d ? lakeLevel(q.l) : WATER_Y;
  if (d < 0) return Lv - .4 + (BED - WATER_Y + .4) * smooth(0, 36, -d);
  if (d < BANK) return Lv + .9 + (h - Lv - .9) * smooth(0, BANK, d);
  return h;
}
// за краем карты та же функция, что и внутри: хребет продолжается без шва
function wildH(x, y) { return withWater(landH(x, y), x, y); }
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
// серпантины врезаны полкой: полотно ровное поперёк, продольный уклон не круче MR.grade,
// выше дороги — откос выемки 1:0.6, ниже — откос насыпи 1:1.5. Все горные рёбра считаются вместе:
// общие узлы получают одну высоту, полотно пишет ближайшая ось, выемка/насыпь не трогают чужое полотно
let benchMask = null; // ячейки полотна серпантинов: сглаживание их не трогает
let terraces = []; // дворы ферм на склонах: площадка выравнивается, вокруг откос
function levelTerraces() {
  if (!hasHills) return;
  for (const T of terraces) {
    let s = 0, n = 0; for (const i of T.cells) if (TH[i] > WATER_Y && grid[i] !== 9) { s += TH[i]; n++; } if (!n) continue;
    const h0 = s / n, inside = new Set(T.cells);
    for (const i of T.cells) if (TH[i] > WATER_Y) TH[i] = h0;
    for (const i of T.cells) { const gx = i % GW, gy = (i / GW) | 0; for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) { const x = gx + dx, y = gy + dy; if (x < 0 || y < 0 || x >= GW || y >= GH) continue; const j = y * GW + x; if (inside.has(j) || TH[j] <= WATER_Y || grid[j] === 9 || (benchMask && benchMask[j])) continue; const lim = Math.hypot(dx, dy) * CS * .66; TH[j] = clamp(TH[j], h0 - lim, h0 + lim); } }
  }
}
function benchRoads() {
  benchMask = null;
  if (!hasHills) return;
  const ME = RE.filter(e => e.mountain && !e.dead); if (!ME.length) return;
  const cellOf = (x, y) => clamp(Math.floor(y / CS), 0, GH - 1) * GW + clamp(Math.floor(x / CS), 0, GW - 1);
  const prof = new Map();
  for (const e of ME) {
    const S = []; for (let t = 0; t <= e.len; t += CS / 2) { const p = edgePos(e, t); S.push({ x: p.x, y: p.y, tx: p.tx, ty: p.ty, h: TH[cellOf(p.x, p.y)] }); }
    for (let pass = 0; pass < 3; pass++) { const c = S.map(s => s.h); for (let i = 0; i < S.length; i++) { let a = 0, n = 0; for (let k = -5; k <= 5; k++) { const j = i + k; if (j >= 0 && j < S.length) { a += c[j]; n++; } } S[i].h = a / n; } }
    prof.set(e, S);
  }
  // полотно: каждой ячейке — ближайшая ось; где полотна пересекаются (другое ребро или та же дорога через сотню единиц), высоты связываются
  const cell = new Map(), links = [];
  for (const e of ME) {
    const S = prof.get(e), half = e.hw + 3;
    for (let idx = 0; idx < S.length; idx++) { const s = S[idx]; for (let oy = -half; oy <= half; oy += CS) for (let ox = -half; ox <= half; ox += CS) {
      const xx = s.x + ox, yy = s.y + oy, gx = Math.floor(xx / CS), gy = Math.floor(yy / CS); if (gx < 0 || gy < 0 || gx >= GW || gy >= GH) continue;
      const lat = Math.abs(-(xx - s.x) * s.ty + (yy - s.y) * s.tx), lon = Math.abs((xx - s.x) * s.tx + (yy - s.y) * s.ty); if (lat > half || lon > CS) continue;
      const i = gy * GW + gx, r = cell.get(i);
      if (r && (r.e !== e || Math.abs(r.idx - idx) > 25)) links.push([r.e, r.idx, e, idx]);
      if (!r || r.lat > lat) cell.set(i, { lat, e, idx });
    } }
  }
  // продольный уклон: два прохода срезают подъёмы; концы рёбер сходятся к высоте узла, пересечения — к общей высоте (минимум)
  const dh = MR.grade * (CS / 2), nodeH = new Map();
  for (let it = 0; it < 4; it++) {
    for (const [e1, i1, e2, i2] of links) { const A = prof.get(e1)[i1], B = prof.get(e2)[i2], m = Math.min(A.h, B.h); A.h = m; B.h = m; }
    for (const e of ME) {
      const S = prof.get(e), n = S.length - 1;
      if (nodeH.has(e.a)) S[0].h = Math.min(S[0].h, nodeH.get(e.a)); if (nodeH.has(e.b)) S[n].h = Math.min(S[n].h, nodeH.get(e.b));
      for (let i = 1; i <= n; i++) if (S[i].h > S[i - 1].h + dh) S[i].h = S[i - 1].h + dh;
      for (let i = n - 1; i >= 0; i--) if (S[i].h > S[i + 1].h + dh) S[i].h = S[i + 1].h + dh;
      for (const [nd, h] of [[e.a, S[0].h], [e.b, S[n].h]]) nodeH.set(nd, Math.min(nodeH.has(nd) ? nodeH.get(nd) : Infinity, h));
    }
  }
  const roadH = new Map(); for (const [i, r] of cell) roadH.set(i, [r.lat, prof.get(r.e)[r.idx].h - .4]);
  benchMask = new Uint8Array(GW * GH);
  for (const [i, r] of roadH) if (TH[i] > WATER_Y) { TH[i] = r[1]; benchMask[i] = 1; }
  // откосы: выемка над дорогой, насыпь под ней; дальше по склону — пока не встретят рельеф
  for (const e of ME) {
    const S = prof.get(e), half = e.hw + 3, R = half + 120;
    for (const s of S) for (let oy = -R; oy <= R; oy += CS) for (let ox = -R; ox <= R; ox += CS) {
      const xx = s.x + ox, yy = s.y + oy, gx = Math.floor(xx / CS), gy = Math.floor(yy / CS); if (gx < 0 || gy < 0 || gx >= GW || gy >= GH) continue;
      const i = gy * GW + gx; if (roadH.has(i) || TH[i] <= WATER_Y || grid[i] === 9) continue;
      const lat = Math.abs(-(xx - s.x) * s.ty + (yy - s.y) * s.tx), lon = Math.abs((xx - s.x) * s.tx + (yy - s.y) * s.ty); if (lat <= half || lon > CS + lat * .12) continue;
      const t = lat - half, base = s.h - .4, cutH = base + t * 1.0, fillH = base - t * .5; // откосы мягче: холмы, а не скальная выемка
      if (TH[i] > cutH) TH[i] = cutH; else if (TH[i] < fillH) TH[i] = fillH;
    }
  }
}
// дорога ровная поперёк своей оси; мост лежит на уровне берегов
function flattenRoads() {
  if (!hasHills) return;
  for (const e of RE) {
    if (e.mountain) continue; // серпантин уже врезан полкой
    const half = e.hw + 10;
    for (let t = 0; t <= e.len; t += CS) {
      const p = edgePos(e, t), i0 = clamp(Math.floor(p.y / CS), 0, GH - 1) * GW + clamp(Math.floor(p.x / CS), 0, GW - 1), h = TH[i0];
      if (h <= WATER_Y) continue;
      for (let o = -half; o <= half; o += CS) {
        const xx = p.x - p.ty * o, yy = p.y + p.tx * o, gx = Math.floor(xx / CS), gy = Math.floor(yy / CS); if (gx < 0 || gy < 0 || gx >= GW || gy >= GH) continue;
        const i = gy * GW + gx; if (TH[i] <= WATER_Y) continue;
        if (h > TH[i] && waterD(xx, yy) < BANK) continue;
        const k = 1 - smooth(e.hw, half, Math.abs(o)); TH[i] += (h - TH[i]) * k;
      }
    }
  }
  smoothTerrain(2);
}
function sinkPonds() {
  for (let gy = 0; gy < GH; gy++) for (let gx = 0; gx < GW; gx++) if (grid[gy * GW + gx] === 9) {
    const Lv = lakeLevel(lakeNear(gx * CS + 4, gy * CS + 4).l); if (TH[gy * GW + gx] <= Lv) continue;
    TH[gy * GW + gx] = Lv + (BED - WATER_Y);
    for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) { const x = gx + dx, y = gy + dy; if (x < 0 || y < 0 || x >= GW || y >= GH) continue; const j = y * GW + x; if (grid[j] === 9) continue; const d = Math.hypot(dx, dy); TH[j] = Math.min(TH[j], Lv + .6 + d * 2.2); }
  }
}
// сглаживание: убирает ступеньки на перекрёстках и у берегов; вода и дно не трогаются
function smoothTerrain(passes) {
  const tmp = new Float32Array(TH.length);
  for (let p = 0; p < passes; p++) {
    tmp.set(TH);
    for (let gy = 1; gy < GH - 1; gy++) for (let gx = 1; gx < GW - 1; gx++) {
      const i = gy * GW + gx; if (TH[i] <= WATER_Y || grid[i] === 9 || (benchMask && benchMask[i])) continue; // вода (и горное озеро) и полотно серпантинов не сглаживаются
      let s = 0, n = 0; for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const j = i + dy * GW + dx; if (TH[j] > WATER_Y) { s += TH[j]; n++; } }
      tmp[i] = s / n;
    }
    TH.set(tmp);
  }
}
const SNOW_H = 330; // выше — снег: без деревьев и построек
function finishTerrain() {
  for (let gy = 1; gy < GH - 1; gy++) for (let gx = 1; gx < GW - 1; gx++) {
    const i = gy * GW + gx; if (grid[i] !== 2 && grid[i] !== 4) continue;
    const sx = (TH[i + 1] - TH[i - 1]) / (2 * CS), sy = (TH[i + GW] - TH[i - GW]) / (2 * CS);
    if (Math.hypot(sx, sy) > 1.1 && TH[i] > WATER_Y) grid[i] = 10;
  }
  // на скалах и выше снеговой линии леса нет
  trees = trees.filter(t => { const i = clamp(Math.floor(t.y / CS), 0, GH - 1) * GW + clamp(Math.floor(t.x / CS), 0, GW - 1); return grid[i] !== 10 && grid[i] !== 9 && TH[i] < SNOW_H - 20 && waterD(t.x, t.y) > 5; });
}
function slopeK(x0, y0, x1, y1) {
  const d = Math.hypot(x1 - x0, y1 - y0); if (d < .01) return 1;
  const s = (gY(x1, y1) - gY(x0, y0)) / d;
  return clamp(1 - s * 1.3, .45, 1.15);
}
