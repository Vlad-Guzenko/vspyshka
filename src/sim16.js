/* ---------- машины как твёрдые тела: наезд при касании кузова, машины не проезжают друг сквозь друга ---------- */
function carHalf(c) { return [10 * (c.len || 1), c.tank ? 7 : 4.6]; }
// наезд: человек или зомби внутри прямоугольника кузова (с учётом пути за шаг)
function carHitPeople(c, tx, ty, dt) {
  if (c.v < 3) return;
  const [hl, hw] = carHalf(c), reach = hl + c.v * dt + .6, soft = c.v < 8 && !c.panic; // на малом ходу машина встаёт, человек отступает
  near(c.x + tx * hl * .5, c.y + ty * hl * .5, reach + 4, a => {
    if (a.state !== "alive" || a.hidden || a.z > 0.5 || a.grabT > 0) return;
    const dx = a.x - c.x, dy = a.y - c.y, al = dx * tx + dy * ty, lt = -dx * ty + dy * tx;
    if (al < -hl + 2 || al > reach || Math.abs(lt) > hw + .4) return;
    const k = c.v / 40, side = Math.sign(lt) || (Math.random() < .5 ? 1 : -1);
    if (soft && a.role !== "zombie") { c.v = 0; c.jam = true; a.vx += -ty * side * 5; a.vy += tx * side * 5; a.panic = Math.max(a.panic, .25); return; }
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
/* ---------- полёт: машину подбросило взрывом или ударом. Простая физика твёрдого ящика: соседей берём из сетки машин и людей ---------- */
// летящая машина бьёт людей и машины на пути, от стены дома отскакивает; ниже 7 м кузов задевает всё, что на земле
function flyCar(c, dt) {
  c.vz -= 39 * dt; c.z += c.vz * dt; c.roll += c.sr * dt; c.ang += c.sy * dt;
  const nx = clamp(c.x + c.vx * dt, 4, W - 4), ny = clamp(c.y + c.vy * dt, 4, H - 4), low = c.z < 24;
  let wall = false;
  if (low && cellAt(nx, c.y) === 3) { c.vx *= -.35; wall = true; } else c.x = nx;
  if (low && cellAt(c.x, ny) === 3) { c.vy *= -.35; wall = true; } else c.y = ny;
  if (wall) { c.sy = (c.sy || 0) * -.5 + rnd(-1.5, 1.5); c.sr = (c.sr || 0) * .6; c.dent = Math.max(c.dent || 0, .5); if (simT - (c.hitT || 0) > .3) { c.hitT = simT; fxDebris(c.x, c.y); sfx.crash(c); } }
  const sp = Math.hypot(c.vx, c.vy);
  if (c.z > 8 || sp < 4) return;
  const ca = Math.cos(c.ang), sa = Math.sin(c.ang), [hl, hw] = carHalf(c);
  if (sp > 8) near(c.x, c.y, hl + 3, a => {
    if (a.hidden || a.post || a.state === "saved" || (a.z || 0) > c.z + 6 || a.carHitT > simT) return;
    const dx = a.x - c.x, dy = a.y - c.y; if (Math.abs(dx * ca + dy * sa) > hl + .6 || Math.abs(-dx * sa + dy * ca) > hw + .6) return;
    a.carHitT = simT + .6; const k = sp / 40;
    if (a.state === "alive") {
      if (a.role === "zombie") { a.zhp -= 1.5 * k + .5; a.riseT = 1.2; if (a.zhp <= 0) destroyZombie(a, false); }
      else { a.hp -= 50 * k + 15; if (a.hp <= 0) kill(a, false, "car"); else a.grabT = 1; }
    }
    a.vx = c.vx * .8 + rnd(-3, 3); a.vy = c.vy * .8 + rnd(-3, 3); a.vz = Math.max(a.vz || 0, 4 + sp * .2); a.z = Math.max(a.z || 0, .1); a.spin = rnd(-8, 8);
    c.vx *= .9; c.vy *= .9; fxBlood(a.x, a.y, 3, 6); sfx.thud(c);
  });
  nearCars(c.x, c.y, 26, o => {
    if (o === c || o.gone || o.towedBy || o.player || Math.abs((o.z || 0) - c.z) > 6) return;
    const h = obbOverlap(c, o); if (!h) return;
    c.x += h.nx * Math.min(h.depth, 3); c.y += h.ny * Math.min(h.depth, 3); // нормаль смотрит от o к c
    const rv = (c.vx - (o.vx || 0) * (o.z > 0 ? 1 : 0)) * h.nx + (c.vy - (o.vy || 0) * (o.z > 0 ? 1 : 0)) * h.ny;
    if (rv >= 0) return;
    if (o.tank) { c.vx -= 1.4 * rv * h.nx; c.vy -= 1.4 * rv * h.ny; }
    else {
      // упругий удар двух ящиков: автобус и грузовик втрое тяжелее легковой
      const m1 = c.len > 1.4 || c.bus ? 3 : 1, m2 = o.len > 1.4 || o.bus ? 3 : 1, j = -1.3 * rv / (1 / m1 + 1 / m2);
      c.vx += j / m1 * h.nx; c.vy += j / m1 * h.ny;
      knockCar(o, -j / m2 * h.nx, -j / m2 * h.ny);
    }
    c.sy = (c.sy || 0) + rnd(-2, 2);
    if (simT - (c.hitT || 0) > .3) { c.hitT = simT; fxDebris(o.x, o.y); sfx.crash(c); }
  });
}
// машину толкнули: подпрыгивает и отлетает; сильно — она разбита (водитель её бросает)
function knockCar(o, vx, vy) {
  const imp = Math.hypot(vx, vy); if (imp < 3) return;
  o.vx = (o.z > 0 ? o.vx || 0 : 0) + vx; o.vy = (o.z > 0 ? o.vy || 0 : 0) + vy; o.vz = Math.max(o.vz || 0, 2 + imp * .22); o.z = Math.max(o.z || 0, .1);
  o.sr = (o.sr || 0) + rnd(-1, 1) * imp * .06; o.sy = rnd(-1.5, 1.5); o.roll = o.roll || 0; o.v = 0;
  o.wreck = true; if (o.moving) abandonCar(o, "crash"); // из автобуса выходят раненые (abandonCar в sim3.js)
  o.dent = Math.max(o.dent || 0, Math.min(1, imp / 40)); o.glass = o.glass || imp > 15;
  clearCarCells(o);
}
// приземлилась: не внутри соседней машины и не в стене; кого накрыло кузовом — раздавлен
function landCar(c, fall) {
  c.vx = 0; c.vy = 0;
  for (let k = 0; k < 3; k++) {
    let moved = false;
    nearCars(c.x, c.y, 26, o => { if (o === c || o.gone || o.towedBy || o.z > 0) return; const h = obbOverlap(c, o); if (h) { c.x = clamp(c.x + h.nx * (h.depth + .2), 4, W - 4); c.y = clamp(c.y + h.ny * (h.depth + .2), 4, H - 4); moved = true; } });
    if (!moved) break;
  }
  if (cellAt(c.x, c.y) === 3) { const [x, y] = freeNear(c.x, c.y, 24); c.x = x; c.y = y; }
  if (fall < 12) return;
  const ca = Math.cos(c.ang), sa = Math.sin(c.ang), [hl, hw] = carHalf(c);
  near(c.x, c.y, hl + 2, a => {
    if (a.state !== "alive" || a.hidden || a.post || a.z > 2) return;
    const dx = a.x - c.x, dy = a.y - c.y; if (Math.abs(dx * ca + dy * sa) > hl || Math.abs(-dx * sa + dy * ca) > hw) return;
    if (a.role === "zombie") destroyZombie(a, false); else { kill(a, false, "car"); a.reanimate = false; } a.crushed = true; fxBlood(a.x, a.y, 1, 8);
  });
}
// тело летит: не проходит сквозь кузов (ниже крыши отскакивает от борта), сбивает с ног тех, в кого врезалось
function bodyHits(a, nx, ny) {
  const sp = Math.abs(a.vx) + Math.abs(a.vy); if (a.z > 6 || sp < 2) return false;
  let hit = null;
  nearCars(nx, ny, 16, c => { if (!hit && !c.gone && !(c.z > 3) && insideCar(c, nx, ny)) hit = c; });
  if (hit) {
    const ca = Math.cos(hit.ang), sa = Math.sin(hit.ang), dx = a.x - hit.x, dy = a.y - hit.y, al = dx * ca + dy * sa, lt = -dx * sa + dy * ca, [hl, hw] = carHalf(hit);
    const ex = (hl - Math.abs(al)) < (hw - Math.abs(lt)), n0 = ex ? ca * Math.sign(al || 1) : -sa * Math.sign(lt || 1), n1 = ex ? sa * Math.sign(al || 1) : ca * Math.sign(lt || 1), vn = a.vx * n0 + a.vy * n1;
    if (vn < 0) { a.vx -= 1.3 * vn * n0; a.vy -= 1.3 * vn * n1; a.spin = (a.spin || 0) * -.5; }
    a.vx *= .7; a.vy *= .7; if (sp > 20) sfx.thud(hit);
    return true;
  }
  if (sp > 18 && a.z < 4) near(nx, ny, 2.4, b => {
    if (b === a || b.state !== "alive" || b.hidden || b.post || b.z > 1 || b.carHitT > simT) return;
    b.carHitT = simT + .5; b.vx += a.vx * .5; b.vy += a.vy * .5;
    if (b.role === "zombie") b.riseT = 1; else { b.hp -= sp * .4; if (b.hp <= 0) kill(b, false, "blast"); }
    a.vx *= .6; a.vy *= .6;
  });
  return false;
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
      if (c.player || o.player) return; // машина игрока расталкивает соседей сама (drive.js)
      const cm = c.moving && !c.tank, om = o.moving && !o.tank;
      if (!cm && !om) return;
      const h = obbOverlap(c, o); if (!h) return;
      // шесть секунд упираемся в чужой едущий кузов (у стоп-линии, на соседней дуге, в очереди на кольце) — протискиваемся мимо,
      // иначе получается кольцо ожидания: каждый ждёт того, кто ждёт его. Через брошенные и разбитые машины не протискиваемся.
      // Протискивание держится три секунды, иначе через кадр снова упор, и машина дёргается на месте
      if (c.jamS > 6 && om) c.ghostT = simT + 3;
      if (o.jamS > 6 && cm) o.ghostT = simT + 3;
      if (simT < c.ghostT || simT < o.ghostT) return;
      const push = Math.min(h.depth, 2.5);
      if (cm && om) {
        // двое на одном перекрёстке упёрлись: сдаёт назад по своей дуге тот, кому это проще по курсу (нормаль упора
        // ближе к его оси), и несколько секунд уступает; второй ждёт, пока его не отпустят, и едет
        if (c.turn && o.turn && c.turn.n === o.turn.n && c.turn.from !== o.turn.from) { // с одной улицы — просто едут друг за другом
          const rc = Math.abs(h.nx * Math.cos(c.ang) + h.ny * Math.sin(c.ang)), ro = Math.abs(h.nx * Math.cos(o.ang) + h.ny * Math.sin(o.ang));
          const y = rc >= ro ? c : o, w = y === c ? o : c, sg = y === c ? 1 : -1;
          // уступающий восемь секунд не может ни отъехать, ни дождаться — протискивается сам (иначе кольцо из трёх ждущих стоит вечно)
          if ((y.stallT || 0) > 8) { y.ghostT = simT + 3; y.yieldTo = null; return; }
          nudgeBack(y, h.nx * sg, h.ny * sg, push); y.v = 0; y.jam = true; y.yieldTo = w; y.yieldUntil = simT + 1; // пока касаются и секунду после (yieldT — другое: уступка сирене, traffic.js)
          if (w.yieldTo === y) w.yieldTo = null; if ((y.stallT || 0) < 4) w.v = Math.min(w.v, 2); // уступающий не может отъехать — второй протискивается мимо
          return;
        }
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
  for (let k = 6; k < 90; k += 6) { const q = lanePos(opp, Math.max(0, so - k)), cc = cellAt(q.x, q.y); if (cc === 5 || cc === 3 || cc === 6 || cc === 8 || cc === 4 || cc === 11) return false; }
  return true;
}
// в своей полосе на нашем месте никого: ни впереди, ни сзади ближе длины кузовов
function laneFree(c, l) {
  let free = true; const myL = 10 * (c.len || 1);
  nearCars(c.x, c.y, 50, o => { if (free && o !== c && !o.gone && o.lane === l && !o.turn && Math.abs(o.latOff || 0) < 9.1 && Math.abs(o.s - c.s) < myL + 10 * (o.len || 1) + 3 && (o.moving || o.stopped)) free = false; });
  return free;
}
// в своей полосе впереди ещё стоит препятствие
function ownLaneBlocked(c) {
  const l = c.lane;
  for (let k = -8; k < 40; k += 6) { const q = lanePos(l, clamp(c.s + k, 0, l.e.len)); if (cellAt(q.x, q.y) === 5) return true; }
  let b = false; const q = lanePos(l, Math.min(l.e.len, c.s + 14));
  nearCars(q.x, q.y, 30, o => { if (b || o === c || o.gone) return; if (o.lane === l && !o.turn && o.s > c.s - 10 && o.s < c.s + 40 && (o.stopped || o.wreck || (o.moving && o.v < 1 && o.wait > 4 && !o.atLine))) b = true; });
  return b;
}
// машина впереди застряла, а не ждёт своей очереди: брошена, разбита, стоит у бордюра, давно стоит не у стоп-линии и не в очереди
// (её держат люди, завал, упор), или стоит в очереди за такой же застрявшей — тогда объезжаем всю вереницу
function stuckCar(o, depth) {
  if (o.stopped || o.wreck || !o.moving || o.park) return true;
  if (o.atLine || o.turn) return false;
  if ((o.stallT || 0) > 6 && o.hold === "other") return true;
  if ((o.wait || 0) > 20) return true;
  return depth < 3 && o.hold === "queue" && (o.stallT || 0) > 4 && o.holdBy && o.holdBy !== o && stuckCar(o.holdBy, depth + 1);
}
// впереди мёртвая преграда: разбитая, горящая, брошенная машина — или очередь, которая стоит за такой; ждать её бесполезно
function deadBlock(o, depth) {
  if (!o) return false;
  if (o.wreck || o.stopped || !o.moving || o.burnT > 0) return true;
  return depth < 4 && o.hold === "queue" && (o.stallT || 0) > 2 && !!o.holdBy && o.holdBy !== o && deadBlock(o.holdBy, depth + 1);
}
// cellBlock — держит не машина, а клетки впереди (завал, баррикада, дом поперёк улицы)
function stepOvertake(c, dt, dx, dy, clear, ahead, cellBlock) {
  if (!c.lane || c.tank || c.turn) return;
  const l = c.lane, opp = oppLane(l);
  if (c.over) {
    c.overT += dt;
    // встречная появилась или впереди перекрёсток — возвращаемся и тормозим
    let oncoming = false; nearCars(c.x + dx * 30, c.y + dy * 30, 40, o => { if (oncoming || o === c || o.gone || !o.moving) return; const al = (o.x - c.x) * dx + (o.y - c.y) * dy, lt = Math.abs((o.x - c.x) * dy - (o.y - c.y) * dx); if (al > 4 && al < 50 && lt < 5 && Math.cos(o.ang) * dx + Math.sin(o.ang) * dy < -.3) oncoming = true; });
    // по левой полосе широкой улицы въезжаем в перекрёсток, не сливаясь вправо: дальше либо тоже широкая (едем левой), либо
    // машина съезжает на дугу со сдвигом, который гаснет по ходу поворота (startTurn)
    const back = (oncoming && c.over === 1) || (!c.contra && c.overT > 1.5 && !ownLaneBlocked(c)) || c.overT > (c.contra ? 40 : 14) || (c.over !== 3 && laneEnd(l) - c.s < 26);
    // в свою полосу — только в просвет между машинами (навстречу едут — возвращаемся в любом случае); пока его нет, со встречной
    // ждём рядом, а по левой полосе широкой улицы едем дальше: она своя, и в перекрёсток с неё можно
    if (back) { if ((oncoming && c.over === 1) || laneFree(c, l)) { c.over = 0; c.contra = false; c.latTgt = 0; if (oncoming) c.v = Math.min(c.v, 4); } else if (c.over !== 3) c.v = Math.min(c.v, 1.5); }
    return;
  }
  // реверс: при эвакуации (тревога 3+) бегущие по трассам и проспектам к выезду занимают и встречную полосу, если она пуста на 110 м
  if (c.flee && alert >= 3 && opp && (l.e.rural || l.e.kind === "hw" || l.e.kind === "av") && clear < 40 && laneEnd(l) - c.s > 60 && c.s - laneStart(l) > 8 && oppClear(c, opp, dx, dy)) { c.over = 1; c.contra = true; c.overT = 0; c.latTgt = 2 * l.off; logT("contra", "Бегущие из города заняли и встречную полосу", "", 60); return; }
  if (c.wait < 2.5 || clear > 26 || c.panic || c.atLine) return;
  // очередь у светофора не объезжаем; объезжаем стоящее, разбитое, брошенное
  const wide = l.e.hw >= 22 && !l.e.oneway;
  const obstacle = !ahead || stuckCar(ahead, 0) || wide; // стоящий у бордюра (автобус на остановке) — тоже
  if (!obstacle) return;
  if (!opp) return;
  // широкая улица (две полосы в каждую сторону): объезжаем по своей левой полосе, встречную не трогаем, можно и у перекрёстка
  if (l.e.hw >= 22 && !l.e.oneway && laneEnd(l) - c.s > 14) {
    // центр машины у осевой: от стоящей и от встречной — больше двух ширин кузова; на бульваре с деревьями посередине — у края
    // разделительной полосы, а если и там на пути дерево или завал, левой полосой не объезжаем (раньше машина упиралась в дерево)
    const free = o => { for (let k = 0; k < 44; k += 6) { const q = lanePos(l, Math.min(c.s + k, l.e.len)), g = cellAt(q.x + q.ty * o, q.y - q.tx * o); if (g === 3 || g === 4 || g === 6 || g === 8) return false; } return true; }; // кузова (5) смотрит проверка машин ниже
    const tgt = free(l.off - .6) ? l.off - .6 : free(l.off - 5) ? l.off - 5 : null; let busy = tgt === null;
    nearCars(c.x + dx * 18, c.y + dy * 18, 34, o => { if (busy || o === c || o.gone) return; if (o.lane === l && !o.turn && Math.abs((o.latOff || 0) - tgt) < 6 && o.s > c.s - 12 && o.s < c.s + 40) busy = true; });
    if (!busy) { c.over = 3; c.overT = 0; c.latTgt = tgt; c.wait = 0; return; }
  }
  // впереди мёртвая преграда (или очередь за ней): ждать нечего — разворот почти сразу, а улица на полторы минуты помечается
  // непроезжей, чтобы остальные уходили в объезд ещё на подъезде. Первый у преграды сначала пробует объехать по встречной,
  // стоящие в очереди за ней вереницу не обгоняют — разворачиваются
  const dead = cellBlock || deadBlock(ahead, 0), front = cellBlock || (ahead && !(ahead.hold === "queue" && !ahead.wreck && !ahead.stopped && ahead.moving));
  if (dead && !front && c.wait > 2.5 && uTurn(c, l, opp)) return;
  // у перекрёстка на встречку не выезжаем, но развернуться можно, если давно стоим (у мёртвой преграды — сразу), а встречная свободна
  if (laneEnd(l) - c.s < 40 || c.s - laneStart(l) < 8) { if (c.wait > (dead ? 2.5 : 12)) uTurn(c, l, opp); return; }
  if (oppClear(c, opp, dx, dy)) { c.over = 1; c.overT = 0; c.latTgt = 2 * l.off; c.wait = 0; sfx.horn(c); return; }
  // встречная занята — по тротуару справа, медленно и с сигналом
  if (c.wait > 4) { const off = sideClear(c); if (off) { c.over = 2; c.overT = 0; c.latTgt = off; c.wait = 0; sfx.horn(c); logT("sidewalk", "Машина объезжает затор по тротуару", "", 30); return; } }
  // совсем глухо (стена, завал, вереница брошенных машин, тротуар занят) — разворачиваемся на встречную и едем назад
  if (c.wait > (dead ? 4 : 12)) uTurn(c, l, opp);
}
// разворот на месте на встречную полосу той же улицы, если там рядом свободно; улица помечается непроезжей для маршрутов
function uTurn(c, l, opp) {
  if (!opp) return false;
  const s2 = l.e.len - c.s; if (laneBusy(opp, s2, c)) return false;
  if (simT - l.e.blockT > 30) { l.e.blockT = simT; routeCache.clear(); } else l.e.blockT = simT;
  const ox = c.x, oy = c.y, ang = c.ang; placeOnLane(c, opp, s2); c.offx = ox - c.x; c.offy = oy - c.y; c.x = ox; c.y = oy; c.ang = ang; c.wait = 0; c.v = 0;
  return true;
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
