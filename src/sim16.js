/* ---------- машины как твёрдые тела: наезд при касании кузова, машины не проезжают друг сквозь друга ---------- */
function carHalf(c) { return [10 * (c.len || 1), c.tank ? 7 : 4.6]; }
// наезд: человек или зомби внутри прямоугольника кузова (с учётом пути за шаг)
function carHitPeople(c, tx, ty, dt) {
  if (c.v < 3) return;
  const [hl, hw] = carHalf(c), reach = hl + c.v * dt + .6;
  near(c.x + tx * hl * .5, c.y + ty * hl * .5, reach + 4, a => {
    if (a.state !== "alive" || a.hidden || a.z > 0.5 || a.grabT > 0) return;
    const dx = a.x - c.x, dy = a.y - c.y, al = dx * tx + dy * ty, lt = -dx * ty + dy * tx;
    if (al < -hl + 2 || al > reach || Math.abs(lt) > hw + .4) return;
    const k = c.v / 40, side = Math.sign(lt) || (Math.random() < .5 ? 1 : -1);
    if (a.role === "zombie") { a.zhp -= 1.2 * k + .4; a.riseT = 1.2; if (a.zhp <= 0) destroyZombie(a, false); }
    else { a.hp -= c.v < 10 ? 6 : 60 * k + 18; if (a.hp <= 0) kill(a, false, "car"); else a.grabT = 1; }
    // отлетает вперёд и в сторону от бампера
    a.vx = tx * c.v * .75 - ty * side * c.v * .35 + rnd(-3, 3); a.vy = ty * c.v * .75 + tx * side * c.v * .35 + rnd(-3, 3);
    a.vz = 2 + c.v * .22; a.z = Math.max(a.z, .1); a.spin = rnd(-6, 6);
    if (a.state === "dead") { a.vz = 7 + c.v * .3; a.spin = rnd(-8, 8); }
    fxBlood(a.x, a.y, 3, 6); sfx.thud(c); c.dmg++; c.v *= c.v > 20 ? .7 : .5;
    if (c.dmg > 3 && Math.random() < .3 && !c.service) { c.wreck = true; abandonCar(c, "crash"); logT("crash", "Машина разбилась, сбив людей", "bad"); }
  });
}
// пересечение двух повёрнутых прямоугольников: куда и насколько отодвинуть первый
function obbOverlap(a, b) {
  const ca = Math.cos(a.ang), sa = Math.sin(a.ang), cb = Math.cos(b.ang), sb = Math.sin(b.ang);
  const [al, aw] = carHalf(a), [bl, bw] = carHalf(b);
  let best = null;
  for (const [ux, uy] of [[ca, sa], [-sa, ca], [cb, sb], [-sb, cb]]) {
    const ra = al * Math.abs(ux * ca + uy * sa) + aw * Math.abs(-ux * sa + uy * ca), rb = bl * Math.abs(ux * cb + uy * sb) + bw * Math.abs(-ux * sb + uy * cb);
    const d = (b.x - a.x) * ux + (b.y - a.y) * uy, pen = ra + rb - Math.abs(d);
    if (pen <= 0) return null;
    if (!best || pen < best.depth) best = { nx: d > 0 ? -ux : ux, ny: d > 0 ? -uy : uy, depth: pen };
  }
  return best;
}
// отодвигаем только вдоль собственного курса, чтобы машина не сползала с полосы
function nudgeBack(c, nx, ny, amount) {
  if (c.tank) return;
  const bx = Math.cos(c.ang), by = Math.sin(c.ang), s = (nx * bx + ny * by) * amount;
  if (c.turn) c.turn.u = Math.max(0, c.turn.u + s);
  else if (c.lane) c.s = clamp(c.s + s, 0, c.lane.e.len);
  c.x += bx * s; c.y += by * s;
}
function resolveCarOverlaps(dt) {
  let i = 0; for (const c of cars) c._i = i++;
  for (const c of cars) {
    if (c.gone || c.z > 0 || c.towedBy || !(c.moving || c.stopped || c.tank)) continue;
    nearCars(c.x, c.y, 36, o => {
      if (o === c || o._i <= c._i || o.gone || o.z > 0 || o.towedBy || !(o.moving || o.stopped || o.tank)) return;
      const cm = c.moving && !c.tank, om = o.moving && !o.tank;
      if (!cm && !om) return;
      const h = obbOverlap(c, o); if (!h) return;
      const push = Math.min(h.depth, 2.5);
      if (cm && om) {
        const rel = Math.abs((c.v || 0) - (o.v || 0));
        if (rel > 22 && (c.panic || o.panic)) { const heavy = x => x.service === "bus" || x.service === "ambulance" || x.service === "fire" || x.service === "army" || x.service === "dump" || x.service === "supply"; let f = (c.v || 0) >= (o.v || 0) ? c : o; if (heavy(f) && !heavy(f === c ? o : c)) f = f === c ? o : c; carCollide(f, f === c ? o : c, Math.max(c.v || 0, o.v || 0)); return; }
        nudgeBack(c, h.nx, h.ny, push * .5); nudgeBack(o, -h.nx, -h.ny, push * .5);
        const cBehind = (o.x - c.x) * Math.cos(c.ang) + (o.y - c.y) * Math.sin(c.ang) > 0;
        if (cBehind) { c.v = Math.min(c.v, .8); c.jam = true; } else { o.v = Math.min(o.v, .8); o.jam = true; } // упёрлись: копится ожидание, машина ищет объезд
      } else {
        const m = cm ? c : o, s = cm ? o : c, sign = cm ? 1 : -1;
        if (m.panic && m.v > 16) { carCollide(m, s, m.v); return; }
        if (s.service === "bus" || s.service === "ambulance") { if (m.panic) carCollide(m, s, Math.max(m.v, 20)); }
        nudgeBack(m, h.nx * sign, h.ny * sign, push); m.v = 0; m.jam = true;
      }
    });
  }
}

