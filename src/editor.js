/* ---------- редактор города: дороги, дома, парки, снос ---------- */
let editRoads = [], editMode = false, edDrag = null;
const ED_TOOLS = [
  { k: "ed_road", n: "Дорога", c: "#4a4d50", tip: "<b>Дорога:</b> веди мышью — асфальт шириной 4 м. Дома и деревья не трогает." },
  { k: "ed_apt", n: "Многоэтажка", c: "#b9ad98", tip: "<b>Многоэтажка:</b> протяни прямоугольник на свободном месте. Этажность — колесом над кнопкой «Этажи»." },
  { k: "ed_tower", n: "Небоскрёб", c: "#4e7d9c", tip: "<b>Небоскрёб:</b> протяни прямоугольник. Стеклянная башня 15–35 этажей." },
  { k: "ed_house", n: "Частный дом", c: "#a8634a", tip: "<b>Частный дом:</b> клик — домик с двускатной крышей." },
  { k: "ed_park", n: "Парк", c: "#4b6e35", tip: "<b>Парк:</b> протяни прямоугольник — газон с деревьями." },
  { k: "ed_tree", n: "Деревья", c: "#2c4f28", tip: "<b>Деревья:</b> веди мышью — сажаешь деревья." },
  { k: "ed_bulldoze", n: "Снести", c: "#c0392b", tip: "<b>Снести:</b> клик по дому — дом исчезает, остаётся пустой участок. По дереву — дерево убирается." },
];
let edFloors = 8;
function toggleEditor(on) {
  editMode = on; tool = on ? "ed_road" : "watch"; renderTools();
  $("editBtn").setAttribute("aria-pressed", on); $("editBtn").textContent = on ? "Закончить редактирование" : "Редактор города";
  if (on) { setPaused(true); logE("Редактор: симуляция на паузе"); }
}
function freeRect(x0, y0, x1, y1) {
  for (let y = y0; y < y1; y += CS / 2) for (let x = x0; x < x1; x += CS / 2) { const c = cellAt(x, y); if (c === 3 || c === 9 || c === 5 || c === 10) return false; }
  return x0 > 4 && y0 > 4 && x1 < W - 4 && y1 < H - 4;
}
function edRebuild() {
  // дома, деревья и дороги — данные; сцену собираем заново
  computeDoors(); fieldT = 0; gridDirtyMini = true; barrDirty = true;
  for (const b of buildings) { b.obj = null; b.h = b.floors * (b.kind === "house" ? 11 : 12); }
  buildCity();
}
function edApply(kind, g0, g1) {
  const x0 = Math.min(g0[0], g1[0]), y0 = Math.min(g0[1], g1[1]), x1 = Math.max(g0[0], g1[0]), y1 = Math.max(g0[1], g1[1]);
  if (kind === "ed_apt" || kind === "ed_tower") {
    if (x1 - x0 < 16 || y1 - y0 < 16) { $("tip").innerHTML = "<b>Слишком маленький участок</b> — протяни прямоугольник больше."; return; }
    if (!freeRect(x0, y0, x1, y1)) { $("tip").innerHTML = "<b>Место занято</b> домом, водой или машиной."; return; }
    const b = kind === "ed_tower" ? { x0, y0, x1, y1, kind: "tower", floors: clamp(edFloors + 10, 15, 35), style: 8 + Math.floor(Math.random() * 3) } : { x0, y0, x1, y1, kind: "apt", floors: clamp(edFloors, 2, 20), style: Math.floor(Math.random() * 5) };
    addBuilding(b); for (const a of agents) if (a.state === "alive" && a.x > x0 && a.x < x1 && a.y > y0 && a.y < y1) { const [x, y] = freeNear(a.x, a.y, 40); a.x = x; a.y = y; }
    logE(kind === "ed_tower" ? "Построен небоскрёб" : "Построен дом", "good");
  }
  if (kind === "ed_park") {
    if (x1 - x0 < 20 || y1 - y0 < 20) return;
    for (let y = y0; y < y1; y += CS) for (let x = x0; x < x1; x += CS) { const gx = Math.floor(x / CS), gy = Math.floor(y / CS), i = gy * GW + gx; if (grid[i] !== 3 && grid[i] !== 9 && grid[i] !== 5) grid[i] = 2; }
    editRoads.push({ park: true, x0, y0, x1, y1 });
    for (let k = 0; k < (x1 - x0) * (y1 - y0) / 900; k++) { const x = rnd(x0 + 5, x1 - 5), y = rnd(y0 + 5, y1 - 5); if (cellAt(x, y) === 2) { trees.push({ x, y, r: rnd(7, 13), h: rnd(16, 30) }); fillCells(x - 3, y - 3, x + 3, y + 3, 4); } }
  }
  edRebuild();
}
function edPoint(kind, g) {
  if (kind === "ed_road") {
    // асфальт кругом радиуса 8 ед. там, где нет построек
    for (let y = g[1] - 8; y <= g[1] + 8; y += CS / 2) for (let x = g[0] - 8; x <= g[0] + 8; x += CS / 2) { if (Math.hypot(x - g[0], y - g[1]) > 8) continue; const gx = Math.floor(x / CS), gy = Math.floor(y / CS); if (gx < 0 || gy < 0 || gx >= GW || gy >= GH) continue; const i = gy * GW + gx; if (grid[i] !== 3 && grid[i] !== 9) { if (grid[i] === 4) trees = trees.filter(t => Math.hypot(t.x - x, t.y - y) > 6); grid[i] = 0; } }
    editRoads.push({ x: g[0], y: g[1], r: 8 });
    const c = groundCv.getContext("2d"); c.save(); c.scale(GS, GS); c.fillStyle = "#3b3e40"; c.beginPath(); c.arc(g[0], g[1], 8, 0, TAU); c.fill(); c.restore(); groundTex.needsUpdate = true; fieldT = 0; gridDirtyMini = true;
  }
  if (kind === "ed_tree") { if (cellAt(g[0], g[1]) !== 3 && cellAt(g[0], g[1]) !== 9 && Math.random() < .5) { trees.push({ x: g[0] + rnd(-4, 4), y: g[1] + rnd(-4, 4), r: rnd(6, 12), h: rnd(14, 28) }); fillCells(g[0] - 3, g[1] - 3, g[0] + 3, g[1] + 3, 4); edDirty = true; } }
  if (kind === "ed_house") {
    const w = rnd(18, 24), d = rnd(16, 20), x0 = g[0] - w / 2, y0 = g[1] - d / 2;
    if (!freeRect(x0, y0, x0 + w, y0 + d)) { $("tip").innerHTML = "<b>Место занято.</b>"; return; }
    addBuilding({ x0, y0, x1: x0 + w, y1: y0 + d, kind: "house", floors: Math.random() < .5 ? 1 : 2, style: 11 + Math.floor(Math.random() * 4), ridge: w > d ? "x" : "z" }); edRebuild();
  }
  if (kind === "ed_bulldoze") {
    const b = buildings.find(b => g[0] > b.x0 && g[0] < b.x1 && g[1] > b.y0 && g[1] < b.y1);
    if (b) { for (const o of (b.occ || []).slice()) leaveShelter(o, false); buildings = buildings.filter(o => o !== b); fillCells(b.x0, b.y0, b.x1, b.y1, 7); for (const [k, v] of Object.entries(special)) if (v.b === b) delete special[k]; logE("Дом снесён"); edRebuild(); return; }
    const t = trees.find(t => Math.hypot(t.x - g[0], t.y - g[1]) < 8);
    if (t) { trees = trees.filter(o => o !== t); fillCells(t.x - 3, t.y - 3, t.x + 3, t.y + 3, 2); edRebuild(); }
  }
}
let edDirty = false;
function edPaintGround(g) {
  // дороги и парки из редактора поверх обычной разметки
  for (const r of editRoads) {
    if (r.park) { g.fillStyle = "#4b6e35"; g.fillRect(r.x0, r.y0, r.x1 - r.x0, r.y1 - r.y0); speckle(g, r.x0, r.y0, r.x1 - r.x0, r.y1 - r.y0, (r.x1 - r.x0) * (r.y1 - r.y0) / 4, ["#557a3c", "#3f5f2c", "#62853f"], .9); }
    else { g.fillStyle = "#3b3e40"; g.beginPath(); g.arc(r.x, r.y, r.r, 0, TAU); g.fill(); }
  }
}
$("editBtn").addEventListener("click", () => toggleEditor(!editMode));
