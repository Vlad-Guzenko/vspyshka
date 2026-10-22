/* ---------- сооружения занимают клетки: люди и зомби обходят палатки, будки, ящики ---------- */
function blockFree(x0, y0, x1, y1) {
  const out = [];
  for (let gy = Math.floor(y0 / CS); gy <= Math.floor(y1 / CS); gy++) for (let gx = Math.floor(x0 / CS); gx <= Math.floor(x1 / CS); gx++) {
    if (gx < 0 || gy < 0 || gx >= GW || gy >= GH) continue; const i = gy * GW + gx, c = grid[i];
    if (c === 0 || c === 1 || c === 2 || c === 7 || c === 8) { out.push([i, c]); grid[i] = 5; }
  }
  evictRect(x0, y0, x1, y1); fieldT = 0; return out;
}
// кто стоял там, где теперь препятствие, выходит на свободное место
function evictRect(x0, y0, x1, y1) {
  near((x0 + x1) / 2, (y0 + y1) / 2, Math.hypot(x1 - x0, y1 - y0) / 2 + 4, a => {
    if (a.state !== "alive" || a.hidden || a.x < x0 || a.x > x1 || a.y < y0 || a.y > y1) return;
    const [fx, fy] = freeNear(a.x, a.y, 14); a.x = fx; a.y = fy;
  });
}
function unblock(cells) { for (const [i, c] of cells) if (grid[i] === 5) grid[i] = c; fieldT = 0; }
/* ---------- ловушки: мины, растяжки, бочки, электрозабор с генератором ---------- */
let traps = [], gens = [];
const elecMask = new Uint8Array(GW * GH);
function addMine(x, y) { if (blocked(x, y)) return false; traps.push({ k: "mine", x, y, arm: 2 }); logT("mine", "Установлена мина", "", 10); return true; }
function addWire(x0, y0, x1, y1) { const L = Math.hypot(x1 - x0, y1 - y0); if (L < 6) return false; traps.push({ k: "wire", x: x0, y: y0, x2: x1, y2: y1, arm: 2 }); logT("wire", "Поставлена растяжка", "", 10); return true; }
function addBarrels(x, y) { for (let i = 0; i < 3; i++) { const [bx, by] = freeNear(x + rnd(-4, 4), y + rnd(-4, 4), 4); traps.push({ k: "barrel", x: bx, y: by, fuse: -1 }); fillCells(bx - 1, by - 1, bx + 1, by + 1, 5); evictRect(bx - 4, by - 4, bx + 4, by + 4); } fieldT = 0; logT("barrel", "Выставлены бочки с бензином", "", 10); return true; }
function addGen(x, y) { const [gx, gy] = freeNear(x, y, 6); gens.push({ x: gx, y: gy, fuel: 300, max: 300 }); fillCells(gx - 2, gy - 2, gx + 2, gy + 2, 5); evictRect(gx - 6, gy - 6, gx + 6, gy + 6); fieldT = 0; logE("Запущен генератор: электрозабор в радиусе 30 м под током, топлива на 5 минут", "good"); return true; }
function powered(x, y) { for (const g of gens) if (g.fuel > 0 && Math.hypot(g.x - x, g.y - y) < 120) return true; return false; }
function trapBlast(x, y, R) { for (const t of traps) if (t.k === "barrel" && t.fuse < 0 && Math.hypot(t.x - x, t.y - y) < R * 1.3) t.fuse = rnd(.15, .5); }
function blowBarrel(t) {
  t.done = true; fillCells(t.x - 1, t.y - 1, t.x + 1, t.y + 1, 0);
  boom(t.x, t.y, 30, false); fires.push({ x: t.x, y: t.y, r: 9, l: 25 });
  for (const o of traps) if (o.k === "barrel" && !o.done && o.fuse < 0 && Math.hypot(o.x - t.x, o.y - t.y) < 26) o.fuse = rnd(.2, .6);
  logT("barrelboom", "Взорвалась бочка с бензином", "bad", 3);
}
function stepTraps(dt) {
  let fenceOn = false;
  for (const g of gens) if (g.fuel > 0) { g.fuel -= dt; fenceOn = true; if (g.fuel <= 0) logE("Генератор заглох: топливо кончилось, забор обесточен", "bad"); }
  for (const t of traps) {
    if (t.done) continue;
    if (t.arm > 0) { t.arm -= dt; continue; }
    if (t.k === "mine") {
      let hit = null; near(t.x, t.y, 4.5, a => { if (!hit && a.state === "alive" && !a.hidden && !a.post && Math.hypot(a.x - t.x, a.y - t.y) < 4) hit = a; });
      if (hit) { t.done = true; boom(t.x, t.y, 20, false); logT("mineboom", hit.role === "zombie" ? "Зомби подорвался на мине" : "На мине подорвался человек", hit.role === "zombie" ? "good" : "bad", 4); }
    } else if (t.k === "wire") {
      const mx = (t.x + t.x2) / 2, my = (t.y + t.y2) / 2, L = Math.hypot(t.x2 - t.x, t.y2 - t.y), ux = (t.x2 - t.x) / L, uy = (t.y2 - t.y) / L;
      let hit = null;
      near(mx, my, L / 2 + 4, a => { if (hit || a.state !== "alive" || a.hidden || a.post) return; const px = a.x - t.x, py = a.y - t.y, al = px * ux + py * uy, pe = Math.abs(px * uy - py * ux); if (al > 0 && al < L && pe < 1.6) hit = a; });
      if (hit) { t.done = true; boom(hit.x, hit.y, 14, false); logT("wireboom", "Сработала растяжка", "", 4); }
    } else if (t.k === "barrel") {
      if (t.fuse >= 0) { t.fuse -= dt; if (t.fuse <= 0) blowBarrel(t); continue; }
      for (const f of fires) if (Math.hypot(f.x - t.x, f.y - t.y) < f.r + 5) { t.fuse = rnd(.6, 1.6); break; }
      if (t.fuse < 0) for (const c of cars) if (c.burnT > 0 && !c.gone && Math.hypot(c.x - t.x, c.y - t.y) < 12) { t.fuse = rnd(.8, 2); break; }
      if (t.fuse < 0 && Math.random() < dt * .5) { let burning = false; near(t.x, t.y, 6, a => { if (a.onFire > 0) burning = true; }); if (burning) t.fuse = 1; }
    }
  }
  traps = traps.filter(t => !t.done);
}
// зомби у забора под током: бьёт и отбрасывает
function zapZombie(a, gi, dt) {
  const gx = gi % GW, gy = (gi / GW) | 0;
  if (!elecMask[gi] || !powered(gx * CS + 4, gy * CS + 4)) return false;
  a.zhp -= dt * 2.5 * (a.ztype === "titan" ? .1 : 1); a.vx -= Math.cos(a.dir) * 18; a.vy -= Math.sin(a.dir) * 18; a.zapT = .3;
  if (a.zhp <= 0) { destroyZombie(a, true); logT("zap", "Зомби сгорел на электрозаборе", "good", 10); }
  return true;
}

