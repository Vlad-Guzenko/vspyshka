/* ---------- укрытия: люди прячутся в домах и на крышах, зомби ломают двери ---------- */
const HIDE_KINDS = new Set(["apt", "house", "tower", "mall", "police", "hospital", "warehouse", "fire"]);
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

/* ---------- карантинная стена ---------- */
const wallMask = new Uint8Array(GW * GH), quarMask = new Uint8Array(GW * GH);
let wallJobs = [];
function planQuarantine(x0, y0, x1, y1) {
  if (x1 < x0) [x0, x1] = [x1, x0]; if (y1 < y0) [y0, y1] = [y1, y0];
  x0 = clamp(x0, CS * 2, W - CS * 2); x1 = clamp(x1, CS * 2, W - CS * 2); y0 = clamp(y0, CS * 2, H - CS * 2); y1 = clamp(y1, CS * 2, H - CS * 2);
  if (x1 - x0 < 60 || y1 - y0 < 60) return false;
  const cells = [];
  const add = (x, y) => { const gx = Math.floor(x / CS), gy = Math.floor(y / CS); if (gx < 0 || gy < 0 || gx >= GW || gy >= GH) return; const c = grid[gy * GW + gx]; if (c === 0 || c === 1 || c === 2 || c === 7 || c === 8) cells.push(gy * GW + gx); };
  // обход периметра по часовой: строители идут вдоль забора
  for (let x = x0; x <= x1; x += CS) add(x, y0);
  for (let y = y0 + CS; y <= y1; y += CS) add(x1, y);
  const gx = (x0 + x1) / 2; // ворота: проход 14 м в середине нижней стороны
  for (let x = x1 - CS; x >= x0; x -= CS) if (Math.abs(x - gx) > 7) add(x, y1);
  for (let y = y1 - CS; y > y0; y -= CS) add(x0, y);
  const j = { cells, i: 0, x0, y0, x1, y1, t0: simT, work: 0, gate: [gx, y1] };
  wallJobs.push(j);
  j.cp = addGateCheckpoint(gx, y1);
  // по углам и вдоль сторон — посты военных лицом наружу, пока строители ставят сетку
  const posts = [[x0, y0], [x1, y0], [x0, y1], [x1, y1], [(x0 + x1) / 2, y0], [gx - 12, y1], [gx + 12, y1], [x0, (y0 + y1) / 2]].map(([cx, cy]) => freeNear(cx + (cx === x0 ? -12 : cx === x1 ? 12 : 0), cy + (cy === y0 ? -12 : cy === y1 ? 12 : 0), 10));
  sendPosts("army", gx, y1 + 20, posts, { guardJob: j });
  const truck = spawnService("builder", (x0 + x1) / 2, y1 + 14, null); truck.job = { wall: j }; j.lastSent = simT;
  logE("Карантин: военные оцепили район, строители едут ставить забор; выход через КПП с проверкой", "good"); radio("Штаб: зона оцеплена, строители выдвинулись. Из карантина никого не выпускать");
  return true;
}
function stepWalls(dt) {
  for (const j of wallJobs) {
    // сетку ставят строители у фронта работ; если их нет долго, военные достраивают сами, медленно
    j.work = j.work || 0;
    let builders = 0; const gi0 = j.cells[j.i], fx = (gi0 % GW) * CS + 4, fy = ((gi0 / GW) | 0) * CS + 4;
    near(fx, fy, 16, a => { if (a.state === "alive" && a.role === "builder" && !a.done) builders++; });
    const speed = builders ? .9 * Math.min(builders, 4) : simT - j.t0 > 150 ? .8 : 0;
    j.acc = (j.acc || 0) + speed * dt;
    const n = Math.min(j.cells.length - j.i, Math.floor(j.acc)); j.acc -= n;
    for (let k = 0; k < n; k++) { const gi = j.cells[j.i++]; const c = grid[gi]; if (c === 3 || c === 5 || c === 9) continue; grid[gi] = 6; bhp[gi] = 300; wallMask[gi] = 1; quarMask[gi] = 1; }
    if (n) { barrDirty = true; fieldT = Math.min(fieldT, .4); }
    if (j.i >= j.cells.length && !j.doneLogged) { j.doneLogged = true; logE("Забор карантина замкнут", "good"); for (const a of agents) if (a.guardJob === j) { a.guardJob = null; a.order = null; } }
  }
  wallJobs = wallJobs.filter(j => j.i < j.cells.length);
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
