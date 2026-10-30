/* ---------- службы второй волны: автобусы эвакуации, приёмный покой, патрули, коммунальщики, снабжение, объезды, гидранты, гнёзда ---------- */
Object.assign(SERVICE, {
  bus: { col: "#e0a020", len: 2.3, vlen: 2.45, crew: null, n: 0, siren: null, name: "Автобус" },
  garbage: { col: "#3f7a3a", len: 1.5, crew: null, n: 0, siren: null, name: "Мусоровоз" },
  sweeper: { col: "#e08a20", len: 1.1, crew: null, n: 0, siren: null, name: "Поливалка" },
  delivery: { col: "#f0f0ea", len: 1.25, crew: null, n: 0, siren: null, name: "Доставка" },
  supply: { col: "#5a6a3a", len: 1.5, crew: null, n: 0, siren: null, name: "Снабжение" },
});
let hydrants = [], utilT = 0, patrolT = 0, busT = 0, supplyT = 0, closedT = 0, nestT = 0, patientT = 0;
const BUS_CAP = 20;
function resetServices2() { resetCalls(); utilT = 20; patrolT = 30; busT = 10; supplyT = 30; closedT = 0; nestT = 0; patientT = 0; }
function stepServices2(dt) {
  // перекрытия считаются и при выключенных службах: завалы и баррикады бывают и без них
  closedT -= dt; if (closedT <= 0) { closedT = 3; updateClosedRoads(); }
  stepBuses(dt); stepSnowRoads(dt);
  if (!settings.services) return;
  stepPatrols(dt); stepUtilities(dt); stepSupply(dt); stepNests(dt); stepPatients(dt);
}
const zombiesAt = (x, y, r) => { let n = 0; nearZ(x, y, r, () => n++); return n; };

/* ---------- автобусы: вывозят людей из переполненных и голодных укрытий в лагерь или за город ---------- */
function stepBuses(dt) {
  for (const c of cars) {
    if (!c.passengers || !c.passengers.length) continue;
    if (c.gone) { busGone(c); continue; }
    if (c.wreck) { busCrash(c); continue; }
    for (const p of c.passengers) { p.x = c.x; p.y = c.y; }
  }
  busT -= dt; if (busT > 0 || !settings.services) return; busT = 4;
  const camp = camps.length ? camps[camps.length - 1] : null;
  if (cars.filter(c => c.service === "bus" && !c.gone).length >= 2) return;
  let best = null, bs = 0;
  for (const b of buildings) {
    if (!b.occ || !b.door || b.state !== "ok" || b.busAssigned || b.kind === "hospital") continue;
    const n = b.occ.filter(o => o.role === "civ" && !o.bitten).length; if (n < 6) continue;
    const hungry = b.food === 0 && (b.hungryT || 0) > 45, full = n >= (b.cap || 20) * .9;
    // с лагерем вывозим при оцеплении или голоде; без лагеря — только при большой тревоге за город
    if (camp ? !(alert >= 3 || hungry || full) : alert < 4) continue;
    const score = n + (hungry ? 30 : 0) + (full ? 10 : 0); if (score > bs) { bs = score; best = b; }
  }
  if (!best) return;
  best.busAssigned = true;
  const c = spawnService("bus", best.door[0], best.door[1], null); c.bus = true; c.passengers = []; c.walking = 0; c.job = { shelter: best }; c.phase = "to"; c.boardT = 0; c.camp = camp;
  logE(camp ? "Штаб выслал автобус: людей из укрытия вывезут в лагерь" : "Штаб выслал автобус: людей вывезут из города", "good"); sfx.radio();
}
// автобус стоит у подъезда: люди выходят по одному и садятся; полный или заждавшийся — едет
function stepBusStop(c, dt) {
  const b = c.job && c.job.shelter;
  if (c.phase === "to") {
    c.boardT += dt; c.callT = (c.callT || 0) + dt;
    if (b && b.state === "ok" && c.callT > 1.5 && c.passengers.length + c.walking < BUS_CAP) {
      c.callT = 0; const o = b.occ.find(o => o.role === "civ" && !o.bitten && o.hidden);
      if (o) { leaveShelter(o, false); o.busGoal = c; o.dest = null; o.homeGoal = false; o.hideGoal = null; c.walking++; }
    }
    const danger = zombiesAt(c.x, c.y, 60) >= 2;
    if (c.passengers.length >= BUS_CAP || (c.boardT > 50 && c.walking === 0) || c.boardT > 110 || (danger && c.boardT > 8)) {
      if (b) b.busAssigned = false;
      if (!c.passengers.length) { releaseUnit(c); return; }
      c.phase = "go"; c.deployed = false; c.stopped = false; c.moving = true; c.svcT = 0; c.wait = 0;
      if (c.camp && camps.includes(c.camp)) c.goal = { x: c.camp.gate[0], y: c.camp.gate[1] + 16 }; else { c.goal = null; c.leaving = true; }
      logT("busgo", `Автобус увозит ${c.passengers.length} чел.` + (danger ? " — зомби близко, отъезжаем" : ""), "good", 10);
    }
    return;
  }
  // приехали в лагерь: высаживаем, люди идут за ворота
  const n = c.passengers.length;
  for (const p of c.passengers) { p.hidden = false; p.onBus = null; const [x, y] = freeNear(c.x, c.y, 16); p.x = x; p.y = y; p.panic = 0; p.dest = null; p.campGoal = c.camp; }
  c.passengers = [];
  logE(`Автобус привёз ${n} человек в лагерь`, "good"); first("busevac", "Первый автобус довёз людей до лагеря", "good");
  releaseUnit(c);
}
// автобус уехал с карты с людьми: они спасены
function busGone(c) {
  const n = c.passengers.length;
  for (const p of c.passengers) { p.hidden = false; p.onBus = null; p.state = "saved"; saved++; }
  c.passengers = [];
  if (n) logE(`Автобус вывез ${n} человек из города`, "good");
}
// автобус или скорая разбились: пассажиры выбираются наружу, часть ранена
function busCrash(c) {
  const n = c.passengers.length, hb = hospitalB();
  for (const p of c.passengers) { p.hidden = false; p.onBus = null; const [x, y] = freeNear(c.x, c.y, 14); p.x = x; p.y = y; p.panic = 1; if (Math.random() < .5) { p.hp = Math.max(5, p.hp - rnd(20, 50)); p.bleed = 4; } if (p.patient === undefined && hb && c.service === "ambulance") hb.patients = Math.max(0, (hb.patients || 0) - 1); }
  c.passengers = [];
  logE(c.service === "bus" ? `Автобус с людьми попал в аварию: ${n} чел. выбираются из салона` : "Скорая разбилась: раненые на дороге", "bad");
}
// пассажир идёт к автобусу (или к скорой) и садится
function busBoard(a, dt) {
  const c = a.busGoal;
  if (!c || c.gone || !c.deployed || c.phase !== "to") { a.busGoal = null; if (c) c.walking = Math.max(0, (c.walking || 0) - 1); return null; }
  const d = Math.hypot(c.x - a.x, c.y - a.y);
  if (d < 11) { a.hidden = true; a.onBus = c; a.hideB = null; a.busGoal = null; a.vx = a.vy = 0; c.walking = Math.max(0, (c.walking || 0) - 1); (c.passengers || (c.passengers = [])).push(a); return [0, 0, 0]; }
  return goTo(a, c.x, c.y, 10);
}