/* ---------- инфраструктура: электростанция, водонасосная, радиовышка ---------- */
const INFRA = { power: "электростанция", water: "водонасосная станция", radio: "радиовышка" };
function infraOk(k) { const s = special[k]; return !!(s && s.b && s.b.state === "ok"); }
function stepInfra(dt) {
  for (const k in INFRA) {
    const s = special[k]; if (!s) continue; const b = s.b;
    if (b.state !== "ok" && !s.down) { s.down = true; logE(`Выведена из строя ${INFRA[k]}` + (k === "power" ? ": город без света, пока её не отстроят" : k === "water" ? ": пожарным нечем тушить, в убежищах нет воды" : ": диспетчер не слышит вызовы, оповещения не работают"), "bad"); radio(k === "radio" ? "…связи нет…" : `Диспетчер: потеряна ${INFRA[k]}`); }
    if (b.state === "ok" && s.down) { s.down = false; logE(`Восстановлена ${INFRA[k]}`, "good"); }
    if (b.fire > 0 && !s.fireLogged) { s.fireLogged = true; logE(`Пожар: горит ${INFRA[k]}`, "bad"); }
    if (b.fire <= 0) s.fireLogged = false;
  }
  settings.noWater = special.water ? !infraOk("water") : false;
  settings.noRadio = special.radio ? !infraOk("radio") : false;
  if (special.power) { const down = !infraOk("power"); if (down && !blackout) { blackout = { t: 1e9, T: 1e9, infra: true }; settings.dark = true; } if (!down && blackout && blackout.infra) { blackout = null; settings.dark = false; logE("Свет дали", "good"); } }
}

