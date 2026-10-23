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
let buildings = [], trees = [], cars = [], lamps = [], fountains = [], fences = [], special = {}, blocks = [];
let barrDirty = true, gridDirty = true;
function fillCells(x0, y0, x1, y1, v) {
  for (let y = Math.max(0, Math.floor(y0 / CS)); y < Math.min(GH, Math.ceil(y1 / CS)); y++)
    for (let x = Math.max(0, Math.floor(x0 / CS)); x < Math.min(GW, Math.ceil(x1 / CS)); x++) grid[y * GW + x] = v;
}
// район: 0 центр с небоскрёбами, 1 жилые многоэтажки, 2 частный сектор
// планировки: пороги районов (радиус от центра), способ построения сети улиц
const LAYOUTS = {
  grid: { n: "Классическая сетка", d: [.36, .82], gen: "grid" },
  organic: { n: "Живой город", d: [.3, .82], gen: "organic" },
  ring: { n: "Кольцевой город", d: [.3, .85], gen: "ring" },
  radial: { n: "Город звёзд", d: [.3, .86], gen: "radial" },
  diag: { n: "Диагонали", d: [.36, .82], gen: "diag" },
  winding: { n: "Извилистые улицы", d: [.25, .8], gen: "winding" },
  old: { n: "Исторический центр", d: [.15, .8], old: true, wall: true, gen: "old" },
  park: { n: "Город-парк", d: [.3, .85], park: true, gen: "park" },
  mega: { n: "Мегаполис", d: [.62, 1.1], gen: "mega" },
  suburb: { n: "Пригород", d: [.12, .38], compact: true, gen: "suburb" },
  industry: { n: "Промзона", d: [.25, .85], industry: .45, gen: "industry" },
  river: { n: "Город на реке", d: [.3, .8], river: true, hidden: true, gen: "organic" },
  port: { n: "Портовый город", d: [.3, .78], sea: true, industry: .25, hidden: true, gen: "organic" },
  mountain: { n: "Горный городок", d: [.3, .8], hills: true, ridges: 2, hidden: true, gen: "winding" },
  valley: { n: "Долина", d: [.28, .82], river: true, hills: true, ridges: "long", hidden: true, gen: "winding" },
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
// дорога за городом — без тротуаров
function markRural() { for (const e of RE) { let n = 0, out = 0; for (let t = 0; t <= e.len; t += 20) { const p = edgePos(e, t); n++; if (cityK(p.x, p.y) < .42) out++; } e.rural = out / n > .55; } }
function genCity(layout = "random") {
  layoutKey = layout === "random" || !LAYOUTS[layout] ? pick(Object.keys(LAYOUTS).filter(k => !LAYOUTS[k].hidden)) : layout; L = LAYOUTS[layoutKey];
  for (let attempt = 0; attempt < 4; attempt++) {
    grid.fill(2); bhp.fill(0); TH.fill(0); underRubble.fill(0);
    buildings = []; trees = []; cars = []; lamps = []; fountains = []; fences = []; special = {}; blocks = []; waters = []; bridges = []; walls = [];
    RN = []; RE = []; RL = []; rounds = []; presets = []; zoneAt = () => null; oldTown = null; bigPark = null; ponds = []; routeCache.clear(); exitRoute = null;
    prepareWater();
    LAYOUT_GEN[L.gen || layoutKey]();
    markRural(); finishGraph();
    rasterRoads(); computeRegions(); fillCity();
    if (RE.length > 30 && Object.keys(special).length >= 7 && RN.some(n => n.exit)) break;
  }
  fillTerrain(); sinkPonds(); flattenRoads(); finishTerrain();
  lamps = lamps.filter(l => cellAt(l.x, l.y) === 1);
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