/* ---------- объезд: препятствие на полосе, встречная свободна — выезжаем на неё и возвращаемся ---------- */
// встречная полоса свободна впереди: ни машин, ни завалов на 100 м
function oppClear(c, opp, dx, dy) {
  const so = opp.e.len - c.s, off2 = 2 * c.lane.off; let busy = false;
  nearCars(c.x + dx * 55, c.y + dy * 55, 70, o => {
    if (busy || o === c || o.gone || o.towedBy) return;
    if (o.lane === opp && !o.turn) { if (o.s < so + 14 && o.s > so - 110) busy = true; return; }
    const al = (o.x - c.x) * dx + (o.y - c.y) * dy, lt = (o.x - c.x) * dy - (o.y - c.y) * dx;
    if (Math.abs(lt - off2) < 5 && al > -14 && al < 110 && (o.moving || o.stopped || o.wreck || o.tank)) busy = true;
  });
  if (busy) return false;
  for (let k = 6; k < 90; k += 6) { const q = lanePos(opp, Math.max(0, so - k)), cc = cellAt(q.x, q.y); if (cc === 5 || cc === 3 || cc === 6 || cc === 8 || cc === 4) return false; }
  return true;
}
// в своей полосе впереди ещё стоит препятствие
function ownLaneBlocked(c) {
  const l = c.lane;
  for (let k = -8; k < 40; k += 6) { const q = lanePos(l, clamp(c.s + k, 0, l.e.len)); if (cellAt(q.x, q.y) === 5) return true; }
  let b = false; const q = lanePos(l, Math.min(l.e.len, c.s + 14));
  nearCars(q.x, q.y, 30, o => { if (b || o === c || o.gone) return; if (o.lane === l && !o.turn && o.s > c.s - 10 && o.s < c.s + 40 && (o.stopped || o.wreck || (o.moving && o.v < 1 && o.wait > 4 && !o.atLine))) b = true; });
  return b;
}
function stepOvertake(c, dt, dx, dy, clear, ahead) {
  if (!c.lane || c.tank || c.turn) return;
  const l = c.lane, opp = oppLane(l);
  if (c.over) {
    c.overT += dt;
    // встречная появилась или впереди перекрёсток — возвращаемся и тормозим
    let oncoming = false; nearCars(c.x + dx * 30, c.y + dy * 30, 40, o => { if (oncoming || o === c || o.gone || !o.moving) return; const al = (o.x - c.x) * dx + (o.y - c.y) * dy, lt = Math.abs((o.x - c.x) * dy - (o.y - c.y) * dx); if (al > 4 && al < 50 && lt < 5 && Math.cos(o.ang) * dx + Math.sin(o.ang) * dy < -.3) oncoming = true; });
    if ((oncoming && c.over === 1) || (c.overT > 1.5 && !ownLaneBlocked(c)) || c.overT > 14 || laneEnd(l) - c.s < 26) { c.over = 0; c.latTgt = 0; if (oncoming) c.v = Math.min(c.v, 4); }
    return;
  }
  if (c.wait < 2.5 || clear > 26 || c.panic || c.atLine) return;
  // очередь у светофора не объезжаем; объезжаем стоящее, разбитое, брошенное
  const obstacle = !ahead || ahead.stopped || ahead.wreck || !ahead.moving || (ahead.wait > 20 && !ahead.atLine);
  if (!obstacle) return;
  if (!opp) return;
  if (laneEnd(l) - c.s < 40 || c.s - laneStart(l) < 8) return; // у перекрёстка на встречку не выезжаем
  if (oppClear(c, opp, dx, dy)) { c.over = 1; c.overT = 0; c.latTgt = 2 * l.off; c.wait = 0; sfx.horn(c); return; }
  // встречная занята — по тротуару справа, медленно и с сигналом
  if (c.wait > 4) { const off = sideClear(c); if (off) { c.over = 2; c.overT = 0; c.latTgt = off; c.wait = 0; sfx.horn(c); logT("sidewalk", "Машина объезжает затор по тротуару", "", 30); return; } }
  // совсем глухо (стена, завал, вереница брошенных машин, тротуар занят) — разворачиваемся на встречную и едем назад
  if (c.wait > 12) { const s2 = l.e.len - c.s; if (!laneBusy(opp, s2, c)) { const ox = c.x, oy = c.y, ang = c.ang; l.e.blockT = simT; placeOnLane(c, opp, s2); c.offx = ox - c.x; c.offy = oy - c.y; c.x = ox; c.y = oy; c.ang = ang; c.wait = 0; c.v = 0; } }
}
// тротуар справа свободен на 70 м: только плитка, без деревьев, фонарей, домов и толпы
function sideClear(c) {
  const l = c.lane; let people = 0;
  near(c.x, c.y, 40, a => { if (a.state === "alive" && !a.hidden) people++; });
  if (people >= 8) return 0;
  // две полосы тротуара: у бордюра и у домов; берём ту, где в первые 30 м нет фонаря и гидранта
  for (const extra of [3.2, 6.4]) {
    const off = -(l.e.hw - l.off + extra); let ok = true;
    for (let k = 0; k < 60 && ok; k += 6) {
      const q = lanePos(l, Math.min(l.e.len, c.s + k)), x = q.x + q.ty * off, y = q.y - q.tx * off, gi = Math.floor(y / CS) * GW + Math.floor(x / CS);
      const g = gi >= 0 && gi < GW * GH ? grid[gi] : 9;
      if (roadMask[gi] === 1 || !(g === 1 || g === 2 || g === 7)) { ok = false; break; }
      if (k < 32) { for (const lp of lamps) if (Math.abs(lp.x - x) < 3.2 && Math.abs(lp.y - y) < 3.2) { ok = false; break; } if (ok) for (const h of hydrants) if (Math.abs(h.x - x) < 2.6 && Math.abs(h.y - y) < 2.6) { ok = false; break; } }
    }
    if (ok) return off;
  }
  return 0;
}
// люди на тротуаре шарахаются от машины
function sidewalkScatter(c, tx, ty) {
  near(c.x + tx * 14, c.y + ty * 14, 18, a => { if (a.state !== "alive" || a.hidden || a.role === "zombie") return; a.panic = Math.max(a.panic, .5); const lt = -(a.x - c.x) * ty + (a.y - c.y) * tx; a.vx += (-ty) * (lt < 0 ? -1 : 1) * 6; a.vy += tx * (lt < 0 ? -1 : 1) * 6; });
}
