/* ---------- службы второй волны: автобусы эвакуации, приёмный покой, патрули, коммунальщики, снабжение, объезды, гидранты, гнёзда ---------- */
Object.assign(SERVICE, {
  bus: { col: "#e0a020", len: 2.1, crew: null, n: 0, siren: null, name: "Автобус" },
  garbage: { col: "#3f7a3a", len: 1.5, crew: null, n: 0, siren: null, name: "Мусоровоз" },
  sweeper: { col: "#e08a20", len: 1.1, crew: null, n: 0, siren: null, name: "Поливалка" },
  delivery: { col: "#f0f0ea", len: 1.25, crew: null, n: 0, siren: null, name: "Доставка" },
  supply: { col: "#5a6a3a", len: 1.5, crew: null, n: 0, siren: null, name: "Снабжение" },
});
let hydrants = [], utilT = 0, patrolT = 0, busT = 0, supplyT = 0, closedT = 0, nestT = 0, patientT = 0;
const BUS_CAP = 20;
function resetServices2() { utilT = 20; patrolT = 30; busT = 10; supplyT = 30; closedT = 0; nestT = 0; patientT = 0; }
function stepServices2(dt) {
  stepBuses(dt);
  if (!settings.services) return;
  stepPatrols(dt); stepUtilities(dt); stepSupply(dt); stepNests(dt); stepPatients(dt);
  closedT -= dt; if (closedT <= 0) { closedT = 5; updateClosedRoads(); }
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
    if (tgt) { c.patrol = false; c.goal = { x: tgt.x, y: tgt.y }; c.svcT = 0; if (c.siren) sfx.siren(c); logT("patrol_go", "Патруль услышал шум и едет на место", "good", 20); continue; }
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
    if (c.service !== "supply" || c.gone || c.leaving || c.wreck) continue;
    if (zombiesAt(c.x, c.y, 45) >= 2 && c.v < 3) { abandonCar(c, null); for (const a of c.crew || []) { a.unit = null; } c.lost = true; logE("Конвой снабжения потерян: водитель бежал от зомби", "bad"); }
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
  const c = lastCounts || counts(); if (c.Z === 0 || c.Z > 60) return;
  // не чаще одного зомби в десять секунд на весь город, из случайного остова
  const cand = buildings.filter(b => b.gutted && b.state === "ok" && !b.siteCells && (b.nest || 0) < 4 && (b.nestT = (b.nestT || 0) + 10) >= 40);
  if (!cand.length || Math.random() > .5) return;
  const b = pick(cand), door = b.door || b.doorPref || [(b.x0 + b.x1) / 2, b.y1 + 6];
  const [x, y] = freeNear(door[0], door[1], 10); if (blocked(x, y)) return;
  const z = newAgent("zombie", x, y); turn(z); z.riseT = 0; b.nest = (b.nest || 0) + 1;
  if (b.nest === 1) logT("nest" + buildings.indexOf(b), "В выгоревшем остове завелись зомби: пока его не снесут, они будут выходить оттуда", "bad", 120);
}

/* ---------- объезды: улица с завалом на проезжей части закрыта, знаки на въездах, трафик идёт в обход ---------- */
function updateClosedRoads() {
  let changed = 0;
  for (const e of RE) {
    if (e.rural || e.kind === "ring") { e.closed = false; continue; }
    let closed = false;
    for (let t = e.ra + 4; t < e.len - e.rb - 4 && !closed; t += 10) { const p = edgePos(e, t); for (const o of [-e.hw * .85, -e.hw * .45, 0, e.hw * .45, e.hw * .85]) { const c = cellAt(p.x - p.ty * o, p.y + p.tx * o); if (c === 8 || c === 3) { closed = true; break; } } }
    if (closed !== !!e.closed) { e.closed = closed; changed++; }
  }
  if (changed) { routeCache.clear(); exitRoute = null; logT("roadclose", "Улицы с завалами перекрыты: движение идёт в объезд", "", 60); }
}

/* ---------- гидранты: у гидранта пожарные тушат быстрее ---------- */
function fireRate(a) {
  if (settings.noWater) return .3;
  const u = a.unit; if (!u) return 1.6;
  if (u.hydrant === undefined) { u.hydrant = hydrants.some(h => Math.abs(h.x - u.x) < 48 && Math.abs(h.y - u.y) < 48); if (u.hydrant) logT("hydrant", "Пожарные подключились к гидранту", "good", 40); }
  return u.hydrant ? 3.2 : 1.6;
}
