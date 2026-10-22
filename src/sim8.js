/* ---------- тяжёлая техника: погрузчик, самосвал, эвакуатор, бетономешалка ---------- */
let machines = [];
// стройплощадка: место под дом снова занято
function startConstruct(b) { b.state = "construct"; b.prog = 0; if (b.rot !== undefined) fillRotRect(b.cx, b.cy, b.w, b.d, b.rot, 3); else fillCells(b.x0, b.y0, b.x1, b.y1, 3); for (const a of agents) if (a.state === "alive" && a.x > b.x0 && a.x < b.x1 && a.y > b.y0 && a.y < b.y1) { const [x, y] = freeNear(a.x, a.y, 40); a.x = x; a.y = y; } fieldT = 0; gridDirty = true; }
function addMachine(kind, x, y, job) {
  const m = { kind, x, y, ang: rnd(0, TAU), v: 0, job, bucket: 0, load: 0, workT: 0, stuck: 0, gone: false };
  machines.push(m); return m;
}
const solidForMachine = (x, y) => { const c = cellAt(x, y); return c === 3 || c === 4 || c === 6 || c === 9 || c === 10 || x < 6 || y < 6 || x > W - 6 || y > H - 6; };
function steerTo(m, tx, ty, sp, dt) {
  const want = Math.atan2(ty - m.y, tx - m.x);
  // объезд препятствий: пробуем отклонения от прямого курса
  let best = null;
  for (const off of [0, .5, -.5, 1, -1, 1.6, -1.6, 2.4, -2.4]) { const a = want + off; if (!solidForMachine(m.x + Math.cos(a) * 14, m.y + Math.sin(a) * 14)) { best = a; break; } }
  if (best === null) { m.stuck += dt; best = m.ang + Math.PI * .5; } else m.stuck = Math.max(0, m.stuck - dt);
  let dd = best - m.ang; dd -= Math.round(dd / TAU) * TAU; m.ang += clamp(dd, -dt * 1.8, dt * 1.8);
  m.v += (sp * (Math.abs(dd) > 1 ? .4 : 1) - m.v) * Math.min(1, dt * 2);
  const nx = m.x + Math.cos(m.ang) * m.v * dt, ny = m.y + Math.sin(m.ang) * m.v * dt;
  if (!solidForMachine(nx + Math.cos(m.ang) * 6, ny + Math.sin(m.ang) * 6)) { m.x = nx; m.y = ny; } else { m.v *= .3; m.stuck += dt; }
  if (m.stuck > 15) { const [fx, fy] = freeNear(tx, ty, 40); m.x = fx; m.y = fy; m.stuck = 0; } // застрял надолго — кран переставил
}
function nearestRubble(m, b) {
  let best = null, bd = 1e9;
  let x0 = b ? b.x0 - 40 : m.x - 120, x1 = b ? b.x1 + 40 : m.x + 120, y0 = b ? b.y0 - 40 : m.y - 120, y1 = b ? b.y1 + 40 : m.y + 120;
  if (b && b.fallZone) { const z = b.fallZone, ex = z.px + z.ca * z.L, ey = z.py + z.sa * z.L; x0 = Math.min(x0, ex - z.half); x1 = Math.max(x1, ex + z.half); y0 = Math.min(y0, ey - z.half); y1 = Math.max(y1, ey + z.half); }
  for (let y = y0; y < y1; y += CS) for (let x = x0; x < x1; x += CS) if (cellAt(x, y) === 8) { const d = Math.hypot(x - m.x, y - m.y); if (d < bd) { bd = d; best = [Math.floor(x / CS) * CS + 4, Math.floor(y / CS) * CS + 4]; } }
  return best;
}
function stepMachines(dt) {
  for (const m of machines) {
    if (m.gone) continue;
    m.bucket = Math.max(0, m.bucket - dt);
    if (m.kind === "loader") {
      // погрузчик гребёт завал: подъехал, зачерпнул, клетка расчищена
      const b = m.job && m.job.ruin;
      const t = nearestRubble(m, b);
      if (!t) {
        if (b && b.state === "ruin") { startConstruct(b); logE(b.kind === "tower" ? "Завал разобран, начали восстанавливать небоскрёб" : "Завал разобран, начали восстанавливать дом", "good"); spawnService("mixer", (b.x0 + b.x1) / 2, b.y1 + 10, null).job = { build: b }; }
        m.leave = true;
      }
      if (m.leave) { const e = m.exit || (m.exit = edgePointNear(m.x, m.y)); m.leaveT = (m.leaveT || 0) + dt; steerTo(m, e[0], e[1], 14, dt); if (Math.hypot(e[0] - m.x, e[1] - m.y) < 30 || m.leaveT > 90 || m.x < 12 || m.y < 12 || m.x > W - 12 || m.y > H - 12) m.gone = true; continue; }
      const d = Math.hypot(t[0] - m.x, t[1] - m.y);
      m.far = d > 24 && m.v < 1 ? (m.far || 0) + dt : 0;
      if (d > 24 && m.far < 3) steerTo(m, t[0], t[1], 11, dt);
      else { m.v *= .5; m.workT += dt; m.bucket = .6; if (m.workT > 1.1) { m.workT = 0; for (let oy = -1; oy <= 1; oy++) for (let ox = -1; ox <= 1; ox++) { const px = t[0] + ox * CS, py = t[1] + oy * CS, gx = Math.floor(px / CS), gy = Math.floor(py / CS); if (gx < 0 || gy < 0 || gx >= GW || gy >= GH || grid[gy * GW + gx] !== 8) continue; { const gi2 = gy * GW + gx; grid[gi2] = b && insideFoot(b, px, py) ? 7 : (underRubble[gi2] || 1); underRubble[gi2] = 0; if (typeof onRubbleCleared === "function") onRubbleCleared(px, py); } } m.load++; fxDebris(t[0], t[1]); fieldT = 0; gridDirty = true; if (m.load % 8 === 0) sfx.crash({ x: m.x, y: m.y }); } }
    }
  }
  machines = machines.filter(m => !m.gone);
  // эвакуатор тащит машину за собой
  for (const c of cars) if (c.towedBy) { const t = c.towedBy; if (t.gone) { c.gone = true; continue; } c.x = t.x - Math.cos(t.ang) * 20; c.y = t.y - Math.sin(t.ang) * 20; c.ang = t.ang; c.z = 0; c.roll = 0; }
}
