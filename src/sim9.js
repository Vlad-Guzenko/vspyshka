/* ---------- укрытия: люди прячутся в домах и на крышах, зомби ломают двери ---------- */
const HIDE_KINDS = new Set(["apt", "house", "tower", "mall", "police", "hospital", "warehouse", "fire", "church", "station", "school"]);
function computeDoors() {
  for (const b of buildings) {
    b.occ = []; b.door = null;
    if (!HIDE_KINDS.has(b.kind)) continue;
    const cx = (b.x0 + b.x1) / 2, cy = (b.y0 + b.y1) / 2;
    const sides = b.rot !== undefined ? (b.doorPref ? [b.doorPref, freeNear(b.doorPref[0], b.doorPref[1], 12)] : []) : [[cx, b.y1 + 5], [cx, b.y0 - 5], [b.x0 - 5, cy], [b.x1 + 5, cy]];
    for (const [x, y] of sides) { const c = cellAt(x, y); if (c === 0 || c === 1 || c === 2 || c === 7) { b.door = [x, y]; break; } }
    if (!b.door) continue;
    b.cap = clamp(Math.floor((b.x1 - b.x0) * (b.y1 - b.y0) / 160) * (b.floors > 4 ? 2 : 1), 4, 80);
    b.doorMax = b.kind === "house" ? 18 : b.kind === "police" ? 80 : 30 + b.floors * 2; b.doorHp = b.doorMax;
  }
}
function findShelter(a) {
  let best = null, bd = 90;
  for (const b of buildings) {
    if (!b.door || b.state !== "ok" || b.doorHp <= 0 || b.occ.length >= b.cap) continue;
    const d = Math.hypot(b.door[0] - a.x, b.door[1] - a.y); if (d < bd) { bd = d; best = b; }
  }
  return best;
}
function enterShelter(a, b) {
  a.hidden = true; a.hideB = b; a.hideT = 0; a.vx = a.vy = 0; b.occ.push(a); a.x = b.door[0]; a.y = b.door[1];
  // часть людей поднимается на крышу высоких домов — ждать вертолёт
  if (b.floors >= 3 && b.kind !== "house" && Math.random() < .35) { a.onRoof = true; a.roofZ = b.floors * 12; a.rx = rnd(b.x0 + 4, b.x1 - 4); a.ry = rnd(b.y0 + 4, b.y1 - 4); }
  first("hide", "Люди прячутся в домах", "good");
}
function leaveShelter(a, panic) {
  const b = a.hideB; if (!b) return;
  b.occ = b.occ.filter(o => o !== a); a.hidden = false; a.onRoof = false; a.hideB = null; a.homeTrip = false;
  const [x, y] = freeNear(b.door[0], b.door[1], 8); a.x = x; a.y = y; a.panic = panic ? 1 : 0;
}
function stepShelters(dt) {
  for (const b of buildings) {
    if (!b.occ || !b.occ.length) continue;
    b.occ = b.occ.filter(o => o.state === "alive" && o.hidden);
    // дом рухнул или горит — все выбегают
    if (b.state !== "ok" || b.fire > 0) { for (const o of b.occ.slice()) { leaveShelter(o, true); if (b.state !== "ok" && Math.random() < .5) kill(o, false); } continue; }
    // кто-то обратился внутри — внутри начинается резня
    const z = b.occ.find(o => o.role === "zombie");
    if (z) {
      if (Math.random() < dt * .8) { const v = pick(b.occ.filter(o => o.role !== "zombie")); if (v) { v.hp -= 40; if (!v.bitten) { v.bitten = true; v.incT = settings.inc * rnd(.5, 1); bites++; } if (v.hp <= 0) { leaveShelter(v, true); kill(v, true); } } }
      if (!b.insideLogged) { b.insideLogged = true; logT("inside", "В укрытии кто-то обратился", "bad", 20); }
      if (Math.random() < dt * .25) { for (const o of b.occ.slice()) if (o.role !== "zombie" && Math.random() < .3) leaveShelter(o, true); }
      if (!b.occ.some(o => o.role !== "zombie") && Math.random() < dt * .08) { leaveShelter(z, false); b.insideLogged = false; }
      continue;
    }
    // снаружи спокойно — выходят
    let zn = 0; nearZ(b.door[0], b.door[1], 110, () => zn++);
    if (b.doorHp <= 0) { if (zn) b.doorFixT = 0; else { b.doorFixT = (b.doorFixT || 0) + dt; if (b.doorFixT > 90) { b.doorHp = b.doorMax * .6; b.doorFixT = 0; logT("doorfix", "Жильцы заколотили выломанную дверь", "good", 60); } } }
    for (const o of b.occ.slice()) { o.hideT += dt; if (!zn && !o.homeTrip && !settings.curfew && o.hideT > 25 && Math.random() < dt * .3) leaveShelter(o, false); }
    // вертолёт рядом — снимает людей с крыши
    if (evac && evac.landed && !evac.leaving && evac.cap > 0 && Math.hypot(evac.x - (b.x0 + b.x1) / 2, evac.y - (b.y0 + b.y1) / 2) < 140) {
      b.roofT = (b.roofT || 0) - dt;
      const r = b.occ.find(o => o.onRoof);
      if (r && b.roofT <= 0) { b.roofT = 1.5; b.occ = b.occ.filter(o => o !== r); r.state = "saved"; r.hidden = false; saved++; evac.cap--; logT("roof", "Вертолёт снимает людей с крыши", "good", 15); }
    }
  }
}
// зомби чуют людей за дверью и выламывают её
function zombieShelterTarget(a) {
  let best = null, bd = 220;
  for (const b of buildings) { if (!b.occ || !b.occ.length || !b.door || b.doorHp <= 0) continue; const d = Math.hypot(b.door[0] - a.x, b.door[1] - a.y); if (d < bd) { bd = d; best = b; } }
  return best;
}
function bashDoor(a, b, dt) {
  b.doorHp -= dt * (a.ztype === "brute" ? 5 : a.ztype === "titan" ? 30 : 1); a.bash = .3;
  if (b.doorHp <= 0) {
    logE(b.kind === "house" ? "Зомби выломали дверь частного дома" : "Зомби ворвались в здание", "bad"); sfx.crash({ x: b.door[0], y: b.door[1] });
    for (const o of b.occ.slice()) { if (Math.random() < .45 && !o.immune) { o.bitten = true; o.incT = settings.inc * rnd(.4, 1); bites++; o.hp -= 30; } leaveShelter(o, true); }
    interest(b.door[0], b.door[1], 5);
  }
}

