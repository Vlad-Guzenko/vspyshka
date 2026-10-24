/* ---------- ядерный удар ---------- */
// 1 ед. = 25 см: огненный шар 40 м, полное разрушение до 110 м, тяжёлые разрушения до 190 м, ожоги до 250 м
const NUKE = { R0: 160, R1: 440, R2: 760, RMAX: 1000, wave: 420 };
let nuke = null, radZones = [];
function launchNuke(x, y) {
  if (nuke && !nuke.over) return false;
  nuke = { x, y, t: 10, R: 0, det: false, age: 0, over: false };
  logE("Ядерный удар по городу: ракета будет через 10 секунд", "bad");
  radio("Штаб: всем в укрытия! Ядерный удар через 10 секунд");
  for (const a of agents) if (a.state === "alive" && a.role !== "zombie") a.panic = 1;
  return true;
}
function detonate() {
  const { x, y } = nuke; nuke.det = true;
  interest(x, y, 30); fxNuke(x, y); sfx.nuke(x, y);
  // эпицентр: всё испаряется
  for (const a of agents) {
    if (a.state === "saved") continue;
    const d = Math.hypot(a.x - x, a.y - y);
    if (d < NUKE.R0) { if (a.state === "alive" && a.role !== "zombie") deaths++; if (a.role === "zombie" && a.state === "alive") zkills++; a.state = "saved"; a.vapor = true; }
  }
  for (const b of buildings) { const d = Math.hypot(Math.max(b.x0 - x, 0, x - b.x1), Math.max(b.y0 - y, 0, y - b.y1)); if (d < NUKE.R0 + 40 && b.state === "ok") { b.hp = 0; collapse(b); b.ruinH = rnd(1, 4); } }
  for (const c of cars) if (Math.hypot(c.x - x, c.y - y) < NUKE.R0) c.gone = true;
  for (let i = 0; i < 70; i++) { const a = rnd(0, TAU), r = Math.sqrt(Math.random()) * NUKE.R1; fires.push({ x: x + Math.cos(a) * r, y: y + Math.sin(a) * r, r: rnd(10, 26), l: rnd(40, 120) }); }
  // электромагнитный импульс глушит машины
  for (const c of cars) if (c.moving && Math.hypot(c.x - x, c.y - y) < NUKE.RMAX * 1.6) { c.moving = false; c.stopped = true; c.v = 0; }
  radZones.push({ x, y, r: NUKE.R1 * 1.4, t: 240 });
  addDanger(x, y, NUKE.R1 * 1.7, 900);
  firsts.nuke = true;
  logE("Ядерный взрыв", "bad");
  fieldT = 0;
}
function stepNuke(dt) {
  for (const z of radZones) {
    z.t -= dt;
    near(z.x, z.y, z.r, a => { if (a.state !== "alive" || a.role === "zombie") return; const k = 1 - Math.hypot(a.x - z.x, a.y - z.y) / z.r; if (k > 0) { a.rad = (a.rad || 0) + dt * k * .02; a.hp -= dt * k * 1.2; if (a.hp <= 0) kill(a, false); } });
  }
  radZones = radZones.filter(z => z.t > 0);
  if (!nuke || nuke.over) return;
  if (!nuke.det) { nuke.t -= dt; if (nuke.t <= 0) detonate(); return; }
  nuke.age += dt;
  const prev = nuke.R; nuke.R = Math.min(NUKE.RMAX, nuke.R + dt * NUKE.wave);
  const { x, y } = nuke, R = nuke.R, ring = d => d > prev && d <= R;
  // ударная волна проходит кольцом
  for (const a of agents) {
    if (a.state === "saved") continue;
    const d = Math.hypot(a.x - x, a.y - y); if (!ring(d)) continue;
    const k = 1 - d / NUKE.RMAX, ang = Math.atan2(a.y - y, a.x - x);
    if (a.state === "alive") {
      if (d < NUKE.R1) { if (a.role === "zombie") destroyZombie(a, true); else kill(a, false); a.reanimate = false; a.burnt = d < NUKE.R1 * .8; }
      else if (a.role === "zombie") { a.zhp -= 4 * k; if (Math.random() < k) ignite(a); if (a.zhp <= 0) destroyZombie(a, true); }
      else { a.hp -= 90 * k; a.burn = Math.min(1, (a.burn || 0) + k * .8); if (Math.random() < k * 1.3) ignite(a); if (a.hp <= 0) kill(a, false); else { a.grabT = 1.5; a.panic = 1; } }
    }
    a.vx = Math.cos(ang) * (20 + 140 * k); a.vy = Math.sin(ang) * (20 + 140 * k); a.vz = 10 + 70 * k; a.spin = rnd(-14, 14); a.z = Math.max(a.z, .1);
  }
  for (const b of buildings) {
    if (b.state !== "ok") continue;
    const d = Math.hypot(Math.max(b.x0 - x, 0, x - b.x1), Math.max(b.y0 - y, 0, y - b.y1)); if (!ring(d)) continue;
    const k = 1 - d / NUKE.RMAX;
    // до R1 всё рушится, до R2 дома падают, а башни выгорают до остова; дальше ожоги и пожары
    const dmg = d < NUKE.R1 ? b.maxHp * 1.2 : d < NUKE.R2 ? b.maxHp * (b.floors > 8 ? .55 + .5 * k : .8 + .6 * k) : b.maxHp * .45 * k * k;
    damageBuilding(b, dmg, x, y);
    if (b.state === "ok" && d < NUKE.R2 * 1.15 && Math.random() < .3 + k) b.fire = Math.max(b.fire, rnd(80, 200));
    if (b.state === "ok") { b.scorch = Math.max(b.scorch, clamp(k * 1.3)); if (b.hp < b.maxHp * .45 && !b.gutted && !(b.fire > 0)) gutBuilding(b); }
  }
  for (const c of cars) {
    if (c.gone || c.z > 0) continue;
    const d = Math.hypot(c.x - x, c.y - y); if (!ring(d)) continue;
    const k = 1 - d / NUKE.RMAX, ang = Math.atan2(c.y - y, c.x - x);
    if (d < NUKE.R2) { c.wreck = true; c.moving = false; c.stopped = true; clearCarCells(c); c.vx = Math.cos(ang) * 120 * k; c.vy = Math.sin(ang) * 120 * k; c.vz = 20 + 60 * k; c.z = .1; c.sr = rnd(-8, 8) * k; c.sy = rnd(-4, 4) * k; c.roll = c.roll || 0; if (Math.random() < k) c.burnT = rnd(30, 90); }
    else c.alarm = rnd(20, 60);
  }
  for (const l of lamps) if (!l.down && ring(Math.hypot(l.x - x, l.y - y)) && Math.hypot(l.x - x, l.y - y) < NUKE.R2) l.down = rnd(1.2, 1.55) * (Math.random() < .5 ? 1 : -1);
  for (const t of trees) if (ring(Math.hypot(t.x - x, t.y - y)) && Math.hypot(t.x - x, t.y - y) < NUKE.R2 * 1.1) t.burnt = true;
  if (prev < NUKE.RMAX) for (let gy = Math.max(0, Math.floor((y - R) / CS)); gy <= Math.min(GH - 1, Math.floor((y + R) / CS)); gy++) for (let gx = Math.max(0, Math.floor((x - R) / CS)); gx <= Math.min(GW - 1, Math.floor((x + R) / CS)); gx++) { const i = gy * GW + gx; if (grid[i] === 6 && ring(Math.hypot(gx * CS - x, gy * CS - y)) && Math.hypot(gx * CS - x, gy * CS - y) < NUKE.R1) { grid[i] = 0; barrDirty = true; } }
  if (prev < NUKE.RMAX) { gridDirty = true; fieldT = 0; }
  if (R >= NUKE.RMAX && nuke.age > 40) nuke.over = true;
}

