/* ---------- уличное движение ---------- */
const DX = [1, 0, -1, 0], DY = [0, 1, 0, -1];
const CH = 48, CHW = Math.ceil(W / CH), CHH = Math.ceil(H / CH);
const carHash = Array.from({ length: CHW * CHH }, () => []);
function rebuildCarHash() {
  for (const c of carHash) c.length = 0;
  for (const c of cars) if (!c.gone) carHash[clamp(Math.floor(c.y / CH), 0, CHH - 1) * CHW + clamp(Math.floor(c.x / CH), 0, CHW - 1)].push(c);
  for (const t of tanks) carHash[clamp(Math.floor(t.y / CH), 0, CHH - 1) * CHW + clamp(Math.floor(t.x / CH), 0, CHW - 1)].push(t);
}
function nearCars(x, y, r, fn) {
  const x0 = clamp(Math.floor((x - r) / CH), 0, CHW - 1), x1 = clamp(Math.floor((x + r) / CH), 0, CHW - 1), y0 = clamp(Math.floor((y - r) / CH), 0, CHH - 1), y1 = clamp(Math.floor((y + r) / CH), 0, CHH - 1);
  for (let gy = y0; gy <= y1; gy++) for (let gx = x0; gx <= x1; gx++) for (const c of carHash[gy * CHW + gx]) fn(c);
}
// точка внутри движущейся машины или танка (повёрнутый прямоугольник)
function vehicleAt(x, y) {
  let hit = null;
  nearCars(x, y, 14, c => {
    if (hit || !(c.moving || c.tank)) return;
    const ca = Math.cos(c.ang), sa = Math.sin(c.ang), dx = x - c.x, dy = y - c.y;
    if (Math.abs(dx * ca + dy * sa) < (c.tank ? 13 : 10) && Math.abs(-dx * sa + dy * ca) < (c.tank ? 7 : 4.5)) hit = c;
  });
  return hit;
}
function laneOf(s, dir) { return lanes.find(l => l.s === s && l.dir === dir); }
// занята ли полоса у точки: другая машина ближе 16 ед. вдоль неё
function laneBusy(l, along, self) {
  const px = l.s.v ? l.c : along, py = l.s.v ? along : l.c; let busy = false;
  nearCars(px, py, 20, o => { if (busy || o === self || o.gone || o.tank) return; if (!o.moving && !o.stopped) return; const d = l.s.v ? Math.abs(o.y - py) : Math.abs(o.x - px), lat = l.s.v ? Math.abs(o.x - px) : Math.abs(o.y - py); if (d < 16 && lat < 5) busy = true; });
  return busy;
}
function placeOnLane(c, lane, along) {
  c.lane = lane; c.dir = lane.dir;
  if (lane.s.v) { c.x = lane.c; c.y = along; } else { c.x = along; c.y = lane.c; }
}
let fled = 0;
// сколько машин нужно городу: по суммарной длине полос
function trafficN() { let L = 0; for (const l of lanes) L += Math.max(0, l.a1 - l.a0); for (const cv of curves) L += cv.len * 2; return Math.round(L / 760); }
function nearestEdge(x, y) { const opts = [[x, -40], [x, H + 40], [-40, y], [W + 40, y]]; let best = opts[0], bd = 1e9; for (const o of opts) { const d = Math.hypot(o[0] - x, o[1] - y); if (d < bd) { bd = d; best = o; } } return { x: best[0], y: best[1] }; }
function turnToward(c, g) {
  const gx = g.x - c.x, gy = g.y - c.y, L = Math.hypot(gx, gy) || 1;
  let best = c.dir, bs = (DX[c.dir] * gx + DY[c.dir] * gy) / L;
  for (const nd of [(c.dir + 1) % 4, (c.dir + 3) % 4]) { const s = (DX[nd] * gx + DY[nd] * gy) / L; if (s > bs + .15) { bs = s; best = nd; } }
  return best;
}
function spawnTraffic(n) {
  for (let i = 0; i < n; i++) {
    const lane = pick(lanes);
    const c = { moving: true, col: pick(CARC), wreck: false, boomT: 0, burnT: 0, spd: rnd(28, 44), v: 0, wait: 0, stuck: 0, dmg: 0, horn: 0, tanker: false, bus: false, len: 1, fleeTo: null, curve: null, ct: 0, cdir: 1, jAt: null, unloaded: false, exploded: false, panic: false, alarm: 0, z: 0, vz: 0, vx: 0, vy: 0, roll: 0, sr: 0, sy: 0, stopped: false, gone: false, crushed: false, towedBy: null, service: null, goal: null, lane: null, dir: 0, ang: 0 };
    const r = Math.random();
    if (r < .04) { c.tanker = true; c.len = 1.6; c.col = pick(["#d8d8d4", "#c9c2b0", "#e8e8e2"]); c.spd *= .85; }
    else if (r < .09) { c.bus = true; c.len = 2.1; c.col = pick(["#e0a020", "#3a7a9a", "#c84a2a", "#e8e2d0"]); c.spd *= .8; }
    if (curves.length && Math.random() < .4) { const cv = pick(curves); c.lane = lane; placeOnCurve(c, cv, rnd(10, cv.len - 10), Math.random() < .5 ? 1 : -1); if (blocked(c.x, c.y)) continue; c.v = c.spd * rnd(.5, 1); cars.push(c); continue; }
    placeOnLane(c, lane, rnd(lane.a0 + 30, lane.a1 - 30));
    if (blocked(c.x, c.y) || laneBusy(lane, lane.s.v ? c.y : c.x, c)) continue;
    c.ang = Math.atan2(DY[c.dir], DX[c.dir]); c.v = c.spd * rnd(.5, 1);
    cars.push(c);
  }
}
function abandonCar(c, why) {
  c.moving = false; c.stopped = true; c.v = 0;
  const hw = Math.abs(Math.cos(c.ang)) > .5 ? 9 : 4, hh = hw === 9 ? 4 : 9;
  fillCells(c.x - hw, c.y - hh, c.x + hw, c.y + hh, 5); fieldT = 0;
  if (!c.wreck && why !== "crash") {
    // водитель выскакивает и бежит; из автобуса высыпают пассажиры
    const side = Math.random() < .5 ? 1 : -1, ox = -DY[c.dir] * 8 * side, oy = DX[c.dir] * 8 * side;
    const [x, y] = blocked(c.x + ox, c.y + oy) ? freeNear(c.x, c.y, 16) : [c.x + ox, c.y + oy];
    const d = newAgent("civ", x, y); d.panic = 1; nameFor(d);
    if (c.bus && !c.unloaded) { c.unloaded = true; for (let i = 0; i < 6; i++) { const [px, py] = freeNear(c.x + ox, c.y + oy, 10); const p = newAgent("civ", px, py); p.panic = 1; nameFor(p); } logT("bus", "Пассажиры выбегают из автобуса", "bad", 20); }
  } else if (c.bus && why === "crash" && !c.unloaded) {
    c.unloaded = true; for (let i = 0; i < 5; i++) { const [px, py] = freeNear(c.x, c.y, 12); const p = newAgent("civ", px, py); p.panic = 1; p.hp = rnd(25, 60); p.bleed = 6; nameFor(p); } logT("buscrash", "Автобус разбился: пассажиры ранены", "bad", 20);
  }
  if (why && why !== "crash") logT("abandon", why, "bad", 15);
}
function stepTraffic(dt) {
  for (const c of cars) {
    if (c.alarm > 0) c.alarm -= dt;
    // машина в полёте после взрыва
    if (c.z > 0 || c.vz) {
      c.vz -= 39 * dt; c.z += c.vz * dt; c.x = clamp(c.x + c.vx * dt, 4, W - 4); c.y = clamp(c.y + c.vy * dt, 4, H - 4);
      c.roll += c.sr * dt; c.ang += c.sy * dt;
      if (c.z <= 0) {
        c.z = 0; c.vz = 0; c.sr = 0; c.sy = 0;
        c.roll = Math.round(c.roll / (Math.PI / 2)) * (Math.PI / 2); // ложится на бок или на крышу
        fillCells(c.x - 6, c.y - 6, c.x + 6, c.y + 6, 5); fieldT = 0;
        fxDebris(c.x, c.y); sfx.crash(c);
      }
      continue;
    }
    if (!c.moving) continue;
    if (c.wreck) { abandonCar(c, null); continue; }
    if (c.curve) { stepCurveCar(c, dt); continue; }
    if (junctions.length && tryEnterCurve(c)) continue;
    const dx = DX[c.dir], dy = DY[c.dir];
    // что впереди: машины, люди, препятствия
    let clear = 1e9, people = false, zAhead = false, ahead = null;
    nearCars(c.x + dx * 25, c.y + dy * 25, 32, o => {
      if (o === c || o.gone || o.towedBy || (!o.moving && !o.stopped && !o.tank)) return; // припаркованные у бордюра не мешают
      const al = (o.x - c.x) * dx + (o.y - c.y) * dy, lat = Math.abs((o.x - c.x) * dy - (o.y - c.y) * dx);
      if (al > 0 && lat < 5.5 && al < clear) { clear = al; ahead = o; }
      // поперечный поток на перекрёстке: машина прямо перед носом с другой полосы
      else if (al > 2 && al < 22 && lat < 9 && o.moving && o.v > 2 && al + 6 < clear) { clear = al + 6; }
    });
    // в панике водители не успевают затормозить
    if (c.panic && ahead && clear < 11 && c.v > 16) { carCollide(c, ahead, c.v); continue; }
    if (c.panic) clear += 7;
    clear = Math.min(clear, redAhead(c));
    let zNear = 0;
    near(c.x + dx * 18, c.y + dy * 18, 30, a => {
      if (a.state !== "alive") return;
      const al = (a.x - c.x) * dx + (a.y - c.y) * dy, lat = Math.abs((a.x - c.x) * dy - (a.y - c.y) * dx);
      if (a.role === "zombie" && Math.hypot(a.x - c.x, a.y - c.y) < 30) zNear++;
      if (al > 4 && al < 34 && lat < 5.5) {
        if (a.role === "zombie") zAhead = true; else people = true;
        if (a.role !== "zombie" || !c.panic) { clear = Math.min(clear, al + 2); if (al < 12 && !c.panic) c.v = Math.min(c.v, 2); } // экстренное торможение
      }
    });
    let water = false;
    for (let k = 12; k < 40; k += 6) { const cc = cellAt(c.x + dx * k, c.y + dy * k); if (cc === 9 || cc === 1 || cc === 2 || cc === 7 || (cc === 3 && !c.lane.s.edge && k < 20 && cellAt(c.x + dx * (k + 8), c.y + dy * (k + 8)) === 3)) { water = k < 20; break; } if (cc === 3 || cc === 4 || cc === 6 || cc === 8) { clear = Math.min(clear, k); break; } }
    if (water) { const opp = laneOf(c.lane.s, (c.dir + 2) % 4); if (opp) { placeOnLane(c, opp, c.lane.s.v ? c.y : c.x); c.ang += Math.PI; continue; } }
    if (zNear > 0 && !c.panic && !c.service) { c.panic = true; c.spd *= 1.35; c.fleeTo = nearestEdge(c.x, c.y); }
    if (c.goal) { c.svcT = (c.svcT || 0) + dt; if (!c.leaving && c.svcT > 70) { deployCrew(c); continue; } }
    // поворот планируется за 45 ед. до перекрёстка: перед ним сбрасываем скорость
    c.turnT = Math.max(0, (c.turnT || 0) - dt);
    const lat0 = c.lane.c, along0 = c.lane.s.v ? c.y : c.x, fwd = c.dir < 2 ? 1 : -1;
    let nextC = null, nextD = 1e9;
    for (const l of lanes) { if (l.s.v === c.lane.s.v || lat0 < l.a0 - 2 || lat0 > l.a1 + 2) continue; const d = (l.c - along0) * fwd; if (d > 0 && d < 45 && d < nextD) { nextD = d; nextC = l.c; } }
    if (nextC !== null && c.planAt !== nextC) {
      c.planAt = nextC;
      const ending = c.dir < 2 ? c.lane.a1 - nextC < 40 : nextC - c.lane.a0 < 40, turn = Math.random();
      let nd = c.goal ? (serviceTurn(c) === c.dir ? -1 : serviceTurn(c)) : c.fleeTo ? (turnToward(c, c.fleeTo) === c.dir ? -1 : turnToward(c, c.fleeTo)) : turn < .25 ? (c.dir + 1) % 4 : turn < .4 ? (c.dir + 3) % 4 : -1;
      const opts = lanes.filter(l => l.s.v !== c.lane.s.v && Math.abs(l.c - nextC) < 1 && lat0 >= l.a0 - 2 && lat0 <= l.a1 + 2 && l.dir !== c.dir && l.dir !== (c.dir + 2) % 4);
      if (nd >= 0 && !opts.some(l => l.dir === nd)) nd = -1;
      if (ending && nd < 0) nd = opts.length ? pick(opts).dir : -1;
      c.plan = nd;
    }
    const turning = c.plan >= 0 && nextC !== null && nextD < 30;
    let target = clear < 13 ? 0 : clear < 40 ? c.spd * (clear - 13) / 27 : c.spd;
    if (turning || c.turnT > 0) target = Math.min(target, 9);
    c.v += clamp(target - c.v, -70 * dt, 22 * dt);
    if (c.v < 1) c.wait += dt; else c.wait = 0;
    if (people && c.wait > 1.5 && Math.random() < dt * .6) sfx.horn(c);
    // наезд: зомби отлетают, людей сбивает
    if (c.v > 12 && c.panic) near(c.x + dx * 9, c.y + dy * 9, 6, a => {
      if (a.state !== "alive" || (a.role !== "zombie" && Math.random() < .7)) return;
      const k = c.v / 40;
      if (a.role === "zombie") { a.zhp -= 1.2 * k + .5; a.riseT = 1.2; if (a.zhp <= 0) destroyZombie(a, false); } // сбитый зомби встаёт снова
      else { a.hp -= 70 * k + 20; if (a.hp <= 0) kill(a, false, "car"); else a.grabT = 1; }
      a.vx = dx * c.v * .8 + rnd(-8, 8); a.vy = dy * c.v * .8 + rnd(-8, 8);
      if (a.state === "dead") { a.vz = 8 + c.v * .3; a.spin = rnd(-8, 8); a.z = .1; }
      fxBlood(a.x, a.y, 3, 6); sfx.thud(c); c.dmg++; c.v *= .6;
      if (c.dmg > 3 && Math.random() < .3) { c.wreck = true; abandonCar(c, "crash"); logT("crash", "Машина разбилась, сбив людей", "bad"); }
    });
    if (!c.moving) continue;
    // застряли среди зомби — водитель бросает машину
    if (c.wait > 3 && zNear >= 2 && !c.service) { abandonCar(c, "Водитель бросил машину посреди дороги"); continue; }
    if (c.service && !c.leaving && zNear >= 1 && (c.service === "police" || c.service === "army")) { deployCrew(c); continue; }
    if (c.wait > 22) { const opp = laneOf(c.lane.s, (c.dir + 2) % 4); if (opp && !laneBusy(opp, c.lane.s.v ? c.y : c.x, c)) { placeOnLane(c, opp, c.lane.s.v ? c.y : c.x); c.wait = 0; c.turnT = 1; } }
    // поворот на перекрёстке
    const ox = c.x, oy = c.y;
    c.x += dx * c.v * dt; c.y += dy * c.v * dt;
    if (c.service && (c.x < 4 || c.y < 4 || c.x > W - 4 || c.y > H - 4)) { if (c.leaving) { c.gone = true; continue; } const opp = laneOf(c.lane.s, (c.dir + 2) % 4); if (opp) placeOnLane(c, opp, clamp(c.lane.s.v ? c.y : c.x, 6, (c.lane.s.v ? H : W) - 6)); continue; }
    if (c.x < 4 || c.y < 4 || c.x > W - 4 || c.y > H - 4) {
      if (c.fleeTo) { c.gone = true; fled++; logT("fled", "Машины бегут из города по шоссе", "", 40); continue; } // спасся
      const lane = pick(lanes), at = rnd(lane.a0 + 40, lane.a1 - 40); if (laneBusy(lane, at, c)) continue; placeOnLane(c, lane, at); c.ang = Math.atan2(DY[c.dir], DX[c.dir]); c.v = 0; c.planAt = undefined; c.plan = -1; continue;
    }
    // пересекли ось поперечной улицы: выполняем запланированный поворот
    const a0 = c.lane.s.v ? oy : ox, a1 = c.lane.s.v ? c.y : c.x, lat = c.lane.c, cands = [];
    for (const l of lanes) { if (l.s.v === c.lane.s.v || (l.c - a0) * (l.c - a1) > 0 || lat < l.a0 - 2 || lat > l.a1 + 2) continue; cands.push(l); }
    if (cands.length) {
      const lc = cands[0].c, ending = c.dir < 2 ? c.lane.a1 - lc < 40 : lc - c.lane.a0 < 40;
      let nd = c.planAt !== undefined && Math.abs(c.planAt - lc) < 1 ? c.plan : -1;
      if (ending && (nd < 0 || !cands.some(l => l.dir === nd))) { const opts = cands.filter(l => l.dir !== c.dir && l.dir !== (c.dir + 2) % 4); nd = opts.length ? pick(opts).dir : -1; }
      const l = nd >= 0 ? cands.find(l => l.dir === nd) : null;
      if (l) {
        if (laneBusy(l, lat, c)) { if (ending) { c.x = ox; c.y = oy; c.v = 0; c.wait += dt; } } // занято — ждём или едем прямо
        else { placeOnLane(c, l, lat); c.turnT = .9; if (blocked(c.x, c.y)) { c.x = ox; c.y = oy; } }
      }
      c.plan = -1;
    }
    let da = Math.atan2(DY[c.dir], DX[c.dir]) - c.ang; da -= Math.round(da / TAU) * TAU; c.ang += da * Math.min(1, dt * (c.turnT > 0 ? 4 : 7));
  }
}

