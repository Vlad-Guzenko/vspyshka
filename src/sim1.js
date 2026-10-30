/* ---------- масштаб: 1 единица = 25 см; человек 7 ед., этаж 12 ед.; мир 900 × 600 м (большая карта — 1300 × 900 м), город в нём — около 660 × 440 м ---------- */
// CITY_W, CITY_H — рамка города: по ней строятся планировки и районы; вокруг — пригороды, поля, посёлки, трассы к краям карты.
// Размер карты выбирается в диалоге новой игры (setMapSize): W, H, GW, GH и рамка города меняются, а все сетки клеток выделены
// один раз под большую карту (GMAX) и индексируются текущим GW — так их не надо пересоздавать при смене размера
const CS = 8;
const MAP_SIZES = { normal: { n: "Обычная", desc: "900 × 600 м", W: 3600, H: 2400, CITY_W: 2640, CITY_H: 1760 }, big: { n: "Большая", desc: "1300 × 900 м, больше районов и ферм", W: 5200, H: 3600, CITY_W: 3800, CITY_H: 2640, traffic: .62 } };
const MOUNT_W = 2400; // горная страна: полоса за городом с одной стороны (600 м), карта становится шире
const MAX_W = MAP_SIZES.big.W + MOUNT_W, MAX_H = MAP_SIZES.big.H; // самая большая карта: под неё заведены все сетки клеток и хэши соседей
const GMAX = (MAX_W / CS) * (MAX_H / CS);
let mapSize = "normal", W = 3600, H = 2400, GW = W / CS, GH = H / CS, CITY_W = 2640, CITY_H = 1760;
function setMapSize(k) { const M = MAP_SIZES[k] || MAP_SIZES.normal; mapSize = MAP_SIZES[k] ? k : "normal"; W = M.W + (relief === "mountains" ? MOUNT_W : 0); H = M.H; GW = W / CS; GH = H / CS; CITY_W = M.CITY_W; CITY_H = M.CITY_H; }
const $ = id => document.getElementById(id);
const clamp = (v, a = 0, b = 1) => v < a ? a : v > b ? b : v;
const rnd = (a = 0, b = 1) => a + Math.random() * (b - a);
const pick = a => a[Math.floor(Math.random() * a.length)];
const TAU = Math.PI * 2;

