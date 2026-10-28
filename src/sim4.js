/* ---------- городские службы: выезжают сами по вызовам ---------- */
// полиция из участка, пожарные из части, скорая из больницы, ремонтники и армия въезжают в город с окраины
const SERVICE = {
  police: { col: "#e9e9ee", len: 1, crew: "police", n: 2, siren: "police", name: "Полиция" },
  fire: { col: "#b3241a", len: 1.7, crew: "fire", n: 4, siren: "fire", name: "Пожарные" },
  ambulance: { col: "#f1f1ec", len: 1.2, crew: "medic", n: 2, siren: "fire", name: "Скорая" },
  repair: { col: "#e0a020", len: 1.25, crew: "worker", n: 3, siren: "amber", name: "Ремонтники" },
  army: { col: "#4d5634", len: 1.6, crew: "army", n: 8, siren: null, name: "Армия" },
  tow: { col: "#f0c020", len: 1.3, crew: null, n: 0, siren: "amber", name: "Эвакуатор" },
  dump: { col: "#c9701c", len: 1.6, crew: null, n: 0, siren: null, name: "Самосвал" },
  mixer: { col: "#f2efe6", len: 1.4, crew: null, n: 0, siren: null, name: "Бетономешалка" },
  sanit: { col: "#e4ece6", len: 1.3, crew: "sanitar", n: 3, siren: null, name: "Санитары" },
  builder: { col: "#e8a81a", len: 1.45, crew: "builder", n: 4, siren: "amber", name: "Строители" },
  lowboy: { col: "#d8a018", len: 2.83, crew: null, n: 0, siren: "amber", name: "Трал" },
};