/* ---------- вакцина ---------- */
let research = 0, scientists = 0, vaccineReady = false, tents = [];
function stepResearch(dt) {
  if (vaccineReady || !firsts.zombie) return;
  // база больницы + учёные; без больницы медленно
  const base = special.hospital && special.hospital.b.state === "ok" ? 1 / 900 : 1 / 2400;
  research = Math.min(1, research + dt * (base + scientists / 2400));
  if (research >= .5 && !firsts.vac50) { firsts.vac50 = true; radio("Лаборатория: вакцина готова наполовину"); }
  if (research >= 1) { vaccineReady = true; logE("Вакцина готова! Медики лечат укушенных на любой стадии", "good"); radio("Лаборатория: вакцина готова. Разворачивайте пункты вакцинации"); }
}
function addTent(x, y) {
  const t = { x, y, done: 0 }; tents.push(t); blockFree(x - 7, y - 5, x + 7, y + 5);
  for (let i = 0; i < 3; i++) { const [mx, my] = freeNear(x, y, 10); const m = newAgent("medic", mx, my); m.tent = t; }
  logE("Развёрнут пункт вакцинации", "good");
}
function stepTents(dt) {
  for (const t of tents) {
    let zn = 0; nearZ(t.x, t.y, 90, () => zn++);
    if (zn) continue;
    // спокойные люди сами подходят к палатке
    near(t.x, t.y, 160, a => {
      if (a.state !== "alive" || a.role !== "civ" || a.immune || a.hidden) return;
      if (Math.hypot(a.x - t.x, a.y - t.y) < 10) { if (Math.random() < dt * .6) { a.immune = true; a.bitten = false; t.done++; } }
      else if (!a.vacGoal && Math.random() < dt * .3) a.vacGoal = t;
    });
  }
}

