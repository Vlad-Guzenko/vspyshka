/* ---------- городские службы: выезжают сами по вызовам ---------- */
// полиция из участка, пожарные из части, скорая из больницы, ремонтники и армия въезжают в город с окраины
const SERVICE = {
  police: { col: "#e9e9ee", len: 1, crew: "police", n: 2, siren: "police", name: "Полиция" },
  fire: { col: "#b3241a", len: 1.5, crew: "fire", n: 4, siren: "fire", name: "Пожарные" },
  ambulance: { col: "#f1f1ec", len: 1.2, crew: "medic", n: 2, siren: "fire", name: "Скорая" },
  repair: { col: "#e0a020", len: 1.25, crew: "worker", n: 3, siren: "amber", name: "Ремонтники" },
  army: { col: "#4d5634", len: 1.45, crew: "army", n: 8, siren: null, name: "Армия" },
  tow: { col: "#f0c020", len: 1.3, crew: null, n: 0, siren: "amber", name: "Эвакуатор" },
  dump: { col: "#c9701c", len: 1.5, crew: null, n: 0, siren: null, name: "Самосвал" },
  mixer: { col: "#f2efe6", len: 1.4, crew: null, n: 0, siren: null, name: "Бетономешалка" },
  sanit: { col: "#e4ece6", len: 1.3, crew: "sanitar", n: 3, siren: null, name: "Санитары" },
};
function clearCarCells(c) { for (let y = c.y - 10; y <= c.y + 10; y += CS) for (let x = c.x - 10; x <= c.x + 10; x += CS) { const gx = Math.floor(x / CS), gy = Math.floor(y / CS); if (gx >= 0 && gy >= 0 && gx < GW && gy < GH && grid[gy * GW + gx] === 5) grid[gy * GW + gx] = 0; } fieldT = 0; }
let reports = [], dispatchT = 0, armyWaves = 0, serviceLog = {};
function report(x, y, kind) { if (reports.length < 80) reports.push({ x, y, t: simT, kind }); }
function nearestLanePoint(x, y) {
  let best = null, bd = 1e9;
  for (const l of lanes) {
    const d = Math.abs((l.s.v ? x : y) - l.c);
    if (d < bd) { const along = clamp(l.s.v ? y : x, l.a0 + 30, l.a1 - 30); if (!blocked(l.s.v ? l.c : along, l.s.v ? along : l.c)) { bd = d; best = { l, along }; } }
  }
  return best;
}
function edgeLanePoint(nx, ny) {
  // полоса, которая доходит до края карты, и её начало на этом краю; с координатами — один из трёх ближайших въездов
  const edge = lanes.filter(l => l.dir < 2 ? l.a0 <= 0 : l.a1 >= (l.s.v ? H : W));
  const pool = edge.length ? edge : lanes;
  const at = l => { const start = l.dir < 2 ? l.a0 + 20 : l.a1 - 20; return [l.s.v ? l.c : start, l.s.v ? start : l.c, start]; };
  let l;
  if (nx !== undefined) { const sorted = pool.map(l => { const [x, y] = at(l); return [Math.hypot(x - nx, y - ny), l]; }).sort((a, b) => a[0] - b[0]); l = pick(sorted.slice(0, 3))[1]; }
  else l = pick(pool);
  return { l, along: at(l)[2] };
}
function spawnService(type, gx, gy, from) {
  const S = SERVICE[type];
  let p = null;
  if (from) p = nearestLanePoint(from.x, from.y);
  if (!p) p = edgeLanePoint(gx, gy);
  const c = { moving: true, service: type, col: S.col, len: S.len, wreck: false, boomT: 0, burnT: 0, spd: 46, v: 20, wait: 0, stuck: 0, dmg: 0, horn: 0, goal: { x: gx, y: gy }, siren: S.siren, crew: [] };
  placeOnLane(c, p.l, p.along);
  // разворачиваемся в сторону цели
  const want = Math.atan2(gy - c.y, gx - c.x), dd = Math.cos(want) * DX[c.dir] + Math.sin(want) * DY[c.dir];
  if (dd < 0) { const opp = laneOf(c.lane.s, (c.dir + 2) % 4); if (opp) placeOnLane(c, opp, c.lane.s.v ? c.y : c.x); }
  c.ang = Math.atan2(DY[c.dir], DX[c.dir]);
  cars.push(c);
  if (S.siren) sfx.siren(c);
  return c;
}
// выбор поворота на перекрёстке: туда, где ближе к цели
function serviceTurn(c) {
  const gx = c.goal.x - c.x, gy = c.goal.y - c.y, L = Math.hypot(gx, gy) || 1;
  let best = c.dir, bs = (DX[c.dir] * gx + DY[c.dir] * gy) / L;
  for (const nd of [(c.dir + 1) % 4, (c.dir + 3) % 4]) { const s = (DX[nd] * gx + DY[nd] * gy) / L; if (s > bs + .15) { bs = s; best = nd; } }
  return best;
}
function deployCrew(c) {
  if (c.deployed) return; c.deployed = true; c.moving = false; c.v = 0;
  const S = SERVICE[c.service];
  for (let i = 0; i < S.n; i++) {
    const [x, y] = freeNear(c.x, c.y, 14);
    const a = newAgent(S.crew, x, y); a.unit = c; a.job = c.job || null; c.crew.push(a); if (c.sweep) a.sweep = true;
    if (S.crew === "fire") { a.cloth = "#b5361f"; a.pants = "#2b2b2b"; a.hair = "#e8c020"; a.hat = "fire"; a.vest = "#d8b020"; }
    if (S.crew === "worker") { a.cloth = "#f08a1c"; a.pants = "#2c3550"; a.hair = "#f4f4f0"; a.hat = "hard"; a.vest = "#f0c020"; }
  }
  logT("svc" + c.service, `${S.name} на месте`, "good", 10);
}
function releaseUnit(c) {
  // экипаж садится, машина уезжает
  if (c.leaving) return;
  c.leaving = true; c.moving = true; c.deployed = false; c.v = 0;
  const e = edgeLanePoint(); c.goal = { x: e.l.s.v ? e.l.c : e.along, y: e.l.s.v ? e.along : e.l.c };
}
function stepServiceCar(c, dt) {
  if (c.wreck) return;
  if (c.leaving && !c.moving) c.moving = true;
  if (c.deployed && !SERVICE[c.service].crew) {
    if (c.service === "tow") { const w = c.job && c.job.tow; if (w && !w.gone && !w.towedBy) { w.towedBy = c; w.stopped = false; w.moving = false; clearCarCells(w); logT("tow", "Эвакуатор забрал разбитую машину", "good", 20); } releaseUnit(c); }
    else if (c.service === "dump") { const r = c.job && c.job.ruin; if (!machines.some(m => m.job && m.job.ruin === r)) releaseUnit(c); }
    else if (c.service === "mixer") { const b = c.job && c.job.build; if (!b || b.state !== "construct") releaseUnit(c); }
    return;
  }
  if (c.deployed) {
    // ждём экипаж: если все погибли или вернулись — уезжаем
    const alive = c.crew.filter(a => a.state === "alive");
    if (!alive.length) { c.stopped = true; c.deployed = false; c.abandonedSvc = true; return; }
    if (alive.every(a => a.done && Math.hypot(a.x - c.x, a.y - c.y) < 10)) { for (const a of alive) a.state = "saved"; releaseUnit(c); }
    return;
  }
  if (c.leaving) { c.leaveT = (c.leaveT || 0) + dt; if (c.leaveT > 35 || c.x < 25 || c.y < 25 || c.x > W - 25 || c.y > H - 25) { c.gone = true; return; } }
  if (!c.leaving && c.goal && (Math.hypot(c.goal.x - c.x, c.goal.y - c.y) < 50 || c.wait > (c.sweep ? 30 : 6))) deployCrew(c);
}
function serviceTarget(type) {
  if (type === "fire") {
    for (const b of buildings) if (b.fire > 0 && b.state === "ok" && !b.fireAssigned) { b.fireAssigned = true; return { x: (b.x0 + b.x1) / 2, y: b.y1 + 6, job: { b } }; }
    for (const c of cars) if (c.burnT > 0 && !c.fireAssigned && !c.gone) { c.fireAssigned = true; return { x: c.x, y: c.y, job: { car: c } }; }
    for (const f of fires) if (f.l > 5 && !f.assigned) { f.assigned = true; return { x: f.x, y: f.y, job: { f } }; }
  }
  if (type === "tow") {
    const quiet = (x, y) => { let z = 0; nearZ(x, y, 120, () => z++); return z === 0; };
    for (const c of cars) if (c.wreck && c.stopped && !c.gone && !c.towAssigned && !c.towedBy && !(c.burnT > 0) && quiet(c.x, c.y)) { c.towAssigned = true; return { x: c.x, y: c.y, job: { tow: c } }; }
  }
  if (type === "repair") {
    // завалы, упавшие фонари, разбитые машины подальше от зомби
    const quiet = (x, y) => { let z = 0; nearZ(x, y, 120, () => z++); return z === 0; };

    for (const b of buildings) if (b.state === "construct" && simT - (b.lastWork || 0) > 30 && simT - (b.assignedT || -99) > 60 && quiet((b.x0 + b.x1) / 2, (b.y0 + b.y1) / 2)) { b.assignedT = simT; return { x: (b.x0 + b.x1) / 2, y: b.y1 + 8, job: { ruin: b } }; }
    for (const b of buildings) if (b.state === "ruin" && !b.clearAssigned && quiet((b.x0 + b.x1) / 2, (b.y0 + b.y1) / 2)) { b.clearAssigned = true; return { x: (b.x0 + b.x1) / 2, y: b.y1 + 8, job: { ruin: b } }; }
    for (const l of lamps) if (l.down && !l.fixAssigned && quiet(l.x, l.y)) { l.fixAssigned = true; return { x: l.x, y: l.y, job: { lamp: l } }; }
  }
  return null;
}
function activeUnits(type) { return cars.filter(c => c.service === type && !c.gone && !c.wreck && !c.leaving && !c.abandonedSvc).length; }
function stepServices(dt) {
  for (const c of cars) if (c.service) stepServiceCar(c, dt);
  reports = reports.filter(r => simT - r.t < 40);
  dispatchT -= dt;
  if (!settings.services || dispatchT > 0) return;
  dispatchT = 3;
  if (settings.noRadio) { if (Math.random() < .05) logT("noradio2", "Диспетчер не слышит вызовы: радиовышка разрушена", "bad", 60); return; }
  // санитары: вывозят тела из спокойных районов
  if (activeUnits("sanit") < 3) { const b = bodyTarget(); if (b) { b.sanitAssigned = simT + 1; const c = spawnService("sanit", b.x, b.y, special.hospital); c.job = { body: b }; logT("disp_sanit", "Санитарная служба выехала за телами", "", 30); } }
  // полиция: чем больше вызовов, тем больше патрулей
  const attacks = reports.filter(r => r.kind === "attack");
  if (attacks.length && activeUnits("police") < Math.min(8, 1 + Math.floor(counts().Z / 5))) {
    const r = attacks[attacks.length - 1]; const c = spawnService("police", r.x, r.y, special.police);
    logT("disp_police", "Диспетчер: патруль выехал на вызов", "good", 15); first("svc_police", "Полиция выехала на первый вызов", "good");
    reports = reports.filter(q => Math.hypot(q.x - r.x, q.y - r.y) > 120);
  }
  if (activeUnits("fire") < 5) { const t = serviceTarget("fire"); if (t) { const c = spawnService("fire", t.x, t.y, special.fire); c.job = t.job; logT("disp_fire", "Пожарные выехали на вызов", "good", 15); } }
  const wounded = agents.find(a => a.state === "alive" && a.role === "civ" && (a.hp < 45 || (a.burn > .25)) && !a.ambAssigned);
  if (wounded && activeUnits("ambulance") < 3) { wounded.ambAssigned = true; spawnService("ambulance", wounded.x, wounded.y, special.hospital); logT("disp_amb", "Скорая выехала к пострадавшему", "good", 20); }
  if (activeUnits("tow") < 4) { const t = serviceTarget("tow"); if (t) { const c = spawnService("tow", t.x, t.y, null); c.job = t.job; } }
  if (activeUnits("repair") < Math.min(10, 3 + Math.floor(buildings.filter(b => b.state === "ruin").length / 6))) {
    const t = serviceTarget("repair");
    if (t) {
      const c = spawnService("repair", t.x, t.y, null); c.job = t.job;
      // к завалу едут погрузчик и самосвал
      if (t.job.ruin && t.job.ruin.state === "ruin") { const p = nearestLanePoint(t.x, t.y); const lx = p ? (p.l.s.v ? p.l.c : p.along) : t.x, ly = p ? (p.l.s.v ? p.along : p.l.c) : t.y; addMachine("loader", lx, ly, { ruin: t.job.ruin }); spawnService("dump", t.x, t.y, null).job = { ruin: t.job.ruin }; logT("loader", "К завалу выехали погрузчик и самосвал", "good", 20); }
    }
  }
  // армия: вводится, когда полиция не справляется
  const c = counts();
  if (false && armyWaves < 4 && c.Z > 40 + armyWaves * 60) {
    armyWaves++;
    let cx = 0, cy = 0, n = 0; for (const a of agents) if (a.state === "alive" && a.role === "zombie") { cx += a.x; cy += a.y; n++; }
    for (let i = 0; i < 2; i++) spawnService("army", cx / n + rnd(-80, 80), cy / n + rnd(-80, 80), null);
    if (armyWaves >= 3) { const [tx, ty] = freeNear(cx / n, cy / n, 200); addTank(...edgePointNear(tx, ty)); }
    logE(armyWaves === 1 ? "Введена армия: колонна въезжает в город" : `Подкрепление армии, волна ${armyWaves}`, "good"); sfx.radio();
  }
}
function edgePointNear(x, y) { const e = edgeLanePoint(x, y); return [e.l.s.v ? e.l.c : e.along, e.l.s.v ? e.along : e.l.c]; }