// ---------- облик служб: у каждой несколько машин, ливрей и форм, чтобы город не выглядел однообразно ----------
const MODEL_LEN = { policeSuv: 1.03, policeVan: 1.17, omon: 1.67, ambulance2: 1.33, ladder: 1.75, rescue: 1.6, btr: 1.7, tigr: 1.25, tow: 1.45, utility: 1.17 };
function wpick(list) { let r = Math.random() * list.reduce((a, x) => a + x[1], 0); for (const x of list) { r -= x[1]; if (r <= 0) return x[0]; } return list[0][0]; }
function setModel(c, m) { c.model = m; if (MODEL_LEN[m]) c.len = MODEL_LEN[m]; }
function styleService(c, type) {
  if (type === "police") setModel(c, wpick([["police", 5], ["policeSuv", 3], ["policeVan", 2]]));
  else if (type === "ambulance") setModel(c, wpick([["ambulance", 6], ["ambulance2", 4]]));
  else if (type === "fire") setModel(c, wpick([["fire", 5], ["ladder", 3], ["rescue", 2]]));
  else if (type === "army") setModel(c, wpick([["army", 7], ["btr", 3]]));
  else if (type === "tow") setModel(c, "tow");
  else if (type === "repair") setModel(c, wpick([["boxtruck", 1], ["utility", 1]]));
  // скорая: новая жёлто-белая или старая бело-красная; армия — оттенки защитного; коммунальщики — оранжевые
  if (type === "ambulance") { c.modern = Math.random() < .5; c.col = c.modern ? "#f6f4ea" : "#f1f1ec"; c.liv = c.modern ? "#e8c020" : "#d42020"; }
  if (type === "army") c.col = pick(["#4d5634", "#535a3c", "#5a5e44"]);
  if (c.model === "utility") { c.col = "#e8801c"; c.liv = "#f2f0e8"; }
  c.dress = Math.floor(Math.random() * 3);
}
// машина под задачу постов: на малый армейский пост — «Тигр», федералы — тёмные «Тигры» и грузовики Росгвардии,
// полиции на КПП — фургон, большой полицейский наряд — автобус ОМОН
function stylePosts(c, type) {
  if (type === "army") {
    if (c.fed) { setModel(c, Math.random() < .6 ? "tigr" : "army"); c.col = "#3a3e42"; c.cab = "#2a2c30"; if (c.model === "army") c.len = SERVICE.army.len; }
    else if ((c.crewN || SERVICE.army.n) <= 4) setModel(c, "tigr");
  }
  if (type === "police") { if ((c.crewN || 2) >= 4) { setModel(c, "omon"); c.col = "#283244"; } else if (c.cp) setModel(c, "policeVan"); }
}
// форма экипажа по машине и варианту
function dressCrew(a, c, i) {
  const v = c.dress || 0;
  if (a.role === "police") {
    if (c.model === "omon") { a.cloth = "#26292e"; a.pants = "#1f2226"; a.vest = "#15171a"; a.hat = "helmetBlk"; }
    else if ((c.model === "police" || c.model === "policeSuv") && v === 0) a.vest = "#c8e04a"; // ДПС: салатовый светоотражающий жилет
  }
  if (a.role === "army") {
    if (c.fed) { a.cloth = "#3a3e42"; a.pants = "#33373b"; a.vest = "#1e2124"; a.hat = "helmetBlk"; }
    else { const camo = [["#55603a", "#4d5634"], ["#5f6a4c", "#565f45"], ["#6b6b4e", "#5f5f45"]][v]; a.cloth = camo[0]; a.pants = camo[1]; a.vest = v === 1 ? "#4a5238" : "#3f4a2a"; if (i === 0) a.hat = "cap"; }
  }
  if (a.role === "medic" && c.modern) { a.cloth = "#2a4f8a"; a.pants = "#24426f"; a.vest = "#e8c020"; }
  if (a.role === "fire") {
    if (v === 1) { a.cloth = "#3d342a"; a.pants = "#2e2820"; } // тёмная боевка
    a.hat = i === 0 ? "fireWhite" : v === 2 ? "fireRed" : "fire";
  }
  if ((a.role === "worker" || a.role === "builder") && v === 1) { a.cloth = "#2c4a7a"; a.pants = "#24395e"; }
}
// кузов служебной машины
const SERVICE_MODEL = { lowboy: "lowboy", police: "police", fire: "fire", ambulance: "ambulance", repair: "boxtruck", army: "army", tow: "truck", dump: "truck", mixer: "truck", sanit: "boxtruck", builder: "bus", bus: "bus", garbage: "garbage", sweeper: "tanker", delivery: "boxtruck", supply: "army" };
function clearCarCells(c) {
  if (c.cells) { for (let k = 0; k < c.cells.length; k += 2) if (grid[c.cells[k]] === 5) grid[c.cells[k]] = c.cells[k + 1]; c.cells = null; fieldT = 0; return; }
  for (let y = c.y - 10; y <= c.y + 10; y += CS) for (let x = c.x - 10; x <= c.x + 10; x += CS) { const gx = Math.floor(x / CS), gy = Math.floor(y / CS); if (gx >= 0 && gy >= 0 && gx < GW && gy < GH && grid[gy * GW + gx] === 5) grid[gy * GW + gx] = 0; } fieldT = 0;
}
let reports = [], dispatchT = 0, armyWaves = 0, serviceLog = {}, lostUnits = []; // где недавно погиб целый экипаж: туда патрули больше не шлют
function report(x, y, kind) { if (reports.length < 80) reports.push({ x, y, t: simT, kind }); if (kind === "attack") nearZ(x, y, 70, z => { z.spotT = simT; }); }
function spawnService(type, gx, gy, from) {
  const S = SERVICE[type];
  // армия выезжает из своей части; from === false — приходят извне, с края карты (федеральные войска)
  if (from == null && type === "army" && special.base && special.base.b && special.base.b.state === "ok") from = special.base;
  let p = from ? nearestLanePoint(from.x, from.y) : null;
  if (!p) p = edgeLanePoint(gx, gy);
  const c = { ...newCar(), model: SERVICE_MODEL[type] || "van", service: type, col: S.col, len: S.len, vlen: S.vlen, spd: 46, v: 20, goal: { x: gx, y: gy }, siren: S.siren, crew: [] };
  styleService(c, type);
  placeOnLane(c, p.l, p.s);
  // разворачиваемся, если по встречной полосе к цели ближе
  const opp = oppLane(p.l), R = routeTo(gx, gy);
  if (opp && R && !p.l.from.exit) {
    const s2 = p.l.e.len - p.s, here = laneEnd(p.l) - p.s + R.dist[p.l.to.id], there = laneEnd(opp) - s2 + R.dist[opp.to.id];
    if (there < here) placeOnLane(c, opp, s2);
  }
  cars.push(c);
  if (S.siren) sfx.siren(c);
  return c;
}
// встать у бордюра: центр машины — за краем проезжей части, наполовину на тротуаре (на трассе — на обочине)
function curbShift(l) { return -Math.max(0, l.e.hw + (l.e.rural ? 3.5 : 2.2) - l.off); }
function pullOver(c) {
  if (!c.lane || c.turn || c.tank) return;
  const l = c.lane; c.latTgt = c.latOff = curbShift(l); c.pulled = true;
  const q = lanePos(l, c.s); c.x = q.x + q.ty * c.latOff + (c.offx || 0); c.y = q.y - q.tx * c.latOff + (c.offy || 0);
}
function deployCrew(c) {
  if (c.deployed) return; c.deployed = true; c.moving = false; c.v = 0; c.stopped = true; c.deployT = simT; c.tripT = 0;
  pullOver(c);
  const S = SERVICE[c.service], sid = S.crew === "army" && !c.posts ? ++squadSeq : 0;
  for (let i = 0; i < (c.crewN || S.n); i++) {
    const [x, y] = freeNear(c.x, c.y, 14);
    const a = newAgent(S.crew, x, y); a.unit = c; a.job = c.job || null; c.crew.push(a); if (c.sweep) a.sweep = true; if (sid) a.squad = sid;
    if (S.crew === "fire") { a.cloth = "#b5361f"; a.pants = "#2b2b2b"; a.hair = "#e8c020"; a.hat = "fire"; a.vest = "#d8b020"; }
    if (S.crew === "worker" || S.crew === "builder") { a.cloth = "#f08a1c"; a.pants = "#2c3550"; a.hair = "#f4f4f0"; a.hat = "hard"; a.vest = "#f0c020"; }
    dressCrew(a, c, i);
  }
  if (sid) squads.set(sid, { id: sid, members: c.crew.map(m => m.id), leader: c.crew[0].id, state: "advance", holdAt: null, holdT: 0, regroupT: 0, slots: [] });
  // посты: высаженные занимают заданные точки; машина, которая только привезла, уезжает
  if (c.posts && c.posts.length) c.crew.forEach((a, i) => { const p = c.posts[i % c.posts.length]; a.order = { x: p[0], y: p[1] }; if (c.fed) a.fed = true; if (c.guardJob) a.guardJob = c.guardJob; if (c.cp) a.cp = c.cp; if (c.guardB) a.guardB = c.guardB; });
  if (c.dropOnly) { for (const a of c.crew) { a.unit = null; a.job = null; } c.crew = []; releaseUnit(c); }
  logT("svc" + c.service, `${S.name} на месте`, "good", 10);
}
// привезти людей и уехать: грузовик с заданными постами
// привезти людей и уехать: грузовик с заданными постами
function sendPosts(type, x, y, posts, extra) {
  const c = spawnService(type, x, y, extra && extra.fed ? false : type === "police" ? special.police : type === "ambulance" ? special.hospital : null);
  c.posts = posts; c.dropOnly = true; Object.assign(c, extra || {}); stylePosts(c, type); return c;
}
// недоделанная работа снова доступна диспетчеру
function releaseJob(j) {
  if (!j) return;
  if (j.ruin && j.ruin.state === "ruin") j.ruin.clearAssigned = false;
  if (j.gut && j.gut.gutted) j.gut.clearAssigned = false;
  if (j.b && j.b.fire > 0) j.b.fireAssigned = false;
  if (j.car && j.car.burnT > 0) j.car.fireAssigned = false;
  if (j.f) j.f.assigned = false;
  if (j.tow && !j.tow.towedBy) j.tow.towAssigned = false;
  if (j.lamp && j.lamp.down) j.lamp.fixAssigned = false;
  if (j.body && j.body.state === "dead") { j.body.sanitAssigned = 0; j.body.carried = null; }
}
function releaseUnit(c) {
  // экипаж садится, машина уезжает
  if (c.leaving) return;
  releaseJob(c.job); c.stopped = false;
  c.leaving = true; c.moving = true; c.deployed = false; c.v = 0; c.next = null; c.route = null;
  const home = c.service === "fire" ? special.fire : c.service === "police" ? special.police : c.service === "ambulance" ? special.hospital : c.service === "army" && !c.fed ? special.base : null;
  c.goal = home && home.b && home.b.state === "ok" ? { x: home.x, y: home.y } : null; c.homeGoal = !!c.goal;
}
function stepServiceCar(c, dt) {
  if (c.wreck) { if (!c.wreckRel) { c.wreckRel = true; releaseJob(c.job); for (const a of c.crew) { a.unit = null; a.job = null; a.done = false; } c.crew = []; c.stopped = true; c.stopT = simT; } return; }
  // экипаж погиб: машина брошена, новых людей из неё не появляется
  if (c.abandonedSvc) return;
  if (c.leaving && !c.moving) c.moving = true;
  if (c.deployed && !SERVICE[c.service].crew) {
    if (c.service === "tow") { const w = c.job && c.job.tow; if (w && !w.gone && !w.towedBy && !w.player) { w.towedBy = c; w.stopped = false; w.moving = false; clearCarCells(w); logT("tow", w.wreck ? "Эвакуатор забрал разбитую машину" : "Эвакуатор увёз брошенную машину", "good", 20); } releaseUnit(c); }
    else if (c.service === "dump") { const r = c.job && c.job.dump; if (!machines.some(m => !m.gone && m.job && (m.job.ruin === r || m.job.demo === r))) releaseUnit(c); }
    else if (c.service === "mixer") { const b = c.job && c.job.build; if (!b || b.state !== "construct") releaseUnit(c); }
    else if (c.service === "bus") stepBusStop(c, dt);
    else if (c.service === "supply") supplyUnload(c, dt);
    else if (c.service === "lowboy") lowboyStep(c, dt);
    else if (c.roam) roamStopDone(c, dt);
    return;
  }
  if (c.deployed) {
    // ждём экипаж: если все погибли или вернулись — уезжаем
    const alive = c.crew.filter(a => a.state === "alive" && a.role === SERVICE[c.service].crew && a.unit === c);
    if (!c.deployT) c.deployT = simT; if (simT - c.deployT > 420) { for (const a of alive) a.done = true; }
    if (!alive.length) { c.stopped = true; c.stopT = simT; c.deployed = false; c.abandonedSvc = true; releaseJob(c.job); lostUnits.push({ x: c.x, y: c.y, t: simT }); return; }
    // отозванный отряд садится по одному; через минуту машина уходит без отставших — они остаются в городе
    if (c.recall) { for (const a of alive) if (a.done && Math.hypot(a.x - c.x, a.y - c.y) < 12) a.state = "saved"; if (alive.every(a => a.state === "saved") || simT - (c.recallT || simT) > 60) { for (const a of alive) if (a.state === "alive") { a.unit = null; a.done = false; } c.crew = []; releaseUnit(c); } return; }
    if (alive.every(a => a.done)) { c.allDoneT = c.allDoneT || simT; } else c.allDoneT = 0;
    if (alive.every(a => a.done && Math.hypot(a.x - c.x, a.y - c.y) < 10) || (c.allDoneT && simT - c.allDoneT > 60)) { for (const a of alive) a.state = "saved"; releaseUnit(c); }
    return;
  }
  // не может подъехать к цели (кружит, цель далеко от дорог): за пять минут пути — встаёт где есть; время на поворотах тоже идёт
  if (!c.leaving && c.goal && !c.patrol) { c.tripT = (c.tripT || 0) + dt; if (c.tripT > 300) { c.tripT = 0; deployCrew(c); return; } } else c.tripT = 0;
  if (c.leaving) { c.leaveT = (c.leaveT || 0) + dt; if (c.homeGoal && c.goal && Math.hypot(c.goal.x - c.x, c.goal.y - c.y) < 40) { if (c.passengers && c.passengers.length) hospitalIntake(c); c.gone = true; return; } if (c.leaveT > (c.homeGoal ? 180 : 60) || c.x < 25 || c.y < 25 || c.x > W - 25 || c.y > H - 25) { c.gone = true; return; } }
  // на месте: у цели; в пробке — только если цель уже близко, иначе ищем другой путь
  if (!c.leaving && c.goal && !c.turn) { const d = Math.hypot(c.goal.x - c.x, c.goal.y - c.y); if (d < 50 || (c.service === "dump" ? c.wait > 8 && d < 60 : c.wait > 25 && d < 260)) deployCrew(c); else if (c.wait > 40 && c.lane && c.service !== "dump") { c.lane.e.blockT = simT; c.next = null; c.wait = 20; } }
}
function serviceTarget(type) {
  if (type === "fire") {
    // горящий дом: важнее тот, где люди и соседи вплотную; машина встаёт у ближайшего гидранта, если он не дальше 70
    let fb = null, fs = -1e9;
    for (const b of buildings) { if (!(b.fire > 0) || b.state !== "ok" || b.fireAssigned) continue; let nb = 0; for (const o of buildings) if (o !== b && o.state === "ok" && Math.hypot(Math.max(b.x0 - o.x1, o.x0 - b.x1, 0), Math.max(b.y0 - o.y1, o.y0 - b.y1, 0)) < 15) nb++; const s = (b.occ ? b.occ.length : 0) * 20 + nb * 8 + (Object.values(special).some(sp => sp.b === b) ? 300 : 0) + b.floors; if (s > fs) { fs = s; fb = b; } }
    if (fb) { fb.fireAssigned = true; const cx = (fb.x0 + fb.x1) / 2, cy = (fb.y0 + fb.y1) / 2; let hx = cx, hy = fb.y1 + 6, hd = 70; for (const h of hydrants) { const d = Math.hypot(Math.max(fb.x0 - h.x, 0, h.x - fb.x1), Math.max(fb.y0 - h.y, 0, h.y - fb.y1)); if (d < hd) { hd = d; hx = h.x; hy = h.y; } } return { x: hx, y: hy, job: { b: fb } }; }
    for (const c of cars) if (c.burnT > 0 && !c.fireAssigned && !c.gone) { c.fireAssigned = true; return { x: c.x, y: c.y, job: { car: c } }; }
    for (const f of fires) if (f.l > 5 && !f.assigned) { f.assigned = true; return { x: f.x, y: f.y, job: { f } }; }
  }
  if (type === "tow") {
    const quiet = (x, y) => { let z = 0; nearZ(x, y, 120, () => z++); return z === 0; };
    for (const c of cars) if ((c.wreck || c.stopped) && !c.moving && !c.service && !c.tank && !c.gone && !c.towAssigned && !c.towedBy && !(c.burnT > 0) && simT - (c.stopT || 0) > 60 && quiet(c.x, c.y)) { c.towAssigned = true; return { x: c.x, y: c.y, job: { tow: c } }; }
  }
  if (type === "repair") {
    // завалы, упавшие фонари, разбитые машины подальше от зомби
    const quiet = (x, y) => { let z = 0; nearZ(x, y, 120, () => z++); return z === 0; };
    // выгоревший, но крепкий дом — ремонт: бригада восстанавливает его с трети готовности
    for (const b of buildings) if (b.gutted && b.state === "ok" && gutRepairable(b) && !b.clearAssigned && b.fire <= 0 && quiet((b.x0 + b.x1) / 2, (b.y0 + b.y1) / 2)) { b.clearAssigned = true; const g = siteGoal(b); return { x: g[0], y: g[1], job: { gut: b } }; }

    for (const b of buildings) if (b.state === "construct" && simT - (b.lastWork || 0) > 30 && simT - (b.assignedT || -99) > 60 && quiet((b.x0 + b.x1) / 2, (b.y0 + b.y1) / 2)) { b.assignedT = simT; const g = siteGoal(b); return { x: g[0], y: g[1], job: { ruin: b } }; }
    // строители — только когда завал вывезен и техника уехала
    for (const b of buildings) if (b.state === "ruin" && !b.clearAssigned && (!b.clearedT || simT - b.clearedT > 12) && !machines.some(m => !m.gone && !m.leave && m.job && m.job.ruin === b) && ruinRubble(b) === 0 && quiet((b.x0 + b.x1) / 2, (b.y0 + b.y1) / 2)) { b.clearAssigned = true; const g = siteGoal(b); return { x: g[0], y: g[1], job: { ruin: b } }; }
    for (const l of lamps) if (l.down && !l.fixAssigned && quiet(l.x, l.y)) { l.fixAssigned = true; return { x: l.x, y: l.y, job: { lamp: l } }; }
  }
  return null;
}
// каркас выгоревшего дома цел, если осталось больше трети прочности: ремонт, а не снос
function gutRepairable(b) { return b.hp > b.maxHp * .3; }
function siteScore(b) {
  // проезжая часть под завалом, инфраструктура, больница рядом, гнездо в остове; маленький бонус за близость к другим площадкам
  const [x0, y0, x1, y1] = rubbleBounds(null, b); let road = 0;
  for (let y = y0; y < y1; y += CS) for (let x = x0; x < x1; x += CS) { const gx = Math.floor(x / CS), gy = Math.floor(y / CS); if (gx < 0 || gy < 0 || gx >= GW || gy >= GH) continue; const i = gy * GW + gx; if (grid[i] === 8 && roadMask[i] === 1) road++; }
  const cx = (b.x0 + b.x1) / 2, cy = (b.y0 + b.y1) / 2; let s = road ? 400 + road * 4 : 0;
  for (const k of ["hospital", "fire", "police", "power", "water", "radio"]) { const sp = special[k]; if (!sp) continue; if (sp.b === b) s += 600; else if (road && Math.hypot(sp.x - cx, sp.y - cy) < 350) s += 200; }
  if (b.gutted && b.state === "ok") s += (b.nest || 0) * 60 + 50;
  let dm = 1e9; for (const m of machines) if (!m.gone) dm = Math.min(dm, Math.hypot(m.x - cx, m.y - cy)); if (dm < 1e9) s -= dm / 20;
  return s;
}
function nextSiteFor(m, cur) {
  let best = null, bs = -1e9;
  for (const b of buildings) {
    if (b === cur || !((b.state === "ruin" && ruinRubble(b) > 0) || (b.gutted && b.state === "ok" && !gutRepairable(b)))) continue;
    const n = machines.filter(o => !o.gone && !o.leave && o.job && (o.job.ruin === b || o.job.demo === b)).length;
    if (n >= 2) continue; if (b.clearAssigned && n === 0) continue;
    let z = 0; nearZ((b.x0 + b.x1) / 2, (b.y0 + b.y1) / 2, 120, () => z++); if (z) continue;
    const s = (typeof siteScore === "function" ? siteScore(b) : 0) - Math.hypot((b.x0 + b.x1) / 2 - m.x, (b.y0 + b.y1) / 2 - m.y) / 4 + (n ? 150 : 0);
    if (s > bs) { bs = s; best = b; }
  }
  if (best && !best.clearAssigned) { best.clearAssigned = true; if (best.state === "ruin") { best.truckN = fleetFor(best).trucks; const [gx, gy] = siteGoal(best); spawnService("dump", gx, gy, null).job = { dump: best }; best.dumpSentT = simT; } }
  return best;
}
function roadRubbleN(b) { const [x0, y0, x1, y1] = rubbleBounds(null, b); let n = 0; for (let y = y0; y < y1; y += CS) for (let x = x0; x < x1; x += CS) { const gx = Math.floor(x / CS), gy = Math.floor(y / CS); if (gx < 0 || gy < 0 || gx >= GW || gy >= GH) continue; const i = gy * GW + gx; if (grid[i] === 8 && roadMask[i] === 1) n++; } return n; }
function roadSiteFor(m, cur) {
  let best = null, bd = 1e9;
  for (const b of buildings) { if (b === cur || b.state !== "ruin") continue; if (machines.some(o => !o.gone && !o.leave && o.job && o.job.ruin === b)) continue; if (!roadRubbleN(b)) continue; let z = 0; nearZ((b.x0 + b.x1) / 2, (b.y0 + b.y1) / 2, 120, () => z++); if (z) continue; const d = Math.hypot((b.x0 + b.x1) / 2 - m.x, (b.y0 + b.y1) / 2 - m.y); if (d < bd) { bd = d; best = b; } }
  return best;
}
function activeUnits(type) { return cars.filter(c => c.service === type && !c.gone && !c.wreck && !c.leaving && !c.abandonedSvc).length; }
function stepServices(dt) {
  for (const c of cars) if (c.service && !c.player) stepServiceCar(c, dt);
  stepServices2(dt);
  reports = reports.filter(r => simT - r.t < 40);
  dispatchT -= dt;
  if (!settings.services || dispatchT > 0) return;
  dispatchT = 3;
  if (settings.noRadio) { dispatchT = 9; logT("noradio2", "Радиовышка разрушена: диспетчер работает по телефону, медленнее", "bad", 60); }
  // забор карантина недостроен, а строителей нет — высылаем новую бригаду
  for (const j of wallJobs) if (zoneTodo(j) && activeUnits("builder") === 0 && simT - (j.lastSent || 0) > 45) { j.lastSent = simT; const t = spawnService("builder", j.gate[0], j.gate[1], null); t.job = { wall: j }; t.crewN = 6; logT("builders2", "К карантину выехала новая бригада строителей", "", 30); }
  // санитары: вывозят тела из спокойных районов
  if (activeUnits("sanit") < 3) { const b = bodyTarget(); if (b) { b.sanitAssigned = simT + 1; const c = spawnService("sanit", b.x, b.y, special.hospital); c.job = { body: b }; logT("disp_sanit", "Санитарная служба выехала за телами", "", 30); } }
  // полиция: чем больше вызовов, тем больше патрулей; но в толпу зомби и туда, где только что погиб наряд, патруль не шлют — это дело армии
  lostUnits = lostUnits.filter(l => simT - l.t < 150);
  const attacks = reports.filter(r => r.kind === "attack" && zombiesAt(r.x, r.y, 100) < 10 && !lostUnits.some(l => Math.hypot(l.x - r.x, l.y - r.y) < 150));
  if (attacks.length && activeUnits("police") < Math.min(6, 1 + Math.floor(counts().Z / 5))) {
    const r = attacks[attacks.length - 1]; const c = spawnService("police", r.x, r.y, special.police);
    logT("disp_police", "Диспетчер: патруль выехал на вызов", "good", 15); first("svc_police", "Полиция выехала на первый вызов", "good");
    reports = reports.filter(q => Math.hypot(q.x - r.x, q.y - r.y) > 120);
  }
  if (activeUnits("fire") < Math.min(10, 3 + Math.ceil(buildings.filter(b => b.fire > 0 && b.state === "ok").length / 3))) { const t = serviceTarget("fire"); if (t) { const c = spawnService("fire", t.x, t.y, special.fire); c.job = t.job; logT("disp_fire", "Пожарные выехали на вызов", "good", 15); } }
  const wounded = agents.find(a => a.state === "alive" && a.role === "civ" && (a.hp < 45 || (a.burn > .25)) && !a.ambAssigned);
  if (wounded && activeUnits("ambulance") < 3) { wounded.ambAssigned = true; spawnService("ambulance", wounded.x, wounded.y, special.hospital); logT("disp_amb", "Скорая выехала к пострадавшему", "good", 20); }
  if (activeUnits("tow") < 4) { const t = serviceTarget("tow"); if (t) { const c = spawnService("tow", t.x, t.y, null); c.job = t.job; } }
  if (activeUnits("repair") < Math.min(14, 3 + Math.ceil(buildings.filter(b => b.state === "ruin" || b.state === "construct").length / 2))) {
    const t = serviceTarget("repair");
    if (t) {
      const c = spawnService("repair", t.x, t.y, null); c.job = t.job; if (t.job.ruin) c.crewN = 6;
      if (t.job.ruin) logT("builders_go", t.job.ruin.kind === "tower" ? "Строители выехали восстанавливать небоскрёб" : "Строители выехали восстанавливать дом", "good", 20);
    }
  }
  // завалы и выгоревшие остовы: с окраины едет экскаватор, к завалу — самосвал; снос — сначала экскаватор, самосвалы потом
  const loaders = machines.filter(m => m.kind === "loader" && !m.gone);
  const ruinN = buildings.filter(b => b.state === "ruin" || (b.gutted && b.state === "ok")).length;
  if (loaders.length < Math.min(12, 4 + Math.floor(ruinN / 8))) {
    const quietB = b => { let z = 0; nearZ((b.x0 + b.x1) / 2, (b.y0 + b.y1) / 2, 120, () => z++); return z === 0; };
    let site = null, bs = -1e9; for (const b of buildings) { if (b.clearAssigned || !((b.state === "ruin" && ruinRubble(b) > 0) || (b.gutted && b.state === "ok" && !gutRepairable(b))) || !quietB(b)) continue; const s = siteScore(b); if (s > bs) { bs = s; site = b; } }
    if (site) {
      site.clearAssigned = true; const [gx, gy] = siteGoal(site), [ex, ey] = edgePointNear(gx, gy);
      if (site.state === "ruin") {
        const f = fleetFor(site); site.truckN = f.trucks;
        for (let k = 0; k < f.loaders; k++) deliverMachine("loader", { ruin: site }, gx, gy, k * 6);
        spawnService("dump", gx, gy, null).job = { dump: site }; if (f.trucks > 2) { const t2 = spawnService("dump", gx, gy, null); t2.job = { dump: site }; }
        site.dumpSentT = simT; logT("clear_go", f.loaders > 2 ? "К большому завалу тралы везут три экскаватора, за ними колонна самосвалов" : "К завалу тралы везут два экскаватора, за ними самосвалы", "good", 20);
      }
      else { deliverMachine("loader", { demo: site }, gx, gy, 0); logT("demo_go", site.kind === "tower" ? "Выгоревший небоскрёб решено снести: трал везёт экскаватор" : "Выгоревший дом решено снести: трал везёт экскаватор", "good", 20); }
    }
  }
  // самосвалы по кругу: пока есть завал, у экскаватора один грузится, второй уже едет
  for (const m of loaders) {
    const b = m.job && m.job.ruin; if (!b || m.leave) continue;
    const n = cars.filter(c => c.service === "dump" && !c.gone && !c.leaving && !c.wreck && c.job && c.job.dump === b).length;
    if (n < (b.truckN || 2) && simT - (b.dumpSentT || 0) > 20 && ruinRubble(b) > 0) { b.dumpSentT = simT; const [gx, gy] = siteGoal(b); spawnService("dump", gx, gy, null).job = { dump: b }; }
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
    else if (job && job.b) { const b = job.b; tx = clamp(a.x, b.x0 - 14, b.x1 + 14); ty = clamp(a.y, b.y0 - 14, b.y1 + 14); if (b.fire <= 0 || b.state !== "ok") { done = true; b.fireAssigned = false; } else if (Math.hypot((b.x0 + b.x1) / 2 - a.x, (b.y0 + b.y1) / 2 - a.y) < Math.max(b.x1 - b.x0, b.y1 - b.y0) / 2 + 45) { b.fire -= dt * fireRate(a); for (const o of buildings) if (o !== b && o.state === "ok" && Math.hypot(Math.max(b.x0 - o.x1, o.x0 - b.x1, 0), Math.max(b.y0 - o.y1, o.y0 - b.y1, 0)) < 15) o.wetT = simT; if (settings.noWater) logT("nowater", "Пожарные: нет воды в гидрантах, тушим из бака", "bad", 40); a.spray = .3; a.sprayAt = [(b.x0 + b.x1) / 2 + rnd(-10, 10), (b.y0 + b.y1) / 2 + rnd(-10, 10), b.h * .5]; if (b.fire <= 0) { b.fire = 0; logT("ext", "Пожарные потушили здание", "good", 10); } return [0, 0, 0]; } }
    else if (job && job.car) { const c = job.car; tx = c.x; ty = c.y; if (c.burnT <= 0) { done = true; c.fireAssigned = false; } else if (Math.hypot(tx - a.x, ty - a.y) < 30) { c.burnT -= dt * 4; a.spray = .3; a.sprayAt = [c.x, c.y]; for (const f of fires) if (Math.hypot(f.x - c.x, f.y - c.y) < 14) f.l -= dt * 4; return [0, 0, 0]; } }
    else if (job && job.f) { const f = job.f; tx = f.x; ty = f.y; if (f.l <= 0) { done = true; f.assigned = false; } else if (Math.hypot(tx - a.x, ty - a.y) < f.r + 25) { f.l -= dt * 3; f.r = Math.max(2, f.r - dt * .5); a.spray = .3; a.sprayAt = [f.x, f.y]; return [0, 0, 0]; } }
    else done = true;
    if (done) { const t = serviceTarget("fire"); if (t && Math.hypot(t.x - a.x, t.y - a.y) < 300) { for (const m of a.unit.crew) m.job = t.job; } else { if (t) releaseJob(t.job); a.done = true; } }
    if (tx !== undefined && !a.done) return goTo(a, tx, ty, 11);
  }
  if (a.role === "builder") {
    const j = job && job.wall;
    if (zn && zd < 45) { a.done = true; return null; }
    if (a.done) return goTo(a, a.unit.x, a.unit.y, 9);
    // своя секция: сначала то, до чего достаёт с места, потом ближайшая свободная клетка границы, которую не взял напарник;
    // к недостижимой клетке (между домом и деревом) не рвётся дольше 6 с: ставит издали, если близко, иначе берёт другую
    const todo = i => grid[i] !== 6 && fenceable(grid[i]), dist = i => Math.hypot((i % GW) * CS + 4 - a.x, ((i / GW) | 0) * CS + 4 - a.y);
    if (!a.fenceSkip) a.fenceSkip = new Set();
    if (j && !j.lifted && (a.fenceGi === undefined || !todo(a.fenceGi))) {
      const taken = new Set(a.unit.crew.filter(m => m !== a && m.state === "alive").map(m => m.fenceGi));
      let best = -1, bd = 1e9; for (const i of j.cells) if (todo(i) && !taken.has(i) && !a.fenceSkip.has(i)) { const d = dist(i); if (d < bd) { bd = d; best = i; } }
      if (best < 0 && a.fenceSkip.size) { a.fenceSkip.clear(); }
      a.fenceGi = best >= 0 ? best : undefined; a.buildT = 0; a.fenceBest = 1e9; a.fenceProgT = simT;
    }
    if (!j || j.lifted || a.fenceGi === undefined) { a.done = true; for (const m of a.unit.crew) m.done = true; return goTo(a, a.unit.x, a.unit.y, 9); }
    const gi = a.fenceGi, cx = (gi % GW) * CS + 4, cy = ((gi / GW) | 0) * CS + 4, d = dist(gi);
    if (d < 13) { a.tool = .3; a.aim = Math.atan2(cy - a.y, cx - a.x); a.aimT = .3; a.buildT = (a.buildT || 0) + dt; if (a.buildT > 1) { putZoneCell(j, gi); a.fenceGi = undefined; } return [0, 0, 0]; }
    if (d < a.fenceBest - 2) { a.fenceBest = d; a.fenceProgT = simT; }
    else if (simT - a.fenceProgT > 5) { if (d < 40) putZoneCell(j, gi); else a.fenceSkip.add(gi); a.fenceGi = undefined; return [0, 0, 0]; }
    return goTo(a, cx, cy, 11);
  }
  if (a.role === "worker") {
    if (zn && zd < 70) { a.done = true; return null; } // при зомби бросают работу
    const fin = () => { a.workT = 0; a.done = !job; for (const m of a.unit.crew) { m.job = null; m.done = true; } };
    if (job && job.tow) { const c = job.tow; if (c.gone) fin(); else if (Math.hypot(c.x - a.x, c.y - a.y) < 14) { a.workT = (a.workT || 0) + dt; a.tool = .3; if (a.workT > 8) { c.gone = true; fillCells(c.x - 9, c.y - 9, c.x + 9, c.y + 9, cellAt(c.x, c.y) === 5 ? 0 : cellAt(c.x, c.y)); fieldT = 0; logT("tow", "Ремонтники убрали разбитую машину", "good", 20); fin(); } return [0, 0, 0]; } else return goTo(a, c.x, c.y, 8); }
    if (job && job.lamp) { const l = job.lamp; if (!l.down) fin(); else if (Math.hypot(l.x - a.x, l.y - a.y) < 8) { a.workT = (a.workT || 0) + dt; a.tool = .3; if (a.workT > 6) { l.down = 0; gridDirty = true; fin(); } return [0, 0, 0]; } else return goTo(a, l.x, l.y, 8); }
    if (job && job.gut) {
      const b = job.gut;
      if (b.gutted && b.state === "ok") { if (Math.hypot(clamp(a.x, b.x0, b.x1) - a.x, clamp(a.y, b.y0, b.y1) - a.y) > 14) return goTo(a, (b.x0 + b.x1) / 2, b.y1 + 8, 8); b.gutted = false; b.clearAssigned = false; startConstruct(b); b.prog = .3; spawnService("mixer", siteGoal(b)[0], siteGoal(b)[1], null).job = { build: b }; logE(b.kind === "tower" ? "Ремонтники взялись за выгоревший небоскрёб" : "Ремонтники восстанавливают выгоревший дом", "good"); for (const m of a.unit.crew) { m.buildB = b; m.job = null; } }
      else { a.job = null; if (b.state === "construct") a.buildB = b; else fin(); }
    }
    if (job && job.ruin) {
      const b = job.ruin; a.tool = .3;
      // разбираем завал клетка за клеткой
      let cell = -1, cd = 1e9;
      for (let y = b.y0 - 30; y < b.y1 + 30; y += CS) for (let x = b.x0 - 30; x < b.x1 + 30; x += CS) if (cellAt(x, y) === 8) { const d = Math.hypot(x - a.x, y - a.y); if (d < cd) { cd = d; cell = [x, y]; } }
      if (cell === -1) {
        // завал разобран — начинаем строить заново
        if (b.state === "ruin" || b.state === "construct") { if (b.state === "ruin") { startConstruct(b); spawnService("mixer", siteGoal(b)[0], siteGoal(b)[1], null).job = { build: b }; logE(b.kind === "tower" ? "Ремонтники начали восстанавливать небоскрёб" : "Ремонтники начали восстанавливать дом", "good"); } for (const m of a.unit.crew) { m.buildB = b; m.job = null; } }
        else { fin(); logT("ruin", "Завал разобран", "good", 20); }
      }
      else if (cd < 10) { a.workT = (a.workT || 0) + dt; if (a.workT > 2.5) { a.workT = 0; const gi = Math.floor(cell[1] / CS) * GW + Math.floor(cell[0] / CS); grid[gi] = insideFoot(b, cell[0], cell[1]) ? 7 : (underRubble[gi] || 1); underRubble[gi] = 0; if (typeof onRubbleCleared === "function") onRubbleCleared(cell[0], cell[1]); fieldT = 0; gridDirty = true; } return [0, 0, 0]; }
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
// можно ли спокойному пешеходу идти по прямой: отрезок не должен резать проезжую часть вне зебры и завал
function walkOk(a, tx, ty) {
  if (a.role === "zombie" || a.panic > .4 || a.role === "army" || a.unit) return true;
  const d = Math.hypot(tx - a.x, ty - a.y), n = Math.max(1, Math.ceil(d / 8));
  for (let i = 1; i <= n; i++) { const x = a.x + (tx - a.x) * i / n, y = a.y + (ty - a.y) * i / n, j = clamp(Math.floor(y / CS), 0, GH - 1) * GW + clamp(Math.floor(x / CS), 0, GW - 1); if (grid[j] === 8 || (roadMask[j] === 1 && !crossMask[j] && grid[j] === 0)) return false; }
  return true;
}
function bfsBox(e, sx, sy) {
  const { x0, y0, w, h, f } = e; f.fill(FAR);
  const si = (clamp(Math.floor(sy / CS), y0, y0 + h - 1) - y0) * w + (clamp(Math.floor(sx / CS), x0, x0 + w - 1) - x0);
  f[si] = 0; ring[0].push(si); let pending = 1;
  const md = e.mode, N = w * h, dg = GW - w; // dg: сдвиг между строкой коробки и строкой всей карты
  for (let d = 0; pending > 0 && d < 3000; d++) {
    const b = ring[d % RING];
    while (b.length) {
      const i = b.pop(); pending--;
      if (f[i] !== d) continue;
      const x = i % w, gi0 = i + ((i / w) | 0) * dg + y0 * GW + x0; // та же клетка в сетке карты
      for (let k = 0; k < 4; k++) {
        let j, gi;
        if (k === 0) { if (x + 1 >= w) continue; j = i + 1; gi = gi0 + 1; } else if (k === 1) { if (x === 0) continue; j = i - 1; gi = gi0 - 1; }
        else if (k === 2) { j = i + w; if (j >= N) continue; gi = gi0 + GW; } else { j = i - w; if (j < 0) continue; gi = gi0 - GW; }
        const wc = stepCost(gi, md, true); if (!wc) continue;
        const nd = d + wc;
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
    const v = e.f[ny * w + nx]; if (v >= FAR || BLOCK(grid[(ny + e.y0) * GW + nx + e.x0])) continue;
    if (dx && dy && (e.f[gy * w + nx] >= FAR || e.f[ny * w + gx] >= FAR)) continue;
    if (v < bv) { bv = v; best = [dx, dy]; }
  }
  if (!best) return null;
  const l = Math.hypot(best[0], best[1]); return [best[0] / l, best[1] / l];
}
function pathField(a, tx, ty) {
  if (pathBudgetT !== simT) { pathBudgetT = simT; pathBudget = 3; }
  const gx = clamp(Math.floor(tx / CS), 0, GW - 1), gy = clamp(Math.floor(ty / CS), 0, GH - 1);
  const ax = clamp(Math.floor(a.x / CS), 0, GW - 1), ay = clamp(Math.floor(a.y / CS), 0, GH - 1);
  // ключ: клетка цели и район агента (40 клеток), чтобы коробки не разрастались на всю карту
  const key = (gy * GW + gx) * 64 + Math.floor(ay / 40) * 8 + Math.floor(ax / 40);
  let e = pathCache.get(key);
  const inside = e && ax >= e.x0 && ax < e.x0 + e.w && ay >= e.y0 && ay < e.y0 + e.h;
  if (e && inside && simT - e.t < 10) return e;
  if (pathBudget <= 0) return e && inside ? e : null;
  pathBudget--;
  if (pathCache.size >= 400) { let ok = null, ot = 1e9; for (const [k, v] of pathCache) if (v.t < ot) { ot = v.t; ok = k; } pathCache.delete(ok); }
  const m = 18; // коробка: цель, агент и его район с запасом, чтобы обойти квартал
  const rx0 = Math.floor(ax / 40) * 40, ry0 = Math.floor(ay / 40) * 40;
  const x0 = clamp(Math.min(gx, rx0) - m, 0, GW - 1), y0 = clamp(Math.min(gy, ry0) - m, 0, GH - 1);
  const x1 = clamp(Math.max(gx, rx0 + 39) + m, 0, GW - 1), y1 = clamp(Math.max(gy, ry0 + 39) + m, 0, GH - 1);
  const w = x1 - x0 + 1, h = y1 - y0 + 1;
  if (!e || e.w !== w || e.h !== h) e = { x0, y0, w, h, f: new Int16Array(w * h), t: 0 }; else { e.x0 = x0; e.y0 = y0; }
  e.mode = a.role === "zombie" ? 1 : a.kind !== undefined || a.tank ? 2 : 0;
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
  if (a.stuck < .6 && !ahead && (d < 30 || (d < 120 && los(a.x, a.y, tx, ty))) && walkOk(a, tx, ty)) return [ux, uy, sp];
  const e = pathField(a, tx, ty), dir = e ? boxDir(e, a.x, a.y) : null;
  if (dir) return [dir[0] + ux * .1, dir[1] + uy * .1, sp];
  if (ahead || a.stuck > .6) { const w = wander(a, .016); return [w[0] + ux * .5, w[1] + uy * .5, sp]; }
  return [ux, uy, sp];
}