/* ---------- разрушение ---------- */
function damageBuilding(b, dmg, sx, sy) {
  if (b.state !== "ok") return;
  if (sx !== undefined) { b.hitX = sx; b.hitY = sy; }
  b.hp -= dmg; b.scorch = Math.max(b.scorch, clamp(1 - b.hp / b.maxHp));
  if (b.hp < b.maxHp * .55 && Math.random() < .6) b.fire = Math.max(b.fire, rnd(30, 70));
  if (b.hp <= 0) collapse(b);
}
function collapse(b) {
  b.state = "collapsing"; b.cT = 0;
  // высокий дом после удара сбоку валится в сторону от взрыва
  const cx = (b.x0 + b.x1) / 2, cy = (b.y0 + b.y1) / 2;
  b.topple = b.hitX !== undefined && b.h > 36 && b.kind !== "house" && Math.random() < .8;
  if (b.topple) {
    if (b.kind === "tower") firsts.topple = true;
    const d = Math.hypot(cx - b.hitX, cy - b.hitY);
    b.fallAng = (d > 2 ? Math.atan2(cy - b.hitY, cx - b.hitX) : rnd(0, TAU)) + rnd(-.35, .35);
    b.fallT = 1.4 + Math.sqrt(b.h) / 5.5; b.fallMax = rnd(1.2, 1.45); b.impacted = false;
  }
  for (const o of (b.occ || []).slice()) { leaveShelter(o, true); if (Math.random() < .7) { kill(o, false); o.reanimate = false; o.crushed = true; } }
  b.ruinH = b.kind === "house" ? rnd(2, 5) : Math.min(b.h * .5, rnd(5, 26));
  b.fire = Math.max(b.fire, 30);
  const m = Math.min(b.h * .22, 34);
  // завал засыпает всех вокруг
  near((b.x0 + b.x1) / 2, (b.y0 + b.y1) / 2, Math.hypot(b.x1 - b.x0, b.y1 - b.y0) / 2 + m, a => {
    if (a.state !== "alive" || a.x < b.x0 - m || a.x > b.x1 + m || a.y < b.y0 - m || a.y > b.y1 + m) return;
    if (Math.random() < .75) { if (a.role === "zombie") destroyZombie(a, false); else { kill(a, false); a.reanimate = false; } a.crushed = true; }
  });
  for (let y = b.y0 - m; y < b.y1 + m; y += CS) for (let x = b.x0 - m; x < b.x1 + m; x += CS) {
    const inside = x >= b.x0 && x < b.x1 && y >= b.y0 && y < b.y1, c = cellAt(x, y);
    if (inside || (c !== 3 && c !== 5 && Math.random() < .8 - Math.max(Math.max(b.x0 - x, x - b.x1, 0), Math.max(b.y0 - y, y - b.y1, 0)) / m * .7)) {
      const gx = Math.floor(x / CS), gy = Math.floor(y / CS); if (gx >= 0 && gy >= 0 && gx < GW && gy < GH) grid[gy * GW + gx] = 8;
    }
  }
  for (const c of cars) if (!c.moving && c.x > b.x0 - m && c.x < b.x1 + m && c.y > b.y0 - m && c.y < b.y1 + m) { c.wreck = true; c.crushed = true; }
  for (const l of lamps) if (l.x > b.x0 - m && l.x < b.x1 + m && l.y > b.y0 - m && l.y < b.y1 + m) l.down = l.down || rnd(1.2, 1.5) * (Math.random() < .5 ? 1 : -1);
  fieldT = 0; gridDirty = true; barrDirty = true;
  logE(b.kind === "tower" ? "Рухнул небоскрёб" : b.kind === "house" ? "Разрушен частный дом" : "Обрушилось здание", "bad");
  fxCollapse(b); sfx.collapse(b); interest((b.x0 + b.x1) / 2, (b.y0 + b.y1) / 2, 10);
}
// рухнувшая вбок башня ложится на соседей: полоса завалов, домино, раздавленные машины
function toppleImpact(b) {
  b.impacted = true;
  const cx = (b.x0 + b.x1) / 2, cy = (b.y0 + b.y1) / 2, ca = Math.cos(b.fallAng), sa = Math.sin(b.fallAng);
  const w = b.x1 - b.x0, d = b.y1 - b.y0, e = Math.min(w / 2 / Math.max(1e-3, Math.abs(ca)), d / 2 / Math.max(1e-3, Math.abs(sa)));
  const L = b.h * Math.sin(b.fallMax), half = Math.max(w, d) / 2 + 6;
  const px = cx + ca * e, py = cy + sa * e;
  b.fallZone = { px, py, ca, sa, L, half };
  const inZone = (x, y) => { const dx = x - px, dy = y - py, al = dx * ca + dy * sa, lat = Math.abs(-dx * sa + dy * ca); return al > -4 && al < L && lat < half * (1 - al / L * .35); };
  for (let k = 0; k < L; k += CS / 2) for (let l = -half; l <= half; l += CS / 2) {
    const x = px + ca * k - sa * l, y = py + sa * k + ca * l; if (!inZone(x, y)) continue;
    const gx = Math.floor(x / CS), gy = Math.floor(y / CS); if (gx < 0 || gy < 0 || gx >= GW || gy >= GH) continue;
    const i = gy * GW + gx; if (grid[i] !== 3 && grid[i] !== 9 && Math.random() < .85) grid[i] = 8;
  }
  near(px + ca * L / 2, py + sa * L / 2, L / 2 + half, a => { if (a.state === "alive" && inZone(a.x, a.y) && Math.random() < .85) { if (a.role === "zombie") destroyZombie(a, false); else { kill(a, false); a.reanimate = false; } a.crushed = true; } });
  for (const c of cars) if (!c.gone && inZone(c.x, c.y)) { c.wreck = true; c.crushed = true; c.moving = false; c.stopped = true; }
  for (const l of lamps) if (inZone(l.x, l.y)) l.down = l.down || 1.4;
  for (const t of trees) if (inZone(t.x, t.y)) t.burnt = true;
  for (const o of buildings) {
    if (o === b || o.state !== "ok") continue;
    const ox = clamp(px + ca * L * .6, o.x0, o.x1), oy = clamp(py + sa * L * .6, o.y0, o.y1);
    let hit = false; for (let k = 0; k < L && !hit; k += 6) { const x = px + ca * k, y = py + sa * k; if (x > o.x0 - half * .6 && x < o.x1 + half * .6 && y > o.y0 - half * .6 && y < o.y1 + half * .6) hit = true; }
    if (hit) { damageBuilding(o, 160 + b.floors * 18, px, py); logT("domino", "Падающая башня обрушила соседний дом", "bad", 8); }
  }
  fieldT = 0; gridDirty = true; barrDirty = true; interest(px + ca * L / 2, py + sa * L / 2, 10);
  fxToppleImpact(b); sfx.boom(px + ca * L * .5, py + sa * L * .5, true);
}
function stepBuildings(dt) {
  for (const b of buildings) {
    if (b.topple && !b.impacted && b.state === "collapsing" && b.cT > b.fallT) toppleImpact(b);
    if (b.fire > 0 && b.state === "ok" && Math.random() < dt * .8) { const s = Math.random() < .5, x = s ? rnd(b.x0, b.x1) : (Math.random() < .5 ? b.x0 - 4 : b.x1 + 4), y = s ? (Math.random() < .5 ? b.y0 - 4 : b.y1 + 4) : rnd(b.y0, b.y1); fires.push({ x, y, r: rnd(5, 9), l: rnd(4, 8) }); } // горящие обломки падают у стен
    if (b.fire > 0) { b.fire -= dt; if (b.state === "ok") { b.hp -= dt * (b.kind === "house" ? 1.2 : .25); b.scorch = Math.max(b.scorch, clamp(1 - b.hp / b.maxHp)); if (b.hp <= 0) collapse(b); } }
    if (b.state === "collapsing") { b.cT += dt; if (b.cT > (b.topple ? b.fallT + 2 : 4.5)) b.state = "ruin"; }
  }
}
// взрыв ломает всё вокруг: здания, машины, фонари, деревья
function blastWorld(x, y, R, big) {
  for (const b of buildings) {
    const dx = Math.max(b.x0 - x, 0, x - b.x1), dy = Math.max(b.y0 - y, 0, y - b.y1), d = Math.hypot(dx, dy);
    if (d < R) damageBuilding(b, (big ? 280 : R * 2.4) * (1 - d / R) + (big ? 40 : 10), x, y);
  }
  for (const c of cars) {
    if (c.gone || c.z > 0) continue;
    const d = Math.hypot(c.x - x, c.y - y);
    if (d < R * 1.2) {
      const k = 1 - d / (R * 1.2), ang = Math.atan2(c.y - y, c.x - x);
      if (!c.wreck) c.boomT = rnd(.6, 3);
      c.wreck = true;
      if (c.moving) { c.moving = false; c.stopped = true; }
      fillCells(c.x - 9, c.y - 9, c.x + 9, c.y + 9, 0);
      c.vx = Math.cos(ang) * 50 * k; c.vy = Math.sin(ang) * 50 * k; c.vz = 20 + 50 * k * (big ? 1 : .6); c.z = .1;
      c.sr = rnd(-6, 6) * k; c.sy = rnd(-3, 3) * k; c.roll = c.roll || 0;
    } else if (d < R * 3 && !c.wreck) c.alarm = rnd(15, 40);
  }
  for (const l of lamps) if (!l.down && Math.hypot(l.x - x, l.y - y) < R * .9) l.down = rnd(1.2, 1.55) * (Math.random() < .5 ? 1 : -1);
  for (const t of trees) if (Math.hypot(t.x - x, t.y - y) < R * .9) t.burnt = true;
  gridDirty = true;
}

