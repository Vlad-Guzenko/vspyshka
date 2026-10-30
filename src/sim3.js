/* ---------- уличное движение ---------- */
const DX = [1, 0, -1, 0], DY = [0, 1, 0, -1];
const CH = 48, CHW = Math.ceil(MAX_W / CH), CHH = Math.ceil(MAX_H / CH);
const carHash = Array.from({ length: CHW * CHH }, () => []);
function rebuildCarHash() {
  for (const c of carHash) c.length = 0;
  for (const c of cars) if (!c.gone) carHash[clamp(Math.floor(c.y / CH), 0, CHH - 1) * CHW + clamp(Math.floor(c.x / CH), 0, CHW - 1)].push(c);
  for (const t of tanks) carHash[clamp(Math.floor(t.y / CH), 0, CHH - 1) * CHW + clamp(Math.floor(t.x / CH), 0, CHW - 1)].push(t);
}
function nearCars(x, y, r, fn) {
  const x0 = clamp(Math.floor((x - r) / CH), 0, CHW - 1), x1 = clamp(Math.floor((x + r) / CH), 0, CHW - 1), y0 = clamp(Math.floor((y - r) / CH), 0, CHH - 1), y1 = clamp(Math.floor((y + r) / CH), 0, CHH - 1);
  for (let gy = y0; gy <= y1; gy++) for (let gx = x0; gx <= x1; gx++) for (const c of carHash[gy * CHW + gx]) fn(c);
}
// точка внутри движущейся машины или танка (повёрнутый прямоугольник)
// машина, в кузов которой попадает точка (кроме skip: из кузова, в который человека уже затолкало, он выходит свободно)
function vehicleAt(x, y, skip) {
  let hit = null;
  nearCars(x, y, 24, c => { if (!hit && c !== skip && (c.moving || c.tank) && insideCar(c, x, y)) hit = c; });
  return hit;
}
function insideCar(c, x, y) {
  const ca = Math.cos(c.ang), sa = Math.sin(c.ang), dx = x - c.x, dy = y - c.y;
  return Math.abs(dx * ca + dy * sa) < (c.tank ? 13 : 10 * (c.len || 1)) && Math.abs(-dx * sa + dy * ca) < (c.tank ? 7 : 4.5);
}
let fled = 0;
// клетки под брошенной машиной: запоминаем, что было, чтобы вернуть, когда её увезут
function markCarCells(c) {
  clearCarCells(c); c.cells = [];
  for (const i of rotCells(c.x, c.y, 17 * (c.len || 1), 8, c.ang)) { const g = grid[i]; if (g === 0 || g === 1 || g === 2 || g === 7) { c.cells.push(i, g); grid[i] = 5; } }
  fieldT = 0;
}
function abandonCar(c, why) {
  c.moving = false; c.stopped = true; c.v = 0; c.stopT = simT; c.over = 0; c.latTgt = 0;
  if (c.turn) { const i = c.turn.n.occ.indexOf(c); if (i >= 0) c.turn.n.occ.splice(i, 1); }
  markCarCells(c); evictRect(c.x - 13, c.y - 13, c.x + 13, c.y + 13);
  const rx = -Math.sin(c.ang), ry = Math.cos(c.ang);
  if (!c.wreck && why !== "crash") {
    // водитель выскакивает и бежит; из автобуса высыпают пассажиры
    const side = Math.random() < .5 ? 1 : -1, ox = rx * 8 * side, oy = ry * 8 * side;
    const [x, y] = blocked(c.x + ox, c.y + oy) ? freeNear(c.x, c.y, 16) : [c.x + ox, c.y + oy];
    const d = newAgent("civ", x, y); d.panic = 1; nameFor(d);
    if (c.passengers && c.passengers.length) busUnload(c);
    else if (c.bus && !c.unloaded && !(c.line >= 0)) { c.unloaded = true; for (let i = 0; i < 6; i++) { const [px, py] = freeNear(c.x + ox, c.y + oy, 10); const p = newAgent("civ", px, py); p.panic = 1; nameFor(p); } logT("bus", "Пассажиры выбегают из автобуса", "bad", 20); }
  } else if (c.bus && why === "crash" && !c.unloaded && !(c.line >= 0)) { // маршрутный автобус: настоящих пассажиров выводит busCrash
    c.unloaded = true; for (let i = 0; i < 5; i++) { const [px, py] = freeNear(c.x, c.y, 12); const p = newAgent("civ", px, py); p.panic = 1; p.hp = rnd(25, 60); p.bleed = 6; nameFor(p); } logT("buscrash", "Автобус разбился: пассажиры ранены", "bad", 20);
  }
  if (why && why !== "crash") logT("abandon", why, "bad", 15);
}
let carsCompactT = 20;
function stepTraffic(dt) {
  gasTick(dt); signalTick(dt); laneIndex();
  carsCompactT -= dt; if (carsCompactT <= 0) { carsCompactT = 20; if (cars.some(c => c.gone)) cars = cars.filter(c => !c.gone); for (const n of RN) if (n.occ.length) n.occ = n.occ.filter(o => !o.gone && o.turn && o.turn.n === n); }
  for (const c of cars) {
    if (c.gone) { c.moving = false; continue; }
    if (c.player && typeof stepPlayerCar === "function") { stepPlayerCar(c, dt); continue; } // за рулём игрок (drive.js)
    if (c.alarm > 0) c.alarm -= dt;
    // машина в полёте после взрыва
    if (c.z > 0 || c.vz) {
      c.vz -= 39 * dt; c.z += c.vz * dt; c.x = clamp(c.x + c.vx * dt, 4, W - 4); c.y = clamp(c.y + c.vy * dt, 4, H - 4);
      c.roll += c.sr * dt; c.ang += c.sy * dt;
      if (c.z <= 0) {
        c.z = 0; c.vz = 0; c.sr = 0; c.sy = 0;
        c.roll = Math.round(c.roll / (Math.PI / 2)) * (Math.PI / 2); // ложится на бок или на крышу
        if (c.turn) { const i = c.turn.n.occ.indexOf(c); if (i >= 0) c.turn.n.occ.splice(i, 1); c.turn = null; }
        c.moving = false; c.stopped = true; c.stopT = simT; markCarCells(c); evictRect(c.x - 12, c.y - 12, c.x + 12, c.y + 12);
        fxDebris(c.x, c.y); sfx.crash(c);
      }
      continue;
    }
    if (!c.moving || c.towedBy) continue;
    if (c.wreck) { abandonCar(c, null); continue; }
    stepRoadCar(c, dt);
  }
  resolveCarOverlaps(dt);
}

