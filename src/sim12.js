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
function stepSelection() { if (selected.length && selected.some(a => !isFighter(a))) selected = selected.filter(isFighter); }

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
const CAMP_TENTS = [[-20, 6, .2], [20, 8, -.3], [-8, -22, 1.4], [16, -16, 1.9], [-26, -10, .6]];
function addCamp(x, y) {
  const R = 46;
  if (x < R + 10 || y < R + 10 || x > W - R - 10 || y > H - R - 10) return false;
  const c = { x, y, r: R, food: 240, hungryT: 0, gate: [x, y + R], n: 0 };
  const put = (px, py, hp, wall) => { const gx = Math.floor(px / CS), gy = Math.floor(py / CS); if (gx < 0 || gy < 0 || gx >= GW || gy >= GH) return; const i = gy * GW + gx, cell = grid[i]; if (cell === 3 || cell === 9 || cell === 5 || cell === 10) return; grid[i] = 6; bhp[i] = hp; wallMask[i] = wall ? 1 : 0; };
  for (let t = -R; t <= R; t += CS) { const gate = Math.abs(t) < 12; put(x + t, y - R, 220, true); if (!gate) put(x + t, y + R, 220, true); put(x - R, y + t, 220, true); put(x + R, y + t, 220, true); } // ворота открыты: их держат солдаты
  for (const [tx, ty, rot] of CAMP_TENTS) { const along = Math.abs(Math.sin(rot)) < .7; blockFree(x + tx - (along ? 6 : 4), y + ty - (along ? 4 : 6), x + tx + (along ? 6 : 4), y + ty + (along ? 4 : 6)); }
  blockFree(x + 7, y + 23, x + 11, y + 27); blockFree(x - 15, y + 21, x - 10, y + 23); // бочки с водой и ящики
  for (const sx of [-1, 1]) blockFree(x + sx * 17 - 4, y + R - 5, x + sx * 17 + 4, y + R - 2); // мешки у ворот
  camps.push(c); barrDirty = true; fieldT = 0;
  floods.push({ x, y: y - 10, on: true }); depots.push({ x: x + 22, y: y - 22, ammo: 300, max: 300 });
  sendPosts("army", x, y + R + 16, [0, 1, 2, 3].map(i => freeNear(x + (i % 2 ? 26 : -26), y + (i < 2 ? 26 : -26), 6)), { crewN: 4 });
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

/* ---------- электросеть по кварталам: ТЭЦ → подстанции районов → кварталы ----------
   У каждого квартала (blocks) свой ввод; клетки дорог отнесены к ближайшему кварталу (pwCell), поэтому «есть ли свет здесь» —
   это свет квартала: фонари, окна и вывески (render7.js), светофоры и старшинство на перекрёстках (traffic.js).
   Отключение и включение идут волной от источника к окраинам: у квартала свой срок переключения (pwSw), до него всё по-старому.
   Авария или удар по ТЭЦ гасит город за 20–40 с, удар по подстанции — только её район; генератор держит свет в своём квартале. */
let blackout = null, pwLoad = null;
let pwBlocks = null, pwCell = null, pwGrid = null, pwWant = null, pwSw = null, pwOn = null, pwGen = null, pwSubOf = null, pwSubs = [], pwPlant = false, pwOffK = 0, pwStepB = null;
const SUB_KINDS = new Set(["warehouse", "hangar", "garages", "container", "autoservice", "barn", "storage", "carwash", "bakery"]), SUB_NO = new Set(["monument", "ferris", "tvtower", "stadium", "church", "wtower", "gas", "barracks", "basehq", "kinder", "school", "cafe",
  "theater", "library", "townhall", "clocktower", "clinic", "pool", "gym", "elevator", "mansion"]);
function pwReady() { if (pwBlocks !== blocks || !pwCell || pwCell.length !== GW * GH) pwBuild(); return blocks.length > 0; }
function pwBlockAt(x, y) { if (!pwReady()) return -1; const gx = Math.floor(x / CS), gy = Math.floor(y / CS); return pwCell[(gy < 0 ? 0 : gy >= GH ? GH - 1 : gy) * GW + (gx < 0 ? 0 : gx >= GW ? GW - 1 : gx)]; }
function powerAt(x, y) { const b = pwBlockAt(x, y); return b < 0 || pwOn[b] === 1; }
function sigOn(n) { return !!n.sig && powerAt(n.x, n.y); } // светофор горит, только если в его квартале есть свет; иначе — старшинство
function pwBuild() {
  pwBlocks = blocks; const nb = blocks.length, L = pwLoad; pwLoad = null;
  pwCells();
  pwGrid = new Uint8Array(nb).fill(1); pwWant = new Uint8Array(nb).fill(1); pwOn = new Uint8Array(nb).fill(1); pwGen = new Uint8Array(nb); pwSw = new Float64Array(nb).fill(-1);
  pwSubs = L && L.subs ? L.subs.map(i => buildings[i]).filter(Boolean).map(b => ({ b, x: (b.x0 + b.x1) / 2, y: (b.y0 + b.y1) / 2, down: b.state !== "ok" })) : [];
  pwPlant = false;
  if (L && L.grid && L.grid.length === nb) { for (let i = 0; i < nb; i++) { pwGrid[i] = L.grid[i]; pwWant[i] = L.want[i]; pwSw[i] = L.sw[i] < 0 ? -1 : simT + L.sw[i]; } pwPlant = !!L.plant; }
  pwSubsAssign(); pwOnUpdate();
}
// клетка → квартал; клетки дорог — ближайшему кварталу (волна сразу от всех кварталов)
function pwCells() {
  const N = GW * GH, nb = blocks.length; pwCell = new Int16Array(N).fill(-1);
  const q = new Int32Array(N); let h = 0, t = 0;
  for (let i = 0; i < N; i++) { const r = regionOf[i]; if (r >= 0 && r < nb) { pwCell[i] = r; q[t++] = i; } }
  while (h < t) {
    const i = q[h++], x = i % GW, r = pwCell[i];
    if (x > 0 && pwCell[i - 1] < 0) { pwCell[i - 1] = r; q[t++] = i - 1; } if (x < GW - 1 && pwCell[i + 1] < 0) { pwCell[i + 1] = r; q[t++] = i + 1; }
    if (i >= GW && pwCell[i - GW] < 0) { pwCell[i - GW] = r; q[t++] = i - GW; } if (i + GW < N && pwCell[i + GW] < 0) { pwCell[i + GW] = r; q[t++] = i + GW; }
  }
}
function pwSubsAssign() {
  pwSubOf = new Int8Array(blocks.length).fill(-1);
  blocks.forEach((k, i) => { let best = 1e18; pwSubs.forEach((s, j) => { const d = (s.x - k.cx) ** 2 + (s.y - k.cy) ** 2; if (d < best) { best = d; pwSubOf[i] = j; } }); });
  for (const s of pwSubs) s.b.sub = true;
}
// подстанции: город делится на районы (k-средних по центрам кварталов), в каждом районе подстанция — склад, гаражи или ангар
// поближе к его середине (если таких нет — нежилое здание, в крайнем случае любое)
function pwPlaceSubs() {
  const city = blocks.filter(b => !b.rural && b.n > 4); if (!city.length) return [];
  let sx = 0, sy = 0, sn = 0; for (const b of city) { sx += b.cx * b.n; sy += b.cy * b.n; sn += b.n; } sx /= sn; sy /= sn;
  let r = 0; for (const b of city) r += Math.hypot(b.cx - sx, b.cy - sy) * b.n; r /= sn;
  const k = Math.min(city.length, mapSize === "big" ? 6 : 4), C = [], near = (x, y) => { let bj = 0, bd = 1e18; C.forEach((c, j) => { const d = (c[0] - x) ** 2 + (c[1] - y) ** 2; if (d < bd) { bd = d; bj = j; } }); return bj; };
  for (let j = 0; j < k; j++) { const a = j / k * TAU + .4; C.push([sx + Math.cos(a) * r, sy + Math.sin(a) * r]); }
  for (let it = 0; it < 8; it++) {
    const S = C.map(() => [0, 0, 0]);
    for (const b of city) { const j = near(b.cx, b.cy); S[j][0] += b.cx * b.n; S[j][1] += b.cy * b.n; S[j][2] += b.n; }
    S.forEach((s, j) => { if (s[2]) C[j] = [s[0] / s[2], s[1] / s[2]]; });
  }
  const spec = new Set(Object.values(special).map(s => s.b)), best = C.map(() => [null, 1e18]);
  for (const b of buildings) {
    if (spec.has(b) || b.sub || b.state !== "ok" || SUB_NO.has(b.kind)) continue;
    const x = (b.x0 + b.x1) / 2, y = (b.y0 + b.y1) / 2, bk = blockAt(x, y); if (!bk || bk.rural) continue;
    const j = near(x, y), d = Math.hypot(x - C[j][0], y - C[j][1]) + (SUB_KINDS.has(b.kind) ? 0 : HOME_KINDS.has(b.kind) ? 2500 : 1200);
    if (d < best[j][1]) best[j] = [b, d];
  }
  return best.filter(([b]) => b).map(([b]) => ({ b, x: (b.x0 + b.x1) / 2, y: (b.y0 + b.y1) / 2, down: false }));
}
// волна: источник и за сколько секунд она доходит до самого дальнего квартала (своего района, если это подстанция)
function pwWave(x, y, sub, T) { let dmax = 1; blocks.forEach((b, i) => { if (sub < 0 ? !b.rural : pwSubOf[i] === sub) dmax = Math.max(dmax, Math.hypot(b.cx - x, b.cy - y)); }); return { x, y, T, dmax }; }
function pwDelay(ev, b) { return ev.T * Math.min(1, Math.hypot(b.cx - ev.x, b.cy - ev.y) / ev.dmax) + rnd(0, 1.5); }
function pwOnUpdate() {
  let off = 0, n = 0;
  for (let i = 0; i < pwOn.length; i++) { const on = pwGrid[i] || pwGen[i] ? 1 : 0; pwOn[i] = on; if (!blocks[i].rural) { n++; if (!on) off++; } }
  pwOffK = n ? off / n : 0; settings.dark = pwOffK > .5; // settings.dark — «город по большей части без света»: для подписей и старых проверок
}
function startBlackout(t = 240) { blackout = { t, T: t }; logE("Авария на ТЭЦ: свет гаснет квартал за кварталом. Видно только у прожекторов и генераторов", "bad"); radio("Диспетчер: авария на ТЭЦ, город обесточивается, ремонтные бригады выехали"); sfx.radio(); }
function stepPower(dt) {
  if (!pwReady()) return;
  // первый шаг в этом городе: город достроен — карта кварталов заново, подстанции по районам (у загруженной игры — свои)
  if (pwStepB !== blocks) { pwStepB = blocks; pwCells(); if (!pwSubs.length) pwSubs = pwPlaceSubs(); pwSubsAssign(); }
  // авария ночью при большой эпидемии — одна за игру; с рабочими в городе чинят быстрее
  if (!blackout) { if (settings.night && (lastCounts || counts()).Z > 50 && !firsts.blackoutDone && Math.random() < dt * .012) { firsts.blackoutDone = true; startBlackout(); } }
  else {
    let workers = 0; for (const a of agents) if (a.state === "alive" && a.role === "worker") workers++;
    blackout.t -= dt * (1 + Math.min(3, workers) * .5);
    if (blackout.t <= 0) { blackout = null; logE("Аварию на ТЭЦ устранили: свет дают квартал за кварталом", "good"); radio("Диспетчер: подаём напряжение, район за районом"); }
  }
  const pl = special.power, plant = !!blackout || (!!pl && !infraOk("power")), ox = pl ? pl.x : W / 2, oy = pl ? pl.y : H / 2;
  let plantEv = null, fb = null;
  if (plant !== pwPlant) { pwPlant = plant; plantEv = pwWave(ox, oy, -1, rnd(20, 40)); }
  const subEv = pwSubs.map((s, j) => {
    const d = s.b.state !== "ok"; if (d === s.down) return null; s.down = d;
    logE(d ? "Разрушена подстанция: её район обесточен, пока её не отстроят" : "Подстанцию отстроили: в район снова дают свет", d ? "bad" : "good");
    return pwWave(s.x, s.y, j, rnd(5, 12));
  });
  for (let i = 0; i < pwWant.length; i++) {
    const sj = pwSubOf[i], want = plant || (sj >= 0 && pwSubs[sj] && pwSubs[sj].down) ? 0 : 1;
    if (want !== pwWant[i]) { pwWant[i] = want; const ev = plantEv || (sj >= 0 && subEv[sj]) || (fb = fb || pwWave(ox, oy, -1, 20)); pwSw[i] = simT + pwDelay(ev, blocks[i]); }
    if (pwSw[i] >= 0 && simT >= pwSw[i]) { pwSw[i] = -1; pwGrid[i] = pwWant[i]; }
  }
  pwGen.fill(0); for (const g of gens) if (g.fuel > 0) { const b = pwBlockAt(g.x, g.y); if (b >= 0) pwGen[b] = 1; }
  pwOnUpdate();
}
function pwSave() { if (!pwReady()) return null; return { subs: pwSubs.map(s => buildings.indexOf(s.b)), grid: Array.from(pwGrid), want: Array.from(pwWant), sw: Array.from(pwSw, t => t < 0 ? -1 : +(t - simT).toFixed(2)), plant: pwPlant }; }
function stepBuild(dt) { stepSelection(); stepCamps(dt); stepFood(dt); stepDrops(dt); stepPower(dt); }
function resetBuild() { selected = []; orderMark = null; towers = []; floods = []; camps = []; drops = []; blackout = null; pwBlocks = null; pwStepB = null; pwLoad = null; settings.dark = false; }