/* ---------- танк ---------- */
let tanks = [];
function addTank(x, y) {
  const t = { tank: true, x, y, ang: rnd(0, TAU), turret: 0, hp: 100, cd: 2, mg: 0, shells: 40, rounds: 900, v: 0, z: 0, recoil: 0, track: 0 };
  tanks.push(t); return t;
}
function stepTanks(dt) {
  for (const t of tanks) {
    if (t.hp <= 0) { t.v = 0; continue; }
    t.cd -= dt; t.mg -= dt; t.recoil = Math.max(0, t.recoil - dt * 3);
    // цели: ближайший видимый зомби для пулемёта, скопление — для пушки
    let best = null, bd = 320, crowd = null, cb = 0;
    nearZ(t.x, t.y, 320, a => {
      if (a.state !== "alive") return;
      const d = Math.hypot(a.x - t.x, a.y - t.y);
      if (!los(t.x, t.y, a.x, a.y)) return;
      if (d < bd) { bd = d; best = a; }
      if (d > 45) { let n = 0, civ = 0; near(a.x, a.y, 26, b => { if (b.state === "alive") { if (b.role === "zombie") n++; else civ++; } }); if (civ === 0 && n > cb) { cb = n; crowd = a; } }
    });
    const aimAt = crowd && cb >= 3 && t.shells > 0 ? crowd : best;
    if (aimAt) {
      const want = Math.atan2(aimAt.y - t.y, aimAt.x - t.x); let dd = want - t.turret; dd -= Math.round(dd / TAU) * TAU;
      t.turret += clamp(dd, -dt * 1.6, dt * 1.6);
      if (Math.abs(dd) < .08) {
        if (aimAt === crowd && t.cd <= 0) fireShell(t, crowd);
        else if (best && t.mg <= 0 && t.rounds > 0 && bd < 240) { const cd = t.cd; t.mg = .09; t.rounds--; shoot(t, best); t.cd = cd; }
      }
    }
    // едет к зомби по улицам, давит всё на пути
    let mx = 0, my = 0;
    if (!best || bd > 120) { const d = fieldDir(fZ, t.x, t.y, false); if (d && fieldVal(fZ, t.x, t.y) < 400) { mx = d[0]; my = d[1]; } }
    const sp = mx || my ? 13 : 0;
    t.v += (sp - t.v) * Math.min(1, dt * 1.5);
    if (mx || my) { const want = Math.atan2(my, mx); let dd = want - t.ang; dd -= Math.round(dd / TAU) * TAU; t.ang += clamp(dd, -dt * .9, dt * .9); t.turret += clamp(dd, -dt * .9, dt * .9) * 0; }
    const nx = t.x + Math.cos(t.ang) * t.v * dt, ny = t.y + Math.sin(t.ang) * t.v * dt;
    const solid = (x, y) => { const c = cellAt(x, y); return c === 3 || c === 10 || x < 10 || y < 10 || x > W - 10 || y > H - 10; };
    if (!solid(nx + Math.cos(t.ang) * 12, ny + Math.sin(t.ang) * 12)) { t.x = nx; t.y = ny; } else t.ang += dt * .8;
    t.track += t.v * dt;
    if (t.v > 2) {
      for (let k = -1; k <= 1; k++) for (let j = -1; j <= 1; j++) {
        const px = t.x + Math.cos(t.ang) * k * 9 - Math.sin(t.ang) * j * 5, py = t.y + Math.sin(t.ang) * k * 9 + Math.cos(t.ang) * j * 5, gi = Math.floor(py / CS) * GW + Math.floor(px / CS);
        if (grid[gi] === 6) { grid[gi] = 0; barrDirty = true; fieldT = 0; fxDebris(px, py); }
      }
      for (const c of cars) if (!c.gone && !c.crushed && Math.hypot(c.x - t.x, c.y - t.y) < 13) { c.crushed = true; c.wreck = true; c.moving = false; fillCells(c.x - 9, c.y - 9, c.x + 9, c.y + 9, 0); fieldT = 0; sfx.crash(c); logT("crush", "Танк смял машину", "good", 20); }
      near(t.x, t.y, 9, a => { if (a.state === "alive") { if (a.role === "zombie") destroyZombie(a, false); else kill(a, false); a.crushed = true; fxBlood(a.x, a.y, 1, 10); } });
    }
  }
}
function fireShell(t, target) {
  t.cd = rnd(3.5, 5); t.shells--; t.recoil = 1;
  const ang = t.turret + rnd(-.03, .03), d = Math.hypot(target.x - t.x, target.y - t.y) + rnd(-10, 10);
  // снаряд летит до цели или до первой стены
  let hx = t.x + Math.cos(ang) * d, hy = t.y + Math.sin(ang) * d, hitB = null;
  for (let s = 16; s < d; s += 4) { const x = t.x + Math.cos(ang) * s, y = t.y + Math.sin(ang) * s; if (cellAt(x, y) === 3) { hx = x; hy = y; hitB = buildings.find(b => x >= b.x0 - 1 && x <= b.x1 + 1 && y >= b.y0 - 1 && y <= b.y1 + 1); break; } }
  fxCannon(t, hx, hy); sfx.cannon(t);
  noises.push({ x: t.x, y: t.y, t: simT, r: 450 });
  setTimeout0(.12, () => { boom(hx, hy, 26, false); if (hitB) damageBuilding(hitB, 55, t.x, t.y); });
  first("tank", "Танк открыл огонь", "good");
}
// отложенные события в игровом времени
let timers = [];
function setTimeout0(t, fn) { timers.push({ t, fn }); }
function stepTimers(dt) { if (!timers.length) return; const due = []; timers = timers.filter(x => (x.t -= dt) > 0 || (due.push(x), false)); for (const x of due) x.fn(); }