/* ---------- разрушение ---------- */
function damageBuilding(b, dmg, sx, sy) {
  if (b.state !== "ok") return;
  if (sx !== undefined) { b.hitX = sx; b.hitY = sy; }
  b.hp -= dmg; b.scorch = Math.max(b.scorch, clamp(1 - b.hp / b.maxHp));
  if (b.hp < b.maxHp * .55 && Math.random() < .6) b.fire = Math.max(b.fire, rnd(30, 70));
  if (b.hp <= 0) collapse(b);
  b.bigHit = false; // отметка сильного удара живёт только в пределах этого удара
}
// повреждение без обрушения: каменный дом от взрыва рядом, снаряда или упавшего соседа теряет окна и прочность, может загореться,
// но стоит — ниже доли floor прочность не опускается (дальше его может выжечь пожар, но и тогда остаётся остов)
function hurtBuilding(b, dmg, sx, sy, floor = .2) {
  if (b.state !== "ok") return;
  b.hp = Math.max(b.hp - dmg, Math.min(b.hp, b.maxHp * floor)); b.scorch = Math.max(b.scorch, clamp(1 - b.hp / b.maxHp));
  if (b.hp < b.maxHp * .55 && Math.random() < .5) b.fire = Math.max(b.fire, rnd(25, 60));
}
// клетка внутри дома, с учётом поворота
function insideFoot(b, x, y) {
  if (b.rot === undefined) return x >= b.x0 && x < b.x1 && y >= b.y0 && y < b.y1;
  const c = Math.cos(b.rot), s = Math.sin(b.rot), dx = x - b.cx, dy = y - b.cy, lx = dx * c + dy * s, lz = -dx * s + dy * c;
  return Math.abs(lx) <= b.w / 2 && Math.abs(lz) <= b.d / 2;
}
function setRubble(i) { if (grid[i] !== 8) underRubble[i] = grid[i]; grid[i] = 8; }
// клетки под домом — той же выборкой, что при постройке (полклетки), иначе у повёрнутого дома по краю остаются клетки «стены» без дома
function footCells(b, fn) {
  const cx = (b.x0 + b.x1) / 2, cy = (b.y0 + b.y1) / 2, r = Math.hypot(b.x1 - b.x0, b.y1 - b.y0) / 2 + CS, seen = new Set();
  for (let y = cy - r; y <= cy + r; y += CS / 2) for (let x = cx - r; x <= cx + r; x += CS / 2) {
    if (!insideFoot(b, x, y)) continue;
    const gx = Math.floor(x / CS), gy = Math.floor(y / CS); if (gx < 0 || gy < 0 || gx >= GW || gy >= GH) continue;
    const i = gy * GW + gx; if (!seen.has(i)) { seen.add(i); fn(i); }
  }
}
function collapse(b, demo) {
  b.state = "collapsing"; b.cT = 0; b.rubble0 = undefined; b.cT0 = simT; // cT0: когда рухнул — площадку считать вывезенной заново
  // высокий дом после удара сбоку валится в сторону от взрыва; при сносе экскаватором оседает на месте
  const cx = (b.x0 + b.x1) / 2, cy = (b.y0 + b.y1) / 2;
  // настоящие дома почти всегда складываются вниз, на своё пятно; набок изредка ложится только очень высокая башня
  // и только от метеорита или ядерного удара
  b.topple = !demo && b.bigHit && b.hitX !== undefined && b.h > 100 && b.kind !== "house" && Math.random() < .35;
  if (demo) { b.gutted = false; b.gutT = 0; b.hitX = undefined; }
  if (b.topple) {
    if (b.kind === "tower") firsts.topple = true;
    const d = Math.hypot(cx - b.hitX, cy - b.hitY);
    b.fallAng = (d > 2 ? Math.atan2(cy - b.hitY, cx - b.hitX) : rnd(0, TAU)) + rnd(-.35, .35);
    b.fallT = 1.4 + Math.sqrt(b.h) / 5.5; b.fallMax = rnd(1.2, 1.45); b.impacted = false;
  }
  for (const o of (b.occ || []).slice()) { leaveShelter(o, true); if (Math.random() < .7) { kill(o, false); o.reanimate = false; o.crushed = true; } }
  b.ruinH = b.kind === "house" ? rnd(2, 5) : Math.min(b.h * .5, rnd(5, 26));
  b.fire = demo ? 0 : Math.max(b.fire, 30);
  const m = demo ? 10 : Math.min(b.h * .22, 34);
  // завал засыпает всех вокруг
  near((b.x0 + b.x1) / 2, (b.y0 + b.y1) / 2, Math.hypot(b.x1 - b.x0, b.y1 - b.y0) / 2 + m, a => {
    if (a.state !== "alive" || a.x < b.x0 - m || a.x > b.x1 + m || a.y < b.y0 - m || a.y > b.y1 + m) return;
    if (Math.random() < .75) { if (a.role === "zombie") destroyZombie(a, false); else { kill(a, false); a.reanimate = false; } a.crushed = true; }
  });
  footCells(b, setRubble);
  for (let y = b.y0 - m; y < b.y1 + m; y += CS) for (let x = b.x0 - m; x < b.x1 + m; x += CS) {
    const c = cellAt(x, y);
    if (c !== 8 && c !== 3 && c !== 5 && Math.random() < .8 - Math.max(Math.max(b.x0 - x, x - b.x1, 0), Math.max(b.y0 - y, y - b.y1, 0)) / m * .7) {
      const gx = Math.floor(x / CS), gy = Math.floor(y / CS); if (gx >= 0 && gy >= 0 && gx < GW && gy < GH) setRubble(gy * GW + gx);
    }
  }
  for (const c of cars) if (!c.moving && !c.gone && c.x > b.x0 - m && c.x < b.x1 + m && c.y > b.y0 - m && c.y < b.y1 + m) { c.wreck = true; c.crushed = true; c.stopped = true; c.stopT = simT; }
  for (const l of lamps) if (l.x > b.x0 - m && l.x < b.x1 + m && l.y > b.y0 - m && l.y < b.y1 + m) l.down = l.down || rnd(1.2, 1.5) * (Math.random() < .5 ? 1 : -1);
  fieldT = 0; gridDirty = true; barrDirty = true;
  addDanger(cx, cy, Math.max(b.x1 - b.x0, b.y1 - b.y0) / 2 + m + 20, 300);
  logE(demo ? (b.kind === "tower" ? "Выгоревший небоскрёб снесли" : "Выгоревший дом снесли") : b.kind === "tower" ? "Рухнул небоскрёб" : b.kind === "house" ? "Разрушен частный дом" : "Обрушилось здание", demo ? "good" : "bad");
  fxCollapse(b); sfx.collapse(b); interest((b.x0 + b.x1) / 2, (b.y0 + b.y1) / 2, 10);
}
// рухнувшая вбок башня ложится на соседей: полоса завалов, раздавленные машины; соседние дома повреждены, но стоят
function toppleImpact(b) {
  b.impacted = true;
  const cx = (b.x0 + b.x1) / 2, cy = (b.y0 + b.y1) / 2, ca = Math.cos(b.fallAng), sa = Math.sin(b.fallAng);
  const w = b.x1 - b.x0, d = b.y1 - b.y0, e = Math.min(w / 2 / Math.max(1e-3, Math.abs(ca)), d / 2 / Math.max(1e-3, Math.abs(sa)));
  const L = b.h * Math.sin(b.fallMax), half = Math.max(w, d) / 2 + 6;
  const px = cx + ca * e, py = cy + sa * e;
  b.fallZone = { px, py, ca, sa, L, half };
  const inZone = (x, y) => { const dx = x - px, dy = y - py, al = dx * ca + dy * sa, lat = Math.abs(-dx * sa + dy * ca); return al > -4 && al < L && lat < half * (1 - al / L * .35); };
  for (let k = 0; k < L; k += CS / 2) for (let l = -half; l <= half; l += CS / 2) {
    const x = px + ca * k - sa * l, y = py + sa * k + ca * l; if (!inZone(x, y)) continue;
    const gx = Math.floor(x / CS), gy = Math.floor(y / CS); if (gx < 0 || gy < 0 || gx >= GW || gy >= GH) continue;
    const i = gy * GW + gx; if (grid[i] !== 3 && grid[i] !== 9 && Math.random() < .85) setRubble(i);
  }
  near(px + ca * L / 2, py + sa * L / 2, L / 2 + half, a => { if (a.state === "alive" && inZone(a.x, a.y) && Math.random() < .85) { if (a.role === "zombie") destroyZombie(a, false); else { kill(a, false); a.reanimate = false; } a.crushed = true; } });
  for (const c of cars) if (!c.gone && inZone(c.x, c.y)) { c.wreck = true; c.crushed = true; c.moving = false; c.stopped = true; }
  for (const l of lamps) if (inZone(l.x, l.y)) l.down = l.down || 1.4;
  for (const t of trees) if (inZone(t.x, t.y)) t.burnt = true;
  for (const o of buildings) {
    if (o === b || o.state !== "ok") continue;
    const ox = clamp(px + ca * L * .6, o.x0, o.x1), oy = clamp(py + sa * L * .6, o.y0, o.y1);
    let hit = false; for (let k = 0; k < L && !hit; k += 6) { const x = px + ca * k, y = py + sa * k; if (x > o.x0 - half * .6 && x < o.x1 + half * .6 && y > o.y0 - half * .6 && y < o.y1 + half * .6) hit = true; }
    if (hit) {
      // частный дом под башней раздавлен, каменный — повреждён и горит, но стоит: домино не бывает
      if (o.kind === "house") damageBuilding(o, 160 + b.floors * 18, px, py); else hurtBuilding(o, 160 + b.floors * 18, px, py, .15);
      logT("domino", "Упавшая башня повредила соседний дом", "bad", 8);
    }
  }
  fieldT = 0; gridDirty = true; barrDirty = true; interest(px + ca * L / 2, py + sa * L / 2, 10);
  fxToppleImpact(b); sfx.boom(px + ca * L * .5, py + sa * L * .5, true);
}
// выгоревший остов: стоит, но жить и прятаться в нём нельзя, ремонтники восстановят
function gutBuilding(b) {
  b.gutted = true; b.gutT = 180; b.scorch = 1; b.fire = 0;
  for (const o of (b.occ || []).slice()) leaveShelter(o, true);
  b.door = null; b.gutDoor = true;
  addDanger((b.x0 + b.x1) / 2, (b.y0 + b.y1) / 2, Math.max(b.x1 - b.x0, b.y1 - b.y0) / 2 + 16, 200);
  logT("gutted", b.kind === "tower" ? "Небоскрёб выгорел дотла: остался остов" : "Дом выгорел дотла", "bad", 20);
}
function stepBuildings(dt) {
  stepWreck(dt);
  for (const b of buildings) {
    if (b.topple && !b.impacted && b.state === "collapsing" && b.cT > b.fallT) toppleImpact(b);
    // заправка: загорелась или её задело взрывом — через несколько секунд рвутся колонки и подземные ёмкости
    if (b.kind === "gas" && !b.blown && b.state === "ok" && (b.fire > 0 || b.hp < b.maxHp * .7)) {
      b.gasT = (b.gasT || 0) + dt;
      if (b.gasT > 4) { b.blown = true; const f = b.front, x = f ? f.x - f.nx * 18 : (b.x0 + b.x1) / 2, y = f ? f.y - f.ny * 18 : (b.y0 + b.y1) / 2; boom(x, y, 60, true); fires.push({ x, y, r: 22, l: 60 }); logE("Взорвалась заправка", "bad"); }
    }
    if (b.fire > 0 && b.state === "ok" && Math.random() < dt * .8) { const s = Math.random() < .5, x = s ? rnd(b.x0, b.x1) : (Math.random() < .5 ? b.x0 - 4 : b.x1 + 4), y = s ? (Math.random() < .5 ? b.y0 - 4 : b.y1 + 4) : rnd(b.y0, b.y1); fires.push({ x, y, r: rnd(5, 9), l: rnd(4, 8) }); } // горящие обломки падают у стен
    if (b.fire > 0) {
      b.fire -= dt;
      if (b.state === "ok") {
        // каменный дом огонь выжигает до остова, но не роняет: ниже 8% прочности пожар уже ничего не отнимает
        if (b.kind === "house" || b.hp > b.maxHp * .08) b.hp -= dt * (b.kind === "house" ? 1.2 : b.floors > 8 ? .45 : .7); b.scorch = Math.max(b.scorch, clamp(1 - b.hp / b.maxHp));
        if (b.hp <= 0) collapse(b);
        else if (b.fire <= 0 && b.hp < b.maxHp * .45 && !b.gutted) gutBuilding(b);
      }
    }
    if (b.gutT > 0) b.gutT -= dt;
    if (b.state === "collapsing") { b.cT += dt; if (b.cT > (b.topple ? b.fallT + 2 : 4.5)) b.state = "ruin"; }
  }
}
// взрыв ломает всё вокруг: здания, машины, фонари, деревья
// каменный дом от взрыва машины, снаряда, авиабомбы, заправки или бензовоза не падает: копоть, выбитые окна, пожар;
// роняют только метеорит и ядерный удар. Частные дома ломаются и от малых взрывов
function blastWorld(x, y, R, big) {
  for (const b of buildings) {
    const dx = Math.max(b.x0 - x, 0, x - b.x1), dy = Math.max(b.y0 - y, 0, y - b.y1), d = Math.hypot(dx, dy);
    if (d >= R) continue;
    const k = 1 - d / R;
    if (big && R >= 100) { b.bigHit = true; damageBuilding(b, 280 * k + 40, x, y); }
    else if (b.kind === "house") damageBuilding(b, (big ? 110 : R * 1.2) * k + (big ? 10 : 0), x, y);
    // авиабомба, заправка, бензовоз: каменный дом рядом стоит — выбиты окна, повреждения, пожар
    else if (big) hurtBuilding(b, (R >= 70 ? 200 : 110) * k + 10, x, y);
    else if (b.state === "ok") { b.scorch = Math.max(b.scorch, clamp(k * .5)); if (d < 8 && Math.random() < .2) { b.fire = Math.max(b.fire, rnd(20, 40)); first("bfire", "Горит здание", "bad"); } }
  }
  for (const c of cars) {
    if (c.gone || c.z > 0) continue;
    const d = Math.hypot(c.x - x, c.y - y);
    if (d < R * 1.2) {
      const k = 1 - d / (R * 1.2), ang = Math.atan2(c.y - y, c.x - x);
      // у центра машины загораются, а взрывается из них лишь каждая пятая (бензовоз — всегда); придавленные завалом не взрываются.
      // Дальше волна только мнёт кузов, выбивает стёкла и отбрасывает
      if (!c.wreck && !c.crushed && d < R * .75) { c.burnT = Math.max(c.burnT || 0, 40); if (c.tanker || (d < R * .6 && Math.random() < (big ? .4 : .2))) c.boomT = rnd(.6, 3); }
      c.wreck = true; c.dent = Math.max(c.dent || 0, k); c.glass = true;
      if (c.moving) { c.moving = false; c.stopped = true; c.stopT = simT; }
      clearCarCells(c);
      c.vx = Math.cos(ang) * 50 * k; c.vy = Math.sin(ang) * 50 * k; c.vz = 20 + 50 * k * (big ? 1 : .6); c.z = .1;
      c.sr = rnd(-6, 6) * k; c.sy = rnd(-3, 3) * k; c.roll = c.roll || 0;
    } else if (d < R * 3 && !c.wreck) c.alarm = rnd(15, 40);
  }
  for (const l of lamps) if (!l.down && Math.hypot(l.x - x, l.y - y) < R * .9) l.down = rnd(1.2, 1.55) * (Math.random() < .5 ? 1 : -1);
  for (const t of trees) if (Math.hypot(t.x - x, t.y - y) < R * .9) t.burnt = true;
  wreckBlast(x, y, R, big);
  gridDirty = true;
}