/* ---------- оповещения и слухи ---------- */
let dangers = [];
function broadcastGather(x, y) {
  if (settings.noRadio) { logT("noradio", "Оповещение невозможно: радиовышка разрушена", "bad", 10); return false; }
  let n = 0; near(x, y, 260, a => { if (a.state === "alive" && a.role === "civ" && !a.hidden && !a.forage && !a.post) { a.dest = [x + rnd(-10, 10), y + rnd(-10, 10)]; a.bcastT = 90; a.panic = Math.min(a.panic, .25); a.homeGoal = false; a.hideGoal = null; n++; } });
  logE(`Оповещение: «Всем собраться ${placeName(x, y)}». Услышали ${n} человек`, "good"); sfx.radio(); return true;
}
function broadcastDanger(x, y) {
  if (settings.noRadio) { logT("noradio", "Оповещение невозможно: радиовышка разрушена", "bad", 10); return false; }
  addDanger(x, y, 160, 120); let n = 0;
  near(x, y, 230, a => { if (a.state === "alive" && a.role === "civ" && !a.hidden) { a.panic = Math.max(a.panic, .7); a.dest = null; a.bcastT = 0; n++; } });
  logE(`Слух: «${placeName(x, y)} опасно, уходите». Поверили ${n} человек`, ""); sfx.radio(); return true;
}
function broadcastHome() {
  if (settings.noRadio) { logT("noradio", "Оповещение невозможно: радиовышка разрушена", "bad", 10); return false; }
  let n = 0; for (const a of agents) if (a.state === "alive" && a.role === "civ" && !a.hidden && !a.forage && a.home >= 0) { a.homeGoal = true; a.dest = null; n++; }
  logE(`Радио: «Всем оставаться дома». Домой пошли ${n} человек`, "good"); sfx.radio(); return true;
}
// новая зона: если рядом уже есть похожая — расширяем её, иначе добавляем; список не разрастается
function addDanger(x, y, r, t) {
  for (const d of dangers) if (Math.hypot(d.x - x, d.y - y) < Math.max(r, d.r) * .6) { d.r = Math.max(d.r, r); d.t = Math.max(d.t, t); return d; }
  const d = { x, y, r, t }; dangers.push(d); if (dangers.length > 60) dangers.shift(); return d;
}
function stepDangers(dt) { for (const d of dangers) d.t -= dt; dangers = dangers.filter(d => d.t > 0); }
function inDanger(a) { for (const d of dangers) if (Math.hypot(d.x - a.x, d.y - a.y) < d.r) return d; return null; }

