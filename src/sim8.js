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
    if (!edge || Math.hypot(gx * CS + 4 - fx, gy * CS + 4 - fy) < 14) continue;
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
  if (simT - m.progT > 20) { const [fx, fy] = freeNear(tx, ty, 30); m.x = fx; m.y = fy; m.stuck = 0; m.bestD = Math.hypot(tx - m.x, ty - m.y); m.progT = simT; return; }
  let ux = (tx - m.x) / d, uy = (ty - m.y) / d;
  if (d > 22) { const e = pathField(m, tx, ty), dir = e ? boxDir(e, m.x, m.y) : null; if (dir) { ux = dir[0]; uy = dir[1]; } }
  const want = Math.atan2(uy, ux);
  const free = a => !solidForMachine(m.x + Math.cos(a) * 7, m.y + Math.sin(a) * 7) && !solidForMachine(m.x + Math.cos(a) * 14, m.y + Math.sin(a) * 14);
  let best = null;
  for (const off of [0, .5, -.5, 1, -1, 1.6, -1.6, 2.4, -2.4]) { const a = want + off; if (free(a)) { best = a; break; } }
  if (best === null) best = m.ang + Math.PI * .5;
  let dd = best - m.ang; dd -= Math.round(dd / TAU) * TAU; m.ang += clamp(dd, -dt * 1.8, dt * 1.8);
  m.v += (sp * (Math.abs(dd) > 1 ? .4 : 1) - m.v) * Math.min(1, dt * 2);
  const nx = m.x + Math.cos(m.ang) * m.v * dt, ny = m.y + Math.sin(m.ang) * m.v * dt, blocked = solidForMachine(nx + Math.cos(m.ang) * 6, ny + Math.sin(m.ang) * 6);
  if (!blocked) { m.x = nx; m.y = ny; } else m.v *= .3;
  m.stuck = blocked || m.v < .5 ? m.stuck + dt : Math.max(0, m.stuck - dt);
  if (m.stuck > 12) { const [fx, fy] = freeNear(tx, ty, 40); m.x = fx; m.y = fy; m.stuck = 0; } // застрял надолго — кран переставил
}
// куда подъезжать технике и бригадам: к фасаду дома со стороны улицы
function siteGoal(b) { return b.front ? [b.front.x, b.front.y] : b.door ? [b.door[0], b.door[1]] : [(b.x0 + b.x1) / 2, b.y1 + 10]; }
const DUMP_CAP = 6; // ковшей в один самосвал
function rubbleBounds(m, b) {
  let x0 = b ? b.x0 - 40 : m.x - 120, x1 = b ? b.x1 + 40 : m.x + 120, y0 = b ? b.y0 - 40 : m.y - 120, y1 = b ? b.y1 + 40 : m.y + 120;
  if (b && b.fallZone) { const z = b.fallZone, ex = z.px + z.ca * z.L, ey = z.py + z.sa * z.L; x0 = Math.min(x0, ex - z.half); x1 = Math.max(x1, ex + z.half); y0 = Math.min(y0, ey - z.half); y1 = Math.max(y1, ey + z.half); }
  return [x0, y0, x1, y1];
}
// ближайшая клетка завала; сначала расчищают проезжую часть и тротуар, чтобы подъехала техника
function nearestRubble(m, b, roadOnly) {
  let best = null, bd = 1e9; const [x0, y0, x1, y1] = rubbleBounds(m, b);
  for (let y = y0; y < y1; y += CS) for (let x = x0; x < x1; x += CS) if (cellAt(x, y) === 8) { const gi = Math.floor(y / CS) * GW + Math.floor(x / CS); if (roadOnly && !roadMask[gi]) continue; const d = Math.hypot(x - m.x, y - m.y) + (roadMask[gi] ? 0 : 300); if (d < bd) { bd = d; best = [Math.floor(x / CS) * CS + 4, Math.floor(y / CS) * CS + 4]; } }
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
function fleetFor(b) { const r = ruinRubble(b); return { loaders: r > 90 ? 2 : 1, trucks: clamp(1 + Math.ceil(r / 40), 1, 4) }; }
function clearRubbleAt(b, px, py) {
  const gx = Math.floor(px / CS), gy = Math.floor(py / CS); if (gx < 0 || gy < 0 || gx >= GW || gy >= GH) return false;
  const gi = gy * GW + gx; if (grid[gi] !== 8) return false;
  grid[gi] = b && insideFoot(b, px, py) ? 7 : (underRubble[gi] || 1); underRubble[gi] = 0;
  if (typeof onRubbleCleared === "function") onRubbleCleared(px, py);
  return true;
}
function stepMachines(dt) {
  for (const m of machines) {
    if (m.gone) continue;
    m.bucket = Math.max(0, m.bucket - dt);
    if (m.kind !== "loader") continue;
    // домой: к ближайшему выезду
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
    const scoop = (t) => { const d = Math.hypot(t[0] - m.x, t[1] - m.y); if (d > 24) { steerTo(m, t[0], t[1], 11, dt); return false; } m.v *= .5; m.workT += dt; m.bucket = .6; if (m.workT > 1.1) { m.workT = 0; let n = 0; for (let oy = -1; oy <= 1; oy++) for (let ox = -1; ox <= 1; ox++) if (clearRubbleAt(b, t[0] + ox * CS, t[1] + oy * CS)) n++; if (n) { fieldT = 0; gridDirty = true; return true; } } return false; };
    // полный ковш — к самосвалу; самосвала нет — пока расчищаем проезжую часть, чтобы он смог подъехать
    if (m.carry) {
      const tr = truckFor(m, b);
      if (!tr) { const t = nearestRubble(m, b, true); if (t) scoop(t); else m.v *= .5; continue; }
      // встаём сбоку от кузова (с той стороны, где уже стоим), разворачиваем ковш к кузову
      const ca = Math.cos(tr.ang), sa = Math.sin(tr.ang), sideSign = (-(m.x - tr.x) * sa + (m.y - tr.y) * ca) >= 0 ? 1 : -1;
      const px = tr.x - ca * 7 - sa * sideSign * 13, py = tr.y - sa * 7 + ca * sideSign * 13, d = Math.hypot(px - m.x, py - m.y);
      if (d > 5) { steerTo(m, px, py, 9, dt); continue; }
      m.v *= .5; m.bucket = .6; m.workT += dt; m.loading = true;
      { const want = Math.atan2(tr.y - m.y, tr.x - m.x); let dd = want - m.ang; dd -= Math.round(dd / TAU) * TAU; m.ang += clamp(dd, -dt * 2, dt * 2); }
      if (m.workT > 1.2) { m.workT = 0; m.carry = 0; m.loading = false; tr.load = (tr.load || 0) + 1; if (tr.load >= DUMP_CAP) { releaseUnit(tr); m.truck = null; logT("dumpgo", "Самосвал увёз обломки на свалку", "", 25); } }
      continue;
    }
    const t = nearestRubble(m, b);
    if (!t) {
      m.leave = true;
      if (b) { b.clearAssigned = false; b.clearedT = simT; logE(b.kind === "tower" ? "Завал небоскрёба вывезен: площадка готова под стройку" : "Завал вывезен: площадка готова под стройку", "good"); }
      continue;
    }
    if (scoop(t)) m.carry = 1;
  }
  machines = machines.filter(m => !m.gone);
  // эвакуатор тащит машину за собой
  for (const c of cars) if (c.towedBy) { const t = c.towedBy; if (t.gone) { c.gone = true; continue; } c.x = t.x - Math.cos(t.ang) * 20; c.y = t.y - Math.sin(t.ang) * 20; c.ang = t.ang; c.z = 0; c.roll = 0; }
}
