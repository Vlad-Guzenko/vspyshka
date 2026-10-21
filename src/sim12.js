/* ---------- отряды: выделение рамкой и приказы ---------- */
let selected = [], orderMark = null;
const isFighter = a => a.state === "alive" && a.role !== "zombie" && (a.role === "army" || a.role === "police" || (a.armed && a.hero === "sniper")) && !a.post;
function selectBox(x0, y0, x1, y1) {
  if (x1 < x0) [x0, x1] = [x1, x0]; if (y1 < y0) [y0, y1] = [y1, y0];
  selected = agents.filter(a => isFighter(a) && a.x >= x0 - 2 && a.x <= x1 + 2 && a.y >= y0 - 2 && a.y <= y1 + 2);
  return selected.length;
}
function selectNear(x, y) { let best = null, bd = 10; for (const a of agents) if (isFighter(a)) { const d = Math.hypot(a.x - x, a.y - y); if (d < bd) { bd = d; best = a; } } selected = best ? [best] : []; return selected.length; }
function orderMove(x, y) {
  selected = selected.filter(isFighter); if (!selected.length) return false;
  const n = selected.length, R = Math.min(18, 4 + n * 1.2);
  selected.forEach((a, i) => { const ang = i / n * TAU, r = n > 1 ? R * Math.sqrt((i + 1) / n) : 0; const [px, py] = freeNear(x + Math.cos(ang) * r, y + Math.sin(ang) * r, 8); a.order = { x: px, y: py }; a.done = false; a.quietT = 0; });
  orderMark = { x, y, t: simT };
  logT("order", `Приказ отряду: занять позицию ${placeName(x, y)}`, "good", 8); sfx.radio();
  return true;
}
function clearOrders() { for (const a of selected) a.order = null; selected = []; }
function stepSquads(dt) { if (selected.length && selected.some(a => !isFighter(a))) selected = selected.filter(isFighter); }

