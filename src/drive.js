/* ---------- за рулём: игрок ведёт машину ----------
   Третий вариант режима от первого лица (fps.mode === "drive"). Машина с c.player снимается с полосы (c.lane = null) и едет
   свободно: газ W, тормоз и задний ход S, руль A/D (на скорости поворачивает слабее), ручник Пробел, сигнал H. Стены, заборы,
   завалы и вода — по клеткам, как у танка (stepTanks); другие машины — по пересечению кузовов (obbOverlap); наезды — carHitPeople.
   Остальной поток видит машину игрока как обычную: scanAhead, зебры и vehicleAt смотрят только c.x, c.y, c.ang, c.v, c.moving.
   Физика живёт в stepPlayerCar и не трогает DOM, поэтому её можно гонять без браузера (tests/drive.test.js) */
const drive = { car: null, cabin: false, in: { gas: false, brake: false, steer: 0, hand: false, horn: false }, mouseT: -1e9, hornCd: 0, crashCd: 0, hits: 0, cam: null, help: "" };
const DRIVE_REV = 12; // задний ход, ед./с
const DRIVE_HELP = "W — газ · S — тормоз и задний ход · A / D — руль · Пробел — ручник · H — сигнал · V — вид из кабины · E — выйти · мышь — камера · Esc — пауза";
// в какую машину можно сесть: не разбитую, не горящую, не службу с экипажем в кабине (высадившую экипаж или брошенную — можно)
function canDrive(c, needSlow) {
  if (!c || c.gone || c.wreck || c.crushed || c.towedBy || c.tank || c.z > 0 || c.vz || c.burnT > 0 || c.player) return false;
  if (c.service && SERVICE[c.service] && SERVICE[c.service].crew && !c.deployed && !c.abandonedSvc) return false;
  if (c.gas && c.gas.pts && c.gas.phase === "fuel") return false;
  if (needSlow && Math.abs(c.v) > 6) return false;
  return true;
}
// машина рядом с человеком, в которую он может сесть: стоящая или едущая медленно, в пределах вытянутой руки от кузова
function carNearAgent(a) {
  let best = null, bd = 1e9;
  nearCars(a.x, a.y, 40, c => { if (!canDrive(c, true)) return; const d = Math.hypot(c.x - a.x, c.y - a.y) - 10 * (c.len || 1); if (d < 9 && d < bd) { bd = d; best = c; } });
  return best;
}
// ближайшая к точке машина для старта режима: сначала стоящие на улице, потом едущие, потом припаркованные во дворах
function nearestDriveCar(x, y) {
  let best = null, bd = 1e9;
  for (const c of cars) { if (!canDrive(c)) continue; const d = Math.hypot(c.x - x, c.y - y) + (c.moving && !c.stopped && Math.abs(c.v) > 6 ? 300 : 0) + (c.v === undefined ? 150 : 0); if (d < bd) { bd = d; best = c; } }
  return best;
}
// точка у двери: слева по ходу (водительская), если там стена — справа, иначе где свободно
function carDoor(c, side = 1) {
  const [, hw] = carHalf(c), sx = Math.sin(c.ang), cx = Math.cos(c.ang);
  for (const s of [side, -side]) { const x = c.x + sx * (hw + 3.2) * s, y = c.y - cx * (hw + 3.2) * s; if (!blocked(x, y) && cellAt(x, y) !== 8 && !vehicleAt(x, y)) return [x, y]; }
  return freeNear(c.x, c.y, 16);
}
// люди, оказавшиеся внутри кузова (в стоящую машину можно зайти пешком), выходят к ближнему борту — иначе машина на малом ходу
// встаёт перед ними, а они не могут выйти из-под неё: тупик
function evictFromCar(c, skip) {
  const [hl, hw] = carHalf(c), ca = Math.cos(c.ang), sa = Math.sin(c.ang);
  near(c.x, c.y, hl + 6, a => {
    if (a === skip || a.state !== "alive" || a.hidden || a.z > .5) return;
    const dx = a.x - c.x, dy = a.y - c.y, al = dx * ca + dy * sa, lt = -dx * sa + dy * ca;
    if (Math.abs(al) > hl + 1 || Math.abs(lt) > hw + 1) return;
    const side = lt >= 0 ? 1 : -1, x = c.x + ca * al - sa * (hw + 3) * side, y = c.y + sa * al + ca * (hw + 3) * side;
    if (!blocked(x, y)) { a.x = x; a.y = y; } else { const [fx, fy] = freeNear(c.x, c.y, 18); a.x = fx; a.y = fy; }
    a.vx = a.vy = 0;
  });
}
function enterCar(a, c) {
  // припаркованные во дворах и у баз машины (layout.js) — только кузов без полей движения: дополняем до обычной машины
  if (c.v === undefined || c.spd === undefined) { const D = newCar(); for (const k in D) if (c[k] === undefined) c[k] = D[k]; if (!c.cells) for (const i of rotCells(c.x, c.y, 17 * (c.len || 1), 8, c.ang)) if (grid[i] === 5) { grid[i] = roadMask[i] === 1 ? 0 : 2; fieldT = 0; } }
  // гражданская машина на ходу: водителя вытаскивают из-за руля, он в панике бежит; полиция обращает внимание
  if (c.moving && !c.stopped && !c.service && !c.free) {
    const [x, y] = carDoor(c, 1); const d = newAgent("civ", x, y); d.panic = 1; nameFor(d);
    logT("carjack", "Угон: водителя вытащили из машины посреди улицы", "bad", 15); reports.push({ x: c.x, y: c.y, t: simT, kind: "carjack" }); interest(c.x, c.y, 2);
  }
  if (c.turn) { const i = c.turn.n.occ.indexOf(c); if (i >= 0) c.turn.n.occ.splice(i, 1); }
  if (c.gas) cancelGas(c);
  if (c.cells) clearCarCells(c);
  if (c.service) { if (c.job && c.job.shelter) c.job.shelter.busAssigned = false; c.deployed = false; c.leaving = false; }
  c.lane = null; c.turn = null; c.next = null; c.park = null; c.trip = null; c.goal = null; c.over = 0; c.latOff = c.latTgt = 0; c.offx = c.offy = 0;
  c.wait = 0; c.stallT = 0; c.panic = false; c.flee = false; c.yieldTo = null; c.jam = false; c.towAssigned = true; // эвакуатор за ней не едет
  c.player = true; c.moving = true; c.stopped = false; c.free = false; c.steer = 0; c.slide = 0;
  if (c.pdmg === undefined) c.pdmg = Math.min(.6, (c.dmg || 0) * .1);
  if (c.fuel === undefined) c.fuel = 1;
  a.hidden = true; a.onBus = c; a.hideB = null; a.busGoal = null; a.vx = a.vy = 0; a.x = c.x; a.y = c.y; a.panic = 0;
  evictFromCar(c, a);
  drive.car = c; drive.cabin = false; drive.cam = null; drive.hits = 0;
  fps.mode = "drive"; fps.yaw = c.ang; fps.pitch = 0;
  if (typeof document !== "undefined") { document.body.classList.add("drive"); drive.help = drive.help || $("fpsHelp").textContent; $("fpsHelp").textContent = DRIVE_HELP; }
}
// выйти: машина остаётся стоять, где встала (клетки под ней — как у брошенной, её можно взять снова); пассажиры автобуса или скорой
// выходят только у лагеря, укрытия или больницы, иначе ждут в салоне
function exitCar() {
  const c = drive.car, a = fps.a; if (!c) return;
  drive.car = null; c.player = false; c.steer = 0; c.slide = 0; c.moving = false; c.stopped = true; c.stopT = simT; c.wait = 0; c.towAssigned = false;
  c.dir = dirOf(Math.cos(c.ang), Math.sin(c.ang));
  if (c.wreck || c.z > 0 || c.vz) { c.v = 0; }
  else { c.v = 0; c.free = true; markCarCells(c); evictRect(c.x - 13, c.y - 13, c.x + 13, c.y + 13); }
  if (c.service) { c.abandonedSvc = true; c.deployed = false; releaseJob(c.job); for (const m of c.crew || []) if (m.unit === c) { m.unit = null; m.job = null; m.done = false; } c.crew = []; c.leaving = false; }
  const out = unloadPassengers(c);
  if (a) { a.hidden = false; a.onBus = null; const [x, y] = carDoor(c, 1); a.x = x; a.y = y; a.vx = a.vy = 0; a.dir = c.ang; fps.yaw = c.ang; fps.pitch = 0; }
  fps.mode = "human";
  if (typeof document !== "undefined") { document.body.classList.remove("drive"); if (drive.help) $("fpsHelp").textContent = drive.help; if (out) fpsMsg(out); else if (c.passengers && c.passengers.length) fpsMsg("Пассажиры ждут в салоне: высади их у лагеря, укрытия или больницы"); }
}
function unloadPassengers(c) {
  const P = c.passengers; if (!P || !P.length) return "";
  const n = P.length, place = () => { const [x, y] = freeNear(c.x, c.y, 16); return [x, y]; };
  const hb = typeof hospitalB === "function" ? hospitalB() : null;
  if (c.service === "ambulance" && hb && Math.hypot(hb.door[0] - c.x, hb.door[1] - c.y) < 70) { hospitalIntake(c); return `Раненых приняли в больнице: ${n}`; }
  const camp = (camps || []).find(k => Math.hypot(k.gate[0] - c.x, k.gate[1] - c.y) < 90);
  if (camp) { for (const p of P) { p.hidden = false; p.onBus = null; [p.x, p.y] = place(); p.panic = 0; p.dest = null; p.campGoal = camp; } c.passengers = []; logE(`Автобус привёз ${n} человек в лагерь`, "good"); first("busevac", "Первый автобус довёз людей до лагеря", "good"); return `Пассажиры вышли и идут в лагерь: ${n}`; }
  const sh = buildings.find(b => b.door && b.state === "ok" && !b.gutted && b.occ && b.kind !== "hospital" && Math.hypot(b.door[0] - c.x, b.door[1] - c.y) < 45 && b.occ.length + n <= (b.cap || 20));
  if (sh) { for (const p of P) { p.hidden = false; p.onBus = null; p.panic = 0; p.dest = null; enterShelter(p, sh); } c.passengers = []; logE(`Автобус привёз ${n} человек в укрытие`, "good"); return `Пассажиры зашли в укрытие: ${n}`; }
  return "";
}
// машину подорвало, смяло танком, разбило: водителя выбрасывает наружу
function crashOut(c, hurt, why) {
  const a = fps.a;
  if (c.wreck && !c.stopped && !(c.z > 0 || c.vz)) abandonCar(c, "crash");
  exitCar();
  if (a && a.state === "alive") { a.hp -= hurt; a.panic = 1; a.grabT = 1.2; if (a.hp <= 0) kill(a, false, "car"); }
  if (typeof document !== "undefined") fpsMsg(why || "Машина разбита. Ты выбрался наружу");
}
// ввод игрока: клавиши режима от первого лица
function driveInput() {
  const k = fps.keys, I = drive.in;
  I.gas = !!(k.KeyW || k.ArrowUp); I.brake = !!(k.KeyS || k.ArrowDown); I.steer = (k.KeyD || k.ArrowRight ? 1 : 0) - (k.KeyA || k.ArrowLeft ? 1 : 0);
  I.hand = !!k.Space; I.horn = !!(k.KeyH || fps.fire);
}
// клетка, через которую машине не проехать: дом, забор, баррикада, завал, вода, край карты; возвращает код клетки
function driveSolid(x, y) {
  if (x < 6 || y < 6 || x > W - 6 || y > H - 6) return 9;
  const c = cellAt(x, y); return c === 3 || c === 4 || c === 6 || c === 8 || c === 9 || c === 10 ? c : 0;
}
// первая клетка-препятствие под углами и серединами бамперов кузова в заданной позе
function driveHitCell(c, x, y, ang) {
  const [hl, hw] = carHalf(c), ca = Math.cos(ang), sa = Math.sin(ang);
  for (const [u, w] of [[hl, hw], [hl, -hw], [hl, 0], [-hl, hw], [-hl, -hw], [-hl, 0], [0, hw], [0, -hw]]) {
    const px = x + ca * u - sa * w, py = y + sa * u + ca * w, k = driveSolid(px, py);
    if (k) return { k, x: px, y: py };
  }
  return null;
}
function stepPlayerCar(c, dt) {
  const a = fps.a;
  if (fps.keys) driveInput();
  const I = drive.in;
  drive.hornCd -= dt; drive.crashCd -= dt;
  // подорвало, смяло танком, разбило при наезде — водителя выбрасывает
  if (c.crushed) { crashOut(c, 90, "Машину смяло вместе с тобой"); return; }
  if (c.z > 0 || c.vz) { crashOut(c, 45, "Взрывом машину подбросило. Ты выбрался наружу"); return; }
  if (c.wreck) { crashOut(c, 25); return; }
  if (a) { a.x = c.x; a.y = c.y; }
  const vmax = c.spd * 1.3;
  let v = c.v;
  // газ, тормоз, задний ход, ручник; без бензина машина только катится
  if (I.hand) v -= Math.sign(v) * Math.min(Math.abs(v), 30 * dt);
  else if (I.gas) { if (v >= -1) { if (c.fuel > 0) v += (c.bus || c.tanker || (c.len || 1) > 1.4 ? 9 : 14) * dt; } else v += 45 * dt; }
  else if (I.brake) { if (v > 1) v -= 45 * dt; else if (c.fuel > 0) v -= 9 * dt; }
  // инерция: сопротивление воздуха и качения
  v -= v * .25 * dt; v -= Math.sign(v) * Math.min(Math.abs(v), 1.5 * dt);
  v = clamp(v, -DRIVE_REV, vmax);
  // руль: на скорости поворачивает слабее; с ручником на ходу кузов идёт боком
  c.steer += (I.steer - c.steer) * Math.min(1, dt * (I.steer ? 5 : 8));
  const maxA = .5 / (1 + Math.abs(v) / 22), drift = I.hand && Math.abs(v) > 10;
  const yaw = Math.abs(v) > .3 ? v / 13 * Math.tan(c.steer * maxA) * (drift ? 1.7 : 1) : 0;
  const ang1 = c.ang + yaw * dt;
  if (yaw && (!driveHitCell(c, c.x, c.y, ang1) || driveHitCell(c, c.x, c.y, c.ang))) c.ang = ang1;
  c.ang -= Math.round(c.ang / TAU) * TAU;
  c.slide = (c.slide || 0) * Math.max(0, 1 - dt * (drift ? 1.5 : 6)) - yaw * Math.abs(v) * dt * (drift ? .6 : .08);
  // движение с проверкой клеток: сначала целиком, потом по осям; упёрлись на скорости — удар
  const cx = Math.cos(c.ang), sx = Math.sin(c.ang);
  const dx = cx * v * dt - sx * c.slide * dt, dy = sx * v * dt + cx * c.slide * dt;
  let hit = driveHitCell(c, c.x + dx, c.y + dy, c.ang);
  // баррикаду на скорости машина сносит
  if (hit && hit.k === 6 && Math.abs(v) > 18) {
    const gi = Math.floor(hit.y / CS) * GW + Math.floor(hit.x / CS); grid[gi] = 0; bhp[gi] = 0; barrDirty = true; fieldT = 0; fxDebris(hit.x, hit.y); sfx.crash(c);
    c.pdmg += .08; c.dmg++; v *= .6; hit = driveHitCell(c, c.x + dx, c.y + dy, c.ang);
  }
  if (!hit) { c.x += dx; c.y += dy; }
  else if (!driveHitCell(c, c.x + dx, c.y, c.ang)) { c.x += dx; c.slide *= .5; v *= .85; }
  else if (!driveHitCell(c, c.x, c.y + dy, c.ang)) { c.y += dy; c.slide *= .5; v *= .85; }
  else {
    const s = Math.abs(v);
    if (s > 8) {
      c.pdmg += (s - 6) / 90; c.dmg++; sfx.crash(c); fxDebris(hit.x, hit.y); if (typeof shake !== "undefined") shake = Math.max(shake, s * .04);
      if (s > 20) { logT("playercrash", "Машина на скорости врезалась в стену", "bad", 15); interest(c.x, c.y, 2); }
      if (hit.k === 3) { const b = buildings.find(b => b.state === "ok" && hit.x >= b.x0 - 1 && hit.x <= b.x1 + 1 && hit.y >= b.y0 - 1 && hit.y <= b.y1 + 1); if (b && b.kind === "house" && s > 30) damageBuilding(b, s * .5, c.x, c.y); }
    }
    v = -v * .2; c.slide = 0;
  }
  // другие машины: кузова не пересекаются; на скорости — авария, задетая машина отлетает
  nearCars(c.x, c.y, 44, o => {
    if (o === c || o.gone || o.towedBy || o.z > 0) return;
    const h = obbOverlap(c, o); if (!h) return;
    const om = o.moving && !o.tank && !o.wreck, push = Math.min(h.depth, 3);
    if (om) { c.x += h.nx * push * .5; c.y += h.ny * push * .5; nudgeBack(o, -h.nx, -h.ny, push * .5); } else { c.x += h.nx * push; c.y += h.ny * push; }
    const hn = cx * h.nx + sx * h.ny; // куда смотрит нос относительно нормали удара
    const ov = o.tank ? 0 : (o.v || 0) * (Math.cos(o.ang) * h.nx + Math.sin(o.ang) * h.ny), closing = -(v * hn + c.slide * (-sx * h.nx + cx * h.ny)) + Math.max(0, ov);
    if (closing > 14 && drive.crashCd <= 0) { drive.crashCd = .6; hitCar(c, o, closing, v); }
    if (v * hn < 0) v *= Math.max(0, 1 - hn * hn) * .8; // гасим скорость в направлении удара
    if (closing > 0) c.slide *= .3;
  });
  // люди под колёсами: carHitPeople смотрит нос и c.v; на заднем ходу — корма
  const fwd = v >= 0, d0 = c.dmg; c.v = Math.abs(v); c.jam = false; carHitPeople(c, fwd ? cx : -cx, fwd ? sx : -sx, dt); v = (fwd ? 1 : -1) * c.v;
  if (c.jam) evictFromCar(c, a); // на малом ходу упёрлись в человека: кто стоит внутри кузова, отходит к борту
  if (c.dmg > d0) {
    c.pdmg += .04 * (c.dmg - d0); drive.hits += c.dmg - d0;
    logT("playerhit", "Водитель сбил человека", "bad", 10); reports.push({ x: c.x, y: c.y, t: simT, kind: "hitrun" }); interest(c.x, c.y, 2);
    if (typeof document !== "undefined") fpsMsg("Ты сбил человека. Полиция может приехать на место");
  }
  // сигнал: слышен патрулям и зомби
  if (I.horn && drive.hornCd <= 0) { drive.hornCd = .7; sfx.horn(c); noises.push({ x: c.x, y: c.y, t: simT, r: 220 }); }
  c.v = v; c.dir = dirOf(cx, sx); c.x = clamp(c.x, 6, W - 6); c.y = clamp(c.y, 6, H - 6); c.jam = false;
  if (Math.abs(v) < 1) c.wait += dt; else c.wait = 0; // стоящую машину игрока поток объезжает так же, как стоящую чужую
  if (c.fuel !== undefined) c.fuel = Math.max(0, c.fuel - Math.abs(v) * dt / FUEL_RANGE);
  if (c.pdmg >= 1 && !c.wreck) {
    c.wreck = true; c.dmg = 9; c.v = 0; abandonCar(c, "crash"); sfx.crash(c); fxDebris(c.x, c.y); if (Math.random() < .3) c.burnT = rnd(20, 50);
    logE("Машина игрока разбита", "bad"); interest(c.x, c.y, 3); crashOut(c, 30, "Машина разбита вдребезги. Ты выбрался наружу");
  }
}
// авария на скорости: задетая машина отлетает и ложится, где упадёт (stepTraffic ведёт полёт и отмечает клетки при посадке)
function hitCar(c, o, closing, v) {
  const hx = Math.cos(c.ang) * Math.sign(v || 1), hy = Math.sin(c.ang) * Math.sign(v || 1);
  if (!o.tank) {
    if (o.turn) { const i = o.turn.n.occ.indexOf(o); if (i >= 0) o.turn.n.occ.splice(i, 1); o.turn = null; }
    if (o.gas) cancelGas(o);
    if (o.cells) clearCarCells(o);
    o.vx = (o.vx || 0) + hx * closing * .5; o.vy = (o.vy || 0) + hy * closing * .5; o.vz = closing * .15; o.z = Math.max(o.z || 0, .1); o.sr = rnd(-2, 2); o.sy = rnd(-2, 2); o.roll = o.roll || 0;
    if (o.moving) { o.moving = false; o.stopped = true; }
    o.wreck = o.wreck || closing > 30; o.dmg = (o.dmg || 0) + 2; o.v = 0;
    if (closing > 30 && Math.random() < .2) o.burnT = rnd(20, 60);
  }
  c.pdmg += (closing - 8) / (o.tank ? 25 : 70); c.dmg++;
  sfx.crash(c); fxDebris(c.x, c.y); if (typeof shake !== "undefined") shake = Math.max(shake, closing * .04);
  for (const k of cars) if (!k.wreck && k !== c && Math.hypot(k.x - c.x, k.y - c.y) < 60) k.alarm = rnd(10, 30);
  logT("carcrash", "Авария: машины столкнулись", "bad", 12); interest(c.x, c.y, 3); reports.push({ x: c.x, y: c.y, t: simT, kind: "crash" });
}
// каждый кадр в режиме за рулём (вместо fpsStep): гибель водителя, обращение, подсказки
function driveStep(dt) {
  const a = fps.a, c = drive.car;
  if (!c || c.player !== true) { fps.mode = "human"; return; }
  if (a.state === "dead") { $("fpsDead").textContent = `Ты погиб за рулём. Продержался ${mmss(simT - fps.startT)}. Esc — выход`; $("fpsDead").hidden = false; return; }
  $("fpsDead").hidden = true;
  if (a.hp < fps.lastHp - .5) fps.hurt = 1; fps.lastHp = a.hp; fps.hurt = Math.max(0, fps.hurt - dt * 1.5);
  if (a.role === "zombie") { exitCar(); fpsMsg("Ты обратился за рулём и вывалился из машины"); return; }
  fps.swing = 0;
}
// камера: из-за машины или из кабины; мышь крутит обзор, без мыши камера через секунду возвращается за машину
function driveCamera(dt) {
  const c = drive.car; if (!c) return;
  vm.visible = false; flashlight.intensity = 0; senseMesh.count = 0; $("cv").style.filter = "";
  const px = c.rx !== undefined ? c.rx : c.x, py = c.ry !== undefined ? c.ry : c.y, g = gY(px, py) + (c.z || 0), ang = c.ang;
  if (performance.now() - drive.mouseT > 1200 && Math.abs(c.v) > 2 && !drive.cabin) { let d = ang - fps.yaw; d -= Math.round(d / TAU) * TAU; fps.yaw += d * Math.min(1, dt * 2.5); fps.pitch += (0 - fps.pitch) * Math.min(1, dt * 2); }
  const cy = fps.yaw, tx = X(px), tz = Z(py);
  if (drive.cabin) {
    // водительское место: слева по ходу, у лобового стекла
    const sx = Math.sin(ang), cx = Math.cos(ang), eye = c.bus ? 7.6 : (c.len || 1) > 1.3 ? 6.6 : 5.6;
    camera.position.set(X(px + cx * (c.bus ? 14 : 3.5) + sx * 1.5), g + eye, Z(py + sx * (c.bus ? 14 : 3.5) - cx * 1.5));
    const cp = Math.cos(fps.pitch);
    camera.lookAt(camera.position.x + Math.cos(cy) * cp, camera.position.y + Math.sin(fps.pitch), camera.position.z + Math.sin(cy) * cp);
    drive.cam = null;
  } else {
    const dist = (c.bus ? 44 : 30) + Math.abs(c.v) * .25, el = clamp(.3 - fps.pitch, .05, 1.2), ty = g + 4;
    let camX = tx - Math.cos(cy) * Math.cos(el) * dist, camY = ty + Math.sin(el) * dist, camZ = tz - Math.sin(cy) * Math.cos(el) * dist;
    const t = cameraClearT(tx, ty, tz, camX, camY, camZ);
    if (t < 1) { camX = tx + (camX - tx) * t; camY = ty + (camY - ty) * t; camZ = tz + (camZ - tz) * t; }
    camY = Math.max(camY, gY(camX + W / 2, camZ + H / 2) + 2.5);
    if (!drive.cam) drive.cam = new THREE.Vector3(camX, camY, camZ);
    const k = Math.min(1, dt * 9); drive.cam.x += (camX - drive.cam.x) * k; drive.cam.y += (camY - drive.cam.y) * k; drive.cam.z += (camZ - drive.cam.z) * k;
    camera.position.copy(drive.cam);
    camera.lookAt(tx + Math.cos(cy) * 6, ty, tz + Math.sin(cy) * 6);
  }
  camC.tx = tx; camC.tz = tz; camC.dist = drive.cabin ? 40 : 60;
  scene.fog.near = 60; scene.fog.far = settings.night ? 420 : 1600;
  // интерфейс: состояние машины, бензин, скорость, пассажиры
  const n = c.passengers ? c.passengers.length : 0;
  $("fpsHp").style.width = clamp((1 - c.pdmg) * 100, 0, 100) + "%"; $("fpsSt").style.width = clamp((c.fuel ?? 1) * 100, 0, 100) + "%";
  $("fpsAmmo").textContent = `${Math.round(Math.abs(c.v) * .9)} км/ч` + (c.v < -.5 ? " · задний ход" : "");
  const st = [`Повреждения ${Math.round(clamp(c.pdmg) * 100)}%`];
  if (n) st.push(`Пассажиров ${n} — высадить у лагеря, укрытия или больницы: E`);
  if (drive.in.hand) st.push("Ручник"); if (c.fuel <= 0) st.push("Бензин кончился"); else if (c.fuel < .1) st.push("Бензин на исходе");
  if (drive.hits) st.push(`Сбито людей: ${drive.hits}`);
  $("fpsStatus").textContent = st.join(" · ");
  $("fpsVig").style.opacity = Math.max(fps.hurt, c.pdmg > .7 ? .3 : 0); $("fpsVig").className = "vig";
  fps.msgT -= dt; if (fps.msgT <= 0) $("fpsMsg").hidden = true;
}
if (typeof document !== "undefined") {
  document.addEventListener("mousemove", () => { if (fps.on && fps.mode === "drive") drive.mouseT = performance.now(); });
  window.addEventListener("keydown", e => {
    if (!fps.on || fps.mode !== "drive") return;
    if (e.code === "KeyV") drive.cabin = !drive.cabin;
    if (e.code === "Space") e.preventDefault();
  }, true);
  $("fpsAsDriver").addEventListener("click", () => { $("fpsChoose").hidden = true; audio(); startFps("drive"); });
}