/* ---------- КПП: проверка на укусы, очередь, изолятор, бунт ---------- */
let cps = [];
function addCheckpoint(x, y) {
  // ближайшая улица: барьер поперёк неё с проходом посередине
  let best = null, bd = 90;
  for (const s of streets) { if (s.gone || s.edge) continue; const lat = s.v ? x : y, along = s.v ? y : x; if (along < s.a0 + 20 || along > s.a1 - 20) continue; const d = Math.abs(lat - s.p); if (d < bd) { bd = d; best = s; } }
  if (!best) return false;
  const s = best, cx = s.v ? s.p : x, cy = s.v ? y : s.p, cells = [];
  for (let o = -s.hw - 8; o <= s.hw + 8; o += CS) {
    if (Math.abs(o) < 7) continue;
    const px = s.v ? cx + o : cx, py = s.v ? cy : cy + o, gx = Math.floor(px / CS), gy = Math.floor(py / CS);
    if (gx < 0 || gy < 0 || gx >= GW || gy >= GH) continue; const i = gy * GW + gx, c = grid[i];
    if (c === 3 || c === 9 || c === 5) continue; grid[i] = 6; bhp[i] = 120; wallMask[i] = 1; cells.push(i);
  }
  const cp = { x: cx, y: cy, v: s.v, cells, queue: 0, queueT: 0, detained: 0, checked: 0, broken: false, tent: s.v ? [cx + s.hw + 12, cy + 10] : [cx + 10, cy + s.hw + 12] };
  for (let i = 0; i < 2; i++) { const [gx, gy] = freeNear(s.v ? cx + (i ? 10 : -10) : cx, s.v ? cy : cy + (i ? 10 : -10), 5); const g = newAgent("police", gx, gy); g.order = { x: gx, y: gy }; g.cp = cp; }
  // будка справа от проезда, изолятор: клетки заняты
  const bx = s.v ? cx + 9.5 : cx + 3, by = s.v ? cy + 3 : cy - 9.5;
  cp.cells2 = blockFree(bx - 2, by - 2, bx + 2, by + 2).concat(blockFree(cp.tent[0] - 7, cp.tent[1] - 7, cp.tent[0] + 7, cp.tent[1] + 7));
  cps.push(cp); barrDirty = true; fieldT = 0;
  logE("Развёрнут КПП: полиция проверяет проходящих на укусы, заражённых отправляют в изолятор", "good"); return true;
}
function stepCheckpoints(dt) {
  for (const cp of cps) {
    if (cp.broken) continue;
    let waiting = 0;
    near(cp.x, cp.y, 16, a => {
      if (a.state !== "alive" || a.role !== "civ" || a.hidden) return;
      const lat = cp.v ? a.x - cp.x : a.y - cp.y, along = cp.v ? a.y - cp.y : a.x - cp.x;
      if (Math.abs(lat) > 8 || Math.abs(along) > 14) return;
      if (a.cpChecked === cp) return;
      if (a.cpWait > 0) { waiting++; return; }
      if (a.cpWait === 0 && a.cpAt !== cp) { a.cpWait = 2; a.cpAt = cp; waiting++; return; }
      if (a.cpWait < 0 && a.cpAt === cp) {
        // проверка окончена
        a.cpChecked = cp; a.cpWait = 0; cp.checked++;
        if (a.bitten && !a.immune && Math.random() < .85) { a.hidden = true; a.detained = cp; a.x = cp.tent[0]; a.y = cp.tent[1]; a.vx = a.vy = 0; cp.detained++; logT("cpdet", `КПП: выявлен укушенный, ${a.name} отправлен${a.sex === "f" ? "а" : ""} в изолятор`, "good", 8); }
        else if (a.bitten) logT("cpmiss", "КПП: укушенный скрыл рану и прошёл", "bad", 20);
      }
    });
    cp.queue = waiting;
    cp.queueT = waiting > 10 ? cp.queueT + dt : 0;
    if (cp.queueT > 40) {
      cp.broken = true; for (const i of cp.cells) { grid[i] = 0; wallMask[i] = 0; } barrDirty = true; fieldT = 0;
      near(cp.x, cp.y, 40, a => { if (a.state === "alive" && a.role === "civ") { a.panic = 1; a.cpWait = 0; } });
      logE("Бунт на КПП: толпа снесла барьер", "bad"); interest(cp.x, cp.y, 6);
    }
  }
  // изолятор: укушенный обращается внутри — зомби выходит наружу
  for (const a of agents) if (a.detained && a.hidden && a.role === "zombie") { a.hidden = false; a.detained = null; const [x, y] = freeNear(a.x, a.y, 8); a.x = x; a.y = y; logE("В изоляторе КПП кто-то обратился: зомби вырвался наружу", "bad"); }
}