/* ---------- стройка: вышка, прожектор, лагерь ---------- */
let towers = [], floods = [], camps = [], drops = [];
function freeSquare(x, y, half) { for (let yy = y - half; yy <= y + half; yy += CS / 2) for (let xx = x - half; xx <= x + half; xx += CS / 2) { const c = cellAt(xx, yy); if (!(c === 0 || c === 1 || c === 2 || c === 7)) return false; } return true; }
function addTower(x, y) {
  // ищем свободную площадку рядом с точкой клика
  let found = null;
  for (let r = 0; r <= 70 && !found; r += 6) for (let a = 0; a < TAU && !found; a += r ? .6 : 7) { const px = x + Math.cos(a) * r, py = y + Math.sin(a) * r; if (freeSquare(px, py, 8)) found = [px, py]; }
  if (!found) return false; [x, y] = found;
  const t = { x, y, h: 17 }; towers.push(t); fillCells(x - 7, y - 7, x + 7, y + 7, 3); fieldT = 0; gridDirty = true; barrDirty = true;
  const g = newAgent("army", x, y); g.post = t; g.onRoof = true; g.roofZ = t.h; g.rx = x; g.ry = y; g.ammo = 600; g.mag = 30; g.panic = 0;
  logE(`Поставлена вышка, стрелок ${g.name} на посту`, "good"); return true;
}
function addFlood(x, y) {
  const [fx, fy] = freeNear(x, y, 6); floods.push({ x: fx, y: fy, on: true }); logE("Установлен прожектор: ночью вокруг светло, но свет манит зомби", "good"); return true;
}
function litAt(x, y) { for (const f of floods) if (f.on && Math.abs(f.x - x) < 95 && Math.abs(f.y - y) < 95 && Math.hypot(f.x - x, f.y - y) < 95) return true; return false; }
function nearestFlood(x, y, r) { let best = null, bd = r; for (const f of floods) { if (!f.on) continue; const d = Math.hypot(f.x - x, f.y - y); if (d < bd) { bd = d; best = f; } } return best; }
// лагерь: квадрат стен с воротами, палатки, прожектор, склад; жители идут внутрь, солдаты держат периметр
function addCamp(x, y) {
  const R = 46;
  if (x < R + 10 || y < R + 10 || x > W - R - 10 || y > H - R - 10) return false;
  const c = { x, y, r: R, food: 240, hungryT: 0, gate: [x, y + R], n: 0 };
  const put = (px, py, hp, wall) => { const gx = Math.floor(px / CS), gy = Math.floor(py / CS); if (gx < 0 || gy < 0 || gx >= GW || gy >= GH) return; const i = gy * GW + gx, cell = grid[i]; if (cell === 3 || cell === 9 || cell === 5 || cell === 10) return; grid[i] = 6; bhp[i] = hp; wallMask[i] = wall ? 1 : 0; };
  for (let t = -R; t <= R; t += CS) { const gate = Math.abs(t) < 12; put(x + t, y - R, 220, true); if (!gate) put(x + t, y + R, 220, true); put(x - R, y + t, 220, true); put(x + R, y + t, 220, true); } // ворота открыты: их держат солдаты
  camps.push(c); barrDirty = true; fieldT = 0;
  floods.push({ x, y: y - 10, on: true }); depots.push({ x: x + 22, y: y - 22, ammo: 300, max: 300 });
  for (let i = 0; i < 4; i++) { const [ax, ay] = freeNear(x + (i % 2 ? 26 : -26), y + (i < 2 ? 26 : -26), 6); const a = newAgent("army", ax, ay); a.order = { x: ax, y: ay }; a.ammo = 240; }
  logE("Развёрнут лагерь выживших: стены, ворота, палатки, прожектор, склад и четверо солдат", "good"); radio("Штаб: лагерь готов, собирайте людей внутрь"); sfx.radio();
  return true;
}
function campOf(x, y) { for (const c of camps) if (Math.abs(c.x - x) < c.r - 4 && Math.abs(c.y - y) < c.r - 4) return c; return null; }
function stepCamps(dt) {
  for (const c of camps) {
    c.n = 0; near(c.x, c.y, c.r, a => { if (a.state === "alive" && a.role === "civ" && campOf(a.x, a.y)) { c.n++; a.inCamp = c; } });
    // еда: по единице в минуту на человека; кончилась — голод, потом вылазки
    c.food -= c.n * dt / 60 * (settings.noWater ? 1.6 : 1);
    if (c.food <= 0) { c.food = 0; c.hungryT += dt; if (c.hungryT > 5 && Math.random() < dt * .4) logT("camphunger", "В лагере кончилась еда", "bad", 40); } else c.hungryT = 0;
    if (Math.random() < dt * .25) near(c.x, c.y, 240, a => { if (a.state === "alive" && a.role === "civ" && !a.hidden && !a.inCamp && !a.campGoal && !a.forage && Math.random() < (a.panic > .3 ? .5 : .12)) a.campGoal = c; });
    if (c.hungryT > 20 && Math.random() < dt * .08) { let f = null; near(c.x, c.y, c.r, a => { if (!f && a.state === "alive" && a.role === "civ" && a.inCamp && !a.forage) f = a; }); if (f) sendForager(f, c); }
  }
}
// припасы: откуда носят еду — торговый центр, склад боеприпасов (там же консервы), другой лагерь
function foodSource(x, y, from) {
  const srcs = [];
  if (special.mall && special.mall.b.state === "ok") srcs.push({ x: special.mall.x, y: special.mall.y, kind: "mall" });
  for (const d of depots) srcs.push({ x: d.x, y: d.y, kind: "depot" });
  for (const c of camps) if (c !== from && c.food > 60) srcs.push({ x: c.x, y: c.y + c.r + 6, kind: "camp", c });
  for (const f of factions) if (f.kind === "commune") { const hb = buildings[f.hq]; if (hb && hb !== from && hb.door && (hb.food || 0) > 60) srcs.push({ x: hb.door[0], y: hb.door[1], kind: "depot" }); }
  let best = null, bd = 1e9; for (const s of srcs) { const d = Math.hypot(s.x - x, s.y - y); if (d < bd) { bd = d; best = s; } }
  return best;
}
function sendForager(a, home) {
  const src = foodSource(a.x, a.y, home); if (!src) return false;
  a.forage = { src, home, stage: 0 }; a.inCamp = null; a.campGoal = null;
  if (a.hidden) leaveShelter(a, false);
  logT("forage", `${a.name} отправляется на вылазку за припасами`, "", 20); return true;
}
// еда в укрытиях: кончилась — голод, вылазки, бунт
function stepFood(dt) {
  for (const b of buildings) {
    if (!b.occ || !b.occ.length) { b.hungryT = 0; continue; }
    if (b.food === undefined) b.food = b.cap * 1.2;
    b.food -= b.occ.length * dt / 60 * (settings.noWater ? 1.6 : 1);
    if (b.food > 0) { b.hungryT = 0; continue; }
    b.food = 0; b.hungryT = (b.hungryT || 0) + dt;
    for (const o of b.occ) o.hp = Math.max(1, o.hp - dt * .15);
    if (b.hungryT > 30 && Math.random() < dt * .06) { const f = b.occ.find(o => !o.forage && o.role === "civ" && o.age !== "kid"); if (f) sendForager(f, b); }
    if (b.hungryT > 180 && Math.random() < dt * .1) { logE("Бунт в укрытии: голодные люди выходят на улицу", "bad"); for (const o of b.occ.slice()) { leaveShelter(o, true); o.panic = .9; } b.hungryT = 0; b.food = 10; }
  }
}
function stepDrops(dt) {
  for (const d of drops) {
    d.t -= dt;
    if (d.t <= 0 && !d.done) {
      d.done = true; let fed = 0;
      for (const b of buildings) if (b.occ && b.occ.length && Math.hypot((b.x0 + b.x1) / 2 - d.x, (b.y0 + b.y1) / 2 - d.y) < 170) { b.food = (b.food || 0) + 80; fed++; }
      for (const c of camps) if (Math.hypot(c.x - d.x, c.y - d.y) < 170) { c.food += 160; fed++; }
      logE(fed ? `Припасы сброшены: еду получили ${fed} укрытий` : "Припасы сброшены, но рядом никто не прячется", fed ? "good" : "");
      sfx.crash({ x: d.x, y: d.y }); fxDebris(d.x, d.y);
    }
  }
  drops = drops.filter(d => !d.done || d.t > -20);
}
function callDrop(x, y) { drops.push({ x, y, t: 4, T: 4 }); logE("Самолёт сбрасывает припасы на парашюте", "good"); sfx.jet(); }
function hungryCount() { let n = 0; for (const b of buildings) if (b.occ && b.occ.length && b.food === 0) n += b.occ.length; for (const c of camps) if (c.food <= 0) n += c.n; return n; }

/* ---------- авария на подстанции: ночью гаснет свет ---------- */
let blackout = null;
function startBlackout(t = 240) { blackout = { t, T: t }; settings.dark = true; logE("Авария на подстанции: город остался без света. Фонари и окна погасли, видно только у прожекторов", "bad"); radio("Диспетчер: обесточен весь город, ремонтные бригады выехали"); sfx.radio(); }
function stepBlackout(dt) {
  if (!blackout) { if (settings.night && (lastCounts || counts()).Z > 50 && !firsts.blackoutDone && Math.random() < dt * .012) { firsts.blackoutDone = true; startBlackout(); } return; }
  let workers = 0; for (const a of agents) if (a.state === "alive" && a.role === "worker") workers++;
  blackout.t -= dt * (1 + Math.min(3, workers) * .5);
  if (blackout.t <= 0) { blackout = null; settings.dark = false; logE("Электроснабжение восстановлено", "good"); radio("Диспетчер: свет дали"); }
}
function stepBuild(dt) { stepSquads(dt); stepCamps(dt); stepFood(dt); stepDrops(dt); stepBlackout(dt); }
function resetBuild() { selected = []; orderMark = null; towers = []; floods = []; camps = []; drops = []; blackout = null; settings.dark = false; }
