/* ---------- маршрутные автобусы: кольцевые маршруты через остановки, посадка и высадка пассажиров ----------
   При генерации города, когда расставлены остановки (placeProps в layout.js) и готов граф дорог, строятся 3–5 замкнутых
   маршрутов: каждый — последовательность остановок, между соседними автобус едет по кратчайшему пути (busRoute вместо
   routeTo в chooseNext), приезжая к остановке только по её полосе. Городской автобус (c.bus из spawnTraffic) получает
   маршрут и едет от остановки к остановке; у остановки прижимается к бордюру (curbShift) за павильоном и стоит 8–15 с:
   пассажиры, кому пора, выходят по одному, ждущие на остановке садятся. Горожанин без дел иногда идёт на ближайшую
   остановку, ждёт автобус до минуты, едет 2–4 остановки и выходит. В панике автобус ведёт себя как любая машина: бежит
   из города с пассажирами или брошен водителем — пассажиры выбегают (abandonCar). Маршруты не сохраняются, а строятся
   заново из графа и остановок; автобус после загрузки берёт маршрут с ближайшей остановкой */
let busLines = [], busStops = [];
const BUS_STOP_T = [8, 15], BUS_WAIT_MAX = 60, BUS_STOP_AHEAD = 17; // стоянка у остановки, ожидание на ней, центр автобуса за павильоном
// у остановки автобус встаёт правым бортом чуть за бордюр (на 2 единицы на тротуар), а не наполовину на тротуаре (curbShift):
// иначе кузов шириной 10 накрывает весь тротуар вместе с ждущими и павильоном. На широкой улице так остаётся свободной
// правая полоса (машины видят стоящего дальше двух ширин кузова), на узкой его объезжают по встречной
function busCurb(l) { return -Math.max(0, l.e.hw - 2.6 - l.off); }