/* ---------- карантин: зона по кварталам, барьеры на въездах, пост пропуска, снятие после тишины ---------- */
// зона — кварталы, задетые прямоугольником, и улицы между ними; граница идёт по краю кварталов (дома — часть стены),
// улицы, уходящие из зоны, перекрываются барьером сразу, сетку по краям кварталов ставят строители; один въезд — пост пропуска
const wallMask = new Uint8Array(GW * GH), quarMask = new Uint8Array(GW * GH), zoneOf = new Int16Array(GW * GH);
let wallJobs = [], zoneSeq = 0, zoneT = 0; // wallJobs — действующие зоны карантина
const quarAt = (x, y) => zoneOf[clamp(Math.floor(y / CS), 0, GH - 1) * GW + clamp(Math.floor(x / CS), 0, GW - 1)];
const fenceable = c => c === 0 || c === 1 || c === 2 || c === 7 || c === 8;
const zoneById = id => wallJobs.find(z => z.id === id) || null;
// пока зона строится, zoneOf уже размечен — проверка «эта точка внутри зоны id»
const quarAtId = (x, y, id) => quarAt(x, y) === id;
function planQuarantine(x0, y0, x1, y1, auto) {
  if (x1 < x0) [x0, x1] = [x1, x0]; if (y1 < y0) [y0, y1] = [y1, y0];
  x0 = clamp(x0, CS * 2, W - CS * 2); x1 = clamp(x1, CS * 2, W - CS * 2); y0 = clamp(y0, CS * 2, H - CS * 2); y1 = clamp(y1, CS * 2, H - CS * 2);
  if (x1 - x0 < 60 || y1 - y0 < 60) return false;
  // кварталы: центр внутри прямоугольника или больше трети клеток в нём
  const S = new Set();
  for (const b of blocks) {
    if (b.rural || b.kind === "island") continue;
    const cs = blockCells(b); if (!cs.length) continue;
    let inn = 0; for (const c of cs) { const x = (c % GW) * CS + 4, y = ((c / GW) | 0) * CS + 4; if (x >= x0 && x <= x1 && y >= y0 && y <= y1) inn++; }
    if (inn / cs.length > .35 || (inn && b.cx >= x0 && b.cx <= x1 && b.cy >= y0 && b.cy <= y1)) S.add(b.id);
  }
  // больница, полиция и пожарная часть остаются снаружи, если очаг не в их квартале: им нужно работать
  const mid = blockAt((x0 + x1) / 2, (y0 + y1) / 2);
  for (const k of ["hospital", "police", "fire"]) { const sp = special[k]; if (!sp || !sp.b) continue; const bb = blockAt((sp.b.x0 + sp.b.x1) / 2, (sp.b.y0 + sp.b.y1) / 2); if (bb && bb !== mid) S.delete(bb.id); }
  if (!S.size) return false;
  const id = ++zoneSeq, mask = new Uint8Array(GW * GH);
  let gx0 = GW, gy0 = GH, gx1 = 0, gy1 = 0;
  for (const b of blocks) if (S.has(b.id)) for (const c of blockCells(b)) { mask[c] = 1; const gx = c % GW, gy = (c / GW) | 0; gx0 = Math.min(gx0, gx); gy0 = Math.min(gy0, gy); gx1 = Math.max(gx1, gx); gy1 = Math.max(gy1, gy); }
  // улица внутри зоны: по обе стороны (по горизонтали, вертикали или диагонали) в пределах 14 клеток — кварталы зоны
  const hitS = (x, y, dx, dy) => { for (let k = 0; k < 14; k++) { x += dx; y += dy; if (x < 0 || y < 0 || x >= GW || y >= GH) return false; const r = regionOf[y * GW + x]; if (r >= 0) return S.has(r); } return false; };
  for (let gy = gy0; gy <= gy1; gy++) for (let gx = gx0; gx <= gx1; gx++) {
    const i = gy * GW + gx; if (regionOf[i] >= 0 || mask[i]) continue;
    if ((hitS(gx, gy, 1, 0) && hitS(gx, gy, -1, 0)) || (hitS(gx, gy, 0, 1) && hitS(gx, gy, 0, -1)) || (hitS(gx, gy, 1, 1) && hitS(gx, gy, -1, -1)) || (hitS(gx, gy, 1, -1) && hitS(gx, gy, -1, 1))) mask[i] = 1;
  }
  // граница: клетки зоны, у которых хоть один из восьми соседей снаружи — линия без щелей по диагонали
  const fence = [], mouthCells = [];
  for (let gy = Math.max(1, gy0 - 1); gy <= Math.min(GH - 2, gy1 + 1); gy++) for (let gx = Math.max(1, gx0 - 1); gx <= Math.min(GW - 2, gx1 + 1); gx++) {
    const i = gy * GW + gx; if (!mask[i]) continue;
    zoneOf[i] = id;
    let edge = false; for (let dy = -1; dy <= 1 && !edge; dy++) for (let dx = -1; dx <= 1; dx++) if (!mask[i + dy * GW + dx]) { edge = true; break; }
    if (!edge) continue;
    if (regionOf[i] < 0) mouthCells.push(i); else if (grid[i] !== 3 && grid[i] !== 9 && grid[i] !== 10) fence.push(i);
  }
  // въезды: связные куски границы на улицах; у каждого — своё ребро дороги
  const left = new Set(mouthCells), mouths = [];
  while (left.size) {
    const s = left.values().next().value, comp = [s]; left.delete(s);
    for (let k = 0; k < comp.length; k++) { const i = comp[k]; for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const j = i + dy * GW + dx; if (left.has(j)) { left.delete(j); comp.push(j); } } }
    let sx = 0, sy = 0, road = 0; for (const i of comp) { sx += (i % GW) * CS + 4; sy += ((i / GW) | 0) * CS + 4; if (roadMask[i] === 1) road++; }
    const x = sx / comp.length, y = sy / comp.length, q = gEdgeNear(x, y, 40);
    mouths.push({ cells: comp, x, y, road, e: q ? q.e : null, t: q ? q.t : 0 });
  }
  // пост пропуска: самый широкий въезд (ближе к лагерю, если он есть); проём — по оси дороги, по полосе в каждую сторону
  const camp = camps[0], score = m => m.road * 10 - (camp ? Math.hypot(m.x - camp.x, m.y - camp.y) / 100 : 0);
  const gateM = mouths.filter(m => m.road && m.e).sort((a, b) => score(b) - score(a))[0];
  const gateCells = new Set(); let gate, gateT;
  if (gateM) {
    const p = edgePos(gateM.e, gateM.t); gateT = [p.tx, p.ty];
    for (const i of gateM.cells) { const x = (i % GW) * CS + 4, y = ((i / GW) | 0) * CS + 4, lat = Math.abs(-(x - p.x) * p.ty + (y - p.y) * p.tx); if (roadMask[i] === 1 && lat < 9) gateCells.add(i); }
    gate = [p.x, p.y];
  } else if (fence.length) {
    // зона без улиц наружу: калитка в заборе со стороны самой широкой соседней улицы
    let best = null, bs = -1e9; for (const i of fence) { const x = (i % GW) * CS + 4, y = ((i / GW) | 0) * CS + 4, q = gEdgeNear(x, y, 30); if (!q) continue; const s = q.e.hw - Math.hypot(x - (x0 + x1) / 2, y - (y0 + y1) / 2) / 50; if (s > bs) { bs = s; best = [i, x, y, q]; } }
    if (best) { const [, x, y, q] = best; const p = edgePos(q.e, q.t); gate = [x, y]; const nx = x - p.x, ny = y - p.y, l = Math.hypot(nx, ny) || 1; gateT = [nx / l, ny / l]; for (const i of fence) if (Math.hypot((i % GW) * CS + 4 - x, ((i / GW) | 0) * CS + 4 - y) < 9) gateCells.add(i); }
  }
  if (!gate) { for (const i of mask.keys()) if (zoneOf[i] === id) zoneOf[i] = 0; return false; }
  // наружу от ворот: по оси дороги в ту сторону, где уже не зона
  const out = quarAtId(gate[0] + gateT[0] * 30, gate[1] + gateT[1] * 30, id) ? [-gateT[0], -gateT[1]] : gateT;
  const z = { id, auto: !!auto, x0, y0, x1, y1, t0: simT, cells: [], prev: {}, mouths: mouths.map(m => ({ x: m.x, y: m.y, e: m.e ? m.e.id : -1 })), gate, gateT, out, gateE: gateM && gateM.e ? gateM.e.id : -1, gateEdgeT: gateM ? gateM.t : 0, quietT: 0, lastSent: simT, known: 0 };
  // барьеры на въездах — сразу (бетонные блоки привозит полиция), сетку по краям кварталов — строители
  for (const m of mouths) for (const i of m.cells) { if (gateCells.has(i)) continue; z.cells.push(i); if (fenceable(grid[i])) putZoneCell(z, i); }
  for (const i of fence) if (!gateCells.has(i)) z.cells.push(i);
  for (const m of mouths) if (m.e) { m.e.quar = id; if (m === gateM) m.e.quarGate = id; }
  if (typeof routeCache !== "undefined") routeCache.clear();
  z.cp = addGateCheckpoint(gate[0], gate[1], gateT[0], gateT[1]);
  if (gateM && gateM.e) { z.cp.t = gateM.t; z.cp.e = gateM.e.id; gateM.e.checkCp = z.cp; }
  wallJobs.push(z);
  const truck = spawnService("builder", gate[0], gate[1], null); truck.job = { wall: z }; truck.crewN = 6;
  barrDirty = true; fieldT = 0;
  logE(`Карантин: ${mouths.length ? "перекрыто въездов: " + mouths.length + ", " : ""}строители ставят забор по краю кварталов; выход только через пост пропуска`, "good");
  radio("Штаб: район закрыт, въезды перекрыты. Выход только через КПП с проверкой");
  return true;
}
// клетка забора: запоминаем, что было под ней, чтобы при снятии карантина вернуть
function putZoneCell(z, i) {
  // под машиной барьер не ставим: дозакроют, когда она уедет
  const cx = (i % GW) * CS + 4, cy = ((i / GW) | 0) * CS + 4; let car = false; nearCars(cx, cy, 10, o => { if (!car && !o.gone && Math.hypot(o.x - cx, o.y - cy) < 8) car = true; }); if (car) return false;
  if (!(i in z.prev)) z.prev[i] = grid[i];
  grid[i] = 6; bhp[i] = 300; wallMask[i] = 1; quarMask[i] = 1;
  const x = (i % GW) * CS, y = ((i / GW) | 0) * CS; evictRect(x - 1, y - 1, x + CS + 1, y + CS + 1);
  barrDirty = true; fieldT = Math.min(fieldT, .4); return true;
}
// что осталось поставить или починить: свободные клетки границы без забора (дома и деревья — сами преграда)
function zoneTodo(z) { let n = 0; for (const i of z.cells) if (grid[i] !== 6 && fenceable(grid[i])) n++; return n; }
function liftZone(z, why) {
  for (const i of z.cells) if (grid[i] === 6 && quarMask[i]) { grid[i] = i in z.prev ? z.prev[i] : 0; wallMask[i] = 0; quarMask[i] = 0; bhp[i] = 0; }
  for (let i = 0; i < zoneOf.length; i++) if (zoneOf[i] === z.id) zoneOf[i] = 0;
  for (const e of RE) { if (e.quar === z.id) e.quar = 0; if (e.quarGate === z.id) e.quarGate = 0; if (e.checkCp === z.cp) e.checkCp = null; }
  if (z.cp) { cps = cps.filter(c => c !== z.cp); if (z.cp.cells2) unblock(z.cp.cells2); for (const a of agents) if (a.cp === z.cp && a.state === "alive") { a.cp = null; a.order = null; if (special.police) { a.standDown = true; a.standT = simT; a.order = { x: special.police.x, y: special.police.y }; } } }
  z.lifted = true; if (typeof routeCache !== "undefined") routeCache.clear(); barrDirty = true; fieldT = 0;
  logE(why || "Карантин снят: зомби в зоне не осталось, въезды открыты", "good"); radio("Штаб: карантин снят, движение восстановлено");
}
// жители зоны, оказавшиеся на улице, уходят через пост пропуска: очередь, проверка на укусы, потом — в лагерь или прочь от зоны;
// одновременно идут не больше десяти, рядом с зомби никого не посылают; в укрытиях сидят до автобуса
function zoneEvacuate(z) {
  const cp = z.cp; if (!cp || cp.broken || !(cp.staff > 0)) return;
  let going = 0; for (const a of agents) if (a.zoneEvac === z.id && a.state === "alive") going++;
  for (const a of agents) {
    if (going >= 10) break;
    if (a.state !== "alive" || a.role !== "civ" || a.hidden || a.zoneEvac || a.busGoal || a.onBus || a.detained || a.cpChecked === cp || a.panic > .5 || a.hideGoal) continue;
    if (quarAt(a.x, a.y) !== z.id || Math.random() > .3) continue;
    let zc = 0; nearZ(a.x, a.y, 60, () => zc++); if (zc) continue;
    a.zoneEvac = z.id; a.dest = null; going++;
  }
}
// поведение эвакуируемого: к посту изнутри, там проверка (stepCheckpoints), после — прочь
function zoneEvacMove(a, zn, zd) {
  const z = zoneById(a.zoneEvac), cp = z && z.cp;
  if (!z || z.lifted || !cp || cp.broken) { a.zoneEvac = 0; return null; }
  if (zn && zd < 30) { a.zoneEvac = 0; return null; }
  if (a.cpChecked === cp) {
    // прошёл: в ближайший лагерь, если он есть, иначе дальше по дороге от ворот
    const camp = camps.length ? camps.reduce((b, c) => Math.hypot(c.x - a.x, c.y - a.y) < Math.hypot(b.x - a.x, b.y - a.y) ? c : b) : null;
    if (camp) { a.campGoal = camp; a.zoneEvac = 0; return null; }
    const tx = z.gate[0] + z.out[0] * 110, ty = z.gate[1] + z.out[1] * 110;
    if (Math.hypot(tx - a.x, ty - a.y) < 14) { a.zoneEvac = 0; return null; }
    return goTo(a, tx, ty, 6);
  }
  // к посту: точка перед шлагбаумом изнутри зоны, по оси дороги
  const qx = z.gate[0] - z.out[0] * 6, qy = z.gate[1] - z.out[1] * 6;
  return goTo(a, qx, qy, 6);
}
function stepWalls(dt) {
  zoneT -= dt; if (zoneT > 0) return; zoneT = 2;
  for (const z of wallJobs) {
    const todo = zoneTodo(z);
    if (!todo && !z.doneLogged) { z.doneLogged = true; logE("Забор карантина замкнут", "good"); }
    else if (todo > 2 && z.doneLogged) { z.doneLogged = false; logT("quarbreach", "Карантин: в заборе пролом, строители едут чинить", "bad", 30); }
    zoneEvacuate(z);
    if (!z.auto) continue;
    // снятие: штабу 2,5 минуты не известно ни одного зомби внутри; при отбое — сразу
    let known = 0; for (const a of agents) if (a.state === "alive" && a.role === "zombie" && simT - (a.spotT || -1e9) < 90 && quarAt(a.x, a.y) === z.id) known++;
    z.known = known; z.quietT = known ? 0 : z.quietT + 2;
    if (alert === 0) liftZone(z, "Отбой: карантин снят, въезды открыты");
    else if (z.quietT > 150 && simT - z.t0 > 120) liftZone(z);
  }
  wallJobs = wallJobs.filter(z => !z.lifted);
}