/* ---------- приёмный покой: скорая довозит раненых до больницы, там их лечат и выписывают ---------- */
function hospitalB() { const s = special.hospital; return s && s.b && s.b.state === "ok" && s.b.door ? s.b : null; }
function hospBeds() { const hb = hospitalB(); if (!hb) return 0; if (hb.beds === undefined) hb.beds = 16 + hb.floors * 2; return hb.beds - (hb.patients || 0); }
function sendToHospital(medic, p) {
  const c = medic.unit; if (!c || c.service !== "ambulance" || c.gone || p.busGoal || p.onBus || p.bitten) return;
  if (p.hp >= 85 && (p.burn || 0) < .2) return;
  const hb = hospitalB(); if (!hb || hospBeds() <= 0) return;
  if ((c.passengers || (c.passengers = [])).length + (c.walking || 0) >= 2) return;
  c.phase = "to"; c.walking = (c.walking || 0) + 1; p.busGoal = c; p.dest = null; p.homeGoal = false; hb.patients = (hb.patients || 0) + 1;
  logT("tohosp", "Раненого отправляют в приёмный покой", "good", 20);
}
function hospitalIntake(c) {
  const hb = hospitalB(), n = c.passengers.length;
  for (const p of c.passengers) {
    p.hidden = false; p.onBus = null;
    if (hb && p.state === "alive") { enterShelter(p, hb); p.patient = true; p.healT = 0; p.bleed = 0; }
    else { const [x, y] = freeNear(c.x, c.y, 10); p.x = x; p.y = y; if (hb) hb.patients = Math.max(0, (hb.patients || 0) - 1); }
  }
  c.passengers = [];
  if (n && hb) logT("intake", `Приёмный покой принял ${n} ${n === 1 ? "раненого" : "раненых"}`, "good", 15);
}
function stepPatients(dt) {
  patientT -= dt; if (patientT > 0) return; patientT = 2;
  const hb = hospitalB(); if (!hb || !hb.occ) return;
  let n = 0;
  for (const p of hb.occ.slice()) {
    if (!p.patient) continue; n++;
    p.hp = Math.min(100, p.hp + 2 * 1.2); p.burn = Math.max(0, (p.burn || 0) - .05); p.healT += 2;
    if (p.hp >= 95 && p.healT > 90) { leaveShelter(p, false); p.patient = false; hb.patients = Math.max(0, (hb.patients || 0) - 1); logT("discharge", "Из больницы выписали пациента", "", 30); }
  }
  hb.patients = Math.max(hb.patients || 0, n);
}