/* ---------- фракции выживших: коммуна и банда ---------- */
let factions = [], factionT = 0;
const FKIND = { commune: { n: "Коммуна", col: "#f2b33d" }, gang: { n: "Банда", col: "#8a2a2a" } };
function factionOf(a) { return a.faction ? factions.find(f => f.id === a.faction) : null; }
function formCommune() {
  const leader = heroes.find(h => h.hero === "leader" && h.state === "alive" && h.role !== "zombie" && !h.hidden) || agents.find(a => a.state === "alive" && a.role === "civ" && !a.hidden && !a.age && !a.faction);
  if (!leader) return;
  let hq = null, bd = 1e9;
  for (const b of buildings) { if (!b.door || b.state !== "ok" || (b.kind !== "warehouse" && b.kind !== "mall" && !(b.kind === "apt" && b.floors >= 5))) continue; const d = Math.hypot(b.door[0] - leader.x, b.door[1] - leader.y); if (d < bd) { bd = d; hq = b; } }
  if (!hq) return;
  const f = { id: factions.length + 1, kind: "commune", leader: leader.id, members: [], hq: buildings.indexOf(hq), food: 120, raids: 0, rel: 0, born: simT };
  factions.push(f); joinFaction(leader, f); leader.hero = leader.hero || "leader"; leader.name = leader.name;
  near(leader.x, leader.y, 130, a => { if (f.members.length < 12 && a.state === "alive" && a.role === "civ" && !a.hidden && !a.faction && !a.age) joinFaction(a, f); });
  hq.food = (hq.food || 0) + 120;
  logE(`${leader.name} собирает людей: образовалась коммуна, штаб ${placeName(hq.door[0], hq.door[1])}`, "good"); radio(`Разведка: группа выживших укрепилась ${placeName(hq.door[0], hq.door[1])}`); sfx.radio();
}
function joinFaction(a, f) {
  a.faction = f.id; f.members.push(a.id); a.vest = FKIND[f.kind].col; a.panic = Math.min(a.panic, .3); a.homeGoal = false; a.campGoal = null;
  if (f.kind === "commune" && !a.armed && Math.random() < .4) arm(a, 8, 16);
}
function stepFactions(dt) {
  factionT -= dt; if (factionT > 0) return; factionT = 4;
  const c = lastCounts || counts();
  if (!factions.some(f => f.kind === "commune") && firsts.zombie && simT - (firsts.zombieT || 0) > 90 && c.Z > 8 && Math.random() < .35) formCommune();
  for (const f of factions) {
    f.members = f.members.filter(id => { const m = agentById(id); return m && m.state === "alive" && m.role !== "zombie" && m.faction === f.id; });
    if (f.kind !== "commune") continue;
    const hq = buildings[f.hq], L = agentById(f.leader);
    if (!L || L.state !== "alive" || L.role === "zombie") { logE("Лидер коммуны погиб: группа распалась", "bad"); for (const id of f.members) { const m = agentById(id); if (m) { m.faction = 0; m.vest = null; } } f.dead = true; continue; }
    if (!hq || hq.state !== "ok") { logE("Штаб коммуны разрушен: группа уходит", "bad"); for (const id of f.members) { const m = agentById(id); if (m) { m.faction = 0; m.vest = null; } } f.dead = true; continue; }
    // вербовка спокойных людей рядом со штабом
    if (f.members.length < 40) near(hq.door[0], hq.door[1], 110, a => { if (f.members.length < 40 && a.state === "alive" && a.role === "civ" && !a.hidden && !a.faction && !a.age && Math.random() < .25) joinFaction(a, f); });
    // еда: едят из штаба, при нехватке ходят за припасами
    hq.food = Math.max(0, (hq.food || 0) - f.members.length * 4 / 60);
    if (hq.food < 25) { const forager = f.members.map(agentById).find(m => m && !m.forage && !m.armed); if (forager && Math.random() < .5) sendForager(forager, hq); }
  }
  factions = factions.filter(f => !f.dead);
  // банда: раз в пару минут рейд на коммуну или сытое убежище
  const gang = factions.find(f => f.kind === "gang");
  if (gang && gang.members.length) {
    gang.raidT = (gang.raidT || 100) - 4;
    if (gang.raidT <= 0) {
      gang.raidT = rnd(120, 200);
      const target = factions.find(f => f.kind === "commune") ? buildings[factions.find(f => f.kind === "commune").hq] : buildings.filter(b => b.occ && b.occ.length && (b.food || 0) > 40).sort(() => Math.random() - .5)[0];
      if (target) { for (const id of gang.members) { const m = agentById(id); if (m) { m.loot = target; m.lootT = 0; m.hidden = false; m.hostile = 60; } } logE("Банда идёт на рейд: " + (factions.some(f => f.kind === "commune") ? "цель — штаб коммуны" : "цель — убежище с припасами"), "bad"); radio("Разведка: мародёры выдвинулись колонной"); sfx.radio(); interest(target.door[0], target.door[1], 5); }
    }
  }
}
// мародёры становятся бандой со штабом
function registerGang(members) {
  let gang = factions.find(f => f.kind === "gang");
  if (!gang) { const hq = buildings.filter(b => b.door && (b.kind === "warehouse" || b.kind === "house")).sort(() => Math.random() - .5)[0]; gang = { id: factions.length + 1, kind: "gang", leader: members[0].id, members: [], hq: hq ? buildings.indexOf(hq) : -1, food: 60, raids: 0, rel: -1, born: simT }; factions.push(gang); }
  for (const m of members) { m.faction = gang.id; gang.members.push(m.id); m.vest = FKIND.gang.col; }
}
// снабжение фракции: патроны и еда в штаб
function supplyFaction(f) {
  const hq = buildings[f.hq]; if (!hq) return false;
  hq.food = (hq.food || 0) + 150; let armed = 0;
  for (const id of f.members) { const m = agentById(id); if (!m) continue; if (!m.armed) { arm(m, 8, 24); armed++; } else m.ammo += 24; }
  f.rel = (f.rel || 0) + 1; hqRep(f.kind === "commune" ? 1 : -1, f.kind === "commune" ? "поддержка коммуны" : "сговор с бандой");
  logE(`Сброс снабжения ${FKIND[f.kind].n.toLowerCase()}: еда и патроны, вооружено ещё ${armed}`, "good"); callDrop(hq.door[0], hq.door[1]); return true;
}