/* ---------- город ---------- */
// клетки: 0 асфальт, 1 тротуар, 2 газон, 3 здание, 4 дерево, 5 машина, 6 баррикада, 7 площадь, 8 завал
const grid = new Uint8Array(GMAX), bhp = new Float32Array(GMAX);
const BLOCK = c => c === 3 || c === 4 || c === 5 || c === 6 || c === 9 || c === 10;
const cellAt = (x, y) => grid[clamp(Math.floor(y / CS), 0, GH - 1) * GW + clamp(Math.floor(x / CS), 0, GW - 1)];
let buildings = [], trees = [], cars = [], lamps = [], fountains = [], fences = [], special = {}, blocks = [], props = [];
let barrDirty = true, gridDirty = true;
function fillCells(x0, y0, x1, y1, v) {
  for (let y = Math.max(0, Math.floor(y0 / CS)); y < Math.min(GH, Math.ceil(y1 / CS)); y++)
    for (let x = Math.max(0, Math.floor(x0 / CS)); x < Math.min(GW, Math.ceil(x1 / CS)); x++) grid[y * GW + x] = v;
}
// район: 0 центр с небоскрёбами, 1 жилые многоэтажки, 2 частный сектор; lakes — где у планировки озёра: в городе, в парке или за городом
// планировки: пороги районов (радиус от центра), способ построения сети улиц
const LAYOUTS = {
  grid: { n: "Классическая сетка", d: [.36, .82], gen: "grid", lakes: "rural" },
  organic: { n: "Живой город", d: [.3, .82], gen: "organic", lakes: "city" },
  ring: { n: "Кольцевой город", d: [.3, .85], gen: "ring", lakes: "rural" },
  radial: { n: "Город звёзд", d: [.3, .86], gen: "radial", lakes: "rural" },
  diag: { n: "Диагонали", d: [.36, .82], gen: "diag", lakes: "rural" },
  winding: { n: "Извилистые улицы", d: [.25, .8], gen: "winding", lakes: "rural" },
  old: { n: "Исторический центр", d: [.15, .8], old: true, wall: true, gen: "old", lakes: "rural" },
  park: { n: "Город-парк", d: [.3, .85], park: true, gen: "park", lakes: "park" },
  mega: { n: "Мегаполис", d: [.62, 1.1], gen: "mega", lakes: "rural" },
  suburb: { n: "Пригород", d: [.12, .38], compact: true, gen: "suburb", lakes: "rural" },
  industry: { n: "Промзона", d: [.25, .85], industry: .45, gen: "industry", lakes: "rural" },
  river: { n: "Город на реке", d: [.3, .8], river: true, hidden: true, gen: "organic" },
  port: { n: "Портовый город", d: [.3, .78], sea: true, industry: .25, hidden: true, gen: "organic" },
  mountain: { n: "Горный городок", d: [.3, .8], hills: true, ridges: 2, hidden: true, gen: "winding" },
  valley: { n: "Долина", d: [.28, .82], river: true, hills: true, ridges: "long", hidden: true, gen: "winding" },
};
let L = LAYOUTS.grid, layoutKey = "grid", waters = [], bridges = [], walls = [];
function districtOf(x, y) { const r = Math.hypot((x - W / 2) / (CITY_W / 2), (y - H / 2) / (CITY_H / 2)); return r < L.d[0] ? 0 : r < L.d[1] ? 1 : 2; }
// высота этажа: у домов частного сектора, дач, усадеб и ферм ниже, у гаражей совсем низкие боксы
const LOW_KINDS = new Set(["house", "cottage", "dacha", "farmhouse", "manor"]);
function floorH(kind) { return kind === "garages" ? 9 : LOW_KINDS.has(kind) ? 11 : 12; }
const CARC = ["#8e1f1f", "#24497a", "#d8d8d4", "#1d1f22", "#5f6366", "#b59532", "#2f5a3a", "#6d2c4f", "#9aa0a4", "#e0e0dc", "#30343a"];
function addBuilding(bb) {
  bb.h = bb.floors * floorH(bb.kind);
  bb.fire = 0; bb.scorch = 0; bb.hp = 100 + bb.floors * 6 + (bb.x1 - bb.x0) * (bb.y1 - bb.y0) / 400; bb.maxHp = bb.hp;
  bb.state = "ok"; bb.ruinH = 0; bb.cT = 0;
  buildings.push(bb); fillCells(bb.x0, bb.y0, bb.x1, bb.y1, 3);
  return bb;
}
// дорога за городом — без тротуаров
function markRural() { for (const e of RE) { let n = 0, out = 0; for (let t = 0; t <= e.len; t += 20) { const p = edgePos(e, t); n++; if (cityK(p.x, p.y) < .42) out++; } e.rural = out / n > .55; } }
function genCity(layout = "random") {
  setMapSize(mapSize);
  layoutKey = layout === "random" || !LAYOUTS[layout] ? pick(Object.keys(LAYOUTS).filter(k => !LAYOUTS[k].hidden)) : layout; L = LAYOUTS[layoutKey];
  WIDE_SEED = Math.random() * 1000; // какие улицы будут широкими — в каждом городе по-своему
  for (let attempt = 0; attempt < 4; attempt++) {
    grid.fill(2); bhp.fill(0); TH.fill(0); underRubble.fill(0);
    buildings = []; trees = []; cars = []; lamps = []; fountains = []; fences = []; special = {}; blocks = []; props = []; waters = []; bridges = []; walls = []; hydrants = [];
    RN = []; RE = []; RL = []; rounds = []; presets = []; zoneAt = () => null; oldTown = null; bigPark = null; ponds = []; routeCache.clear(); exitRoute = null;
    prepareWater();
    LAYOUT_GEN[L.gen || layoutKey]();
    placeLakes(); // озёра за городом — после дорог, в стороне от них
    buildMountainRoads(); // трассы к горным сторонам — серпантином до перевала (mountain.js)
    dropValleyLakeOnRoads(); // горная дорога прошла через долину — озера там не будет (terrain.js)
    markRural(); finishGraph();
    rasterRoads(); computeRegions(); fillCity(); buildCrossMask();
    if (RE.length > 30 && Object.keys(special).length >= 7 && RN.some(n => n.exit)) break;
  }
  fillTerrain(); sinkPonds(); benchRoads(); flattenRoads(); levelTerraces(); finishTerrain(); planCableCar();
  lamps = lamps.filter(l => cellAt(l.x, l.y) === 1);
  buildBusLines();
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
const underRubble = new Uint8Array(GMAX);
const fZ = new Int16Array(GMAX), fH = new Int16Array(GMAX), fE = new Int16Array(GMAX), fInf = new Int16Array(GMAX), fC = new Int16Array(GMAX);
const RING = 16, ring = Array.from({ length: RING }, () => []);
const NB4 = [[1, 0], [-1, 0], [0, 1], [0, -1]];
// зебры: клетки проезжей части, где пешеходам можно переходить
const crossMask = new Uint8Array(GMAX);
// стоимость клетки для пешехода: тротуар, газон, площадь — 1; проезжая часть вне зебры — 8; завал — непроходим (зомби карабкаются)
// mode: 0 пешеход, 1 зомби (карабкается по завалам, дорог не боится), 2 техника и танк (по дорогам и завалам, тротуар хуже)
function walkCost(j, mode) { const c = grid[j]; if (c === 8) return mode ? 3 : 0; if (c === 6) return mode === 1 ? 9 : 0; if (c === 0 && roadMask[j] === 1 && !crossMask[j]) return mode ? 1 : 8; return mode === 2 && roadMask[j] !== 1 ? 2 : 1; }
// цена шага в клетку j для поиска путей: 0 — нельзя. Стены, деревья, машины, вода, скалы непроходимы; завал — только зомби и технике;
// баррикада — только зомби (ломают); проезжая часть вне зебры пешеходу дорога (8). wall6 — баррикада непроходима для всех (поиск в коробке)
function stepCost(j, mode, wall6) {
  const c = grid[j];
  if (c === 3 || c === 4 || c === 5 || c === 9 || c === 10) return 0;
  if (c === 8) return mode ? 3 : 0;
  if (c === 6) return wall6 || mode !== 1 ? 0 : 9;
  if (c === 11) return 4; // сугроб: бредут медленно
  if (c === 0 && roadMask[j] === 1 && !crossMask[j]) return mode ? 1 : 8;
  return mode === 2 && roadMask[j] !== 1 ? 2 : 1;
}
// поле расстояний (алгоритм Дейкстры с кольцом корзин, веса 1–9): соседи развёрнуты вручную —
// раньше обход шёл через for…of по массиву пар, и под эпидемию на это уходила треть шага симуляции
function bfs(field, sources, mode, maxD = 3000) {
  const N = GW * GH;
  field.fill(FAR, 0, N); // сетка выделена под большую карту, чистим только используемую часть
  let pending = 0;
  for (const s of sources) {
    const i = clamp(Math.floor(s.y / CS), 0, GH - 1) * GW + clamp(Math.floor(s.x / CS), 0, GW - 1);
    if (field[i] !== 0) { field[i] = 0; ring[0].push(i); pending++; }
  }
  for (let d = 0; pending > 0 && d < maxD; d++) {
    const b = ring[d % RING];
    while (b.length) {
      const i = b.pop(); pending--;
      if (field[i] !== d) continue;
      const x = i % GW;
      for (let k = 0; k < 4; k++) {
        let j;
        if (k === 0) { if (x + 1 >= GW) continue; j = i + 1; } else if (k === 1) { if (x === 0) continue; j = i - 1; }
        else if (k === 2) { j = i + GW; if (j >= N) continue; } else { j = i - GW; if (j < 0) continue; }
        const wc = stepCost(j, mode, false); if (!wc) continue;
        const nd = d + wc;
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