/* ---------- полицейские патрули: в спокойное время кружат по району и первыми едут на шум ---------- */
function stepPatrols(dt) {
  for (const c of cars) {
    if (c.service !== "police" || !c.patrol || c.gone || c.deployed || c.leaving) continue;
    c.patrolT = (c.patrolT || 0) + dt;
    // выстрелы, крики, нападения поблизости — патруль едет туда
    let tgt = null, bd = 220;
    for (const r of reports) { const d = Math.hypot(r.x - c.x, r.y - c.y); if (d < bd) { bd = d; tgt = r; } }
    for (const nz of noises) { if (simT - nz.t > 12) continue; const d = Math.hypot(nz.x - c.x, nz.y - c.y); if (d < bd) { bd = d; tgt = nz; } }
    if (tgt) { c.patrol = false; c.goal = { x: tgt.x, y: tgt.y }; c.svcT = 0; c.siren = "police"; sfx.siren(c); logT("patrol_go", "Патруль услышал шум и едет на место", "good", 20); continue; }
    if (c.patrolT > 240) { c.patrol = false; releaseUnit(c); }
  }
  patrolT -= dt; if (patrolT > 0) return; patrolT = 90;
  const ps = special.police; if (!ps || !ps.b || ps.b.state !== "ok" || alert >= 3) return;
  if (cars.filter(c => c.service === "police" && c.patrol && !c.gone).length >= (alert >= 1 ? 2 : 1)) return;
  const c = spawnService("police", ps.x, ps.y, ps); c.goal = null; c.patrol = true; c.patrolT = 0; c.siren = null;
}

/* ---------- коммунальщики: утром мусоровозы и поливалка, днём доставка в торговый центр ---------- */
function stepUtilities(dt) {
  for (const c of cars) {
    if (!c.roam || c.gone || c.leaving || c.deployed) continue;
    c.roamT = (c.roamT || 0) + dt;
    if (c.roamT > 300 || (lastCounts && lastCounts.Z > 3)) { releaseUnit(c); continue; }
    if (c.stops > 0 && simT > (c.nextStopT || 0) && c.lane && !c.turn && c.v > 4 && laneEnd(c.lane) - c.s > 30 && c.s > laneStart(c.lane) + 10) deployCrew(c);
  }
  utilT -= dt; if (utilT > 0) return; utilT = 15;
  const h = world.hour, quiet = !lastCounts || lastCounts.Z === 0;
  if (!quiet || alert > 0) return;
  const count = t => cars.filter(c => c.service === t && !c.gone).length;
  const start = (type, stops, spd) => { const [ex, ey] = edgePointNear(rnd(300, W - 300), rnd(200, H - 200)); const c = spawnService(type, ex, ey, null); c.goal = null; c.roam = true; c.roamT = 0; c.stops = stops; c.nextStopT = simT + rnd(15, 30); c.spd = spd; return c; };
  if (h >= 6 && h < 11 && count("garbage") < 2 && Math.random() < .5) { start("garbage", 6, 32); logT("garbage", "Мусоровозы выехали по дворам", "", 60); }
  if (h >= 5 && h < 8 && count("sweeper") < 1 && Math.random() < .5) { start("sweeper", 0, 20); logT("sweeper", "Поливалка моет улицы", "", 60); }
  if (h >= 9 && h < 19 && count("delivery") < 2 && special.mall && special.mall.b && special.mall.b.state === "ok" && Math.random() < .5) {
    const c = spawnService("delivery", special.mall.x, special.mall.y, null); c.roam = true; c.roamT = 0; c.stops = 1; c.delivery = true; c.nextStopT = 1e9;
  }
}
// стоянка коммунальной машины кончилась: едем дальше или домой
function roamStopDone(c, dt) {
  c.stopT2 = (c.stopT2 || 0) + dt;
  if (c.stopT2 < (c.service === "delivery" ? 25 : 12)) return;
  c.stopT2 = 0; c.stops = (c.stops || 0) - 1;
  if (c.stops <= 0 || c.delivery) { releaseUnit(c); return; }
  c.deployed = false; c.stopped = false; c.moving = true; c.goal = null; c.nextStopT = simT + rnd(20, 45);
}

/* ---------- снабжение: грузовики везут еду в укрытия и лагеря, топливо генераторам; конвой можно потерять ---------- */
function stepSupply(dt) {
  for (const c of cars) {
    if (c.service !== "supply" || c.gone || c.leaving || c.wreck || c.lost) continue;
    // потерянный конвой — один раз: иначе водитель «выскакивал» бы из машины каждый тик
    if (zombiesAt(c.x, c.y, 45) >= 2 && c.v < 3) { abandonCar(c, null); c.abandonedSvc = true; for (const a of c.crew || []) { a.unit = null; } c.lost = true; logE("Конвой снабжения потерян: водитель бежал от зомби", "bad"); }
  }
  supplyT -= dt; if (supplyT > 0) return; supplyT = 60;
  if (alert < 2 || cars.filter(c => c.service === "supply" && !c.gone).length >= 2) return;
  let tgt = null, bs = 0;
  for (const b of buildings) if (b.occ && b.occ.length >= 6 && b.door && b.state === "ok" && !b.supplyAssigned && (b.food || 0) < 40) { const s = 60 - (b.food || 0) + b.occ.length; if (s > bs) { bs = s; tgt = { x: b.door[0], y: b.door[1], feed: b, what: "shelter" }; } }
  for (const c of camps) if (!c.supplyAssigned && c.food < 80) { const s = 120 - c.food + c.n; if (s > bs) { bs = s; tgt = { x: c.gate[0], y: c.gate[1] + 16, feed: c, what: "camp" }; } }
  for (const g of gens) if (!g.supplyAssigned && g.fuel < g.max * .3) { const s = 80 + (g.max - g.fuel) / 4; if (s > bs) { bs = s; tgt = { x: g.x, y: g.y + 10, feed: g, what: "gen" }; } }
  if (!tgt) return;
  tgt.feed.supplyAssigned = true;
  const c = spawnService("supply", tgt.x, tgt.y, null); c.job = { feed: tgt.feed, what: tgt.what };
  logE(tgt.what === "gen" ? "Штаб высылает топливо для генератора" : tgt.what === "camp" ? "Штаб высылает продовольствие в лагерь" : "Штаб высылает продовольствие в укрытие", "good");
}
function supplyUnload(c, dt) {
  c.stopT2 = (c.stopT2 || 0) + dt; if (c.stopT2 < 20) return;
  const j = c.job || {}, f = j.feed;
  if (f) {
    f.supplyAssigned = false;
    if (j.what === "shelter") { f.food = (f.food || 0) + 120; f.hungryT = 0; logT("fed", "Продовольствие доставлено в укрытие", "good", 20); }
    else if (j.what === "camp") { f.food += 200; f.hungryT = 0; logT("fed", "Продовольствие доставлено в лагерь", "good", 20); }
    else if (j.what === "gen") { f.fuel = f.max; logT("fuel", "Генератор заправлен", "good", 20); }
  }
  releaseUnit(c);
}