/* ---------- восстановление: ремонтники отстраивают разрушенное ---------- */
function stepConstruction(dt) {
  for (const b of buildings) {
    if (b.state !== "construct") continue;
    // строят, пока рядом есть рабочие
    let n = 0; near((b.x0 + b.x1) / 2, (b.y0 + b.y1) / 2, Math.max(b.x1 - b.x0, b.y1 - b.y0) / 2 + 30, a => { if (a.state === "alive" && a.role === "worker" && a.buildB === b) n++; });
    if (n) b.lastWork = simT;
    b.prog = Math.min(1, b.prog + dt * Math.min(n, 6) / (500 + b.floors * 70)); // три рабочих: дом за три-четыре минуты, башня за десять
    if (b.prog >= 1) {
      b.state = "ok"; b.hp = b.maxHp; b.scorch = 0; b.fire = 0; b.prog = 1; b.rebuilt = true; b.clearAssigned = false; unfenceSite(b); b.fireAssigned = false; b.gutted = false; b.gutT = 0; b.doorHp = b.doorMax || b.doorHp; b.cT = 0;
      if (b.gutDoor) { b.gutDoor = false; const cx = (b.x0 + b.x1) / 2, cy = (b.y0 + b.y1) / 2; for (const [x, y] of b.rot !== undefined ? (b.doorPref ? [b.doorPref] : []) : [[cx, b.y1 + 5], [cx, b.y0 - 5], [b.x0 - 5, cy], [b.x1 + 5, cy]]) { const c = cellAt(x, y); if (c === 0 || c === 1 || c === 2 || c === 7) { b.door = [x, y]; break; } } }
      logT("rebuilt", b.kind === "tower" ? "Небоскрёб отстроен заново" : "Дом отстроен заново", "good", 10);
      for (const a of agents) if (a.buildB === b) { a.buildB = null; a.done = true; }
    }
  }
}