/* ---------- мародёры и банды ---------- */
let gangsSpawned = 0;
function spawnGang() {
  const e = edgeLanePoint(), x = e.x, y = e.y;
  const target = special.mall || pick(buildings.filter(b => b.door));
  for (let i = 0; i < 5; i++) {
    const [ax, ay] = freeNear(x, y, 20), a = newAgent("bandit", ax, ay);
    if (Math.random() < .5) arm(a, 30, 60); else arm(a, 12, 24);
    a.cloth = pick(["#1c1c1f", "#2a2622", "#3a1e1e", "#20262c"]); a.pants = "#18181a"; a.hair = "#111"; a.loot = target && target.b ? target.b : target;
  }
  gangsSpawned++;
  registerGang(agents.slice(-5));
  logE("В городе появились мародёры", "bad"); radio("Диспетчер: вооружённые мародёры, будьте осторожны");
}
function stepGangs(dt) {
  if (gangsSpawned < 2 && (lastCounts || counts()).Z > 25 + gangsSpawned * 40 && Math.random() < dt * .05) spawnGang();
}
// поведение мародёра: грабит, стреляет по зомби и полиции
function thinkBandit(a, dt, zn, zd) {
  if (a.lootT > 0) { a.lootT -= dt; if (a.lootT <= 0) { a.hidden = false; a.bag = pick(["#3a2a1e", "#1e1e22", "#8a6a2a"]); logT("loot", "Мародёры вынесли добычу из магазина", "bad", 25); a.loot = null; } return [0, 0, 0]; }
  // полиция или военные рядом — перестрелка
  let cop = null, cd = 130;
  near(a.x, a.y, 130, b => { if (b.state === "alive" && !b.hidden && (b.role === "police" || b.role === "army" || (b.faction && b.armed && b.role === "civ"))) { const d = Math.hypot(b.x - a.x, b.y - a.y); if (d < cd && los(a.x, a.y, b.x, b.y)) { cd = d; cop = b; } } });
  if (cop && a.mag > 0 && a.reload <= 0 && (!zn || cd < zd)) { a.aim = Math.atan2(cop.y - a.y, cop.x - a.x); a.aimT = .8; a.hostile = 30; if (a.cd <= 0) { shootHuman(a, cop); logT("gunfight", "Перестрелка мародёров с силовиками", "bad", 20); } return [0, 0, 0]; }
  const dp = nearestDepot(a, 400);
  if (dp && !a.depotDone) { const d = Math.hypot(dp.x - a.x, dp.y - a.y); if (d < 8) a.depotDone = true; else return goTo(a, dp.x, dp.y, 10); }
  const b = a.loot;
  if (b && b.door && b.state === "ok") { const d = Math.hypot(b.door[0] - a.x, b.door[1] - a.y); if (d < 6) { a.lootT = rnd(15, 30); a.hidden = true; if ((b.food || 0) > 0) { b.food = Math.max(0, b.food - 40); logT("raid", "Мародёры вынесли припасы из убежища", "bad", 20); } return [0, 0, 0]; } return goTo(a, b.door[0], b.door[1], 10); }
  const w = wander(a, dt); return [w[0], w[1], 8 * w[2]];
}
function shootHuman(s, t) {
  s.burst = (s.burst || 0) + 1; s.cd = s.magMax >= 30 ? (s.burst % 3 ? .12 : rnd(.5, .8)) : rnd(.6, 1); s.mag--; s.shotT = simT;
  noises.push({ x: s.x, y: s.y, t: simT, r: 260 }); sfx.shot(s);
  const d = Math.hypot(t.x - s.x, t.y - s.y), acc = clamp(.5 * (1 - d / 300), .05, .8);
  if (Math.random() < acc) { t.hp -= rnd(25, 55); t.bleed = 8; sfx.pain(t); fxHit(t.x, t.y, 4.6, Math.atan2(t.y - s.y, t.x - s.x)); if (t.hp <= 0) kill(t, false, "shot"); fxShot(s, t.x, t.y, true); }
  else fxShot(s, t.x + rnd(-10, 10), t.y + rnd(-10, 10), false);
}