/* ---------- гнёзда: в выгоревших остовах копятся зомби, пока остов не снесут ---------- */
function stepNests(dt) {
  nestT -= dt; if (nestT > 0) return; nestT = 10;
  const c = lastCounts || counts(); if (c.Z === 0 || c.Z > 30) return;
  // не чаще одного зомби в десять секунд на весь город, из случайного остова
  const cand = buildings.filter(b => b.gutted && b.state === "ok" && !b.siteCells && (b.nest || 0) < 4 && (b.nestT = (b.nestT || 0) + 10) >= 40);
  if (!cand.length || Math.random() > .5) return;
  const b = pick(cand), door = b.door || b.doorPref || [(b.x0 + b.x1) / 2, b.y1 + 6];
  const [x, y] = freeNear(door[0], door[1], 10); if (blocked(x, y)) return;
  const z = newAgent("zombie", x, y); turn(z); z.riseT = 0; b.nest = (b.nest || 0) + 1;
  if (b.nest === 1) logT("nest" + buildings.indexOf(b), "В выгоревшем остове завелись зомби: пока его не снесут, они будут выходить оттуда", "bad", 120);
}

/* ---------- объезды: улица с завалом на проезжей части закрыта, знаки на въездах, трафик идёт в обход ---------- */
// перекрытие по полосам: вдоль каждой полосы смотрим её ось и ±3 (ширина кузова) — завал, дом, баррикада, забор или сугроб;
// улица закрыта, если заблокированы все полосы, иначе это сужение (машины объезжают по встречной); e.blk — какие полосы
function laneBlocked(l) { for (let s = laneStart(l) - 4; s < laneEnd(l) + 4; s += 4) { const q = lanePos(l, clamp(s, 0, l.e.len)); for (const o of [-3, 0, 3]) { const px = q.x + q.ty * o, py = q.y - q.tx * o, c = cellAt(px, py); if (c === 8 || c === 3 || c === 6 || (c === 11 && roadMask[snowIdx(px, py)] === 1)) return true; } } return false; } // сугроб на бордюре полосу не закрывает
function updateClosedRoads() {
  let changed = 0, closedNew = 0;
  for (const e of RE) {
    if (e.rural) { if (e.closed || e.narrow) { e.closed = e.narrow = false; e.blk = null; changed++; } continue; }
    const bl = e.L.map(l => l ? laneBlocked(l) : false), lanes = e.L.filter(Boolean).length, nb = bl.filter(Boolean).length;
    const closed = lanes > 0 && nb === lanes, narrow = !closed && nb > 0;
    if (closed !== !!e.closed || narrow !== !!e.narrow) { if (closed && !e.closed) closedNew++; e.closed = closed; e.narrow = narrow; e.blk = nb ? bl : null; changed++; }
  }
  // пробки: сколько машин стоит на ребре — маршрутам это дороже
  for (const e of RE) e.jamN = 0; for (const c of cars) if (c.lane && !c.gone && c.moving && c.wait > 4) c.lane.e.jamN++;
  if (changed) { routeCache.clear(); exitRoute = null; }
  if (closedNew) logT("roadclose", "Улицы перекрыты: движение идёт в объезд", "", 60);
}

/* ---------- гидранты: у гидранта пожарные тушат быстрее ---------- */
function fireRate(a) {
  if (settings.noWater) return .3;
  const u = a.unit; if (!u) return 1.6;
  if (u.hydrant === undefined) { u.hydrant = hydrants.some(h => Math.abs(h.x - u.x) < 48 && Math.abs(h.y - u.y) < 48); if (u.hydrant) logT("hydrant", "Пожарные подключились к гидранту", "good", 40); }
  return u.hydrant ? 3.2 : 1.6;
}

/* ---------- снег на дорогах: игрок насыпает его инструментом «Снег», он тает (летом медленно, у огня быстро, зимой никак),
   снегоуборщики расчищают, эвакуатор вытягивает застрявших лебёдкой; у въезда на любую перекрытую улицу встаёт регулировщик ----------
   snowD — глубина снега в клетке; от SNOW_BLOCK клетка становится сугробом (код 11): машины в неё не въезжают, люди бредут медленно,
   улица, где сугробом занесены все полосы, закрыта (laneBlocked) — маршруты объезжают, подъехавшие разворачиваются. Картинка — render20.js */
