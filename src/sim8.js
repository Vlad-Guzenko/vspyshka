/* ---------- тяжёлая техника: погрузчик, самосвал, эвакуатор, бетономешалка ---------- */
let machines = [];
const siteMask = new Uint8Array(GW * GH);
// стройплощадка огораживается: забор по границе квартала и участка, проезд со стороны улицы; снимается, когда дом готов
function fenceSite(b) {
  if (b.siteCells) return;
  const [x0, y0, x1, y1] = rubbleBounds(null, b), [fx, fy] = siteGoal(b), cells = [];
  const rid = regionOf[Math.floor((b.y0 + b.y1) / 2 / CS) * GW + Math.floor((b.x0 + b.x1) / 2 / CS)];
  const gx0 = Math.max(1, Math.floor(x0 / CS)), gy0 = Math.max(1, Math.floor(y0 / CS)), gx1 = Math.min(GW - 2, Math.floor(x1 / CS)), gy1 = Math.min(GH - 2, Math.floor(y1 / CS));
  for (let gy = gy0; gy <= gy1; gy++) for (let gx = gx0; gx <= gx1; gx++) {
    const i = gy * GW + gx, c = grid[i];
    if (regionOf[i] !== rid || roadMask[i] || c === 3 || c === 5 || c === 6 || c === 9 || c === 10) continue;
    const edge = gx === gx0 || gx === gx1 || gy === gy0 || gy === gy1 || regionOf[i - 1] !== rid || regionOf[i + 1] !== rid || regionOf[i - GW] !== rid || regionOf[i + GW] !== rid;
    if (!edge || Math.hypot(gx * CS + 4 - fx, gy * CS + 4 - fy) < 28) continue; // проезд у фасада шириной в несколько клеток
    cells.push(i, c); grid[i] = 6; bhp[i] = 40; siteMask[i] = 1;
  }
  b.siteCells = cells; barrDirty = true; fieldT = 0; gridDirty = true;
  if (cells.length) logT("sitefence", "Площадку огородили строительным забором", "", 30);
}
function unfenceSite(b) {
  if (!b.siteCells) return;
  for (let k = 0; k < b.siteCells.length; k += 2) { const i = b.siteCells[k], prev = b.siteCells[k + 1]; if (grid[i] === 6 && siteMask[i]) grid[i] = prev === 8 ? (underRubble[i] || 1) : prev; siteMask[i] = 0; bhp[i] = 0; }
  b.siteCells = null; barrDirty = true; fieldT = 0; gridDirty = true;
  logT("siteopen", "Стройплощадку открыли: забор снят", "", 30);
}
// стройплощадка: место под дом снова занято
function startConstruct(b) { fenceSite(b); b.state = "construct"; b.prog = 0; if (b.rot !== undefined) fillRotRect(b.cx, b.cy, b.w, b.d, b.rot, 3); else fillCells(b.x0, b.y0, b.x1, b.y1, 3); for (const a of agents) if (a.state === "alive" && a.x > b.x0 && a.x < b.x1 && a.y > b.y0 && a.y < b.y1) { const [x, y] = freeNear(a.x, a.y, 40); a.x = x; a.y = y; } fieldT = 0; gridDirty = true; }
function addMachine(kind, x, y, job) {
  const m = { kind, x, y, ang: rnd(0, TAU), v: 0, job, bucket: 0, load: 0, workT: 0, stuck: 0, gone: false };
  machines.push(m); return m;
}
const solidForMachine = (x, y) => { const c = cellAt(x, y); return c === 3 || c === 4 || c === 6 || c === 9 || c === 10 || x < 6 || y < 6 || x > W - 6 || y > H - 6; };
// техника едет по полю расстояний (как люди: в обход домов, деревьев, машин), вблизи — прямым курсом с объездом
function steerTo(m, tx, ty, sp, dt) {
  const d = Math.hypot(tx - m.x, ty - m.y) || 1;
  // нет продвижения к цели 20 с (зажало между забором, машинами и домами) — кран переставляет технику ближе к цели
  const tk = Math.round(tx) * 7 + Math.round(ty); if (m.tgtKey !== tk) { m.tgtKey = tk; m.bestD = d; m.progT = simT; }
  if (d < m.bestD - 5) { m.bestD = d; m.progT = simT; }
  if (simT - m.progT > 20) { const [fx, fy] = freeNear(tx, ty, 60); if (Math.hypot(fx - tx, fy - ty) < 90) { m.x = fx; m.y = fy; } m.stuck = 0; m.bestD = Math.hypot(tx - m.x, ty - m.y); m.progT = simT; return; }
  let ux = (tx - m.x) / d, uy = (ty - m.y) / d;
  if (d > 22) { const e = pathField(m, tx, ty), dir = e ? boxDir(e, m.x, m.y) : null; if (dir) { ux = dir[0]; uy = dir[1]; } }
  const want = Math.atan2(uy, ux);
  // во дворе тесно: смотрим на корпус вперёд, а не на два, и перебираем больше направлений
  const free = a => !solidForMachine(m.x + Math.cos(a) * 6, m.y + Math.sin(a) * 6) && !solidForMachine(m.x + Math.cos(a) * 11, m.y + Math.sin(a) * 11);
  let best = null;
  for (const off of [0, .5, -.5, 1, -1, 1.6, -1.6, 2.4, -2.4, 3, -3]) { const a = want + off; if (free(a)) { best = a; break; } }
  if (best === null) best = m.ang + Math.PI * .5;
  let dd = best - m.ang; dd -= Math.round(dd / TAU) * TAU; m.ang += clamp(dd, -dt * 1.8, dt * 1.8);
  m.v += (sp * (Math.abs(dd) > 1 ? .4 : 1) - m.v) * Math.min(1, dt * 2);
  const nx = m.x + Math.cos(m.ang) * m.v * dt, ny = m.y + Math.sin(m.ang) * m.v * dt, blocked = solidForMachine(nx + Math.cos(m.ang) * 6, ny + Math.sin(m.ang) * 6);
  if (!blocked) { m.x = nx; m.y = ny; } else m.v *= .3;
  m.stuck = blocked || m.v < .5 ? m.stuck + dt : Math.max(0, m.stuck - dt);
  if (m.stuck > 12) { const [fx, fy] = freeNear(tx, ty, 60); if (Math.hypot(fx - tx, fy - ty) < 90) { m.x = fx; m.y = fy; } m.stuck = 0; } // застрял надолго — кран переставил (только рядом)
}
// куда подъезжать технике и бригадам: к фасаду дома со стороны улицы
function siteGoal(b) { return b.front ? [b.front.x, b.front.y] : b.door ? [b.door[0], b.door[1]] : [(b.x0 + b.x1) / 2, b.y1 + 10]; }
const DUMP_CAP = 6; // ковшей в один самосвал
function rubbleBounds(m, b) {
  let x0 = b ? b.x0 - 40 : m.x - 120, x1 = b ? b.x1 + 40 : m.x + 120, y0 = b ? b.y0 - 40 : m.y - 120, y1 = b ? b.y1 + 40 : m.y + 120;
  if (b && b.fallZone) { const z = b.fallZone, ex = z.px + z.ca * z.L, ey = z.py + z.sa * z.L; x0 = Math.min(x0, ex - z.half); x1 = Math.max(x1, ex + z.half); y0 = Math.min(y0, ey - z.half); y1 = Math.max(y1, ey + z.half); }
  return [x0, y0, x1, y1];
}
// ближайшая клетка завала; сначала расчищают проезжую часть и тротуар, чтобы подъехала техника;
// пока у дома стоит самосвал, разбирают от него — со стороны улицы вглубь, чтобы ковш доставал до кузова
function nearestRubble(m, b, roadOnly) {
  let best = null, bd = 1e9; const [x0, y0, x1, y1] = rubbleBounds(m, b), tr = b && truckFor(m, b), fx = tr ? tr.x : m.x, fy = tr ? tr.y : m.y;
  for (let y = y0; y < y1; y += CS) for (let x = x0; x < x1; x += CS) if (cellAt(x, y) === 8) { const gi = Math.floor(y / CS) * GW + Math.floor(x / CS); if (roadOnly && !roadMask[gi]) continue; const d = Math.hypot(x - fx, y - fy) + Math.hypot(x - m.x, y - m.y) * .3 + (roadMask[gi] ? 0 : 300); if (d < bd) { bd = d; best = [Math.floor(x / CS) * CS + 4, Math.floor(y / CS) * CS + 4]; } }
  return best;
}
// сколько клеток завала вокруг руины (включая полосу падения башни)
function ruinRubble(b) { const [x0, y0, x1, y1] = rubbleBounds(null, b); let n = 0; for (let y = y0; y < y1; y += CS) for (let x = x0; x < x1; x += CS) if (cellAt(x, y) === 8) n++; return n; }
// самосвал под погрузку: стоит у этой руины, не уезжает, не полон
function truckFor(m, b) {
  const ok = c => c && !c.gone && !c.leaving && !c.wreck && c.deployed && (c.load || 0) < DUMP_CAP;
  if (ok(m.truck)) return m.truck;
  m.truck = null; let bd = 1e9;
  for (const c of cars) if (c.service === "dump" && c.job && c.job.dump === b && ok(c)) { const d = Math.hypot(c.x - m.x, c.y - m.y); if (d < bd) { bd = d; m.truck = c; } }
  return m.truck;
}
// сколько техники нужно: по объёму завала
function fleetFor(b) { const r = ruinRubble(b); return { loaders: r > 120 ? 3 : 2, trucks: clamp(1 + Math.ceil(r / 70), 1, 3) }; }
function clearRubbleAt(b, px, py) {
  const gx = Math.floor(px / CS), gy = Math.floor(py / CS); if (gx < 0 || gy < 0 || gx >= GW || gy >= GH) return false;
  const gi = gy * GW + gx; if (grid[gi] !== 8) return false;
  // сколько было и сколько осталось: по этой доле оседает остов
  if (b) { if (b.rubble0 === undefined) b.rubble0 = b.rubbleLeft = ruinRubble(b); b.rubbleLeft--; }
  grid[gi] = b && insideFoot(b, px, py) ? 7 : (underRubble[gi] || 1); underRubble[gi] = 0;
  if (typeof onRubbleCleared === "function") onRubbleCleared(px, py, b);
  return true;
}