/* ---------- работа экипажей ---------- */
function thinkCrew(a, dt, zn, zd) {
  // пожарные тушат, ремонтники чинят, санитары собирают тела; все возвращаются к машине, когда дела кончились
  const job = a.job;
  if (a.role === "sanitar") {
    if (zn && zd < 45) { a.done = true; return null; }
    if (a.done) return goTo(a, a.unit.x, a.unit.y, 9);
    if (!a.body || a.body.state !== "dead") {
      let best = null, bd = 160; near(a.x, a.y, 160, b => { if (b.state === "dead" && !(b.reanimate && !b.burnt) && b.z <= 0 && !b.carried) { const d = Math.hypot(b.x - a.x, b.y - a.y); if (d < bd) { bd = d; best = b; } } });
      if (!best) { a.done = true; return goTo(a, a.unit.x, a.unit.y, 9); }
      a.body = best; best.carried = a;
    }
    const b = a.body, d = Math.hypot(b.x - a.x, b.y - a.y);
    if (d < 4) { a.workT = (a.workT || 0) + dt; a.tool = .3; if (a.workT > 1.2) { a.workT = 0; collectBody(b, a); a.body = null; a.collected = (a.collected || 0) + 1; logT("sanit", "Санитары увезли тело", "", 25); } return [0, 0, 0]; }
    return goTo(a, b.x, b.y, 8);
  }
  if (a.role === "fire") {
    if (zn && zd < 9) { if (a.cd <= 0) { a.cd = 1.1; zn.zhp -= 1; a.aim = Math.atan2(zn.y - a.y, zn.x - a.x); a.aimT = .5; a.axe = .4; if (zn.zhp <= 0) destroyZombie(zn, false); } return [0, 0, 0]; } // топором
    // горящие люди рядом — сбить пламя
    let burning = null; near(a.x, a.y, 40, b => { if (!burning && b !== a && b.onFire > 0 && b.state !== "saved") burning = b; });
    let tx, ty, done = false;
    if (burning) { tx = burning.x; ty = burning.y; if (Math.hypot(tx - a.x, ty - a.y) < 18) { burning.onFire = 0; a.spray = .3; a.sprayAt = [tx, ty]; } }
    else if (job && job.b) { const b = job.b; tx = clamp(a.x, b.x0 - 14, b.x1 + 14); ty = clamp(a.y, b.y0 - 14, b.y1 + 14); if (b.fire <= 0 || b.state !== "ok") done = true; else if (Math.hypot((b.x0 + b.x1) / 2 - a.x, (b.y0 + b.y1) / 2 - a.y) < Math.max(b.x1 - b.x0, b.y1 - b.y0) / 2 + 45) { b.fire -= dt * (settings.noWater ? .3 : 2.2); if (settings.noWater) logT("nowater", "Пожарные: нет воды в гидрантах, тушим из бака", "bad", 40); a.spray = .3; a.sprayAt = [(b.x0 + b.x1) / 2 + rnd(-10, 10), (b.y0 + b.y1) / 2 + rnd(-10, 10), b.h * .5]; if (b.fire <= 0) { b.fire = 0; logT("ext", "Пожарные потушили здание", "good", 10); } return [0, 0, 0]; } }
    else if (job && job.car) { const c = job.car; tx = c.x; ty = c.y; if (c.burnT <= 0) done = true; else if (Math.hypot(tx - a.x, ty - a.y) < 30) { c.burnT -= dt * 4; a.spray = .3; a.sprayAt = [c.x, c.y]; for (const f of fires) if (Math.hypot(f.x - c.x, f.y - c.y) < 14) f.l -= dt * 4; return [0, 0, 0]; } }
    else if (job && job.f) { const f = job.f; tx = f.x; ty = f.y; if (f.l <= 0) done = true; else if (Math.hypot(tx - a.x, ty - a.y) < f.r + 25) { f.l -= dt * 3; f.r = Math.max(2, f.r - dt * .5); a.spray = .3; a.sprayAt = [f.x, f.y]; return [0, 0, 0]; } }
    else done = true;
    if (done) { const t = serviceTarget("fire"); if (t && Math.hypot(t.x - a.x, t.y - a.y) < 300) { for (const m of a.unit.crew) m.job = t.job; } else a.done = true; }
    if (tx !== undefined && !a.done) return goTo(a, tx, ty, 11);
  }
  if (a.role === "worker") {
    if (zn && zd < 70) { a.done = true; return null; } // при зомби бросают работу
    const fin = () => { a.workT = 0; a.done = !job; for (const m of a.unit.crew) { m.job = null; m.done = true; } };
    if (job && job.tow) { const c = job.tow; if (c.gone) fin(); else if (Math.hypot(c.x - a.x, c.y - a.y) < 14) { a.workT = (a.workT || 0) + dt; a.tool = .3; if (a.workT > 8) { c.gone = true; fillCells(c.x - 9, c.y - 9, c.x + 9, c.y + 9, cellAt(c.x, c.y) === 5 ? 0 : cellAt(c.x, c.y)); fieldT = 0; logT("tow", "Ремонтники убрали разбитую машину", "good", 20); fin(); } return [0, 0, 0]; } else return goTo(a, c.x, c.y, 8); }
    if (job && job.lamp) { const l = job.lamp; if (!l.down) fin(); else if (Math.hypot(l.x - a.x, l.y - a.y) < 8) { a.workT = (a.workT || 0) + dt; a.tool = .3; if (a.workT > 6) { l.down = 0; gridDirty = true; fin(); } return [0, 0, 0]; } else return goTo(a, l.x, l.y, 8); }
    if (job && job.ruin) {
      const b = job.ruin; a.tool = .3;
      // разбираем завал клетка за клеткой
      let cell = -1, cd = 1e9;
      for (let y = b.y0 - 30; y < b.y1 + 30; y += CS) for (let x = b.x0 - 30; x < b.x1 + 30; x += CS) if (cellAt(x, y) === 8) { const d = Math.hypot(x - a.x, y - a.y); if (d < cd) { cd = d; cell = [x, y]; } }
      if (cell === -1) {
        // завал разобран — начинаем строить заново
        if (b.state === "ruin" || b.state === "construct") { if (b.state === "ruin") { startConstruct(b); spawnService("mixer", (b.x0 + b.x1) / 2, b.y1 + 10, null).job = { build: b }; logE(b.kind === "tower" ? "Ремонтники начали восстанавливать небоскрёб" : "Ремонтники начали восстанавливать дом", "good"); } for (const m of a.unit.crew) { m.buildB = b; m.job = null; } }
        else { fin(); logT("ruin", "Завал разобран", "good", 20); }
      }
      else if (cd < 10) { a.workT = (a.workT || 0) + dt; if (a.workT > 2.5) { a.workT = 0; const gi = Math.floor(cell[1] / CS) * GW + Math.floor(cell[0] / CS); grid[gi] = cell[0] >= b.x0 && cell[0] < b.x1 && cell[1] >= b.y0 && cell[1] < b.y1 ? 7 : 1; fieldT = 0; gridDirty = true; } return [0, 0, 0]; }
      else return goTo(a, cell[0], cell[1], 8);
    }
    if (a.buildB) {
      const b = a.buildB; if (b.state !== "construct") { a.buildB = null; a.done = true; }
      else { const tx = clamp(a.x, b.x0 - 6, b.x1 + 6), ty = clamp(a.y, b.y0 - 6, b.y1 + 6); a.tool = .3; if (Math.hypot(tx - a.x, ty - a.y) < 8 && (a.x < b.x0 - 2 || a.x > b.x1 + 2 || a.y < b.y0 - 2 || a.y > b.y1 + 2)) return [0, 0, 0]; return goTo(a, tx + (tx === b.x0 - 6 ? -2 : tx === b.x1 + 6 ? 2 : 0), ty + (ty === b.y0 - 6 ? -2 : ty === b.y1 + 6 ? 2 : 0), 8); }
    }
    if (!job && !a.buildB) a.done = true;
  }
  if (a.done && a.unit) return goTo(a, a.unit.x, a.unit.y, 9);
  return null;
}
/* ---------- путь к цели: поле расстояний в коробке вокруг цели и агента, кэш по клетке цели ---------- */
// люди не проходят сквозь дома, машины, деревья и заграждения; завалы медленные. Поле хранится только для коробки
const pathCache = new Map(); let pathBudgetT = -1, pathBudget = 0;
function bfsBox(e, sx, sy) {
  const { x0, y0, w, h, f } = e; f.fill(FAR);
  const si = (clamp(Math.floor(sy / CS), y0, y0 + h - 1) - y0) * w + (clamp(Math.floor(sx / CS), x0, x0 + w - 1) - x0);
  f[si] = 0; ring[0].push(si); let pending = 1;
  for (let d = 0; pending > 0 && d < 3000; d++) {
    const b = ring[d % RING];
    while (b.length) {
      const i = b.pop(); pending--;
      if (f[i] !== d) continue;
      const x = i % w, y = (i / w) | 0;
      for (const [dx, dy] of NB4) {
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
        const c = grid[(ny + y0) * GW + nx + x0];
        if (c === 3 || c === 4 || c === 5 || c === 6 || c === 9 || c === 10) continue;
        const j = ny * w + nx, nd = d + (c === 8 ? 3 : 1);
        if (nd < f[j]) { f[j] = nd; ring[nd % RING].push(j); pending++; }
      }
    }
  }
  for (const b of ring) b.length = 0;
}
function boxDir(e, x, y) {
  const gx = Math.floor(x / CS) - e.x0, gy = Math.floor(y / CS) - e.y0, w = e.w, h = e.h;
  if (gx < 0 || gy < 0 || gx >= w || gy >= h) return null;
  const v0 = e.f[gy * w + gx]; if (v0 >= FAR) return null;
  let best = null, bv = v0;
  for (const [dx, dy] of NB8) {
    const nx = gx + dx, ny = gy + dy;
    if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
    const v = e.f[ny * w + nx]; if (v >= FAR) continue;
    if (dx && dy && (e.f[gy * w + nx] >= FAR || e.f[ny * w + gx] >= FAR)) continue;
    if (v < bv) { bv = v; best = [dx, dy]; }
  }
  if (!best) return null;
  const l = Math.hypot(best[0], best[1]); return [best[0] / l, best[1] / l];
}
function pathField(a, tx, ty) {
  if (pathBudgetT !== simT) { pathBudgetT = simT; pathBudget = 4; }
  const gx = clamp(Math.floor(tx / CS), 0, GW - 1), gy = clamp(Math.floor(ty / CS), 0, GH - 1), key = gy * GW + gx;
  const ax = clamp(Math.floor(a.x / CS), 0, GW - 1), ay = clamp(Math.floor(a.y / CS), 0, GH - 1);
  let e = pathCache.get(key);
  const inside = e && ax >= e.x0 && ax < e.x0 + e.w && ay >= e.y0 && ay < e.y0 + e.h;
  if (e && inside && simT - e.t < 8) return e;
  if (pathBudget <= 0) return e && inside ? e : null;
  pathBudget--;
  if (pathCache.size >= 300) { let ok = null, ot = 1e9; for (const [k, v] of pathCache) if (v.t < ot) { ot = v.t; ok = k; } pathCache.delete(ok); }
  const m = 22; // коробка с запасом, чтобы обойти квартал
  const x0 = clamp(Math.min(inside ? e.x0 : gx, ax) - m, 0, GW - 1), y0 = clamp(Math.min(inside ? e.y0 : gy, ay) - m, 0, GH - 1);
  const x1 = clamp(Math.max(inside ? e.x0 + e.w - 1 : gx, ax) + m, 0, GW - 1), y1 = clamp(Math.max(inside ? e.y0 + e.h - 1 : gy, ay) + m, 0, GH - 1);
  const w = x1 - x0 + 1, h = y1 - y0 + 1;
  if (!e || e.w !== w || e.h !== h) e = { x0, y0, w, h, f: new Int16Array(w * h), t: 0 }; else { e.x0 = x0; e.y0 = y0; }
  pathCache.set(key, e);
  let sx = tx, sy = ty; if (blocked(tx, ty)) { const [fx, fy] = freeNear(tx, ty, 8); sx = fx; sy = fy; }
  bfsBox(e, sx, sy); e.t = simT;
  return e;
}
function goTo(a, tx, ty, sp) {
  const d = Math.hypot(tx - a.x, ty - a.y);
  if (d < 3) return [0, 0, 0];
  const ux = (tx - a.x) / d, uy = (ty - a.y) / d;
  // прямо, если близко и впереди свободно или цель видна; иначе по полю расстояний вокруг домов и заграждений
  const ahead = blocked(a.x + ux * 8, a.y + uy * 8);
  if (a.stuck < .6 && !ahead && (d < 30 || (d < 120 && los(a.x, a.y, tx, ty)))) return [ux, uy, sp];
  const e = pathField(a, tx, ty), dir = e ? boxDir(e, a.x, a.y) : null;
  if (dir) return [dir[0] + ux * .1, dir[1] + uy * .1, sp];
  if (ahead || a.stuck > .6) { const w = wander(a, .016); return [w[0] + ux * .5, w[1] + uy * .5, sp]; }
  return [ux, uy, sp];
}
