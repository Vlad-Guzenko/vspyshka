/* ---------- машины на дорогах: полоса вдоль ребра, дуга поворота через перекрёсток ---------- */
// настройки потока: tripShare — доля машин, которые едут по делам (остальные катаются). Замер tests/traffic.test.js, доля стоящих
// машин в четвёртой минуте по 16 городам: «Пригород» .23 при .3, .27 при .6, .32 при 1; «Живой город» .28 / .29 / .34; у кода до
// переходов и поездок было .31 / .32. Взято .6: поездок вдвое больше, а стоят меньше, чем раньше
const TRAFFIC_TUNE = { bonus: true, park0: 12, park1: 30, park: true, exitShare: .12, localShare: .5, density: 1, tripShare: .6 };
// c.lane — полоса, c.s — пройдено от её начала; у стоп-линии машина решает, куда дальше, и едет по кривой Безье на следующую полосу
function dirOf(tx, ty) { return Math.abs(tx) > Math.abs(ty) ? (tx > 0 ? 0 : 2) : (ty > 0 ? 1 : 3); }
function placeOnLane(c, l, s) {
  c.lane = l; c.s = clamp(s, 0, l.e.len); c.turn = null; c.next = null; c.next2 = null; c.squeeze = false; c.latOff = 0; c.latTgt = 0; c.over = 0; c.atLine = false;
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
function chooseNext(c, l = c.lane) {
  const n = l.to;
  if (n.exit) return null;
  if (c.trip && (c.flee || c.panic)) { c.trip = null; c.goal = null; } // бегущему не до дел
  const opts = exitsOf(l);
  if (!opts.length) return oppLane(l);
  // маршрутный автобус едет к остановке по её полосе: встречная полоса той же улицы — только если другого пути нет (sim20.js)
  const R = c.goal ? (c.line >= 0 && c.bus && !c.service ? busRoute(c) : routeTo(c.goal.x, c.goal.y)) : null;
  if (R || c.flee || c.leaving || (c.trip && c.trip.exit)) {
    const dist = R ? R.dist : exitDist();
    let best = null, bd = 1e18; const ds = [];
    for (const m of opts) { const d = R && m.e === R.e ? (R.lane && m !== R.lane ? 1e9 : m.d > 0 ? R.et : m.e.len - R.et) : edgeCost(m.e) + dist[m.to.id]; ds.push(d); if (d < bd) { bd = d; best = m; } }
    if (best && bd < 1e11) {
      // горожане между почти равными путями выбирают случайно (службы и бегущие — строго кратчайший): поток расходится по параллельным улицам
      if (!c.service && !c.flee && !c.leaving) { let tot = 0; const w = ds.map(d => { const k = d - bd < bd * .2 + 40 ? Math.exp(-(d - bd) / (bd * .08 + 20)) : 0; tot += k; return k; }); let r = Math.random() * tot; for (let i = 0; i < opts.length; i++) { r -= w[i]; if (r <= 0) return opts[i]; } }
      return best;
    }
    if (c.trip) pickTrip(c); else if (c.line >= 0 && c.bus && !c.service) busNextStop(c, "unreach"); // цель отсюда недостижима — новая
  }
  let tot = 0;
  const w = opts.map(m => { const a = turnAngle(l, m), aa = Math.abs(a); let k = aa < .5 ? 1 : aa < 2.2 ? (a > 0 ? .55 : .4) : .12; if (m.e.hw >= 20) k *= 1.4; if (m.to.ed.length === 1 && !m.to.exit) k *= .25; if (simT - m.e.blockT < 60) k *= .05; if ((m.e.closed || (m.e.blk && m.e.blk[m.d > 0 ? 0 : 1])) && m.e.regulBy && !c.service) k = 0; else if (m.e.closed || (m.e.blk && m.e.blk[m.d > 0 ? 0 : 1])) k *= .02; else if (m.e.narrow) k *= .5; if (m.e.quar && !c.service && quarAt(c.x, c.y) !== m.e.quar) k *= .01; tot += k; return k; });
  let r = Math.random() * tot; for (let i = 0; i < opts.length; i++) { r -= w[i]; if (r <= 0) return opts[i]; }
  return opts[0];
}
// старшинство на нерегулируемом перекрёстке: кольцо, проспект, улица, переулок
function rankAt(e) { return e.kind === "ring" ? 3 : e.hw >= 22 ? 2 : e.hw >= 15 ? 1 : 0; }
// полоса между двумя близкими перекрёстками, на которой машина не помещается целиком (l.short, roads.js): стоять на ней — значит
// стоять в коробке; длинной машине коротка и полоса подлиннее
function shortLane(c, m) { return m.short || (!m.to.exit && laneEnd(m) - laneStart(m) < 10 * (c.len || 1) + 8); }
// можно ли въезжать на перекрёсток
function canEnter(c, l, m, deep) {
  const n = l.to, sig = n.sig && !settings.dark; // без света светофоры гаснут — едут по старшинству
  // долго ждёт у «уступи дорогу» — проезжает, но не на красный, не через завал и не туда, где за перекрёстком нет места
  const force = c.wait > 40 || (c.stallT || 0) > 40;
  // за перекрёстком короткая полоса до следующего: въезжаем, только если проедем и его (иначе встанем поперёк этого)
  if (!deep && !force && shortLane(c, m)) {
    if (!c.next2 || c.next2.from !== m.to) c.next2 = chooseNext(c, m);
    if (c.next2 && !canEnter(c, m, c.next2, true)) return false;
  }
  // (на второй светофор короткого отрезка не смотрим: поворачивающим своего зелёного там не дождаться, а едущим прямо он согласован)
  if (sig && !deep && !c.panic && !(c.service && c.siren)) {
    const st = lightFor(n, l.e);
    if (st === "r" || (st === "y" && c.v < 6)) return false;
  }
  // короткий отрезок до следующего светофора (бульвар): не въезжаем, пока там не зелёный, иначе встанем между ними и запрём перекрёсток
  // (только едущим прямо: их светофоры согласованы; поворачивающим на отрезок ждать дальнего зелёного нельзя — своего они уже не дождутся)
  if (sig && !c.panic && !(c.service && c.siren) && m.e.len < 90 && m.to.sig && !force && n.grpA.has(l.e) === n.grpA.has(m.e) && lightFor(m.to, m.e) !== "g") return false;
  if (!force && !sig && n.ed.length >= 3) {
    const my = rankAt(l.e);
    for (const e of n.ed) {
      if (e === l.e || rankAt(e) <= my) continue;
      const inL = e.b === n ? e.L[0] : e.L[1]; if (!inL) continue;
      let busy = false; const p = lanePos(inL, laneEnd(inL) - 14);
      nearCars(p.x, p.y, 22, o => { if (!busy && o !== c && o.lane === inL && !o.turn && o.moving && laneEnd(inL) - o.s < 30 && o.v > 1.5) busy = true; });
      if (busy) return false;
    }
  }
  // налево (и на разворот) — пропустив встречных, которые подъезжают к перекрёстку, ещё у стоп-линии, а не стоя посреди коробки
  if (!force && n.ed.length >= 3 && turnAngle(l, m) < -.45 && oncomingNear(c, l)) return false;
  // на перекрёстке уже кто-то едет и наши пути пересекаются — пропускаем
  const mine = makeTurn(l, m);
  if (!force && n.occ.length) for (const o of n.occ) if (o !== c && !o.gone && o.turn && o.turn.from !== l.e && turnsCross(mine, o.turn.T, o.turn.u)) return false;
  // на следующей полосе нет завала
  for (let k = 4; k < 46; k += 7) { const q = lanePos(m, Math.min(m.e.len, laneStart(m) + k)), cc = cellAt(q.x, q.y); if (cc === 8 || cc === 6 || (cc === 11 && c.service !== "plow")) return false; }
  // за перекрёстком есть место для всего кузова: очередь на следующей полосе не доходит до её начала
  return nextLaneGap(c, m, laneStart(m), TRAFFIC_TUNE.bonus) > 2;
}
// встречные, которые подъезжают к тому же перекрёстку по продолжению нашей улицы (для левого поворота)
function oncomingNear(c, l) {
  const n = l.to, u = edgeDirFrom(l.e, n); let busy = false;
  for (const e of n.ed) {
    if (e === l.e || busy) continue;
    const v = edgeDirFrom(e, n); if (u[0] * v[0] + u[1] * v[1] > -.6) continue; // не напротив
    const inL = e.b === n ? e.L[0] : e.L[1]; if (!inL) continue;
    if (n.sig && !settings.dark && lightFor(n, e) === "r") continue; // у них красный
    const p = lanePos(inL, Math.max(laneStart(inL), laneEnd(inL) - 30));
    // считаем тех, кто едет, и тех, кто только что подъехал к линии; давно стоящий у линии встречный сам чего-то ждёт — его не ждём
    nearCars(p.x, p.y, 42, o => { if (busy || o === c || o.gone || o.lane !== inL || o.turn || !o.moving) return; const d = laneEnd(inL) - o.s; if (d < 60 && d > -2 && (o.v > 2 || (d < 16 && (o.stallT || 0) < 3)) && !(o.next && turnAngle(inL, o.next) < -.45)) busy = true; });
  }
  return busy;
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
  let i0 = 1; while (i0 < B.cum.length - 1 && B.cum[i0] < uB - 12) i0++; // с учётом кузова за центром: иначе въедем ему в хвост
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
// место на следующей полосе: от нашего носа (sv — наше положение в координатах полосы m, на дуге оно отрицательное)
// до хвоста ближайшей машины впереди; едущая быстро машина освободит место сама
function nextLaneGap(c, m, sv, bonus) {
  const p = lanePos(m, laneStart(m) + 22), myL = 10 * (c.len || 1) + 3; let gap = 1e9;
  nearCars(p.x, p.y, 50, o => {
    if (o === c || o.gone || o.towedBy || o.lane !== m || o.turn || o.park || !(o.moving || o.stopped)) return;
    if (Math.abs((o.latOff || 0) - (c.latOff || 0)) >= 9.1) return; // стоит у бордюра — проезжаем мимо
    if (o.s + 10 * (o.len || 1) < sv - myL) return; // целиком позади нас
    const g = o.s - 10 * (o.len || 1) - sv - myL + (bonus && o.moving && o.v > 3 ? Math.min(30, o.v * 2) : 0); if (g < gap) gap = g; // у стоп-линии: едущий впереди за время дуги уйдёт дальше
  });
  return gap;
}
// кто из двух машин на перекрёстке прошёл больше, тот едет; второй ждёт
function turnProg(c) { return c.turn.u / Math.max(1, c.turn.len) + (c._i || 0) * 1e-6; }
// клетка проезжей части (тротуар у самой кромки — нет)
function onRoadway(x, y) { const gx = Math.floor(x / CS), gy = Math.floor(y / CS); if (gx < 0 || gy < 0 || gx >= GW || gy >= GH) return false; return roadMask[gy * GW + gx] === 1; }
// люди на самой дуге поворота впереди (касательная их не видит); тротуар у угла не считается
function peopleOnArc(c) {
  const T = c.turn; let clear = 1e9;
  for (let k = 12; k < 36 && k < clear; k += 6) { // от носа; тех, кто ближе, видит обычная проверка перед носом
    const p = plPos(T.pts, T.cum, T.u + k); let hit = false;
    near(p.x, p.y, 4, a => { if (!hit && a.state === "alive" && !a.hidden && a.z <= .5 && (a.role !== "zombie" || !c.panic) && onRoadway(a.x, a.y)) hit = true; });
    if (hit) clear = Math.max(0, k - 2);
  }
  return clear;
}

/* ---------- зебры: машина пропускает тех, кто идёт по переходу или шагает на него с тротуара ---------- */
// зебра у перекрёстка лежит на 6 дальше стоп-линии (crossMask в roads.js), посреди длинной улицы — на половине ребра
const zebraCache = new Map();
// сколько людей на переходе в точке t ребра e; side — сторона дороги нашей полосы (l.d), 0 — считать весь переход
function zebraPeople(e, t, hw, side) {
  const key = (e.id * 8192 + Math.round(t)) * 3 + side + 1, old = zebraCache.get(key); if (old && old.t === simT) return old.n;
  const p = edgePos(e, t); let n = 0;
  near(p.x, p.y, hw + 7, a => {
    if (a.state !== "alive" || a.hidden || a.role === "zombie" || a.z > .5) return;
    const dx = a.x - p.x, dy = a.y - p.y; if (Math.abs(dx * p.tx + dy * p.ty) > 7) return;
    const lt = -dx * p.ty + dy * p.tx, d = Math.abs(lt);
    if (side && lt * side < -2) return; // на светофоре смотрим только свою половину дороги
    if (d < hw + 1 && onRoadway(a.x, a.y)) n++; // идёт по переходу (а не по тротуару вдоль кромки)
    else if (d < hw + 5 && (-(a.vx || 0) * p.ty + (a.vy || 0) * p.tx) * -Math.sign(lt) > 1.5) n++; // шагает с тротуара на переход
  });
  if (zebraCache.size > 4000) zebraCache.clear();
  zebraCache.set(key, { t: simT, n }); return n;
}
// переходы на полосе: [s по полосе, сторона]
function zebrasOnLane(l) {
  const e = l.e; if (e.rural) return null;
  const out = []; if (e.kind !== "ring" && e.len > 260) out.push([e.len / 2, 0]);
  const n = l.to; if (n.ed.length >= 3) out.push([laneEnd(l) + 6, n.sig && !settings.dark ? l.d : 0]);
  return out;
}
// перед переходом с людьми машина встаёт так, чтобы нос не заходил на зебру (полоса зебры ±5 от центра, полкузова 10);
// если нос уже на зебре, ждать поздно — дальше машину держит обычная проверка людей перед носом. Бегущие и сирена не ждут
function zebraStop(c, l, clear) {
  if (c.panic || c.flee || (c.service && c.siren)) return clear;
  const zs = zebrasOnLane(l); if (!zs) return clear;
  for (const [sz, side] of zs) {
    const d = sz - c.s; if (d < 15 || d > 48) continue;
    if (zebraPeople(l.e, edgeTOfLane(l, sz), l.e.hw, side)) clear = Math.min(clear, Math.max(0, d - 17));
  }
  return clear;
}
// то же на дуге поворота для перехода в начале следующей полосы (переход у своей стоп-линии нос уже занял)
function zebraStopTurn(c, clear) {
  if (c.panic || c.flee || (c.service && c.siren)) return clear;
  const T = c.turn, n = T.n; if (n.ed.length < 3) return clear;
  const m = T.to, dOut = T.len - T.u - 6;
  if (dOut >= 15 && dOut < 48 && !m.e.rural && zebraPeople(m.e, edgeTOfLane(m, laneStart(m) - 6), m.e.hw, n.sig && !settings.dark ? m.d : 0)) clear = Math.min(clear, Math.max(0, dOut - 17));
  return clear;
}
// спокойный пешеход перед проезжей частью смотрит по сторонам: машина близко и едет на него — ждёт у бордюра
function zebraWait(a, m) {
  const L = Math.hypot(m[0], m[1]); if (!L) return m;
  const ci = (x, y) => clamp(Math.floor(y / CS), 0, GH - 1) * GW + clamp(Math.floor(x / CS), 0, GW - 1);
  const hi = ci(a.x, a.y); if (grid[hi] === 0 && roadMask[hi] === 1) return m; // уже на дороге — не стоять
  const nx = a.x + m[0] / L * 7, ny = a.y + m[1] / L * 7, ni = ci(nx, ny); if (!(grid[ni] === 0 && roadMask[ni] === 1)) return m;
  // у светофора переход открыт, когда машинам на этой улице красный
  const q = gEdgeNear(nx, ny, 40);
  if (q && !q.e.rural) { const n = q.t < q.e.len / 2 ? q.e.a : q.e.b; if (n.sig && !settings.dark && Math.hypot(n.x - nx, n.y - ny) < q.e.hw * 2.5 + 20 && lightFor(n, q.e) !== "r") return [0, 0, 0]; }
  // ждёт, если машина едет на него, или если у перехода уже стоит и ждёт своей очереди машина (по очереди, а не вечный поток людей)
  let car = false;
  nearCars(a.x, a.y, 48, c => {
    if (car || c.gone || c.tank || !c.moving) return;
    const dx = a.x - c.x, dy = a.y - c.y, d = Math.hypot(dx, dy); if (d > 48 || d < 1) return;
    const fw = (dx * Math.cos(c.ang) + dy * Math.sin(c.ang)) / d;
    if (c.v >= 5 ? fw > .35 && d < 16 + c.v * 1.5 : fw > 0 && d < 40 && c.wait > 1) car = true;
  });
  return car ? [0, 0, 0] : m;
}
function startTurn(c, m) {
  const l = c.lane, T = makeTurn(l, m);
  // по левой полосе широкой улицы перекрёсток проходим, не сливаясь вправо, если дальше тоже широкая
  c.keepLat = c.over === 3 && m.e.hw >= 22 && !m.e.oneway && m.e !== l.e ? c.latOff : 0;
  if (!c.keepLat && c.latOff) { const a0 = T.pts[0]; c.offx = (c.offx || 0) + c.x - a0[0]; c.offy = (c.offy || 0) + c.y - a0[1]; c.latOff = c.latTgt = 0; c.over = 0; } // с левой полосы на дугу: сдвиг гаснет по ходу
  c.turn = { pts: T.pts, cum: T.cum, len: T.len, u: 0, to: m, n: l.to, from: l.e, sharp: T.sharp, T };
  l.to.occ.push(c); c.next = null; c.atLine = false;
}
function endTurn(c, extra) {
  const T = c.turn, i = T.n.occ.indexOf(c); if (i >= 0) T.n.occ.splice(i, 1); c.yieldTo = null;
  const v = c.v, ox = c.x, oy = c.y, ang = c.ang, keep = c.keepLat || 0, n2 = c.next2; placeOnLane(c, T.to, laneStart(T.to) + Math.max(0, extra || 0)); c.v = v; c.ang = ang;
  if (n2 && n2.from === T.to.to) c.next = n2; // с короткой полосы едем туда, куда уже решили у прошлой стоп-линии
  if (keep) { c.latOff = c.latTgt = keep; c.over = 3; c.overT = 0; c.keepLat = 0; const q = lanePos(c.lane, c.s); c.x = q.x + q.ty * keep; c.y = q.y - q.tx * keep; }
  c.offx = (c.offx || 0) + ox - c.x; c.offy = (c.offy || 0) + oy - c.y; if (Math.hypot(c.offx, c.offy) > 6) c.offx = c.offy = 0;
}
// машина уехала за край карты
function leaveMap(c) {
  if (c.turn) { const i = c.turn.n.occ.indexOf(c); if (i >= 0) c.turn.n.occ.splice(i, 1); }
  if (c.service || c.flee || c.panic) {
    if (c.service && !c.leaving && typeof releaseJob === "function") releaseJob(c.job);
    c.gone = true; c.moving = false;
    if (!c.service) { fled++; logT("fled", "Машины бегут из города по шоссе", "", 40); }
    return;
  }
  // обычная машина уезжает, а с другой стороны въезжает новая
  const cnt = lastCounts || null;
  if (cnt && cnt.Z > 6) { c.gone = true; c.moving = false; return; }
  const e = edgeLanePoint(); if (laneBusy(e.l, e.s, c)) { c.gone = true; c.moving = false; return; }
  cancelGas(c); c.fuel = rnd(.2, 1); c.trip = null; c.goal = null; c.park = null;
  placeOnLane(c, e.l, e.s); c.v = c.spd * .6; c.wait = 0; c.offx = c.offy = 0;
}
// что впереди по ходу: машины, люди, препятствия в клетках
function scanAhead(c, x, y, tx, ty, l, ignore) {
  let clear = 1e9, ahead = null, people = false, zNear = 0, zAhead = false;
  nearCars(x + tx * 25, y + ty * 25, 34, o => {
    if (o === c || o === ignore || o.gone || o.towedBy || (!o.moving && !o.stopped && !o.tank)) return;
    if (o.yieldTo === c && simT < o.yieldT) return; // он уступает нам — не ждём его
    // оба давно топчемся, и один из нас на дуге: не ждём друг друга, иначе кольцо ожидания через несколько перекрёстков
    if ((c.turn || o.turn) && (c.stallT || 0) > 12 && (o.stallT || 0) > 8 && o.moving && !o.stopped && !o.park) return;
    // дистанция до стоп-точки: встаём в двух единицах от хвоста передней машины (carTarget тормозит в ноль при 13)
    if (l && o.lane === l && !o.turn && !c.turn && !c.over) { const g = o.s - c.s - 10 * ((o.len || 1) + (c.len || 1)) + 11; if (g > 0 && g < clear && Math.abs((o.latOff || 0) - (c.latOff || 0)) < 9.1) { clear = g; ahead = o; } /* разошлись меньше чем на две ширины кузова — он впереди, иначе проезжаем рядом */ return; }
    const al = (o.x - x) * tx + (o.y - y) * ty, lat = Math.abs((o.x - x) * ty - (o.y - y) * tx);
    // стоп-точка — в двух единицах от его хвоста (по центрам машины заезжали друг в друга на полкузова)
    if (al > 0 && lat < 5.5 && al - 10 * ((o.len || 1) + (c.len || 1)) + 11 < clear) { clear = Math.max(0, al - 10 * ((o.len || 1) + (c.len || 1)) + 11); ahead = o; }
    else if (al > 2 && al < 22 && lat < 9 && o.moving && o.v > 2 && al + 6 < clear) clear = al + 6;
  });
  near(x + tx * 18, y + ty * 18, 30, a => {
    if (a.state !== "alive" || a.hidden) return;
    const al = (a.x - x) * tx + (a.y - y) * ty, lat = Math.abs((a.x - x) * ty - (a.y - y) * tx);
    if (a.role === "zombie" && Math.hypot(a.x - x, a.y - y) < 30) zNear++;
    if (al > 4 && al < 34 && lat < (al < 11 ? 4 : 5.5)) { // у переднего крыла — только тот, кто перед самым кузовом
      if (a.role === "zombie") zAhead = true; else people = true;
      if (a.role !== "zombie" || !c.panic) { clear = Math.min(clear, al + 2); if (al < 12 && !c.panic) c.v = Math.min(c.v, 2); }
    }
  });
  return { clear, ahead, people, zNear, zAhead };
}
function carTarget(c, clear, slow) {
  let target = clear < 13 ? 0 : clear < 32 ? c.spd * (clear - 13) / 19 : c.spd;
  if (slow) target = Math.min(target, slow);
  c.v += clamp(target - c.v, -70 * (c.dt || .033), 22 * (c.dt || .033));
  // стоим — или нас в этом кадре упёрло в соседа (скорость тогда срезается уже после разгона)
  if (c.v < 1 || c.jam) c.wait += c.dt || .033; else c.wait = 0;
  c.jamS = c.jam ? (c.jamS || 0) + (c.dt || .033) : 0; // сколько подряд упираемся в чужой кузов
  c.stallT = c.v < 3 ? (c.stallT || 0) + (c.dt || .033) : 0; // сколько подряд топчемся на месте (wait сбрасывает даже рывок до 1)
  c.jam = false;
}
function stepRoadCar(c, dt) {
  c.dt = dt;
  if (c.gas && c.gas.pts) return stepGas(c, dt);
  if (c.turn) return stepTurnCar(c, dt);
  const l = c.lane; if (!l) { c.moving = false; c.stopped = true; return; }
  if (c.gas) { if (c.panic || c.flee) cancelGas(c); else if (gasArrive(c, l)) return stepGas(c, dt); }
  if (c.pulled && !c.deployed) { c.pulled = false; if (!c.over) c.latTgt = 0; }
  if (c.park && c.park.stop !== undefined) busStopTick(c, dt);
  if (c.park && stepPark(c, l, dt)) return;
  if (c.bus && !c.service && busLines.length) busLineStep(c, l);
  if (!c.service && !c.refugee && !c.panic && !c.flee && !c.goal && !c.trip && !c.gas && !(c.bus && c.line >= 0)) pickTrip(c); // маршрутный автобус по делам не ездит
  const sE = laneEnd(l), p = lanePos(l, c.s), tx = p.tx, ty = p.ty;
  // служба доехала до места на своём ребре
  if (c.goal && c.service && c.service !== "plow" && !c.leaving && !c.deployed) { // снегоуборщик у цели не встаёт (sim18.js)
    c.svcT = (c.svcT || 0) + dt; const gd = Math.hypot(c.goal.x - c.x, c.goal.y - c.y); if ((c.svcT > 120 && gd < (c.service === "bus" && c.phase === "go" ? 650 : 200)) || (c.service === "dump" && c.svcT > 240 && gd < 120) || (c.svcT > 300 && c.service !== "dump") || c.svcT > 600) { deployCrew(c); return; }
    const R = routeTo(c.goal.x, c.goal.y);
    if (gd < 70 && R && l.e === R.e && !c.over) c.latTgt = curbShift(l);
    // на нужном ребре: встаём у цели или сразу за ней (въехав с перекрёстка, можно оказаться уже дальше точки)
    if (R && l.e === R.e) { const sG = laneSOfT(l, R.et); if (c.s > sG - 10 && (c.s < sG + 16 || gd < 200)) { deployCrew(c); return; } }
  }
  // поездка: доехали до нужной улицы — к бордюру; слишком долго в пути — новая цель
  if (c.trip && !c.trip.exit) { if (simT - c.trip.t0 > 420) pickTrip(c); else if (c.trip.e && l.e === c.trip.e) { const sG = laneSOfT(l, c.trip.et); if (c.s > sG - 8 && c.s < sG + 30) arriveTrip(c, l); } }
  if (!c.next && sE - c.s < 70 && !l.to.exit) c.next = chooseNext(c);
  const A = scanAhead(c, c.x, c.y, tx, ty, l);
  let clear = A.clear, cellClear = 1e9;
  // клетки впереди по самой полосе (повторяя изгиб): баррикады, завалы, дома, брошенные машины
  for (let k = 10; k < 40; k += 6) {
    const q = lanePos(l, Math.min(c.s + k, l.e.len)), qx = q.x + q.ty * (c.latOff || 0), qy = q.y - q.tx * (c.latOff || 0), cc = cellAt(qx, qy);
    if (cc === 5 && !c.over) { clear = Math.min(clear, k - 6); cellClear = k - 6; break; }
    if (cc === 3 || cc === 4 || cc === 6 || cc === 8 || cc === 9 || (cc === 11 && c.service !== "plow")) { clear = Math.min(clear, k); cellClear = k; break; }
  }
  // снег на дороге видно издалека: перед сугробом встают заранее, метров за пятнадцать, по тонкому снегу ползут
  if (snowD && snowCells.size && c.service !== "plow") {
    for (let k = 10; k < 92; k += 6) { const q = lanePos(l, Math.min(c.s + k, l.e.len)), cc = cellAt(q.x + q.ty * (c.latOff || 0), q.y - q.tx * (c.latOff || 0)); if (cc === 11) { clear = Math.min(clear, Math.max(0, k - 16)); cellClear = Math.min(cellClear, Math.max(0, k - 16)); break; } }
    if (snowD[snowIdx(c.x + Math.cos(c.ang) * 8, c.y + Math.sin(c.ang) * 8)] > .2) c.v = Math.min(c.v, 10);
  }
  if ((c.stallT || 0) < 5) clear = zebraStop(c, l, clear);
  if (c.panic && A.ahead && A.clear < 11 && c.v > 16) { carCollide(c, A.ahead, c.v); return; }
  if (c.panic) clear += 7;
  // стоп-линия: светофор, уступи дорогу, нет места дальше
  c.atLine = false;
  // стоим так, чтобы нос был у стоп-линии, а не на полкузова в перекрёстке: там проходят дуги поперечных машин
  if (!l.to.exit && sE - c.s < 34 && (!c.next || !canEnter(c, l, c.next))) { const back = Math.abs(c.latOff || 0) > 5 ? 10 : 0; clear = Math.min(clear, sE - c.s + 3 - back); c.atLine = sE - c.s < 16 + back; }
  if (A.zNear > 0 && !c.panic && !c.service) { c.panic = true; c.flee = true; c.spd *= 1.35; c.next = null; c.trip = null; c.goal = null; c.park = null; }
  let slow = c.next && sE - c.s < 30 && (c.next.e === l.e || Math.abs(turnAngle(l, c.next)) > .45) ? 10 : 0;
  if (c.over === 2) { slow = 8; sidewalkScatter(c, tx, ty); }
  // пост пропуска карантина: перед шлагбаумом машина встаёт на досмотр (службы — коротко, с сиреной — без остановки);
  // без людей на посту или во время прорыва проверять некому
  const ckp = l.e.checkCp;
  if (ckp && !ckp.broken && ckp.t !== undefined) {
    const d = laneSOfT(l, ckp.t) - c.s, k = l.d > 0 ? 0 : 1;
    // закрытое направление: службы проезжают (шлагбаум поднимают), остальные встают и разворачиваются; беженцы бросают машины
    if (ckp.road && postLaneShut(ckp, l) && !c.service) {
      if (d > -3 && d < 45) {
        clear = Math.min(clear, Math.max(0, d) + 9);
        if (d < 16 && c.v < 1.5 && !c.refugee) { c.shutT = (c.shutT || 0) + dt; if (c.shutT > 5 && turnBackAtPost(c, l, ckp)) return; }
      }
    } else if (ckp.staff > 0 && !(ckp.openT > 0) && c.cpChecked !== ckp && !(c.service && c.siren)) {
      if (d > -3 && d < 45) {
        clear = Math.min(clear, Math.max(0, d) + 9);
        // из города выпускают быстрее: смотрят документы, а не багажник
        const need = c.service ? 1.5 : ckp.road && postLaneOut(ckp, l) ? 3 : 6;
        if (d < 10 && c.v < 1.5) { c.checkT = (c.checkT || 0) + dt; if (c.checkT > need) { c.cpChecked = ckp; c.checkT = 0; ckp.checked++; if (ckp.boomT) ckp.boomT[k] = simT + 4; cpCheckBus(c, ckp); if (c.refugee) refugeeCarCheck(c, ckp); logT("cpcar", ckp.refugee ? "Пост на въезде: машину беженцев досмотрели" : "Пост пропуска: машину досмотрели и пропустили", "", 30); } }
      }
    }
    // проезжающим поднимают шлагбаум
    if (ckp.boomT && d > -4 && d < 14 && (c.cpChecked === ckp || c.service || !(ckp.staff > 0))) ckp.boomT[k] = Math.max(ckp.boomT[k], simT + 2);
  }
  // машина беженцев: у цели высаживает людей; у закрытого въезда долго стоит — люди бросают её и идут пешком
  if (c.refugee && ((c.goal && Math.hypot(c.goal.x - c.x, c.goal.y - c.y) < 60) || (c.wait > 15 && cityK(c.x, c.y) < .5) || c.wait > 40)) { refugeeCarArrive(c); return; }
  // спецсигнал: гражданская машина, у которой сзади в полосе ближе 60 сирена, прижимается к обочине и почти встаёт;
  // машина с сиреной, видя уступающих, идёт ближе к осевой и проезжает мимо
  if (!c.service && !c.panic && !c.over) {
    let sir = false; nearCars(c.x, c.y, 64, o => { if (!sir && o !== c && o.service && o.siren && o.moving && !o.leaving && !o.deployed && o.lane === l && !o.turn && o.s < c.s && c.s - o.s < 60) sir = true; });
    if (sir) c.yieldT = 2.5;
  }
  if (c.yieldT > 0) { c.yieldT -= dt; c.latTgt = -Math.min(5, l.e.hw - l.off - 1.5); slow = slow ? Math.min(slow, 2) : 2; if (c.yieldT <= 0 && !c.over) c.latTgt = 0; }
  else if (c.service && c.siren && !c.leaving && !c.over) { let yl = false; nearCars(c.x, c.y, 50, o => { if (!yl && o !== c && o.lane === l && !o.turn && o.s > c.s && o.yieldT > 0) yl = true; }); c.latTgt = yl ? 3.5 : 0; }
  carTarget(c, clear, slow);
  if (A.people && c.wait > 1.5 && Math.random() < dt * .6) sfx.horn(c);
  carHitPeople(c, tx, ty, dt);
  if (!c.moving) return;
  if (c.wait > 3 && A.zNear >= 2 && !c.service) { abandonCar(c, "Водитель бросил машину посреди дороги"); return; }
  if (c.bus && c.line >= 0 && c.wait > 40 && !c.park && c.goal) { l.e.blockT = simT; c.next = null; c.wait = 20; }
  if (c.service && !c.leaving && A.zNear >= 1 && (c.service === "police" || c.service === "army")) { deployCrew(c); return; }
  stepOvertake(c, dt, tx, ty, Math.min(A.clear, cellClear), cellClear < A.clear ? null : A.ahead);
  if (c.lane !== l) return; // развернулся
  // движение вдоль полосы
  const ds = c.v * dt;
  if (c.s + ds >= sE) {
    if (l.to.exit) { c.s += ds; if (c.s >= l.e.len - 1) { leaveMap(c); return; } }
    else if (c.next && canEnter(c, l, c.next)) { const extra = c.s + ds - sE; c.s = sE; startTurn(c, c.next); c.turn.u = extra; return stepTurnPose(c, dt); }
    else { c.s = sE; c.v = 0; if (!c.next && c.wait > 30) { abandonCar(c, null); return; } }
  } else c.s += ds;
  // бак пустеет по пройденному пути; почти пуст — на заправку
  if (c.fuel !== undefined && !c.service && !c.bus && !c.tanker && !c.refugee) {
    c.fuel -= ds / FUEL_RANGE;
    if (c.fuel < .1 && !c.gas && !c.panic && !c.flee && (!c.goal || c.trip) && simT > c.gasTry) pickGas(c);
  }
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
  const T = c.turn, p = plPos(T.pts, T.cum, T.u), m = T.to;
  let A = scanAhead(c, c.x, c.y, p.tx, p.ty, null);
  // двое на одном перекрёстке упёрлись друг в друга: едет тот, кто прошёл больше, второй ждёт
  // (на одном перекрёстке — кто прошёл больше; на соседних — младший по списку, иначе стоят вечно, видя друг друга перед носом)
  if (A.ahead && A.ahead.turn && (c.stallT || 0) > 4 && (A.ahead.stallT || 0) > 4 && (A.ahead.turn.n === T.n ? turnProg(c) > turnProg(A.ahead) : c._i < A.ahead._i)) A = scanAhead(c, c.x, c.y, p.tx, p.ty, null, A.ahead);
  if (A.zNear > 0 && !c.panic && !c.service) { c.panic = true; c.flee = true; c.spd *= 1.35; c.trip = null; c.goal = null; }
  // место за перекрёстком считается по очереди на следующей полосе: машина не влезает в чужой кузов и не прыгает
  const gap = nextLaneGap(c, m, laneStart(m) - (T.len - T.u));
  let clear = Math.min(A.clear, gap);
  // людей на дуге и на переходе ждём, но не вечно: после 5 с водитель подаётся вперёд, и дальше его держит только проверка перед носом
  if ((c.stallT || 0) < 5) clear = zebraStopTurn(c, Math.min(clear, peopleOnArc(c)));
  if (c.yieldTo && simT < c.yieldT && !c.yieldTo.gone) clear = 0; // уступаем тому, с кем упёрлись
  // совсем застряли посреди перекрёстка (очередь за ним не двигается, потому что ждёт нас же) — медленно протискиваемся к выезду
  // до самого конца дуги (решение не отменяется: иначе машина ползёт секунду из двенадцати), людей всё же пропуская и не въезжая
  // в хвост очереди на выезде; раньше здесь машину телепортировало на выезд
  if ((c.stallT || 0) > 12) c.squeeze = true;
  if (c.squeeze) { clear = Math.max(clear, Math.min(20, peopleOnArc(c), gap)); c.ghostT = simT + 1; }
  carTarget(c, clear, T.sharp ? 12 : 0);
  carHitPeople(c, p.tx, p.ty, dt);
  if (!c.moving) return;
  T.u += c.v * dt;
  stepTurnPose(c, dt);
}
function stepTurnPose(c, dt) {
  const T = c.turn;
  if (T.u >= T.len) { endTurn(c, T.u - T.len); poseOnLane(c, dt); return; }
  const p = plPos(T.pts, T.cum, T.u), kl = c.keepLat || 0;
  if (c.offx || c.offy) { const k = Math.min(1, dt * 2.5); c.offx *= 1 - k; c.offy *= 1 - k; }
  c.x = p.x + p.ty * kl + (c.offx || 0); c.y = p.y - p.tx * kl + (c.offy || 0);
  let da = Math.atan2(p.ty, p.tx) - c.ang; da -= Math.round(da / TAU) * TAU; c.ang += clamp(da * Math.min(1, dt * 9), -dt * 4.5, dt * 4.5);
  c.dir = dirOf(p.tx, p.ty);
}
// сколько машин нужно городу: по суммарной длине полос
function trafficN() { let L = 0; for (const l of RL) if (!l.e.rural) L += l.e.len; return Math.round(L / 700 * TRAFFIC_TUNE.density * (MAP_SIZES[mapSize].traffic || 1)); } // на большой карте машин на километр меньше, чтобы кадры не дорожали
// городские машины: кузов, длина (в долях седана) и цвета; припаркованным во дворах не достаются фургоны
const CIV_CARS = [
  { k: "sedan", w: 30, len: 1 }, { k: "hatch", w: 18, len: .86 }, { k: "lada", w: 14, len: .92, cols: ["#d8cfa8", "#e8e6dc", "#a8322a", "#3f6b4a", "#3a5f8a", "#c9b47a", "#7a2a2a"] },
  { k: "suv", w: 12, len: 1.03 }, { k: "van", w: 7, len: 1 }, { k: "pickup", w: 6, len: 1.08 }, { k: "taxi", w: 6, len: 1, cols: ["#e8b81a"] },
  { k: "sport", w: 3, len: 1, cols: ["#c81e1e", "#e8b81a", "#e0601a", "#1e5ac8", "#1d1f22"] }, { k: "muscle", w: 2, len: 1.08 }, { k: "muscle2", w: 2, len: 1.08 },
  { k: "roadster", w: 1, len: 1, cols: ["#c81e1e", "#e8e2d0", "#1d1f22", "#2a4a7a"] }, { k: "limo", w: .6, len: 1.6, cols: ["#151618", "#e8e6e0"], noPark: true }, { k: "boxtruck", w: 4, len: 1.33, cols: ["#e9e9e4", "#2a4a7a", "#a8322a", "#2f5a3a"], noPark: true },
];
function pickCarModel(parked) {
  const pool = parked ? CIV_CARS.filter(m => !m.noPark) : CIV_CARS; let r = Math.random() * pool.reduce((a, m) => a + m.w, 0);
  for (const m of pool) { r -= m.w; if (r <= 0) return m; } return pool[0];
}
const BUS_COLS = ["#e0a020", "#3a7a9a", "#c84a2a", "#e8e2d0"];
function newCar() {
  const M = pickCarModel();
  return { model: M.k, moving: true, col: pick(M.cols || CARC), wreck: false, boomT: 0, burnT: 0, spd: rnd(28, 44), v: 0, wait: 0, stuck: 0, dmg: 0, horn: 0, tanker: false, bus: false, len: M.len, flee: false, s: 0, turn: null, next: null, offx: 0, offy: 0, _i: 0, fuel: rnd(.12, 1), gas: null, gasTry: 0, latOff: 0, latTgt: 0, over: 0, overT: 0, unloaded: false, exploded: false, panic: false, alarm: 0, z: 0, vz: 0, vx: 0, vy: 0, roll: 0, sr: 0, sy: 0, stopped: false, gone: false, crushed: false, towedBy: null, service: null, goal: null, lane: null, dir: 0, ang: 0, atLine: false };
}
function spawnTraffic(n) {
  const pool = RL.filter(l => laneEnd(l) - laneStart(l) > 30 && !l.e.closed), wt = l => l.e.len * (l.e.rural ? .25 : 1), tot = pool.reduce((a, l) => a + wt(l), 0);
  for (let i = 0; i < n && pool.length; i++) {
    let r = Math.random() * tot, lane = pool[0]; for (const l of pool) { r -= wt(l); if (r <= 0) { lane = l; break; } }
    const c = newCar(), q = Math.random();
    if (q < .04) { c.tanker = true; c.model = "tanker"; c.len = 1.7; c.col = pick(["#d8d8d4", "#c9c2b0", "#e8e8e2"]); c.spd *= .85; }
    else if (q < .09) { c.bus = true; c.model = "bus"; c.len = 2.3; c.vlen = 2.45; c.col = pick(BUS_COLS); c.spd *= .8; }
    const s = rnd(laneStart(lane) + 12, laneEnd(lane) - 12);
    placeOnLane(c, lane, s);
    if (blocked(c.x, c.y) || laneBusy(lane, s, c, 20)) continue;
    c.v = c.spd * rnd(.5, 1);
    cars.push(c);
  }
}

/* ---------- заправка: машины иногда заезжают залить бак ----------
   Бензин тратится по пройденному пути. Когда бак почти пуст, водитель едет на ближайшую заправку, где есть свободная
   колонка: с улицы заезжает на участок у одного края, встаёт у колонки, стоит, пока льётся бензин, и выезжает у другого
   края обратно в свою полосу. У заправки свой запас топлива; когда он на исходе, приезжает бензовоз и сливает топливо */
const FUEL_RANGE = 120000; // столько единиц пути на полном баке — около часа езды по городу
const GAS = new Map(); // заправка → { stock, stalls: [машина у каждого из трёх рядов], tanker, geo, needT }
function gasStations() { return buildings.filter(b => b.kind === "gas" && b.lotRect && b.state === "ok" && !b.blown); }
function gasState(b) { let s = GAS.get(b); if (!s) GAS.set(b, s = { stock: Math.round(rnd(20, 40)), stalls: [null, null, null], tanker: null, geo: null, needT: 0 }); return s; }
// участок в своих осях: x — вдоль улицы, z — от магазина к улице; три ряда у колонок идут вдоль x (как в render15.js)
function gasGeo(b) {
  const st = gasState(b); if (st.geo) return st.geo;
  const L = b.lotRect, r = L.rot, ax = [Math.cos(r), Math.sin(r)]; let az = [-Math.sin(r), Math.cos(r)];
  if ((b.front.x - L.cx) * az[0] + (b.front.y - L.cy) * az[1] < 0) az = [-az[0], -az[1]];
  const back = (L.d - SPECIAL.gas.d) / 2 - 4, cz = (SPECIAL.gas.d / 2 + back + L.d / 2) / 2 - 2 - back;
  return st.geo = { cx: L.cx, cy: L.cy, ax, az, edge: L.d / 2, rows: [cz - 10, cz, cz + 10] };
}
const gasPt = (g, lx, lz) => [g.cx + g.ax[0] * lx + g.az[0] * lz, g.cy + g.ax[1] * lx + g.az[1] * lz];
// ближайшая заправка со свободной колонкой и топливом; место занимается сразу
function pickGas(c) {
  c.gasTry = simT + 25;
  let best = null, bd = 1800, bk = -1;
  for (const b of gasStations()) {
    const st = gasState(b); if (st.stock <= 0) continue;
    const k = st.stalls.findIndex((o, i) => !o && !(i === 2 && st.tanker)); if (k < 0) continue;
    const g = gasGeo(b), d = Math.hypot(g.cx - c.x, g.cy - c.y); if (d < bd) { bd = d; best = b; bk = k; }
  }
  if (!best) return;
  const g = gasGeo(best), [ex, ey] = gasPt(g, 0, g.edge);
  gasState(best).stalls[bk] = c; c.trip = null; c.park = null; c.gas = { b: best, k: bk, t0: simT, tanker: false, pts: null }; c.goal = { x: ex, y: ey };
}
function cancelGas(c) {
  const g = c.gas; if (!g) return;
  const st = gasState(g.b); if (st.stalls[g.k] === c) st.stalls[g.k] = null; if (st.tanker === c) st.tanker = null;
  c.gas = null; c.goal = null;
}
// подъехали по нужной улице к участку — съезжаем с полосы
function gasArrive(c, l) {
  const g = c.gas, b = g.b;
  if (b.state !== "ok" || b.blown || simT - g.t0 > 300) { if (!g.tanker) c.fuel = Math.max(c.fuel, .35); cancelGas(c); return false; }
  const R = routeTo(c.goal.x, c.goal.y); if (!R || l.e !== R.e || c.over) return false;
  const d = laneSOfT(l, R.et) - c.s; if (d < 30 || d > 48) return false;
  startGasPath(c, l, gasGeo(b)); return true;
}
// путь по участку: от полосы через край участка к колонке своего ряда, дальше к другому краю и обратно в полосу;
// углы ломаной сглажены (Чайкин), остановка — в точке пути, ближайшей к колонке
function startGasPath(c, l, G) {
  const q = lanePos(l, c.s), xs = q.tx * G.ax[0] + q.ty * G.ax[1] >= 0 ? 1 : -1, row = G.rows[c.gas.k], E = G.edge;
  const u0 = xs * ((c.x - G.cx) * G.ax[0] + (c.y - G.cy) * G.ax[1]), sOut = clamp(c.s + 44 - u0, laneStart(l) + 4, laneEnd(l) - 6), o = lanePos(l, sOut);
  const P = (u, z) => gasPt(G, xs * u, z);
  let pts = [[c.x, c.y], [c.x + q.tx * 8, c.y + q.ty * 8], P(-24, E - 1), P(-16, (E + row) / 2), P(-8, row), P(0, row), P(8, row), P(16, (E + row) / 2), P(24, E - 1), [o.x - o.tx * 8, o.y - o.ty * 8], [o.x, o.y]];
  for (let it = 0; it < 3; it++) { const n = [pts[0]]; for (let i = 0; i < pts.length - 1; i++) { const a = pts[i], b = pts[i + 1]; n.push([a[0] * .75 + b[0] * .25, a[1] * .75 + b[1] * .25], [a[0] * .25 + b[0] * .75, a[1] * .25 + b[1] * .75]); } n.push(pts[pts.length - 1]); pts = n; }
  const cum = plCum(pts), S = P(0, row); let stopU = 0, sd = 1e9;
  for (let i = 0; i < pts.length; i++) { const d = Math.hypot(pts[i][0] - S[0], pts[i][1] - S[1]); if (d < sd) { sd = d; stopU = cum[i]; } }
  Object.assign(c.gas, { pts, cum, u: 0, stopU, len: cum[cum.length - 1], phase: "in", l, s: c.s, sOut, wait: 0 });
  c.lane = null; c.turn = null; c.next = null; c.latOff = c.latTgt = 0; c.over = 0;
}
// машина на участке: заезд, заправка, выезд; дальше — снова в своей полосе
function stepGas(c, dt) {
  const g = c.gas, st = gasState(g.b);
  if (g.phase === "fuel") {
    c.v = 0; g.wait -= dt;
    if (g.wait <= 0) {
      g.phase = "out";
      if (g.tanker) { st.stock = 60; if (st.tanker === c) st.tanker = null; logT("gasfill", "Бензовоз слил топливо на заправку", "", 120); }
      else { c.fuel = 1; st.stock = Math.max(0, st.stock - 1); }
      if (st.stalls[g.k] === c) st.stalls[g.k] = null;
    }
    return;
  }
  const end = g.phase === "in" ? g.stopU : g.len, left = end - g.u, vmax = g.phase === "in" ? Math.min(9, 1.5 + left * .5) : Math.min(11, 4 + g.u * .2);
  c.v += clamp(vmax - c.v, -30 * dt, 12 * dt); c.wait = 0;
  g.u = Math.min(end, g.u + Math.max(0, c.v) * dt);
  const p = plPos(g.pts, g.cum, g.u); c.x = p.x; c.y = p.y;
  let da = Math.atan2(p.ty, p.tx) - c.ang; da -= Math.round(da / TAU) * TAU; c.ang += clamp(da * Math.min(1, dt * 6), -dt * 3, dt * 3); c.dir = dirOf(p.tx, p.ty);
  if (g.phase === "in" && g.u >= g.stopU - .05) { g.phase = "fuel"; g.wait = g.tanker ? 50 : rnd(18, 32); c.v = 0; return; }
  if (g.phase === "out" && g.u >= g.len - .05) {
    // в полосу — когда за спиной в ней свободно (или уже долго ждём)
    g.wait += dt; c.v = 0;
    if (laneBusy(g.l, g.sOut, c, 14) && g.wait < 30) return;
    const l = g.l, s = g.sOut; c.gas = null; c.goal = null;
    placeOnLane(c, l, s); c.v = 8; c.wait = 0;
  }
}
// раз в несколько секунд: занятые места без машин освобождаются; заправке с пустеющим запасом — бензовоз
let gasT = 0;
function gasTick(dt) {
  gasT -= dt; if (gasT > 0) return; gasT = 3;
  for (const b of gasStations()) {
    const st = gasState(b);
    st.stalls.forEach((o, i) => { if (o && (o.gone || o.wreck || !o.gas || o.gas.b !== b || !cars.includes(o))) st.stalls[i] = null; });
    if (st.tanker && (st.tanker.gone || st.tanker.wreck || !st.tanker.gas || st.tanker.gas.b !== b)) st.tanker = null;
    if (st.stock >= 12 || st.tanker) { st.needT = 0; continue; }
    st.needT += 3;
    const G = gasGeo(b);
    let tk = null, bd = 3000;
    for (const c of cars) if (c.tanker && c.moving && !c.gone && !c.gas && !c.panic && !c.wreck && c.lane && !c.turn) { const d = Math.hypot(c.x - G.cx, c.y - G.cy); if (d < bd) { bd = d; tk = c; } }
    // своих бензовозов в городе нет — свой приезжает из-за города
    if (!tk && st.needT > 60) {
      const e = edgeLanePoint(G.cx, G.cy); if (laneBusy(e.l, e.s, null)) continue;
      tk = newCar(); Object.assign(tk, { tanker: true, model: "tanker", len: 1.7, col: pick(["#d8d8d4", "#c9c2b0", "#e8e8e2"]), fuel: undefined }); tk.spd *= .85;
      placeOnLane(tk, e.l, e.s); tk.v = tk.spd * .6; cars.push(tk);
    }
    if (!tk || st.stalls[2]) continue;
    // бензовоз встаёт в ближний к улице ряд; пока он едет, легковые туда не заезжают
    const [ex, ey] = gasPt(G, 0, G.edge);
    st.tanker = tk; st.stalls[2] = tk; tk.trip = null; tk.park = null; tk.gas = { b, k: 2, t0: simT, tanker: true, pts: null }; tk.goal = { x: ex, y: ey }; st.needT = 0;
  }
}

/* ---------- поездки: гражданские машины едут по делам ----------
   У каждой машины есть цель — дом, работа, магазин или выезд из города, с весами по часу суток: утром поток к работе,
   вечером домой. Маршрут считает routeTo (как у служб); у нужной улицы машина встаёт у бордюра на полминуты, если ширина
   позволяет разойтись с проезжающими, и выбирает новую цель. Недостижимая или слишком долгая цель меняется */
let tripPools = null, tripPoolT = -1e9;
const TRIP_HOME = new Set(["house", "apt", "oldhouse", "cottage", "dacha", "manor", "farmhouse"]), TRIP_WORK = new Set(["tower", "warehouse", "hospital", "police", "fire", "power", "water", "radio", "school", "station", "depot", "hangar", "barn", "garages", "autoservice", "kinder"]), TRIP_SHOP = new Set(["mall", "gas", "stadium", "cathedral", "market", "cafe", "church"]);
function tripPool() {
  if (tripPools && simT - tripPoolT < 30) return tripPools;
  const P = { home: [], work: [], shop: [] };
  for (const b of buildings) { if (!b.door || b.state !== "ok") continue; if (TRIP_HOME.has(b.kind)) P.home.push(b); else if (TRIP_WORK.has(b.kind)) P.work.push(b); else if (TRIP_SHOP.has(b.kind)) P.shop.push(b); }
  tripPoolT = simT; return tripPools = P;
}
function pickTrip(c) {
  c.trip = null; c.goal = null;
  if (Math.random() >= TRAFFIC_TUNE.tripShare) { c.trip = { wander: true, t0: simT }; return; } // часть машин просто катается по городу
  const P = tripPool(), h = world.hour, r = Math.random();
  let pool = h >= 6 && h < 10 ? (r < .6 ? P.work : r < .8 ? P.shop : P.home)
    : h >= 16 && h < 21 ? (r < .55 ? P.home : r < .8 ? P.shop : P.work)
    : h >= 21 || h < 6 ? (r < .7 ? P.home : P.shop)
    : r < .4 ? P.shop : r < .7 ? P.work : P.home;
  // мест работы и магазинов в городе может быть считаные единицы (в пригороде пять контор и один торговый центр): если бы туда
  // ехали две трети машин, весь поток сошёлся бы на пяти улицах; поэтому маленький список получает поездок по своему размеру,
  // остальные едут в гости и домой
  if (pool !== P.home && pool.length < 12 && Math.random() > pool.length / 12) pool = P.home;
  if (!pool.length) pool = P.home.length ? P.home : P.work.length ? P.work : P.shop;
  // примерно каждая восьмая поездка — за город; там машина уезжает с карты, а на другом въезде появляется новая
  if ((Math.random() < TRAFFIC_TUNE.exitShare || !pool.length) && entryLanes().length) { c.trip = { exit: true, t0: simT }; return; }
  // половина поездок — по соседству (ближайшая из нескольких случайных), чтобы не все ехали через центр
  const local = Math.random() < TRAFFIC_TUNE.localShare;
  for (let k = 0; k < 6 && pool.length; k++) {
    let b = pick(pool); if (!b.door || b.state !== "ok") { tripPoolT = -1e9; continue; } // дом разрушен после составления списка
    if (local) for (let j = 0; j < 5; j++) { const o = pick(pool); if (o.door && o.state === "ok" && Math.hypot(o.door[0] - c.x, o.door[1] - c.y) < Math.hypot(b.door[0] - c.x, b.door[1] - c.y)) b = o; }
    const q = gEdgeNear(b.door[0], b.door[1], 400); if (!q || q.e.rural || q.e.kind === "ring") continue;
    if (c.lane && q.e === c.lane.e) continue; // не туда, где уже едем
    c.trip = { e: q.e, et: q.t, t0: simT }; c.goal = { x: q.x, y: q.y }; return;
  }
}
// доехали: к бордюру, если ширина улицы позволяет разойтись с проезжающими; на узкой улочке — просто дальше по делам
function arriveTrip(c, l) {
  c.trip = null; c.goal = null;
  const sh = curbShift(l); let taken = !TRAFFIC_TUNE.park;
  nearCars(c.x, c.y, 44, o => { if (!taken && o !== c && !o.gone && o.lane === l && !o.turn && Math.abs(o.s - c.s) < 30) taken = true; }); // рядом кто-то стоит или едет — не встаём
  if (taken) return;
  if (-sh >= 9.6 && !l.e.oneway && laneEnd(l) - c.s > 24 && c.s - laneStart(l) > 30 && !c.over && !c.bus && !c.tanker && !nearBusStop(l, c.s)) { c.park = { t: rnd(TRAFFIC_TUNE.park0, TRAFFIC_TUNE.park1) }; c.latTgt = sh; }
}
// стоянка у бордюра: докатываемся, стоим, выезжаем, когда в полосе за спиной свободно
function stepPark(c, l, dt) {
  if (c.panic || c.flee) { c.park = null; c.latTgt = 0; return false; }
  c.v = Math.max(0, c.v - 40 * dt); c.s = Math.min(laneEnd(l) - 4, c.s + c.v * dt); c.wait = 0;
  if (c.v <= 0) c.park.t -= dt;
  if (c.park.t <= 0 && (c.park.t < -12 || !laneBusy(l, c.s + 6, c, 18))) { c.park = null; c.latTgt = 0; return false; }
  poseOnLane(c, dt); return true;
}
