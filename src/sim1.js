/* ---------- масштаб: 1 единица = 25 см; человек 7 ед., этаж 12 ед., город 600 × 400 м ---------- */
const W = 2400, H = 1600, CS = 8, GW = W / CS, GH = H / CS;
const $ = id => document.getElementById(id);
const clamp = (v, a = 0, b = 1) => v < a ? a : v > b ? b : v;
const rnd = (a = 0, b = 1) => a + Math.random() * (b - a);
const pick = a => a[Math.floor(Math.random() * a.length)];
const TAU = Math.PI * 2;

/* ---------- город ---------- */
// клетки: 0 асфальт, 1 тротуар, 2 газон, 3 здание, 4 дерево, 5 машина, 6 баррикада, 7 площадь, 8 завал
const grid = new Uint8Array(GW * GH), bhp = new Float32Array(GW * GH);
const BLOCK = c => c === 3 || c === 4 || c === 5 || c === 6 || c === 9 || c === 10;
const cellAt = (x, y) => grid[clamp(Math.floor(y / CS), 0, GH - 1) * GW + clamp(Math.floor(x / CS), 0, GW - 1)];
let buildings = [], trees = [], cars = [], lamps = [], fountains = [], fences = [], special = {}, blocks = [], streets = [], lanes = [];
let barrDirty = true, gridDirty = true;
function fillCells(x0, y0, x1, y1, v) {
  for (let y = Math.max(0, Math.floor(y0 / CS)); y < Math.min(GH, Math.ceil(y1 / CS)); y++)
    for (let x = Math.max(0, Math.floor(x0 / CS)); x < Math.min(GW, Math.ceil(x1 / CS)); x++) grid[y * GW + x] = v;
}
// район: 0 центр с небоскрёбами, 1 жилые многоэтажки, 2 частный сектор
// планировки: пороги районов, вода, промзона
// irregular: 0 — ровная сетка, 1 — живая застройка с кварталами разного размера и улицами, что кончаются на перекрёстках
const LAYOUTS = {
  grid: { n: "Классическая сетка", d: [.36, .82], irregular: 0 },
  river: { n: "Город на реке", d: [.3, .8], river: true, irregular: .6, hidden: true },
  port: { n: "Портовый город", d: [.3, .78], sea: true, industry: .25, irregular: .55, hidden: true },
  mega: { n: "Мегаполис", d: [.62, 1.1], irregular: .35 },
  old: { n: "Исторический центр", d: [.15, .8], old: true, irregular: .8, wall: true },
  park: { n: "Город-парк", d: [.3, .85], park: true, irregular: .6 },
  suburb: { n: "Пригород", d: [.12, .38], irregular: .85, compact: true },
  industry: { n: "Промзона", d: [.25, .85], industry: .45, irregular: .5 },
  ring: { n: "Кольцевой город", d: [.3, .85], irregular: .5, blockK: 1.5, curves: "ring" },
  radial: { n: "Лучевой город", d: [.3, .9], irregular: .45, blockK: 1.9, curves: "radial" },
  diag: { n: "Диагонали", d: [.36, .82], irregular: 0, curves: "diag" },
  winding: { n: "Извилистые улицы", d: [.25, .8], irregular: .7, blockK: 1.3, curves: "winding" },
  mountain: { n: "Горный городок", d: [.3, .8], hills: true, ridges: 2, irregular: .8, hidden: true },
  valley: { n: "Долина", d: [.28, .82], river: true, hills: true, ridges: "long", irregular: .7, hidden: true },
};
let L = LAYOUTS.grid, layoutKey = "grid", waters = [], bridges = [], walls = [];
function districtOf(x, y) { const r = Math.hypot((x - W / 2) / (W / 2), (y - H / 2) / (H / 2)); return r < L.d[0] ? 0 : r < L.d[1] ? 1 : 2; }
const CARC = ["#8e1f1f", "#24497a", "#d8d8d4", "#1d1f22", "#5f6366", "#b59532", "#2f5a3a", "#6d2c4f", "#9aa0a4", "#e0e0dc", "#30343a"];
function addBuilding(bb) {
  bb.h = bb.floors * (bb.kind === "house" ? 11 : 12);
  bb.fire = 0; bb.scorch = 0; bb.hp = 100 + bb.floors * 6 + (bb.x1 - bb.x0) * (bb.y1 - bb.y0) / 400; bb.maxHp = bb.hp;
  bb.state = "ok"; bb.ruinH = 0; bb.cT = 0;
  buildings.push(bb); fillCells(bb.x0, bb.y0, bb.x1, bb.y1, 3);
  return bb;
}
function genCity(layout = "random") {
  layoutKey = layout === "random" ? pick(Object.keys(LAYOUTS).filter(k => !LAYOUTS[k].hidden)) : layout; L = LAYOUTS[layoutKey];
  grid.fill(0); bhp.fill(0); TH.fill(0);
  buildings = []; trees = []; cars = []; lamps = []; fountains = []; fences = []; special = {}; blocks = []; streets = []; lanes = []; waters = []; bridges = []; walls = [];
  prepareWater();
  if ((L.irregular || 0) > 0) bspStreets(L.irregular); else gridStreets();
  // вода и окрестности: кварталы у воды — берега, за пятном города — поля, луга, леса
  shapeWorld();
  prepareSpecialDistricts(); prepareTerrain();
  for (const b of blocks) {
    if (b.kind === "bigpark" || b.kind === "hill" || b.rural) continue;
    const r = Math.random();
    b.kind = b.d === 0 ? (r < .07 ? "plaza" : r < .12 ? "park" : "towers")
      : b.d === 1 ? (r < (L.industry || 0) ? "industry" : r < (L.industry || 0) + .1 ? "park" : r < (L.industry || 0) + .15 ? "lot" : r < (L.industry || 0) + .19 ? "plaza" : "houses")
      : (r < .12 ? "park" : "suburb");
  }
  for (const k of ["hospital", "police", "mall", "fire", "power", "water", "radio"]) {
    const free = blocks.filter(b => b.kind === "houses" || (k !== "hospital" && k !== "mall" && b.kind === "industry"));
    if (free.length) pick(free).kind = k;
  }
  for (const b of blocks) {
    if (b.kind === "bigpark") continue;
    if (b.kind === "hill") { fillCells(b.x0, b.y0, b.x1, b.y1, 2); continue; }
    if (b.rural) continue;
    fillCells(b.x0, b.y0, b.x1, b.y1, 1);
    const ix0 = b.x0 + 8, iy0 = b.y0 + 8, ix1 = b.x1 - 8, iy1 = b.y1 - 8;
    const cx = (b.x0 + b.x1) / 2, cy = (b.y0 + b.y1) / 2;
    // фонари вдоль бордюра
    for (let x = b.x0 + 20; x < b.x1 - 10; x += 62) { lamps.push({ x, y: b.y0 + 2, f: 0 }); lamps.push({ x, y: b.y1 - 2, f: 1 }); }
    for (let y = b.y0 + 40; y < b.y1 - 30; y += 62) { lamps.push({ x: b.x0 + 2, y, f: 2 }); lamps.push({ x: b.x1 - 2, y, f: 3 }); }
    if (b.kind === "park") {
      fillCells(ix0, iy0, ix1, iy1, 2);
      const n = (ix1 - ix0) * (iy1 - iy0) / 1300;
      for (let t = 0; t < n; t++) { const x = rnd(ix0 + 8, ix1 - 8), y = rnd(iy0 + 8, iy1 - 8); trees.push({ x, y, r: rnd(7, 13), h: rnd(16, 30) }); fillCells(x - 3, y - 3, x + 3, y + 3, 4); }
    } else if (b.kind === "plaza") {
      fillCells(ix0, iy0, ix1, iy1, 7);
      fountains.push({ x: cx, y: cy, r: 12 }); fillCells(cx - 10, cy - 10, cx + 10, cy + 10, 3);
    } else if (b.kind === "lot") {
      // парковка: асфальт и ряды машин
      fillCells(ix0, iy0, ix1, iy1, 0); b.lot = true;
      for (let y = iy0 + 14; y < iy1 - 10; y += 30) for (let x = ix0 + 8; x < ix1 - 8; x += 11) if (Math.random() < .7) {
        cars.push({ x, y, ang: Math.PI / 2 + (Math.random() < .5 ? 0 : Math.PI), col: pick(CARC), wreck: false, boomT: 0, burnT: 0 });
        fillCells(x - 3, y - 8, x + 3, y + 8, 5);
      }
    } else if (b.kind === "towers") {
      // центр: 1–3 башни на квартал, у подножия площадь
      fillCells(ix0, iy0, ix1, iy1, 7);
      const n = Math.random() < .35 ? 1 : 2, vert = (ix1 - ix0) > (iy1 - iy0);
      for (let p = 0; p < n; p++) {
        const span = ((vert ? ix1 - ix0 : iy1 - iy0) - 14 * (n - 1)) / n, a = (vert ? ix0 : iy0) + p * (span + 14);
        const inset = rnd(4, 12), bb = vert ? { x0: a + inset * .5, y0: iy0 + inset, x1: a + span - inset * .5, y1: iy1 - inset } : { x0: ix0 + inset, y0: a + inset * .5, x1: ix1 - inset, y1: a + span - inset * .5 };
        if (bb.x1 - bb.x0 < 24 || bb.y1 - bb.y0 < 24) continue;
        bb.kind = "tower"; bb.floors = Math.round(rnd(12, 34)); bb.style = 8 + Math.floor(Math.random() * 3);
        addBuilding(bb);
      }
    } else if (b.kind === "houses") {
      // жилой квартал делится на 2–4 дома с проходами по 2,5 м
      const vert = (ix1 - ix0) > (iy1 - iy0), n = Math.floor(rnd(2, 4.99)), parts = [];
      let cur = vert ? ix0 : iy0; const end = vert ? ix1 : iy1;
      for (let p = 0; p < n; p++) { const len = (end - cur - (n - p - 1) * 10) / (n - p) * rnd(.8, 1.2); parts.push([cur, Math.min(end, cur + len)]); cur += len + 10; }
      const r = Math.hypot((cx - W / 2) / (W / 2), (cy - H / 2) / (H / 2));
      for (const [a, z] of parts) {
        if (z - a < 16) continue;
        const bb = vert ? { x0: a, y0: iy0, x1: z, y1: iy1 } : { x0: ix0, y0: a, x1: ix1, y1: z };
        bb.kind = "apt"; bb.floors = clamp(Math.round(rnd(3, 12) * (1.25 - r * .7)), 3, 12); bb.style = Math.floor(Math.random() * 5);
        addBuilding(bb);
      }
    } else if (b.kind === "industry") {
      // склады и контейнеры
      fillCells(ix0, iy0, ix1, iy1, 0); b.lot = true;
      const vert = (ix1 - ix0) > (iy1 - iy0), n = Math.random() < .5 ? 1 : 2;
      for (let p = 0; p < n; p++) {
        const span = ((vert ? ix1 - ix0 : iy1 - iy0) - 20 * (n - 1)) / n, a = (vert ? ix0 : iy0) + p * (span + 20);
        const bb = vert ? { x0: a + 4, y0: iy0 + 6, x1: a + span - 4, y1: iy1 - 22 } : { x0: ix0 + 6, y0: a + 4, x1: ix1 - 22, y1: a + span - 4 };
        if (bb.x1 - bb.x0 > 24 && bb.y1 - bb.y0 > 24) { bb.kind = "warehouse"; bb.floors = Math.random() < .5 ? 2 : 3; bb.style = 15; addBuilding(bb); }
      }
      for (let i = 0; i < 6; i++) { const x = vert ? rnd(ix0 + 12, ix1 - 12) : ix1 - 11, y = vert ? iy1 - 11 : rnd(iy0 + 12, iy1 - 12); const cb = { x0: x - (vert ? 12 : 4), x1: x + (vert ? 12 : 4), y0: y - (vert ? 4 : 12), y1: y + (vert ? 4 : 12), kind: "container", floors: 1, style: 16 + Math.floor(Math.random() * 4) }; if (cellAt(x, y) === 0) { addBuilding(cb); cb.h = Math.random() < .5 ? 10 : 20; } }
    } else if (b.kind === "suburb") {
      // частный сектор: участки с домиками, газоны, деревья, заборы
      fillCells(ix0, iy0, ix1, iy1, 2);
      const nx = Math.max(1, Math.round((ix1 - ix0) / 40)), ny = Math.max(1, Math.round((iy1 - iy0) / 44));
      const lw = (ix1 - ix0) / nx, lh = (iy1 - iy0) / ny;
      for (let i = 0; i < nx; i++) for (let j = 0; j < ny; j++) {
        const lx0 = ix0 + i * lw, ly0 = iy0 + j * lh;
        if (i > 0) fences.push([lx0, ly0 + 3, lx0, ly0 + lh - 3]);
        if (j > 0) fences.push([lx0 + 3, ly0, lx0 + lw - 3, ly0]);
        if (Math.random() < .08) continue; // пустой участок
        const w = Math.min(lw - 12, rnd(18, 26)), d = Math.min(lh - 12, rnd(16, 22));
        const hx0 = lx0 + (lw - w) / 2 + rnd(-2, 2), hy0 = ly0 + (lh - d) / 2 + rnd(-2, 2);
        addBuilding({ x0: hx0, y0: hy0, x1: hx0 + w, y1: hy0 + d, kind: "house", floors: Math.random() < .55 ? 1 : 2, style: 11 + Math.floor(Math.random() * 4), ridge: w > d ? "x" : "z" });
        if (Math.random() < .6) { const tx = lx0 + rnd(4, lw - 4), ty = ly0 + (Math.random() < .5 ? rnd(3, 6) : lh - rnd(3, 6)); if (cellAt(tx, ty) === 2) { trees.push({ x: tx, y: ty, r: rnd(5, 9), h: rnd(12, 22) }); fillCells(tx - 2, ty - 2, tx + 2, ty + 2, 4); } }
      }
    } else {
      const bb = { x0: ix0, y0: iy0, x1: ix1, y1: iy1, kind: b.kind, floors: b.kind === "hospital" ? 7 : b.kind === "fire" || b.kind === "water" || b.kind === "radio" ? 2 : 3, style: b.kind === "hospital" ? 5 : b.kind === "police" ? 6 : b.kind === "fire" ? 20 : b.kind === "power" || b.kind === "water" ? 15 : b.kind === "radio" ? 6 : 7 };
      if (b.kind === "power" || b.kind === "water" || b.kind === "radio") { bb.x0 = ix0 + (ix1 - ix0) * .2; bb.x1 = ix1 - (ix1 - ix0) * .2; bb.y0 = iy0 + (iy1 - iy0) * .2; bb.y1 = iy1 - (iy1 - iy0) * .2; fillCells(ix0, iy0, ix1, iy1, b.kind === "radio" ? 2 : 0); b.lot = b.kind !== "radio"; }
      addBuilding(bb);
      special[b.kind] = { x: cx, y: b.y1 + 3, b: bb };
    }
  }
  buildSpecialDistricts(); buildRural(); buildWalls();
  genCurves();
  // вода поверх всего: клетки в воде — вода, мосты — дорога
  for (let gy = 0; gy < GH; gy++) for (let gx = 0; gx < GW; gx++) { const x = gx * CS + 4, y = gy * CS + 4; if (waterAt(x, y)) grid[gy * GW + gx] = 9; }
  for (const b of bridges) fillCells(b.x0, b.y0, b.x1, b.y1, 0);
  buildings = buildings.filter(b => { const inW = waterAt(b.x0, b.y0) || waterAt(b.x1, b.y0) || waterAt(b.x0, b.y1) || waterAt(b.x1, b.y1) || waterAt((b.x0 + b.x1) / 2, (b.y0 + b.y1) / 2); if (inW) fillCells(b.x0, b.y0, b.x1, b.y1, 2); return !inW; });
  trees = trees.filter(t => !waterAt(t.x, t.y));
  fillTerrain(); for (const b of blocks) if (b.kind === "hill") hillBlock2(b); sinkPonds(); flattenRoads(); finishTerrain();
  lamps = lamps.filter(l => cellAt(l.x, l.y) !== 9 && cellAt(l.x, l.y) !== 2);
  // припаркованные вдоль бордюров машины, в частном секторе их меньше
  for (let i = 0; i < 260; i++) {
    const b = pick(blocks); if (b.rural || b.kind === "hill" || (b.d === 2 && Math.random() < .6)) continue;
    const vertical = Math.random() < .5;
    const x = vertical ? (Math.random() < .5 ? b.x0 - 6 : b.x1 + 6) : rnd(b.x0 + 12, b.x1 - 12);
    const y = vertical ? rnd(b.y0 + 12, b.y1 - 12) : (Math.random() < .5 ? b.y0 - 6 : b.y1 + 6);
    const hw = vertical ? 4 : 9, hh = vertical ? 9 : 4;
    let ok = true;
    for (let yy = y - hh + 1; yy <= y + hh - 1; yy += 2) for (let xx = x - hw + 1; xx <= x + hw - 1; xx += 2) if (cellAt(xx, yy) !== 0) ok = false;
    if (!ok) continue;
    // не ставим на полосу движения узкой улицы
    for (const s of streets) { if (s.gone || s.edge) continue; const lat = s.v ? x : y, along = s.v ? y : x; if (along < s.a0 || along > s.a1) continue; if (Math.abs(lat - s.p) < s.hw && Math.abs(Math.abs(lat - s.p) - s.hw * .45) < 6.5) ok = false; }
    if (!ok) continue;
    cars.push({ x, y, ang: vertical ? Math.PI / 2 : 0, col: pick(CARC), wreck: false, boomT: 0, burnT: 0 });
    fillCells(x - hw, y - hh, x + hw, y + hh, 5);
  }
  // полосы для движения: правостороннее, по одной в каждую сторону
  for (const s of streets) {
    if (s.edge || s.water || s.gone) continue;
    const off = s.hw * .45;
    lanes.push({ s, dir: s.v ? 1 : 0, c: s.p + (s.v ? -off : off), a0: s.a0, a1: s.a1 });  // dir: 0 +x, 1 +y, 2 −x, 3 −y
    lanes.push({ s, dir: s.v ? 3 : 2, c: s.p + (s.v ? off : -off), a0: s.a0, a1: s.a1 });
  }
}
const blocked = (x, y) => x < 1 || y < 1 || x >= W - 1 || y >= H - 1 || BLOCK(cellAt(x, y));
function los(x0, y0, x1, y1) {
  const d = Math.hypot(x1 - x0, y1 - y0), n = Math.ceil(d / (CS * .7));
  for (let i = 1; i < n; i++) { const t = i / n, c = cellAt(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t); if (c === 3 || c === 6 || c === 5 || c === 4 || c === 10) return false; }
  return true;
}