/* ---------- танк ---------- */
let tanks = [];
function addTank(x, y) {
  const t = { tank: true, x, y, ang: rnd(0, TAU), turret: 0, hp: 100, cd: 2, mg: 0, shells: 40, rounds: 900, v: 0, z: 0, recoil: 0, track: 0 };
  tanks.push(t); return t;
}
function stepTanks(dt) {
  for (const t of tanks) {
    if (t.hp <= 0) { t.v = 0; continue; }
    t.cd -= dt; t.mg -= dt; t.recoil = Math.max(0, t.recoil - dt * 3);
    // цели: ближайший видимый зомби для пулемёта, скопление — для пушки
    let best = null, bd = 320, crowd = null, cb = 0;
    nearZ(t.x, t.y, 320, a => {
      if (a.state !== "alive") return;
      const d = Math.hypot(a.x - t.x, a.y - t.y);
      if (!los(t.x, t.y, a.x, a.y)) return;
      if (d < bd) { bd = d; best = a; }
      if (d > 45) { let n = 0, civ = 0; near(a.x, a.y, 26, b => { if (b.state === "alive") { if (b.role === "zombie") n++; else civ++; } }); if (civ === 0 && n > cb) { cb = n; crowd = a; } }
    });
    const aimAt = crowd && cb >= 3 && t.shells > 0 ? crowd : best;
    if (aimAt) {
      const want = Math.atan2(aimAt.y - t.y, aimAt.x - t.x); let dd = want - t.turret; dd -= Math.round(dd / TAU) * TAU;
      t.turret += clamp(dd, -dt * 1.6, dt * 1.6);
      if (Math.abs(dd) < .08) {
        if (aimAt === crowd && t.cd <= 0) fireShell(t, crowd);
        else if (best && t.mg <= 0 && t.rounds > 0 && bd < 240) { const cd = t.cd; t.mg = .09; t.rounds--; shoot(t, best); t.cd = cd; }
      }
    }
    // едет к зомби по улицам, давит всё на пути
    let mx = 0, my = 0;
    // сначала к точке, куда послали (в обход домов), потом охота на зомби по полю расстояний
    if (t.goal) { const gd = Math.hypot(t.goal.x - t.x, t.goal.y - t.y); if (gd < 40 || (best && bd < 100)) t.goal = null; else { const e = pathField(t, t.goal.x, t.goal.y), dir = e ? boxDir(e, t.x, t.y) : null; mx = dir ? dir[0] : (t.goal.x - t.x) / gd; my = dir ? dir[1] : (t.goal.y - t.y) / gd; } }
    if (!(mx || my) && (!best || bd > 120)) { const d = fieldDir(fZ, t.x, t.y, false); if (d && fieldVal(fZ, t.x, t.y) < 140) { mx = d[0]; my = d[1]; } }
    const sp = mx || my ? 13 : 0;
    t.v += (sp - t.v) * Math.min(1, dt * 1.5);
    if (mx || my) { const want = Math.atan2(my, mx); let dd = want - t.ang; dd -= Math.round(dd / TAU) * TAU; t.ang += clamp(dd, -dt * .9, dt * .9); t.turret += clamp(dd, -dt * .9, dt * .9) * 0; }
    const nx = t.x + Math.cos(t.ang) * t.v * dt, ny = t.y + Math.sin(t.ang) * t.v * dt;
    const solid = (x, y) => { const c = cellAt(x, y); return c === 3 || c === 10 || x < 10 || y < 10 || x > W - 10 || y > H - 10; };
    if (!solid(nx + Math.cos(t.ang) * 12, ny + Math.sin(t.ang) * 12)) { t.x = nx; t.y = ny; } else t.ang += dt * .8;
    t.track += t.v * dt;
    if (t.v > 2) {
      for (let k = -1; k <= 1; k++) for (let j = -1; j <= 1; j++) {
        const px = t.x + Math.cos(t.ang) * k * 9 - Math.sin(t.ang) * j * 5, py = t.y + Math.sin(t.ang) * k * 9 + Math.cos(t.ang) * j * 5, gi = Math.floor(py / CS) * GW + Math.floor(px / CS);
        if (grid[gi] === 6) { grid[gi] = 0; barrDirty = true; fieldT = 0; fxDebris(px, py); }
      }
      for (const c of cars) if (!c.gone && !c.crushed && Math.hypot(c.x - t.x, c.y - t.y) < 13) { c.crushed = true; c.wreck = true; c.moving = false; c.stopped = true; c.stopT = simT; clearCarCells(c); sfx.crash(c); logT("crush", "Танк смял машину", "good", 20); }
      const ca = Math.cos(t.ang), sa = Math.sin(t.ang), reach = 13 + t.v * dt;
      near(t.x, t.y, 16, a => { if (a.state !== "alive" || a.hidden || a.z > .5) return; const dx = a.x - t.x, dy = a.y - t.y, al = dx * ca + dy * sa, lt = Math.abs(-dx * sa + dy * ca); if (al < -12 || al > reach || lt > 7) return; if (a.role === "zombie") destroyZombie(a, false); else kill(a, false); a.crushed = true; fxBlood(a.x, a.y, 1, 10); });
    }
  }
}
function fireShell(t, target) {
  t.cd = rnd(3.5, 5); t.shells--; t.recoil = 1;
  const ang = t.turret + rnd(-.03, .03), d = Math.hypot(target.x - t.x, target.y - t.y) + rnd(-10, 10);
  // снаряд летит до цели или до первой стены
  let hx = t.x + Math.cos(ang) * d, hy = t.y + Math.sin(ang) * d, hitB = null;
  for (let s = 16; s < d; s += 4) { const x = t.x + Math.cos(ang) * s, y = t.y + Math.sin(ang) * s; if (cellAt(x, y) === 3) { hx = x; hy = y; hitB = buildings.find(b => x >= b.x0 - 1 && x <= b.x1 + 1 && y >= b.y0 - 1 && y <= b.y1 + 1); break; } }
  fxCannon(t, hx, hy); sfx.cannon(t);
  noises.push({ x: t.x, y: t.y, t: simT, r: 450 });
  // фугас выбивает кусок стены, но дом валится лишь после многих попаданий
  setTimeout0(.12, () => { boom(hx, hy, 26, false); if (hitB) { if (hitB.kind === "house") damageBuilding(hitB, 25, t.x, t.y); else hurtBuilding(hitB, 25, t.x, t.y, .3); } });
  first("tank", "Танк открыл огонь", "good");
}
// отложенные события в игровом времени
let timers = [];
function setTimeout0(t, fn) { timers.push({ t, fn }); }
function stepTimers(dt) { if (!timers.length) return; const due = []; timers = timers.filter(x => (x.t -= dt) > 0 || (due.push(x), false)); for (const x of due) x.fn(); }