const SNOW_BLOCK = 1;
let snowD = null, snowUnder = null, snowCells = new Set(), snowCity = null, snowT = 0, snowDirty = false, snowBox = null, plowT = 0, regulT = 0;
function snowInit() { if (!snowD || snowD.length !== grid.length) { snowD = new Float32Array(grid.length); snowUnder = new Uint8Array(grid.length); snowCells = new Set(); } snowCity = buildings; }
function snowMark(x, y) { snowDirty = true; snowBox = snowBox ? [Math.min(snowBox[0], x - 8), Math.min(snowBox[1], y - 8), Math.max(snowBox[2], x + 8), Math.max(snowBox[3], y + 8)] : [x - 8, y - 8, x + 8, y + 8]; }
// клетка становится сугробом или перестаёт им быть; под сугробом помним, что там было
function snowSync(i) {
  const d = snowD[i], g = grid[i];
  if (d >= SNOW_BLOCK) { if (g === 0 || g === 1 || g === 2 || g === 7) { snowUnder[i] = g; grid[i] = 11; barrDirty = true; fieldT = 0; } }
  else if (g === 11) { grid[i] = snowUnder[i]; barrDirty = true; fieldT = 0; }
  if (d <= .02) { snowD[i] = 0; snowCells.delete(i); }
}
// насыпать снег кругом радиуса R: в середине глубже, к краю тоньше; в дома и воду не сыплется. Клик за кликом куча растёт
// (до SNOW_MAX) и расползается: чем она уже выше, тем шире ложится новый снег
const SNOW_MAX = 12, SNOW_BURY = 1.2;
function pourSnow(x, y, amt = 2.4, R = 18) {
  snowInit(); R += snowD[snowIdx(x, y)] * 2.2;
  for (let gy = Math.floor((y - R) / CS); gy <= Math.floor((y + R) / CS); gy++) for (let gx = Math.floor((x - R) / CS); gx <= Math.floor((x + R) / CS); gx++) {
    if (gx < 0 || gy < 0 || gx >= GW || gy >= GH) continue;
    const i = gy * GW + gx, cx = gx * CS + CS / 2, cy = gy * CS + CS / 2, d = Math.hypot(cx - x, cy - y); if (d > R) continue;
    const g = grid[i]; if (g === 3 || g === 9 || g === 10) continue;
    snowD[i] = Math.min(SNOW_MAX, snowD[i] + amt * (1 - (d / R) ** 2) * rnd(.85, 1.15)); snowCells.add(i); snowSync(i);
  }
  snowMark(x - R, y - R); snowMark(x + R, y + R);
  // кого накрыло с головой (глубже SNOW_BURY) — засыпан: выбраться сам не может, мёрзнет (stepBuried)
  for (const a of agents) if (Math.abs(a.x - x) < R && Math.abs(a.y - y) < R && a.state === "alive" && !a.hidden && !a.buried && snowD[snowIdx(a.x, a.y)] >= SNOW_BURY) { a.buried = true; a.cold = a.cold || 0; a.dugOut = false; a.vx = a.vy = 0; logT("buried", a.role === "zombie" ? "Зомби засыпало снегом" : "Человека засыпало снегом: он замерзает", a.role === "zombie" ? "" : "bad", 20); }
  logT("snowpour", "Снег завалил улицу", "", 30);
}
// отвал снегоуборщика снимает с проезжей части в радиусе r не больше rate глубины в секунду: глубокую кучу — за несколько проходов
const PLOW_RATE = .16; // клетка остаётся под отвалом секунды, пока он ползёт: за проход снимается 3–5 глубины
function plowAt(x, y, r, dt) {
  if (!snowD) return 0; let moved = 0;
  for (let gy = Math.floor((y - r) / CS); gy <= Math.floor((y + r) / CS); gy++) for (let gx = Math.floor((x - r) / CS); gx <= Math.floor((x + r) / CS); gx++) {
    if (gx < 0 || gy < 0 || gx >= GW || gy >= GH) continue;
    const i = gy * GW + gx; if (!(snowD[i] > 0) || roadMask[i] !== 1) continue;
    if (Math.hypot(gx * CS + CS / 2 - x, gy * CS + CS / 2 - y) > r) continue;
    const k = Math.min(snowD[i], PLOW_RATE * dt); moved += k; snowD[i] -= k; snowSync(i);
  }
  if (moved) snowMark(x, y);
  return moved;
}
const snowIdx = (x, y) => clamp(Math.floor(y / CS), 0, GH - 1) * GW + clamp(Math.floor(x / CS), 0, GW - 1);
// сколько тает за секунду в точке: от сезона, солнца, дождя и огня рядом
function meltRate(x, y, heat) {
  const season = world.season || "summer";
  let m = (season === "winter" ? 0 : season === "autumn" ? .004 : .009) * (world.hour > 7 && world.hour < 19 ? 1.3 : .6) * (1 + (world.rain || 0) * .8);
  for (const [hx, hy, hr, hk] of heat) { const d = Math.hypot(x - hx, y - hy); if (d < hr) m += hk * (1 - d / hr); }
  return m;
}
function heatSources() {
  const heat = [];
  for (const f of fires) heat.push([f.x, f.y, f.r + 26, .3]);
  for (const b of buildings) if (b.fire > 0 && b.state === "ok") heat.push([(b.x0 + b.x1) / 2, (b.y0 + b.y1) / 2, Math.hypot(b.x1 - b.x0, b.y1 - b.y0) / 2 + 18, .12]);
  for (const c of cars) if (c.burnT > 0 && !c.gone) heat.push([c.x, c.y, 18, .2]);
  return heat;
}
function stepSnowRoads(dt) {
  if (snowCity === "load") snowCity = buildings; // партия загружена: снег из сохранения
  else if (snowCity !== buildings) { snowD = null; snowCells = new Set(); snowCity = buildings; }
  stepRegulators(dt);
  if (!snowD || !snowCells.size) return;
  snowT -= dt; if (snowT > 0) return; snowT += 1;
  // таяние
  const heat = heatSources();
  stepBuried(heat);
  for (const i of [...snowCells]) {
    const x = (i % GW) * CS + CS / 2, y = ((i / GW) | 0) * CS + CS / 2, m = meltRate(x, y, heat);
    if (m <= 0) continue; snowD[i] -= m; snowSync(i); snowMark(x, y);
  }
  // машины в сугробе застревают; когда снег сошёл или его расчистили — едут дальше
  for (const c of cars) {
    if (c.gone || c.service === "plow" || c.towedBy || c.z > 0) continue;
    const d = snowD[snowIdx(c.x, c.y)];
    if (!c.snowStuck && d >= SNOW_BLOCK * .8 && (c.moving || c.lane)) { c.snowStuck = true; c.snowWas = !!c.moving; c.moving = false; c.stopped = true; c.stopT = simT; c.v = 0; logT("snowstuck", "Машины застряли в снегу", "", 40); }
    else if (c.snowStuck && d < .4) { c.snowStuck = false; c.winchBy = null; if (c.snowWas && !c.wreck) { c.stopped = false; c.moving = true; } }
  }
  // снегоуборщики: на улицу, которую снег закрыл надолго (зимой — сразу)
  plowT -= 1; if (plowT > 0 || !settings.services) return; plowT = 4;
  for (const e of RE) {
    if (e.plowBy && (e.plowBy.service ? e.plowBy.gone || e.plowBy.leaving : !callOpen(e.plowBy))) e.plowBy = null;
    if (!(e.closed || e.narrow) || e.plowBy || e.rural) continue;
    let deep = 0, at = null;
    for (const l of e.L) if (l) for (let s = 0; s < e.len; s += 6) { const q = lanePos(l, s), i = snowIdx(q.x, q.y); if (grid[i] === 11 && snowD[i] > deep) { deep = snowD[i]; at = q; } }
    if (!at) continue;
    const m = meltRate(at.x, at.y, heat), wait = m > 0 ? (deep - SNOW_BLOCK * .5) / m : 1e9;
    if (wait < 60 && !(simT - (e.plowPrio ?? -1e9) < 40)) continue; // скоро растает само — если только этой улицы не ждёт ремонт
    if (callLoad("plow") >= 3) break;
    const q = callPlow(e, at.x, at.y);
    if (q.sent) logT("plow_go", "Снегоуборщик выехал расчищать занесённую улицу", "good", 30);
  }
}
// засыпанные снегом: человек и зомби мёрзнут — тем быстрее, чем глубже снег, и тем медленнее, чем быстрее он рядом тает (огонь);
// замёрзли насовсем (cold до 1) — погибли, тела забирают санитары. Снег сошёл раньше: откопали спасатели — цел и невредим,
// вытаял (огонь, оттепель) — обморожен, его везёт скорая. За засыпанным человеком диспетчер шлёт пожарных-спасателей с лопатами
function stepBuried(heat) {
  let digging = cars.filter(c => !c.gone && !c.leaving && c.job && c.job.dig).length + calls.filter(q => q.sent < q.need && q.targets[0].job && q.targets[0].job.dig).length;
  for (const a of agents) {
    if (!a.buried) continue;
    if (a.state !== "alive") { a.buried = false; continue; }
    const d = snowD[snowIdx(a.x, a.y)], m = meltRate(a.x, a.y, heat);
    if (d < .6) {
      a.buried = false;
      if (a.role !== "zombie") {
        if (a.dugOut) { a.cold = 0; logT("dugout", "Спасатели откопали человека из-под снега: жив и цел", "good", 20); }
        else { a.frost = Math.max(a.cold, .1); a.hp = Math.min(a.hp, 40 - a.cold * 25); a.ambAssigned = false; logT("thawed", "Человек вытаял из сугроба обмороженным: его везут в больницу", "", 20); }
      }
      continue;
    }
    a.cold = (a.cold || 0) + (.0015 + d * .001) * clamp(1 - m * 25, .15, 1); // под небольшой кучей держится минуты три-четыре, под огромной — минуту с небольшим
    if (a.cold >= 1) {
      a.frozen = true; a.buried = false;
      if (a.role === "zombie") destroyZombie(a, false); else { kill(a, false, "frost"); a.reanimate = false; }
      logT("frozen", a.role === "zombie" ? "Засыпанный снегом зомби замёрз" : "Засыпанный снегом человек замёрз насмерть", a.role === "zombie" ? "" : "bad", 20);
      continue;
    }
    // спасатели: к человеку под снегом, не больше трёх машин сразу; заявка на спасение — первая в очереди диспетчера.
    // a.rescueBy — машина спасателей, пока её нет — заявка
    const rb = a.rescueBy;
    if (a.role !== "zombie" && settings.services && digging < 3 && (!rb || (rb.service ? rb.gone || rb.leaving : !callOpen(rb)))) {
      const q = openCall("fire", a.x, a.y, { cls: CALL_CLS.rescue, targets: [{ x: a.x, y: a.y, job: { dig: a } }] }); a.rescueBy = q; digging++;
      dispatchCall(q); if (q.sent) logT("dig_go", "Пожарные-спасатели выехали откапывать человека из-под снега", "good", 20);
    }
  }
}
// спасатель с лопатой: идёт к засыпанному и копает вокруг него; откопал или поздно — к машине
function digStep(a, dt) {
  const v = a.job.dig;
  if (!v.buried || v.state !== "alive") { a.done = true; return a.unit ? goTo(a, a.unit.x, a.unit.y, 9) : [0, 0, 0]; }
  a.done = false; // у пожарных нет пожара — сами они сочли бы работу сделанной
  const d = Math.hypot(v.x - a.x, v.y - a.y);
  if (d > 5) return goTo(a, v.x, v.y, 9);
  a.tool = .3; a.dir = Math.atan2(v.y - a.y, v.x - a.x);
  // лопатой — аккуратно и медленно: снег вокруг человека, а не по нему
  let left = 0;
  for (let gy = Math.floor((v.y - 6) / CS); gy <= Math.floor((v.y + 6) / CS); gy++) for (let gx = Math.floor((v.x - 6) / CS); gx <= Math.floor((v.x + 6) / CS); gx++) {
    if (gx < 0 || gy < 0 || gx >= GW || gy >= GH) continue; const i = gy * GW + gx; if (!(snowD[i] > 0)) continue;
    snowD[i] = Math.max(0, snowD[i] - .22 * dt); snowSync(i); left += snowD[i];
  }
  snowMark(v.x, v.y);
  if (snowD[snowIdx(v.x, v.y)] < .6) v.dugOut = true;
  return [0, 0, 0];
}
// снегоуборщик на улицу e: сначала к точке (x, y) на ней — иначе маршрут объехал бы закрытую улицу кругом; на ней — дальше по ходу, насквозь.
// Его же вызывает игрок (инструмент «Снегоуборщик», callService): снега нет — проедет улицу и уедет. Это заявка диспетчеру
// (sim4.js): едет свободный снегоуборщик или новый с базы; пока все заняты, заявка ждёт, а e.plowBy — сама заявка
function callPlow(e, x, y) { const q = openCall("plow", x, y, { cls: CALL_CLS.clear, targets: [{ x, y, job: { plow: e } }] }); e.plowBy = q; dispatchCall(q); return q; }
// остался ли на полосах улицы снег, который стоит чистить; смотрим так же часто и так же широко, как laneBlocked (через 4 единицы,
// по оси полосы и в трёх единицах по бокам), иначе уборщик уезжал, а сугроб сбоку от оси держал улицу перекрытой
function snowLeft(e) { if (!snowD) return false; for (const l of e.L) if (l) for (let s = 0; s <= e.len; s += 4) { const q = lanePos(l, s); for (const o of [-3, 0, 3]) if (snowD[snowIdx(q.x + q.ty * o, q.y - q.tx * o)] >= .3) return true; } return false; }
// снегоуборщик ведёт отвалом перед собой по всей ширине проезжей части; проходит улицу туда и обратно, потом берёт следующую
function stepPlow(c, dt) {
  const e = c.job && c.job.plow, hw = c.lane ? c.lane.e.hw + Math.abs(c.lane.off || 0) : 10, dx = Math.cos(c.ang), dy = Math.sin(c.ang); // отвал — на всю проезжую часть
  const ahead = snowD ? snowD[snowIdx(c.x + dx * 12, c.y + dy * 12)] : 0;
  if (ahead > .2) c.v = Math.min(c.v, clamp(9 - ahead * 1.4, 1.2, 7)); // в снегу медленно, в глубоком — ползком
  if (plowAt(c.x + dx * 9, c.y + dy * 9, hw + 3, dt) + plowAt(c.x, c.y, hw + 3, dt) > 0) c.plowing = 1; else c.plowing = Math.max(0, (c.plowing || 0) - dt);
  if (!e) { releaseUnit(c); return; }
  const left = snowLeft(e);
  // упёрся (впереди застрявшая машина, затор): дотягивается отвалом дальше; улица чиста — работа сделана, долго стоит — уезжает
  if (c.wait > 6 && left) plowAt(c.x + dx * 18, c.y + dy * 18, hw + 6, dt);
  if (!c.plowIn && c.wait > 25 && c.lane) { c.lane.e.blockT = simT; c.next = null; c.route = null; c.wait = 8; } // в пробке по пути — другой дорогой
  if ((c.wait > 10 && !left) || (c.plowIn && c.wait > 90)) { e.plowBy = null; if (!left) logT("plow_done", "Улицу расчистили от снега", "good", 30); releaseUnit(c); return; }
  // подъезжает к концу своей улицы — сворачивает на неё (маршрут сам привёл бы только к узлу)
  if (!c.plowIn && c.lane && c.lane.e !== e && (c.lane.to === e.a || c.lane.to === e.b)) { const m = e.L.find(l => l && l.from === c.lane.to); if (m) c.next = m; }
  // въехал на свою улицу: цель — её конец по ходу, сугроб проходит насквозь
  if (!c.plowIn && c.lane && c.lane.e === e) { c.plowIn = true; const to = c.lane.to; c.goal = { x: to.x, y: to.y }; c.next = null; c.route = null; }
  // дошёл до конца: разворачивается и идёт обратно; проходов столько, сколько нужно, чтобы снять всю кучу. Конец своей улицы —
  // у её стоп-линии (дальше машина уже в коробке, и развернуться на ту же улицу нельзя), с чужой улицы — у самого узла
  const own = c.lane && !c.turn && c.lane.e === e;
  if (c.plowIn && c.goal && (own ? Math.hypot(c.goal.x - c.lane.to.x, c.goal.y - c.lane.to.y) < 5 && laneEnd(c.lane) - c.s < 24 : Math.hypot(c.goal.x - c.x, c.goal.y - c.y) < 30)) {
    c.plowPass++;
    if (!left || c.plowPass >= 14) { e.plowBy = null; logT("plow_done", "Улицу расчистили от снега", "good", 30); releaseUnit(c); return; }
    const other = Math.hypot(c.goal.x - e.a.x, c.goal.y - e.a.y) < 5 ? e.b : e.a; c.goal = { x: other.x, y: other.y }; c.next = null; c.route = null;
    // ещё на своей улице — разворот на встречную полосу той же улицы: маршрут повёл бы в объезд квартала (сама улица для маршрутов закрыта)
    if (c.lane && !c.turn && c.lane.e === e) { const u = oppLane(c.lane); if (u) c.next = u; }
  }
}
// эвакуатор с лебёдкой: подъезжает к краю сугроба и вытягивает машину к себе, потом забирает
function winchStep(c, w, dt) {
  if (!w.snowStuck) return true;
  w.winchBy = c; c.winchT = (c.winchT || 0) + dt;
  const tx = c.x - Math.cos(c.ang) * 14, ty = c.y - Math.sin(c.ang) * 14, d = Math.hypot(tx - w.x, ty - w.y);
  if (c.winchT < 2) return false; // крюк цепляют
  if (d > 3) { const v = Math.min(d, 4 * dt); w.x += (tx - w.x) / d * v; w.y += (ty - w.y) / d * v; plowAt(w.x, w.y, 4, 9); return false; }
  w.snowStuck = false; w.winchBy = null; logT("winch", "Эвакуатор вытянул лебёдкой застрявшую в снегу машину", "good", 30);
  return true;
}
// регулировщик: у въезда на перекрытую улицу (или в перекрытое направление при сужении) встаёт полицейский и заворачивает машины в объезд;
// не больше четырёх постов, к зомби не шлют
function stepRegulators(dt) {
  regulT -= dt; if (regulT > 0) return; regulT = 4;
  // регулировщиков привозит машина и сразу уезжает (на въезде она мешала бы технике); улица открылась — они уходят в участок
  for (const a of agents) {
    if (!a.regul || a.state !== "alive") continue;
    const e = a.regul;
    if (!e.closed && !e.narrow) { a.regul = null; a.order = special.police ? { x: special.police.x, y: special.police.y } : null; a.standDown = true; a.standT = simT; continue; }
    if (a.regulDir === undefined && a.order) { const nd = Math.hypot(a.order.x - e.a.x, a.order.y - e.a.y) < Math.hypot(a.order.x - e.b.x, a.order.y - e.b.y) ? e.a : e.b; a.regulDir = Math.atan2(nd.y - a.order.y, nd.x - a.order.x); }
  }
  for (const e of RE) e.regulBy = null;
  for (const a of agents) if (a.regul && a.state === "alive") a.regul.regulBy = a;
  for (const c of cars) if (c.regul && !c.gone && !c.deployed && !c.leaving) c.regul.regulBy = c; // ещё в пути
  if (!settings.services) return;
  let n = RE.filter(e => e.regulBy).length;
  for (const e of RE) {
    if (n >= 4) break;
    const dirA = e.closed || (e.blk && e.blk[0]), dirB = e.closed || (e.blk && e.blk[1]); // заблокированы полосы от a к b и от b к a
    if (!(dirA || dirB) || e.rural || e.regulBy || e.len < 30) continue;
    let z = 0; nearZ((e.a.x + e.b.x) / 2, (e.a.y + e.b.y) / 2, 120, () => z++); if (z) continue; // к зомби на регулировку не шлют
    const posts = [];
    // стоит на тротуаре у въезда, лицом к подъезжающим: не на дуге поворота, иначе машины (и снегоуборщик) ждали бы его как пешехода
    for (const [nd, s, on] of [[e.a, 18, dirA], [e.b, e.len - 18, dirB]]) { if (!on || nd.ed.length < 3 || nd.exit) continue; const p = edgePos(e, s), q = edgePos(e, Math.min(e.len, s + 2)), L = Math.hypot(q.x - p.x, q.y - p.y) || 1, sd = s < 30 ? 1 : -1, o = e.hw + 3; posts.push([p.x - (q.y - p.y) / L * o * sd, p.y + (q.x - p.x) / L * o * sd]); }
    if (!posts.length) continue;
    const c = spawnService("police", posts[0][0], posts[0][1], special.police); c.posts = posts; c.dropOnly = true; c.regul = e; e.regulBy = c; n++;
    logT("regul", "Регулировщик встал у въезда на перекрытую улицу: машины идут в объезд", "good", 60);
  }
}
