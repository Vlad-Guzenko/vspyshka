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
  if (c.curve || c.tank) return;
  const bx = Math.cos(c.ang), by = Math.sin(c.ang), s = nx * bx + ny * by;
  c.x += bx * s * amount; c.y += by * s * amount;
}
function resolveCarOverlaps(dt) {
  let i = 0; for (const c of cars) c._i = i++;
  for (const c of cars) {
    if (c.gone || c.z > 0 || c.towedBy || !(c.moving || c.stopped || c.tank)) continue;
    nearCars(c.x, c.y, 36, o => {
      if (o === c || o._i <= c._i || o.gone || o.z > 0 || o.towedBy || !(o.moving || o.stopped || o.tank)) return;
      const h = obbOverlap(c, o); if (!h) return;
      const cm = c.moving && !c.tank, om = o.moving && !o.tank, push = Math.min(h.depth, 2.5);
      if (!cm && !om) return;
      if (cm && om) {
        const rel = Math.abs((c.v || 0) - (o.v || 0));
        if (rel > 22 && (c.panic || o.panic)) { const f = (c.v || 0) >= (o.v || 0) ? c : o; carCollide(f, f === c ? o : c, Math.max(c.v || 0, o.v || 0)); return; }
        nudgeBack(c, h.nx, h.ny, push * .5); nudgeBack(o, -h.nx, -h.ny, push * .5);
        const cBehind = (o.x - c.x) * Math.cos(c.ang) + (o.y - c.y) * Math.sin(c.ang) > 0;
        if (cBehind) c.v = Math.min(c.v, 1); else o.v = Math.min(o.v, 1);
      } else {
        const m = cm ? c : o, s = cm ? o : c, sign = cm ? 1 : -1;
        if (m.panic && m.v > 16) { carCollide(m, s, m.v); return; }
        nudgeBack(m, h.nx * sign, h.ny * sign, push); m.v = 0;
      }
    });
  }
}

/* ---------- объезд: препятствие на полосе, встречная свободна — выезжаем на неё и возвращаемся ---------- */
// встречная полоса свободна впереди: ни машин, ни завалов на 100 м
function oppClear(c, opp, dx, dy) {
  const oc = opp.c, px = c.lane.s.v ? oc : c.x, py = c.lane.s.v ? c.y : oc;
  let busy = false;
  nearCars(px + dx * 55, py + dy * 55, 70, o => { if (busy || o === c || o.gone || o.towedBy) return; const al = (o.x - px) * dx + (o.y - py) * dy, lt = c.lane.s.v ? Math.abs(o.x - oc) : Math.abs(o.y - oc); if (lt < 5 && al > -14 && al < 110 && (o.moving || o.stopped || o.wreck || o.tank)) busy = true; });
  if (busy) return false;
  for (let k = 6; k < 90; k += 6) { const cc = cellAt(px + dx * k, py + dy * k); if (cc === 5 || cc === 3 || cc === 6 || cc === 8 || cc === 4) return false; }
  return true;
}
// в своей полосе впереди ещё стоит препятствие
function ownLaneBlocked(c, dx, dy) {
  const lc = c.lane.c, px = c.lane.s.v ? lc : c.x, py = c.lane.s.v ? c.y : lc;
  for (let k = -8; k < 40; k += 6) { const cc = cellAt(px + dx * k, py + dy * k); if (cc === 5) return true; }
  let b = false; nearCars(px + dx * 14, py + dy * 14, 30, o => { if (b || o === c || o.gone) return; const al = (o.x - px) * dx + (o.y - py) * dy, lt = c.lane.s.v ? Math.abs(o.x - lc) : Math.abs(o.y - lc); if (lt < 5 && al > -10 && al < 40 && (o.stopped || o.wreck || (o.moving && o.v < 1 && o.wait > 4))) b = true; });
  return b;
}
function stepOvertake(c, dt, dx, dy, clear, ahead) {
  if (!c.lane || c.tank) return;
  if (c.over) {
    c.overT += dt;
    // встречная появилась — возвращаемся и тормозим
    let oncoming = false; nearCars(c.x + dx * 30, c.y + dy * 30, 40, o => { if (oncoming || o === c || o.gone || !o.moving) return; const al = (o.x - c.x) * dx + (o.y - c.y) * dy, lt = Math.abs((o.x - c.x) * dy - (o.y - c.y) * dx); if (al > 4 && al < 50 && lt < 5 && o.dir === (c.dir + 2) % 4) oncoming = true; });
    if (oncoming || (c.overT > 1.5 && !ownLaneBlocked(c, dx, dy)) || c.overT > 14) { c.over = 0; c.latTgt = 0; if (oncoming) c.v = Math.min(c.v, 4); }
    return;
  }
  if (c.wait < 2.5 || clear > 26 || c.turnT > 0 || c.panic) return;
  const blockedBy = ahead ? (ahead.stopped || ahead.wreck || !ahead.moving || (ahead.v < 1 && ahead.wait > 4)) : true;
  if (!blockedBy) return;
  const opp = laneOf(c.lane.s, (c.dir + 2) % 4); if (!opp) return;
  // совсем глухо (стена, завал, вереница брошенных машин) — разворачиваемся на встречную и едем назад
  if (c.wait > 12 && !laneBusy(opp, c.lane.s.v ? c.y : c.x, c)) { const ox = c.x, oy = c.y; placeOnLane(c, opp, c.lane.s.v ? c.y : c.x); c.offx = ox - c.x; c.offy = oy - c.y; c.x = ox; c.y = oy; c.turnT = 1.2; c.wait = 0; c.plan = -1; c.planAt = undefined; return; }
  // не выезжаем на встречку у перекрёстка
  for (const l of lanes) { if (l.s.v === c.lane.s.v) continue; const along0 = c.lane.s.v ? c.y : c.x, d = (l.c - along0) * (c.dir < 2 ? 1 : -1); if (d > -10 && d < 40 && c.lane.c >= l.a0 - 2 && c.lane.c <= l.a1 + 2) return; }
  if (!oppClear(c, opp, dx, dy)) return;
  c.over = 1; c.overT = 0; c.latTgt = opp.c - c.lane.c; c.wait = 0; sfx.horn(c);
}