/* ---------- огонь и взрыв для всего остального: машины, мелочи на улицах, гидранты, светофоры, заборы, деревья, канатка ----------
   Огонь медленный: горит то, что может гореть (дерево, пластик, сено, бензин), обугливается до остова и перекидывается на соседей;
   металл — фонари, гидранты, светофоры, опоры — огню не поддаётся. Взрыв мгновенный: ударная волна опрокидывает и отбрасывает,
   выбивает стёкла, мнёт кузова, ломает гидранты (бьёт фонтан), валит светофоры, ломает деревья, рвёт заборы и трос канатки;
   загорается только то, что у самого центра. Картинка — render19.js (wreckDirty — пора перерисовать мелочи) */
const WRECK = {
  burn: { bench: 1, play: 1, kiosk: 1.2, stop: .5, board: .8, umbrella: 1.5, pier: .7, hay: 3, trough: .4, tractor: .6, cow: .8, dps: .4 }, // скорость горения; кого нет — не горит
  heavy: new Set(["silo", "helipad", "pier", "dps", "mine", "wire"]), // ударная волна их не опрокидывает
  small: new Set(["bench", "umbrella", "trough", "barrel", "cow"]), // у центра взрыва разлетаются
};
let wreckT = 0, wreckDirty = false, treeHashOf = null, treeHash = null;
function treesNear(x, y, r, fn) {
  if (treeHashOf !== trees || treeHash.n !== trees.length) { treeHashOf = trees; treeHash = new Map(); treeHash.n = trees.length; for (const t of trees) { const k = Math.floor(t.y / 40) * 4096 + Math.floor(t.x / 40); let B = treeHash.get(k); if (!B) treeHash.set(k, B = []); B.push(t); } }
  for (let gy = Math.floor((y - r) / 40); gy <= Math.floor((y + r) / 40); gy++) for (let gx = Math.floor((x - r) / 40); gx <= Math.floor((x + r) / 40); gx++) { const B = treeHash.get(gy * 4096 + gx); if (B) for (const t of B) if (Math.hypot(t.x - x, t.y - y) < r) fn(t); }
}
function igniteProp(p, t = rnd(18, 35)) { const k = WRECK.burn[p.k]; if (!k || p.burnT > 0 || (p.char || 0) >= 1 || p.gone) return; p.burnT = t / Math.sqrt(k); wreckDirty = true; }
function igniteTree(t) { if (t.burnt || t.burnT > 0 || t.snap) return; t.burnT = rnd(14, 28); }
function igniteCar(c) { if (c.gone || c.burnT > 0 || (c.char || 0) >= 1 || c.z > 0) return; c.burnT = rnd(25, 45); c.burnAge = 0; }
function stepWreck(dt) {
  // горящие машины обугливаются; долго горящая может рвануть баком (бензовоз рвётся и так)
  for (const c of cars) if (c.burnT > 0) {
    c.char = Math.min(1, (c.char || 0) + dt / 22); c.burnAge = (c.burnAge || 0) + dt;
    if (!c.exploded && !(c.boomT > 0) && !c.tanker && !c.boomTried && c.burnAge > 10) { c.boomTried = true; if (Math.random() < .25) c.boomT = rnd(.5, 3); }
  }
  wreckT -= dt; if (wreckT > 0) return; const T = .5; wreckT += T;
  const rainK = world.rain || 0, wet = rainK > .5 ? .25 : 1, src = [];
  // под дождём тлеющее гаснет: мелочи, деревья, заборы
  if (rainK > .1) { for (const p of props) if (p.burnT > 0) p.burnT -= T * rainK * 2; for (const t of trees) if (t.burnT > 0) t.burnT -= T * rainK * 2; for (const f of fences) if (f.burnT > 0) f.burnT -= T * rainK * 2; }
  // что горит и докуда достаёт огонь
  for (const f of fires) src.push([f.x, f.y, f.r + 3]);
  for (const b of buildings) if (b.fire > 0 && b.state === "ok") src.push([(b.x0 + b.x1) / 2, (b.y0 + b.y1) / 2, Math.hypot(b.x1 - b.x0, b.y1 - b.y0) / 2 + 6]);
  for (const c of cars) if (c.burnT > 0 && !c.gone) src.push([c.x, c.y, 8]);
  for (const p of props) if (p.burnT > 0) { src.push([p.x + (p.dx || 0), p.y + (p.dy || 0), 6]); p.burnT -= T; p.char = Math.min(1, (p.char || 0) + T / 16 * Math.sqrt(WRECK.burn[p.k] || 1)); if (p.burnT <= 0) p.char = Math.max(p.char, .85); wreckDirty = true; }
  for (const t of trees) if (t.burnT > 0) { src.push([t.x, t.y, 10]); t.burnT -= T; if (t.burnT <= 0) { t.burnt = true; t.burnT = 0; gridDirty = true; } }
  for (const f of fences) if (f.burnT > 0) { src.push([(f[0] + f[2]) / 2, (f[1] + f[3]) / 2, 5]); f.burnT -= T; f.char = Math.min(1, (f.char || 0) + T / 10); wreckDirty = true; }
  // сломанный гидрант бьёт фонтаном: рядом гаснет
  for (const h of hydrants) if (h.spray > 0) {
    h.spray -= T;
    for (const f of fires) if (Math.hypot(f.x - h.x, f.y - h.y) < f.r + 14) f.l -= T * 2;
    for (const c of cars) if (c.burnT > 0 && Math.hypot(c.x - h.x, c.y - h.y) < 16) c.burnT -= T * 3;
    for (const p of props) if (p.burnT > 0 && Math.hypot(p.x - h.x, p.y - h.y) < 16) p.burnT -= T * 3;
  }
  if (!src.length) return;
  for (const [x, y, r] of src) {
    for (const p of props) if (!(p.burnT > 0) && Math.abs(p.x - x) < r + 4 && Math.abs(p.y - y) < r + 4 && Math.random() < T * .25 * wet) igniteProp(p);
    for (const c of cars) if (!(c.burnT > 0) && Math.abs(c.x - x) < r + 2 && Math.abs(c.y - y) < r + 2 && Math.random() < T * .1 * wet) igniteCar(c);
    treesNear(x, y, r + 5, t => { if (Math.random() < T * .18 * wet) igniteTree(t); });
    for (const f of fences) if (!(f.burnT > 0) && !f.gone && (f.char || 0) < 1 && Math.abs((f[0] + f[2]) / 2 - x) < r + 3 && Math.abs((f[1] + f[3]) / 2 - y) < r + 3 && Math.random() < T * .2 * wet) f.burnT = rnd(8, 16);
    // от горящих машин, мелочей и деревьев занимаются стоящие вплотную дома
    if (r <= 10) for (const b of buildings) if (b.state === "ok" && !(b.fire > 0) && x > b.x0 - 5 && x < b.x1 + 5 && y > b.y0 - 5 && y < b.y1 + 5 && Math.random() < T * (b.kind === "house" || b.kind === "dacha" || b.kind === "barn" ? .05 : .015) * wet) { b.fire = rnd(30, 60); first("bfire", "Горит здание", "bad"); }
  }
}
// ударная волна: зовётся из blastWorld
function wreckBlast(x, y, R, big) {
  for (const p of props) {
    if (p.gone) continue;
    const d = Math.hypot(p.x - x, p.y - y); if (d > R) continue;
    const k = 1 - d / R, ang = Math.atan2(p.y - y, p.x - x);
    p.glass = true; wreckDirty = true;
    if (WRECK.small.has(p.k) && k > .45) { p.gone = true; fxDebris(p.x, p.y); continue; }
    if (!WRECK.heavy.has(p.k) && k > .2) { p.tip = Math.min(1.55, Math.max(p.tip || 0, k * 2.4)); p.tipA = ang; const push = R * .22 * k; p.dx = (p.dx || 0) + Math.cos(ang) * push; p.dy = (p.dy || 0) + Math.sin(ang) * push; }
    if (k > .55) igniteProp(p, rnd(12, 25));
  }
  for (const h of hydrants) if (!h.broken && Math.hypot(h.x - x, h.y - y) < R * .8) { h.broken = true; h.spray = rnd(90, 150); h.tipA = Math.atan2(h.y - y, h.x - x); wreckDirty = true; }
  for (const n of RN) if (n.sig && !n.sigBroken && Math.hypot(n.x - x, n.y - y) < R * .9 + 20) { n.sigBroken = true; n.sig = false; n.sigA = Math.atan2(n.y - y, n.x - x); wreckDirty = true; } // светофоры повалены: перекрёсток по старшинству
  for (const f of fences) {
    if (f.gone) continue;
    const d = Math.hypot((f[0] + f[2]) / 2 - x, (f[1] + f[3]) / 2 - y);
    if (d < R * .7) { f.gone = true; wreckDirty = true; } else if (d < R) { f.char = Math.max(f.char || 0, (1 - d / R) * .8); wreckDirty = true; }
  }
  treesNear(x, y, R * .45, t => { if (!t.snap) { t.snap = true; t.burnt = true; t.burnT = 0; } });
  const F = funicular;
  if (F && F.supports && !F.broken && R >= 28) {
    for (const s of F.supports) { const p = cablePoint(F, s.d); if (Math.hypot(p[0] - x, p[1] - y) < R * .5) { breakCable(F, s, Math.atan2(p[1] - y, p[0] - x)); break; } }
    if (!F.broken) for (const c of F.cabins) { if (c.fallZ !== undefined) continue; const p = cabinPos(F, c); if (Math.hypot(p[0] - x, p[1] - y, (p[2] - 6 - gY(x, y)) * .7) < R * .6) dropCabin(F, c, p); }
  }
}
// трос порван: все кабинки падают, опора у места взрыва валится
function breakCable(F, s, ang) {
  F.broken = true; s.down = ang; logE("Взрыв повалил опору канатки: трос оборван, кабинки упали", "bad");
  for (const c of F.cabins) if (c.fallZ === undefined) dropCabin(F, c, cabinPos(F, c));
}
function dropCabin(F, c, p) { c.fx = p[0]; c.fy = p[1]; c.fallZ = p[2]; c.fallV = 0; c.fallen = false; wreckDirty = true; }
function stepCableFall(F, dt) {
  for (const c of F.cabins) {
    if (c.fallZ === undefined || c.fallen) continue;
    const g = gY(c.fx, c.fy) + 7.6; c.fallV += 40 * dt; c.fallZ -= c.fallV * dt;
    for (const a of c.riders) { a.x = c.fx; a.y = c.fy; }
    if (c.fallZ <= g) {
      c.fallZ = g; c.fallen = true; fxDebris(c.fx, c.fy); sfx.crash({ x: c.fx, y: c.fy });
      for (const a of c.riders) { a.hidden = false; a.onBus = null; const [x, y] = freeNear(c.fx, c.fy, 8); a.x = x; a.y = y; kill(a, false, "fall"); }
      c.riders = [];
    }
  }
}