/* ---------- поля расстояний по улицам (алгоритм Дейкстры с корзинами) ---------- */
// баррикада проходима «дорого»: зомби идут к ней и ломают, а не теряют след
const FAR = 32000;
const underRubble = new Uint8Array(GW * GH);
const fZ = new Int16Array(GW * GH), fH = new Int16Array(GW * GH), fE = new Int16Array(GW * GH), fInf = new Int16Array(GW * GH), fC = new Int16Array(GW * GH);
const RING = 16, ring = Array.from({ length: RING }, () => []);
const NB4 = [[1, 0], [-1, 0], [0, 1], [0, -1]];
function bfs(field, sources) {
  field.fill(FAR);
  let pending = 0;
  for (const s of sources) {
    const i = clamp(Math.floor(s.y / CS), 0, GH - 1) * GW + clamp(Math.floor(s.x / CS), 0, GW - 1);
    if (field[i] !== 0) { field[i] = 0; ring[0].push(i); pending++; }
  }
  for (let d = 0; pending > 0 && d < 3000; d++) {
    const b = ring[d % RING];
    while (b.length) {
      const i = b.pop(); pending--;
      if (field[i] !== d) continue;
      const x = i % GW, y = (i / GW) | 0;
      for (const [dx, dy] of NB4) {
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= GW || ny >= GH) continue;
        const j = ny * GW + nx, c = grid[j];
        if (c === 3 || c === 4 || c === 5 || c === 9 || c === 10) continue;
        const nd = d + (c === 6 ? 9 : c === 8 ? 3 : 1);
        if (nd < field[j]) { field[j] = nd; ring[nd % RING].push(j); pending++; }
      }
    }
  }
  for (const b of ring) b.length = 0;
}
const NB8 = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];
function fieldVal(field, x, y) { return field[clamp(Math.floor(y / CS), 0, GH - 1) * GW + clamp(Math.floor(x / CS), 0, GW - 1)]; }
// направление по полю: к источнику или прочь от него
function fieldDir(field, x, y, away) {
  const gx = Math.floor(x / CS), gy = Math.floor(y / CS), v0 = fieldVal(field, x, y);
  if (v0 >= FAR) return null;
  let best = null, bv = v0;
  for (const [dx, dy] of NB8) {
    const nx = gx + dx, ny = gy + dy;
    if (nx < 0 || ny < 0 || nx >= GW || ny >= GH) continue;
    const v = field[ny * GW + nx];
    if (v >= FAR) continue;
    if (dx && dy && (field[gy * GW + nx] >= FAR || field[ny * GW + gx] >= FAR)) continue; // не срезать углы домов
    if (away ? v > bv : v < bv) { bv = v; best = [dx, dy]; }
  }
  if (!best) return null;
  const l = Math.hypot(best[0], best[1]);
  // целимся в центр следующей клетки, чтобы не тереться о стены
  const tx = (gx + best[0] + .5) * CS - x, ty = (gy + best[1] + .5) * CS - y, tl = Math.hypot(tx, ty) || 1;
  return [best[0] / l * .5 + tx / tl * .5, best[1] / l * .5 + ty / tl * .5];
}