/* ---------- трал: технику к площадке привозят и увозят на низкорамном прицепе ----------
   Трал едет по дорогам, у площадки сгружает экскаватор и уезжает. Работа кончилась — экскаватор вызывает трал,
   съезжает к дороге, заезжает на платформу, и трал увозит его. Пока экскаватор на платформе, он едет вместе с тралом */
const LOWBOY_DECK = -1.5; // центр платформы от центра машины, в единицах модели
function deckPos(c) { const k = (c.len || 2.83) * 18 / 51, ca = Math.cos(c.ang), sa = Math.sin(c.ang); return [c.x + ca * LOWBOY_DECK * k, c.y + sa * LOWBOY_DECK * k]; }
function rearOf(c, extra = 10) { const ca = Math.cos(c.ang), sa = Math.sin(c.ang), r = (c.len || 2.83) * 9 + extra; return [c.x - ca * r, c.y - sa * r]; }
function deliverMachine(kind, job, gx, gy, delay) {
  const [ex, ey] = edgePointNear(gx, gy), m = addMachine(kind, ex, ey, job);
  m.carried = true; m.wantTruckT = simT + (delay || 0);
  return m;
}
// трал выезжает за экскаватором: доставка (m.carried — ещё за краем карты) или вывоз (m.pickupBy)
function sendLowboy(m, gx, gy, pickup) {
  const c = spawnService("lowboy", gx, gy, null);
  if (pickup) { c.pickup = m; m.pickupBy = c; m.pickT = simT; } else { c.cargo = m; m.onTruck = c; }
  return c;
}
function lowboyStep(c, dt) {
  // привёз: опускает сходни, экскаватор съезжает назад и встаёт за прицепом
  if (c.cargo) {
    c.unloadT = (c.unloadT || 0) + dt;
    if (c.unloadT > 5) {
      const m = c.cargo, [rx, ry] = rearOf(c, 14), [fx, fy] = freeNear(rx, ry, 24);
      m.carried = false; m.onTruck = null; m.x = fx; m.y = fy; m.ang = c.ang + Math.PI; m.v = 0; m.progT = simT;
      c.cargo = null; releaseUnit(c);
      logT("lowboy", "Трал сгрузил экскаватор у площадки и уехал", "", 25);
    }
    return;
  }
  // приехал за экскаватором: ждёт, пока тот заедет на платформу; не дождался за две минуты — уезжает пустым
  if (c.pickup) {
    const m = c.pickup; c.waitPickT = (c.waitPickT || 0) + dt;
    if (m.gone || c.waitPickT > 120) { if (!m.gone) { m.pickupBy = null; m.pickFail = (m.pickFail || 0) + 1; } c.pickup = null; releaseUnit(c); return; }
    if (m.carried && m.onTruck === c) { c.loadT = (c.loadT || 0) + dt; if (c.loadT > 4) { c.pickup = null; c.cargo2 = m; releaseUnit(c); logT("lowboy2", "Экскаватор погрузили на трал и увезли", "", 25); } }
  }
}
// экскаватор, работа которого кончилась: вызвать трал, подъехать к дороге, заехать на платформу; без трала — своим ходом
function machineGoHome(m, dt) {
  if (m.carried) return true;
  if (!m.pickupBy && settings.services && !(m.pickFail >= 2)) { const q = nearestLanePoint(m.x, m.y); sendLowboy(m, q ? q.x : m.x, q ? q.y : m.y, true); logT("lowboycall", "Экскаватор закончил работу и ждёт трал", "", 30); }
  const c = m.pickupBy;
  if (c && !c.gone && !c.wreck && !c.leaving) {
    if (c.deployed) {
      const [rx, ry] = rearOf(c, 6), d = Math.hypot(rx - m.x, ry - m.y);
      if (d > 8) { steerTo(m, rx, ry, 7, dt); return true; }
      // по сходням на платформу
      m.carried = true; m.onTruck = c; return true;
    }
    // пока трал едет — ждём у ближайшей дороги
    const q = m.roadQ || (m.roadQ = nearestLanePoint(m.x, m.y));
    if (q && Math.hypot(q.x - m.x, q.y - m.y) > 26) steerTo(m, q.x, q.y, 9, dt); else m.v *= .5;
    return true;
  }
  if (c && (c.gone || c.wreck || c.leaving)) { m.pickupBy = null; m.pickFail = (m.pickFail || 0) + 1; }
  return false;
}
// техника на платформе едет вместе с тралом; трал уехал за край — техника тоже; трал разбит — техника остаётся рядом
function stepCarried(m) {
  if (!m.carried) return false;
  if (!m.onTruck) {
    // ещё за краем карты: трал выезжает в свой черёд
    if (simT >= (m.wantTruckT || 0) && settings.services) { const J = m.job || {}, b = J.ruin || J.demo; const [gx, gy] = b ? siteGoal(b) : [m.x, m.y]; sendLowboy(m, gx, gy, false); }
    else if (!settings.services) m.carried = false;
    return true;
  }
  const c = m.onTruck;
  if (c.wreck) { m.carried = false; m.onTruck = null; const [fx, fy] = freeNear(c.x, c.y, 30); m.x = fx; m.y = fy; return false; }
  if (c.gone) { m.gone = true; return true; }
  const [dx, dy] = deckPos(c); m.x = dx; m.y = dy; m.ang = c.ang; m.v = 0;
  // застрял у завала в нескольких кварталах: сгружает там, дальше экскаватор своим ходом
  if (c.cargo === m && !c.deployed && !c.leaving && c.goal && c.wait > 25 && Math.hypot(c.goal.x - c.x, c.goal.y - c.y) < 400) deployCrew(c);
  return true;
}
function stepMachines(dt) {
  for (const m of machines) {
    if (m.gone) continue;
    m.bucket = Math.max(0, m.bucket - dt);
    if (m.kind !== "loader") continue;
    if (stepCarried(m)) continue;
    // зомби ближе 60 — экскаватор глушит работу и ждёт; сторож прогресса не считает это застреванием
    if (!m.leave) { let zc = 0; nearZ(m.x, m.y, 60, () => zc++); if (zc) { m.v *= .3; m.progT = simT; m.workT = 0; continue; } }
    // домой: к ближайшему выезду
    if (m.leave && machineGoHome(m, dt)) continue;
    if (m.leave) { const e = m.exit || (m.exit = edgePointNear(m.x, m.y)); m.leaveT = (m.leaveT || 0) + dt; steerTo(m, e[0], e[1], 14, dt); if (Math.hypot(e[0] - m.x, e[1] - m.y) < 30 || m.leaveT > 90 || m.x < 12 || m.y < 12 || m.x > W - 12 || m.y > H - 12) m.gone = true; continue; }
    const J = m.job || {};
    // снос выгоревшего остова: подъезжает к стене, бьёт ковшом, дом оседает
    if (J.demo) {
      const b = J.demo;
      if (b.state === "ruin") m.job = { ruin: b };
      else if (b.state === "collapsing") { m.v *= .5; continue; }
      else if (!(b.gutted && b.state === "ok")) { m.leave = true; b.clearAssigned = false; continue; }
      else {
        const tx = clamp(m.x, b.x0 - 16, b.x1 + 16), ty = clamp(m.y, b.y0 - 16, b.y1 + 16), d = Math.hypot(tx - m.x, ty - m.y);
        if (d < 90 && !b.siteCells) fenceSite(b);
        if (d > 6) { steerTo(m, tx, ty, 11, dt); continue; }
        m.v *= .5; m.bucket = .6; b.demoT = (b.demoT || 0) + dt; m.workT += dt;
        if (m.workT > 1.4) { m.workT = 0; fxDebris(clamp(m.x, b.x0, b.x1), clamp(m.y, b.y0, b.y1)); if (Math.random() < .5) sfx.thud(m); }
        if (b.demoT > 8 + b.floors * 2.5) { collapse(b, true); m.job = { ruin: b }; b.truckN = fleetFor(b).trucks; }
        continue;
      }
    }
    const b = J.ruin;
    if (b && !b.siteCells && Math.hypot(m.x - (b.x0 + b.x1) / 2, m.y - (b.y0 + b.y1) / 2) < 110) fenceSite(b);
    const scoop = (t) => { const d = Math.hypot(t[0] - m.x, t[1] - m.y); if (d > 26) { steerTo(m, t[0], t[1], 11, dt); return false; } m.v *= .5; m.workT += dt; m.bucket = .6; if (m.workT > 1.1) { m.workT = 0; const cells = []; for (let oy = -2; oy <= 2; oy++) for (let ox = -2; ox <= 2; ox++) { const px = t[0] + ox * CS, py = t[1] + oy * CS; if (Math.hypot(px - m.x, py - m.y) <= 30 && cellAt(px, py) === 8) cells.push([px, py, Math.hypot(px - t[0], py - t[1])]); } cells.sort((p, q) => p[2] - q[2]); let n = 0; for (const [px, py] of cells.slice(0, 6)) if (clearRubbleAt(b, px, py)) n++; if (n) { fieldT = 0; gridDirty = true; return true; } } return false; };
    // полный ковш — к самосвалу; самосвала нет — пока расчищаем проезжую часть, чтобы он смог подъехать
    if (m.carry) {
      const tr = truckFor(m, b);
      if (!tr) { const t = nearestRubble(m, b, true); if (t) scoop(t); else m.v *= .5; continue; }
      // встаём сбоку от кузова (с той стороны, где уже стоим), разворачиваем ковш к кузову
      const ca = Math.cos(tr.ang), sa = Math.sin(tr.ang), sideSign = (-(m.x - tr.x) * sa + (m.y - tr.y) * ca) >= 0 ? 1 : -1;
      const px = tr.x - ca * 7 - sa * sideSign * 13, py = tr.y - sa * 7 + ca * sideSign * 13, d = Math.hypot(px - m.x, py - m.y);
      // стрела достаёт до кузова с 30 единиц: подъезжаем, только если дальше
      if (d > 5 && Math.hypot(tr.x - m.x, tr.y - m.y) > 30) { steerTo(m, px, py, 9, dt); continue; }
      m.v *= .5; m.bucket = .6; m.workT += dt; m.loading = true;
      { const want = Math.atan2(tr.y - m.y, tr.x - m.x); let dd = want - m.ang; dd -= Math.round(dd / TAU) * TAU; m.ang += clamp(dd, -dt * 2, dt * 2); }
      if (m.workT > 1.2) { m.workT = 0; m.carry = 0; m.loading = false; tr.load = (tr.load || 0) + 1; if (tr.load >= DUMP_CAP) { releaseUnit(tr); m.truck = null; logT("dumpgo", "Самосвал увёз обломки на свалку", "", 25); } }
      continue;
    }
    if (b && !m.carry && b.state === "ruin" && !nearestRubble(m, b, true) && typeof roadSiteFor === "function") { const ob = roadSiteFor(m, b); if (ob) { m.job = { ruin: ob }; m.truck = null; if (!machines.some(o => o !== m && !o.gone && !o.leave && o.job && o.job.ruin === b)) b.clearAssigned = false; ob.clearAssigned = true; if (!cars.some(c => c.service === "dump" && !c.gone && !c.leaving && c.job && c.job.dump === ob)) { const [gx, gy] = siteGoal(ob); spawnService("dump", gx, gy, null).job = { dump: ob }; ob.truckN = fleetFor(ob).trucks; ob.dumpSentT = simT; } continue; } }
    const t = nearestRubble(m, b);
    if (!t) {
      // площадка пуста: закрываем её один раз (на ней могло работать несколько экскаваторов), сам экскаватор — на следующую или домой
      if (b && b.state === "ruin" && (!b.clearedT || b.clearedT < (b.cT0 || 0))) { b.clearAssigned = false; b.clearedT = simT; b.rubble0 = undefined; if (typeof onSiteCleared === "function") onSiteCleared(b); logE(b.kind === "tower" ? "Завал небоскрёба вывезен: площадка готова под стройку" : "Завал вывезен: площадка готова под стройку", "good"); }
      const nx = typeof nextSiteFor === "function" ? nextSiteFor(m, b) : null;
      if (nx) { m.job = nx.state === "ruin" ? { ruin: nx } : { demo: nx }; m.truck = null; continue; }
      m.leave = true;
      continue;
    }
    if (scoop(t)) m.carry = 1;
  }
  machines = machines.filter(m => !m.gone);
  // эвакуатор тащит машину за собой
  for (const c of cars) if (c.towedBy) { const t = c.towedBy; if (t.gone) { c.gone = true; continue; } c.x = t.x - Math.cos(t.ang) * 20; c.y = t.y - Math.sin(t.ang) * 20; c.ang = t.ang; c.z = 0; c.roll = 0; }
}