// остановки из пропсов: павильон стоит на тротуаре справа по ходу своей полосы; s — положение на ней
function busStopsFromProps() {
  busStops = [];
  props.forEach((p, i) => {
    if (p.k !== "stop") return;
    let e = p.e !== undefined ? RE[p.e] : null, t = p.t;
    if (!e || e.dead || edgeNearest(e, p.x, p.y).d > e.hw + 12) { const q = gEdgeNear(p.x, p.y, 40); if (!q) return; e = q.e; t = q.t; }
    if (e.rural || e.kind === "ring") return;
    const g = edgePos(e, t), side = (p.x - g.x) * -g.ty + (p.y - g.y) * g.tx > 0 ? 1 : -1, l = side > 0 ? e.L[0] : e.L[1];
    if (!l || l.to.exit) return; // с полосы к выезду за карту автобус уже не вернётся
    const s = laneSOfT(l, t); if (s < laneStart(l) + 20 || s > laneEnd(l) - 30) return;
    const nx = -g.ty * side, ny = g.tx * side, off = e.hw + 3.2; // ждут под навесом павильона, в стороне от борта
    busStops.push({ k: busStops.length, prop: i, x: p.x, y: p.y, e, t, l, s, wx: g.x + nx * off, wy: g.y + ny * off, tx: g.tx * l.d, ty: g.ty * l.d, lines: [], bus: null, visits: 0 });
  });
}
// поле расстояний до остановки по направленным полосам; встречная полоса её улицы не считается — к остановке подъезжают
// только по её стороне. Кэш на 20 с, как у routeTo (перекрытия и пробки меняют стоимость рёбер)
const busDistCache = new Map();
function busDist(st) {
  const old = busDistCache.get(st.k); if (old && simT - old.t >= 0 && simT - old.t < 20) return old.dist;
  const dist = dijkstraTo([[st.l.from, st.s]], oppLane(st.l));
  busDistCache.set(st.k, { t: simT, dist }); return dist;
}
// сколько ехать от остановки a до остановки b (1e12 — не доехать)
function busLeg(a, b) { const d = busDist(b)[a.l.to.id]; return d < 1e11 ? laneEnd(a.l) - a.s + d : 1e12; }
// рёбра пути между остановками: спуск по полю расстояний, как едет chooseNext (для проверок и отладки)
function busPathEdges(a, b) {
  const out = [a.l.e.id], dist = busDist(b); let l = a.l;
  if (l === b.l && b.s >= a.s) return out;
  for (let k = 0; k < 120 && l !== b.l; k++) {
    const opts = exitsOf(l); let best = opts.length ? null : oppLane(l), bd = 1e18;
    for (const m of opts) { const d = m === b.l ? b.s : m.e === b.e ? 1e9 : edgeCost(m.e) + dist[m.to.id]; if (d < bd) { bd = d; best = m; } }
    if (!best) break; l = best; out.push(l.e.id);
  }
  return out;
}
// маршруты: 3–5 колец (меньше, если остановок мало). Начала — остановки подальше друг от друга; от каждой цепочка к ближайшей
// по дороге ещё не взятой остановке (чужие остановки дороже, чтобы маршруты расходились по районам), потом кольцо замыкается
function buildBusLines() {
  busLines = []; busDistCache.clear(); busStopsFromProps();
  const S = busStops; if (S.length < 3) return;
  const K = S.length < 9 ? Math.max(1, Math.floor(S.length / 3)) : clamp(Math.round(S.length / 7), 3, 5), M = clamp(Math.round(S.length / K) + 1, 4, 9);
  const seeds = [pick(S)];
  while (seeds.length < K) { let best = null, bd = -1; for (const s of S) { let d = 1e9; for (const q of seeds) d = Math.min(d, Math.hypot(s.x - q.x, s.y - q.y)); if (d > bd) { bd = d; best = s; } } seeds.push(best); }
  for (const seed of seeds) {
    const line = [seed], used = new Set([seed]); let cur = seed;
    while (line.length < M) {
      let best = null, bs = 1e12;
      for (const s of S) { if (used.has(s)) continue; const d = busLeg(cur, s); if (d > 1100) continue; const sc = d + (s.lines.length ? 350 : 0) + rnd(0, 120); if (sc < bs) { bs = sc; best = s; } }
      if (!best) break;
      line.push(best); used.add(best); cur = best;
    }
    while (line.length > 2 && busLeg(line[line.length - 1], line[0]) >= 1e11) line.pop();
    if (line.length < 3) continue;
    const li = busLines.length; for (const s of line) s.lines.push(li);
    busLines.push({ stops: line.map(s => s.k), edges: [] });
  }
  for (const L of busLines) { const e = []; for (let i = 0; i < L.stops.length; i++) e.push(...busPathEdges(busStops[L.stops[i]], busStops[L.stops[(i + 1) % L.stops.length]])); L.edges = e; }
  busDistCache.clear(); // при загрузке simT ещё старый — поля посчитаются заново в игре
}
// в каждом маршруте хотя бы один автобус: городские автобусы из spawnTraffic разбираются по маршрутам, на пустой ставится свой
function spawnLineBuses() {
  if (!busLines.length) return;
  for (const c of cars) if (c.bus && !c.service && !c.gone && c.line === undefined) busAssign(c);
  busLines.forEach((L, li) => {
    if (cars.some(c => c.bus && !c.service && !c.gone && c.line === li)) return;
    const st = busStops[L.stops[0]], s = Math.max(laneStart(st.l) + 14, st.s - 40);
    if (laneBusy(st.l, s, null, 24)) return;
    const c = newCar(); c.bus = true; c.model = "bus"; c.len = 2.3; c.vlen = 2.45; c.col = pick(BUS_COLS); c.spd *= .8;
    placeOnLane(c, st.l, s); if (blocked(c.x, c.y)) return;
    c.v = 10; c.line = li; c.stopI = 0; c.stopK = L.stops[0]; cars.push(c);
  });
}
// автобус без маршрута (новый или после загрузки): маршрут с ближайшей остановкой, из близких — где автобусов меньше
function busAssign(c) {
  if (!busLines.length) { c.line = -1; return; }
  const n = busLines.map(() => 0); for (const o of cars) if (o.bus && !o.service && !o.gone && o.line >= 0 && o.line < n.length) n[o.line]++;
  let best = -1, bk = -1, bs = 1e18;
  busLines.forEach((L, li) => { for (const k of L.stops) { const st = busStops[k], d = Math.hypot(st.x - c.x, st.y - c.y) + n[li] * 500; if (d < bs) { bs = d; best = li; bk = k; } } });
  c.line = best; c.stopK = bk; c.stopI = busLines[best].stops.indexOf(bk); c.goal = null;
}
function busSetGoal(c) {
  const L = busLines[c.line]; if (!L) { c.line = undefined; c.goal = null; return; }
  c.stopI = (((c.stopI | 0) % L.stops.length) + L.stops.length) % L.stops.length; c.stopK = L.stops[c.stopI];
  const st = busStops[c.stopK], p = lanePos(st.l, st.s); c.goal = { x: p.x, y: p.y }; c.stopT0 = simT;
}
function busNextStop(c, why) { c.stopI = (c.stopI | 0) + 1; busSetGoal(c); c.skipWhy = why; }
// маршрут для chooseNext: ребро и полоса остановки, поле расстояний до неё
function busRoute(c) { const st = busStops[c.stopK]; return st ? { e: st.e, et: st.t, lane: st.l, dist: busDist(st) } : null; }
// каждый кадр из stepRoadCar (после стоянки, до выбора поездки): цель — следующая остановка; на её полосе — к бордюру и стоянка
function busLineStep(c, l) {
  if (c.panic || c.flee || c.park) return;
  if (c.line === undefined) busAssign(c);
  if (!(c.line >= 0) || !busLines[c.line]) return;
  if (!c.goal) busSetGoal(c);
  const st = busStops[c.stopK]; if (!st) { busNextStop(c, "nostop"); return; }
  if (simT - c.stopT0 > 300) { busNextStop(c, "late"); return; } // пять минут не можем подъехать (перекрыто, пробка) — следующая
  if (l !== st.l) return;
  const sc = st.s + Math.min(BUS_STOP_AHEAD, laneEnd(l) - 13 - st.s), d = sc - c.s;
  if (d > 60) return;
  if (d < -12) { busNextStop(c, "passed"); return; } // проскочили — остановка пропущена
  // в обгоне (стоящая машина перед остановкой) к бордюру не прижимаемся, но у остановки всё равно встаём: стоянка сама подтянет к бордюру
  if (!c.over) c.latTgt = busCurb(l);
  if (c.s >= sc - c.v * c.v / 80 - 1) busArrive(c, l, st);
}
function busArrive(c, l, st) {
  c.park = { t: rnd(BUS_STOP_T[0], BUS_STOP_T[1]), stop: st.k, t0: simT, doorT: 1.2 }; c.latTgt = busCurb(l); c.goal = null; c.next = null; c.over = 0; c.contra = false;
  c.stopI = (c.stopI | 0) + 1; st.bus = c; st.visits++; c.stopsMade = (c.stopsMade || 0) + 1;
  // погибший в салоне (взрыв рядом) остаётся на остановке; остальным считаем остановки
  for (const p of (c.passengers || []).slice()) { if (p.state === "alive") { if (p.ride) p.ride.left--; } else { c.passengers.splice(c.passengers.indexOf(p), 1); p.hidden = false; p.onBus = null; p.x = c.x; p.y = c.y; } }
}
// автобус стоит у остановки: раз в полсекунды выходит один, кому пора; пока к дверям идут ждущие, стоянка тянется (не дольше 35 с)
function busStopTick(c, dt) {
  const P = c.park, st = busStops[P.stop]; if (!st) return;
  if (st.bus !== c && !(st.bus && st.bus.park && st.bus.park.stop === st.k && !st.bus.gone)) st.bus = c;
  if (c.v > .5) return;
  P.doorT -= dt; if (P.doorT > 0) return; P.doorT = .6;
  const out = (c.passengers || []).find(p => p.ride && p.ride.left <= 0);
  if (out) { busAlight(c, out, st); P.t = Math.max(P.t, 1.5); return; }
  if (simT - P.t0 > 35 || (c.passengers || []).length >= BUS_CAP) return;
  let walking = 0; near(c.x, c.y, 50, a => { if (a.busWait && a.busWait.k === st.k && a.state === "alive" && !a.hidden && a.panic < .5) walking++; });
  if (walking) P.t = Math.max(P.t, 1.2);
}
function busBoardLine(a, c, st) {
  a.hidden = true; a.onBus = c; a.busWait = null; a.vx = a.vy = 0; a.dest = null; a.hideGoal = null; a.ride = { line: c.line, left: 2 + Math.floor(Math.random() * 3) };
  (c.passengers || (c.passengers = [])).push(a); c.boarded = (c.boarded || 0) + 1; st.boarded = (st.boarded || 0) + 1;
  logT("busride", "Горожане ездят на автобусах по маршрутам", "", 600);
}
function busAlight(c, p, st) {
  const i = c.passengers.indexOf(p); if (i >= 0) c.passengers.splice(i, 1);
  p.hidden = false; p.onBus = null; p.ride = null; const [x, y] = freeNear(st.wx, st.wy, 7); p.x = x; p.y = y; p.vx = p.vy = 0; p.dest = null; p.idleT = rnd(3, 12);
  c.alighted = (c.alighted || 0) + 1; st.alighted = (st.alighted || 0) + 1;
}
// водитель бросил автобус: пассажиры выбегают (из abandonCar)
// остановка на этой полосе ближе 45 по ходу или 30 позади: здесь не паркуются (иначе автобус обгоняет стоящих и проезжает мимо)
function nearBusStop(l, s) { for (const st of busStops) if (st.l === l && st.s - s > -30 && st.s - s < 45) return true; return false; }
function busUnload(c) {
  const n = c.passengers.length;
  for (const p of c.passengers) { p.hidden = false; p.onBus = null; p.ride = null; const [x, y] = freeNear(c.x, c.y, 14); p.x = x; p.y = y; p.panic = 1; p.vx = p.vy = 0; }
  c.passengers = []; c.unloaded = true;
  if (n) logT("bus", `Пассажиры выбегают из автобуса: ${n} чел.`, "bad", 20);
}