/* ---------- штаб: доверие, директивы, награды и наказания ---------- */
let hq = { rep: 0, withdrawnT: 0, nextWave: 0 };
function hqRep(d, why) {
  hq.rep = clamp(hq.rep + d, -5, 5);
  logE(`Доверие штаба ${d > 0 ? "выросло" : "упало"}: ${why}. Сейчас ${hq.rep > 0 ? "+" : ""}${hq.rep}`, d > 0 ? "good" : "bad");
  if (hq.rep >= 2 && d > 0) { radio("Штаб: хорошая работа, высылаем подкрепление"); for (let i = 0; i < 2; i++) spawnService("army", W / 2 + rnd(-200, 200), H / 2 + rnd(-150, 150), null); }
  if (hq.rep >= 4 && d > 0 && !hq.tankGiven) { hq.tankGiven = true; radio("Штаб: передаём вам танк"); const e = edgeLanePoint(); addTank(e.l.s.v ? e.l.c : e.along, e.l.s.v ? e.along : e.l.c); }
  if (hq.rep <= -2 && d < 0) { hq.withdrawnT = 180; radio("Штаб: ваши действия неприемлемы, армия отзывается на 3 минуты"); for (const a of agents) if (a.state === "alive" && a.role === "army" && !a.post) { a.order = { x: a.x < W / 2 ? -40 : W + 40, y: a.y }; a.withdraw = true; } }
}
function stepHQ(dt) {
  if (hq.withdrawnT > 0) { hq.withdrawnT -= dt; if (hq.withdrawnT <= 0) { radio("Штаб: армия возвращается"); for (const a of agents) if (a.withdraw) { a.withdraw = false; a.order = null; } } }
  for (const a of agents) if (a.withdraw && a.state === "alive" && (a.x < 10 || a.x > W - 10)) a.state = "saved";
}
function repStars() { const r = hq.rep; return r > 0 ? "★".repeat(r) + "☆".repeat(5 - r) : r < 0 ? "▼".repeat(-r) + "☆".repeat(5 + r) + ` (${r})` : "☆☆☆☆☆ (0)"; }

/* ---------- санитары: вывозят тела; сутки и разложение ---------- */
function bodyTarget() {
  let best = null, bd = 1e9;
  for (const a of agents) {
    if (a.state !== "dead" || (a.sanitAssigned && simT - a.sanitAssigned < 150) || (a.reanimate && !a.burnt) || a.deadT < 15 || a.z > 0) continue;
    let z = 0; nearZ(a.x, a.y, 70, () => z++); if (z) continue;
    const d = Math.hypot(a.x - W / 2, a.y - H / 2); if (d < bd) { bd = d; best = a; }
  }
  return best;
}
function collectBody(a, by) { a.state = "saved"; a.removed = true; a.hidden = false; if (a.poolId >= 0 && typeof setDecal === "function") setDecal(a.poolId, .01); }
function stepBodies(dt) {
  // разложение и уборка временем, чтобы город не зарастал телами
  for (const a of agents) if (a.state === "dead" && !a.reanimate) { if (a.deadT > 720 && !a.player) collectBody(a, null); }
  // детали на карте: день
  dayN = Math.floor(simT / 720) + 1;
}
let dayN = 1;

function stepWorld2(dt) { stepTraps(dt); stepInfra(dt); stepDangers(dt); stepCheckpoints(dt); stepFactions(dt); stepHQ(dt); stepBodies(dt); }
function resetWorld2() { traps = []; gens = []; elecMask.fill(0); dangers = []; cps = []; factions = []; factionT = 30; hq = { rep: 0, withdrawnT: 0, nextWave: 0 }; dayN = 1; settings.noWater = false; settings.noRadio = false; }
