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
