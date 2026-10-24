/* ---------- машины на дорогах: полоса вдоль ребра, дуга поворота через перекрёсток ---------- */
// c.lane — полоса, c.s — пройдено от её начала; у стоп-линии машина решает, куда дальше, и едет по кривой Безье на следующую полосу
function dirOf(tx, ty) { return Math.abs(tx) > Math.abs(ty) ? (tx > 0 ? 0 : 2) : (ty > 0 ? 1 : 3); }
function placeOnLane(c, l, s) {
  c.lane = l; c.s = clamp(s, 0, l.e.len); c.turn = null; c.next = null; c.latOff = 0; c.latTgt = 0; c.over = 0; c.atLine = false;
  const p = lanePos(l, c.s); c.x = p.x; c.y = p.y; c.ang = Math.atan2(p.ty, p.tx); c.dir = dirOf(p.tx, p.ty);
}
// занята ли полоса возле точки s
function laneBusy(l, s, self, R = 16) {
  const p = lanePos(l, s); let busy = false;
  nearCars(p.x, p.y, R + 6, o => { if (busy || o === self || o.gone || o.tank || (!o.moving && !o.stopped)) return; if (o.lane === l && !o.turn) { if (Math.abs(o.s - s) < R) busy = true; } else if (Math.hypot(o.x - p.x, o.y - p.y) < R * .6) busy = true; });
  return busy;
}
// ближайшая к точке позиция на полосе (для выезда служб от участка, больницы и т. п.)
function nearestLanePoint(x, y, wantDir) {
  const q = gEdgeNear(x, y, 600) || gEdgeNear(x, y, 4000); if (!q) return null;
  const e = q.e, opts = e.L.filter(Boolean).map(l => ({ l, s: clamp(laneSOfT(l, q.t), laneStart(l) + 6, Math.max(laneStart(l) + 6, laneEnd(l) - 6)) }));
  for (const o of opts) { const p = lanePos(o.l, o.s); o.x = p.x; o.y = p.y; }
  return opts[0];
}
// въезд в город с края карты; с координатами — один из трёх ближайших к ним
function entryLanes() { return RL.filter(l => l.from.exit); }
function edgeLanePoint(nx, ny) {
  let pool = entryLanes(); if (!pool.length) pool = RL;
  let l;
  if (nx !== undefined) l = pick(pool.map(l => [Math.hypot(l.from.x - nx, l.from.y - ny), l]).sort((a, b) => a[0] - b[0]).slice(0, 3))[1];
  else l = pick(pool);
  const s = Math.min(14, l.e.len / 3), p = lanePos(l, s);
  return { l, s, x: p.x, y: p.y };
}
function edgePointNear(x, y) { const e = edgeLanePoint(x, y); return [e.x, e.y]; }
// угол поворота с полосы l на полосу m: плюс — направо
function turnAngle(l, m) {
  const a = lanePos(l, laneEnd(l)), b = lanePos(m, laneStart(m));
  let d = Math.atan2(b.ty, b.tx) - Math.atan2(a.ty, a.tx); d -= Math.round(d / TAU) * TAU; return d;
}
function exitsOf(l) { const n = l.to, out = []; for (const e of n.ed) { const m = laneFrom(e, n); if (m && m.e !== l.e) out.push(m); } return out; }
// куда ехать с перекрёстка: службам — по кратчайшему пути, бегущим — к краю карты, остальным — как придётся, чаще прямо
function chooseNext(c) {
  const l = c.lane, n = l.to;
  if (n.exit) return null;
  const opts = exitsOf(l);
  if (!opts.length) return oppLane(l);
  const R = c.goal ? routeTo(c.goal.x, c.goal.y) : null;
  if (R || c.flee || c.leaving) {
    const dist = R ? R.dist : exitDist();
    let best = null, bd = 1e18;
    for (const m of opts) { const d = R && m.e === R.e ? (m.d > 0 ? R.et : m.e.len - R.et) : edgeCost(m.e) + dist[m.to.id]; if (d < bd) { bd = d; best = m; } }
    if (best && bd < 1e11) return best;
  }
  let tot = 0;
  const w = opts.map(m => { const a = turnAngle(l, m), aa = Math.abs(a); let k = aa < .5 ? 1 : aa < 2.2 ? (a > 0 ? .55 : .4) : .12; if (m.e.hw >= 20) k *= 1.4; if (m.to.ed.length === 1 && !m.to.exit) k *= .25; if (simT - m.e.blockT < 60) k *= .05; if (m.e.closed) k *= .02; tot += k; return k; });
  let r = Math.random() * tot; for (let i = 0; i < opts.length; i++) { r -= w[i]; if (r <= 0) return opts[i]; }
  return opts[0];
}
// старшинство на нерегулируемом перекрёстке: кольцо, проспект, улица, переулок
function rankAt(e) { return e.kind === "ring" ? 3 : e.hw >= 22 ? 2 : e.hw >= 15 ? 1 : 0; }
// можно ли въезжать на перекрёсток
function canEnter(c, l, m) {
  const n = l.to, sig = n.sig && !settings.dark; // без света светофоры гаснут — едут по старшинству
  if (c.wait > 25) return true;
  if (sig && !c.panic && !(c.service && c.siren)) {
    const st = lightFor(n, l.e);
    if (st === "r" || (st === "y" && c.v < 6)) return false;
  }
  if (!sig && n.ed.length >= 3) {
    const my = rankAt(l.e);
    for (const e of n.ed) {
      if (e === l.e || rankAt(e) <= my) continue;
      const inL = e.b === n ? e.L[0] : e.L[1]; if (!inL) continue;
      let busy = false; const p = lanePos(inL, laneEnd(inL) - 14);
      nearCars(p.x, p.y, 22, o => { if (!busy && o !== c && o.lane === inL && !o.turn && o.moving && laneEnd(inL) - o.s < 30 && o.v > 1.5) busy = true; });
      if (busy) return false;
    }
  }
  // на перекрёстке уже кто-то едет и наши пути пересекаются — пропускаем
  if (n.occ.length) { const mine = makeTurn(l, m); for (const o of n.occ) if (o !== c && !o.gone && o.turn && o.turn.from !== l.e && turnsCross(mine, o.turn.T, o.turn.u)) return false; }
  // на следующей полосе нет завала
  for (let k = 4; k < 46; k += 7) { const q = lanePos(m, Math.min(m.e.len, laneStart(m) + k)); if (cellAt(q.x, q.y) === 8) return false; }
  // на следующей полосе есть место
  const s1 = laneStart(m); let room = true;
  const p = lanePos(m, s1 + 6);
  nearCars(p.x, p.y, 20, o => { if (room && o !== c && !o.gone && o.lane === m && !o.turn && o.s < s1 + 15 && o.v < 6 && (o.moving || o.stopped)) room = false; });
  return room;
}
// дуга через перекрёсток: кубическая кривая от стоп-линии до начала следующей полосы (геометрия не меняется — кэш)
const turnCache = new Map();
function makeTurn(l, m) {
  const key = l.id * 65536 + m.id, old = turnCache.get(key); if (old && old.l === l && old.m === m) return old;
  const a = lanePos(l, laneEnd(l)), b = lanePos(m, laneStart(m)), uturn = m.e === l.e, pts = [];
  // поворот: вершина дуги — точка, где сходятся продолжения обеих полос (квадратичная кривая без петель)
  const det = a.tx * b.ty - a.ty * b.tx, dx = b.x - a.x, dy = b.y - a.y;
  if (!uturn && Math.abs(det) > .08) {
    const t = (dx * b.ty - dy * b.tx) / det, u = (a.tx * dy - a.ty * dx) / det;
    if (t > .3 && u > .3 && t < 140 && u < 140) { const cx = a.x + a.tx * t, cy = a.y + a.ty * t; for (let i = 0; i <= 12; i++) { const k = i / 12, w = 1 - k; pts.push([w * w * a.x + 2 * w * k * cx + k * k * b.x, w * w * a.y + 2 * w * k * cy + k * k * b.y]); } }
  }
  if (!pts.length) {
    // прямо (со сдвигом между полосами разной ширины) или разворот — кубическая кривая
    const D = Math.hypot(dx, dy), h = uturn ? Math.max(10, l.off * 2.4) : clamp(D * .36, 2, 30);
    const P0 = [a.x, a.y], P1 = [a.x + a.tx * h, a.y + a.ty * h], P2 = [b.x - b.tx * h, b.y - b.ty * h], P3 = [b.x, b.y];
    for (let i = 0; i <= 12; i++) { const t = i / 12, u = 1 - t; pts.push([u * u * u * P0[0] + 3 * u * u * t * P1[0] + 3 * u * t * t * P2[0] + t * t * t * P3[0], u * u * u * P0[1] + 3 * u * u * t * P1[1] + 3 * u * t * t * P2[1] + t * t * t * P3[1]]); }
  }
  const cum = plCum(pts), T = { l, m, pts, cum, len: cum[12], sharp: uturn || Math.abs(turnAngle(l, m)) > .45 };
  turnCache.set(key, T); return T;
}
// пересекает ли наш путь через перекрёсток ещё не пройденную часть чужого (или подходит вплотную)
function turnsCross(A, B, uB) {
  let i0 = 1; while (i0 < B.cum.length - 1 && B.cum[i0] < uB) i0++;
  for (let i = 1; i < A.pts.length; i++) {
    const a = A.pts[i - 1], b = A.pts[i];
    for (let j = i0; j < B.pts.length; j++) {
      const p = B.pts[j - 1], q = B.pts[j];
      if (segX(a[0], a[1], b[0], b[1], p[0], p[1], q[0], q[1])) return true;
      if (Math.hypot(b[0] - q[0], b[1] - q[1]) < 7) return true;
    }
  }
  return false;
}
function startTurn(c, m) {
  const l = c.lane, T = makeTurn(l, m);
  c.turn = { pts: T.pts, cum: T.cum, len: T.len, u: 0, to: m, n: l.to, from: l.e, sharp: T.sharp, T };
  l.to.occ.push(c); c.next = null; c.atLine = false;
}
function endTurn(c, extra) {
  const T = c.turn, i = T.n.occ.indexOf(c); if (i >= 0) T.n.occ.splice(i, 1);
  const v = c.v, ox = c.x, oy = c.y, ang = c.ang; placeOnLane(c, T.to, laneStart(T.to) + Math.max(0, extra || 0)); c.v = v; c.ang = ang;
  c.offx = (c.offx || 0) + ox - c.x; c.offy = (c.offy || 0) + oy - c.y; if (Math.hypot(c.offx, c.offy) > 6) c.offx = c.offy = 0;
}
// машина уехала за край карты
function leaveMap(c) {
  if (c.turn) { const i = c.turn.n.occ.indexOf(c); if (i >= 0) c.turn.n.occ.splice(i, 1); }
  if (c.service || c.flee || c.panic) {
    c.gone = true; c.moving = false;
    if (!c.service) { fled++; logT("fled", "Машины бегут из города по шоссе", "", 40); }
    return;
  }
  // обычная машина уезжает, а с другой стороны въезжает новая
  const cnt = lastCounts || null;
  if (cnt && cnt.Z > 6) { c.gone = true; c.moving = false; return; }
  const e = edgeLanePoint(); if (laneBusy(e.l, e.s, c)) { c.gone = true; c.moving = false; return; }
  placeOnLane(c, e.l, e.s); c.v = c.spd * .6; c.wait = 0; c.offx = c.offy = 0;
}
// что впереди по ходу: машины, люди, препятствия в клетках
function scanAhead(c, x, y, tx, ty, l) {
  let clear = 1e9, ahead = null, people = false, zNear = 0, zAhead = false;
  nearCars(x + tx * 25, y + ty * 25, 34, o => {
    if (o === c || o.gone || o.towedBy || (!o.moving && !o.stopped && !o.tank)) return;
    if (l && o.lane === l && !o.turn && !c.turn && !c.over) { const g = o.s - c.s; if (g > 0 && g < clear && Math.abs((o.latOff || 0) - (c.latOff || 0)) < 5) { clear = g; ahead = o; } return; }
    const al = (o.x - x) * tx + (o.y - y) * ty, lat = Math.abs((o.x - x) * ty - (o.y - y) * tx);
    if (al > 0 && lat < 5.5 && al < clear) { clear = al; ahead = o; }
    else if (al > 2 && al < 22 && lat < 9 && o.moving && o.v > 2 && al + 6 < clear) clear = al + 6;
  });
  near(x + tx * 18, y + ty * 18, 30, a => {
    if (a.state !== "alive" || a.hidden) return;
    const al = (a.x - x) * tx + (a.y - y) * ty, lat = Math.abs((a.x - x) * ty - (a.y - y) * tx);
    if (a.role === "zombie" && Math.hypot(a.x - x, a.y - y) < 30) zNear++;
    if (al > 4 && al < 34 && lat < 5.5) {
      if (a.role === "zombie") zAhead = true; else people = true;
      if (a.role !== "zombie" || !c.panic) { clear = Math.min(clear, al + 2); if (al < 12 && !c.panic) c.v = Math.min(c.v, 2); }
    }
  });
  return { clear, ahead, people, zNear, zAhead };
}
function carTarget(c, clear, slow) {
  let target = clear < 13 ? 0 : clear < 40 ? c.spd * (clear - 13) / 27 : c.spd;
  if (slow) target = Math.min(target, slow);
  c.v += clamp(target - c.v, -70 * (c.dt || .033), 22 * (c.dt || .033));
  // стоим — или нас в этом кадре упёрло в соседа (скорость тогда срезается уже после разгона)
  if (c.v < 1 || c.jam) c.wait += c.dt || .033; else c.wait = 0;
  c.jam = false;
}
function stepRoadCar(c, dt) {
  c.dt = dt;
  if (c.turn) return stepTurnCar(c, dt);
  const l = c.lane; if (!l) { c.moving = false; c.stopped = true; return; }
  const sE = laneEnd(l), p = lanePos(l, c.s), tx = p.tx, ty = p.ty;
  // служба доехала до места на своём ребре
  if (c.goal && !c.leaving && !c.deployed) {
    c.svcT = (c.svcT || 0) + dt; const gd = Math.hypot(c.goal.x - c.x, c.goal.y - c.y); if ((c.svcT > 120 && gd < 200) || (c.service === "dump" && c.svcT > 240 && gd < 120) || (c.svcT > 300 && c.service !== "dump") || c.svcT > 600) { deployCrew(c); return; }
    const R = routeTo(c.goal.x, c.goal.y);
    // на нужном ребре: встаём у цели или сразу за ней (въехав с перекрёстка, можно оказаться уже дальше точки)
    if (R && l.e === R.e) { const sG = laneSOfT(l, R.et); if (c.s > sG - 10 && (c.s < sG + 16 || gd < 200)) { deployCrew(c); return; } }
  }
  if (!c.next && sE - c.s < 70 && !l.to.exit) c.next = chooseNext(c);
  const A = scanAhead(c, c.x, c.y, tx, ty, l);
  let clear = A.clear;
  // клетки впереди по самой полосе (повторяя изгиб): баррикады, завалы, дома, брошенные машины
  for (let k = 10; k < 40; k += 6) {
    const q = lanePos(l, Math.min(c.s + k, l.e.len)), qx = q.x + q.ty * (c.latOff || 0), qy = q.y - q.tx * (c.latOff || 0), cc = cellAt(qx, qy);
    if (cc === 5 && !c.over) { clear = Math.min(clear, k - 6); break; }
    if (cc === 3 || cc === 4 || cc === 6 || cc === 8 || cc === 9) { clear = Math.min(clear, k); break; }
  }
  if (c.panic && A.ahead && A.clear < 11 && c.v > 16) { carCollide(c, A.ahead, c.v); return; }
  if (c.panic) clear += 7;
  // стоп-линия: светофор, уступи дорогу, нет места дальше
  c.atLine = false;
  if (!l.to.exit && sE - c.s < 34 && (!c.next || !canEnter(c, l, c.next))) { clear = Math.min(clear, sE - c.s + 13); c.atLine = sE - c.s < 6; }
  if (A.zNear > 0 && !c.panic && !c.service) { c.panic = true; c.flee = true; c.spd *= 1.35; c.next = null; }
  let slow = c.next && sE - c.s < 30 && (c.next.e === l.e || Math.abs(turnAngle(l, c.next)) > .45) ? 10 : 0;
  if (c.over === 2) { slow = 8; sidewalkScatter(c, tx, ty); }
  carTarget(c, clear, slow);
  if (A.people && c.wait > 1.5 && Math.random() < dt * .6) sfx.horn(c);
  carHitPeople(c, tx, ty, dt);
  if (!c.moving) return;
  if (c.wait > 3 && A.zNear >= 2 && !c.service) { abandonCar(c, "Водитель бросил машину посреди дороги"); return; }
  if (c.service && !c.leaving && A.zNear >= 1 && (c.service === "police" || c.service === "army")) { deployCrew(c); return; }
  stepOvertake(c, dt, tx, ty, A.clear, A.ahead);
  if (c.lane !== l) return; // развернулся
  // движение вдоль полосы
  const ds = c.v * dt;
  if (c.s + ds >= sE) {
    if (l.to.exit) { c.s += ds; if (c.s >= l.e.len - 1) { leaveMap(c); return; } }
    else if (c.next && canEnter(c, l, c.next)) { const extra = c.s + ds - sE; c.s = sE; startTurn(c, c.next); c.turn.u = extra; return stepTurnPose(c, dt); }
    else { c.s = sE; c.v = 0; if (!c.next && c.wait > 30) { abandonCar(c, null); return; } }
  } else c.s += ds;
  poseOnLane(c, dt);
}
function poseOnLane(c, dt) {
  const q = lanePos(c.lane, c.s);
  if (c.latOff !== c.latTgt) { c.latOff += (c.latTgt - c.latOff) * Math.min(1, dt * 2.2); if (Math.abs(c.latOff - c.latTgt) < .05) c.latOff = c.latTgt; }
  if (c.offx || c.offy) { const k = Math.min(1, dt * 2.5); c.offx *= 1 - k; c.offy *= 1 - k; if (Math.abs(c.offx) + Math.abs(c.offy) < .05) c.offx = c.offy = 0; }
  c.x = q.x + q.ty * (c.latOff || 0) + (c.offx || 0); c.y = q.y - q.tx * (c.latOff || 0) + (c.offy || 0);
  let da = Math.atan2(q.ty, q.tx) - c.ang; da -= Math.round(da / TAU) * TAU; c.ang += clamp(da * Math.min(1, dt * 7), -dt * 4.5, dt * 4.5);
  c.dir = dirOf(q.tx, q.ty);
}
function stepTurnCar(c, dt) {
  const T = c.turn, p = plPos(T.pts, T.cum, T.u);
  const A = scanAhead(c, c.x, c.y, p.tx, p.ty, null);
  if (A.zNear > 0 && !c.panic && !c.service) { c.panic = true; c.flee = true; c.spd *= 1.35; }
  carTarget(c, A.clear, T.sharp ? 12 : 0);
  carHitPeople(c, p.tx, p.ty, dt);
  if (!c.moving) return;
  if (c.wait > 15) T.u = T.len; // застрял посреди перекрёстка — протискивается
  T.u += c.v * dt;
  stepTurnPose(c, dt);
}
function stepTurnPose(c, dt) {
  const T = c.turn;
  if (T.u >= T.len) { endTurn(c, T.u - T.len); poseOnLane(c, dt); return; }
  const p = plPos(T.pts, T.cum, T.u);
  if (c.offx || c.offy) { const k = Math.min(1, dt * 2.5); c.offx *= 1 - k; c.offy *= 1 - k; }
  c.x = p.x + (c.offx || 0); c.y = p.y + (c.offy || 0);
  let da = Math.atan2(p.ty, p.tx) - c.ang; da -= Math.round(da / TAU) * TAU; c.ang += clamp(da * Math.min(1, dt * 9), -dt * 4.5, dt * 4.5);
  c.dir = dirOf(p.tx, p.ty);
}
// сколько машин нужно городу: по суммарной длине полос
function trafficN() { let L = 0; for (const l of RL) if (!l.e.rural) L += l.e.len; return Math.round(L / 700); }
function newCar() {
  return { moving: true, col: pick(CARC), wreck: false, boomT: 0, burnT: 0, spd: rnd(28, 44), v: 0, wait: 0, stuck: 0, dmg: 0, horn: 0, tanker: false, bus: false, len: 1, flee: false, s: 0, turn: null, next: null, offx: 0, offy: 0, _i: 0, latOff: 0, latTgt: 0, over: 0, overT: 0, unloaded: false, exploded: false, panic: false, alarm: 0, z: 0, vz: 0, vx: 0, vy: 0, roll: 0, sr: 0, sy: 0, stopped: false, gone: false, crushed: false, towedBy: null, service: null, goal: null, lane: null, dir: 0, ang: 0, atLine: false };
}
function spawnTraffic(n) {
  const pool = RL.filter(l => laneEnd(l) - laneStart(l) > 30 && !l.e.closed), tot = pool.reduce((a, l) => a + l.e.len, 0);
  for (let i = 0; i < n && pool.length; i++) {
    let r = Math.random() * tot, lane = pool[0]; for (const l of pool) { r -= l.e.len; if (r <= 0) { lane = l; break; } }
    const c = newCar(), q = Math.random();
    if (q < .04) { c.tanker = true; c.len = 1.6; c.col = pick(["#d8d8d4", "#c9c2b0", "#e8e8e2"]); c.spd *= .85; }
    else if (q < .09) { c.bus = true; c.len = 2.1; c.col = pick(["#e0a020", "#3a7a9a", "#c84a2a", "#e8e2d0"]); c.spd *= .8; }
    const s = rnd(laneStart(lane) + 12, laneEnd(lane) - 12);
    placeOnLane(c, lane, s);
    if (blocked(c.x, c.y) || laneBusy(lane, s, c, 20)) continue;
    c.v = c.spd * rnd(.5, 1);
    cars.push(c);
  }
}