/* ---------- пассажиры: горожанин идёт на остановку, ждёт автобус и садится; выходит через 2–4 остановки ---------- */
// в новом городе на остановках уже кто-то ждёт: по одному-два ближайших горожанина к каждой остановке с маршрутом
function seedBusWaiters() {
  for (const st of busStops) {
    if (!st.lines.length) continue;
    const n = 1 + Math.floor(Math.random() * 2), cand = [];
    near(st.x, st.y, 160, a => { if (a.role === "civ" && a.state === "alive" && !a.hidden && !a.busWait) cand.push(a); });
    cand.sort((a, b) => Math.hypot(a.x - st.x, a.y - st.y) - Math.hypot(b.x - st.x, b.y - st.y));
    for (const a of cand.slice(0, n)) { const u = rnd(-6, 6); a.busWait = { k: st.k, t0: simT, arrT: 0, x: st.wx + st.tx * u, y: st.wy + st.ty * u }; a.x = a.busWait.x; a.y = a.busWait.y; a.dest = null; }
  }
}
function busWaitStart(a) {
  let best = null, bd = 260;
  for (const st of busStops) { if (!st.lines.length) continue; const d = Math.hypot(st.x - a.x, st.y - a.y); if (d > 25 && d < bd) { bd = d; best = st; } }
  if (!best) return false;
  let n = 0; near(best.x, best.y, 40, b => { if (b.busWait && b.busWait.k === best.k) n++; }); if (n >= 5) return false; // на остановке и так толпа
  const u = rnd(-6, 6); a.busWait = { k: best.k, t0: simT, arrT: 0, x: best.wx + best.tx * u, y: best.wy + best.ty * u };
  return true;
}
// шаг ждущего (из thinkHuman): к остановке, стоять, к подъехавшему автобусу; устал ждать или опасность — по своим делам
function busWaitStep(a, dt, zn) {
  const Wt = a.busWait, st = busStops[Wt.k];
  if (!st || zn || a.panic > .5 || simT - Wt.t0 > 150 || settings.curfew) { a.busWait = null; return null; }
  const c = st.bus;
  // автобус встал — к передней двери (справа по ходу, чуть позади центра); пока катится, с тротуара не сходят
  if (c && c.park && c.park.stop === st.k && !c.panic && !c.gone && c.v < .5 && (c.passengers || []).length < BUS_CAP) {
    const tx = Math.cos(c.ang), ty = Math.sin(c.ang), dx = c.x - tx * 6 - ty * 5, dy = c.y - ty * 6 + tx * 5;
    if (Math.hypot(dx - a.x, dy - a.y) < 8) { busBoardLine(a, c, st); return [0, 0, 0]; }
    return goTo(a, dx, dy, 9);
  }
  if (Math.hypot(Wt.x - a.x, Wt.y - a.y) < 4) {
    if (!Wt.arrT) Wt.arrT = simT;
    else if (simT - Wt.arrT > BUS_WAIT_MAX) { a.busWait = null; a.idleT = rnd(10, 30); st.gaveUp = (st.gaveUp || 0) + 1; return null; }
    return [0, 0, 0];
  }
  return goTo(a, Wt.x, Wt.y, 6);
}
